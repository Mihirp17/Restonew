import { useTables } from "@/hooks/use-tables";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useEffect, memo, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Table as TableType } from "@shared/schema";
import { useLang } from "@/contexts/language-context";

interface TablesOverviewProps {
  restaurantId?: number;
}

// Memoized table component to prevent unnecessary re-renders
const TableCard = memo(({ 
  table, 
  onToggleOccupied, 
  t 
}: { 
  table: { 
    id: number;
    number: number;
    capacity: number;
    isOccupied: boolean;
    qrCode: string;
    restaurantId: number;
    groupId?: number | null;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  };
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

export const TablesOverview = memo(function TablesOverview({ restaurantId }: TablesOverviewProps) {
  const queryClient = useQueryClient();
  const { tables = [], isLoading, updateTable } = useTables(restaurantId || 0);
  const { t } = useLang();

  // Toggle table occupancy status
  const handleToggleOccupied = useCallback(async (tableId: number, isOccupied: boolean) => {
    await updateTable({ tableId, data: { isOccupied: !isOccupied } });
  }, [updateTable]);

  useEffect(() => {
    if (restaurantId) {
      queryClient.invalidateQueries({ queryKey: [`/api/restaurants/${restaurantId}/tables`] });
    }
  }, [restaurantId, queryClient]);

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
              table={table} 
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
});
