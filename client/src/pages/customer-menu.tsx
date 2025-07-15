import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useCart } from "@/contexts/CartContext";
import MenuItemCard from "@/components/MenuItemCard";
import CartFloat from "@/components/CartFloat";
import TableSessionModal from "@/components/TableSessionModal";
import CartModal from "@/components/CartModal";
import OrderHistory from "@/components/OrderHistory";
import BillView from "@/components/BillView";
import FeedbackModal from "@/components/FeedbackModal";
import BottomNavigation from "@/components/BottomNavigation";
import { Button } from "@/components/ui/button";
import { History, Receipt, Search } from "lucide-react";
import type { MenuItem } from "@shared/schema";

export default function CustomerMenu() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { 
    restaurantId, 
    tableNumber, 
    restaurant, 
    session, 
    customer,
    setRestaurantId, 
    setTableNumber,
    isLoading: restaurantLoading,
    isHydrating
  } = useRestaurant();
  
  const { itemCount } = useCart();
  
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showBillView, setShowBillView] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    if (params.restaurantId && params.tableId) {
      setRestaurantId(parseInt(params.restaurantId));
      setTableNumber(params.tableId);
    } else if (!restaurantId) {
      // Default for demo - in production this would come from QR scan
      setRestaurantId(1);
      setTableNumber("12");
    }
  }, [params, restaurantId, setRestaurantId, setTableNumber]);

  // Show session modal if no customer is registered, but only after hydration
  useEffect(() => {
    if (!isHydrating && restaurantId && tableNumber && !customer) {
      setShowSessionModal(true);
    }
  }, [isHydrating, restaurantId, tableNumber, customer]);

  // Redirect to entry page if the customer or session is not set
  useEffect(() => {
    if (!isHydrating && !customer && !session) {
      navigate(`/menu/${params.restaurantId}/${params.tableId}/entry`);
    }
  }, [isHydrating, customer, session, params, navigate]);

  const { data: menuResponse, isLoading: menuLoading } = useQuery({
    queryKey: [`/api/public/restaurants/${restaurantId}/menu-items`],
    enabled: !!restaurantId,
  });

  if (restaurantLoading || menuLoading || isHydrating) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (!restaurant || !menuResponse) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Restaurant not found</p>
        </div>
      </div>
    );
  }

  // Get menu data from the API response
  const menuData: MenuItem[] = (menuResponse as any)?.allItems || [];
  const categories: string[] = [...new Set(menuData.map((item: MenuItem) => item.category || "Other"))];
  const filteredItems = selectedCategory === "all" 
    ? menuData 
    : menuData.filter((item: MenuItem) => (item.category || "Other") === selectedCategory);

  return (
    <div className="min-h-screen bg-white">
      {/* Session Info Bar - Show when session is active and has multiple potential customers */}
      {session && customer && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Session #{session.id}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                session.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                session.status === 'active' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {session.status === 'waiting' ? 'Place first order to activate' : 
                 session.status === 'active' ? 'Session Active' : 
                 session.status}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Logged in as: {customer.name}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-red-600 sticky top-0 z-40 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {restaurant.logo && (
              <img 
                src={restaurant.logo} 
                alt={`${restaurant.name} logo`}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-xl font-bold text-black">Hello, {customer?.name || "Guest"}! 😊</h1>
              <div className="flex items-center space-x-3 text-sm text-red-600">
                {tableNumber && (
                  <span>Table {tableNumber}</span>
                )}
                {session && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    session.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                    session.status === 'active' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {session.status === 'waiting' ? 'Waiting' : 
                     session.status === 'active' ? 'Active' : 
                     session.status}
                  </span>
                )}
                {customer && (
                  <span className="text-xs">Welcome, {customer.name}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!customer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSessionModal(true)}
                className="text-red-600 border-red-600 rounded-full"
              >
                Join Session
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowOrderHistory(true)} className="text-red-600">
              <History className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowBillView(true)} className="text-red-600">
              <Receipt className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="mt-4 flex items-center bg-gray-100 rounded-full px-4 py-2">
          <Search className="h-4 w-4 text-gray-600 mr-2" />
          <input
            type="text"
            placeholder="Enter a dish"
            className="bg-transparent w-full outline-none text-gray-600"
          />
        </div>
      </header>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="bg-white sticky top-[120px] z-30 px-4 py-3">
          <div className="flex overflow-x-auto space-x-2 scrollbar-hide">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full ${selectedCategory === "all" ? "bg-red-600 text-white" : "border-gray-200 text-gray-600"}`}
            >
              All Items
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full ${selectedCategory === category ? "bg-red-600 text-white" : "border-gray-200 text-gray-600"}`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <main className="px-4 py-6 pb-32">
        {selectedCategory === "all" ? (
          // Show all categories with their items
          categories.map((category) => {
            const categoryItems = menuData.filter((item: MenuItem) => (item.category || "Other") === category);
            if (categoryItems.length === 0) return null;
            
            return (
              <div key={category} className="mb-8">
                <h2 className="text-lg font-bold text-black mb-4">{category}</h2>
                <div className="space-y-4">
                  {categoryItems.map((item: MenuItem) => (
                    <MenuItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Show filtered items
          <div className="space-y-4">
            {filteredItems.map((item: MenuItem) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
        
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No items available in this category</p>
          </div>
        )}
      </main>

      {/* Cart Float */}
      {itemCount > 0 && (
        <CartFloat onClick={() => setShowCartModal(true)} />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation
        onShowOrderHistory={() => setShowOrderHistory(true)}
        onShowBill={() => setShowBillView(true)}
        onShowFeedback={() => setShowFeedbackModal(true)}
      />

      {/* Modals */}
      <TableSessionModal 
        open={showSessionModal} 
        onOpenChange={setShowSessionModal}
      />
      
      <CartModal 
        open={showCartModal} 
        onOpenChange={setShowCartModal}
      />
      
      <OrderHistory 
        open={showOrderHistory} 
        onOpenChange={setShowOrderHistory}
      />
      
      <BillView 
        open={showBillView} 
        onOpenChange={setShowBillView}
      />
      
      <FeedbackModal 
        open={showFeedbackModal} 
        onOpenChange={setShowFeedbackModal}
      />
    </div>
  );
}
