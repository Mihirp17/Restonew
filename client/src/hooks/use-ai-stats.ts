import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from './use-toast';

interface AIStats {
  aiInsightsAvailable: number;
  chatSessions: number;
  recommendations: number;
}

export function useAIStats(restaurantId: number | undefined) {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      if (!restaurantId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiRequest('GET', `/api/restaurants/${restaurantId}/ai-stats`);
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching AI stats:', error);
        // Don't show toast for AI stats errors to avoid spam
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    // Reduced polling from 1 minute to 5 minutes for better performance
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [restaurantId, toast]);

  return { stats, isLoading };
}
