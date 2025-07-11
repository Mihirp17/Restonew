import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
  status: OrderStatus;
  total: string;
  createdAt: Date;
  customerName?: string;
  tableNumber?: number;
  items?: OrderItem[]; // Add items for better live order display
}

export type NewOrderItem = Omit<OrderItem, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>;

export interface NewOrder extends Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'items'> {
  items: NewOrderItem[];
}

export interface UseOrdersOptions {
  lightweight?: boolean;
  limit?: number;
}

export function useOrders(restaurantId?: number | null, options?: UseOrdersOptions) {
  const queryClient = useQueryClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<any[]>([]);
  const [preparingOrders, setPreparingOrders] = useState<any[]>([]);
  const [servedOrders, setServedOrders] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<any[]>([]);

  // Fetch orders
  const { data: fetchedOrders = [], isLoading: ordersLoading, refetch } = useQuery({
    queryKey: restaurantId ? [`/api/restaurants/${restaurantId}/orders`] : [],
    queryFn: async () => {
      if (!restaurantId) return [];
      return apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/orders`
      });
    },
    enabled: !!restaurantId,
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Update local state when fetched orders change
  useEffect(() => {
    if (fetchedOrders?.length) {
      setOrders(fetchedOrders);
    }
  }, [fetchedOrders]);

  // Filter orders by status
  useEffect(() => {
    setPendingOrders(orders.filter(order => order.status === 'pending'));
    setConfirmedOrders(orders.filter(order => order.status === 'confirmed'));
    setPreparingOrders(orders.filter(order => order.status === 'preparing'));
    setServedOrders(orders.filter(order => order.status === 'served'));
    setCompletedOrders(orders.filter(order => order.status === 'completed'));
    setCancelledOrders(orders.filter(order => order.status === 'cancelled'));
  }, [orders]);

  // Listen for new orders via WebSocket
  useEffect(() => {
    if (!restaurantId) return;

    const handleNewOrder = (order: any) => {
      setOrders(prev => {
        // Check if order already exists
        const exists = prev.some(o => o.id === order.id);
        if (exists) return prev;
        return [...prev, order];
      });
      // Also refetch to ensure we have the latest data
      refetch();
    };

    const handleOrderUpdate = (update: any) => {
      setOrders(prev => prev.map(order => 
        order.id === update.id ? { ...order, ...update } : order
      ));
      // Also refetch to ensure we have the latest data
      refetch();
    };

    addEventListener('new-order-received', handleNewOrder);
    addEventListener('order-patch', handleOrderUpdate);

    return () => {
      removeEventListener('new-order-received', handleNewOrder);
      removeEventListener('order-patch', handleOrderUpdate);
    };
  }, [restaurantId, refetch]);

  // Update order status mutation
  const { mutate: updateOrderStatus } = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number, status: string }) => {
      if (!restaurantId) throw new Error('Restaurant ID is required');
      return apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/orders/${orderId}`,
        data: { status }
      });
    },
    onSuccess: (data, variables) => {
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === variables.orderId ? { ...order, status: variables.status } : order
      ));
      
      // Send WebSocket notification
      if (restaurantId) {
        sendMessage({
          type: 'update-order-status',
          payload: {
            orderId: variables.orderId,
            status: variables.status,
            restaurantId
          }
        });
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
    }
  });

  // Create order mutation
  const { mutate: createOrder } = useMutation({
    mutationFn: async (orderData: any) => {
      if (!restaurantId) throw new Error('Restaurant ID is required');
      return apiRequest({
        method: 'POST',
        url: `/api/restaurants/${restaurantId}/orders`,
        data: orderData
      });
    },
    onSuccess: (data) => {
      // Update local state
      setOrders(prev => [...prev, data]);
      
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
    }
  });

  // Delete order mutation (placeholder for now)
  const { mutate: deleteOrder } = useMutation({
    mutationFn: async (orderId: number) => {
      if (!restaurantId) throw new Error('Restaurant ID is required');
      return apiRequest({
        method: 'DELETE',
        url: `/api/restaurants/${restaurantId}/orders/${orderId}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
    }
  });

  // Edit order mutation (placeholder for now)
  const { mutate: editOrder } = useMutation({
    mutationFn: async ({ orderId, ...updateData }: { orderId: number; [key: string]: any }) => {
      if (!restaurantId) throw new Error('Restaurant ID is required');
      return apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/orders/${orderId}`,
        data: updateData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
    }
  });
  
  // Get orders by table session ID
  const getOrdersByTableSessionId = useCallback(async (tableSessionId: number) => {
    if (!restaurantId) throw new Error('Restaurant ID is required');
    
    // First check if we have the orders in cache
    const cachedOrders = orders.filter(order => order.tableSessionId === tableSessionId);
    if (cachedOrders.length > 0) {
      return cachedOrders;
    }
    
    // If not in cache or empty, fetch directly
    return apiRequest({
      method: 'GET',
      url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}/orders`
    });
  }, [restaurantId, orders]);

  // Derived stats
  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: pendingOrders.length,
      confirmed: confirmedOrders.length,
      preparing: preparingOrders.length,
      served: servedOrders.length,
      completed: completedOrders.length,
      cancelled: cancelledOrders.length,
      active: pendingOrders.length + confirmedOrders.length + preparingOrders.length + servedOrders.length
    };
  }, [
    orders.length,
    pendingOrders.length,
    confirmedOrders.length,
    preparingOrders.length,
    servedOrders.length,
    completedOrders.length,
    cancelledOrders.length
  ]);

  return {
    orders,
    activeOrders: [...pendingOrders, ...confirmedOrders, ...preparingOrders, ...servedOrders],
    pendingOrders,
    confirmedOrders,
    preparingOrders,
    servedOrders,
    completedOrders,
    cancelledOrders,
    ordersLoading,
    isLoading: ordersLoading,
    updateOrderStatus,
    createOrder,
    isCreating: false, // Add for compatibility
    editOrder,
    deleteOrder,
    isEditing: false, // Add placeholder
    isDeleting: false, // Add placeholder
    stats,
    getOrdersByTableSessionId,
    refetch
  };
}

// Hook to fetch a single order
export function useOrder(restaurantId: number, orderId: number) {
  const { orders, ordersLoading } = useOrders(restaurantId);
  
  return {
    order: orders.find((order: any) => order.id === orderId),
    isLoading: ordersLoading
  };
}
