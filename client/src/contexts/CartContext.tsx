import { createContext, useContext, useState, useEffect } from "react";
import type { MenuItem } from "@shared/schema";

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (menuItem: MenuItem, quantity?: number, notes?: string) => void;
  removeItem: (menuItemId: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const addItem = (menuItem: MenuItem, quantity = 1, notes?: string) => {
    setItems(current => {
      const existingIndex = current.findIndex(item => item.menuItem.id === menuItem.id);
      
      if (existingIndex >= 0) {
        const updated = [...current];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
          notes: notes || updated[existingIndex].notes
        };
        return updated;
      } else {
        return [...current, { menuItem, quantity, notes }];
      }
    });
  };

  const removeItem = (menuItemId: number) => {
    setItems(current => current.filter(item => item.menuItem.id !== menuItemId));
  };

  const updateQuantity = (menuItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    
    setItems(current => {
      const updated = [...current];
      const index = updated.findIndex(item => item.menuItem.id === menuItemId);
      if (index >= 0) {
        updated[index] = { ...updated[index], quantity };
      }
      return updated;
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.menuItem.price) * item.quantity), 0);
  const tax = subtotal * 0.08875; // 8.875% tax
  const total = subtotal + tax;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        tax,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
} 