import { useEffect, useState, useMemo, memo, useCallback } from "react";
import { useOrders } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { getStatusColor, calculateTimeAgo } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useLang } from "@/contexts/language-context";

interface LiveOrdersProps {
  restaurantId?: number;
}

interface OrderType {
  id: number;
  orderNumber?: string;
  displayOrderNumber?: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'served' | 'completed' | 'cancelled';
  total: string;
  createdAt: string | Date;
  customerName?: string;
  tableNumber?: number;
  groupId?: number;
  items?: Array<{
    id: number;
    quantity: number;
    price: string;
    menuItemId: number;
    menuItemName: string;
  }>;
}

// Memoized order card component to prevent unnecessary re-renders
const OrderCard = memo(({ 
  order, 
  onUpdateStatus, 
  t 
}: { 
  order: OrderType; 
  onUpdateStatus: (orderId: number, status: string) => Promise<void>; 
  t: any;
}) => {
  const statusColors = useMemo(() => getStatusColor(order.status), [order.status]);
  const timeAgo = useMemo(() => calculateTimeAgo(order.createdAt), [order.createdAt]);
  const formattedTotal = useMemo(() => parseFloat(order.total).toFixed(2), [order.total]);
  
  // Get next status options based on current status
  const nextStatus = useMemo(() => {
    switch (order.status) {
      case 'pending':
        return { label: t('confirm', 'Confirm'), value: 'confirmed' };
      case 'confirmed':
        return { label: t('prepare', 'Prepare'), value: 'preparing' };
      case 'preparing':
        return { label: t('serve', 'Serve'), value: 'served' };
      case 'served':
        return { label: t('complete', 'Complete'), value: 'completed' };
      default:
        return null;
    }
  }, [order.status, t]);

  const borderColorClass = useMemo(() => {
    switch (order.status) {
      case 'pending': return 'border-amber-500';
      case 'confirmed': return 'border-blue-500';
      case 'preparing': return 'border-purple-500';
      case 'served': return 'border-green-500';
      default: return 'border-gray-300';
    }
  }, [order.status]);

  const handleNextStatus = useCallback(() => {
    if (nextStatus) {
      onUpdateStatus(order.id, nextStatus.value);
    }
  }, [order.id, nextStatus, onUpdateStatus]);

  const handleCancel = useCallback(() => {
    onUpdateStatus(order.id, 'cancelled');
  }, [order.id, onUpdateStatus]);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 ${borderColorClass} overflow-hidden`}>
      <div className="p-4">
        <div className="flex justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Order #{order.displayOrderNumber || order.orderNumber || order.id}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors.bgClass} ${statusColors.textClass} ${statusColors.darkBgClass} ${statusColors.darkTextClass}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
        </div>
        {/* Show ordered items */}
        {order.items && order.items.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Items:</div>
            <ul className="text-xs text-gray-900 dark:text-white space-y-1">
              {order.items.map(item => (
                <li key={item.id} className="flex justify-between">
                  <span>{item.menuItemName}</span>
                  <span>x{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="mb-3">
          {order.customerName && (
            <div className="flex justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Customer:</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">{order.customerName}</span>
            </div>
          )}
          {order.tableNumber && (
            <div className="flex justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Table:</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">Table {order.tableNumber}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total:</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">${formattedTotal}</span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {nextStatus && (
            <Button
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 h-auto"
              onClick={handleNextStatus}
            >
              {nextStatus.label}
            </Button>
          )}
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-800 text-xs py-1 px-2 h-auto"
            onClick={handleCancel}
          >
            {t("cancel", "Cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
});

OrderCard.displayName = 'OrderCard';

export const LiveOrders = memo(({ restaurantId }: LiveOrdersProps) => {
  const ordersResult = useOrders(restaurantId || 0, { 
    lightweight: true, 
    limit: 10 
  });
  
  // Extract and transform data with proper typing
  const activeOrders = ordersResult.activeOrders as unknown as OrderType[];
  
  const { isLoading } = ordersResult;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLang();

  // Create a properly typed wrapper for updateOrderStatus
  const updateOrderStatus = async ({ orderId, status }: { orderId: number; status: OrderType['status'] }) => {
    return ordersResult.updateOrderStatus({ orderId, status });
  };
  
  // Create a handler that matches the OrderCard component's expected signature
  const handleUpdateStatus = useCallback(async (orderId: number, status: string) => {
    try {
      await ordersResult.updateOrderStatus({ orderId, status: status as OrderType['status'] });
      
      toast({
        title: t("success", "Success"),
        description: `Order #${orderId} status updated to ${status}.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      toast({
        title: t("error", "Error"),
        description: "Failed to update order status. Please try again.",
        variant: "destructive",
      });
    }
  }, [ordersResult, toast, t]);

  // Memoize order count calculation
  const orderCount = useMemo(() => activeOrders?.length || 0, [activeOrders?.length]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t("liveOrders", "Live Orders")}</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {t("loading", "Loading...")}
          </span>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t("liveOrders", "Live Orders")}</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-brand dark:bg-red-900/30">
          {orderCount} {t("active", "Active")}
          </span>
      </div>
      
      <div className="p-4">
        {orderCount > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrders.map((order) => (
              <OrderCard 
                  key={order.id} 
                order={order}
                onUpdateStatus={handleUpdateStatus}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">{t("noActiveOrders", "No active orders")}</p>
          </div>
        )}
      </div>
    </div>
  );
});

LiveOrders.displayName = 'LiveOrders';
