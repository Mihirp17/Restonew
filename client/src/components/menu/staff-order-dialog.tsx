import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMenu, MenuItem } from "@/hooks/use-menu";
import { useOrders } from "@/hooks/use-orders";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { User, Users } from "lucide-react";

interface CartItem extends MenuItem {
  quantity: number;
  customerId?: number;
  customizations?: string;
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  isMainCustomer: boolean;
  paymentStatus: string;
}

interface TableSession {
  id: number;
  sessionName?: string;
  partySize: number;
  splitType: string;
  customers: Customer[];
  totalAmount?: number | string; // Added for totalAmount
}

interface StaffOrderDialogProps {
  restaurantId: number;
  selectedTableId: number;
  tableSessionId?: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderPlaced?: () => void;
}

export function StaffOrderDialog({ 
  restaurantId, 
  selectedTableId, 
  tableSessionId,
  isOpen, 
  onOpenChange,
  onOrderPlaced 
}: StaffOrderDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { menuItems, isLoading: isMenuLoading, getCategories } = useMenu(restaurantId);
  const { createOrder, isCreating } = useOrders(restaurantId);
  const [customerName, setCustomerName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tableSession, setTableSession] = useState<TableSession | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [orderNotes, setOrderNotes] = useState("");

  // Fetch table session and customers if tableSessionId is provided
  useEffect(() => {
    const fetchTableSession = async () => {
      if (!tableSessionId || !restaurantId) return;

      try {
        const sessionData = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}`
        });
        setTableSession(sessionData);
        
        // Set the first customer as default selected
        if (sessionData.customers && sessionData.customers.length > 0) {
          setSelectedCustomerId(sessionData.customers[0].id);
        }
      } catch (error) {
        console.error('Error fetching table session:', error);
        toast({
          title: "Error",
          description: "Failed to load table session",
          variant: "destructive"
        });
      }
    };

    fetchTableSession();
  }, [tableSessionId, restaurantId]);

  // Get unique categories from menu items using useMemo
  const categories = useMemo(() => {
    if (menuItems && Array.isArray(menuItems)) {
      return Array.from(new Set(menuItems.map(item => item.category)));
    }
    return [];
  }, [menuItems]);

  // Filter menu items based on category and search
  const filteredMenuItems: MenuItem[] = (menuItems && Array.isArray(menuItems) ? menuItems : []).filter((item: MenuItem) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = searchTerm === "" || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return item.isAvailable && matchesCategory && matchesSearch;
  });

  // Add item to cart
  const addToCart = (item: MenuItem) => {
    if (tableSession && !selectedCustomerId) {
      toast({
        title: "Select Customer",
        description: "Please select a customer for this item",
        variant: "destructive"
      });
      return;
    }

    setCart((prevCart: CartItem[]) => {
      const existingItemIndex = prevCart.findIndex(cartItem => 
        cartItem.id === item.id && cartItem.customerId === selectedCustomerId
      );
      if (existingItemIndex >= 0) {
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += 1;
        return updatedCart;
      }
      return [...prevCart, { 
        ...item, 
        quantity: 1, 
        customerId: selectedCustomerId || undefined,
        customizations: ""
      }];
    });
  };

  // Remove item from cart
  const removeFromCart = (itemId: number, customerId?: number) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => 
        item.id === itemId && item.customerId === customerId
      );
      if (existingItemIndex >= 0) {
        const updatedCart = [...prevCart];
        if (updatedCart[existingItemIndex].quantity > 1) {
          updatedCart[existingItemIndex].quantity -= 1;
          return updatedCart;
        }
        return prevCart.filter(item => 
          !(item.id === itemId && item.customerId === customerId)
        );
      }
      return prevCart;
    });
  };

  // Update item customizations
  const updateCustomizations = (itemId: number, customerId: number | undefined, customizations: string) => {
    setCart(prevCart => prevCart.map(item => 
      item.id === itemId && item.customerId === customerId 
        ? { ...item, customizations }
        : item
    ));
  };

  // Calculate cart total
  const cartTotal = cart.reduce((total, item) => {
    return total + (parseFloat(item.price) * item.quantity);
  }, 0);

  // Group cart items by customer
  const getCartByCustomer = () => {
    if (!tableSession) return { undefined: cart };
    
    const grouped: { [key: string]: CartItem[] } = {};
    cart.forEach(item => {
      const customerId = item.customerId?.toString() || 'unassigned';
      if (!grouped[customerId]) {
        grouped[customerId] = [];
      }
      grouped[customerId].push(item);
    });
    return grouped;
  };

  // Get customer name by ID
  const getCustomerName = (customerId?: number) => {
    if (!customerId || !tableSession) return 'Unassigned';
    const customer = tableSession.customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  // Place order
  const placeOrder = async () => {
    // Legacy order creation for tables without sessions
    if (!tableSession) {
      if (!customerName.trim()) {
        toast({
          title: "Name required",
          description: "Please enter customer name to place order",
          variant: "destructive"
        });
        return;
      }
    }

    if (cart.length === 0) {
      toast({
        title: "Empty order",
        description: "Please add items to the order",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);

      if (tableSession) {
        // Create orders for each customer
        const customerOrders = getCartByCustomer();
        let cartTotal = 0;
        for (const [customerIdStr, items] of Object.entries(customerOrders)) {
          if (items.length === 0) continue;
          
          const customerId = customerIdStr === 'unassigned' ? null : parseInt(customerIdStr);
          if (!customerId) {
            toast({
              title: "Unassigned Items",
              description: "All items must be assigned to a customer",
              variant: "destructive"
            });
            return;
          }

          const customer = tableSession.customers.find(c => c.id === customerId);
          if (!customer) continue;

          const orderTotal = items.reduce((total, item) => 
            total + (parseFloat(item.price) * item.quantity), 0
          );
          cartTotal += orderTotal;

          // Generate order number
          const orderNumber = `T${selectedTableId}-${Date.now()}-${customerId}`;

          // Place the order (type-safe)
          await createOrder({
            tableId: selectedTableId,
            restaurantId,
            customerName: getCustomerName(customerId),
            status: "pending",
            total: orderTotal.toFixed(2),
            items: items.map(item => ({
              menuItemId: item.id,
              quantity: item.quantity,
              price: item.price
            }))
          });
        }

        // Update table session total
        // Fix TypeScript issue with totalAmount property
        if (typeof tableSession.totalAmount === 'string' || typeof tableSession.totalAmount === 'number') {
          const currentTotal = parseFloat(tableSession.totalAmount?.toString() || '0');
          await apiRequest({
            method: 'PUT',
            url: `/api/restaurants/${restaurantId}/table-sessions/${tableSession.id}`,
            data: {
            totalAmount: (currentTotal + cartTotal).toString()
            }
          });
        }
      } else {
        // Legacy order creation
        await apiRequest({
          method: 'PUT',
          url: `/api/restaurants/${restaurantId}/tables/${selectedTableId}`,
          data: { isOccupied: true }
        });

        const orderData = {
          customerName: customerName.trim(),
          tableId: selectedTableId,
          restaurantId,
          status: "pending" as const,
          total: cartTotal.toString(),
          items: cart.map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            price: item.price
          }))
        };

        await createOrder(orderData);
      }
      
      // Invalidate relevant queries to update UI
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/tables`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/orders`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/active-orders`]
      });

      const orderCount = tableSession ? Object.keys(getCartByCustomer()).length : 1;
      toast({
        title: "Order placed",
        description: `${orderCount} order${orderCount > 1 ? 's' : ''} placed successfully for Table ${selectedTableId}`
      });

      setCart([]);
      setCustomerName("");
      setOrderNotes("");
      onOrderPlaced?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to place order, please try again",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get category icon based on category name
  const getCategoryIcon = (category: string): string => {
    switch (category.toLowerCase()) {
      case 'starters':
      case 'appetizers':
        return "lunch_dining";
      case 'main course':
      case 'mains':
        return "restaurant";
      case 'burgers':
        return "lunch_dining";
      case 'pizza':
        return "local_pizza";
      case 'pasta':
        return "ramen_dining";
      case 'desserts':
        return "icecream";
      case 'drinks':
        return "local_bar";
      default:
        return "restaurant_menu";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>New Order - Table {selectedTableId}</span>
            {tableSession && (
              <Badge variant="outline" className="ml-2">
                {tableSession.partySize} {tableSession.partySize === 1 ? 'person' : 'people'}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {tableSession 
              ? `Create orders for customers in ${tableSession.sessionName || 'this session'}`
              : "Create a new order for this table by selecting items from the menu"
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-1 gap-8 min-h-0">
          {/* Menu Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="space-y-4 mb-4">
              {!tableSession ? (
                <Input
                  placeholder="Customer name..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Customer for Items:</label>
                  <Select value={selectedCustomerId?.toString() || ""} onValueChange={(value) => setSelectedCustomerId(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tableSession.customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4" />
                            <span>{customer.name}</span>
                            {customer.isMainCustomer && (
                              <Badge variant="default" className="text-xs">Main</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <Input
                placeholder="Search menu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <Input
                placeholder="Order notes (optional)..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>

            <div className="flex overflow-x-auto py-2 space-x-2 mb-4">
              <Button
                onClick={() => setSelectedCategory("all")}
                variant={selectedCategory === "all" ? "default" : "outline"}
                className={selectedCategory === "all" ? "whitespace-nowrap bg-red-600 hover:bg-red-700 text-white border-none" : "whitespace-nowrap border-red-600 text-red-600 hover:bg-red-50"}
              >
                All Items
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className={selectedCategory === category ? "whitespace-nowrap bg-red-600 hover:bg-red-700 text-white border-none" : "whitespace-nowrap border-red-600 text-red-600 hover:bg-red-50"}
                >
                  {category}
                </Button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid gap-4">
                {filteredMenuItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                  >
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <span className="material-icons text-2xl text-gray-400">
                          {getCategoryIcon(item.category)}
                        </span>
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex justify-between">
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="font-medium text-red-600">
                          {formatCurrency(parseFloat(item.price))}
                        </p>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {item.description}
                        </p>
                      )}
                      <Button 
                        variant="outline"
                        size="sm"
                        className="mt-2 border-red-600 text-red-600 hover:bg-red-50"
                        onClick={() => addToCart(item)}
                        disabled={tableSession ? !selectedCustomerId : false}
                      >
                        Add to order
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary Section */}
          <div className="w-80 flex flex-col border-l dark:border-gray-700">
            <h3 className="font-medium mb-4 flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Order Summary</span>
            </h3>
            
            <div className="flex-1 overflow-y-auto">
              {tableSession ? (
                // Group by customer
                Object.entries(getCartByCustomer()).map(([customerIdStr, items]) => {
                  const customerId = customerIdStr === 'unassigned' ? undefined : parseInt(customerIdStr);
                  const customerTotal = items.reduce((total, item) => 
                    total + (parseFloat(item.price) * item.quantity), 0
                  );

                  return (
                    <div key={customerIdStr} className="mb-4 p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium text-sm">{getCustomerName(customerId)}</span>
                        </div>
                        <span className="text-sm font-medium text-red-600">
                          {formatCurrency(customerTotal)}
                        </span>
                      </div>
                      
                      {items.map((item, index) => (
                        <div key={`${item.id}-${customerId}-${index}`} className="mb-2 p-2 bg-gray-50 rounded">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-gray-500">
                                {formatCurrency(parseFloat(item.price))} × {item.quantity}
                              </p>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 border-red-600 text-red-600 hover:bg-red-50"
                                onClick={() => removeFromCart(item.id, customerId)}
                              >
                                <span className="material-icons text-xs">remove</span>
                              </Button>
                              <span className="text-xs w-4 text-center">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 border-red-600 text-red-600 hover:bg-red-50"
                                onClick={() => addToCart(item)}
                              >
                                <span className="material-icons text-xs">add</span>
                              </Button>
                            </div>
                          </div>
                          <Input
                            placeholder="Special requests..."
                            value={item.customizations || ""}
                            onChange={(e) => updateCustomizations(item.id, customerId, e.target.value)}
                            className="mt-1 h-6 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                // Traditional single-customer cart
                cart.map((item, index) => (
                  <div 
                    key={`${item.id}-${index}`}
                    className="flex items-center justify-between py-2 border-b dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(parseFloat(item.price))} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 border-red-600 text-red-600 hover:bg-red-50"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <span className="material-icons text-sm">remove</span>
                      </Button>
                      <span className="text-sm font-medium w-4 text-center">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 border-red-600 text-red-600 hover:bg-red-50"
                        onClick={() => addToCart(item)}
                      >
                        <span className="material-icons text-sm">add</span>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="border-t dark:border-gray-700 pt-4 mt-4">
              <div className="flex justify-between mb-4">
                <span className="font-medium">Total</span>
                <span className="font-bold text-red-600">{formatCurrency(cartTotal)}</span>
              </div>
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                onClick={placeOrder}
                disabled={isSubmitting || cart.length === 0}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Placing Order...
                  </span>
                ) : (
                  `Place Order${tableSession ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
