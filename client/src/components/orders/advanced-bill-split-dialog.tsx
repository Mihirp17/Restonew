import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Receipt, User, Users, Calculator, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/api";

interface OrderItem {
  id: number;
  name: string;
  price: string;
  quantity: number;
  customizations?: string;
  menuItem?: {
    id: number;
    name: string;
    price: string;
  };
}

interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  total: string;
  items: OrderItem[];
  status: string;
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  isMainCustomer: boolean;
  paymentStatus: string;
  orders: Order[];
  totalAmount: number;
  hasExistingBill?: boolean;
  existingBill?: {
    id: number;
    billNumber: string;
    status: string;
  };
}

interface ItemSplit {
  orderItemId: number;
  customerIds: number[];
  splitType: 'equal' | 'custom';
  customAmounts?: { [customerId: number]: number };
}

interface TableSession {
  id: number;
  sessionName?: string;
  partySize: number;
  splitType: string;
  totalAmount: string;
  customers: Customer[];
  table?: {
    number: number;
  };
}

interface AdvancedBillSplitDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tableSessionId: number;
  restaurantId: number;
  onBillGenerated?: () => void;
}

export function AdvancedBillSplitDialog({
  isOpen,
  onOpenChange,
  tableSessionId,
  restaurantId,
  onBillGenerated
}: AdvancedBillSplitDialogProps) {
  const [tableSession, setTableSession] = useState<TableSession | null>(null);
  const [splitMode, setSplitMode] = useState<'simple' | 'itemLevel'>('simple');
  const [allOrderItems, setAllOrderItems] = useState<OrderItem[]>([]);
  const [itemSplits, setItemSplits] = useState<{ [itemId: number]: ItemSplit }>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [tipPercentage, setTipPercentage] = useState(0); // No tip by default
  const { toast } = useToast();

  // Fetch table session and orders
  useEffect(() => {
    const fetchData = async () => {
      if (!tableSessionId || !restaurantId) return;

      try {
        const [sessionData, allOrders] = await Promise.all([
          apiRequest({
            method: 'GET',
            url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}`
          }),
          apiRequest({
            method: 'GET',
            url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}/orders`
          })
        ]);

        // Process orders and group by customer
        const ordersByCustomer: Record<number, Order[]> = {};
        const allItems: OrderItem[] = [];

        for (const order of allOrders) {
          if (!ordersByCustomer[order.customerId]) ordersByCustomer[order.customerId] = [];
          ordersByCustomer[order.customerId].push(order);
          
          // Collect all order items with their order context
          for (const item of order.items) {
            allItems.push({
              ...item,
              id: item.id, // This is the orderItemId
              orderId: order.id,
              customerId: order.customerId
            } as any);
          }
        }

        setAllOrderItems(allItems);

        // Initialize item splits - by default each item goes to its original customer
        const initialSplits: { [itemId: number]: ItemSplit } = {};
        for (const item of allItems) {
          initialSplits[item.id] = {
            orderItemId: item.id,
            customerIds: [(item as any).customerId],
            splitType: 'equal'
          };
        }
        setItemSplits(initialSplits);

        // Calculate customer totals
        const customersWithTotals = (sessionData.customers || []).map((customer: Customer) => {
          const orders = ordersByCustomer[customer.id] || [];
          const customerTotal = orders.reduce((sum: number, order: Order) => sum + parseFloat(order.total), 0);
          return {
            ...customer,
            orders,
            totalAmount: customerTotal
          };
        });

        setTableSession({
          ...sessionData,
          customers: customersWithTotals
        });

      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load session data",
          variant: "destructive"
        });
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen, tableSessionId, restaurantId]);

  const handleItemSplitChange = (itemId: number, customerIds: number[]) => {
    setItemSplits(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        customerIds
      }
    }));
  };

  const calculateItemAmount = (item: OrderItem, customerId: number) => {
    const split = itemSplits[item.id];
    if (!split || !split.customerIds.includes(customerId)) return 0;

    const itemTotal = parseFloat(item.price) * item.quantity;
    
    if (split.splitType === 'custom' && split.customAmounts) {
      return split.customAmounts[customerId] || 0;
    } else {
      // Equal split
      return itemTotal / split.customerIds.length;
    }
  };

  const calculateCustomerSubtotal = (customerId: number) => {
    return allOrderItems.reduce((total, item) => {
      return total + calculateItemAmount(item, customerId);
    }, 0);
  };

  const calculateCustomerTotal = (customerId: number) => {
    const subtotal = calculateCustomerSubtotal(customerId);
    const tax = 0; // No tax calculation - prices include tax in Spain
    const tip = subtotal * (tipPercentage / 100);
    return subtotal + tax + tip;
  };

  const handleGenerateBills = async () => {
    if (!tableSession) return;

    try {
      setIsGenerating(true);

      // Generate individual bills based on item splits
      for (const customer of tableSession.customers) {
        const subtotal = calculateCustomerSubtotal(customer.id);
        
        if (subtotal <= 0) continue; // Skip customers with no items

        const tax = 0; // No tax calculation - prices include tax in Spain
        const tip = subtotal * (tipPercentage / 100);
        const total = subtotal + tax + tip;

        const billData = {
          billNumber: `BILL-${tableSession.table?.number || 'X'}-${customer.id}-${Date.now()}`,
          tableSessionId: tableSession.id,
          customerId: customer.id,
          type: splitMode === 'itemLevel' ? 'itemLevel' : 'individual',
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          tip: tip.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: 'cash',
          status: 'pending'
        };

        // Create the bill
        const bill = await apiRequest({
          method: 'POST',
          url: `/api/restaurants/${restaurantId}/bills`,
          data: billData
        });

        // Create bill items for item-level splitting
        if (splitMode === 'itemLevel') {
          for (const item of allOrderItems) {
            const amount = calculateItemAmount(item, customer.id);
            if (amount > 0) {
              await apiRequest({
                method: 'POST',
                url: `/api/restaurants/${restaurantId}/bills/${bill.id}/items`,
                data: {
                  orderItemId: item.id,
                  quantity: itemSplits[item.id].customerIds.length === 1 ? item.quantity : 1,
                  amount: amount.toFixed(2)
                }
              });
            }
          }
        }
      }

      toast({
        title: "Bills Generated",
        description: `Advanced bills generated with ${splitMode === 'itemLevel' ? 'item-level' : 'simple'} splitting`,
      });

      onBillGenerated?.();
      onOpenChange(false);

    } catch (error) {
      console.error('Error generating bills:', error);
      toast({
        title: "Error",
        description: "Failed to generate bills",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!tableSession) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading session data...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            <span>Advanced Bill Splitting - Table {tableSession.table?.number || 'Unknown'}</span>
            <Badge variant="outline">
              {tableSession.partySize} {tableSession.partySize === 1 ? 'person' : 'people'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Split Mode Toggle */}
          <Card>
            <CardHeader>
              <CardTitle>Split Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="split-mode"
                    checked={splitMode === 'itemLevel'}
                    onCheckedChange={(checked) => setSplitMode(checked ? 'itemLevel' : 'simple')}
                  />
                  <Label htmlFor="split-mode">
                    {splitMode === 'itemLevel' ? 'Item-Level Splitting' : 'Simple Customer Split'}
                  </Label>
                </div>
                <Badge variant={splitMode === 'itemLevel' ? 'default' : 'secondary'}>
                  {splitMode === 'itemLevel' ? 'Advanced' : 'Basic'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {splitMode === 'itemLevel' 
                  ? 'Choose which customers pay for which specific items'
                  : 'Split bills by customer orders (current behavior)'
                }
              </p>
            </CardContent>
          </Card>

          {/* Tax and Tip Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Tip Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="tip-percentage">Tip (%)</Label>
                <Input
                  id="tip-percentage"
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  value={tipPercentage}
                  onChange={(e) => setTipPercentage(parseFloat(e.target.value))}
                />
              </div>
              <div className="text-sm text-gray-600">
                <p>Tax is already included in menu prices.</p>
              </div>
            </CardContent>
          </Card>

          {/* Item-Level Splitting */}
          {splitMode === 'itemLevel' && (
            <Card>
              <CardHeader>
                <CardTitle>Item Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allOrderItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{item.menuItem?.name || item.name}</h4>
                          <p className="text-sm text-gray-600">
                            Qty: {item.quantity} × {formatCurrency(parseFloat(item.price))} = {formatCurrency(parseFloat(item.price) * item.quantity)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {tableSession.customers.map((customer) => (
                          <label key={customer.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={itemSplits[item.id]?.customerIds.includes(customer.id) || false}
                              onChange={(e) => {
                                const currentSplit = itemSplits[item.id];
                                const newCustomerIds = e.target.checked
                                  ? [...(currentSplit?.customerIds || []), customer.id]
                                  : (currentSplit?.customerIds || []).filter(id => id !== customer.id);
                                handleItemSplitChange(item.id, newCustomerIds);
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{customer.name}</span>
                          </label>
                        ))}
                      </div>

                      {itemSplits[item.id]?.customerIds.length > 1 && (
                        <div className="mt-2 text-xs text-blue-600">
                          Split equally among {itemSplits[item.id].customerIds.length} people
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bill Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tableSession.customers.map((customer) => {
                  const subtotal = calculateCustomerSubtotal(customer.id);
                  const tax = 0; // No tax calculation - prices include tax in Spain
                  const tip = subtotal * (tipPercentage / 100);
                  const total = subtotal + tax + tip;

                  if (subtotal <= 0) return null;

                  return (
                    <div key={customer.id} className="border rounded-lg p-4 bg-green-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{customer.name}</span>
                        <span className="font-bold text-lg">{formatCurrency(total)}</span>
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Subtotal (tax included):</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {tipPercentage > 0 && (
                          <div className="flex justify-between">
                            <span>Tip ({tipPercentage}%):</span>
                            <span>{formatCurrency(tip)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium border-t pt-1 mt-1">
                          <span>Total:</span>
                          <span>{formatCurrency(total)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerateBills}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isGenerating ? (
              <span className="flex items-center">
                <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                Generating...
              </span>
            ) : (
              <>
                <Receipt className="h-4 w-4 mr-2" />
                Generate Advanced Bills
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
