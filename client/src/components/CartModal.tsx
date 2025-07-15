import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Minus, Plus, Trash2 } from "lucide-react";

interface CartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CartModal({ open, onOpenChange }: CartModalProps) {
  const { items, removeItem, updateQuantity, clearCart, subtotal, tax, total } = useCart();
  const { restaurantId, session, customer } = useRestaurant();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to your cart before placing an order",
        variant: "destructive",
      });
      return;
    }

    if (!session || !customer) {
      toast({
        title: "No Session",
        description: "Please start a table session first",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const orderResponse = await fetch(`/api/public/restaurants/${restaurantId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          tableSessionId: session.id,
          notes: "Customer order", // Add any general notes if needed
          items: items.map(item => ({
            menuItemId: item.menuItem.id,
            quantity: item.quantity,
            price: parseFloat(item.menuItem.price),
            notes: item.notes,
          })),
        }),
      });

      if (!orderResponse.ok) throw new Error("Failed to place order");
      
      const order = await orderResponse.json();
      clearCart();
      onOpenChange(false);

      toast({
        title: "Order Placed!",
        description: `Your order #${order.orderNumber} has been submitted`,
      });
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
        title: "Error",
        description: "Failed to place order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Your Cart</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Your cart is empty</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.menuItem.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                {item.menuItem.image && (
                  <img
                    src={item.menuItem.image}
                    alt={item.menuItem.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{item.menuItem.name}</h4>
                  <p className="text-sm text-gray-600">${item.menuItem.price}</p>
                  {item.notes && (
                    <p className="text-xs text-gray-500">Note: {item.notes}</p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.menuItem.id)}
                    className="h-8 w-8 p-0 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {items.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax:</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={clearCart}
                className="flex-1"
              >
                Clear Cart
              </Button>
              <Button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Placing Order..." : "Place Order"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 