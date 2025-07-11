// Socket.io client implementation
export interface SocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const listeners: { [key: string]: Function[] } = {};

// Last connection parameters (for reconnect)
let lastRestaurantId: number | undefined;
let lastTableId: number | undefined;

// Constants
const PING_INTERVAL = 25000; // 25 seconds (server timeout is 30s)

// Event handlers registry
const eventHandlers: Record<string, Function[]> = {
  'new-order-received': [],
  'order-status-updated': [],
  'table-status-changed': [],
  'bill-requested': [],
  'payment-received': [],
  'session-totals-updated': [],
  'connection-established': [],
  'registration-confirmed': [],
  'table-registration-confirmed': [],
};

// Initialize event handlers
Object.keys(eventHandlers).forEach(event => {
  listeners[event] = [];
});

// Start pinging the server to keep the connection alive
const startHeartbeat = () => {
  // Clear any existing timers
  if (pingTimer) {
    clearInterval(pingTimer);
  }
  
  // Set up the ping interval
  pingTimer = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'ping',
        payload: { timestamp: Date.now() }
      });
    }
  }, PING_INTERVAL);
};

// Stop the heartbeat
const stopHeartbeat = () => {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
};

export const connectWebSocket = (restaurantId?: number, tableId?: number) => {
  // Don't connect if restaurantId is not provided or invalid
  if (!restaurantId || restaurantId <= 0) {
    console.log('[WebSocket] No valid restaurantId provided, skipping connection');
    return;
  }
  
  // Save connection parameters for reconnection
  lastRestaurantId = restaurantId;
  lastTableId = tableId;
  
  // Close existing connection if any
  if (socket) {
    socket.close();
  }

  // Construct WebSocket URL properly
  let wsUrl: string;
  
  try {
    if (import.meta.env.DEV) {
      // Development mode - connect to backend server
      wsUrl = 'ws://localhost:3000/ws';
    } else {
      // Production mode - use current host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    }
    
    // Add query parameters for authentication
    wsUrl += `?restaurantId=${restaurantId}`;
    wsUrl += `&userId=${Math.floor(Math.random() * 100000)}`; // Generate random user ID if not provided
    
    console.log('[WebSocket] Connecting to:', wsUrl);
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      
      // Start heartbeat
      startHeartbeat();
      
      // Register based on context (backup in case query params didn't work)
      console.log(`[WebSocket] Registering for restaurant: ${restaurantId}`);
      sendMessage({
        type: 'register-restaurant',
        payload: { restaurantId }
      });
      
      if (tableId) {
        console.log(`[WebSocket] Registering for table: ${tableId}`);
        sendMessage({
          type: 'register-table',
          payload: { restaurantId, tableId }
        });
      }
      
      // Notify listeners that connection is established
      triggerEvent('connection-established', { restaurantId, tableId });
    };

    socket.onmessage = (event) => {
      try {
        const message: SocketMessage = JSON.parse(event.data);
        console.log('[WebSocket] Message received:', message.type);
        
        // For backward compatibility with older server responses
        const payload = message.payload || message.data;
        
        // Trigger event listeners for this message type
        triggerEvent(message.type, payload);
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log(`[WebSocket] Disconnected. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
      console.log(`[WebSocket] wasClean: ${event.wasClean}`);
      
      // Stop heartbeat
      stopHeartbeat();
      
      // Clean up any existing reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      
      // Notify listeners that connection is closed
      triggerEvent('disconnected', { code: event.code, reason: event.reason });
      
      // Only reconnect if we haven't exceeded max attempts and the connection wasn't closed intentionally
      if (reconnectAttempts < maxReconnectAttempts && event.code !== 1000) {
        reconnectAttempts++;
        console.log(`[WebSocket] Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
        
        // Exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
        console.log(`[WebSocket] Will reconnect in ${delay}ms`);
        reconnectTimer = setTimeout(() => {
          connectWebSocket(lastRestaurantId, lastTableId);
        }, delay);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached. Please refresh the page.');
        triggerEvent('max-reconnect-attempts-reached', {});
      }
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      triggerEvent('error', { error });
      // The onclose handler will be called after this
    };
  } catch (error) {
    console.error('[WebSocket] Failed to create connection:', error);
    // Reset socket reference on connection failure
    socket = null;
    triggerEvent('connection-failed', { error });
  }
};

// Helper function to trigger events
const triggerEvent = (eventType: string, data: any) => {
  if (listeners[eventType]) {
    listeners[eventType].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[WebSocket] Error in ${eventType} event handler:`, error);
      }
    });
  }
};

export const sendMessage = (message: SocketMessage) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      const messageStr = JSON.stringify(message);
      console.log(`[WebSocket] Sending message of type: ${message.type}`);
      socket.send(messageStr);
      return true;
    } catch (error) {
      console.error('[WebSocket] Error sending message:', error);
      return false;
    }
  } else {
    console.warn(`[WebSocket] Cannot send message, socket not open. ReadyState: ${socket?.readyState}`);
    
    // Auto-reconnect if socket is closed or not initialized
    if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
      console.log('[WebSocket] Attempting to reconnect before sending message');
      connectWebSocket(lastRestaurantId, lastTableId);
    }
    
    return false;
  }
};

export const addEventListener = (event: string, callback: Function) => {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
  return () => removeEventListener(event, callback); // Return unsubscribe function
};

export const removeEventListener = (event: string, callback: Function) => {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  }
};

export const disconnectWebSocket = () => {
  if (socket) {
    console.log('[WebSocket] Manually disconnecting');
    socket.close(1000, 'Client disconnected');
    socket = null;
  }
  
  // Stop heartbeat
  stopHeartbeat();
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Clear all listeners
  Object.keys(listeners).forEach(key => {
    listeners[key] = [];
  });
  
  // Reset connection parameters
  lastRestaurantId = undefined;
  lastTableId = undefined;
};

export const isConnected = () => {
  return !!(socket && socket.readyState === WebSocket.OPEN);
};

export const reconnectWebSocket = (restaurantId?: number, tableId?: number) => {
  console.log('[WebSocket] Manual reconnection requested');
  disconnectWebSocket();
  // Reset reconnect attempts for manual reconnection
  reconnectAttempts = 0;
  connectWebSocket(restaurantId || lastRestaurantId, tableId || lastTableId);
};
