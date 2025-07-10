import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from './storage';
import { z } from 'zod';

// Define message types with Zod schemas for validation
const orderStatusUpdateSchema = z.object({
  orderId: z.number(),
  status: z.string(),
  restaurantId: z.number()
});

const newOrderSchema = z.object({
  restaurantId: z.number(),
  order: z.any()
});

const waiterRequestSchema = z.object({
  restaurantId: z.number(),
  tableId: z.number(),
  customerName: z.string(),
  timestamp: z.string(),
  requestType: z.string().optional(),
  tableSessionId: z.number().optional()
});

const socketMessageSchema = z.object({
  type: z.string(),
  payload: z.record(z.unknown())
});

// Define message types
export interface SocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

export interface OrderStatusUpdate {
  orderId: number;
  status: string;
  restaurantId: number;
}

export interface NewOrder {
  restaurantId: number;
  order: any;
}

export interface WaiterRequest {
  restaurantId: number;
  tableId: number;
  customerName: string;
  timestamp: string;
  requestType?: string;
  tableSessionId?: number;
}

// Enhanced client tracking with heartbeat and connection metadata
type SocketClient = {
  socket: WebSocket;
  restaurantId?: number;
  tableId?: number;
  lastPing: number;
  isAlive: boolean;
  connectionTime: number;
  messageCount: number;
  lastMessageTime: number;
};

let clients: SocketClient[] = [];
let messageQueue: Array<{ restaurantId: number; message: SocketMessage }> = [];
let isProcessingQueue = false;

// Performance configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 35000; // 35 seconds
const MAX_CLIENTS_PER_RESTAURANT = 10;
const MESSAGE_QUEUE_BATCH_SIZE = 10;
const MESSAGE_QUEUE_PROCESS_INTERVAL = 100; // 100ms

// Process message queue in batches for better performance
async function processMessageQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  try {
    const batch = messageQueue.splice(0, MESSAGE_QUEUE_BATCH_SIZE);
    const restaurantGroups = new Map<number, SocketMessage[]>();
    
    // Group messages by restaurant
    batch.forEach(({ restaurantId, message }) => {
      if (!restaurantGroups.has(restaurantId)) {
        restaurantGroups.set(restaurantId, []);
      }
      restaurantGroups.get(restaurantId)!.push(message);
    });
    
    // Send batched messages
    for (const [restaurantId, messages] of restaurantGroups) {
      const restaurantClients = clients.filter(c => c.restaurantId === restaurantId);
      
      if (restaurantClients.length === 0) continue;
      
      // Send each message to all clients for this restaurant
      for (const message of messages) {
        const messageStr = JSON.stringify(message);
        for (const client of restaurantClients) {
          if (client.socket.readyState === WebSocket.OPEN) {
            try {
              client.socket.send(messageStr);
              client.messageCount++;
              client.lastMessageTime = Date.now();
            } catch (error) {
              console.error('Error sending message to client:', error);
              // Mark client for cleanup
              client.isAlive = false;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing message queue:', error);
  } finally {
    isProcessingQueue = false;
    
    // Schedule next processing if there are more messages
    if (messageQueue.length > 0) {
      setTimeout(processMessageQueue, MESSAGE_QUEUE_PROCESS_INTERVAL);
    }
  }
}

// Add message to queue for batched processing
function queueMessage(restaurantId: number, message: SocketMessage) {
  messageQueue.push({ restaurantId, message });
  
  if (!isProcessingQueue) {
    setTimeout(processMessageQueue, MESSAGE_QUEUE_PROCESS_INTERVAL);
  }
}

export const setupWebSocketServer = (server: HttpServer) => {
  // Create a WebSocket server with optimized configuration
  const wss = new WebSocketServer({ 
    server, 
    path: '/ws',
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10,
      threshold: 1024
    },
    maxPayload: 1024 * 1024, // 1MB max payload
  });

  // Optimized heartbeat interval
  const interval = setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((ws: WebSocket) => {
      const client = clients.find(c => c.socket === ws);
      if (client) {
        if (!client.isAlive) {
          console.log('Client connection timed out, removing');
          clients = clients.filter(c => c.socket !== ws);
          return ws.terminate();
        }
        
        client.isAlive = false;
        ws.ping();
      }
    });
    
    // Clean up old clients
    clients = clients.filter(client => {
      const isOld = now - client.connectionTime > 24 * 60 * 60 * 1000; // 24 hours
      if (isOld) {
        console.log('Removing old client connection');
        client.socket.terminate();
        return false;
      }
      return true;
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('connection', (socket: WebSocket) => {
    // Add new client to the list with enhanced tracking
    const client: SocketClient = { 
      socket, 
      lastPing: Date.now(),
      isAlive: true,
      connectionTime: Date.now(),
      messageCount: 0,
      lastMessageTime: Date.now()
    };
    clients.push(client);

    console.log(`[WebSocket] New connection. Total clients: ${clients.length}`);

    // Handle pong messages
    socket.on('pong', () => {
      const client = clients.find(c => c.socket === socket);
      if (client) {
        client.isAlive = true;
        client.lastPing = Date.now();
      }
    });

    // Handle messages from client with rate limiting
    socket.on('message', async (data: string) => {
      try {
        const client = clients.find(c => c.socket === socket);
        if (!client) return;

        // Rate limiting: max 10 messages per second per client
        const now = Date.now();
        if (now - client.lastMessageTime < 100) {
          console.warn('Rate limit exceeded for client');
          return;
        }
        client.lastMessageTime = now;

        // Validate message format
        const message = socketMessageSchema.parse(JSON.parse(data));
        
        switch (message.type) {
          case 'register-restaurant': {
            // Register this connection as belonging to a restaurant
            const restaurantId = z.number().parse(message.payload.restaurantId);
            
            // Check if we're at the limit for this restaurant
            const restaurantClientCount = clients.filter(c => c.restaurantId === restaurantId).length;
            if (restaurantClientCount >= MAX_CLIENTS_PER_RESTAURANT) {
              console.warn(`Max clients reached for restaurant ${restaurantId}`);
              socket.send(JSON.stringify({
                type: 'error',
                payload: { message: 'Too many connections for this restaurant' }
              }));
              return;
            }
            
            client.restaurantId = restaurantId;
            console.log(`[WebSocket] Client registered for restaurant ${restaurantId}. Total restaurant clients: ${restaurantClientCount + 1}`);
            break;
          }
            
          case 'register-table': {
            // Register this connection as belonging to a table
            const { restaurantId, tableId } = z.object({
              restaurantId: z.number(),
              tableId: z.number()
            }).parse(message.payload);
            
            client.restaurantId = restaurantId;
            client.tableId = tableId;
            break;
          }
            
          case 'update-order-status': {
            // Handle order status update
            const updateData = orderStatusUpdateSchema.parse(message.payload);
            
            // Update in database
            await storage.updateOrder(updateData.orderId, { status: updateData.status });
            
            // Queue message for batched broadcasting
            queueMessage(updateData.restaurantId, {
              type: 'order-patch',
              payload: {
                id: updateData.orderId,
                status: updateData.status,
                restaurantId: updateData.restaurantId
              }
            });
            break;
          }
            
          case 'new-order': {
            // Handle new order creation
            const orderData = newOrderSchema.parse(message.payload);
            
            // Queue message for batched broadcasting
            queueMessage(orderData.restaurantId, {
              type: 'new-order-received',
              payload: orderData.order
            });
            break;
          }
            
          case 'call-waiter': {
            // Handle waiter request
            const waiterRequest = waiterRequestSchema.parse(message.payload);
            
            console.log('[WebSocket] Waiter request received:', waiterRequest);
            
            // If this is a bill payment request, mark the session as requesting bill
            if (waiterRequest.requestType === 'bill-payment' && waiterRequest.tableSessionId) {
              try {
                await storage.updateTableSession(waiterRequest.tableSessionId, {
                  billRequested: true,
                  billRequestedAt: new Date()
                });
              } catch (error) {
                console.error('Error updating table session:', error);
              }
            }
            
            // Queue message for batched broadcasting
            queueMessage(waiterRequest.restaurantId, {
              type: 'waiter-requested',
              payload: waiterRequest
            });
            break;
          }
            
          default:
            console.warn(`Unknown message type: ${message.type}`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        socket.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Invalid message format' }
        }));
      }
    });

    socket.on('close', (code: number, reason: any) => {
      console.log(`[WebSocket] Client disconnected. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
      clients = clients.filter(c => c.socket !== socket);
    });

    socket.on('error', (error: Error) => {
      console.error('[WebSocket] Client error:', error);
      clients = clients.filter(c => c.socket !== socket);
    });
  });

  wss.on('error', (error) => {
    console.error('[WebSocket] Server error:', error);
  });

  // Cleanup on server shutdown
  wss.on('close', () => {
    clearInterval(interval);
    console.log('[WebSocket] Server closed');
  });
};

// Optimized broadcast function using message queue
const broadcastToRestaurant = (restaurantId: number, message: SocketMessage) => {
  queueMessage(restaurantId, message);
};

export const sendToTable = (restaurantId: number, tableId: number, message: SocketMessage) => {
  const tableClients = clients.filter(c => 
    c.restaurantId === restaurantId && c.tableId === tableId
  );
  
  if (tableClients.length === 0) return;
  
  const messageStr = JSON.stringify(message);
  tableClients.forEach(client => {
    if (client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(messageStr);
        client.messageCount++;
        client.lastMessageTime = Date.now();
      } catch (error) {
        console.error('Error sending message to table client:', error);
        client.isAlive = false;
      }
    }
  });
};

// Export the broadcast function
export { broadcastToRestaurant };
