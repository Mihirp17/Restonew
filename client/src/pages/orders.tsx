import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/hooks/use-orders";
import { useMenu } from "@/hooks/use-menu";
import { useLang } from "@/contexts/language-context";
import { OrderItem } from "@/components/orders/order-item";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSocket } from "@/hooks/use-socket";
import { calculateTimeAgo, formatCurrency } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { Edit, Trash2, Plus, Minus } from "lucide-react";

export default function Orders() {
  const { user } = useAuth();
  const { t } = useLang();
  const restaurantId = user?.restaurantId;
  
  // All hooks must be called before any conditional returns
  const { orders, activeOrders, isLoading, updateOrderStatus, editOrder, deleteOrder, isEditing, isDeleting } = useOrders(restaurantId || 0);
  const { menuItems = [], isLoading: isMenuLoading } = useMenu(restaurantId || 0);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Connect to WebSocket for real-time updates - call hook before any returns
  const { addEventListener } = useSocket(restaurantId);
  
  const [activeTab, setActiveTab] = useState<string>("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingOrderItems, setEditingOrderItems] = useState<any[]>([]);

  // Early return if no restaurantId - AFTER all hooks
  if (!restaurantId) {
    return (
      <Layout
        title={t("orders", "Orders")}
        description="Manage and track customer orders"
        requireAuth
        allowedRoles={['restaurant']}
      >
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">{t("loading", "Loading restaurant information...")}</p>
        </div>
      </Layout>
    );
  }

  // Listen for new orders
  useEffect(() => {
    if (!restaurantId || !addEventListener) return;
    
    const handleNewOrder = (orderData: any) => {
      try {
        // Play notification sound
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Error playing notification sound', e));
        
        // Show desktop notification if browser supports it
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Order Received', {
            body: `Order from ${orderData.customerName || 'Unknown'} at Table ${orderData.tableId || 'Unknown'}`,
            icon: '/logo.png'
          });
        }
      } catch (error) {
        console.error('Error handling new order notification:', error);
      }
    };
    
    try {
      // Register event listener
      addEventListener('new-order-received', handleNewOrder);
      
      // Request notification permission
      if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    } catch (error) {
      console.error('Error setting up order notifications:', error);
    }
    
    return () => {
      // Cleanup happens in the useSocket hook
    };
  }, [addEventListener, restaurantId]);

  // Filter orders based on search term
  useEffect(() => {
    if (activeTab === "active" && activeOrders) {
      setFilteredOrders(
        (Array.isArray(activeOrders) ? activeOrders : []).filter(order => 
          order && 
          (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.id.toString().includes(searchTerm.toLowerCase())
        )
      );
    } else if (orders) {
      setFilteredOrders(
        (Array.isArray(orders) ? orders : []).filter(order => 
          order && 
          (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.id.toString().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, activeTab, orders, activeOrders]);

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setIsDetailDialogOpen(true);
  };

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    try {
      await updateOrderStatus({ orderId, status: newStatus as any });
      
      // NOTE: Removed automatic table status update on order completion
      // Tables should only be marked as vacant when all bills are paid,
      // which is handled by the billing system automatically
      
      toast({
        title: t("success", "Success"),
        description: `Order status updated to ${newStatus}`,
        variant: "default"
      });
      
      setIsDetailDialogOpen(false);
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: t("error", "Error"),
        description: "Failed to update order status",
        variant: "destructive"
      });
    }
  };

  const handleEditOrder = (order: any) => {
    setSelectedOrder(order);
    setEditingOrderItems((order.items || []).map((item: any) => ({
      ...item,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      price: item.price,
      customizations: item.customizations || ""
    })));
    setIsEditDialogOpen(true);
  };

  const handleDeleteOrder = (order: any) => {
    setSelectedOrder(order);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!selectedOrder) return;
    
    try {
      await deleteOrder(selectedOrder.id);
      toast({
        title: "Success",
        description: "Order deleted successfully",
        variant: "default"
      });
      setIsDeleteDialogOpen(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive"
      });
    }
  };

  const handleSaveOrderEdit = async () => {
    if (!selectedOrder || !editingOrderItems.length) return;
    
    try {
      await editOrder({ 
        orderId: selectedOrder.id, 
        items: editingOrderItems.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: item.price,
          customizations: item.customizations
        }))
      });
      
      toast({
        title: "Success",
        description: "Order updated successfully",
        variant: "default"
      });
      
      setIsEditDialogOpen(false);
      setSelectedOrder(null);
      setEditingOrderItems([]);
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive"
      });
    }
  };

  const updateItemQuantity = (index: number, delta: number) => {
    setEditingOrderItems(prev => {
      const newItems = [...prev];
      const newQuantity = Math.max(0, newItems[index].quantity + delta);
      if (newQuantity === 0) {
        // Remove item if quantity becomes 0
        return newItems.filter((_, i) => i !== index);
      }
      newItems[index] = { ...newItems[index], quantity: newQuantity };
      return newItems;
    });
  };

  const addMenuItem = (menuItem: any) => {
    setEditingOrderItems(prev => [
      ...prev,
      {
        menuItemId: menuItem.id,
        quantity: 1,
        price: menuItem.price,
        customizations: "",
        menuItem: menuItem
      }
    ]);
  };

  const getStatusOptions = (currentStatus: string) => {
    const allStatuses: any = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['served', 'cancelled'],
      'served': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };
    
    return allStatuses[currentStatus] || [];
  };

  return (
    <Layout
      title={t("orders", "Orders")}
      description="Manage and track customer orders"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative">
            <Input
              placeholder={t("search", "Search orders...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 material-icons">search</span>
          </div>
          <div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="active">{t("activeOrders", "Active Orders")}</TabsTrigger>
                <TabsTrigger value="all">{t("allOrders", "All Orders")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {activeTab === "active" ? "Active Orders" : "All Orders"}
            </h3>
            {activeTab === "active" && activeOrders && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-brand dark:bg-red-900/30">
                {activeOrders.length} Active
              </span>
            )}
          </div>
          
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Loading orders...</p>
              </div>
            ) : filteredOrders && filteredOrders.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Table</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredOrders.map(order => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">#{order.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{order.customerName || 'Unknown Customer'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">Table {order.tableId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{order.items?.length || 0} items</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${parseFloat(order.total).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <OrderItem.StatusBadge status={order.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {calculateTimeAgo(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleViewOrder(order)}
                          >
                            View
                          </Button>
                          {(order.status === 'pending' || order.status === 'confirmed' || order.status === 'preparing') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                onClick={() => handleEditOrder(order)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                onClick={() => handleDeleteOrder(order)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {activeTab === "active"
                    ? "No active orders found"
                    : "No orders found"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Customer</span>
                <span className="font-medium">{selectedOrder.customerName || 'Unknown Customer'}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Table</span>
                <span className="font-medium">Table {selectedOrder.tableId}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                <OrderItem.StatusBadge status={selectedOrder.status} />
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Time</span>
                <span className="font-medium">{calculateTimeAgo(selectedOrder.createdAt)}</span>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h4 className="font-medium mb-2">Order Items</h4>
                <ul className="space-y-2">
                  {selectedOrder.items?.map((item: any) => (
                    <li key={item.id} className="flex justify-between">
                      <div className="flex-1">
                        <span className="font-medium">{item.quantity}x {item.menuItem?.name || `Item #${item.menuItemId}`}</span>
                        {item.menuItem?.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-[200px]">
                            {item.menuItem.description}
                          </p>
                        )}
                      </div>
                      <span className="ml-4 whitespace-nowrap">${parseFloat(item.price).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <span className="font-medium">Total</span>
                <span className="font-bold">${parseFloat(selectedOrder.total).toFixed(2)}</span>
              </div>
              
              {getStatusOptions(selectedOrder.status).length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h4 className="font-medium mb-2">Update Status</h4>
                  <div className="flex space-x-2">
                    {getStatusOptions(selectedOrder.status).map((status: string) => (
                      <Button
                        key={status}
                        onClick={() => handleUpdateStatus(selectedOrder.id, status)}
                        className={
                          status === 'cancelled'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : status === 'completed'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-brand hover:bg-red-700 text-white'
                        }
                        size="sm"
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDetailDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Order #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Customer:</span> {selectedOrder.customerName || 'Unknown Customer'}
                </div>
                <div>
                  <span className="font-medium">Table:</span> Table {selectedOrder.tableId}
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">Order Items</h4>
                {editingOrderItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.menuItem?.name || `Menu Item #${item.menuItemId}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(parseFloat(item.price))} each
                      </div>
                      <Input
                        placeholder="Customizations..."
                        value={item.customizations || ""}
                        onChange={(e) => {
                          setEditingOrderItems(prev => {
                            const newItems = [...prev];
                            newItems[index] = { ...newItems[index], customizations: e.target.value };
                            return newItems;
                          });
                        }}
                        className="mt-2 text-sm"
                      />
                    </div>
                    <div className="flex items-center space-x-3 ml-4">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateItemQuantity(index, -1)}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateItemQuantity(index, 1)}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-sm font-medium">
                        {formatCurrency(parseFloat(item.price) * item.quantity)}
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="border-t pt-4">
                  <h5 className="font-medium mb-3">Add Items</h5>
                  {isMenuLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">Loading menu items...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {Array.isArray(menuItems) && menuItems.map((menuItem) => (
                        <Button
                          key={menuItem.id}
                          variant="outline"
                          size="sm"
                          onClick={() => addMenuItem(menuItem)}
                          className="justify-start h-auto p-2"
                        >
                          <div className="text-left">
                            <div className="font-medium text-sm">{menuItem.name}</div>
                            <div className="text-xs text-gray-500">{formatCurrency(parseFloat(menuItem.price || '0'))}</div>
                          </div>
                        </Button>
                      ))}
                      {(!Array.isArray(menuItems) || menuItems.length === 0) && (
                        <div className="col-span-2 text-center text-gray-500 py-4">
                          No menu items available
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">New Total:</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(editingOrderItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isEditing}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveOrderEdit}
              disabled={isEditing || editingOrderItems.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isEditing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Order Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Order #{selectedOrder?.id}? This action cannot be undone.
              {selectedOrder && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  <div className="text-sm">
                    <div><strong>Customer:</strong> {selectedOrder.customerName}</div>
                    <div><strong>Table:</strong> {selectedOrder.tableId}</div>
                    <div><strong>Total:</strong> {formatCurrency(parseFloat(selectedOrder.total))}</div>
                    <div><strong>Items:</strong> {selectedOrder.items?.length || 0} items</div>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteOrder}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
