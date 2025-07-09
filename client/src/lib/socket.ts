// Socket.io client implementation
export interface SocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const listeners: { [key: string]: Function[] } = {};

export const connectWebSocket = (restaurantId?: number, tableId?: number) => {
  if (socket) {
    socket.close();
  }

  // Construct WebSocket URL properly
  let wsUrl: string;
  
  if (import.meta.env.DEV) {
    // Development mode - connect to backend server
    wsUrl = 'ws://localhost:3000/ws';
  } else {
    // Production mode - use current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}/ws`;
  }
  
  console.log('[WebSocket] Connecting to:', wsUrl);
  
  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      
      // Register based on context
      if (restaurantId) {
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
      }
    };

    socket.onmessage = (event) => {
      try {
        const message: SocketMessage = JSON.parse(event.data);
        console.log('[WebSocket] Message received:', message.type);
        
        // Trigger event listeners for this message type
        if (listeners[message.type]) {
          listeners[message.type].forEach(callback => {
            try {
              callback(message.payload);
            } catch (error) {
              console.error('[WebSocket] Error in message handler:', error);
            }
          });
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log(`[WebSocket] Disconnected. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
      console.log(`[WebSocket] wasClean: ${event.wasClean}`);
      
      // Clean up any existing reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      
      // Only reconnect if we haven't exceeded max attempts and the connection wasn't closed intentionally
      if (reconnectAttempts < maxReconnectAttempts && event.code !== 1000) {
        reconnectAttempts++;
        console.log(`[WebSocket] Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
        
        // Exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
        console.log(`[WebSocket] Will reconnect in ${delay}ms`);
        reconnectTimer = setTimeout(() => {
          connectWebSocket(restaurantId, tableId);
        }, delay);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached. Please refresh the page.');
      }
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      // The onclose handler will be called after this
    };
  } catch (error) {
    console.error('[WebSocket] Failed to create connection:', error);
    // Reset socket reference on connection failure
    socket = null;
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
    return false;
  }
};

export const addEventListener = (event: string, callback: Function) => {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
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
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Clear all listeners
  Object.keys(listeners).forEach(key => {
    listeners[key] = [];
  });
};

export const isConnected = () => {
  return !!(socket && socket.readyState === WebSocket.OPEN);
};

export const reconnectWebSocket = (restaurantId?: number, tableId?: number) => {
  console.log('[WebSocket] Manual reconnection requested');
  disconnectWebSocket();
  // Reset reconnect attempts for manual reconnection
  reconnectAttempts = 0;
  connectWebSocket(restaurantId, tableId);
};
