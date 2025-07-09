import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMenu, MenuItem } from "@/hooks/use-menu";
import { formatCurrency } from "@/lib/utils";

export default function MenuCheckout() {
  const { restaurantId, tableId } = useParams<{ restaurantId: string; tableId: string }>();
  const [customerName, setCustomerName] = useState("");
  const [isNameSubmitted, setIsNameSubmitted] = useState(false);
  const [cart, setCart] = useState<MenuItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const { menuItems: fetchedMenuItems } = useMenu(Number(restaurantId)) as { menuItems: MenuItem[] };

  useEffect(() => {
    if (fetchedMenuItems) {
      setMenuItems(fetchedMenuItems);
    }
  }, [fetchedMenuItems]);

  const addToCart = (item: MenuItem) => {
    setCart((prevCart) => [...prevCart, item]);
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + parseFloat(item.price), 0);
  };

  if (!isNameSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Welcome! What's your name?</h1>
        <Input
          placeholder="Enter your name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="mb-4"
        />
        <Button
          onClick={() => setIsNameSubmitted(true)}
          disabled={!customerName.trim()}
        >
          Submit
        </Button>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Menu</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg p-4 shadow hover:shadow-lg transition"
            >
              <h2 className="text-lg font-bold">{item.name}</h2>
              <p className="text-sm text-gray-500">{item.description}</p>
              <p className="text-sm font-bold">{formatCurrency(item.price)}</p>
              <Button onClick={() => addToCart(item)} className="mt-2">
                Add to Cart
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Checkout</h1>
      <ul className="mb-4">
        {cart.map((item, index) => (
          <li key={index} className="flex justify-between">
            <span>{item.name}</span>
            <span>{formatCurrency(item.price)}</span>
          </li>
        ))}
      </ul>
      <h2 className="text-lg font-bold">Total: {formatCurrency(calculateTotal())}</h2>
      <Button className="mt-4">Confirm Order</Button>
    </div>
  );
}
