import { useState } from "react";
import CartModal from "./components/CartModal";

const mockCategories = ["Sushi", "Rolls", "Sashimi", "Drinks"];
const mockMenu = [
  { id: 1, name: "Salmon Sushi", desc: "Fresh salmon over rice", price: 4.5, img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80", category: "Sushi" },
  { id: 2, name: "Tuna Roll", desc: "Classic tuna roll", price: 3.5, img: "https://images.unsplash.com/photo-1464306076886-debca5e8a6b0?auto=format&fit=crop&w=400&q=80", category: "Rolls" },
  { id: 3, name: "Ebi Sashimi", desc: "Shrimp sashimi", price: 5.0, img: "https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80", category: "Sashimi" },
  { id: 4, name: "Green Tea", desc: "Hot Japanese tea", price: 2.0, img: "https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=400&q=80", category: "Drinks" },
];

function Landing({ onSubmit }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required");
      return;
    }
    setError("");
    onSubmit({ name, phone, email });
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

function MenuUI({ user }) {
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-10 bg-white py-3 shadow-sm">
        <div className="text-lg font-bold text-center text-red-600">Hi, {user.name}!</div>
        <div className="flex gap-2 mt-2 overflow-x-auto px-2">
          {mockCategories.map((cat) => (
            <button
              key={cat}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${cat === category ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200'} transition`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 gap-4">
        {filteredMenu.map((item) => (
          <div key={item.id} className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
            <img src={item.img} alt={item.name} className="w-20 h-20 object-cover rounded-lg" />
            <div className="flex-1">
              <div className="font-bold text-lg text-gray-900">{item.name}</div>
              <div className="text-gray-500 text-sm mb-1">{item.desc}</div>
              <div className="font-semibold text-red-600">${item.price.toFixed(2)}</div>
            </div>
            <button
              className="bg-red-600 text-white rounded-full px-4 py-2 font-bold text-lg hover:bg-red-700 transition"
              onClick={() => addToCart(item)}
            >
              +
            </button>
          </div>
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
        <div className="fixed bottom-0 left-0 w-full bg-green-50 border-t border-green-200 p-6 flex flex-col items-center z-50 animate-in slide-in-from-bottom">
          <div className="text-green-700 font-bold text-lg mb-2">Order Placed!</div>
          <button
            className="bg-green-600 text-white px-6 py-3 rounded-full font-bold text-lg mt-2 shadow hover:bg-green-700"
            onClick={() => alert('Waiter will come to your table with the bill!')}
          >
            Request Bill
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Landing onSubmit={setUser} />;
  }

  return <MenuUI user={user} />;
}

export default App;
