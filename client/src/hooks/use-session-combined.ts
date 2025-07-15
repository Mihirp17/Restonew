import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useState, useEffect } from 'react';

export interface CombinedSessionData {
  session: any;
  customers: any[];
  orders: any[];
  bills: any[];
  combinedBills: any[];
}

// Hook to fetch combined session data in a single request
export function useSessionCombined(restaurantId: number, sessionId: number) {
  // Optimize query key to prevent unnecessary re-renders
  const queryKey = [`/api/restaurants/${restaurantId}/table-sessions/${sessionId}/combined`];
  
  const { 
    data: combinedData, 
    isLoading,
    error,
    refetch
  } = useQuery<CombinedSessionData>({
    queryKey,
    queryFn: async () => {
      if (!restaurantId || !sessionId) {
        throw new Error('Restaurant ID and Session ID are required');
      }
      
      try {
        const result = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/table-sessions/${sessionId}/combined`
        });
        return result;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 15000, // Consider data fresh for 15 seconds
    enabled: !!restaurantId && restaurantId > 0 && !!sessionId && sessionId > 0
  });
  
  // Extract useful data from the combined response
  const session = combinedData?.session || null;
  const customers = combinedData?.customers || [];
  const orders = combinedData?.orders || [];
  const bills = combinedData?.bills || [];
  const combinedBills = combinedData?.combinedBills || [];
  
  // Helper function to calculate totals
  const calculateTotals = () => {
    const orderTotal = orders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const paidTotal = bills
      .filter(bill => bill.status === 'paid')
      .reduce((sum, bill) => sum + parseFloat(bill.total), 0);
    
    return {
      orderTotal: orderTotal.toFixed(2),
      paidTotal: paidTotal.toFixed(2),
      remainingTotal: (orderTotal - paidTotal).toFixed(2)
    };
  };
  
  // Memoize totals calculation
  const totals = combinedData ? calculateTotals() : { orderTotal: '0.00', paidTotal: '0.00', remainingTotal: '0.00' };
  
  return {
    combinedData,
    session,
    customers,
    orders,
    bills,
    combinedBills,
    totals,
    isLoading,
    error,
    refetch
  };
} 