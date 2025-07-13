import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";

interface OrderHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrderItem {
  id: number;
  quantity: number;
  price: string;
  menuItemId: number;
  menuItem?: {
    id: number;
    name: string;
    price: string;
    description?: string;
    image?: string;
  };
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  items: OrderItem[];
}

export default function OrderHistory({ open, onOpenChange }: OrderHistoryProps) {
  const { restaurantId, session } = useRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && session) {
      fetchOrders();
    }
  }, [open, session]);

  const fetchOrders = async () => {
    if (!session) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions/${session.id}/orders`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate and transform the data
      const validatedOrders: Order[] = Array.isArray(data)
        ? data.map((order: any) => ({
            id: order.id || 0,
            orderNumber: order.orderNumber || 'N/A',
            status: order.status || 'Unknown',
            total: order.total || '0.00',
            createdAt: order.createdAt || new Date().toISOString(),
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  id: item.id || 0,
                  quantity: item.quantity || 0,
                  price: item.price || '0.00',
                  menuItemId: item.menuItemId || 0,
                  menuItem: item.menuItem ? {
                    id: item.menuItem.id || 0,
                    name: item.menuItem.name || 'Unknown Item',
                    price: item.menuItem.price || '0.00',
                    description: item.menuItem.description,
                    image: item.menuItem.image,
                  } : undefined,
                }))
              : [],
          }))
        : [];
      
      setOrders(validatedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch orders");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed": 
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "cancelled": 
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "served":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "preparing":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "confirmed":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default: 
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed": 
        return "bg-green-100 text-green-800";
      case "cancelled": 
        return "bg-red-100 text-red-800";
      case "served":
        return "bg-blue-100 text-blue-800";
      case "preparing":
        return "bg-orange-100 text-orange-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      default: 
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const formatCurrency = (amount: string | number) => {
    try {
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return `$${num.toFixed(2)}`;
    } catch {
      return '$0.00';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col rounded-lg bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-black">Order History</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4">
          {!session ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Please join a table session first</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-2">Error loading orders</p>
              <p className="text-sm text-gray-500">{error}</p>
              <button 
                onClick={fetchOrders}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(order.status)}
                      <span className="font-medium text-black">Order #{order.orderNumber}</span>
                    </div>
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center space-x-3 flex-1">
                            {item.menuItem?.image && (
                              <img
                                src={item.menuItem.image}
                                alt={item.menuItem.name}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-black truncate">
                                {item.quantity}x {item.menuItem?.name || 'Unknown Item'}
                              </div>
                              {item.menuItem?.description && (
                                <div className="text-xs text-gray-500 truncate">
                                  {item.menuItem.description}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="font-medium text-black">
                              {formatCurrency(parseFloat(item.price || '0') * item.quantity)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(item.price)} each
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 italic text-center py-4">
                        No item details available
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      <div>Ordered on {formatDate(order.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-black">
                        {formatCurrency(order.total)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 