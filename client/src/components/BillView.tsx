import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer } from "lucide-react";

interface BillViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Bill {
  id: number;
  total: string;
  status: string;
  createdAt: string;
  items: Array<{
    id: number;
    quantity: number;
    price: string;
    menuItem: {
      id: number;
      name: string;
    };
  }>;
}

export default function BillView({ open, onOpenChange }: BillViewProps) {
  const { restaurantId, session, restaurant } = useRestaurant();
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && session) {
      fetchBills();
    }
  }, [open, session]);

  const fetchBills = async () => {
    if (!session) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/restaurants/${restaurantId}/table-sessions/${session.id}/bills`);
      if (response.ok) {
        const data = await response.json();
        setBills(data);
      }
    } catch (error) {
      console.error("Error fetching bills:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && bills.length > 0) {
      const bill = bills[0];
      const printContent = `
        <html>
          <head>
            <title>Bill - ${restaurant?.name}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .item { display: flex; justify-content: space-between; margin: 5px 0; }
              .total { border-top: 1px solid #ccc; margin-top: 20px; padding-top: 10px; font-weight: bold; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${restaurant?.name}</h1>
              <p>Table ${session?.tableNumber}</p>
              <p>${new Date().toLocaleString()}</p>
            </div>
            
            <div class="items">
              ${bill.items.map(item => `
                <div class="item">
                  <span>${item.quantity}x ${item.menuItem.name}</span>
                  <span>$${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
            
            <div class="total">
              <div class="item">
                <span>Total:</span>
                <span>$${bill.total}</span>
              </div>
            </div>
            
            <div class="footer">
              <p>Thank you for dining with us!</p>
            </div>
          </body>
        </html>
      `;
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    if (bills.length === 0) return;
    
    const bill = bills[0];
    const content = `
Bill - ${restaurant?.name}
Table: ${session?.tableNumber}
Date: ${new Date().toLocaleString()}

Items:
${bill.items.map(item => `${item.quantity}x ${item.menuItem.name} - $${(parseFloat(item.price) * item.quantity).toFixed(2)}`).join('\n')}

Total: $${bill.total}

Thank you for dining with us!
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-${restaurant?.name}-${session?.tableNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Current Bill</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading bill...</p>
            </div>
          ) : bills.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No bill available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bills.map((bill) => (
                <div key={bill.id} className="border rounded-lg p-4">
                  <div className="text-center mb-4">
                    <h3 className="font-bold text-lg">{restaurant?.name}</h3>
                    <p className="text-sm text-gray-600">Table {session?.tableNumber}</p>
                    <p className="text-sm text-gray-600">{formatDate(bill.createdAt)}</p>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {bill.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.menuItem.name}</span>
                        <span>${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>${bill.total}</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrint}
                      className="flex-1"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 