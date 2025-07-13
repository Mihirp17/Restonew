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
  getItemQuantity: (menuItemId: number) => number;
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
    setItems(current => {
      const existingIndex = current.findIndex(item => item.menuItem.id === menuItemId);
      
      if (existingIndex >= 0) {
        const updated = [...current];
        if (updated[existingIndex].quantity > 1) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity - 1
          };
          return updated;
        } else {
          return current.filter(item => item.menuItem.id !== menuItemId);
        }
      }
      return current;
    });
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

  const getItemQuantity = (menuItemId: number) => {
    const item = items.find(item => item.menuItem.id === menuItemId);
    return item ? item.quantity : 0;
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.menuItem.price) * item.quantity), 0);
  const tax = 0; // Tax is inclusive in Barcelona prices
  const total = subtotal; // Total equals subtotal since tax is inclusive

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        getItemQuantity,
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