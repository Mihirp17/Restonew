import { apiRequest } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Table {
  id: number;
  number: number;
  capacity: number;
  isOccupied: boolean;
  qrCode: string;
  restaurantId: number;
  groupId?: number;
  createdAt: string;
  updatedAt: string;
}

export function useTables(restaurantId: number) {
  const queryClient = useQueryClient();
  
  const { data: tables, isLoading, error } = useQuery<Table[]>({
    queryKey: [`/api/restaurants/${restaurantId}/tables`],
    queryFn: async () => {
      return apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/tables`
      });
    },
    enabled: !!restaurantId && restaurantId > 0 && !isNaN(restaurantId)
  });
  
  // Create table mutation
  const createTableMutation = useMutation({
    mutationFn: async (tableData: Omit<Table, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!restaurantId || restaurantId <= 0) {
        throw new Error('Invalid restaurant ID');
      }
      return apiRequest({
        method: 'POST',
        url: `/api/restaurants/${restaurantId}/tables`,
        data: tableData
      });
    },
    onSuccess: () => {
      if (restaurantId && restaurantId > 0) {
        queryClient.invalidateQueries({
          queryKey: [`/api/restaurants/${restaurantId}/tables`]
        });
      }
    }
  });
  
  // Update table mutation
  const updateTableMutation = useMutation({
    mutationFn: async ({ tableId, data }: { tableId: number; data: Partial<Table> }) => {
      if (!restaurantId || restaurantId <= 0) {
        throw new Error('Invalid restaurant ID');
      }
      return apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/tables/${tableId}`,
        data
      });
    },
    onSuccess: () => {
      if (restaurantId && restaurantId > 0) {
        queryClient.invalidateQueries({
          queryKey: [`/api/restaurants/${restaurantId}/tables`]
        });
      }
    }
  });
  
  // Delete table mutation
  const deleteTableMutation = useMutation({
    mutationFn: async (tableId: number) => {
      if (!restaurantId || restaurantId <= 0) {
        throw new Error('Invalid restaurant ID');
      }
      return apiRequest({
        method: 'DELETE',
        url: `/api/restaurants/${restaurantId}/tables/${tableId}`
      });
    },
    onSuccess: () => {
      if (restaurantId && restaurantId > 0) {
        queryClient.invalidateQueries({
          queryKey: [`/api/restaurants/${restaurantId}/tables`]
        });
      }
    }
  });
  
  return {
    tables: tables || [],
    isLoading,
    error,
    createTable: createTableMutation.mutate,
    updateTable: updateTableMutation.mutate,
    deleteTable: deleteTableMutation.mutate,
    isCreating: createTableMutation.isPending,
    isUpdating: updateTableMutation.isPending,
    isDeleting: deleteTableMutation.isPending
  };
}

export function useTable(restaurantId: number, tableId: number) {
  const { tables, isLoading } = useTables(restaurantId);
  
  return {
    table: tables.find(table => table.id === tableId),
    isLoading
  };
}
