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
  order: Order;
}

export interface WaiterRequest {
  restaurantId: number;
  tableId: number;
  customerName: string;
  timestamp: string;
  requestType?: string;
  tableSessionId?: number;
}

// Client tracking with heartbeat
type SocketClient = {
  socket: WebSocket;
  restaurantId?: number;
  tableId?: number;
  lastPing: number;
  isAlive: boolean;
};

let clients: SocketClient[] = [];

// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 35000;

export const setupWebSocketServer = (server: HttpServer) => {
  // Create a WebSocket server on a distinct path
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
    }
  });

  // Heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const client = clients.find(c => c.socket === ws);
      if (client) {
        if (!client.isAlive) {
          console.log('Client connection timed out');
          return ws.terminate();
        }
        
        client.isAlive = false;
        ws.ping();
      }
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('connection', (socket: WebSocket) => {
    // Add new client to the list
    const client: SocketClient = { 
      socket, 
      lastPing: Date.now(),
      isAlive: true 
    };
    clients.push(client);

    // Handle pong messages
    socket.on('pong', () => {
      const client = clients.find(c => c.socket === socket);
      if (client) {
        client.isAlive = true;
        client.lastPing = Date.now();
      }
    });

    // Handle messages from client
    socket.on('message', async (data: string) => {
      try {
        // Validate message format
        const message = socketMessageSchema.parse(JSON.parse(data));
        
        switch (message.type) {
          case 'register-restaurant': {
            // Register this connection as belonging to a restaurant
            const restaurantId = z.number().parse(message.payload.restaurantId);
            client.restaurantId = restaurantId;
            console.log(`[WebSocket] Client registered for restaurant ${restaurantId}. Total restaurant clients: ${clients.filter(c => c.restaurantId === restaurantId).length}`);
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
            
            // Broadcast thin patch to all clients
            broadcastToRestaurant(updateData.restaurantId, {
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
            
            // Broadcast to restaurant
            broadcastToRestaurant(orderData.restaurantId, {
              type: 'new-order-received',
              payload: orderData.order
            });
            break;
          }
            
          case 'call-waiter': {
            // Handle waiter request
            const waiterRequest = waiterRequestSchema.parse(message.payload);
            
            console.log('[WebSocket] Waiter request received:', waiterRequest);
            console.log('[WebSocket] Connected clients:', clients.length);
            console.log('[WebSocket] Restaurant clients:', clients.filter(c => c.restaurantId === waiterRequest.restaurantId).length);
            
            // If this is a bill payment request, mark the session as requesting bill
            if (waiterRequest.requestType === 'bill-payment' && waiterRequest.tableSessionId) {
              try {
                await storage.updateTableSession(waiterRequest.tableSessionId, {
                  billRequested: true,
                  billRequestedAt: new Date()
                });
                console.log(`[WebSocket] Session ${waiterRequest.tableSessionId} marked as requesting bill`);
              } catch (error) {
                console.error('[WebSocket] Error updating session bill request status:', error);
              }
            }
            
            // Broadcast to restaurant staff
            broadcastToRestaurant(waiterRequest.restaurantId, {
              type: 'waiter-requested',
              payload: waiterRequest
            });
            
            console.log('[WebSocket] Waiter request broadcasted to restaurant', waiterRequest.restaurantId);
            break;
          }
            
          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error: unknown) {
        console.error('Error handling WebSocket message:', error);
        if (error instanceof z.ZodError) {
          socket.send(JSON.stringify({
            type: 'error',
            payload: {
              message: 'Invalid message format',
              errors: error.errors
            }
          }));
        } else {
          socket.send(JSON.stringify({
            type: 'error',
            payload: {
              message: 'Internal server error'
            }
          }));
        }
      }
    });

    // Handle client disconnection
    socket.on('close', () => {
      // Remove client from the list
      clients = clients.filter(c => c.socket !== socket);
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      socket.close();
    });
  });

  // Cleanup on server close
  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
};

// Helper function to send a message to all clients connected to a specific restaurant
const broadcastToRestaurant = (restaurantId: number, message: SocketMessage) => {
  const messageStr = JSON.stringify(message);
  clients.forEach(client => {
    if (
      client.restaurantId === restaurantId && 
      client.socket.readyState === WebSocket.OPEN
    ) {
      try {
        client.socket.send(messageStr);
      } catch (error: unknown) {
        console.error('Error sending message to client:', error);
        client.socket.close();
      }
    }
  });
};

// Helper function to send a message to a specific table
export const sendToTable = (restaurantId: number, tableId: number, message: SocketMessage) => {
  const messageStr = JSON.stringify(message);
  clients.forEach(client => {
    if (
      client.restaurantId === restaurantId && 
      client.tableId === tableId && 
      client.socket.readyState === WebSocket.OPEN
    ) {
      try {
        client.socket.send(messageStr);
      } catch (error: unknown) {
        console.error('Error sending message to table:', error);
        client.socket.close();
      }
    }
  });
};
