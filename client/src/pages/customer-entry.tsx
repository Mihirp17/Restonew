import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CustomerEntry() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { 
    restaurantId, 
    tableNumber, 
    restaurant, 
    setRestaurantId, 
    setTableNumber, 
    setSession, 
    setCustomer,
    isHydrating,
    session,
    customer
  } = useRestaurant();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Set context from URL params
  useEffect(() => {
    if (params.restaurantId && params.tableId) {
      setRestaurantId(parseInt(params.restaurantId));
      setTableNumber(params.tableId);
    }
  }, [params, setRestaurantId, setTableNumber]);

  // If already registered, redirect to menu
  useEffect(() => {
    if (!isHydrating && restaurantId && tableNumber && restaurant) {
      // If customer is already set, redirect
      if (localStorage.getItem("customer")) {
        navigate(`/menu/${restaurantId}/${tableNumber}`);
      }
    }
  }, [isHydrating, restaurantId, tableNumber, restaurant, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      // Check for existing active session
      const existingSessionsResponse = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions?tableId=${tableNumber}`);
      if (existingSessionsResponse.ok) {
        const existingSessions = await existingSessionsResponse.json();
        const activeSession = existingSessions.find((s: any) => s.tableId === parseInt(tableNumber!) && ['waiting', 'active'].includes(s.status));
        if (activeSession) {
          // Join existing session
          const customerResponse = await fetch(`/api/public/restaurants/${restaurantId}/customers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tableSessionId: activeSession.id,
              name: name.trim(),
              email: email.trim() || null,
              phone: phone.trim() || null,
              isMainCustomer: false,
            }),
          });
          if (!customerResponse.ok) {
            const errorData = await customerResponse.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to join session");
          }
          const customer = await customerResponse.json();
          setSession(activeSession);
          setCustomer(customer);
          setShouldRedirect(true);
          toast({ title: "Joined Table Session!", description: `Welcome ${name}! You've joined the table session.` });
          return;
        }
      }
      // Create new session
      const sessionResponse = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: parseInt(tableNumber!),
          tableNumber: tableNumber,
          partySize: 1,
          status: "waiting",
        }),
      });
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        if (sessionResponse.status === 409) {
          toast({ title: "Table Occupied", description: "This table is already in use. Please try again.", variant: "destructive" });
          return;
        }
        throw new Error(errorData.message || "Failed to create session");
      }
      const session = await sessionResponse.json();
      // Create main customer
      const customerResponse = await fetch(`/api/public/restaurants/${restaurantId}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableSessionId: session.id,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          isMainCustomer: true,
        }),
      });
      if (!customerResponse.ok) {
        const errorData = await customerResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create customer");
      }
      const customer = await customerResponse.json();
      setSession(session);
      setCustomer(customer);
      setShouldRedirect(true);
      toast({ title: "Welcome!", description: `Welcome ${name}! Your table session is ready.` });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to start session. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Wait for context to update before navigating
  useEffect(() => {
    if (shouldRedirect && customer && session) {
      navigate(`/menu/${restaurantId}/${tableNumber}`);
    }
  }, [shouldRedirect, customer, session, navigate, restaurantId, tableNumber]);

  if (isHydrating || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      {restaurant.logo && (
        <img
          src={restaurant.logo}
          alt={`${restaurant.name} logo`}
          className="w-20 h-20 rounded-full object-cover mb-4 shadow"
        />
      )}
      <h1 className="text-3xl font-bold text-red-700 mb-2">{restaurant.name}</h1>
      <p className="text-lg text-gray-700 mb-8">Welcome! Please enter your details to start ordering.</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6 border border-gray-100">
        <div>
          <Label htmlFor="name" className="font-medium text-black">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="rounded-lg bg-gray-100 mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="email" className="font-medium text-black">Email (optional)</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="rounded-lg bg-gray-100 mt-1"
          />
        </div>
        <div>
          <Label htmlFor="phone" className="font-medium text-black">Phone (optional)</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter your phone number"
            className="rounded-lg bg-gray-100 mt-1"
          />
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white rounded-lg hover:bg-red-700">
          {isSubmitting ? "Starting..." : "Start Ordering"}
        </Button>
      </form>
    </div>
  );
} 