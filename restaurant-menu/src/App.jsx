import { useState } from "react";

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

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Landing onSubmit={setUser} />;
  }

  // Placeholder for the main menu UI
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h2 className="text-2xl font-bold mb-4">Menu UI Coming Next...</h2>
      <div className="text-gray-600">Welcome, {user.name}!</div>
    </div>
  );
}

export default App;
