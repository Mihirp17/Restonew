import { useEffect, useCallback, useRef } from 'react';
import { connectWebSocket, disconnectWebSocket, addEventListener, removeEventListener, sendMessage, isConnected, reconnectWebSocket } from '@/lib/socket';

export function useSocket(restaurantId?: number, tableId?: number) {
  // Track registered listeners for cleanup
  const listenersRef = useRef<Map<string, Function>>(new Map());
  
  // Connect to WebSocket on mount and disconnect on unmount
  useEffect(() => {
    if (restaurantId && restaurantId > 0) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        connectWebSocket(restaurantId, tableId);
      }, 100);
      
      return () => {
        clearTimeout(timer);
        // Clean up all listeners registered by this hook instance
        listenersRef.current.forEach((callback, event) => {
          removeEventListener(event, callback);
        });
        listenersRef.current.clear();
        disconnectWebSocket();
      };
    }
  }, [restaurantId, tableId]);
  
  // Enhanced addEventListener that tracks listeners for cleanup
  const trackedAddEventListener = useCallback((event: string, callback: Function) => {
    // Remove any existing listener for this event from this hook instance
    if (listenersRef.current.has(event)) {
      const oldCallback = listenersRef.current.get(event);
      if (oldCallback) {
        removeEventListener(event, oldCallback);
      }
    }
    
    // Add new listener and track it
    addEventListener(event, callback);
    listenersRef.current.set(event, callback);
  }, []);
  
  // Enhanced removeEventListener
  const trackedRemoveEventListener = useCallback((event: string, callback: Function) => {
    removeEventListener(event, callback);
    listenersRef.current.delete(event);
  }, []);
  
  // Create reconnect callback
  const reconnect = useCallback(() => {
    if (restaurantId && restaurantId > 0) {
      reconnectWebSocket();
    }
  }, [restaurantId]);
  
  // Return the socket methods
  return {
    addEventListener: trackedAddEventListener,
    removeEventListener: trackedRemoveEventListener,
    sendMessage,
    isConnected,
    reconnect
  };
}
