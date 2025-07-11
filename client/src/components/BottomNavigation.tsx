import { Button } from "@/components/ui/button";
import { History, Receipt, Star } from "lucide-react";

interface BottomNavigationProps {
  onShowOrderHistory: () => void;
  onShowBill: () => void;
  onShowFeedback: () => void;
}

export default function BottomNavigation({
  onShowOrderHistory,
  onShowBill,
  onShowFeedback,
}: BottomNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-40">
      <div className="flex justify-around">
        <Button
          variant="ghost"
          size="sm"
          onClick={onShowOrderHistory}
          className="flex flex-col items-center space-y-1"
        >
          <History className="h-5 w-5" />
          <span className="text-xs">Orders</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onShowBill}
          className="flex flex-col items-center space-y-1"
        >
          <Receipt className="h-5 w-5" />
          <span className="text-xs">Bill</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onShowFeedback}
          className="flex flex-col items-center space-y-1"
        >
          <Star className="h-5 w-5" />
          <span className="text-xs">Feedback</span>
        </Button>
      </div>
    </div>
  );
} 