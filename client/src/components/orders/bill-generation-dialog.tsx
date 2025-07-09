import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Receipt, User, Users, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/api";

interface OrderItem {
  id: number;
  name: string;
  price: string;
  quantity: number;
  customizations?: string;
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

interface BillGenerationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tableSessionId: number;
  restaurantId: number;
  onBillGenerated?: () => void;
}

export function BillGenerationDialog({ 
  isOpen, 
  onOpenChange, 
  tableSessionId, 
  restaurantId,
  onBillGenerated 
}: BillGenerationDialogProps) {
  const [tableSession, setTableSession] = useState<TableSession | null>(null);
  const [selectedBillType, setSelectedBillType] = useState<'individual' | 'combined' | 'custom'>('individual');
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Add state for paginated bills
  const [bills, setBills] = useState<any[]>([]);
  const [billsOffset, setBillsOffset] = useState(0);
  const [billsHasMore, setBillsHasMore] = useState(true);
  const BILLS_PAGE_SIZE = 30;

  // Fetch paginated bills
  const fetchBills = async (reset = false) => {
    if (!tableSessionId || !restaurantId) return;
    const offset = reset ? 0 : billsOffset;
    const billsData = await apiRequest({
      method: 'GET',
      url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}/bills?limit=${BILLS_PAGE_SIZE}&offset=${offset}`
    });
    if (reset) {
      setBills(billsData);
    } else {
      setBills(prev => [...prev, ...billsData]);
    }
    setBillsHasMore(billsData.length === BILLS_PAGE_SIZE);
    setBillsOffset(offset + billsData.length);
  };

  // Fetch bills on dialog open or session change
  useEffect(() => {
    if (isOpen) {
      setBills([]);
      setBillsOffset(0);
      setBillsHasMore(true);
      fetchBills(true);
    }
    // eslint-disable-next-line
  }, [isOpen, tableSessionId, restaurantId]);

  // Fetch table session data
  useEffect(() => {
    const fetchTableSession = async () => {
      if (!tableSessionId || !restaurantId) return;

      try {
        const sessionData = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}`
        });
        
        // Fetch all orders for the session in one call
        const allOrders = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}/orders`
        });
        // Group orders by customerId
        const ordersByCustomer: Record<number, Order[]> = {};
        for (const order of allOrders) {
          if (!ordersByCustomer[order.customerId]) ordersByCustomer[order.customerId] = [];
          ordersByCustomer[order.customerId].push(order);
        }
        // Attach orders and totals to each customer
        const customersWithOrders = (sessionData.customers || []).map((customer: Customer) => {
          const orders = ordersByCustomer[customer.id] || [];
          const customerTotal = orders.reduce((sum: number, order: Order) => sum + parseFloat(order.total), 0);
          return {
            ...customer,
            orders,
            totalAmount: customerTotal
          };
        });

        // Check for existing bills
        const sessionBills = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}/bills`
        });

        // Add bill status to customers
        const customersWithBillStatus = customersWithOrders.map(customer => ({
          ...customer,
          existingBill: sessionBills.find((bill: any) => bill.customerId === customer.id),
          hasExistingBill: sessionBills.some((bill: any) => bill.customerId === customer.id)
        }));

        setTableSession({
          ...sessionData,
          customers: customersWithBillStatus
        });
        
        // Set default selected customers based on split type
        if (sessionData.splitType === 'individual') {
          setSelectedCustomers([]);
        } else if (sessionData.splitType === 'combined') {
          setSelectedCustomers(customersWithOrders.map((c: Customer) => c.id));
        }
      } catch (error) {
        console.error('Error fetching table session:', error);
        toast({
          title: "Error",
          description: "Failed to load table session data",
          variant: "destructive"
        });
      }
    };

    fetchTableSession();
  }, [tableSessionId, restaurantId, toast]);

  const calculateTotal = (customerIds: number[]) => {
    if (!tableSession || !tableSession.customers) return 0;
    
    return tableSession.customers
      .filter(customer => customerIds.includes(customer.id))
      .reduce((sum, customer) => sum + customer.totalAmount, 0);
  };

  const generateBillNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const tableNumber = tableSession?.table?.number || 'Unknown';
    return `BILL-${tableNumber}-${timestamp}-${random}`;
  };

  const handleGenerateBills = async () => {
    if (!tableSession) {
      toast({
        title: "Error",
        description: "No table session data available",
        variant: "destructive"
      });
      return;
    }

    // Validate table session has customers
    if (!tableSession.customers || tableSession.customers.length === 0) {
      toast({
        title: "Error", 
        description: "No customers found for this table session",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGenerating(true);

      if (selectedBillType === 'individual') {
        // Generate individual bills for each customer
        let successCount = 0;
        let skipCount = 0;
        
        for (const customer of tableSession.customers) {
          if (customer.totalAmount > 0) {
            const total = customer.totalAmount;

            const billData = {
              billNumber: generateBillNumber(),
              tableSessionId: tableSession.id,
              customerId: customer.id,
              type: 'individual',
              subtotal: total.toString(),
              tax: '0.00',
              tip: '0.00',
              total: total.toString(),
              paymentMethod: 'cash',
              status: 'pending'
            };

            try {
              await apiRequest({
                method: 'POST',
                url: `/api/restaurants/${restaurantId}/bills`,
                data: billData
              });
              successCount++;
            } catch (error: any) {
              // Handle existing bill error
              if (error.response?.data?.message?.includes('already exists')) {
                skipCount++;
                console.log(`Bill already exists for customer ${customer.name}`);
              } else {
                throw error; // Re-throw other errors
              }
            }
          }
        }

        if (successCount > 0 && skipCount > 0) {
          toast({
            title: "Bills Generated",
            description: `${successCount} new bills generated, ${skipCount} customers already have bills`,
          });
        } else if (successCount > 0) {
          toast({
            title: "Bills Generated",
            description: `Individual bills generated for ${successCount} customers`,
          });
        } else if (skipCount > 0) {
          toast({
            title: "Bills Already Exist",
            description: `All customers already have bills for this session`,
            variant: "default"
          });
        }

      } else if (selectedBillType === 'combined') {
        // Generate one combined bill for all customers
        const total = calculateTotal(tableSession.customers.map(c => c.id));

        const billData = {
          billNumber: generateBillNumber(),
          tableSessionId: tableSession.id,
          customerId: null, // No specific customer for combined bill
          type: 'combined',
          subtotal: total.toString(),
          tax: '0.00',
          tip: '0.00',
          total: total.toString(),
          paymentMethod: 'cash',
          status: 'pending'
        };

        await apiRequest({
          method: 'POST',
          url: `/api/restaurants/${restaurantId}/bills`,
          data: billData
        });

        toast({
          title: "Combined Bill Generated",
          description: `Bill generated for table ${tableSession.table?.number || 'Unknown'}`,
        });

      } else if (selectedBillType === 'custom' && selectedCustomers.length > 0) {
        // Generate bill for selected customers
        const total = calculateTotal(selectedCustomers);

        const billData = {
          billNumber: generateBillNumber(),
          tableSessionId: tableSession.id,
          customerId: selectedCustomers.length === 1 ? selectedCustomers[0] : null,
          type: 'partial',
          subtotal: total.toString(),
          tax: '0.00',
          tip: '0.00',
          total: total.toString(),
          paymentMethod: 'cash',
          status: 'pending'
        };

        await apiRequest({
          method: 'POST',
          url: `/api/restaurants/${restaurantId}/bills`,
          data: billData
        });

        const customerNames = tableSession.customers
          .filter(c => selectedCustomers.includes(c.id))
          .map(c => c.name)
          .join(', ');

        toast({
          title: "Partial Bill Generated",
          description: `Bill generated for: ${customerNames}`,
        });
      }

      onBillGenerated?.();
      onOpenChange(false);

    } catch (error) {
      console.error('Error generating bills:', error);
      let errorMessage = "Failed to generate bills";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomerToggle = (customerId: number) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Receipt className="h-5 w-5 text-green-600" />
                          <span>Generate Bills - Table {tableSession.table?.number || 'Unknown'}</span>
            <Badge variant="outline">
              {tableSession.partySize} {tableSession.partySize === 1 ? 'person' : 'people'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
            {/* Bill Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Bill Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant={selectedBillType === 'individual' ? 'default' : 'outline'}
                    className="h-20 flex flex-col items-center justify-center"
                    onClick={() => setSelectedBillType('individual')}
                  >
                    <User className="h-6 w-6 mb-2" />
                    <span>Individual Bills</span>
                    <span className="text-xs opacity-70">Separate bill per person</span>
                  </Button>
                  
                  <Button
                    variant={selectedBillType === 'combined' ? 'default' : 'outline'}
                    className="h-20 flex flex-col items-center justify-center"
                    onClick={() => setSelectedBillType('combined')}
                  >
                    <Users className="h-6 w-6 mb-2" />
                    <span>Combined Bill</span>
                    <span className="text-xs opacity-70">Single bill for all</span>
                  </Button>
                  
                  <Button
                    variant={selectedBillType === 'custom' ? 'default' : 'outline'}
                    className="h-20 flex flex-col items-center justify-center"
                    onClick={() => setSelectedBillType('custom')}
                  >
                    <Calculator className="h-6 w-6 mb-2" />
                    <span>Custom Split</span>
                    <span className="text-xs opacity-70">Select specific people</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Customer Selection for Custom Split */}
            {selectedBillType === 'custom' && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  {tableSession.customers && tableSession.customers.length > 0 ? (
                    <div className="space-y-2">
                      {tableSession.customers.map(customer => (
                        <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedCustomers.includes(customer.id)}
                              onChange={() => handleCustomerToggle(customer.id)}
                              className="rounded"
                            />
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{customer.name}</span>
                                {customer.isMainCustomer && (
                                  <Badge variant="default" className="text-xs">Main</Badge>
                                )}
                              </div>
                              <span className="text-sm text-gray-500">
                                {customer.orders?.length || 0} order{(customer.orders?.length || 0) !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{formatCurrency(customer.totalAmount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      No customers found for this session
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Bill Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Bill Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedBillType === 'individual' && (
                  <div className="space-y-4">
                    {tableSession.customers && tableSession.customers.length > 0 ? (
                      tableSession.customers.map(customer => {
                        const total = customer.totalAmount;

                        return (
                          <div key={customer.id} className={`p-4 border rounded-lg ${
                            customer.hasExistingBill ? 'bg-gray-50 border-gray-300' : 'border-green-200 bg-green-50'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{customer.name}</span>
                                {customer.hasExistingBill && (
                                  <div className={`text-xs px-2 py-1 rounded ${
                                    customer.existingBill?.status === 'paid' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {customer.existingBill?.status === 'paid' ? '✓ Bill Paid' : '⏳ Bill Pending'}
                                  </div>
                                )}
                              </div>
                              <span className="font-bold">{formatCurrency(total)}</span>
                            </div>
                            <div className="text-sm">
                              <div className="flex justify-between">
                                <span>Total (VAT included):</span>
                                <span>{formatCurrency(total)}</span>
                              </div>
                              {customer.hasExistingBill && (
                                <div className="text-xs text-gray-600 mt-2">
                                  Bill #{customer.existingBill?.billNumber?.split('-').pop()} already exists
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No customers found for individual billing
                      </div>
                    )}
                  </div>
                )}

                {selectedBillType === 'combined' && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium">Combined Bill - Table {tableSession.table?.number || 'Unknown'}</span>
                      <span className="font-bold text-lg">{formatCurrency(calculateTotal((tableSession.customers || []).map(c => c.id)))}</span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total (VAT included):</span>
                        <span>{formatCurrency(calculateTotal((tableSession.customers || []).map(c => c.id)))}</span>
                      </div>
                      <Separator />
                      {tableSession.customers && tableSession.customers.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          {tableSession.customers.map(customer => (
                            <div key={customer.id} className="text-xs">
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-gray-500">{formatCurrency(customer.totalAmount)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedBillType === 'custom' && selectedCustomers.length > 0 && tableSession.customers && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium">
                        Custom Bill ({selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''})
                      </span>
                      <span className="font-bold text-lg">{formatCurrency(calculateTotal(selectedCustomers))}</span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total (VAT included):</span>
                        <span>{formatCurrency(calculateTotal(selectedCustomers))}</span>
                      </div>
                      <Separator />
                      <div className="mt-4">
                        <div className="text-xs font-medium mb-1">Included customers:</div>
                        {tableSession.customers
                          .filter(c => selectedCustomers.includes(c.id))
                          .map(customer => (
                            <div key={customer.id} className="flex justify-between text-xs">
                              <span>{customer.name}</span>
                              <span>{formatCurrency(customer.totalAmount)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerateBills}
            disabled={isGenerating || (selectedBillType === 'custom' && selectedCustomers.length === 0)}
            className="bg-green-600 hover:bg-green-700"
          >
            {isGenerating ? (
              <span className="flex items-center">
                <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                Generating...
              </span>
            ) : (
              <>
                <Receipt className="h-4 w-4 mr-2" />
                Generate Bills
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 