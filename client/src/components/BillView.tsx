import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, Receipt, CreditCard, Users, User, Calculator, Bell } from "lucide-react";
import { BillGenerationDialog } from "@/components/orders/bill-generation-dialog";
import BillRequestModal from "./BillRequestModal";

interface BillViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BillItem {
  id: number;
  billId: number;
  orderItemId: number;
  quantity: number;
  amount: string;
  orderItem?: {
    menuItem: { id: number; name: string; price: string };
    quantity: number;
    price: string;
    customizations?: string;
  };
}

interface Bill {
  id: number;
  billNumber: string;
  tableSessionId: number;
  customerId?: number;
  type: 'individual' | 'combined' | 'partial';
  subtotal: string;
  tax: string;
  tip: string;
  total: string;
  status: 'pending' | 'paid' | 'cancelled';
  paymentMethod?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    isMainCustomer: boolean;
  };
  items?: BillItem[];
}

export default function BillView({ open, onOpenChange }: BillViewProps) {
  const { restaurantId, session, restaurant, customer } = useRestaurant();
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showBillGeneration, setShowBillGeneration] = useState(false);
  const [showBillRequest, setShowBillRequest] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'my-bills' | 'table-bills'>('my-bills');

  useEffect(() => {
    if (open && session) {
      fetchBills();
    }
  }, [open, session]);

  const fetchBills = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/public/restaurants/${restaurantId}/table-sessions/${session.id}/bills`);
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

  const markBillAsPaid = async (billId: number) => {
    try {
      const response = await fetch(`/api/public/restaurants/${restaurantId}/bills/${billId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'cash' })
      });

      if (response.ok) {
        toast({ title: "Payment Successful", description: "Your bill has been marked as paid" });
        fetchBills();
      } else {
        throw new Error('Failed to process payment');
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({ title: "Payment Failed", description: "Failed to process payment.", variant: "destructive" });
    }
  };

  const getBillTypeIcon = (type: string) => {
    switch (type) {
      case 'individual': return <User className="h-4 w-4 text-red-600" />;
      case 'combined': return <Users className="h-4 w-4 text-red-600" />;
      case 'partial': return <Calculator className="h-4 w-4 text-red-600" />;
      default: return <Receipt className="h-4 w-4 text-red-600" />;
    }
  };

  const getBillTypeLabel = (type: string) => {
    switch (type) {
      case 'individual': return 'Individual Bill';
      case 'combined': return 'Combined Bill';
      case 'partial': return 'Partial Bill';
      default: return 'Bill';
    }
  };

  const getMyBills = () => {
    if (!customer) return [];
    return bills.filter(bill => bill.customerId === customer.id);
  };

  const getTableBills = () => {
    return bills.filter(bill => !bill.customerId || bill.type === 'combined');
  };

  const handlePrint = (bill: Bill) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const printContent = `
        <html>
          <head>
            <title>Bill ${bill.billNumber} - ${restaurant?.name}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .bill-info { margin-bottom: 20px; }
              .items { margin: 20px 0; }
              .item { display: flex; justify-content: space-between; margin: 5px 0; }
              .totals { border-top: 1px solid #ccc; margin-top: 20px; padding-top: 10px; }
              .total-line { display: flex; justify-content: space-between; margin: 5px 0; }
              .final-total { font-weight: bold; font-size: 1.2em; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${restaurant?.name}</h1>
              <p>Table ${session?.tableId}</p>
              <p>${new Date(bill.createdAt).toLocaleString()}</p>
            </div>
            <div class="bill-info">
              <p><strong>Bill #:</strong> ${bill.billNumber}</p>
              <p><strong>Type:</strong> ${getBillTypeLabel(bill.type)}</p>
              ${bill.customer ? `<p><strong>Customer:</strong> ${bill.customer.name}</p>` : ''}
              <p><strong>Status:</strong> ${bill.status.toUpperCase()}</p>
            </div>
            <div class="totals">
              <div class="total-line">
                <span>Subtotal:</span>
                <span>$${parseFloat(bill.subtotal).toFixed(2)}</span>
              </div>
              ${parseFloat(bill.tax) > 0 ? `
                <div class="total-line">
                  <span>Tax:</span>
                  <span>$${parseFloat(bill.tax).toFixed(2)}</span>
                </div>
              ` : ''}
              ${parseFloat(bill.tip) > 0 ? `
                <div class="total-line">
                  <span>Tip:</span>
                  <span>$${parseFloat(bill.tip).toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="total-line final-total">
                <span>Total:</span>
                <span>$${parseFloat(bill.total).toFixed(2)}</span>
              </div>
            </div>
            <div class="footer">
              <p>Thank you for dining with us!</p>
              ${bill.status === 'paid' ? `<p>✓ Paid on ${bill.paidAt ? new Date(bill.paidAt).toLocaleString() : 'N/A'}</p>` : ''}
            </div>
          </body>
        </html>
      `;
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = (bill: Bill) => {
    const content = `
Bill ${bill.billNumber} - ${restaurant?.name}
Table: ${session?.tableId}
Date: ${new Date(bill.createdAt).toLocaleString()}

Bill Type: ${getBillTypeLabel(bill.type)}
${bill.customer ? `Customer: ${bill.customer.name}` : ''}
Status: ${bill.status.toUpperCase()}

Subtotal: $${parseFloat(bill.subtotal).toFixed(2)}
${parseFloat(bill.tax) > 0 ? `Tax: $${parseFloat(bill.tax).toFixed(2)}` : ''}
${parseFloat(bill.tip) > 0 ? `Tip: $${parseFloat(bill.tip).toFixed(2)}` : ''}
Total: $${parseFloat(bill.total).toFixed(2)}

${bill.status === 'paid' ? `✓ Paid on ${bill.paidAt ? new Date(bill.paidAt).toLocaleString() : 'N/A'}` : ''}

Thank you for dining with us!
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-${bill.billNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderBillCard = (bill: Bill) => (
    <Card key={bill.id} className="mb-4 bg-white rounded-lg shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getBillTypeIcon(bill.type)}
            <div>
              <CardTitle className="text-sm font-bold text-black">#{bill.billNumber.split('-').pop()}</CardTitle>
              <p className="text-xs text-gray-600">{getBillTypeLabel(bill.type)}</p>
            </div>
          </div>
          <Badge className={bill.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
            {bill.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {bill.customer && <p className="text-sm text-gray-600 mb-2">Customer: {bill.customer.name}</p>}
        <p className="text-xs text-gray-500 mb-3">{formatDate(bill.createdAt)}</p>
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${parseFloat(bill.subtotal).toFixed(2)}</span>
          </div>
          {parseFloat(bill.tax) > 0 && (
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>${parseFloat(bill.tax).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(bill.tip) > 0 && (
            <div className="flex justify-between">
              <span>Tip:</span>
              <span>${parseFloat(bill.tip).toFixed(2)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-black">
            <span>Total:</span>
            <span>${parseFloat(bill.total).toFixed(2)}</span>
          </div>
        </div>
        <div className="flex space-x-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => handlePrint(bill)} className="flex-1 rounded-lg">
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownload(bill)} className="flex-1 rounded-lg">
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
          {bill.status === 'pending' && bill.customerId === customer?.id && false && (
            <Button size="sm" onClick={() => markBillAsPaid(bill.id)} className="flex-1 bg-[#ba1d1d] text-white rounded-lg hover:bg-[#a11414]">
              <CreditCard className="h-4 w-4 mr-2" /> Pay
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-lg font-bold text-black">
              <Receipt className="h-5 w-5 text-red-600" />
              <span>Bills & Payments</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4">
            {!session ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Please join a table session first</p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading bills...</p>
              </div>
            ) : (
              <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as 'my-bills' | 'table-bills')}>
                <TabsList className="grid w-full grid-cols-2 bg-white">
                  <TabsTrigger value="my-bills" className={`flex items-center space-x-2 ${selectedTab === 'my-bills' ? 'border-b-2 border-[#ba1d1d] text-[#ba1d1d]' : 'text-gray-600'}`}>
                    <User className="h-4 w-4" />
                    <span>My Bills ({getMyBills().length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="table-bills" className={`flex items-center space-x-2 ${selectedTab === 'table-bills' ? 'border-b-2 border-[#ba1d1d] text-[#ba1d1d]' : 'text-gray-600'}`}>
                    <Users className="h-4 w-4" />
                    <span>Table Bills ({getTableBills().length})</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="my-bills" className="mt-4">
                  {getMyBills().length === 0 ? (
                    <div className="text-center py-8">
                      <Receipt className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-4">No personal bills found</p>
                      <Button onClick={() => setShowBillRequest(true)} className="bg-[#ba1d1d] text-white rounded-lg hover:bg-[#a11414]">
                        <Bell className="h-4 w-4 mr-2" /> Request Bill
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">{getMyBills().map(renderBillCard)}</div>
                  )}
                </TabsContent>
                <TabsContent value="table-bills" className="mt-4">
                  {getTableBills().length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-4">No table bills found</p>
                      <Button onClick={() => setShowBillGeneration(true)} variant="outline" className="rounded-lg border-[#ba1d1d] text-[#ba1d1d] hover:bg-[#f9eaea]">
                        <Calculator className="h-4 w-4 mr-2" /> Generate Bills
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">{getTableBills().map(renderBillCard)}</div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>

          <DialogFooter className="p-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Close</Button>
            {session && bills.length > 0 && (
              <Button onClick={() => setShowBillGeneration(true)} className="bg-[#ba1d1d] text-white rounded-lg hover:bg-[#a11414]">
                <Calculator className="h-4 w-4 mr-2" /> Manage Bills
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showBillGeneration && session && restaurantId && (
        <BillGenerationDialog
          isOpen={showBillGeneration}
          onOpenChange={setShowBillGeneration}
          tableSessionId={session.id}
          restaurantId={restaurantId}
          onBillGenerated={() => {
            fetchBills();
            setShowBillGeneration(false);
          }}
        />
      )}

      <BillRequestModal open={showBillRequest} onOpenChange={setShowBillRequest} />
    </>
  );
}
