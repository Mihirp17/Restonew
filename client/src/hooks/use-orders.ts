import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useState, useEffect, useMemo } from 'react';
import { addEventListener, removeEventListener, sendMessage } from '@/lib/socket';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'served' | 'completed' | 'cancelled';

export interface OrderItem {
  id: number;
  quantity: number;
  price: string;
  orderId: number;
  menuItemId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: number;
  customerName: string;
  status: OrderStatus;
  total: string;
  restaurantId: number;
  tableId: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

// Lightweight order interface for dashboard
export interface LightweightOrder {
  id: number;
  orderNumber: string;
  displayOrderNumber?: number;
  status: OrderStatus;
  total: string;
  createdAt: Date;
  customerName?: string;
  tableNumber?: number;
  items?: Array<{
    id: number;
    quantity: number;
    price: string;
    menuItemId: number;
    menuItemName: string;
  }>;
}

export type NewOrderItem = Omit<OrderItem, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>;

export interface NewOrder extends Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'items'> {
  items: NewOrderItem[];
}

// Hook to fetch all orders for a restaurant
export function useOrders(restaurantId: number, options?: { lightweight?: boolean; limit?: number }) {
  const queryClient = useQueryClient();
  const { lightweight = false, limit = 20 } = options || {};
  
  // Memoize query keys to prevent unnecessary re-renders
  const ordersQueryKey = useMemo(() => [`/api/restaurants/${restaurantId}/orders`], [restaurantId]);
  const activeOrdersQueryKey = useMemo(() => 
    lightweight 
      ? [`/api/restaurants/${restaurantId}/active-orders-lightweight`, { limit }]
      : [`/api/restaurants/${restaurantId}/active-orders`, { limit }], 
    [restaurantId, lightweight, limit]
  );
  
  // Listen for order status updates
  useEffect(() => {
    if (!restaurantId || restaurantId === 0) return;
    
    const handleOrderStatusUpdate = (data: any) => {
      try {
        if (data.type === 'order-patch' && data.payload.restaurantId === restaurantId) {
          // Update only status
          queryClient.setQueryData(activeOrdersQueryKey, (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((order: any) =>
              order.id === data.payload.id ? { ...order, status: data.payload.status } : order
            );
          });
          return; // skip full update below
        }
        if (data.type === 'order-status-updated' && data.payload.restaurantId === restaurantId) {
          // Update the order in the cache
          queryClient.setQueryData(ordersQueryKey, (oldData: any) => {
              if (!oldData) return oldData;
              return oldData.map((order: any) => 
                order.id === data.payload.id ? data.payload : order
              );
          });

          // Update active orders if needed
          queryClient.setQueryData(activeOrdersQueryKey, (oldData: any) => {
              if (!oldData) return oldData;
              // Remove from active orders if completed or cancelled
              if (['completed', 'cancelled'].includes(data.payload.status)) {
                return oldData.filter((order: any) => order.id !== data.payload.id);
              }
              // Update existing order if it exists
              const existingOrderIndex = oldData.findIndex((order: any) => order.id === data.payload.id);
              if (existingOrderIndex >= 0) {
                const newData = [...oldData];
                newData[existingOrderIndex] = data.payload;
                return newData;
              }
              // Add new order if it doesn't exist
              return [...oldData, data.payload];
          });
          
          // Also invalidate queries to ensure fresh data
          queryClient.invalidateQueries({
            queryKey: activeOrdersQueryKey
          });
        }
      } catch (error) {
        console.error('Error handling order status update:', error);
      }
    };

    // Register event listener safely
    try {
      addEventListener('order-patch', handleOrderStatusUpdate);
      // also keep compatibility
      addEventListener('order-status-updated', handleOrderStatusUpdate);
    } catch (error) {
      console.error('Error registering WebSocket listener:', error);
    }

    return () => {
      try {
        removeEventListener('order-patch', handleOrderStatusUpdate);
        removeEventListener('order-status-updated', handleOrderStatusUpdate);
      } catch (error) {
        console.error('Error removing WebSocket listener:', error);
      }
    };
  }, [restaurantId, queryClient, ordersQueryKey, activeOrdersQueryKey]);
  
  const { data: orders = [], isLoading, error } = useQuery<Order[]>({
    queryKey: ordersQueryKey,
    queryFn: async () => {
      try {
        const result = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/orders`
        });
        return result;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
    enabled: !!restaurantId && restaurantId > 0 && !lightweight
  });
  
  const { data: activeOrders = [], isLoading: isLoadingActive } = useQuery<Order[] | LightweightOrder[]>({
    queryKey: activeOrdersQueryKey,
    queryFn: async () => {
      try {
        const endpoint = lightweight 
          ? `/api/restaurants/${restaurantId}/active-orders-lightweight?limit=${limit}`
          : `/api/restaurants/${restaurantId}/active-orders?limit=${limit}`;
        
        const result = await apiRequest({
          method: 'GET',
          url: endpoint
        });
        return result;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: lightweight ? 10000 : 30000, // Lightweight data can be more frequently refreshed
    refetchInterval: lightweight ? 15000 : false, // Auto-refresh lightweight data every 15 seconds
    enabled: !!restaurantId && restaurantId > 0
  });
  
  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: {
      customerName: string;
      tableId: number;
      restaurantId: number;
      status: OrderStatus;
      total: string;
      items: Array<{
        menuItemId: number;
        quantity: number;
        price: string;
      }>;
    }) => {
      const response = await apiRequest({
        method: 'POST',
        url: `/api/restaurants/${restaurantId}/orders`,
        data: orderData
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ordersQueryKey
      });
      queryClient.invalidateQueries({
        queryKey: activeOrdersQueryKey
      });
      
      // Notify via WebSocket about new order
      sendMessage({
        type: 'new-order',
        payload: {
          restaurantId
        }
      });
    }
  });
  
  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: OrderStatus }) => {
      const response = await apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/orders/${orderId}`,
        data: { status }
      });
      return response;
    },
    onSuccess: (_, { orderId, status }) => {
      queryClient.invalidateQueries({
        queryKey: ordersQueryKey
      });
      queryClient.invalidateQueries({
        queryKey: activeOrdersQueryKey
      });
      
      // Notify via WebSocket about order status update
      sendMessage({
        type: 'update-order-status',
        payload: {
          orderId,
          status,
          restaurantId
        }
      });
    }
  });

  // Edit order items mutation
  const editOrderMutation = useMutation({
    mutationFn: async ({ orderId, items }: { 
      orderId: number; 
      items: Array<{
        menuItemId: number;
        quantity: number;
        price: string;
        customizations?: string;
      }>;
    }) => {
      const response = await apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/orders/${orderId}`,
        data: { 
          action: 'update_items',
          items 
        }
      });
      return response;
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({
        queryKey: ordersQueryKey
      });
      queryClient.invalidateQueries({
        queryKey: activeOrdersQueryKey
      });
      
      // Notify via WebSocket about order update
      sendMessage({
        type: 'order-updated',
        payload: {
          orderId,
          restaurantId
        }
      });
    }
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiRequest({
        method: 'DELETE',
        url: `/api/restaurants/${restaurantId}/orders/${orderId}`
      });
      return response;
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({
        queryKey: ordersQueryKey
      });
      queryClient.invalidateQueries({
        queryKey: activeOrdersQueryKey
      });
      
      // Notify via WebSocket about order deletion
      sendMessage({
        type: 'order-deleted',
        payload: {
          orderId,
          restaurantId
        }
      });
    }
  });
  
  return {
    orders,
    activeOrders,
    isLoading: lightweight ? isLoadingActive : (isLoading || isLoadingActive),
    error,
    createOrder: createOrderMutation.mutate,
    updateOrderStatus: updateOrderStatusMutation.mutate,
    editOrder: editOrderMutation.mutate,
    deleteOrder: deleteOrderMutation.mutate,
    isCreating: createOrderMutation.isPending,
    isUpdating: updateOrderStatusMutation.isPending,
    isEditing: editOrderMutation.isPending,
    isDeleting: deleteOrderMutation.isPending
  };
}

// Hook to fetch a single order
export function useOrder(restaurantId: number, orderId: number) {
  const { orders, isLoading } = useOrders(restaurantId);
  
  return {
    order: orders.find(order => order.id === orderId),
    isLoading
  };
}
