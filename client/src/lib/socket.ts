import { debounce } from './utils';

let socket: WebSocket | null = null;
let socketUrl = '';
let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let eventListeners: Map<string, Set<Function>> = new Map();
let messageQueue: any[] = [];

// Constants for better configuration
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 30000;
let heartbeatInterval: NodeJS.Timeout | null = null;
const MESSAGE_BATCH_DELAY = 50;  // Delay in ms for batching messages

/**
 * Connect to WebSocket server with restaurant ID
 */
export function connectWebSocket(restaurantId: number, tableId?: number) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return;
  }
  
  if (isConnecting) {
    console.log('WebSocket connection already in progress');
    return;
  }
  
  isConnecting = true;
  
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams();
    
    if (restaurantId) {
      params.append('restaurantId', restaurantId.toString());
    }
    
    if (tableId) {
      params.append('tableId', tableId.toString());
    }
    
    socketUrl = `${protocol}//${host}/ws?${params.toString()}`;
  
    socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
      isConnecting = false;
      reconnectAttempts = 0;
      
      // Send any queued messages
      if (messageQueue.length > 0) {
        messageQueue.forEach(msg => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(msg));
          }
        });
        messageQueue = [];
      }
      
      // Setup heartbeat
      startHeartbeat();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle heartbeat
        if (data.type === 'pong') {
          return;
        }
        
        // Handle message
        const listeners = eventListeners.get(data.type);
        if (listeners) {
          listeners.forEach(callback => {
            try {
              callback(data.payload);
            } catch (error) {
              console.error(`Error in WebSocket ${data.type} event listener:`, error);
            }
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log(`WebSocket closed with code: ${event.code}, reason: ${event.reason}`);
      socket = null;
      isConnecting = false;
      
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // Only attempt to reconnect if not closed cleanly
      if (event.code !== 1000) {
        scheduleReconnect();
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnecting = false;
    };
    
  } catch (error) {
    console.error('Error connecting to WebSocket:', error);
    isConnecting = false;
    scheduleReconnect();
  }
}

/**
 * Schedule a reconnection attempt with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`Exceeded maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS})`);
    return;
  }
  
  const delay = Math.min(
    RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts),
    MAX_RECONNECT_DELAY_MS
  );
  
  console.log(`Scheduling reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`);
  
  reconnectTimer = setTimeout(() => {
    reconnectAttempts++;
    reconnectWebSocket();
  }, delay);
}

/**
 * Start heartbeat to keep connection alive
 */
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  heartbeatInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping', payload: {} }));
    } else {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Attempt to reconnect to the WebSocket server
 */
export function reconnectWebSocket(restaurantId?: number, tableId?: number) {
  if (!socketUrl && !restaurantId) {
    console.log('No previous connection to reconnect to');
    return;
  }
  
  console.log(`Attempting to reconnect to WebSocket (attempt ${reconnectAttempts})`);
  
  if (restaurantId) {
    connectWebSocket(restaurantId, tableId);
  } else {
    connectWebSocket(parseInt(new URLSearchParams(socketUrl.split('?')[1]).get('restaurantId') || '0'));
  }
}

/**
 * Disconnect from the WebSocket server
 */
export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  if (socket) {
    console.log('Disconnecting WebSocket');
    socket.close(1000, 'User disconnected');
    socket = null;
  }
}

/**
 * Check if the WebSocket is connected
 */
export function isConnected(): boolean {
  return !!socket && socket.readyState === WebSocket.OPEN;
}

/**
 * Add event listener for a WebSocket event type
 * Returns a cleanup function to remove the listener
 */
export function addEventListener(eventType: string, callback: Function): () => void {
  if (!eventListeners.has(eventType)) {
    eventListeners.set(eventType, new Set());
  }
  
  const listeners = eventListeners.get(eventType)!;
  listeners.add(callback);
  
  // Return cleanup function
  return () => removeEventListener(eventType, callback);
}

/**
 * Remove event listener for a WebSocket event type
 */
export function removeEventListener(eventType: string, callback: Function): void {
  const listeners = eventListeners.get(eventType);
  if (listeners) {
    listeners.delete(callback);
    if (listeners.size === 0) {
      eventListeners.delete(eventType);
    }
  }
}

// Batch message sending for efficiency
const debouncedSendMessages = debounce(() => {
  if (messageQueue.length === 0 || !socket || socket.readyState !== WebSocket.OPEN) return;
  
  // If there's only one message, send it directly
  if (messageQueue.length === 1) {
    socket.send(JSON.stringify(messageQueue[0]));
  }
  // If there are multiple messages of the same type, batch them
  else {
    const messagesByType = messageQueue.reduce((acc, msg) => {
      if (!acc[msg.type]) acc[msg.type] = [];
      acc[msg.type].push(msg.payload);
      return acc;
    }, {} as Record<string, any[]>);
    
    // Send batched messages by type
    Object.entries(messagesByType).forEach(([type, payloads]) => {
      socket!.send(JSON.stringify({
        type: `batch_${type}`,
        payload: { items: payloads }
      }));
    });
  }
  
  messageQueue = [];
}, MESSAGE_BATCH_DELAY);

/**
 * Send a message to the WebSocket server
 * Messages are batched for efficiency
 */
export function sendMessage(message: any): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    messageQueue.push(message);
    
    if (!isConnected() && !isConnecting && socketUrl) {
      reconnectWebSocket();
    }
    return;
  }
  
  messageQueue.push(message);
  debouncedSendMessages();
}
