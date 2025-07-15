import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/contexts/language-context";
import { useTables, Table } from "@/hooks/use-tables";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StaffOrderDialog } from "@/components/menu/staff-order-dialog";
import { CustomerNamesDialog } from "@/components/orders/customer-names-dialog";
import { BillGenerationDialog } from "@/components/orders/bill-generation-dialog";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { TableCard } from "@/components/tables/table-card";
import { 
  Users, 
  Receipt, 
  Clock, 
  CreditCard, 
  User, 
  Table as TableIcon,
  Plus,
  Settings,
  Eye,
  DollarSign,
  Calendar
} from "lucide-react";

// Form schema for table
const tableSchema = z.object({
  number: z.string().refine((val) => !isNaN(parseInt(val)), { message: "Table number must be a number" }),
  capacity: z.string().refine((val) => !isNaN(parseInt(val)) && parseInt(val) > 0, { message: "Capacity must be a positive number" }).optional()
});

interface Customer {
  id: number;
  name: string;
  email?: string;
  isMainCustomer: boolean;
  paymentStatus?: string;
  phone?: string;
}

interface SessionData {
  sessionName?: string;
  partySize: number;
  splitType: "individual" | "combined" | "custom";
}

interface TableSession {
  id: number;
  sessionName?: string;
  partySize: number;
  splitType: string;
  totalAmount: string;
  paidAmount?: string;
  status: string;
  startTime: string;
  customers: Customer[];
  table: {
    id: number;
    number: number;
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
  paymentMethod: string;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
  paidAt?: string;
  customer?: {
    id: number;
    name: string;
    email?: string;
    isMainCustomer?: boolean;
  };
  tableSession?: {
    id: number;
    table: {
      number: number;
    };
  };
  allCustomers?: Customer[];
}

export default function Tables() {
  const { user } = useAuth();
  const { t } = useLang();
  const restaurantId = user?.restaurantId;
  const { tables, isLoading, createTable, updateTable, deleteTable } = useTables(restaurantId!);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'tables' | 'sessions' | 'bills'>('tables');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [tableSessions, setTableSessions] = useState<TableSession[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [isCustomerNamesOpen, setIsCustomerNamesOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | null>(null);
  const [isBillGenerationOpen, setIsBillGenerationOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isBillDetailsOpen, setIsBillDetailsOpen] = useState(false);
  
  const form = useForm<z.infer<typeof tableSchema>>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      number: "",
      capacity: "4"
    }
  });

  // Fetch table sessions
  useEffect(() => {
    const fetchTableSessions = async () => {
      if (!restaurantId || activeTab !== 'sessions') return;
      
      setIsLoadingSessions(true);
      try {
        const sessions = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions`
        });
        // Filter to show active AND waiting sessions in the UI
        // Both states represent customers at tables who need staff attention
        const activeAndWaitingSessions = sessions.filter((session: TableSession) => 
          session.status === 'active' || session.status === 'waiting'
        );
        setTableSessions(activeAndWaitingSessions || []);
      } catch (error) {
        console.error('Error fetching table sessions:', error);
        toast({
          title: t("error", "Error"),
          description: t("failedToFetchTableSessions", "Failed to fetch table sessions"),
          variant: "destructive"
        });
      } finally {
        setIsLoadingSessions(false);
      }
    };

    fetchTableSessions();
  }, [restaurantId, activeTab, toast]);

  // Fetch bills
  useEffect(() => {
    const fetchBills = async () => {
      if (!restaurantId || activeTab !== 'bills') return;
      
      setIsLoadingBills(true);
      try {
        // Get all table sessions once
        const sessions = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions`
        });

        // Fetch all bills in a single request instead of per session
        const allBillsRaw = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/bills`
        });
        // Use TableSession type for sessions
        const sessionMap: Record<number, TableSession> = Object.fromEntries((sessions as TableSession[]).map((s) => [s.id, s]));
        const allBills = (allBillsRaw as Bill[]).map((bill) => {
          const session = sessionMap[bill.tableSessionId];
          return {
            ...bill,
            tableSession: session
              ? {
              id: session.id,
              table: {
                number: session.table?.number || 0
              }
                }
              : undefined,
            allCustomers: session?.customers || []
          };
        });
        setBills(
          allBills.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          })
        );
      } catch (error) {
        console.error('Error fetching bills:', error);
        toast({
          title: t("error", "Error"),
          description: t("failedToFetchBills", "Failed to fetch bills"),
          variant: "destructive"
        });
      } finally {
        setIsLoadingBills(false);
      }
    };

    fetchBills();
  }, [restaurantId, activeTab, toast]);

  const handleAddNewTable = () => {
    setEditingTable(null);
    
    // Calculate the next available table number
    let nextTableNumber = 1;
    if (tables && tables.length > 0) {
      const existingNumbers = tables.map(table => table.number).sort((a, b) => a - b);
      
      // Find the first gap in the sequence or use the next number after the highest
      for (let i = 1; i <= existingNumbers.length + 1; i++) {
        if (!existingNumbers.includes(i)) {
          nextTableNumber = i;
          break;
        }
      }
    }
    
    form.reset({ 
      number: nextTableNumber.toString(), 
      capacity: "4" 
    });
    setIsDialogOpen(true);
  };

  const handleEditTable = (table: Table) => {
    setEditingTable(table);
    form.reset({ 
      number: table.number.toString(),
      capacity: (table.capacity || 4).toString()
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTable = async (tableId: number) => {
    try {
      await deleteTable(tableId);
      toast({
        title: t("success", "Success"),
        description: t("tableDeletedDescription", "The table has been successfully deleted.")
      });
    } catch (error) {
      toast({
        title: t("error", "Error"),
        description: t("failedToDeleteTable", "Failed to delete table."),
        variant: "destructive"
      });
    }
  };

  const handleToggleOccupied = async (tableId: number, isOccupied: boolean) => {
    try {
      await updateTable({
        tableId,
        data: { isOccupied: !isOccupied }
      });
      toast({
        title: isOccupied ? "Table marked as free" : "Table marked as occupied",
        description: `Table status has been updated.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update table status.",
        variant: "destructive"
      });
    }
  };

  const handleStartSession = async (tableId: number, tableNumber: number) => {
    setSelectedTableId(tableId);
    setSelectedTableNumber(tableNumber);
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
          splitType: sessionData.splitType,
          status: 'waiting',
          totalAmount: "0.00",
          paidAmount: "0.00"
        }
      });

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

      // Refresh tables and sessions
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/tables`]
      });

      const updatedSessions = await apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/table-sessions`
      });
      // Filter to show active AND waiting sessions in the UI
      const activeAndWaitingSessions = updatedSessions.filter((session: TableSession) => 
        session.status === 'active' || session.status === 'waiting'
      );
      setTableSessions(activeAndWaitingSessions);

      toast({
        title: "Session Started",
        description: `Table ${selectedTableNumber} session created with ${customers.length} customers`,
      });
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: "Error",
        description: "Failed to create table session",
        variant: "destructive"
      });
    }
  };

  const handleGenerateBills = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    setIsBillGenerationOpen(true);
  };

  const handleBillGenerated = async () => {
    queryClient.invalidateQueries({
      queryKey: [`/api/restaurants/${restaurantId}/table-sessions/${selectedSessionId}/bills`]
    });
    
    // Refresh bills if we're on the bills tab
    if (activeTab === 'bills' && restaurantId) {
      setIsLoadingBills(true);
      try {
        const sessions = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions`
        });

        // Fetch all bills in a single request instead of per session
        const allBillsRaw = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/bills`
        });
        // Use TableSession type for sessions
        const sessionMap: Record<number, TableSession> = Object.fromEntries((sessions as TableSession[]).map((s) => [s.id, s]));
        const allBills = (allBillsRaw as Bill[]).map((bill) => {
          const session = sessionMap[bill.tableSessionId];
          return {
            ...bill,
            tableSession: session
              ? {
              id: session.id,
              table: {
                number: session.table?.number || 0
              }
                }
              : undefined,
            allCustomers: session?.customers || []
          };
        });
        setBills(
          allBills.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          })
        );
      } catch (error) {
        console.error('Error refreshing bills:', error);
      } finally {
        setIsLoadingBills(false);
      }
    }
    
    toast({
      title: "Bills Generated",
      description: "Bills have been successfully generated",
    });
  };

  const handleEndSession = async (sessionId: number) => {
    try {
      // First check if any bills exist for this session
      let sessionBills;
      try {
        sessionBills = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions/${sessionId}/bills`
        });
      } catch (error) {
        // If bills endpoint fails or returns 404, assume no bills exist
        console.log('No bills found for session, proceeding to end session');
        sessionBills = [];
      }

      // If bills exist, check if they're all paid
      if (sessionBills && sessionBills.length > 0) {
        const unpaidBills = sessionBills.filter((bill: Bill) => bill.status !== 'paid');
        
        if (unpaidBills.length > 0) {
          toast({
            title: "Cannot End Session",
            description: `There are ${unpaidBills.length} unpaid bills. All bills must be paid before ending the session.`,
            variant: "destructive"
          });
          return;
        }
      }

      // If no bills exist or all bills are paid, end the session
      await apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/table-sessions/${sessionId}`,
        data: { 
          status: 'completed',
          endTime: new Date().toISOString()
        }
      });

      // Get session details to mark table as vacant
      const sessionResponse = await apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/table-sessions/${sessionId}`
      });
      const session = sessionResponse;

      if (session.tableId) {
        // Mark table as not occupied
        await apiRequest({
          method: 'PUT',
          url: `/api/restaurants/${restaurantId}/tables/${session.tableId}`,
          data: { isOccupied: false }
        });
      }

      // Refresh data
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/tables`]
      });

      const updatedSessions = await apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/table-sessions`
      });
      // Filter to show only active sessions in the UI
      const activeSessions = updatedSessions.filter((session: TableSession) => session.status === 'active');
      setTableSessions(activeSessions);

      toast({
        title: "Session Ended",
        description: "Table session has been completed successfully",
      });
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: "Error",
        description: "Failed to end session",
        variant: "destructive"
      });
    }
  };

  const onSubmit = async (data: z.infer<typeof tableSchema>) => {
    try {
      const tableNumber = parseInt(data.number);
      const capacity = data.capacity ? parseInt(data.capacity) : 4;
      
      if (editingTable) {
        // Update existing table
        await updateTable({
          tableId: editingTable.id,
          data: { number: tableNumber, capacity }
        });
        toast({
          title: "Table updated",
          description: "The table has been successfully updated."
        });
      } else {
        // Create new table
        await createTable({ 
          number: tableNumber, 
          capacity, 
          isOccupied: false, 
          qrCode: '', 
          restaurantId: restaurantId! 
        });
        toast({
          title: "Table created",
          description: "The new table has been successfully added."
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save table.",
        variant: "destructive"
      });
    }
  };

  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'waiting': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'requesting_bill': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'abandoned': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSessionStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active (Ordered)';
      case 'waiting': return 'Waiting (Browsing)';
      case 'requesting_bill': return 'Requesting Bill';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'abandoned': return 'Abandoned';
      default: return status;
    }
  };

  const getSessionDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  const isSessionAtRisk = (status: string, startTime: string) => {
    if (status !== 'waiting') return false;
    const start = new Date(startTime);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
    return diffMinutes > 20; // At risk if waiting for more than 20 minutes
  };

  const handleMarkBillAsPaid = async (billId: number) => {
    try {
      await apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/bills/${billId}`,
        data: { status: 'paid' }
      });
      
      // Refresh bills data
      if (activeTab === 'bills' && restaurantId) {
        setIsLoadingBills(true);
        try {
          const sessions = await apiRequest({
            method: 'GET',
            url: `/api/restaurants/${restaurantId}/table-sessions`
          });

          // Fetch all bills in a single request instead of per session
          const allBillsRaw = await apiRequest({
            method: 'GET',
            url: `/api/restaurants/${restaurantId}/bills`
          });
          // Use TableSession type for sessions
          const sessionMap: Record<number, TableSession> = Object.fromEntries((sessions as TableSession[]).map((s) => [s.id, s]));
          const allBills = (allBillsRaw as Bill[]).map((bill) => {
            const session = sessionMap[bill.tableSessionId];
            return {
              ...bill,
              tableSession: session
                ? {
                id: session.id,
                table: {
                  number: session.table?.number || 0
                }
                  }
                : undefined,
              allCustomers: session?.customers || []
            };
          });
          setBills(
            allBills.sort((a, b) => {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              return dateB - dateA;
            })
          );
        } catch (error) {
          console.error('Error refreshing bills:', error);
        } finally {
          setIsLoadingBills(false);
        }
      }
      
      // Refresh table sessions to reflect updated payment status
      const updatedSessions = await apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/table-sessions`
      });
      // Filter to show active AND waiting sessions in the UI
      const activeAndWaitingSessions = updatedSessions.filter((session: any) => 
        session.status === 'active' || session.status === 'waiting'
      );
      setTableSessions(activeAndWaitingSessions);
      
      // Also refresh tables query to update table occupancy status
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/tables`]
      });

      toast({
        title: "Bill marked as paid",
        description: "Bill status updated successfully",
      });
    } catch (error: unknown) {
      console.error('Error marking bill as paid:', error);
      let errorMessage = "Failed to mark bill as paid";
      
      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response) {
        const responseData = error.response.data as any;
        if (responseData?.message) {
          errorMessage = responseData.message;
        } else if (responseData?.errors && Array.isArray(responseData.errors)) {
          errorMessage = responseData.errors.map((e: any) => e.message).join(', ');
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  // Helper function to check if customer has placed any order
  function customerHasOrder(customer: Customer, session: TableSession): boolean {
    // This assumes you have access to orders in session or can fetch them; for now, fallback to paymentStatus
    // If you have order data, replace this logic
    return customer.paymentStatus === 'paid' || customer.paymentStatus === 'partial';
  }

  const refreshSessions = async () => {
    // Your logic to reload sessions from the backend
    const fetchSessions = async () => {
      if (!restaurantId) return;
      
      try {
        const sessions = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions`
        });
        // Filter to show active AND waiting sessions in the UI
        const activeAndWaitingSessions = sessions.filter((session: TableSession) => 
          session.status === 'active' || session.status === 'waiting'
        );
        setTableSessions(activeAndWaitingSessions || []);
      } catch (error) {
        console.error('Error fetching table sessions:', error);
      }
    };
    
    await fetchSessions();
  };

  useEffect(() => {
    (window as any).refreshSessions = refreshSessions;
    return () => { (window as any).refreshSessions = undefined; };
  }, [restaurantId]);

  return (
    <Layout
      title={t("tables", "Tables")}
      description={t("tablesDescription", "Manage tables, customer sessions, and billing")}
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "tables" | "sessions" | "bills")}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tables" className="flex items-center space-x-2">
              <TableIcon className="h-4 w-4" />
              <span>{t("tables", "Tables")}</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>{t("activeSessions", "Active Sessions")}</span>
            </TabsTrigger>
            <TabsTrigger value="bills" className="flex items-center space-x-2">
              <Receipt className="h-4 w-4" />
              <span>{t("bills", "Bills")}</span>
              {bills.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {bills.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {t("tablesOverview", "Tables Overview")}
              </h3>
              <Button 
                onClick={handleAddNewTable}
                className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white font-semibold shadow-md transition-all duration-200"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("addTable", "Add Table")}
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-gray-500 dark:text-gray-400">{t("loadingTables", "Loading tables...")}</p>
              </div>
            ) : tables && tables.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tables.map(table => (
                  <div key={table.id} className="space-y-2">
                    <TableCard
                      table={table}
                      onEdit={() => handleEditTable(table)}
                      onDelete={() => handleDeleteTable(table.id)}
                      onToggleOccupied={() => handleToggleOccupied(table.id, table.isOccupied)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">{t("noTables", "No tables found")}</p>
                <Button 
                  onClick={handleAddNewTable}
                  variant="outline"
                  className="mt-4 border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5"
                >
                  {t("addYourFirstTable", "Add your first table")}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            {/* Subtle Header */}
            <div className="rounded-xl bg-[#ffffff] border border-[#373643]/10 shadow-sm flex items-center justify-between mb-6 p-5">
              <div>
                <h3 className="text-xl font-semibold text-[#373643]">
                {t("activeDiningSessions", "Active Dining Sessions")}
              </h3>
                <p className="text-sm text-[#373643]/60">
                  {t("manageActiveSessions", "Manage and monitor your active dining sessions")}
                </p>
              </div>
              <div className="rounded-lg bg-[#ffffff] px-4 py-2 border border-[#373643]/10 text-sm text-[#373643] shadow">
                {tableSessions.length} {t("activeSessions", "Active Sessions")}
              </div>
            </div>

            {isLoadingSessions ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-[#ffffff] border border-[#373643]/10 shadow-sm rounded-xl p-4 animate-pulse" />
                ))}
              </div>
            ) : tableSessions && tableSessions.length > 0 ? (
              <div className="space-y-4">
                {tableSessions.map(session => session && (
                  <Card key={session.id} className="bg-[#ffffff] border border-[#373643]/10 shadow-sm rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TableIcon className="h-5 w-5 text-[#ba1d1d]" />
                        <span className="text-base font-medium text-[#373643]">
                              {t("table", "Table")} {session.table?.number || t("unknown", "Unknown")}
                            </span>
                        <Badge className="bg-green-50 text-green-700 border-green-100 text-xs font-normal px-2 py-0.5">
                              {getSessionStatusText(session.status)}
                            </Badge>
                        <span className="text-xs text-[#373643]/60">{getSessionDuration(session.startTime)}</span>
                          </div>
                      <div className="flex gap-2">
                            <Button
                              size="sm"
                          variant="success"
                          className="shadow-sm"
                            onClick={() => handleGenerateBills(session.id)}
                          disabled={session.status === 'completed' || session.status === 'cancelled'}
                          >
                            {t("bills", "Bills")}
                          </Button>
                          <Button
                            size="sm"
                          variant="destructive"
                          className="shadow-sm"
                            onClick={() => handleEndSession(session.id)}
                          disabled={session.status === 'completed' || session.status === 'cancelled'}
                          >
                            {t("endSession", "End Session")}
                          </Button>
                        </div>
                      </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                      <div className="flex items-center gap-2 bg-[#f5f5f5] rounded-lg px-3 py-2">
                        <Users className="h-4 w-4 text-[#ba1d1d]" />
                        <span className="text-sm text-[#373643] font-medium">{session.partySize} {t("people", "People")}</span>
                        <span className="text-xs text-[#373643]/60">{session.splitType} {t("billing", "billing")}</span>
                            </div>
                      <div className="flex items-center gap-2 bg-[#f5f5f5] rounded-lg px-3 py-2">
                        <Clock className="h-4 w-4 text-[#ba1d1d]" />
                        <span className="text-sm text-[#373643] font-medium">{new Date(session.startTime).toLocaleTimeString()}</span>
                        <span className="text-xs text-[#373643]/60">{t("started", "Started")}</span>
                            </div>
                      <div className="flex items-center gap-2 bg-[#f5f5f5] rounded-lg px-3 py-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-[#373643] font-medium">{formatCurrency(parseFloat(session.totalAmount || '0'))}</span>
                        <span className="text-xs text-[#373643]/60">{parseFloat(session.paidAmount || '0') > 0 ? `${formatCurrency(parseFloat(session.paidAmount || '0'))} ${t("paid", "paid")}` : t("total", "Total")}</span>
                          </div>
                      <div className="flex items-center gap-2 bg-[#f5f5f5] rounded-lg px-3 py-2">
                        <User className="h-4 w-4 text-[#ba1d1d]" />
                        <span className="text-sm text-[#373643] font-medium">{session.customers.find(c => c.isMainCustomer)?.name || t("unknown", "Unknown")}</span>
                        <span className="text-xs text-[#373643]/60">{t("mainContact", "Main contact")}</span>
                        </div>
                            </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[#373643]">{t("customers", "Customers")}</span>
                        <span className="text-xs text-[#373643]/60">{session.customers.filter(c => c.paymentStatus === 'paid').length} / {session.customers.length} {t("paid", "paid")}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {session.customers.map(customer => (
                            <Badge 
                              key={customer.id} 
                            variant={
                              !customer.paymentStatus && !customerHasOrder(customer, session)
                                ? "ghost"
                                : customer.isMainCustomer
                                  ? "default"
                                  : "outline"
                            }
                            className={`text-xs px-2 py-0.5 rounded bg-[#f5f5f5] border border-[#e5e5e5] text-[#373643] ${
                                customer.paymentStatus === 'paid' 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                  : ''
                              }`}
                            title={
                              !customer.paymentStatus && !customerHasOrder(customer, session)
                                ? t('ghostCustomerTooltip', 'No order placed — ghost customer (will be auto-removed)')
                                : ''
                            }
                            >
                              {customer.name}
                              {customer.isMainCustomer && ` ${t("mainContact", "Main")}`}
                              {customer.paymentStatus === 'paid' && " ✓"}
                            {!customer.paymentStatus && !customerHasOrder(customer, session) && (
                              <span className="ml-1 text-xs italic">({t("noOrder", "No order placed")})</span>
                            )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[#ffffff] border border-[#373643]/10 shadow-sm p-8 text-center">
                <Users className="h-10 w-10 text-[#ba1d1d] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[#373643] mb-2">{t("noActiveSessions", "No Active Sessions")}</h3>
                <p className="text-sm text-[#373643]/60 mb-2">{t("startSessionFromTables", "Start a session from the Tables tab to begin serving customers")}</p>
                <div className="bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg px-4 py-2 inline-block text-xs text-[#373643]/60">
                  💡 {t("tip", "Tip")}: {t("clickTableToStart", "Click on any table to start a new session")}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Bills Tab */}
          <TabsContent value="bills" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-[#373643] dark:text-white">
                {t("generatedBills", "Generated Bills")}
              </h3>
              <Badge variant="outline" className="text-lg px-3 py-1 border-[#ba1d1d] text-[#ba1d1d]">
                {bills.length} {bills.length === 1 ? t("bill", "Bill") : t("bills", "Bills")}
              </Badge>
            </div>

            {isLoadingBills ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-[#ba1d1d] border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-[#373643]/60 dark:text-gray-400">{t("loadingBills", "Loading bills...")}</p>
              </div>
            ) : bills && bills.length > 0 ? (
              <div className="grid gap-6">
                {bills.map(bill => (
                  <Card key={bill.id} className="overflow-hidden border-l-4 border-l-[#ba1d1d] bg-[#fff] border border-[#373643]/10 shadow-sm rounded-xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          {/* Primary Bill Info */}
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Receipt className="h-6 w-6 text-[#ba1d1d]" />
                              <h3 className="text-xl font-bold text-[#373643]">
                                {t("table", "Table")} {bill.tableSession?.table?.number || t("unknown", "Unknown")}
                              </h3>
                            </div>
                            <div className="text-2xl font-bold text-[#178a29]">
                              {formatCurrency(parseFloat(bill.total || '0'))}
                            </div>
                          </div>
                          {/* Customer Names - Prominent Display */}
                          <div className="space-y-1">
                            {/* Individual Bills - Show specific customer */}
                            {bill.type === 'individual' && bill.customer && bill.customer.name && (
                              <div className="flex items-center space-x-2">
                                <User className="h-5 w-5 text-[#ba1d1d]" />
                                <span className="text-lg font-semibold text-[#373643]">
                                  {bill.customer.name}
                                </span>
                                {bill.customer.isMainCustomer && (
                                  <Badge variant="outline" className="text-xs border-[#ba1d1d] text-[#ba1d1d]">{t("mainContact", "Main Contact")}</Badge>
                                )}
                                <span className="text-sm text-[#373643]/60">• {t("individualBill", "Individual Bill")}</span>
                              </div>
                            )}
                            {/* Combined Bills - Show all customers from session */}
                            {bill.type === 'combined' && (
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <Users className="h-5 w-5 text-[#ba1d1d]" />
                                  <span className="text-lg font-semibold text-[#373643]">
                                    {t("combinedBillForAllCustomers", "Combined Bill for All Customers")}
                                  </span>
                                  {bill.allCustomers && bill.allCustomers.length > 0 && (
                                    <span className="text-sm text-[#373643]/60">• {bill.allCustomers.length} {t("people", "people")}</span>
                                  )}
                                </div>
                                {bill.allCustomers && bill.allCustomers.length > 0 && (
                                  <div className="flex flex-wrap gap-1 ml-7">
                                    {bill.allCustomers.map((customer, index) => (
                                      <span key={customer.id} className="inline-flex items-center">
                                        <span className="text-sm font-medium text-[#373643]">{customer.name}</span>
                                        {customer.isMainCustomer && (
                                          <Badge variant="outline" className="ml-1 text-xs border-[#ba1d1d] text-[#ba1d1d]">{t("mainContact", "Main")}</Badge>
                                        )}
                                        {index < bill.allCustomers!.length - 1 && (
                                          <span className="text-[#373643]/30 mx-1">•</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Partial Bills - Show specific customer or multiple customers */}
                            {bill.type === 'partial' && (
                              <div className="flex items-center space-x-2">
                                <User className="h-5 w-5 text-[#ba1d1d]" />
                                <span className="text-lg font-semibold text-[#373643]">
                                  {bill.customer?.name || t("selectedCustomers", "Selected Customers")}
                                </span>
                                <span className="text-sm text-[#373643]/60">• {t("partialBill", "Partial Bill")}</span>
                              </div>
                            )}
                            {/* Fallback for Individual bills without customer data */}
                            {bill.type === 'individual' && (!bill.customer || !bill.customer.name) && (
                              <div className="flex items-center space-x-2">
                                <User className="h-5 w-5 text-[#ba1d1d]/30" />
                                <span className="text-lg font-semibold text-[#373643]/40">
                                  {t("individualBill", "Individual Bill")} (ID: {bill.customerId || t("unknown", "Unknown")})
                                </span>
                                <span className="text-sm text-[#373643]/60">{t("customerDataUnavailable", "Customer data unavailable")}</span>
                              </div>
                            )}
                            {/* Fallback for Combined bills without session data */}
                            {bill.type === 'combined' && (!bill.allCustomers || bill.allCustomers.length === 0) && (
                              <div className="flex items-center space-x-2">
                                <Users className="h-5 w-5 text-[#ba1d1d]/30" />
                                <span className="text-lg font-semibold text-[#373643]">
                                  {t("combinedBill", "Combined Bill")}
                                </span>
                                <span className="text-sm text-[#373643]/60">{t("allCustomersOnTable", "All customers on table")}</span>
                              </div>
                            )}
                          </div>
                          {/* Secondary Info */}
                          <div className="flex items-center space-x-4 text-sm text-[#373643]/70">
                            <span className="flex items-center space-x-1">
                              <span>{t("billNumber", "Bill #")}{bill.billNumber.split('-').pop()}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span>•</span>
                              <span>{t("createdAt", "Created")} {new Date(bill.createdAt).toLocaleDateString()}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span>•</span>
                              <span className="capitalize">{bill.paymentMethod}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge className={`border px-3 py-1 text-sm font-medium ${
                            bill.status === 'paid' 
                              ? 'bg-[#178a29]/10 text-[#178a29] border-[#178a29]/30'
                              : bill.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-200' 
                                : 'bg-gray-100 text-gray-800 border-gray-200'
                          }`}>
                            {bill.status === 'paid' ? `${t("paid", "Paid")} ✓` : bill.status === 'pending' ? `${t("pending", "Pending")} ⏳` : `${t("cancelled", "Cancelled")} ❌`}
                          </Badge>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedBill(bill);
                                setIsBillDetailsOpen(true);
                              }}
                              className="border-[#ba1d1d] text-[#ba1d1d] hover:bg-[#ba1d1d]/10"
                            >
                              <Receipt className="h-4 w-4 mr-1 text-[#ba1d1d]" />
                              {t("details", "Details")}
                            </Button>
                            {bill.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkBillAsPaid(bill.id)}
                                variant="success"
                                className="text-white"
                              >
                                {t("markPaid", "Mark Paid")}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="bg-[#f5f5f5] rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div>
                              <div className="text-[#373643]/60 text-xs font-medium uppercase tracking-wide">{t("created", "Created")}</div>
                              <div className="font-medium text-[#373643]">
                              {new Date(bill.createdAt).toLocaleDateString()}
                            </div>
                              <div className="text-[#373643]/40 text-xs">
                              {new Date(bill.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                          <div>
                              <div className="text-[#373643]/60 text-xs font-medium uppercase tracking-wide">{t("paymentMethod", "Payment Method")}</div>
                              <div className="font-medium text-[#373643] capitalize">
                              {bill.paymentMethod}
                            </div>
                          </div>
                          <div>
                              <div className="text-[#373643]/60 text-xs font-medium uppercase tracking-wide">{t("billBreakdown", "Bill Breakdown")}</div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{t("subtotal", "Subtotal:")}</span>
                                <span>{formatCurrency(parseFloat(bill.subtotal || '0'))}</span>
                              </div>
                              {parseFloat(bill.tax || '0') > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span>{t("tax", "Tax:")}</span>
                                  <span>{formatCurrency(parseFloat(bill.tax))}</span>
                                </div>
                              )}
                              {parseFloat(bill.tip || '0') > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span>{t("tip", "Tip:")}</span>
                                  <span>{formatCurrency(parseFloat(bill.tip))}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                              <div className="text-[#373643]/60 text-xs font-medium uppercase tracking-wide">{t("sessionId", "Session ID")}</div>
                              <div className="font-medium text-[#373643]">
                              #{bill.tableSessionId}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-[#ba1d1d]/30 mx-auto mb-4" />
                  <p className="text-[#373643]/60 dark:text-gray-400">{t("noBills", "No bills found")}</p>
                  <p className="text-sm text-[#373643]/40">{t("generateBillsFromActiveSessions", "Generate bills from active sessions")}</p>
                <Button 
                    className="mt-4 border-[#ba1d1d] text-[#ba1d1d] hover:bg-[#ba1d1d]/10" 
                  variant="outline"
                  onClick={() => setActiveTab('sessions')}
                >
                  {t("goToActiveSessions", "Go to Active Sessions")}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Table Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTable ? t("editTable", "Edit Table") : t("addTable", "Add Table")}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tableNumber", "Table Number")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="1" placeholder="1" />
                    </FormControl>
                    {!editingTable && (
                      <p className="text-sm text-gray-500">
                        {t("autoSuggestedNumber", "Auto-suggested next available number. You can change it if needed.")}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("capacity", "Capacity")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="1" placeholder="4" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5"
                >
                  {t("cancel", "Cancel")}
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white transition-all duration-200"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      {t("saving", "Saving...")}
                    </span>
                  ) : (
                    editingTable ? t("updateTable", "Update Table") : t("addTable", "Add Table")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Customer Names Dialog */}
      <CustomerNamesDialog
        isOpen={isCustomerNamesOpen}
        onOpenChange={setIsCustomerNamesOpen}
        tableNumber={selectedTableNumber || 0}
        onCustomersCollected={handleCustomersCollected}
      />

      {/* Bill Generation Dialog */}
      {selectedSessionId && (
        <BillGenerationDialog
          isOpen={isBillGenerationOpen}
          onOpenChange={setIsBillGenerationOpen}
          tableSessionId={selectedSessionId}
          restaurantId={restaurantId!}
          onBillGenerated={handleBillGenerated}
        />
      )}

      {/* Bill Details Dialog */}
      {selectedBill && (
        <Dialog open={isBillDetailsOpen} onOpenChange={setIsBillDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("billDetails", "Bill Details")} {t("forTable", "for Table")} {selectedBill.tableSession?.table?.number}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-gray-900">{t("primaryBillInfo", "Primary Bill Info")}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <span>{t("billNumber", "Bill Number:")}</span>
                  <span>{selectedBill.billNumber}</span>
                  <span>{t("type", "Type:")}</span>
                  <span>{selectedBill.type.charAt(0).toUpperCase() + selectedBill.type.slice(1)}</span>
                  <span>{t("status", "Status:")}</span>
                  <span className={`${
                    selectedBill.status === 'paid' ? 'text-green-600' : selectedBill.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                  } font-medium`}>
                    {selectedBill.status === 'paid' ? `${t("paid", "Paid")} ✓` : selectedBill.status === 'pending' ? `${t("pending", "Pending")} ⏳` : `${t("cancelled", "Cancelled")} ❌`}
                  </span>
                  <span>{t("totalAmount", "Total Amount:")}</span>
                  <span>{formatCurrency(parseFloat(selectedBill.total || '0'))}</span>
                  <span>{t("paymentMethod", "Payment Method:")}</span>
                  <span>{selectedBill.paymentMethod}</span>
                  <span>{t("createdAt", "Created At:")}</span>
                  <span>{new Date(selectedBill.createdAt).toLocaleDateString()}</span>
                  <span>{t("paidAt", "Paid At:")}</span>
                  <span>{selectedBill.paidAt ? new Date(selectedBill.paidAt).toLocaleDateString() : t("na", "N/A")}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-gray-900">{t("billBreakdown", "Bill Breakdown")}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <span>{t("subtotal", "Subtotal:")}</span>
                  <span>{formatCurrency(parseFloat(selectedBill.subtotal || '0'))}</span>
                    {parseFloat(selectedBill.tax || '0') > 0 && (
                      <>
                  <span>{t("tax", "Tax:")}</span>
                  <span>{formatCurrency(parseFloat(selectedBill.tax || '0'))}</span>
                      </>
                    )}
                    {parseFloat(selectedBill.tip || '0') > 0 && (
                      <>
                  <span>{t("tip", "Tip:")}</span>
                  <span>{formatCurrency(parseFloat(selectedBill.tip || '0'))}</span>
                      </>
                    )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-gray-900">{t("customerInfo", "Customer Info")}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <span>{t("customerName", "Customer Name:")}</span>
                  <span>{selectedBill.customer?.name || t("na", "N/A")}</span>
                  <span>{t("isMainContact", "Is Main Contact:")}</span>
                  <span>{selectedBill.customer?.isMainCustomer ? t("yes", "Yes") : t("no", "No")}</span>
                  <span>{t("customerId", "Customer ID:")}</span>
                  <span>{selectedBill.customer?.id || t("na", "N/A")}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-gray-900">{t("sessionInfo", "Session Info")}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <span>{t("sessionId", "Session ID:")}</span>
                  <span>{selectedBill.tableSessionId}</span>
                  <span>{t("partySize", "Party Size:")}</span>
                  <span>{selectedBill.allCustomers?.length || 0} {t("people", "people")}</span>
                  <span>{t("splitType", "Split Type:")}</span>
                  <span>{(selectedBill.allCustomers?.length || 0) > 1 ? t("combined", "Combined") : t("individual", "Individual")}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBillDetailsOpen(false)}>{t("close", "Close")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
