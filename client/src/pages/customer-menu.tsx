import { useEffect, useState } from "react";
import { useParams } from "wouter";
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
import { History, Receipt, Star } from "lucide-react";
import type { MenuCategory, MenuItem } from "@shared/schema";

export default function CustomerMenu() {
  const params = useParams();
  const { 
    restaurantId, 
    tableNumber, 
    restaurant, 
    session, 
    customer,
    setRestaurantId, 
    setTableNumber,
    isLoading: restaurantLoading 
  } = useRestaurant();
  
  const { itemCount } = useCart();
  
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
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

  // Show session modal if no customer is registered
  useEffect(() => {
    if (restaurantId && tableNumber && !customer) {
      setShowSessionModal(true);
    }
  }, [restaurantId, tableNumber, customer]);

  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ["/api/public/restaurants", restaurantId, "menu-items"],
    enabled: !!restaurantId,
  });

  if (restaurantLoading || menuLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (!restaurant || !menuData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Restaurant not found</p>
        </div>
      </div>
    );
  }

  const categories: MenuCategory[] = menuData.categories || [];
  const filteredItems = selectedCategory 
    ? categories.find(cat => cat.id === selectedCategory)?.items || []
    : menuData.allItems || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3">
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
                <h1 className="text-lg font-bold text-gray-900">{restaurant.name}</h1>
                {tableNumber && (
                  <p className="text-xs text-gray-500">Table {tableNumber}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOrderHistory(true)}
                className="p-2"
              >
                <History className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBillView(true)}
                className="p-2"
              >
                <Receipt className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="bg-white border-b border-gray-100">
          <div className="flex overflow-x-auto px-4 py-3 space-x-2 scrollbar-hide">
            <Button
              variant={selectedCategory === null ? "default" : "secondary"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="flex-shrink-0 rounded-full"
            >
              All Items
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "secondary"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="flex-shrink-0 rounded-full"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <main className="px-4 py-4 pb-32">
        {selectedCategory === null ? (
          // Show all categories with their items
          categories.map((category) => (
            <div key={category.id} className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{category.name}</h2>
              <div className="space-y-4">
                {category.items?.map((item: MenuItem) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))
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