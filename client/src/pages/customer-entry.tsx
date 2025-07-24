import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/contexts/language-context";
import LanguageSelector from "@/components/ui/language-selector";

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
  const { t } = useLang();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shouldNavigate, setShouldNavigate] = useState(false);

  // Navigate when customer is set and shouldNavigate is true
  useEffect(() => {
    if (shouldNavigate && customer && session) {
      console.log("Customer and session are set, navigating to menu");
      navigate(`/menu/${restaurantId}/${tableNumber}`);
      setShouldNavigate(false);
    }
  }, [customer, session, shouldNavigate, navigate, restaurantId, tableNumber]);

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
      // Always require customer entry - don't check localStorage
      // This ensures fresh customer details are entered each time
    }
  }, [isHydrating, restaurantId, tableNumber, restaurant, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: t('customerEntry.toast.errorTitle'), description: t('customerEntry.toast.nameRequired'), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      // Check for existing active session
      const existingSessionsResponse = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions?tableNumber=${tableNumber}`);
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
          toast({ title: t('customerEntry.toast.joinedSessionTitle'), description: t('customerEntry.toast.joinedSessionDescription', { name }) });
          
          // Trigger navigation after context is set
          console.log("Setting shouldNavigate to true (join session)");
          setShouldNavigate(true);
          return;
        }
      }
      // Create new session
      const parsedTableNumber = Number(tableNumber);
      if (!parsedTableNumber || isNaN(parsedTableNumber)) {
        toast({ title: t('customerEntry.toast.errorTitle'), description: t('customerEntry.toast.invalidTable'), variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      const sessionResponse = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: parsedTableNumber,
          partySize: 1,
          status: "waiting",
        }),
      });
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        if (sessionResponse.status === 409) {
          toast({ title: t('customerEntry.toast.tableOccupiedTitle'), description: t('customerEntry.toast.tableOccupiedDescription'), variant: "destructive" });
          return;
        }
        throw new Error(errorData.message || t('customerEntry.toast.sessionCreateFailed'));
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
        throw new Error(errorData.message || t('customerEntry.toast.customerCreateFailed'));
      }
      const customer = await customerResponse.json();
      setSession(session);
      setCustomer(customer);
      toast({ title: t('customerEntry.toast.welcomeTitle'), description: t('customerEntry.toast.welcomeDescription', { name }) });
      
      // Trigger navigation after context is set
      console.log("Setting shouldNavigate to true (new session)");
      setShouldNavigate(true);
    } catch (error: any) {
      toast({ 
        title: t('customerEntry.toast.errorTitle'), 
        description: error.message || t('customerEntry.toast.startSessionFailed'), 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isHydrating || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('customerEntry.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      {restaurant.logo && (
        <img
          src={restaurant.logo}
          alt={`${restaurant.name} logo`}
          className="w-20 h-20 rounded-full object-cover mb-4 shadow"
        />
      )}
      <h1 className="text-3xl font-bold text-red-700 mb-2">{restaurant.name}</h1>
      <p className="text-lg text-gray-700 mb-8">{t('customerEntry.welcomeMessage')}</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6 border border-gray-100">
        <div>
          <Label htmlFor="name" className="font-medium text-black">{t('customerEntry.nameLabel')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('customerEntry.namePlaceholder')}
            className="rounded-lg bg-gray-100 mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="email" className="font-medium text-black">{t('customerEntry.emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('customerEntry.emailPlaceholder')}
            className="rounded-lg bg-gray-100 mt-1"
          />
        </div>
        <div>
          <Label htmlFor="phone" className="font-medium text-black">{t('customerEntry.phoneLabel')}</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('customerEntry.phonePlaceholder')}
            className="rounded-lg bg-gray-100 mt-1"
          />
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white rounded-lg hover:bg-red-700">
          {isSubmitting ? t('customerEntry.submitButton.submitting') : t('customerEntry.submitButton.default')}
        </Button>
      </form>
    </div>
  );
}
