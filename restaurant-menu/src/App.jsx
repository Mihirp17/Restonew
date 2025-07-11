import { useState } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import CartModal from "./components/CartModal";
import MenuItemCard from "./components/MenuItemCard";
import CategoryTabs from "./components/CategoryTabs";
import OrderPlacedBill from "./components/OrderPlacedBill";

const mockCategories = ["Sushi", "Rolls", "Sashimi", "Drinks"];
const mockMenu = [
  { id: 1, name: "Salmon Sushi", desc: "Fresh salmon over rice", price: 4.5, img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80", category: "Sushi" },
  { id: 2, name: "Tuna Roll", desc: "Classic tuna roll", price: 3.5, img: "https://images.unsplash.com/photo-1464306076886-debca5e8a6b0?auto=format&fit=crop&w=400&q=80", category: "Rolls" },
  { id: 3, name: "Ebi Sashimi", desc: "Shrimp sashimi", price: 5.0, img: "https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80", category: "Sashimi" },
  { id: 4, name: "Green Tea", desc: "Hot Japanese tea", price: 2.0, img: "https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=400&q=80", category: "Drinks" },
];

function Landing() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required");
      return;
    }
    setError("");
    // For demo, use dummy restaurantId/tableId
    navigate("/menu/1/1", { state: { name, phone, email } });
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white px-4">
      <div className="w-full max-w-xs">
        <h1 className="text-3xl font-bold text-center mb-6 text-red-600">Welcome!</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-400 outline-none"
            placeholder="Your Name*"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <input
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-400 outline-none"
            placeholder="Phone Number*"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
          <input
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-400 outline-none"
            placeholder="Email (optional)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
          />
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-red-700 transition"
          >
            Start Ordering
          </button>
        </form>
      </div>
    </div>
  );
}

function MenuUI() {
  const { restaurantId, tableId } = useParams();
  // TODO: Use location.state for user info if needed
  const [category, setCategory] = useState(mockCategories[0]);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const filteredMenu = mockMenu.filter((item) => item.category === category);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const addToCart = (item) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === item.id);
      if (found) {
        return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const placeOrder = () => {
    setOrderPlaced(true);
    setShowCart(false);
    setCart([]);
  };

  const handleRequestBill = () => {
    alert('Waiter will come to your table with the bill!');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-10 bg-white py-3 shadow-sm">
        <div className="text-lg font-bold text-center text-red-600">Table {tableId} • Restaurant {restaurantId}</div>
        <CategoryTabs categories={mockCategories} selected={category} onSelect={setCategory} />
      </div>
      <div className="p-4 grid grid-cols-1 gap-4">
        {filteredMenu.map((item) => (
          <MenuItemCard key={item.id} item={item} onAdd={addToCart} />
        ))}
      </div>
      {/* Floating Cart Button */}
      {cart.length > 0 && !orderPlaced && (
        <button
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white rounded-full px-8 py-4 shadow-lg text-lg font-bold z-50 flex items-center gap-3"
          onClick={() => setShowCart(true)}
        >
          <span>View Cart</span>
          <span className="bg-white text-red-600 rounded-full px-3 py-1 font-bold">{cart.length}</span>
          <span className="ml-2">${cartTotal.toFixed(2)}</span>
        </button>
      )}
      {/* Cart Modal */}
      {showCart && (
        <CartModal
          cart={cart}
          onRemove={removeFromCart}
          onClose={() => setShowCart(false)}
          onPlaceOrder={placeOrder}
          cartTotal={cartTotal}
        />
      )}
      {/* Order Placed & Request Bill */}
      {orderPlaced && (
        <OrderPlacedBill onRequestBill={handleRequestBill} />
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/menu/:restaurantId/:tableId" element={<MenuUI />} />
      <Route path="/" element={<Landing />} />
    </Routes>
  );
}

export default App;
