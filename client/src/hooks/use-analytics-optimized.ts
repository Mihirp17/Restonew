import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

interface AnalyticsData {
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  activeTables: number;
  totalTables: number;
  popularItems?: Array<{
    id: number;
    name: string;
    count: number;
    price: string;
  }>;
}

// Date range helper
function getRelativeDateRange(range: 'today' | 'week' | 'month' | 'year') {
  const now = new Date();
  let startDate: Date;
  let endDate = new Date(); // Always end at current time

  switch (range) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

// Hook for dashboard analytics (fast, cached)
export function useDashboardAnalytics(restaurantId: number | undefined, dateRange: 'today' | 'week' | 'month' | 'year' = 'today') {
  return useQuery({
    queryKey: ['dashboard-analytics', restaurantId, dateRange],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!restaurantId) throw new Error('Restaurant ID is required');
      
      const { startDate, endDate } = getRelativeDateRange(dateRange);
      const response = await apiRequest({
        method: 'POST',
        url: `/api/restaurants/${restaurantId}/analytics/dashboard`,
        data: { startDate, endDate }
      });
      return response;
    },
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000, // 2 minutes - fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    refetchOnWindowFocus: false,
    refetchInterval: 3 * 60 * 1000, // Refresh every 3 minutes
    retry: 2,
    retryDelay: 1000,
  });
}

// Hook for full analytics page (includes popular items)
export function useAnalytics(restaurantId: number | undefined, dateRange: 'today' | 'week' | 'month' | 'year' = 'today') {
  return useQuery({
    queryKey: ['analytics', restaurantId, dateRange],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!restaurantId) throw new Error('Restaurant ID is required');
      
      const { startDate, endDate } = getRelativeDateRange(dateRange);
      const response = await apiRequest({
        method: 'POST',
        url: `/api/restaurants/${restaurantId}/analytics/combined`,
        data: { startDate, endDate }
      });
      return response;
    },
    enabled: !!restaurantId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1500,
  });
}

// Hook for popular items only (lighter payload)
export function usePopularItems(restaurantId: number | undefined, dateRange: 'today' | 'week' | 'month' | 'year' = 'today', limit: number = 10) {
  return useQuery({
    queryKey: ['popular-items', restaurantId, dateRange, limit],
    queryFn: async () => {
      if (!restaurantId) throw new Error('Restaurant ID is required');
      
      const { startDate, endDate } = getRelativeDateRange(dateRange);
      const response = await fetch(`/api/restaurants/${restaurantId}/analytics/popular-items?limit=${limit}&startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch popular items');
      }
      
      return response.json();
    },
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// Hook for lightweight active orders (dashboard)
export function useActiveOrdersLight(restaurantId: number | undefined, limit: number = 10) {
  return useQuery({
    queryKey: ['active-orders-light', restaurantId, limit],
    queryFn: async () => {
      if (!restaurantId) throw new Error('Restaurant ID is required');
      
      const response = await fetch(`/api/restaurants/${restaurantId}/active-orders-lightweight?limit=${limit}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch active orders');
      }
      
      return response.json();
    },
    enabled: !!restaurantId,
    staleTime: 30 * 1000, // 30 seconds for live data
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60 * 1000, // Refresh every minute
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: 500,
  });
}

// Prefetch analytics data
export function prefetchAnalytics(queryClient: any, restaurantId: number, dateRange: 'today' | 'week' | 'month' | 'year') {
  const { startDate, endDate } = getRelativeDateRange(dateRange);
  
  return queryClient.prefetchQuery({
    queryKey: ['dashboard-analytics', restaurantId, dateRange],
    queryFn: async () => {
      const response = await apiRequest({
        method: 'POST',
        url: `/api/restaurants/${restaurantId}/analytics/dashboard`,
        data: { startDate, endDate }
      });
      return response;
    },
    staleTime: 2 * 60 * 1000,
  });
}
