import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";

interface OrderHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  items: Array<{
    id: number;
    quantity: number;
    price: string;
    menuItem: {
      id: number;
      name: string;
    };
  }>;
}

export default function OrderHistory({ open, onOpenChange }: OrderHistoryProps) {
  const { restaurantId, session } = useRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && session) {
      fetchOrders();
    }
  }, [open, session]);

  const fetchOrders = async () => {
    if (!session) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions/${session.id}/orders`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
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
      case "preparing":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Order History</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(order.status)}
                      <span className="font-medium">Order #{order.orderNumber}</span>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.menuItem.name}</span>
                        <span>${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-gray-500">
                      {formatDate(order.createdAt)}
                    </span>
                    <span className="font-medium">${order.total}</span>
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