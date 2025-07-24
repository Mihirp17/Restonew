import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language-context";

interface TableSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TableSessionModal({ open, onOpenChange }: TableSessionModalProps) {
  const { restaurantId, tableNumber, setSession, setCustomer } = useRestaurant();
  const { toast } = useToast();
  const { t } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: t('customerEntry.toast.errorTitle'),
        description: t('customerEntry.toast.nameRequired'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Check for existing active session first
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
            throw new Error(t('customerEntry.toast.sessionJoinFailed'));
          }
          
          const customer = await customerResponse.json();
          setSession(activeSession);
          setCustomer(customer);
          onOpenChange(false);
          
          toast({
            title: t('customerEntry.toast.joinedSessionTitle'),
            description: t('customerEntry.toast.joinedSessionDescription', { name }),
          });
          return;
        }
      }

      // Create new table session
      const sessionResponse = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: parseInt(tableNumber!),
          partySize: 1,
          status: "waiting",
        }),
      });

      if (!sessionResponse.ok) throw new Error(t('customerEntry.toast.sessionCreateFailed'));
      const session = await sessionResponse.json();

      // Create customer
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

      if (!customerResponse.ok) throw new Error(t('customerEntry.toast.customerCreateFailed'));
      const customer = await customerResponse.json();

      setSession(session);
      setCustomer(customer);
      onOpenChange(false);

      toast({
        title: t('customerEntry.toast.welcomeTitle'),
        description: t('customerEntry.toast.welcomeDescription', { name }),
      });
    } catch (error) {
      console.error("Error creating session:", error);
      toast({
        title: t("tableSession.error.title"),
        description: t("tableSession.error.failedToStart"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('welcome')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">{t('customerEntry.nameLabel')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('customerEntry.namePlaceholder')}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="email">{t('customerEntry.emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('customerEntry.emailPlaceholder')}
            />
          </div>
          
          <div>
            <Label htmlFor="phone">{t('customerEntry.phoneLabel')}</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('customerEntry.phonePlaceholder')}
            />
          </div>
          
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? t('customerEntry.submitButton.submitting') : t('customerEntry.submitButton.default')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
