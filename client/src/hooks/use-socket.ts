import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { connectWebSocket, disconnectWebSocket, addEventListener, isConnected } from '@/lib/socket';

export function useSocket(restaurantId?: number | null) {
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    // Early return if no valid restaurantId or user
    if (!restaurantId || restaurantId <= 0 || !user) {
      console.log('[useSocket] No valid restaurantId or user, skipping WebSocket connection');
      setIsSocketConnected(false);
      return;
    }

    // Check if already connected
    if (isConnected()) {
      setIsSocketConnected(true);
      return;
    }

    console.log('[useSocket] Setting up WebSocket connection for restaurant:', restaurantId);

    // Connect to WebSocket
    try {
      connectWebSocket(restaurantId);
    } catch (error) {
      console.error('[useSocket] Error connecting to WebSocket:', error);
      setIsSocketConnected(false);
      return;
    }
    
    // Set up event listeners
    const unsubscribeConnection = addEventListener('connection-established', () => {
      console.log('[useSocket] WebSocket connection established');
      setIsSocketConnected(true);
    });
    
    const unsubscribeDisconnect = addEventListener('disconnected', () => {
      console.log('[useSocket] WebSocket disconnected');
      setIsSocketConnected(false);
    });
    
    const unsubscribeError = addEventListener('connection-failed', (error) => {
      console.error('[useSocket] WebSocket connection failed:', error);
      setIsSocketConnected(false);
    });
    
    const unsubscribeNewOrder = addEventListener('new-order-received', (data) => {
      setLastMessage({ type: 'new-order-received', data });
      // Invalidate orders query
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
      // Invalidate active orders queries so Live Orders widget refreshes
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders-lightweight`]
      });
      // Invalidate table sessions to refresh session totals
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/table-sessions`]
      });
    });
    
    const unsubscribeTableStatus = addEventListener('table-status-changed', (data) => {
      setLastMessage({ type: 'table-status-changed', data });
      // Invalidate tables query
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/tables`]
      });
    });
    
    const unsubscribeSessionTotals = addEventListener('session-totals-updated', (data) => {
      setLastMessage({ type: 'session-totals-updated', data });
      // Invalidate table sessions query and specific session if applicable
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/table-sessions`]
      });
      
      if (data?.sessionId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/restaurants/${restaurantId}/table-sessions/${data.sessionId}`]
        });
      }
    });
    
    const unsubscribeOrderStatus = addEventListener('order-status-updated', (data) => {
      setLastMessage({ type: 'order-status-updated', data });
      // Invalidate orders query
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
      // Invalidate active orders queries
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders-lightweight`]
      });
      // Invalidate table sessions to refresh session totals
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/table-sessions`]
      });
    });

    // Cleanup on unmount
    return () => {
      try {
        unsubscribeConnection();
        unsubscribeDisconnect();
        unsubscribeError();
        unsubscribeNewOrder();
        unsubscribeTableStatus();
        unsubscribeSessionTotals();
        unsubscribeOrderStatus();
        disconnectWebSocket();
      } catch (error) {
        console.error('[useSocket] Error during cleanup:', error);
      }
    };
  }, [restaurantId, user, queryClient]);

  // Always return a consistent interface
  return { 
    isConnected: isSocketConnected, 
    lastMessage,
    addEventListener: restaurantId && restaurantId > 0 ? addEventListener : () => () => {} // Return no-op unsubscribe function if not connected
  };
}
