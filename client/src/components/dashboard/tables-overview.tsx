import { useTables } from "@/hooks/use-tables";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useEffect, memo, useMemo, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Table as TableType } from "@shared/schema";
import { useLang } from "@/contexts/language-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useOrders } from '@/hooks/use-orders';

interface TablesOverviewProps {
  restaurantId?: number;
  activeSessions?: any[];
  onStartSession?: (tableId: number, tableNumber: number) => void;
  onViewSession?: (sessionId: number, tableNumber: number) => void;
  onEndSession?: (sessionId: number) => void;
  showActions?: boolean;
}

// Memoized table component to prevent unnecessary re-renders
const TableCard = memo(({ 
  table, 
  onToggleOccupied, 
  t 
}: { 
  table: TableType;
  onToggleOccupied: (tableId: number, isOccupied: boolean) => void; 
  t: any;
}) => {
  const handleClick = useCallback(() => {
    onToggleOccupied(table.id, table.isOccupied);
  }, [table.id, table.isOccupied, onToggleOccupied]);

  const { cardClassName, textClassName, statusText } = useMemo(() => ({
    cardClassName: `rounded-lg p-3 text-center cursor-pointer transition-colors duration-200 ${
      table.isOccupied
        ? "bg-red-100 dark:bg-red-900/30"
        : "bg-gray-100 dark:bg-gray-700"
    }`,
    textClassName: `font-medium ${
      table.isOccupied
        ? "text-brand"
        : "text-gray-700 dark:text-gray-300"
    }`,
    statusText: table.isOccupied ? t("occupied", "Occupied") : t("free", "Free")
  }), [table.isOccupied, t]);

  return (
    <div className={cardClassName} onClick={handleClick}>
      <p className={textClassName}>
        Table {table.number}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {statusText}
      </p>
    </div>
  );
});

TableCard.displayName = 'TableCard';

export function TablesOverview({ 
  restaurantId,
  activeSessions = [],
  onStartSession,
  onViewSession,
  onEndSession,
  showActions = true 
}: TablesOverviewProps) {
  const queryClient = useQueryClient();
  const { tables = [], isLoading, updateTable } = useTables(restaurantId || 0);
  const { t } = useLang();
  const [sessionOrderTotals, setSessionOrderTotals] = useState<Record<number, string>>({});
  const { getOrdersByTableSessionId } = useOrders(restaurantId);

  // Toggle table occupancy status
  const handleToggleOccupied = useCallback(async (tableId: number, isOccupied: boolean) => {
    await updateTable({ tableId, data: { isOccupied: !isOccupied } });
  }, [updateTable]);

  useEffect(() => {
    if (restaurantId) {
      queryClient.invalidateQueries({ queryKey: [`/api/restaurants/${restaurantId}/tables`] });
    }
  }, [restaurantId, queryClient]);

  // Calculate order totals for sessions with zero totalAmount
  useEffect(() => {
    const fetchSessionOrderTotals = async () => {
      const totals: Record<number, string> = {};
      
      if (!activeSessions || activeSessions.length === 0) return;
      
      for (const session of activeSessions) {
        // Only calculate if totalAmount is 0 or very small (likely default value)
        if (parseFloat(session.totalAmount) < 0.01) {
          try {
            const sessionOrders = await getOrdersByTableSessionId(session.id);
            const orderTotal = sessionOrders.reduce(
              (sum, order) => sum + parseFloat(order.total), 0
            );
            
            if (orderTotal > 0) {
              totals[session.id] = orderTotal.toFixed(2);
            }
          } catch (error) {
            console.error(`Error fetching orders for session ${session.id}:`, error);
          }
        }
      }
      
      setSessionOrderTotals(totals);
    };
    
    fetchSessionOrderTotals();
  }, [activeSessions, getOrdersByTableSessionId]);

  // Get the effective total amount for a session (from DB or calculated)
  const getEffectiveTotalAmount = (session: any) => {
    if (parseFloat(session.totalAmount) >= 0.01) {
      return session.totalAmount;
    }
    
    return sessionOrderTotals[session.id] || "0.00";
  };

  // Calculate time elapsed since session start
  const getSessionDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  // Check if a session is at risk (waiting for >15 min or active for >2h)
  const isSessionAtRisk = (session: any) => {
    const start = new Date(session.startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (session.status === 'waiting' && diffMins > 15) {
      return true;
    }
    
    if (session.status === 'active' && diffMins > 120) {
      return true;
    }
    
    return false;
  };

  // Memoize loading skeleton
  const loadingSkeleton = useMemo(() => (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t("tablesOverview", "Tables Overview")}</h3>
          <div className="animate-pulse w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="p-5 grid grid-cols-3 sm:grid-cols-4 gap-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>
  ), [t]);

  // Memoize empty state
  const emptyState = useMemo(() => (
    <div className="col-span-4 text-center py-8">
      <p className="text-gray-500 dark:text-gray-400">{t("noTablesFound", "No tables found")}</p>
      <Link href="/tables">
        <Button variant="link" className="mt-2 text-brand">
          {t("addTables", "Add tables")}
        </Button>
      </Link>
    </div>
  ), [t]);

  // If we're showing tables overview
  if (!activeSessions || activeSessions.length === 0) {
    if (isLoading) {
      return loadingSkeleton;
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t("tablesOverview", "Tables Overview")}</h3>
          <Link href="/tables">
            <Button variant="link" className="text-sm text-brand hover:text-red-800 dark:hover:text-red-400 font-medium">
              {t("manage", "Manage")}
            </Button>
          </Link>
        </div>
        <div className="p-5 grid grid-cols-3 sm:grid-cols-4 gap-4">
          {tables && tables.length > 0 ? (
            tables.map((table) => (
              <TableCard 
                key={table.id}
                table={table as any} 
                onToggleOccupied={handleToggleOccupied} 
                t={t} 
              />
            ))
          ) : (
            emptyState
          )}
        </div>
      </div>
    );
  }

  // If we're showing active sessions
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Active Tables</CardTitle>
        <CardDescription>Currently active and waiting tables</CardDescription>
      </CardHeader>
      <CardContent>
        {activeSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active tables at the moment
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.map((session) => (
              <Card key={session.id} className="overflow-hidden">
                <div className="bg-primary p-4 text-primary-foreground flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">Table {session.table?.number}</h3>
                    <p className="text-sm opacity-90">
                      {session.partySize} {session.partySize === 1 ? 'guest' : 'guests'} • {getSessionDuration(session.startTime)}
                    </p>
                  </div>
                  <div>
                    <Badge variant={session.status === 'waiting' ? 'secondary' : 'outline'}>
                      {session.status === 'waiting' ? 'Waiting' : 'Active'}
                    </Badge>
                    {isSessionAtRisk(session) && (
                      <Badge variant="destructive" className="ml-2">At Risk</Badge>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Bill</p>
                      <p className="font-semibold">
                        {formatCurrency(getEffectiveTotalAmount(session))}
                        {parseFloat(session.totalAmount) < 0.01 && parseFloat(sessionOrderTotals[session.id] || "0") > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">(calculated)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Paid</p>
                      <p className="font-semibold">{formatCurrency(session.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className="font-semibold">
                        {formatCurrency((parseFloat(getEffectiveTotalAmount(session)) - parseFloat(session.paidAmount)).toFixed(2))}
                      </p>
                    </div>
                  </div>
                  
                  {showActions && (
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onViewSession?.(session.id, session.table?.number)}
                      >
                        View
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => onEndSession?.(session.id)}
                      >
                        End Session
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
