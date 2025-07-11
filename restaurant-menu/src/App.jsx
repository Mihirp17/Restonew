import { useState, useEffect } from "react";
import { Routes, Route, useParams, useNavigate, useLocation } from "react-router-dom";
import CartModal from "./components/CartModal";
import MenuItemCard from "./components/MenuItemCard";
import CategoryTabs from "./components/CategoryTabs";
import OrderPlacedBill from "./components/OrderPlacedBill";

function QRMessage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-2xl font-bold mb-4 text-red-600">Scan the QR code on your table to start ordering.</h1>
      <p className="text-gray-600">This page is only accessible via the QR code provided at your restaurant table.</p>
    </div>
  );
}

function CustomerLanding({ onSubmit }) {
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

function MenuUI() {
  const { restaurantId, tableId } = useParams();
  const [userInfo, setUserInfo] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [tableSessionId, setTableSessionId] = useState(null);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("landing"); // landing or menu

  // After user info is submitted, create session and fetch menu
  useEffect(() => {
    if (!userInfo) return;
    async function createSessionAndFetchMenu() {
      setLoading(true);
      setError("");
      try {
        // 1. Create customer session
        const sessionRes = await fetch(`/api/public/restaurants/${restaurantId}/customer-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableNumber: parseInt(tableId),
            customerName: userInfo.name,
            customerEmail: userInfo.email || null,
            customerPhone: userInfo.phone || null
          })
        });
        if (!sessionRes.ok) throw new Error("Failed to create session");
        const sessionData = await sessionRes.json();
        setCustomerId(sessionData.customer.id);
        setTableSessionId(sessionData.session.id);

        // 2. Fetch menu
        const menuRes = await fetch(`/api/public/restaurants/${restaurantId}/menu-items`);
        if (!menuRes.ok) throw new Error("Failed to fetch menu");
        const menuData = await menuRes.json();
        setMenu(menuData);
        const cats = [...new Set(menuData.map(item => item.category || "Uncategorized"))];
        setCategories(cats);
        setCategory(cats[0] || "");
        setStep("menu");
      } catch (err) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    createSessionAndFetchMenu();
  }, [userInfo, restaurantId, tableId]);

  const filteredMenu = menu.filter((item) => item.category === category);
  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.price) * item.qty, 0);

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

  const placeOrder = async () => {
    if (!customerId || !tableSessionId || cart.length === 0) return;
    setLoading(true);
    setError("");
    try {
      // Fetch table sessions to get the correct table DB ID
      const sessionRes = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions`);
      if (!sessionRes.ok) throw new Error("Failed to fetch table session data");
      const sessions = await sessionRes.json();
      const currentSession = sessions.find((s) => s.id === tableSessionId);
      if (!currentSession || !currentSession.tableId) throw new Error("Table session not found");
      // Place order
      const orderData = {
        customerId,
        tableSessionId,
        orderNumber: `T${tableId.padStart(2, '0')}-${Date.now().toString().slice(-6)}`,
        status: "pending",
        total: cartTotal.toString(),
        restaurantId: parseInt(restaurantId),
        tableId: currentSession.tableId,
        notes: "",
        isGroupOrder: false,
        items: cart.map(item => ({ menuItemId: item.id, quantity: item.qty, price: item.price }))
      };
      const orderRes = await fetch(`/api/public/restaurants/${restaurantId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      if (!orderRes.ok) throw new Error("Failed to place order");
      setCart([]);
      setOrderPlaced(true);
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestBill = () => {
    alert('Waiter will come to your table with the bill!');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-lg">Loading...</div>;
  if (error) return <div className="flex min-h-screen items-center justify-center text-red-600">{error}</div>;

  if (step === "landing") {
    return <CustomerLanding onSubmit={setUserInfo} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-10 bg-white py-3 shadow-sm">
        <div className="text-lg font-bold text-center text-red-600">Table {tableId} • Restaurant {restaurantId}</div>
        <CategoryTabs categories={categories} selected={category} onSelect={setCategory} />
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
      <Route path="/" element={<QRMessage />} />
    </Routes>
  );
}

export default App;
