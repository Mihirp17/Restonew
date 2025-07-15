import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useState, useEffect, useMemo } from 'react';
import { addEventListener, removeEventListener, sendMessage } from '@/lib/socket';
import { handleError } from '@/lib/error-handler';
import { z } from 'zod';
import { orderSchema, orderStatusSchema } from '../../../shared/validations';
import { getCacheManager, CacheTag } from '@/lib/cache-manager';

// Custom hook to use the cache manager
export const useCacheManager = () => {
  const queryClient = useQueryClient();
  
  // Get or create cache manager instance
  const cacheManager = useMemo(() => {
    try {
      return getCacheManager();
    } catch (e) {
      // If cache manager isn't initialized, create a dummy implementation
      // that falls back to direct queryClient calls
      return {
        invalidateQueries: (tags: string[]) => {
          console.warn('CacheManager not properly initialized, falling back to direct invalidation');
          return Promise.resolve(
            queryClient.invalidateQueries({ predicate: () => true })
          );
        }
      };
    }
  }, [queryClient]);
  
  return cacheManager;
};

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

// Constants for caching and WebSocket management
const ORDER_CACHE_STALE_TIME = 30000; // 30 seconds
const LIGHTWEIGHT_CACHE_STALE_TIME = 10000; // 10 seconds
const LIGHTWEIGHT_REFETCH_INTERVAL = 15000; // 15 seconds
const WS_EVENT_ORDER_PATCH = 'order-patch';
const WS_EVENT_ORDER_STATUS = 'order-status-updated';
const WS_EVENT_NEW_ORDER = 'new-order';
const WS_EVENT_ORDER_UPDATED = 'order-updated';
const WS_EVENT_ORDER_DELETED = 'order-deleted';

// Hook to fetch all orders for a restaurant
export function useOrders(restaurantId: number, options?: { lightweight?: boolean; limit?: number }) {
  const queryClient = useQueryClient();
  const cacheManager = useCacheManager();
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
        if (data.type === WS_EVENT_ORDER_PATCH && data.payload.restaurantId === restaurantId) {
          // Update only status
          queryClient.setQueryData(activeOrdersQueryKey, (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((order: any) =>
              order.id === data.payload.id ? { ...order, status: data.payload.status } : order
            );
          });
          return; // skip full update below
        }
        if (data.type === WS_EVENT_ORDER_STATUS && data.payload.restaurantId === restaurantId) {
          // Validate the order data with schema
          try {
            if (orderSchema && typeof orderSchema.parse === 'function') {
              orderSchema.parse(data.payload);
            }
          } catch (validationError) {
            console.error('Invalid order data received:', validationError);
            return;
          }

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
          
          // Invalidate queries using cache manager to ensure fresh data
          cacheManager.invalidateQueries(['orders', `restaurant-${restaurantId}`] as CacheTag[]);
        }
      } catch (error) {
        handleError(error, 'Error handling order status update');
      }
    };

    // Register event listener safely
    try {
      addEventListener(WS_EVENT_ORDER_PATCH, handleOrderStatusUpdate);
      addEventListener(WS_EVENT_ORDER_STATUS, handleOrderStatusUpdate);
    } catch (error) {
      handleError(error, 'Error registering WebSocket listener');
    }

    return () => {
      try {
        removeEventListener(WS_EVENT_ORDER_PATCH, handleOrderStatusUpdate);
        removeEventListener(WS_EVENT_ORDER_STATUS, handleOrderStatusUpdate);
      } catch (error) {
        handleError(error, 'Error removing WebSocket listener');
      }
    };
  }, [restaurantId, queryClient, ordersQueryKey, activeOrdersQueryKey, cacheManager]);
  
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
        throw handleError(error, 'Failed to fetch orders');
      }
    },
    retry: 1,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: ORDER_CACHE_STALE_TIME,
    enabled: !!restaurantId && restaurantId > 0 && !lightweight,
    meta: {
      tags: ['orders', `restaurant-${restaurantId}`]
    }
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
        throw handleError(error, 'Failed to fetch active orders');
      }
    },
    retry: 1,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: lightweight ? LIGHTWEIGHT_CACHE_STALE_TIME : ORDER_CACHE_STALE_TIME,
    refetchInterval: lightweight ? LIGHTWEIGHT_REFETCH_INTERVAL : false,
    enabled: !!restaurantId && restaurantId > 0,
    meta: {
      tags: ['active-orders', `restaurant-${restaurantId}`]
    }
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
      try {
        // Validate order status
        if (orderStatusSchema && typeof orderStatusSchema.parse === 'function') {
          orderStatusSchema.parse(orderData.status);
        }
        
      const response = await apiRequest({
        method: 'POST',
        url: `/api/restaurants/${restaurantId}/orders`,
        data: orderData
      });
      return response;
      } catch (error) {
        throw handleError(error, 'Failed to create order');
      }
    },
    onSuccess: (data) => {
      // Invalidate relevant cache tags
      cacheManager.invalidateQueries(['orders', 'active-orders', `restaurant-${restaurantId}`] as CacheTag[]);
      
      // Notify via WebSocket about new order
      sendMessage({
        type: WS_EVENT_NEW_ORDER,
        payload: {
          restaurantId,
          orderId: data?.id
        }
      });
    }
  });
  
  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: OrderStatus }) => {
      try {
        // Validate order status
        if (orderStatusSchema && typeof orderStatusSchema.parse === 'function') {
          orderStatusSchema.parse(status);
        }
        
      const response = await apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/orders/${orderId}`,
        data: { status }
      });
      return response;
      } catch (error) {
        throw handleError(error, 'Failed to update order status');
      }
    },
    onSuccess: (_, { orderId, status }) => {
      // Invalidate relevant cache tags
      cacheManager.invalidateQueries(['orders', 'active-orders', `restaurant-${restaurantId}`] as CacheTag[]);
      
      // Notify via WebSocket about order status update
      sendMessage({
        type: WS_EVENT_ORDER_UPDATED,
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
      try {
      const response = await apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/orders/${orderId}`,
        data: { 
          action: 'update_items',
          items 
        }
      });
      return response;
      } catch (error) {
        throw handleError(error, 'Failed to update order items');
      }
    },
    onSuccess: (_, { orderId }) => {
      // Invalidate relevant cache tags
      cacheManager.invalidateQueries(['orders', 'active-orders', `restaurant-${restaurantId}`] as CacheTag[]);
      
      // Notify via WebSocket about order update
      sendMessage({
        type: WS_EVENT_ORDER_UPDATED,
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
      try {
      const response = await apiRequest({
        method: 'DELETE',
        url: `/api/restaurants/${restaurantId}/orders/${orderId}`
      });
      return response;
      } catch (error) {
        throw handleError(error, 'Failed to delete order');
      }
    },
    onSuccess: (_, orderId) => {
      // Invalidate relevant cache tags
      cacheManager.invalidateQueries(['orders', 'active-orders', `restaurant-${restaurantId}`] as CacheTag[]);
      
      // Notify via WebSocket about order deletion
      sendMessage({
        type: WS_EVENT_ORDER_DELETED,
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
  const { orders, isLoading, error } = useOrders(restaurantId);
  
  const order = useMemo(() => 
    orders.find(order => order.id === orderId),
    [orders, orderId]
  );
  
  return {
    order,
    isLoading,
    error,
    isNotFound: !isLoading && !order
  };
}
