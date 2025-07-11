import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Plus, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MenuItem } from "@shared/schema";

interface MenuItemCardProps {
  item: MenuItem;
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex">
        {item.image && (
          <img 
            src={item.image} 
            alt={item.name}
            className="w-24 h-24 object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">
              {item.name}
            </h3>
            <span className="text-lg font-bold text-primary ml-2 flex-shrink-0">
              ${item.price}
            </span>
          </div>
          
          {item.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {item.description}
            </p>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {item.prepTime && (
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  {item.prepTime}min
                </div>
              )}
            </div>
            
            <Button
              onClick={handleAddToCart}
              disabled={isAdding || !item.available}
              size="sm"
              className="flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 