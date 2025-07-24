import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { LiveOrders } from "@/components/dashboard/live-orders";
import { TablesOverview } from "@/components/dashboard/tables-overview";
import { PopularItems } from "@/components/dashboard/popular-items";
import { StaffOrderDialog } from "@/components/menu/staff-order-dialog";
import { CustomerNamesDialog } from "@/components/orders/customer-names-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useDashboardAnalytics } from "@/hooks/use-analytics-optimized";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Toast, ToastProvider, ToastViewport } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useTables, Table } from "@/hooks/use-tables";
import { useLang } from "@/contexts/language-context";
import { Plus } from "lucide-react";

interface WaiterRequest {
  restaurantId: number;
  tableId: number;
  customerName: string;
  timestamp: string;
  requestType?: string;
  tableSessionId?: number;
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  isMainCustomer: boolean;
}

interface SessionData {
  sessionName?: string;
  partySize: number;
  splitType: 'individual' | 'combined' | 'custom';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t, isLoading: langLoading } = useLang();
  const restaurantId = user?.restaurantId;
  const { toast } = useToast();
  const { tables: rawTables = [], isLoading: isTablesLoading } = useTables(restaurantId!);
  const tables: Table[] = Array.isArray(rawTables) ? rawTables : [];
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  
  // Use optimized analytics hook
  const { data: analyticsData, isLoading: isAnalyticsLoading, error: analyticsError } = useDashboardAnalytics(restaurantId, dateRange);
  
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>([]);
  const [selectedWaiterRequest, setSelectedWaiterRequest] = useState<WaiterRequest | null>(null);
  const [isWaiterDialogOpen, setIsWaiterDialogOpen] = useState(false);
  const [isTableSelectionOpen, setIsTableSelectionOpen] = useState(false);
  const [isCustomerNamesOpen, setIsCustomerNamesOpen] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedTableNumber, setSelectedTableNumber] = useState<number>(0);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);

  // Extract stats from analytics data with fallback
  const stats = {
    orderCount: analyticsData?.orderCount || 0,
    revenue: analyticsData?.revenue || 0,
    averageOrderValue: analyticsData?.averageOrderValue || 0,
    activeTables: analyticsData?.activeTables || 0,
    totalTables: analyticsData?.totalTables || 0
  };

  // Loading state combines language and analytics loading
  const isLoading = langLoading || isAnalyticsLoading;

  // Connect to WebSocket for real-time updates
  const { addEventListener } = useSocket(restaurantId);
  
  // Listen for waiter requests
  useEffect(() => {
    const handleWaiterRequest = (request: WaiterRequest) => {
      // Add new request to the list
      setWaiterRequests(prev => [request, ...prev]);
      
      // Show notification
      const requestTypeText = request.requestType === 'bill-payment' ? t('dashboardPage.waiterRequests.billPayment') : t('dashboardPage.waiterRequests.needsAssistance');
      toast({
        title: request.requestType === 'bill-payment' ? t('dashboardPage.waiterRequests.billPaymentTitle') : t('dashboardPage.waiterRequests.title'),
        description: t('dashboardPage.waiterRequests.description', { tableId: request.tableId, customerName: request.customerName, requestType: requestTypeText }),
        variant: "default"
      });
      
      // Play notification sound
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Error playing notification sound', e));
    };
    
    // Register event listener
    addEventListener('waiter-requested', handleWaiterRequest);
    
    // Cleanup
    return () => {
      // No need to remove event listener, this is handled by the useSocket hook cleanup
    };
  }, [addEventListener, toast]);

  const handleStartNewOrder = () => {
    setIsTableSelectionOpen(true);
  };

  const handleTableSelected = (tableId: number, tableNumber: number) => {
    setSelectedTableId(tableId);
    setSelectedTableNumber(tableNumber);
    setIsTableSelectionOpen(false);
    setIsCustomerNamesOpen(true);
  };

  const handleCustomersCollected = async (customers: Customer[], sessionData: SessionData) => {
    try {
      setIsCustomerNamesOpen(false);
      
      // Create table session
      const session = await apiRequest({
        method: 'POST',
        url: `/api/restaurants/${restaurantId}/table-sessions`,
        data: {
          tableId: selectedTableId,
          sessionName: sessionData.sessionName,
          partySize: sessionData.partySize,
          splitType: sessionData.splitType
        }
      });

      setCurrentSessionId(session.id);

      // Create customers
      for (const customer of customers) {
        await apiRequest({
          method: 'POST',
          url: `/api/restaurants/${restaurantId}/customers`,
          data: {
            tableSessionId: session.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            isMainCustomer: customer.isMainCustomer
          }
        });
      }

      // Mark table as occupied
      await apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/tables/${selectedTableId}`,
        data: { isOccupied: true }
      });

      toast({
        title: t('dashboardPage.toast.sessionStarted.title'),
        description: t('dashboardPage.toast.sessionStarted.description', { tableNumber: selectedTableNumber, count: customers.length }),
      });

      // Open order dialog
      setShowOrderDialog(true);
      
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: t('dashboardPage.toast.sessionFailed.title'),
        description: t('dashboardPage.toast.sessionFailed.description'),
        variant: "destructive"
      });
    }
  };

  const handleOrderPlaced = () => {
    // Reset state
    setSelectedTableId(null);
    setSelectedTableNumber(0);
    setCurrentSessionId(null);
    setShowOrderDialog(false);
    
    // React Query will automatically refresh analytics data
  };

  // Add loading state for language
  if (langLoading) {
    return (
      <Layout
        title={t("dashboard", "Dashboard")}
        description={t("dashboardDescription", "Overview of your restaurant performance")}
        requireAuth
        allowedRoles={['restaurant']}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-red-600 rounded-full mx-auto mb-2"></div>
            <p className="text-gray-500">{t("loading", "Loading...")}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={t("dashboard", "Dashboard")}
      description={t("dashboardDescription", "Overview of your restaurant performance")}
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        {/* Waiter Requests Alert - Only show if there are active requests */}
        {waiterRequests.length > 0 && (
          <Alert className="bg-[#ba1d1d]/10 border-[#ba1d1d]/20 relative">
            <span className="material-icons text-[#ba1d1d] mr-2">notifications_active</span>
            <AlertTitle className="text-[#ba1d1d]">{t('dashboardPage.waiterRequests.title')}</AlertTitle>
            <AlertDescription className="text-[#373643]/80">
              {waiterRequests.length} {waiterRequests.length === 1 ? t('dashboardPage.waiterRequests.single', { count: waiterRequests.length }) : t('dashboardPage.waiterRequests.multiple', { count: waiterRequests.length })}
              <Button 
                variant="link" 
                className="text-[#ba1d1d] hover:text-[#ba1d1d]/80 p-0 ml-2 underline" 
                onClick={() => {
                  setSelectedWaiterRequest(waiterRequests[0]);
                  setIsWaiterDialogOpen(true);
                }}
              >
                {t('dashboardPage.waiterRequests.view')}
              </Button>
            </AlertDescription>
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-[#ba1d1d]/10 text-[#ba1d1d] hover:text-[#ba1d1d]/80"
              onClick={() => {
                setWaiterRequests([]);
                toast({
                  title: t('dashboardPage.waiterRequests.cleared'),
                  description: t('dashboardPage.waiterRequests.clearedDescription'),
                });
              }}
              title={t('dashboardPage.waiterRequests.clearAll')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </Button>
          </Alert>
        )}
        
        {/* Stats Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div></div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <Select
              value={dateRange}
              onValueChange={(value: any) => setDateRange(value)}
            >
              <SelectTrigger className="bg-[#ffffff] border-[#373643]/20 rounded-md shadow-sm py-2 px-3 text-sm w-[140px]">
                <SelectValue placeholder={t("selectRange", "Select Range")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("today", "Today")}</SelectItem>
                <SelectItem value="week">{t("thisWeek", "This Week")}</SelectItem>
                <SelectItem value="month">{t("thisMonth", "This Month")}</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ba1d1d] transition-all duration-200"
              onClick={handleStartNewOrder}
            >
              <span className="material-icons mr-2 text-sm">add</span>
              {t("newOrder", "New Order")}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Orders */}
          <StatsCard
            title={t("totalOrders", "Total Orders")}
            value={isLoading ? t("loading", "Loading...") : stats.orderCount.toString()}
            icon="receipt"
            iconColor="text-[#ba1d1d]"
            iconBgClass="bg-[#ba1d1d]/10"
            trend={{
              value: "12.5%",
              label: t("fromLastPeriod", "from last period"),
              isPositive: true
            }}
          />

          {/* Revenue */}
          <StatsCard
            title={t("revenue", "Revenue")}
            value={isLoading ? t("loading", "Loading...") : formatCurrency(stats.revenue)}
            icon="payments"
            iconColor="text-green-600"
            iconBgClass="bg-green-100"
            trend={{
              value: "8.2%",
              label: t("fromLastPeriod", "from last period"),
              isPositive: true
            }}
          />

          {/* Avg Order Value */}
          <StatsCard
            title={t("avgOrderValue", "Avg Order Value")}
            value={isLoading ? t("loading", "Loading...") : formatCurrency(stats.averageOrderValue)}
            icon="attach_money"
            iconColor="text-blue-600"
            iconBgClass="bg-blue-100"
            trend={{
              value: "2.3%",
              label: t("fromLastPeriod", "from last period"),
              isPositive: false
            }}
          />

          {/* Active Tables */}
          <StatsCard
            title={t("activeTables", "Active Tables")}
            value={isLoading ? t("loading", "Loading...") : `${stats.activeTables}/${stats.totalTables}`}
            icon="table_restaurant"
            iconColor="text-orange-600"
            iconBgClass="bg-orange-100"
            trend={{
              value: stats.activeTables.toString(),
              label: t("tablesOccupied", "tables occupied"),
              isPositive: true
            }}
          />
        </div>

        {/* Live Orders Section */}
        <LiveOrders restaurantId={restaurantId} />

        {/* Tables Overview and Menu Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TablesOverview restaurantId={restaurantId} waiterRequests={waiterRequests} />
          <PopularItems restaurantId={restaurantId} dateRange={dateRange} />
        </div>
      </div>

      {/* Waiter Request Details Dialog */}
      <Dialog open={isWaiterDialogOpen} onOpenChange={setIsWaiterDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#373643] flex items-center justify-between">
              {t('dashboardPage.waiterRequests.dialogTitle')}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100"
                onClick={() => setIsWaiterDialogOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {waiterRequests.length > 0 ? (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {waiterRequests.map((request, index) => (
                  <div 
                    key={index} 
                    className="bg-[#ffffff] p-4 rounded-lg border border-[#373643]/10 relative"
                  >
                    <div className="flex items-center justify-between pr-8">
                      <div>
                        <p className="font-medium text-[#373643]">{t('table')} {request.tableId}</p>
                        <p className="text-sm text-[#373643]/60">{request.customerName}</p>
                        {request.requestType === 'bill-payment' && (
                          <p className="text-xs text-green-600 font-medium">{t('dashboardPage.waiterRequests.billPayment')}</p>
                        )}
                      </div>
                      <div className="text-sm text-[#373643]/60">
                        {new Date(request.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    {/* Individual request dismiss button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-red-100 text-red-600 hover:text-red-700"
                      onClick={() => {
                        const updatedRequests = waiterRequests.filter((_, i) => i !== index);
                        setWaiterRequests(updatedRequests);
                        toast({
                          title: "Request Resolved",
                          description: `Waiter request for Table ${request.tableId} has been resolved.`,
                        });
                        if (updatedRequests.length === 0) {
                          setIsWaiterDialogOpen(false);
                        }
                      }}
                      title="Resolve this request"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[#373643]/60">{t('dashboardPage.waiterRequests.noRequests')}</p>
            )}
          </div>

          <DialogFooter className="space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsWaiterDialogOpen(false)}
              className="border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5"
            >
              {t('close')}
            </Button>
            {waiterRequests.length > 0 && (
              <Button
                onClick={() => {
                  setWaiterRequests([]);
                  setIsWaiterDialogOpen(false);
                  toast({
                    title: t('dashboardPage.waiterRequests.cleared'),
                    description: t('dashboardPage.waiterRequests.clearedDescription'),
                  });
                }}
                className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white"
              >
                {t('dashboardPage.waiterRequests.resolveAll')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Selection Dialog */}
      <Dialog open={isTableSelectionOpen} onOpenChange={setIsTableSelectionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#373643]">{t('dashboardPage.tableSelection.title')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {isTablesLoading ? (
              <div className="text-center text-[#373643]/60">{t('loadingTables')}</div>
            ) : (
              <>
                <label className="block mb-2 font-medium text-[#373643]">{t('dashboardPage.tableSelection.selectVacant')}</label>
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {tables.filter((t: Table) => !t.isOccupied).map((table: Table) => (
                    <Button
                      key={table.id}
                      variant="outline"
                      className="h-16 flex flex-col items-center justify-center hover:bg-blue-50 hover:border-blue-300"
                      onClick={() => handleTableSelected(table.id, table.number)}
                    >
                      <span className="font-semibold">{t('table')} {table.number}</span>
                      <span className="text-xs text-gray-500">{t('dashboardPage.tableSelection.capacity', { capacity: (table as any).capacity || 4 })}</span>
                    </Button>
                  ))}
                </div>
                {tables.filter((t: Table) => !t.isOccupied).length === 0 && (
                  <p className="text-center text-gray-500 py-4">{t('dashboardPage.tableSelection.noVacant')}</p>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setIsTableSelectionOpen(false)} 
              variant="outline"
              className="border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5"
            >
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Names Dialog */}
      <CustomerNamesDialog
        isOpen={isCustomerNamesOpen}
        onOpenChange={setIsCustomerNamesOpen}
        tableNumber={selectedTableNumber}
        onCustomersCollected={handleCustomersCollected}
      />

      {/* Staff Order Dialog */}
      <StaffOrderDialog
        restaurantId={restaurantId!}
        selectedTableId={selectedTableId!}
        tableSessionId={currentSessionId}
        isOpen={showOrderDialog}
        onOpenChange={setShowOrderDialog}
        onOrderPlaced={handleOrderPlaced}
      />
    </Layout>
  );
}
