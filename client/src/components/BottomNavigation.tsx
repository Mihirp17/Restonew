import { Button } from "@/components/ui/button";
import { History, Receipt, Star } from "lucide-react";
import { useLang } from "@/contexts/language-context";

interface BottomNavigationProps {
  onShowOrderHistory: () => void;
  onShowBill: () => void;
  onShowFeedback: () => void;
}

export default function BottomNavigation({ onShowOrderHistory, onShowBill, onShowFeedback }: BottomNavigationProps) {
  const { t } = useLang();
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-40">
      <div className="flex justify-around">
        <Button variant="ghost" size="sm" onClick={onShowOrderHistory} className="flex flex-col items-center space-y-1 text-gray-600 hover:text-red-600">
          <History className="h-6 w-6" />
          <span className="text-xs">{t('bottomNav.orders')}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowBill} className="flex flex-col items-center space-y-1 text-gray-600 hover:text-red-600">
          <Receipt className="h-6 w-6" />
          <span className="text-xs">{t('bottomNav.bill')}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowFeedback} className="flex flex-col items-center space-y-1 text-gray-600 hover:text-red-600">
          <Star className="h-6 w-6" />
          <span className="text-xs">{t('bottomNav.feedback')}</span>
        </Button>
      </div>
    </div>
  );
}
