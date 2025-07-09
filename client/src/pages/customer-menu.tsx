import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/use-socket";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: string;
  image: string | null;
  isAvailable: boolean;
  category?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface OrderItem {
  id: number;
  quantity: number;
  price: string;
  menuItemId: number;
  orderId: number;
  createdAt: string;
  updatedAt: string;
  menuItem?: {
    id: number;
    name: string;
  };
}

interface CustomerOrder {
  id: number;
  customerId: number;
  tableSessionId: number;
  orderNumber: string;
  status: string;
  total: string;
  restaurantId: number;
  tableId: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export default function CustomerMenu() {
  const { restaurantId, tableId } = useParams();
  const { toast } = useToast();
  const { sendMessage } = useSocket(
    restaurantId ? parseInt(restaurantId) : undefined, 
    tableId ? parseInt(tableId) : undefined
  );
  const queryClient = useQueryClient();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderingDialogOpen, setIsOrderingDialogOpen] = useState(false);
  const [isOrderSuccessDialogOpen, setIsOrderSuccessDialogOpen] = useState(false);
  const [isCallWaiterDialogOpen, setIsCallWaiterDialogOpen] = useState(false);
  const [waiterRequestSent, setWaiterRequestSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomerInfoSubmitted, setIsCustomerInfoSubmitted] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [tableSessionId, setTableSessionId] = useState<number | null>(null);
  const [currentTab, setCurrentTab] = useState("menu");
  const [orderHistory, setOrderHistory] = useState<CustomerOrder[]>([]);
  const [sessionSummary, setSessionSummary] = useState<any>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Toggle favorite menu item
  const toggleFavorite = (itemId: number) => {
    setFavorites((prevFavorites) =>
      prevFavorites.includes(itemId)
        ? prevFavorites.filter((id) => id !== itemId)
        : [...prevFavorites, itemId]
    );
  };

  // Add menu item image modal for preview
  const openItemModal = (item: MenuItem) => {
    setSelectedItem(item);
    setIsItemModalOpen(true);
  };
  
  const closeItemModal = () => {
    setIsItemModalOpen(false);
    setSelectedItem(null);
  };

  // Fetch restaurant and menu items
  useEffect(() => {
    const fetchRestaurantAndMenu = async () => {
      try {
        // Fetch restaurant data
        const restaurantResponse = await fetch(`/api/restaurants/${restaurantId}`);
        if (!restaurantResponse.ok) throw new Error("Failed to fetch restaurant");
        const restaurantData = await restaurantResponse.json();
        setRestaurant(restaurantData);
        
        // Fetch menu items
        const menuResponse = await fetch(`/api/restaurants/${restaurantId}/menu-items`);
        if (!menuResponse.ok) throw new Error("Failed to fetch menu items");
        const menuData = await menuResponse.json();
        
        // Filter only available items
        const availableItems = menuData.filter((item: MenuItem) => item.isAvailable);
        setMenuItems(availableItems);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load menu, please try again",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRestaurantAndMenu();
  }, [restaurantId, toast]);

  // Create customer and table session with debouncing
  const createCustomerAndSession = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    let isProcessing = false;
    
    return async (): Promise<{customerId: number, tableSessionId: number} | null> => {
      // Prevent multiple simultaneous calls
      if (isProcessing) {
        console.log("Session creation already in progress, skipping...");
        return null;
      }
      
      isProcessing = true;
      
      try {
        if (!customerName.trim()) {
          throw new Error("Customer name is required");
        }

        // First check for existing active session for this table
        const existingSessionResponse = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions?tableId=${tableId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        let sessionData;
        
        if (existingSessionResponse.ok) {
          const existingSessions = await existingSessionResponse.json();
          const activeSession = existingSessions.find((session: any) => session.status === 'active');
          
          if (activeSession) {
            // Join existing session
            sessionData = activeSession;
            console.log("Joining existing table session:", sessionData);
          }
        }

        if (!sessionData) {
          // Create new session if none exists
          const sessionResponse = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tableId: parseInt(tableId!),
              partySize: 1,
              status: "active"
            })
          });
          
          if (!sessionResponse.ok) {
            const errorData = await sessionResponse.json();
            throw new Error(errorData.message || "Failed to create table session");
          }

          sessionData = await sessionResponse.json();
          console.log("Table session created:", sessionData);
        } else {
          // Update party size for existing session when new customer joins
          const existingCustomers = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions/${sessionData.id}/customers`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (existingCustomers.ok) {
            const customers = await existingCustomers.json();
            const newPartySize = customers.length + 1; // Current customers + new customer
            
            // Update session party size (this requires the authenticated endpoint)
            try {
              await fetch(`/api/restaurants/${restaurantId}/table-sessions/${sessionData.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  partySize: newPartySize
                }),
                credentials: 'include'
              });
              console.log(`Updated session party size to ${newPartySize}`);
            } catch (updateError) {
              console.warn('Could not update party size:', updateError);
              // Continue anyway - this is not critical
            }
          }
        }

        console.log("Table session created:", sessionData);
      setTableSessionId(sessionData.id);

        // Check if customer already exists in this session
        const existingCustomersResponse = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions/${sessionData.id}/customers`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        let customerData;
        
        if (existingCustomersResponse.ok) {
          const existingCustomers = await existingCustomersResponse.json();
          const existingCustomer = existingCustomers.find((customer: any) => 
            customer.name.toLowerCase() === customerName.trim().toLowerCase() ||
            (customerEmail.trim() && customer.email?.toLowerCase() === customerEmail.trim().toLowerCase())
          );
          
          if (existingCustomer) {
            // Use existing customer
            customerData = existingCustomer;
            console.log("Using existing customer:", customerData);
          }
        }

        if (!customerData) {
          // Create new customer record
      const customerResponse = await fetch(`/api/public/restaurants/${restaurantId}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: customerName.trim(),
          email: customerEmail.trim() || null,
          phone: customerPhone.trim() || null,
          tableSessionId: sessionData.id,
              isMainCustomer: false  // Don't claim to be main customer when joining
        })
      });

      if (!customerResponse.ok) {
        const errorData = await customerResponse.json();
            console.error("Customer creation error:", errorData);
        throw new Error(errorData.message || "Failed to create customer record");
      }

          customerData = await customerResponse.json();
          console.log("Customer created:", customerData);
        }

        console.log("Customer created:", customerData);
      setCustomerId(customerData.id);
      
        return {
          customerId: customerData.id,
          tableSessionId: sessionData.id
        };
    } catch (error) {
        console.error("Error in createCustomerAndSession:", error);
        return null;
      } finally {
        // Add small delay before allowing next call
        setTimeout(() => {
          isProcessing = false;
        }, 1000);
      }
    };
  }, [customerName, customerEmail, customerPhone, restaurantId, tableId]);

  // Submit customer information with enhanced validation
  const submitCustomerInfo = async () => {
    // Enhanced validation
    if (!customerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to continue",
        variant: "destructive"
      });
      return;
    }

    if (customerName.trim().length < 2) {
      toast({
        title: "Invalid name",
        description: "Please enter a valid name (at least 2 characters)",
        variant: "destructive"
      });
      return;
    }

    // Email validation (if provided)
    if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    // Phone validation (if provided)
    if (customerPhone.trim() && customerPhone.trim().length < 8) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    const sessionResult = await createCustomerAndSession();
    if (sessionResult) {
      setIsCustomerInfoSubmitted(true);
      toast({
        title: "Welcome!",
        description: "Your session has been created successfully. You can now browse our menu.",
      });
    }
    setIsSubmitting(false);
  };

  // Get unique categories from menu items
  const categories = [...new Set(menuItems.map(item => item.category || "Uncategorized"))].sort();

  // Filter menu items based on search term and category
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get category icon based on name
  const getCategoryIcon = (category: string) => {
    const lowerCategory = category.toLowerCase();
    
    // Return appropriate SVG icon based on category
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {lowerCategory.includes('starter') || lowerCategory.includes('appetizer') ? (
          // Salad/Starter icon
          <>
            <path d="M12 2a8 8 0 0 0-8 8v1h16v-1a8 8 0 0 0-8-8Z"/>
            <path d="M2 11v2c0 5 4 9 9 9h2c5 0 9-4 9-9v-2"/>
          </>
        ) : lowerCategory.includes('soup') ? (
          // Bowl/Soup icon
          <>
            <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/>
            <path d="M7 21h10"/>
            <path d="M19.5 12V3h-15v9"/>
          </>
        ) : lowerCategory.includes('burger') ? (
          // Burger icon
          <>
            <path d="M4 10h16"/>
            <path d="M4 14h16"/>
            <path d="M4 18h16"/>
            <path d="M6 6h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/>
          </>
        ) : lowerCategory.includes('pizza') ? (
          // Pizza icon
          <>
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
          </>
        ) : lowerCategory.includes('pasta') ? (
          // Pasta/Noodles icon
          <>
            <path d="M4 11h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"/>
            <path d="M6 11V7c0-1.7 1.3-3 3-3h6c1.7 0 3 1.3 3 3v4"/>
          </>
        ) : lowerCategory.includes('dessert') ? (
          // Dessert/Cake icon
          <>
            <path d="M20 11H4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2Z"/>
            <path d="M4 11V7c0-1.7 1.3-3 3-3h10c1.7 0 3 1.3 3 3v4"/>
            <path d="M8 11V7"/>
            <path d="M16 11V7"/>
          </>
        ) : lowerCategory.includes('drink') || lowerCategory.includes('beverage') ? (
          // Drink icon
          <>
            <path d="M8 2h8"/>
            <path d="M12 2v7"/>
            <path d="M4 9h16"/>
            <path d="M6 14c.7 1.2 1.7 2 3 2"/>
            <path d="M18 14c-.7 1.2-1.7 2-3 2"/>
          </>
        ) : lowerCategory.includes('beer') || lowerCategory.includes('alcohol') ? (
          // Beer/Alcohol icon
          <>
            <path d="M17 11h1a3 3 0 0 1 0 6h-1"/>
            <path d="M9 12v6"/>
            <path d="M13 12v6"/>
            <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 3 11 3s2 .5 3 .5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/>
            <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>
          </>
        ) : lowerCategory.includes('sandwich') ? (
          // Sandwich icon
          <>
            <path d="M3 11h18"/>
            <path d="M12 11v8"/>
            <path d="M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
          </>
        ) : (
          // Default food/dish icon
          <>
            <path d="M3 11h18"/>
            <path d="M12 11v8"/>
            <path d="M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
          </>
        )}
      </svg>
    );
  };

  // Add item to cart
  const addToCart = (item: MenuItem) => {
    setCart(prevCart => {
      // Check if item already exists in cart
      const existingItemIndex = prevCart.findIndex(cartItem => cartItem.id === item.id);
      
      if (existingItemIndex >= 0) {
        // Increment quantity of existing item
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += 1;
        return updatedCart;
      } else {
        // Add new item to cart
        return [...prevCart, { ...item, quantity: 1 }];
      }
    });
    
    toast({
      title: "Added to order",
      description: `${item.name} added to your order`
    });
  };

  // Remove item from cart
  const removeFromCart = (itemId: number) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => item.id === itemId);
      
      if (existingItemIndex >= 0) {
        const updatedCart = [...prevCart];
        if (updatedCart[existingItemIndex].quantity > 1) {
          // Decrement quantity
          updatedCart[existingItemIndex].quantity -= 1;
          return updatedCart;
        } else {
          // Remove item completely
          return prevCart.filter(item => item.id !== itemId);
        }
      }
      
      return prevCart;
    });
  };

  // Calculate cart total
  const cartTotal = cart.reduce((total, item) => {
    return total + (parseFloat(item.price) * item.quantity);
  }, 0);

  // Calculate total cart items
  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);
  
  // Call waiter function
  const callWaiter = () => {
    if (!customerName.trim()) {
      setIsCallWaiterDialogOpen(true);
      return;
    }
    
    sendWaiterRequest();
  };
  
  // Send waiter request via WebSocket
  const sendWaiterRequest = () => {
    if (!restaurantId || !tableId) return;
    
    if (!customerName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name so the waiter knows who to assist.",
        variant: "destructive"
      });
      return;
    }
    
    // The socket library expects a message with type and payload fields
    sendMessage({
      type: 'call-waiter',
      payload: {
        restaurantId: parseInt(restaurantId),
        tableId: parseInt(tableId),
        customerName: customerName.trim() || 'Guest',
        timestamp: new Date().toISOString()
      }
    });
    
    setIsCallWaiterDialogOpen(false);
    setWaiterRequestSent(true);
    
    toast({
      title: "Waiter Called",
      description: "A staff member will be with you shortly",
    });
    
    // Reset waiter request status after 2 minutes
    setTimeout(() => {
      setWaiterRequestSent(false);
    }, 2 * 60 * 1000);
  };

  // Generate unique order number
  const generateOrderNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const tableNumber = tableId?.toString().padStart(2, '0') || '00';
    return `T${tableNumber}-${timestamp}`;
  };

  // Place order with enhanced session management and debouncing
  const placeOrder = useMemo(() => {
    let isProcessing = false;
    
    return async () => {
      // Prevent multiple simultaneous order placements
      if (isProcessing) {
        console.log("Order placement already in progress, skipping...");
        return;
      }
      
    if (!customerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to place an order",
        variant: "destructive"
      });
      return;
    }
    if (cart.length === 0) {
      toast({
        title: "Empty order",
        description: "Please add items to your order",
        variant: "destructive"
      });
      return;
    }
    if (!restaurantId || isNaN(Number(restaurantId)) || !tableId || isNaN(Number(tableId))) {
      toast({
        title: "Invalid QR/Table",
        description: "Missing or invalid restaurant or table information. Please scan the correct QR code or contact staff.",
        variant: "destructive"
      });
      return;
    }

      isProcessing = true;
    setIsSubmitting(true);
      
      try {
        // Ensure we have a valid session before placing the order
        let currentCustomerId = customerId;
        let currentTableSessionId = tableSessionId;
        
        if (!currentCustomerId || !currentTableSessionId) {
          console.log("Session not found, creating new session...");
          const sessionResult = await createCustomerAndSession();
          if (!sessionResult) {
            throw new Error("Failed to create customer session");
          }
          // Use the values returned directly from session creation
          currentCustomerId = sessionResult.customerId;
          currentTableSessionId = sessionResult.tableSessionId;
        }

        // Final validation before creating order
        if (!currentCustomerId || !currentTableSessionId) {
          throw new Error("Session could not be established. Please refresh the page and try again.");
        }

      const orderData = {
          customerId: currentCustomerId,
          tableSessionId: currentTableSessionId,
        orderNumber: generateOrderNumber(),
        status: "pending",
        total: cartTotal.toString(),
        restaurantId: parseInt(restaurantId),
        tableId: parseInt(tableId),
        notes: "",
        isGroupOrder: false,
        items: cart.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          price: item.price
        }))
      };

        console.log("Placing order with data:", {
          customerId: orderData.customerId,
          tableSessionId: orderData.tableSessionId,
          orderNumber: orderData.orderNumber,
          total: orderData.total,
          itemCount: orderData.items.length
        });

      // Place the order
      const response = await apiRequest("POST", `/api/restaurants/${restaurantId}/orders`, orderData);
      
      if (response.ok) {
        // Update table status to occupied
        await apiRequest("PATCH", `/api/restaurants/${restaurantId}/tables/${tableId}`, {
          isOccupied: true
        });

        // Update table status in cache with correct query key
        queryClient.invalidateQueries({ queryKey: [`/api/restaurants/${restaurantId}/tables`] });
        
        // Close ordering dialog and show success dialog
        setIsOrderingDialogOpen(false);
        setCart([]);
        setIsOrderSuccessDialogOpen(true);
          
          toast({
            title: "Order Placed!",
            description: `Your order #${orderData.orderNumber} has been placed successfully.`,
          });
      } else {
        const errorData = await response.json();
          console.error("Order creation failed:", errorData);
          
          // Provide more specific error messages
          if (errorData.errors && Array.isArray(errorData.errors)) {
            const errorMessages = errorData.errors.map((err: any) => `${err.path?.join('.')}: ${err.message}`).join('; ');
            throw new Error(`Validation errors: ${errorMessages}`);
          } else {
        throw new Error(errorData.message || "Failed to place your order, please try again");
          }
      }
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
          title: "Order Failed",
        description: error instanceof Error ? error.message : "Failed to place your order, please try again",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
        // Add delay before allowing next order
        setTimeout(() => {
          isProcessing = false;
        }, 2000);
      }
    };
  }, [customerName, cart, cartTotal, restaurantId, tableId, customerId, tableSessionId, createCustomerAndSession, generateOrderNumber, toast, queryClient]);

  // Fetch order history for customer
  const fetchOrderHistory = async () => {
    if (!customerId || !restaurantId) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/public/restaurants/${restaurantId}/orders?customerId=${customerId}`);
      if (response.ok) {
        const orders = await response.json();
        setOrderHistory(orders);
      } else {
        console.error("Failed to fetch order history");
      }
    } catch (error) {
      console.error("Error fetching order history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch session summary (current bill)
  const fetchSessionSummary = async () => {
    if (!tableSessionId || !restaurantId) return;
    
    try {
      // Calculate total from all orders in this session
      const totalAmount = orderHistory.reduce((sum, order) => {
        return sum + parseFloat(order.total);
      }, 0);
      
      setSessionSummary({
        tableSessionId,
        tableNumber: tableId,
        totalAmount,
        orderCount: orderHistory.length,
        lastOrderAt: orderHistory.length > 0 ? orderHistory[orderHistory.length - 1].createdAt : null
      });
    } catch (error) {
      console.error("Error calculating session summary:", error);
    }
  };

  // Update order history when customer session is created
  useEffect(() => {
    if (customerId && isCustomerInfoSubmitted) {
      fetchOrderHistory();
    }
  }, [customerId, isCustomerInfoSubmitted, restaurantId]);

  // Update session summary when order history changes
  useEffect(() => {
    if (orderHistory.length >= 0 && tableSessionId) {
      fetchSessionSummary();
    }
  }, [orderHistory, tableSessionId]);

  // Listen for real-time order updates via WebSocket instead of polling
  useEffect(() => {
    if (!customerId || !restaurantId) return;

    const handleOrderUpdate = (data: any) => {
      if (data.customerId === customerId) {
        // Refresh order history when our orders are updated
        fetchOrderHistory();
      }
    };

    const handleNewOrder = (data: any) => {
      if (data.customerId === customerId) {
        // Refresh order history when we place a new order
        fetchOrderHistory();
      }
    };

    // Register WebSocket listeners for real-time updates
    addEventListener('order-status-updated', handleOrderUpdate);
    addEventListener('new-order-received', handleNewOrder);

    // Initial fetch only
    if (isCustomerInfoSubmitted) {
      fetchOrderHistory();
    }

    // No polling interval - rely on WebSocket updates
    return () => {
      // WebSocket cleanup is handled by the useSocket hook
    };
  }, [customerId, isCustomerInfoSubmitted, restaurantId, addEventListener]);

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'served': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short'
    });
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + parseFloat(item.price) * item.quantity, 0);
  };

  // --- Customer Information Form ---
  if (!isCustomerInfoSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-red-100 to-red-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-red-100">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 via-red-600 to-red-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to {restaurant?.name}</h1>
              <p className="text-gray-600">Please provide your information to get started</p>
            </div>
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="Your Name *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-12 text-lg border-2 border-red-200 rounded-xl focus-visible:ring-red-500 focus-visible:border-red-500 transition-colors"
                  required
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Email Address (optional)"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="h-12 text-lg border-2 border-red-200 rounded-xl focus-visible:ring-red-500 focus-visible:border-red-500 transition-colors"
                />
              </div>
              <div>
                <Input
                  type="tel"
                  placeholder="Phone Number (optional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-12 text-lg border-2 border-red-200 rounded-xl focus-visible:ring-red-500 focus-visible:border-red-500 transition-colors"
                />
              </div>
              <Button
                onClick={submitCustomerInfo}
                disabled={!customerName.trim() || isSubmitting}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
              >
                {isSubmitting ? "Setting up..." : "Continue to Menu"}
              </Button>
              <p className="text-xs text-gray-500 text-center mt-3">
                * Required field. Your information helps us provide better service.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="relative h-64 bg-gradient-to-br from-red-500 via-red-600 to-red-700 overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-end justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl border border-white/30 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{restaurant?.name}</h1>
                  <p className="text-white/80 text-sm">Table {tableId} • {customerName}</p>
                </div>
              </div>
              <Button 
                variant="secondary"
                size="sm"
                className="bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20 transition-all duration-300"
                onClick={callWaiter}
                disabled={waiterRequestSent}
              >
                {waiterRequestSent ? (
                  <span className="flex items-center space-x-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Waiter Coming</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
                    </svg>
                    <span>Call Waiter</span>
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mx-6 mb-6 bg-red-50 border border-red-200">
            <TabsTrigger value="menu" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Menu</TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              Orders
              {orderHistory.length > 0 && (
                <Badge className="ml-2 bg-red-600 text-white text-xs">{orderHistory.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bill" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              Bill
              {sessionSummary?.totalAmount > 0 && (
                <Badge className="ml-2 bg-red-600 text-white text-xs">{formatCurrency(sessionSummary.totalAmount)}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Menu Tab */}
          <TabsContent value="menu" className="mt-0">
        {/* Search and Categories */}
        <div className="p-6 bg-white border-b border-gray-200">
          <div className="relative mb-6">
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search menu..."
              className="h-12 pl-12 border-2 border-gray-200 rounded-xl focus-visible:ring-red-500 focus-visible:border-red-500 transition-colors"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
          </div>
          
          {/* Categories */}
          <div className="flex overflow-x-auto py-2 space-x-2 scrollbar-hide">
            <Button
              onClick={() => setSelectedCategory("all")}
              variant={selectedCategory === "all" ? "default" : "outline"}
              className={`rounded-full px-4 py-2 whitespace-nowrap shadow-sm hover:shadow transition-all duration-200 ${
                selectedCategory === "all" 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "border-red-200 text-red-600 hover:bg-red-50"
              }`}
            >
              All Items
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`rounded-full px-4 py-2 whitespace-nowrap shadow-sm hover:shadow transition-all duration-200 ${
                  selectedCategory === category 
                    ? "bg-red-600 hover:bg-red-700 text-white" 
                    : "border-red-200 text-red-600 hover:bg-red-50"
                }`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Menu Items */}
        <div className="px-6 pb-32 space-y-4">
          {filteredMenuItems.length > 0 ? (
            filteredMenuItems.map((item) => (
              <Card key={item.id} className="overflow-hidden border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-white rounded-2xl group">
                <CardContent className="p-0">
                  <div className="flex">
                    <div 
                      className="w-32 h-32 bg-gray-100 cursor-pointer relative overflow-hidden group-hover:w-36 transition-all duration-500 ease-in-out"
                      onClick={() => openItemModal(item)}
                    >
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-red-100 via-red-200 to-red-100 text-red-600">
                          {getCategoryIcon(item.category || "Uncategorized")}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <div className="flex-1 p-5 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <div className="space-y-1">
                          <h3 className="font-bold text-gray-900 text-lg leading-tight tracking-tight group-hover:text-red-600 transition-colors duration-300">{item.name}</h3>
                          <Badge variant="outline" className="bg-red-50 border-red-200 text-red-600">
                            {item.category || "Uncategorized"}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavorite(item.id)}
                          className={`p-1.5 h-8 w-8 rounded-full hover:bg-red-50 hover:text-red-600 transition-all duration-300 ${favorites.includes(item.id) ? 'text-red-600 scale-110' : 'text-gray-400'}`}
                        >★</Button>
                      </div>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                        {item.description || "Delicious dish prepared with care"}
                      </p>
                      <div className="flex justify-between items-center mt-auto">
                        <span className="text-xl font-bold text-red-600">
                          {formatCurrency(parseFloat(item.price))}
                        </span>
                        <div className="flex items-center space-x-2">
                          {cart.find(cartItem => cartItem.id === item.id) ? (
                            <div className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1 border border-gray-200 shadow-lg">
                              <Button
                                onClick={() => removeFromCart(item.id)}
                                size="sm"
                                variant="ghost"
                                className="w-8 h-8 rounded-full bg-white hover:bg-red-50 hover:text-red-600 text-lg font-medium p-0 shadow-sm border border-gray-200 transition-all duration-300 hover:scale-105"
                              >
                                −
                              </Button>
                              <span className="font-bold text-gray-900 min-w-[28px] text-center">
                                {cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}
                              </span>
                              <Button
                                onClick={() => addToCart(item)}
                                size="sm"
                                variant="ghost"
                                className="w-8 h-8 rounded-full bg-white hover:bg-red-50 hover:text-red-600 text-lg font-medium p-0 shadow-sm border border-gray-200 transition-all duration-300 hover:scale-105"
                              >
                                +
                              </Button>
                            </div>
                          ) : (
                            <Button
                              onClick={() => addToCart(item)}
                              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition-all duration-500 transform hover:scale-105 hover:shadow-xl"
                            >
                              Add to Order
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4 animate-bounce text-gray-400">
                {selectedCategory === "all" ? (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                ) : (
                  <div className="flex justify-center">
                    {getCategoryIcon(selectedCategory)}
                  </div>
                )}
              </div>
              <p className="text-gray-900 text-lg font-medium">No dishes found</p>
              <p className="text-gray-600 text-sm">
                {searchTerm ? "Try adjusting your search" : "No items in this category"}
              </p>
            </div>
          )}
        </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-0">
            <div className="p-6 pb-32">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Your Orders</h2>
                <p className="text-gray-600 text-sm">Track your orders for this session</p>
                </div>

              {isLoadingHistory ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M9 11H5a2 2 0 0 0-2 2v3c0 1.1.9 2 2 2h4"/>
                      <path d="M11 13h10"/>
                      <path d="M11 21V3"/>
                      <path d="M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1"/>
                      <path d="M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1"/>
                    </svg>
              </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                  <p className="text-gray-600 mb-4">Start by adding items to your cart from the menu</p>
                  <Button
                    onClick={() => setCurrentTab("menu")}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Browse Menu
            </Button>
          </div>
              ) : (
              <div className="space-y-4">
                  {orderHistory.map((order) => (
                    <Card key={order.id} className="border border-gray-200 shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg font-semibold text-gray-900">
                              Order #{order.orderNumber}
                            </CardTitle>
                            <p className="text-sm text-gray-600">
                              {formatDate(order.createdAt)}
                            </p>
                        </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(order.status)}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                            <p className="text-lg font-bold text-gray-900 mt-1">
                              {formatCurrency(parseFloat(order.total))}
                            </p>
                      </div>
                    </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-gray-600 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center">
                                  {item.quantity}
                                </span>
                                <span className="text-sm text-gray-900">
                                  {item.menuItem?.name || `Menu Item #${item.menuItemId}`}
                                </span>
                </div>
                              <span className="text-sm font-medium text-gray-900">
                                {formatCurrency(parseFloat(item.price) * item.quantity)}
                  </span>
                </div>
                          ))}
              </div>
                        {order.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Notes:</span> {order.notes}
                            </p>
            </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Bill Tab */}
          <TabsContent value="bill" className="mt-0">
            <div className="p-6 pb-32">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Your Bill</h2>
                <p className="text-gray-600 text-sm">Current session summary for Table {tableId}</p>
              </div>

              {sessionSummary ? (
                <div className="space-y-6">
                  {/* Session Summary Card */}
                  <Card className="border border-red-200 bg-red-50">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-red-900">Session Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-red-600 font-medium">Total Orders</p>
                          <p className="text-xl font-bold text-red-900">{sessionSummary.orderCount}</p>
              </div>
                        <div>
                          <p className="text-sm text-red-600 font-medium">Total Amount</p>
                          <p className="text-xl font-bold text-red-900">
                            {formatCurrency(sessionSummary.totalAmount)}
                          </p>
            </div>
                      </div>
                      {sessionSummary.lastOrderAt && (
                        <div className="mt-4 pt-4 border-t border-red-200">
                          <p className="text-sm text-red-600">
                            Last order: {formatDate(sessionSummary.lastOrderAt)}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Order Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-900">Order Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {orderHistory.map((order) => (
                          <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">Order #{order.orderNumber}</p>
                              <p className="text-sm text-gray-600">{formatDate(order.createdAt)}</p>
                              <Badge className={`mt-1 ${getStatusColor(order.status)}`}>
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </Badge>
              </div>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(parseFloat(order.total))}
                            </p>
            </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment Actions */}
                  {sessionSummary.totalAmount > 0 && (
                    <Card className="border border-green-200 bg-green-50">
                      <CardContent className="p-6">
                        <div className="text-center">
                          <p className="text-lg font-semibold text-green-900 mb-4">
                            Ready to pay? Call our staff for assistance
                          </p>
              <Button
                onClick={() => {
                              if (!customerName.trim()) {
                                setIsCallWaiterDialogOpen(true);
                                return;
                              }
                              
                              // Send specific bill request
                    sendMessage({
                      type: 'call-waiter',
                      payload: {
                        restaurantId: parseInt(restaurantId!),
                        tableId: parseInt(tableId!),
                                  tableSessionId: tableSessionId,
                                  customerName: customerName.trim(),
                                  requestType: 'bill-payment',
                        timestamp: new Date().toISOString()
                      }
                    });
                              
                    setWaiterRequestSent(true);
                              
                    toast({
                                title: "Bill Payment Requested",
                                description: "A staff member will help you with bill payment shortly",
                              });
                              
                              // Reset waiter request status after 3 minutes
                              setTimeout(() => {
                                setWaiterRequestSent(false);
                              }, 3 * 60 * 1000);
                }}
                disabled={waiterRequestSent}
                            className="bg-green-600 hover:bg-green-700 text-white"
              >
                            {waiterRequestSent ? "Waiter Coming" : "Request Bill Payment"}
              </Button>
                </div>
                      </CardContent>
                    </Card>
                  )}
              </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10,9 9,9 8,9"/>
                    </svg>
                        </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No orders to bill</h3>
                  <p className="text-gray-600 mb-4">Place your first order to see your bill summary</p>
                        <Button
                    onClick={() => setCurrentTab("menu")}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Browse Menu
                              </Button>
                            </div>
                          )}
                        </div>
          </TabsContent>
        </Tabs>

        {/* Floating Cart Button */}
        {cart.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom duration-500">
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6 py-4 shadow-2xl text-lg font-bold transition-all duration-500 transform hover:scale-105 hover:shadow-3xl group"
              onClick={() => setIsOrderingDialogOpen(true)}
            >
              <div className="flex items-center space-x-4 group-hover:scale-105 transition-transform duration-500">
                <div className="bg-white/20 rounded-full w-10 h-10 flex items-center justify-center border border-white/30 shadow-inner">
                  <span className="font-bold text-lg">{cartItemCount}</span>
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm text-white/80">Review Order</span>
                  <span className="text-lg">{formatCurrency(cartTotal)}</span>
                </div>
              </div>
            </Button>
          </div>
        )}

        {/* Order Dialog */}
        <Dialog open={isOrderingDialogOpen} onOpenChange={setIsOrderingDialogOpen}>
          <DialogContent className="bg-white border-gray-200 shadow-2xl max-w-md mx-auto">
            <DialogHeader className="space-y-3 pb-4 border-b border-gray-200">
              <DialogTitle className="text-2xl font-bold text-red-600">Review Your Order</DialogTitle>
              <p className="text-gray-600 font-medium">Table {tableId} • {restaurant?.name}</p>
            </DialogHeader>
            <div className="space-y-6 my-4">
              <div className="space-y-4">
                <div className="text-sm font-medium text-gray-600 mb-2">Order Items</div>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200 transition-all duration-300 hover:bg-red-100">
                      <div className="flex items-center space-x-3">
                        <div className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-mono text-sm">
                          {item.quantity}×
                        </div>
                        <span className="text-gray-900 font-medium">{item.name}</span>
                      </div>
                      <span className="text-gray-900 font-mono">{formatCurrency(parseFloat(item.price) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4 mt-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg text-gray-900 font-medium">Total Amount</span>
                  <span className="text-2xl font-bold text-red-600">
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter className="space-x-3">
              <Button
                onClick={() => setIsOrderingDialogOpen(false)}
                variant="outline"
                className="flex-1 border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-300"
              >
                Cancel
              </Button>
              <Button
                onClick={placeOrder}
                disabled={isSubmitting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all duration-300 hover:shadow-xl disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center space-x-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                    <span>Processing...</span>
                  </span>
                ) : (
                  "Place Order"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Order Success Dialog */}
        <Dialog open={isOrderSuccessDialogOpen} onOpenChange={setIsOrderSuccessDialogOpen}>
          <DialogContent className="bg-white border-gray-200 shadow-2xl max-w-md mx-auto">
            <div className="text-center space-y-6 py-4">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  Order Placed Successfully!
                </DialogTitle>
                <p className="text-gray-600">Your delicious meal will be prepared shortly.</p>
              </div>
              <Button 
                onClick={() => setIsOrderSuccessDialogOpen(false)}
                className="bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all duration-300 hover:shadow-xl px-8"
              >
                Great!
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Call Waiter Dialog */}
        <Dialog open={isCallWaiterDialogOpen} onOpenChange={setIsCallWaiterDialogOpen}>
          <DialogContent className="bg-white border-gray-200 shadow-2xl max-w-md mx-auto">
            <DialogHeader className="space-y-3 pb-4 border-b border-gray-200">
              <DialogTitle className="text-2xl font-bold text-red-600">
                Call Waiter
              </DialogTitle>
              <p className="text-gray-600">Please provide your name so our staff can assist you better</p>
            </DialogHeader>
            <div className="space-y-6 my-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">Your Name</label>
                <Input
                  placeholder="Enter your name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-12 border-2 border-gray-200 focus-visible:ring-red-500 focus-visible:border-red-500 transition-all duration-300 bg-gray-50"
                />
              </div>
            </div>
            <DialogFooter className="space-x-3">
              <Button
                onClick={() => setIsCallWaiterDialogOpen(false)}
                variant="outline"
                className="flex-1 border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-300"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (customerName.trim()) {
                    sendMessage({
                      type: 'call-waiter',
                      payload: {
                        restaurantId: parseInt(restaurantId!),
                        tableId: parseInt(tableId!),
                        customerName,
                        timestamp: new Date().toISOString()
                      }
                    });
                    setWaiterRequestSent(true);
                    setIsCallWaiterDialogOpen(false);
                    toast({
                      title: "Waiter Called",
                      description: "A waiter will be with you shortly",
                    });
                  } else {
                    toast({
                      title: "Name Required",
                      description: "Please enter your name",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={waiterRequestSent}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all duration-300 hover:shadow-xl disabled:opacity-50"
              >
                {waiterRequestSent ? "Waiter Called" : "Call Waiter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Item Modal */}
        <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
          <DialogContent className="bg-white border-gray-200 shadow-2xl max-w-md mx-auto">
            <DialogHeader className="space-y-3 pb-4">
              <DialogTitle className="text-2xl font-bold text-gray-900">{selectedItem?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 my-2">
              {selectedItem?.image && (
                <div className="w-full aspect-video rounded-xl overflow-hidden">
                  <img 
                    src={selectedItem.image} 
                    alt={selectedItem.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <p className="text-gray-600 text-sm leading-relaxed">
                {selectedItem?.description || "A delicious dish prepared with the finest ingredients."}
              </p>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="text-2xl font-bold text-red-600">
                  {selectedItem && formatCurrency(parseFloat(selectedItem.price))}
                </p>
              </div>
            </div>
            <DialogFooter className="space-x-3 mt-4">
              <Button 
                onClick={() => setIsItemModalOpen(false)} 
                variant="outline"
                className="flex-1 border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-300"
              >
                Close
              </Button>
              {selectedItem && (
                <Button
                  onClick={() => {
                    addToCart(selectedItem);
                    setIsItemModalOpen(false);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all duration-300 hover:shadow-xl"
                >
                  Add to Order
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}