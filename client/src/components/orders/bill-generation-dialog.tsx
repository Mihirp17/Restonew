import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  hasOrders?: boolean;
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
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
      setHasError(false); // Reset error state
      setIsLoading(true); // Start loading
      setBills([]);
      setBillsOffset(0);
      setBillsHasMore(true);
      fetchBills(true);
      // Always fetch latest session/orders
      fetchTableSession();
    }
    // eslint-disable-next-line
  }, [isOpen, tableSessionId, restaurantId]);

  // Fetch table session data
  const fetchTableSession = async () => {
    if (!tableSessionId || !restaurantId) return;

    try {
      const sessionData = await apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}?t=${Date.now()}&cacheBust=${Math.random()}`,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      console.log('🔍 Bill Generation Debug - Session data:', sessionData);
      console.log('🔍 Bill Generation Debug - Session totalAmount:', sessionData?.totalAmount);
      
      // Fetch all orders for the session in one call
      const allOrders = await apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}/orders?t=${Date.now()}&cacheBust=${Math.random()}`,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      console.log('🔍 Bill Generation Debug - All orders fetched:', allOrders);
      console.log('🔍 Bill Generation Debug - Orders count:', allOrders?.length || 0);
      console.log('🔍 Bill Generation Debug - Session ID:', tableSessionId);
      console.log('🔍 Bill Generation Debug - Restaurant ID:', restaurantId);
      
      // If no orders found, try to get orders by restaurant and filter by customers
      let finalOrders = allOrders;
      if (!allOrders || allOrders.length === 0) {
        console.log('🔍 No orders found for session, trying fallback approach...');
        try {
          // Get all orders for the restaurant
          const allRestaurantOrders = await apiRequest({
            method: 'GET',
            url: `/api/restaurants/${restaurantId}/orders`
          });
          console.log('🔍 Fallback - All restaurant orders:', allRestaurantOrders?.length || 0);
          
          // Filter orders by customers in this session
          const customerIds = (sessionData.customers || []).map((c: Customer) => c.id);
          const sessionOrders = allRestaurantOrders.filter((order: any) => 
            customerIds.includes(order.customerId)
          );
          console.log('🔍 Fallback - Session orders found:', sessionOrders.length);
          console.log('🔍 Fallback - Customer IDs:', customerIds);
          console.log('🔍 Fallback - Session orders:', sessionOrders);
          
          finalOrders = sessionOrders;
        } catch (fallbackError) {
          console.error('🔍 Fallback approach failed:', fallbackError);
        }
      }
      
      // Group orders by customerId
      const ordersByCustomer: Record<number, Order[]> = {};
      for (const order of finalOrders) {
        if (!ordersByCustomer[order.customerId]) ordersByCustomer[order.customerId] = [];
        ordersByCustomer[order.customerId].push(order);
      }
      // Debug: Log session data customers
      console.log('🔍 Session Data:', sessionData);
      console.log('🔍 Session Data Customers:', sessionData.customers);
      console.log('🔍 Final Orders:', finalOrders);
      console.log('🔍 Orders by Customer:', ordersByCustomer);
      
      // Attach orders and totals to each customer
      const customersWithOrders = (sessionData.customers || []).map((customer: Customer) => {
        const orders = ordersByCustomer[customer.id] || [];
        const customerTotal = orders.reduce((sum: number, order: Order) => sum + parseFloat(order.total), 0);
        console.log(`🔍 Customer ${customer.name} (ID: ${customer.id}) - Orders:`, orders.length, 'Total:', customerTotal);
        console.log(`🔍 Customer ${customer.name} - Individual orders:`, orders.map(o => ({ id: o.id, total: o.total, customerId: o.customerId })));
        return {
          ...customer,
          orders,
          totalAmount: customerTotal,
          hasOrders: orders.length > 0 && customerTotal > 0
        };
      });

      // Compare calculated totals with session total
      const allCustomersTotal = customersWithOrders.reduce((sum: number, customer: any) => sum + (customer.totalAmount || 0), 0);
      console.log(`🔍 Bill Generation Debug - All customers total: ${allCustomersTotal}`);
      console.log(`🔍 Bill Generation Debug - Session total: ${sessionData.totalAmount}`);
      
      if (sessionData.totalAmount && Math.abs(allCustomersTotal - parseFloat(sessionData.totalAmount)) > 0.01) {
        console.warn(`🚨 Total mismatch! Calculated: ${allCustomersTotal}, Session: ${sessionData.totalAmount}`);
      }

      // Check for existing bills
      const sessionBills = await apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/table-sessions/${tableSessionId}/bills`
      });

      // Add bill status to customers
      const customersWithBillStatus = customersWithOrders.map((customer: Customer) => ({
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

      // When selecting customers in custom mode, don't select ones with existing bills
      if (sessionData.splitType === 'custom') {
        const eligibleCustomers = customersWithBillStatus
          .filter((c: Customer) => !c.hasExistingBill)
          .map((c: Customer) => c.id);
        setSelectedCustomers(eligibleCustomers);
      }
      
      setIsLoading(false); // Stop loading on success
    } catch (error: any) {
      // Detect 404
      if (error?.response?.status === 404) {
        toast({
          title: "Session Ended",
          description: "This session no longer exists or has ended. The list will refresh.",
          variant: "destructive"
        });
        onOpenChange(false); // Close dialog immediately
        if (typeof (window as any).refreshSessions === "function") (window as any).refreshSessions();
        return;
      }
      console.error('Error fetching table session:', error);
      setHasError(true);
      setIsLoading(false); // Stop loading on error
      toast({
        title: "Error",
        description: "Failed to load table session data. Please check the session or try again.",
        variant: "destructive"
      });
      onOpenChange(false); // Close dialog immediately for other errors too
    }
  };

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
    
    // Check if there are any orders at all
    const customersWithOrders = tableSession.customers.filter(customer => 
      customer.orders?.length > 0 && customer.totalAmount > 0 && customer.hasOrders
    );
    
    if (customersWithOrders.length === 0) {
      toast({
        title: "No Orders", 
        description: "Cannot generate bills because there are no orders for this session",
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
          // Skip customers with no orders or zero total
          if (customer.totalAmount <= 0 || !customer.orders?.length || !customer.hasOrders) {
            console.log(`Skipping bill for ${customer.name} - no orders or zero total`);
            continue;
          }

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
      fetchBills(true);
      
      // Note: Auto-completion should only happen when bills are actually PAID, not just generated
      // Bills are created with 'pending' status and should remain that way until payment
      // The auto-completion will be handled by a separate payment process or webhook
      
      onOpenChange(false);
      if (typeof (window as any).refreshSessions === "function") (window as any).refreshSessions();

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
    // Find the customer to check if they already have a bill
    const customer = tableSession?.customers?.find(c => c.id === customerId);
    
    if (customer?.hasExistingBill) {
      toast({
        title: "Cannot Add Customer",
        description: `${customer.name} already has a bill for this session.`,
        variant: "destructive"
      });
      return;
    }
    
    setSelectedCustomers(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };



  // Show loading state
  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading Table Session</DialogTitle>
            <DialogDescription>
              Please wait while we load the table session data...
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8">
            <div className="text-center">
              <div className="text-lg text-[#373643] mb-2">Loading...</div>
              <p className="mb-4 text-[#373643]/70">
                Loading table session data...
              </p>
              <div className="animate-pulse w-8 h-8 bg-[#ba1d1d] rounded-full mx-auto"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error Loading Session</DialogTitle>
            <DialogDescription>
              There was an error loading the table session data. Please try again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8">
            <div className="text-center">
              <div className="text-2xl text-[#ba1d1d] mb-2">Error</div>
              <p className="mb-4 text-[#373643]">
                Failed to load table session data. Please check the session or try again.
              </p>
              <Button onClick={() => onOpenChange(false)} className="bg-[#ba1d1d] text-white hover:bg-[#a11414]">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show message if no session data
  if (!tableSession) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Session Data</DialogTitle>
            <DialogDescription>
              No table session data is available for this request.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8">
            <div className="text-center">
              <div className="text-lg text-[#373643] mb-2">No Data</div>
              <p className="mb-4 text-[#373643]/70">
                No table session data available.
              </p>
              <Button onClick={() => onOpenChange(false)} className="bg-[#ba1d1d] text-white hover:bg-[#a11414]">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#ffffff] border border-[#373643]/10 shadow-xl rounded-xl p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-[#373643]/10">
          <DialogTitle className="flex items-center space-x-2 text-[#373643] text-base font-semibold">
            <Receipt className="h-5 w-5 text-[#ba1d1d]" />
            <span>Generate Bills - Table {tableSession.table?.number || 'No Table Assigned'}</span>
            <Badge variant="outline" className="bg-[#f5f5f5] text-xs text-[#373643]/60 border-[#e5e5e5]">{tableSession.partySize} {tableSession.partySize === 1 ? 'person' : 'people'}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 py-4">
            {/* Bill Type Selection */}
            <Card className="bg-[#f9f9f9] border border-[#e5e5e5]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#373643]">Bill Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant={selectedBillType === 'individual' ? 'default' : 'outline'}
                    className={`h-20 flex flex-col items-center justify-center border-[#373643]/10 ${selectedBillType === 'individual' ? 'bg-[#ba1d1d] text-white' : 'bg-[#f5f5f5] text-[#373643]'} text-sm`}
                    onClick={() => setSelectedBillType('individual')}
                  >
                    <User className="h-6 w-6 mb-2" />
                    <span>Individual Bills</span>
                    <span className="text-xs text-[#373643]/60">Separate bill per person</span>
                  </Button>
                  
                  <Button
                    variant={selectedBillType === 'combined' ? 'default' : 'outline'}
                    className={`h-20 flex flex-col items-center justify-center border-[#373643]/10 ${selectedBillType === 'combined' ? 'bg-[#ba1d1d] text-white' : 'bg-[#f5f5f5] text-[#373643]'} text-sm`}
                    onClick={() => setSelectedBillType('combined')}
                  >
                    <Users className="h-6 w-6 mb-2" />
                    <span>Combined Bill</span>
                    <span className="text-xs text-[#373643]/60">Single bill for all</span>
                  </Button>
                  
                  <Button
                    variant={selectedBillType === 'custom' ? 'default' : 'outline'}
                    className={`h-20 flex flex-col items-center justify-center border-[#373643]/10 ${selectedBillType === 'custom' ? 'bg-[#ba1d1d] text-white' : 'bg-[#f5f5f5] text-[#373643]'} text-sm`}
                    onClick={() => setSelectedBillType('custom')}
                  >
                    <Calculator className="h-6 w-6 mb-2" />
                    <span>Custom Split</span>
                    <span className="text-xs text-[#373643]/60">Select specific people</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Customer Selection for Custom Split */}
            {selectedBillType === 'custom' && (
              <Card className="bg-[#f9f9f9] border border-[#e5e5e5]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[#373643]">Select Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  {tableSession.customers && tableSession.customers.length > 0 ? (
                    <div className="space-y-2">
                      {tableSession.customers.map(customer => (
                        <div key={customer.id} className="flex items-center justify-between p-3 border border-[#e5e5e5] rounded-lg bg-[#ffffff]">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedCustomers.includes(customer.id)}
                              onChange={() => handleCustomerToggle(customer.id)}
                              className="rounded border-[#ba1d1d] focus:ring-[#ba1d1d]"
                            />
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-[#373643]">{customer.name}</span>
                                {customer.isMainCustomer && (
                                  <Badge variant="default" className="text-xs bg-[#ba1d1d]/10 text-[#ba1d1d] border-none">Main</Badge>
                                )}
                              </div>
                              <span className="text-xs text-[#373643]/60">
                                {customer.orders?.length || 0} order{(customer.orders?.length || 0) !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-[#ba1d1d]">{formatCurrency(customer.totalAmount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-[#373643]/60">
                      No customers found for this session
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Bill Preview */}
            <Card className="bg-[#f9f9f9] border border-[#e5e5e5]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#373643]">Bill Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Check if there are any orders at all */}
                {tableSession.customers && tableSession.customers.filter(c => c.orders?.length > 0 && c.totalAmount > 0 && c.hasOrders).length === 0 ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="text-4xl">🛒</div>
                    <div className="space-y-2">
                      <h3 className="font-medium text-[#373643]">No Orders Yet</h3>
                      <p className="text-sm text-[#373643]/60">
                        Customers haven't placed any orders yet. Bills can only be generated after orders are placed.
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                      💡 Tip: Customers can scan the QR code on their table to view the menu and place orders
                    </div>
                  </div>
                ) : (
                  <div>
                {selectedBillType === 'individual' && (
                  <div className="space-y-4">
                    {tableSession.customers && tableSession.customers.length > 0 ? (
                      tableSession.customers.map(customer => {
                        const total = customer.totalAmount;

                        return (
                          <div key={customer.id} className={`p-4 border rounded-lg ${
                            customer.hasExistingBill ? 'bg-gray-50 border-gray-300' : 
                            customer.hasOrders ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
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
                                {!customer.hasOrders && !customer.hasExistingBill && (
                                  <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                                    No Orders
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
                              {!customer.hasOrders && !customer.hasExistingBill && (
                                <div className="text-xs text-gray-600 mt-2">
                                  Customer has not placed any orders
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
                  </div>
                )}
              </CardContent>
            </Card>
        </div>

        <DialogFooter className="px-6 pb-6 pt-0 border-t border-[#373643]/10">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-[#ba1d1d] text-white hover:bg-[#a11414] border-none shadow-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerateBills}
            disabled={isGenerating || 
              (selectedBillType === 'custom' && selectedCustomers.length === 0) ||
              (tableSession.customers && tableSession.customers.filter(c => c.orders?.length > 0 && c.totalAmount > 0 && c.hasOrders).length === 0)
            }
            variant="success"
            className="shadow-sm"
          >
            {isGenerating ? (
              <span className="flex items-center"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>Generating...</span>
            ) : (
              <><Receipt className="h-4 w-4 mr-2" /> Generate Bills</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 