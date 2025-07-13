import { useCart } from "@/contexts/CartContext";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface CartFloatProps {
  onClick: () => void;
}

export default function CartFloat({ onClick }: CartFloatProps) {
  const { itemCount, total } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-500">
      <Button 
        className="bg-red-600 hover:bg-red-700 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:scale-105 transition-all"
        onClick={onClick}
      >
        <div className="relative">
          <ShoppingCart className="h-5 w-5" />
          <span className="absolute -top-2 -right-2 bg-white text-red-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
            {itemCount}
          </span>
        </div>
      </Button>
      <span className="absolute bottom-16 right-0 text-white text-lg font-bold">{formatCurrency(total)}</span>
    </div>
  );
} 