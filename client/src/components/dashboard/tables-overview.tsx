import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language-context";

interface TableSession {
  id: number;
  tableId: number;
  tableNumber: number;
  tableCapacity: number;
  partySize: number;
  status: 'waiting' | 'active' | 'bill_requested' | 'completed';
  startTime: string;
  firstOrderTime?: string;
  totalAmount: string;
  paidAmount: string;
  customers?: Array<{
    id: number;
    name: string;
    isMainCustomer: boolean;
  }>;
}

interface Table {
  id: number;
  number: number;
  capacity: number;
  isOccupied: boolean;
  qrCode: string;
}

interface TablesOverviewProps {
  restaurantId: number;
}

export function TablesOverview({ restaurantId }: TablesOverviewProps) {
  const { t } = useLang();
  const { toast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [activeSessions, setActiveSessions] = useState<TableSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<TableSession | null>(null);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTablesAndSessions = async () => {
    try {
      setIsLoading(true);
      
      // Fetch tables and active sessions in parallel
      const [tablesResponse, sessionsResponse] = await Promise.all([
        apiRequest({ method: 'GET', url: `/api/restaurants/${restaurantId}/tables` }),
        apiRequest({ method: 'GET', url: `/api/restaurants/${restaurantId}/table-sessions?status=active,waiting,bill_requested` })
      ]);
      
      setTables(tablesResponse || []);
      setActiveSessions(sessionsResponse || []);
    } catch (error) {
      console.error('Error fetching tables and sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load tables data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (restaurantId) {
      fetchTablesAndSessions();
      // Refresh every 30 seconds
      const interval = setInterval(fetchTablesAndSessions, 30000);
      return () => clearInterval(interval);
    }
  }, [restaurantId]);

  const getTableSession = (tableNumber: number): TableSession | undefined => {
    return activeSessions.find((session: TableSession) => session.tableNumber === tableNumber);
  };

  const getSessionDuration = (startTime: string): string => {
    const now = new Date();
    const start = new Date(startTime);
    const diffMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  const getStatusBadge = (session?: TableSession) => {
    if (!session) {
      return <Badge className="bg-gray-100 text-gray-700">Free</Badge>;
    }

    const duration = getSessionDuration(session.startTime);
    const isAtRisk = session.status === 'waiting' && getSessionDuration(session.startTime).includes('h');
    
    switch (session.status) {
      case 'waiting':
        return (
          <div className="flex flex-col gap-1">
            <Badge className={`${isAtRisk ? 'border-orange-400 text-orange-700 bg-orange-50' : 'border-blue-400 text-blue-700 bg-blue-50'} border`}>
              {isAtRisk ? '⚠️ At Risk' : '👀 Browsing'}
            </Badge>
            <span className="text-xs text-gray-500">{duration}</span>
          </div>
        );
      case 'active':
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-green-600 text-white">✓ Ordered</Badge>
            <span className="text-xs text-gray-500">{duration}</span>
          </div>
        );
      case 'bill_requested':
        return (
          <div className="flex flex-col gap-1">
            <Badge className="border-purple-400 text-purple-700 bg-purple-50 border">💳 Bill Requested</Badge>
            <span className="text-xs text-gray-500">{duration}</span>
          </div>
        );
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const handleSessionAction = async (session: TableSession, action: 'assist' | 'bill' | 'complete') => {
    try {
      let endpoint = '';
      let data = {};
      
      switch (action) {
        case 'assist':
          toast({
            title: "Assistance Noted",
            description: `Staff will check on Table ${session.tableNumber}`,
          });
          return;
          
        case 'bill':
          setSelectedSession(session);
          setIsSessionDialogOpen(true);
          return;
          
        case 'complete':
          endpoint = `/api/restaurants/${restaurantId}/table-sessions/${session.id}`;
          data = { status: 'completed', endTime: new Date() };
          
          await apiRequest({
            method: 'PUT',
            url: endpoint,
            data
          });
          
          // Mark table as free
          await apiRequest({
            method: 'PUT',
            url: `/api/restaurants/${restaurantId}/tables/${session.tableId}`,
            data: { isOccupied: false }
          });
          
          toast({
            title: "Session Completed",
            description: `Table ${session.tableNumber} is now available`,
          });
          
          fetchTablesAndSessions();
          break;
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action}. Please try again.`,
        variant: "destructive"
      });
    }
  };

  const renderTableCard = (table: Table) => {
    const session = getTableSession(table.number);
    const isOccupied = session !== undefined;
    
    return (
      <Card key={table.id} className={`cursor-pointer transition-all hover:shadow-md ${
        isOccupied ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-gray-200'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Table {table.number}</h3>
              <span className="text-sm text-gray-500">({table.capacity} seats)</span>
            </div>
            {getStatusBadge(session)}
          </div>
          
          {session && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                <div>Party: {session.partySize} {session.partySize === 1 ? 'guest' : 'guests'}</div>
                {session.customers && session.customers.length > 0 && (
                  <div>Main: {session.customers.find(c => c.isMainCustomer)?.name || 'Anonymous'}</div>
                )}
                {session.status === 'active' && (
                  <div>Total: ${parseFloat(session.totalAmount).toFixed(2)}</div>
                )}
              </div>
              
              <div className="flex gap-2 mt-3">
                {session.status === 'waiting' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSessionAction(session, 'assist')}
                    className="text-xs"
                  >
                    👋 Assist
                  </Button>
                )}
                
                {session.status === 'active' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSessionAction(session, 'bill')}
                      className="text-xs"
                    >
                      💳 Bill
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSessionAction(session, 'complete')}
                      className="text-xs"
                    >
                      ✓ Complete
                    </Button>
                  </>
                )}
                
                {session.status === 'bill_requested' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSessionAction(session, 'complete')}
                    className="text-xs bg-purple-600 hover:bg-purple-700"
                  >
                    ✓ Process Payment
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {!session && (
            <div className="text-sm text-gray-500">
              Available for new customers
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-icons">table_restaurant</span>
            {t("tablesOverview", "Tables Overview")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-red-600 rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const occupiedCount = activeSessions.length;
  const atRiskCount = activeSessions.filter(s => 
    s.status === 'waiting' && getSessionDuration(s.startTime).includes('h')
  ).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-icons">table_restaurant</span>
              {t("tablesOverview", "Tables Overview")}
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-sm">
                {occupiedCount}/{tables.length} occupied
              </Badge>
              {atRiskCount > 0 && (
                <Badge variant="outline" className="text-sm border-orange-400 text-orange-700">
                  {atRiskCount} at risk
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map(renderTableCard)}
          </div>
          
          {tables.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <span className="material-icons text-4xl mb-2 block">table_restaurant</span>
              <p>No tables configured yet</p>
              <Button variant="outline" className="mt-2" onClick={() => window.location.href = '/tables'}>
                Add Tables
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Details Dialog */}
      <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Table {selectedSession?.tableNumber} - Bill Options</DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <div>Party Size: {selectedSession.partySize} guests</div>
                <div>Session Duration: {getSessionDuration(selectedSession.startTime)}</div>
                <div>Total Amount: ${parseFloat(selectedSession.totalAmount).toFixed(2)}</div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    // Navigate to bill generation page
                    window.location.href = `/orders?sessionId=${selectedSession.id}`;
                  }}
                  className="w-full"
                >
                  Generate Bills
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setIsSessionDialogOpen(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
