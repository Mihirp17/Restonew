import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Bell, Users, User, Calculator } from "lucide-react";
import { useLang } from "@/contexts/language-context";

interface BillRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BillRequestModal({ open, onOpenChange }: BillRequestModalProps) {
  const { restaurantId, session, customer } = useRestaurant();
  const { toast } = useToast();
  const { t } = useLang();
  const [requestType, setRequestType] = useState<'individual' | 'table' | 'partial'>('individual');
  const [isRequesting, setIsRequesting] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');

  const handleRequestBill = async () => {
    if (!session || !customer || !restaurantId) {
      toast({ title: t('billRequest.toast.noSession.title'), description: t('billRequest.toast.noSession.description'), variant: "destructive" });
      return;
    }

    setIsRequesting(true);
    try {
      const response = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions/${session.id}/request-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          customerName: customer.name,
          requestType,
          specialRequests: specialRequests.trim() || undefined
        })
      });

      if (response.ok) {
        toast({ title: t('billRequest.toast.success.title'), description: t('billRequest.toast.success.description') });
        onOpenChange(false);
        setSpecialRequests('');
      } else {
        throw new Error(t('billRequest.toast.failed.description'));
      }
    } catch (error) {
      console.error("Error requesting bill:", error);
      toast({ title: t('billRequest.toast.failed.title'), description: t('billRequest.toast.failed.description'), variant: "destructive" });
    } finally {
      setIsRequesting(false);
    }
  };

  const getBillTypeIcon = (type: string) => {
    switch (type) {
      case 'individual': return <User className="h-5 w-5 text-red-600" />;
      case 'table': return <Users className="h-5 w-5 text-red-600" />;
      case 'partial': return <Calculator className="h-5 w-5 text-red-600" />;
      default: return null;
    }
  };

  const getBillTypeDescription = (type: string) => {
    switch (type) {
      case 'individual': return t('billRequest.type.myBill.description');
      case 'table': return t('billRequest.type.tableBill.description');
      case 'partial': return t('billRequest.type.customSplit.description');
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-lg font-bold text-black">
            <Bell className="h-5 w-5 text-red-600" />
            <span>{t('billRequest.title')}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-4">
          <div>
            <h4 className="text-sm font-medium text-black mb-3">{t('billRequest.type.question')}</h4>
            <RadioGroup value={requestType} onValueChange={(value) => setRequestType(value as any)}>
              <Card className={`rounded-lg ${requestType === 'individual' ? 'ring-2 ring-[#ba1d1d]' : ''}`}>
                <CardContent className="p-4 flex items-center space-x-3">
                  <RadioGroupItem value="individual" id="individual" />
                  <Label htmlFor="individual" className="flex-1 flex items-center space-x-3 cursor-pointer">
                    {getBillTypeIcon('individual')}
                    <div>
                      <div className="font-medium text-black">{t('billRequest.type.myBill')}</div>
                      <div className="text-sm text-gray-600">{getBillTypeDescription('individual')}</div>
                    </div>
                  </Label>
                </CardContent>
              </Card>
              <Card className={`rounded-lg ${requestType === 'table' ? 'ring-2 ring-[#ba1d1d]' : ''}`}>
                <CardContent className="p-4 flex items-center space-x-3">
                  <RadioGroupItem value="table" id="table" />
                  <Label htmlFor="table" className="flex-1 flex items-center space-x-3 cursor-pointer">
                    {getBillTypeIcon('table')}
                    <div>
                      <div className="font-medium text-black">{t('billRequest.type.tableBill')}</div>
                      <div className="text-sm text-gray-600">{getBillTypeDescription('table')}</div>
                    </div>
                  </Label>
                </CardContent>
              </Card>
              <Card className={`rounded-lg ${requestType === 'partial' ? 'ring-2 ring-[#ba1d1d]' : ''}`}>
                <CardContent className="p-4 flex items-center space-x-3">
                  <RadioGroupItem value="partial" id="partial" />
                  <Label htmlFor="partial" className="flex-1 flex items-center space-x-3 cursor-pointer">
                    {getBillTypeIcon('partial')}
                    <div>
                      <div className="font-medium text-black">{t('billRequest.type.customSplit')}</div>
                      <div className="text-sm text-gray-600">{getBillTypeDescription('partial')}</div>
                    </div>
                  </Label>
                </CardContent>
              </Card>
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="special-requests" className="text-sm font-medium text-black">{t('billRequest.specialRequests.label')}</Label>
            <Textarea
              id="special-requests"
              placeholder={t('billRequest.specialRequests.placeholder')}
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              className="mt-1 rounded-lg bg-gray-100"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">{t('billRequest.button.cancel')}</Button>
          <Button 
            onClick={handleRequestBill}
            disabled={isRequesting}
            className="bg-[#ba1d1d] text-white rounded-lg hover:bg-[#a11414]"
          >
            {isRequesting ? t('billRequest.button.sending') : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                {t('billRequest.button.request')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
