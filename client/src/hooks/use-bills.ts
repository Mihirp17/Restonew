import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useState, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { billSchema, updateBillSchema } from '@shared/validations';
import { ErrorHandler } from '@/lib/error-handler';
import { getCacheManager, CacheResource } from '@/lib/cache-manager';

// Define types based on our Zod schemas
export type Bill = z.infer<typeof billSchema> & { 
  id: number;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillCreate = z.infer<typeof billSchema>;
export type BillUpdate = z.infer<typeof updateBillSchema>;

// Define bill status type
export type BillStatus = 'pending' | 'paid' | 'cancelled';

// Define bill type
export type BillType = 'individual' | 'combined' | 'partial';

// Define payment method type
export type PaymentMethod = 'cash' | 'card' | 'digital' | 'split';

// Use interface to add additional UI-specific information
export interface EnhancedBill extends Bill {
  tableSession?: {
    id: number;
    table?: {
      number: number;
    };
  };
  customer?: {
    id: number;
    name: string;
  };
  allCustomers?: any[];
}

// Function to ensure strong typing when creating a new bill
export function createNewBill(billData: BillCreate): BillCreate {
  // Validate with Zod schema
  const validationResult = billSchema.safeParse(billData);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.format();
    console.error('Invalid bill data:', errorDetails);
    throw new Error('Invalid bill data: ' + JSON.stringify(errorDetails));
  }
  
  // Return validated data
  return validationResult.data;
}

// Hook to fetch and manage bills for a restaurant
export function useBills(restaurantId: number) {
  const queryClient = useQueryClient();
  
  // Use standard query key format from cache manager
  const billsQueryKey = useMemo(() => 
    getCacheManager().getStandardQueryKey(`/api/restaurants/${restaurantId}/bills`), 
    [restaurantId]
  );
  
  // Register the query with appropriate tags
  useEffect(() => {
    if (restaurantId) {
      getCacheManager().registerRestaurantQuery(
        billsQueryKey,
        restaurantId,
        CacheResource.BILLS
      );
    }
  }, [billsQueryKey, restaurantId]);
  
  const { data: bills = [], isLoading, error, refetch } = useQuery<EnhancedBill[]>({
    queryKey: billsQueryKey,
    queryFn: async () => {
      try {
        if (!restaurantId) throw new Error('Restaurant ID is required');
        const result = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/bills`
        });
        return result;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
    enabled: !!restaurantId && restaurantId > 0
  });
  
  // Create bill mutation
  const createBillMutation = useMutation({
    mutationFn: async (billData: BillCreate) => {
      try {
        // Validate bill data against schema
        const validatedBill = createNewBill(billData);
        
        const response = await apiRequest({
          method: 'POST',
          url: `/api/restaurants/${restaurantId}/bills`,
          data: validatedBill
        });
        return response;
      } catch (error) {
        // Handle validation errors specifically
        if (error instanceof Error && error.message.includes('Invalid bill data')) {
          ErrorHandler.logError(error, 'Bill Validation');
          throw error;
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all bill-related queries for this restaurant
      getCacheManager().invalidateResourceQueries(CacheResource.BILLS);
      
      // Also invalidate session-related queries as they might have bill info
      getCacheManager().invalidateResourceQueries(CacheResource.SESSIONS);
    }
  });
  
  // Update bill mutation
  const updateBillMutation = useMutation({
    mutationFn: async ({ billId, data }: { billId: number; data: BillUpdate }) => {
      // Validate update data against schema
      const validationResult = updateBillSchema.safeParse(data);
      if (!validationResult.success) {
        const errorDetails = validationResult.error.format();
        throw new Error('Invalid bill update data: ' + JSON.stringify(errorDetails));
      }
      
      const response = await apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/bills/${billId}`,
        data: validationResult.data
      });
      return response;
    },
    onSuccess: (data) => {
      // Invalidate specific bill query
      getCacheManager().invalidateResourceQueries(CacheResource.BILLS, data.id);
      
      // Also invalidate session-related queries
      if (data.tableSessionId) {
        getCacheManager().invalidateResourceQueries(CacheResource.SESSIONS, data.tableSessionId);
      }
      
      // For payment status updates, also invalidate customer queries
      if (data.status === 'paid' && data.customerId) {
        getCacheManager().invalidateResourceQueries(CacheResource.CUSTOMERS, data.customerId);
      }
    }
  });
  
  // Filtered bill getters
  const pendingBills = useMemo(() => 
    bills.filter(bill => bill.status === 'pending'), 
    [bills]
  );
  
  const paidBills = useMemo(() => 
    bills.filter(bill => bill.status === 'paid'), 
    [bills]
  );
  
  // Get bills by session ID
  function getBillsBySession(sessionId: number): EnhancedBill[] {
    return bills.filter(bill => bill.tableSessionId === sessionId);
  }
  
  // Mark bill as paid
  function markBillAsPaid(billId: number, paymentMethod: PaymentMethod = 'cash'): Promise<any> {
    return updateBillMutation.mutateAsync({ 
      billId, 
      data: { 
        status: 'paid', 
        paymentMethod 
      } 
    });
  }
  
  // Cancel bill
  function cancelBill(billId: number): Promise<any> {
    return updateBillMutation.mutateAsync({ 
      billId, 
      data: { 
        status: 'cancelled' 
      } 
    });
  }
  
  return {
    bills,
    pendingBills,
    paidBills,
    isLoading,
    error,
    createBill: createBillMutation.mutate,
    createBillAsync: createBillMutation.mutateAsync,
    updateBill: updateBillMutation.mutate,
    updateBillAsync: updateBillMutation.mutateAsync,
    getBillsBySession,
    markBillAsPaid,
    cancelBill,
    refetch,
    isCreating: createBillMutation.isPending,
    isUpdating: updateBillMutation.isPending
  };
}

// Hook to fetch bills for a specific table session
export function useSessionBills(restaurantId: number, sessionId?: number) {
  const queryClient = useQueryClient();
  
  // Memoize query key to prevent unnecessary re-renders
  const billsQueryKey = useMemo(() => 
    sessionId 
      ? [`/api/restaurants/${restaurantId}/table-sessions/${sessionId}/bills`]
      : null, 
    [restaurantId, sessionId]
  );
  
  const { data: bills = [], isLoading, error, refetch } = useQuery<EnhancedBill[]>({
    queryKey: billsQueryKey as any,
    queryFn: async () => {
      try {
        if (!restaurantId || !sessionId) throw new Error('Restaurant ID and Session ID are required');
        const result = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions/${sessionId}/bills`
        });
        return result;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
    enabled: !!restaurantId && !!sessionId && restaurantId > 0 && sessionId > 0 && !!billsQueryKey
  });
  
  // Type-safe functions for bill operations
  const markBillAsPaid = async (billId: number, paymentMethod: PaymentMethod = 'cash'): Promise<Bill> => {
    const response = await apiRequest({
      method: 'PUT',
      url: `/api/restaurants/${restaurantId}/bills/${billId}`,
      data: { 
        status: 'paid', 
        paymentMethod,
        paidAt: new Date().toISOString()
      }
    });
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({
      queryKey: billsQueryKey as any
    });
    
    return response;
  };
  
  // Get session completion status
  const { data: completionStatus, isLoading: isLoadingCompletionStatus, refetch: refetchCompletionStatus } = useQuery({
    queryKey: sessionId ? [`/api/restaurants/${restaurantId}/table-sessions/${sessionId}/completion-status`] as any : undefined,
    queryFn: async () => {
      if (!restaurantId || !sessionId) throw new Error('Restaurant ID and Session ID are required');
      const result = await apiRequest({
        method: 'GET',
        url: `/api/restaurants/${restaurantId}/table-sessions/${sessionId}/completion-status`
      });
      return result;
    },
    enabled: !!restaurantId && !!sessionId && restaurantId > 0 && sessionId > 0
  });
  
  return {
    bills,
    isLoading,
    error,
    refetch,
    markBillAsPaid,
    completionStatus,
    isLoadingCompletionStatus,
    refetchCompletionStatus
  };
} 