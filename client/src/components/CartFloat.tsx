import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface CartFloatProps {
  onClick: () => void;
}

export default function CartFloat({ onClick }: CartFloatProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-20 right-4 z-50 rounded-full shadow-lg h-14 w-14 p-0"
    >
      <ShoppingCart className="h-6 w-6" />
    </Button>
  );
} 