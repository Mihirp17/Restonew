import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PerformanceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  responseTime: number;
  activeConnections: number;
  cacheHitRate: number;
  errorRate: number;
}

interface PerformanceMonitorProps {
  className?: string;
  isVisible?: boolean;
  onToggle?: () => void;
}

export function PerformanceMonitor({ className, isVisible = false, onToggle }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memoryUsage: 0,
    cpuUsage: 0,
    responseTime: 0,
    activeConnections: 0,
    cacheHitRate: 0,
    errorRate: 0
  });
  const [isMonitoring, setIsMonitoring] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/health/performance');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
    }
  }, []);

  useEffect(() => {
    if (isMonitoring && isVisible) {
      const interval = setInterval(fetchMetrics, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isMonitoring, isVisible, fetchMetrics]);

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return <Badge variant="success">Good</Badge>;
    if (value <= thresholds.warning) return <Badge variant="secondary">Warning</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  if (!isVisible) {
    return (
      <div className={cn("fixed top-4 right-4 z-50", className)}>
        <Button
          onClick={onToggle}
          size="sm"
          variant="outline"
          className="bg-white/90 backdrop-blur-sm"
        >
          📊 Performance
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("fixed top-4 right-4 z-50 w-80", className)}>
      <Card className="shadow-lg border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Performance Monitor</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={cn(
                  "text-xs",
                  isMonitoring ? "text-green-600" : "text-gray-500"
                )}
              >
                {isMonitoring ? "●" : "○"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggle}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Memory Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Memory Usage</span>
              <div className="flex items-center space-x-2">
                <span className={cn(
                  "text-sm",
                  getStatusColor(metrics.memoryUsage, { good: 70, warning: 85 })
                )}>
                  {metrics.memoryUsage.toFixed(1)}%
                </span>
                {getStatusBadge(metrics.memoryUsage, { good: 70, warning: 85 })}
              </div>
            </div>
            <Progress value={metrics.memoryUsage} className="h-2" />
          </div>

          {/* CPU Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">CPU Usage</span>
              <div className="flex items-center space-x-2">
                <span className={cn(
                  "text-sm",
                  getStatusColor(metrics.cpuUsage, { good: 60, warning: 80 })
                )}>
                  {metrics.cpuUsage.toFixed(1)}%
                </span>
                {getStatusBadge(metrics.cpuUsage, { good: 60, warning: 80 })}
              </div>
            </div>
            <Progress value={metrics.cpuUsage} className="h-2" />
          </div>

          {/* Response Time */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Avg Response Time</span>
              <div className="flex items-center space-x-2">
                <span className={cn(
                  "text-sm",
                  getStatusColor(metrics.responseTime, { good: 200, warning: 500 })
                )}>
                  {metrics.responseTime}ms
                </span>
                {getStatusBadge(metrics.responseTime, { good: 200, warning: 500 })}
              </div>
            </div>
            <Progress 
              value={Math.min((metrics.responseTime / 1000) * 100, 100)} 
              className="h-2" 
            />
          </div>

          {/* Active Connections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Connections</span>
              <span className="text-sm text-gray-600">{metrics.activeConnections}</span>
            </div>
          </div>

          {/* Cache Hit Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cache Hit Rate</span>
              <div className="flex items-center space-x-2">
                <span className={cn(
                  "text-sm",
                  getStatusColor(100 - metrics.cacheHitRate, { good: 20, warning: 40 })
                )}>
                  {metrics.cacheHitRate.toFixed(1)}%
                </span>
                {getStatusBadge(100 - metrics.cacheHitRate, { good: 20, warning: 40 })}
              </div>
            </div>
            <Progress value={metrics.cacheHitRate} className="h-2" />
          </div>

          {/* Error Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Error Rate</span>
              <div className="flex items-center space-x-2">
                <span className={cn(
                  "text-sm",
                  getStatusColor(metrics.errorRate, { good: 1, warning: 5 })
                )}>
                  {metrics.errorRate.toFixed(2)}%
                </span>
                {getStatusBadge(metrics.errorRate, { good: 1, warning: 5 })}
              </div>
            </div>
            <Progress value={Math.min(metrics.errorRate * 10, 100)} className="h-2" />
          </div>

          {/* Quick Actions */}
          <div className="pt-2 border-t">
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={fetchMetrics}
                className="flex-1 text-xs"
              >
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Clear cache action
                  console.log('Clearing cache...');
                }}
                className="flex-1 text-xs"
              >
                Clear Cache
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}