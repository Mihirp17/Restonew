import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";

interface TableSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TableSessionModal({ open, onOpenChange }: TableSessionModalProps) {
  const { restaurantId, tableNumber, setSession, setCustomer } = useRestaurant();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // First, check for existing active sessions
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
          onOpenChange(false);
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
          // Table already has active session - try to join it
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
      onOpenChange(false);
      toast({ title: "Welcome!", description: `Welcome ${name}! Your table session is ready.` });
    } catch (error: any) {
      console.error("Error creating session:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to start session. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-black">Welcome to Our Restaurant</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
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
      </DialogContent>
    </Dialog>
  );
} 