import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIStats } from "@/hooks/use-ai-stats";

interface QuickStatsProps {
  restaurantId: number | undefined;
}

export function QuickStats({ restaurantId }: QuickStatsProps) {
  const { stats, isLoading } = useAIStats(restaurantId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full"></div>
          </div>
        ) : stats ? (
          <>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-medium">AI Insights Available</span>
              </div>
              <span className="text-sm text-purple-600 font-semibold">
                {stats.aiInsightsAvailable} New
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">Chat Sessions</span>
              </div>
              <span className="text-sm text-blue-600 font-semibold">
                {stats.chatSessions} Active
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Recommendations</span>
              </div>
              <span className="text-sm text-green-600 font-semibold">
                {stats.recommendations} Pending
              </span>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-4">
            Unable to load stats
          </div>
        )}
      </CardContent>
    </Card>
  );
}
