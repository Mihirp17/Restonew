import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Plus, Minus, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MenuItem } from "@shared/schema";

interface MenuItemCardProps {
  item: MenuItem;
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
  const { addItem, removeItem, getItemQuantity } = useCart();
  const { toast } = useToast();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const quantity = getItemQuantity(item.id);

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      addItem(item);
      toast({
        title: "Added to cart",
        description: `${item.name} has been added to your cart`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item to cart",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFromCart = () => {
    removeItem(item.id);
    if (quantity === 1) {
      toast({
        title: "Removed from cart",
        description: `${item.name} has been removed from your cart`,
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center space-x-4 p-4">
        {item.image ? (
          <img 
            src={item.image} 
            alt={item.name}
            className="w-16 h-16 rounded-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-red-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 11h18"/>
              <path d="M12 11v8"/>
              <path d="M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
            </svg>
          </div>
        )}
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-black group-hover:text-red-600 transition-colors">{item.name}</h3>
              {item.category && (
                <Badge className="bg-red-100 text-red-600 text-xs mt-1">{item.category}</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`text-gray-400 hover:text-red-600 ${isFavorite ? "text-red-600" : ""}`}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-1">{item.description || "Delicious dish prepared with care"}</p>
          <div className="flex justify-between items-center mt-2">
            <span className="text-lg font-bold text-red-600">{formatCurrency(parseFloat(item.price))}</span>
            {quantity > 0 ? (
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleRemoveFromCart}
                  size="sm"
                  variant="outline"
                  className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:text-red-600"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-sm font-bold text-black">{quantity}</span>
                <Button
                  onClick={handleAddToCart}
                  size="sm"
                  variant="outline"
                  disabled={isAdding || !item.isAvailable}
                  className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:text-red-600"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleAddToCart}
                disabled={isAdding || !item.isAvailable}
                className="bg-red-600 text-white rounded-full px-4 py-2 hover:bg-red-700"
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 