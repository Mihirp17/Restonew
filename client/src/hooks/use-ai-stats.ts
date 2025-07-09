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
        toast({
          title: 'Error',
          description: 'Failed to fetch AI statistics',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    // Poll for updates every minute
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [restaurantId, toast]);

  return { stats, isLoading };
}
