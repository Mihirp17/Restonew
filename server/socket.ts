import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from './storage';
import { z } from 'zod';
import { IncomingMessage } from 'http';
import { parse } from 'url';

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

const registerRestaurantSchema = z.object({
  restaurantId: z.number()
});

const registerTableSchema = z.object({
  restaurantId: z.number(),
  tableId: z.number()
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

// Client tracking with heartbeat
type SocketClient = {
  id: string;
  socket: WebSocket;
  restaurantId: number;
  userId: number;
  tableId?: number;
  lastPing: number;
  isAlive: boolean;
};

// Global clients array - single source of truth for all client connections
const clients: SocketClient[] = [];

// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 35000;

export function setupWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });
  
  // Set up heartbeat interval to check for stale connections
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    
    // Check all clients for heartbeat timeout
    clients.forEach((client, index) => {
      // If client hasn't responded to ping within timeout, terminate connection
      if (!client.isAlive && (now - client.lastPing) > HEARTBEAT_TIMEOUT) {
        console.log(`WebSocket client ${client.id} timed out, closing connection`);
        client.socket.terminate();
        clients.splice(index, 1);
        return;
      }
      
      // Mark client as not alive until we get a pong response
      client.isAlive = false;
      
      // Send ping
      try {
        client.socket.ping();
      } catch (error) {
        console.error(`Error sending ping to client ${client.id}:`, error);
        client.socket.terminate();
        clients.splice(index, 1);
      }
    });
  }, HEARTBEAT_INTERVAL);
  
  // Cleanup on server close
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    
    // Close all client connections
    clients.forEach(client => {
      try {
        client.socket.terminate();
      } catch (error) {
        console.error(`Error closing client socket ${client.id}:`, error);
      }
    });
    
    // Clear clients array
    clients.length = 0;
  });
  
  wss.on('connection', (ws: WebSocket, req: IncomingMessage, restaurantId: number, userId: number) => {
    const clientId = `${restaurantId}-${userId}-${Date.now()}`;
    
    // Create new client record
    const client: SocketClient = {
      id: clientId,
      socket: ws,
      restaurantId,
      userId,
      lastPing: Date.now(),
      isAlive: true
    };
    
    // Add to global clients array
    clients.push(client);
    
    console.log(`WebSocket client connected: ${clientId} (Restaurant: ${restaurantId}, User: ${userId})`);
    
    // Handle pong messages (heartbeat response)
    ws.on('pong', () => {
      // Mark client as alive and update last ping time
      const clientIndex = clients.findIndex(c => c.id === clientId);
      if (clientIndex !== -1) {
        clients[clientIndex].isAlive = true;
        clients[clientIndex].lastPing = Date.now();
      }
    });
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Validate message format
        const validation = socketMessageSchema.safeParse(data);
        if (!validation.success) {
          console.error('Invalid message format:', validation.error);
          return;
        }
        
        handleMessage(validation.data, client);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      
      // Remove client from array
      const index = clients.findIndex(c => c.id === clientId);
      if (index !== -1) {
        clients.splice(index, 1);
      }
    });
    
    ws.on('close', () => {
      // Remove client from array
      const index = clients.findIndex(c => c.id === clientId);
      if (index !== -1) {
        clients.splice(index, 1);
      }
      
      console.log(`WebSocket client disconnected: ${clientId}`);
    });
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection-established',
      data: { clientId, restaurantId, userId }
    }));
  });
  
  // Handle HTTP server upgrade
  server.on('upgrade', (request, socket, head) => {
    const { pathname, query } = parse(request.url || '', true);
    
    if (pathname === '/ws') {
      const restaurantId = parseInt(query.restaurantId as string);
      const userId = parseInt(query.userId as string);
      
      if (isNaN(restaurantId) || isNaN(userId)) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, restaurantId, userId);
      });
    } else {
      socket.destroy();
    }
  });
  
  // Add method to broadcast session updates
  (global as any).broadcastSessionUpdate = (restaurantId: number, sessionId: number, totalAmount: string, paidAmount: string) => {
    broadcastToRestaurant(restaurantId, {
      type: 'session-totals-updated',
      payload: {
        sessionId,
        totalAmount,
        paidAmount
      }
    });
  };
  
  return wss;
}

// Handle incoming WebSocket messages
function handleMessage(data: SocketMessage, client: SocketClient) {
  const { type, payload } = data;
  
  switch (type) {
    case 'ping':
      client.socket.send(JSON.stringify({ type: 'pong', payload: { timestamp: Date.now() } }));
      break;
      
    case 'register-restaurant':
      try {
        const validation = registerRestaurantSchema.safeParse(payload);
        if (!validation.success) {
          console.error('Invalid register-restaurant payload:', validation.error);
          return;
        }
        
        const { restaurantId } = validation.data;
        
        // Update client with restaurant ID
        client.restaurantId = restaurantId;
        
        client.socket.send(JSON.stringify({
          type: 'registration-confirmed',
          payload: { restaurantId }
        }));
        
        console.log(`Client ${client.id} registered for restaurant ${restaurantId}`);
      } catch (error) {
        console.error('Error handling register-restaurant:', error);
      }
      break;
      
    case 'register-table':
      try {
        const validation = registerTableSchema.safeParse(payload);
        if (!validation.success) {
          console.error('Invalid register-table payload:', validation.error);
          return;
        }
        
        const { restaurantId, tableId } = validation.data;
        
        // Update client with table ID
        client.restaurantId = restaurantId;
        client.tableId = tableId;
        
        client.socket.send(JSON.stringify({
          type: 'table-registration-confirmed',
          payload: { restaurantId, tableId }
        }));
        
        console.log(`Client ${client.id} registered for table ${tableId} in restaurant ${restaurantId}`);
      } catch (error) {
        console.error('Error handling register-table:', error);
      }
      break;
      
    case 'update-order-status':
      try {
        const validation = orderStatusUpdateSchema.safeParse(payload);
        if (!validation.success) {
          console.error('Invalid update-order-status payload:', validation.error);
          return;
        }
        
        const { orderId, status, restaurantId } = validation.data;
        
        // Broadcast to restaurant clients
        broadcastToRestaurant(restaurantId, {
          type: 'order-status-updated',
          payload: { orderId, status }
        });
        
        console.log(`Order ${orderId} status updated to ${status} for restaurant ${restaurantId}`);
      } catch (error) {
        console.error('Error handling update-order-status:', error);
      }
      break;
      
    default:
      console.warn(`Unknown WebSocket message type: ${type}`);
      break;
  }
}

// Helper function to send a message to all clients connected to a specific restaurant
export const broadcastToRestaurant = (restaurantId: number, message: SocketMessage) => {
  const messageStr = JSON.stringify(message);
  
  clients.forEach(client => {
    if (
      client.restaurantId === restaurantId && 
      client.socket.readyState === WebSocket.OPEN
    ) {
      try {
        client.socket.send(messageStr);
      } catch (error: unknown) {
        console.error(`Error sending message to client ${client.id}:`, error);
        
        // Close connection if sending fails
        try {
          client.socket.close();
        } catch (closeError) {
          console.error(`Error closing socket for client ${client.id}:`, closeError);
        }
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
        console.error(`Error sending message to table ${tableId} client ${client.id}:`, error);
        
        // Close connection if sending fails
        try {
          client.socket.close();
        } catch (closeError) {
          console.error(`Error closing socket for client ${client.id}:`, closeError);
        }
      }
    }
  });
};
