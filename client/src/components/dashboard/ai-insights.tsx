import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  TrendingUp, 
  RefreshCw, 
  Eye, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertTriangle,
  BarChart3,
  Users,
  UtensilsCrossed,
  Target,
  Lightbulb,
  PlayCircle
} from "lucide-react";

interface AIInsight {
  id: number;
  type: string;
  title: string;
  description: string;
  recommendations: string[];
  dataSource: {
    metrics: string[];
    timeframe: string;
  };
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  implementationStatus: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

interface AIInsightsProps {
  restaurantId: number;
  startDate?: Date;
  endDate?: Date;
}

const getInsightIcon = (type: string) => {
  switch (type) {
    case 'revenue':
      return <TrendingUp className="h-5 w-5" />;
    case 'menu':
      return <UtensilsCrossed className="h-5 w-5" />;
    case 'customer_satisfaction':
      return <Users className="h-5 w-5" />;
    case 'operations':
      return <BarChart3 className="h-5 w-5" />;
    case 'marketing':
      return <Target className="h-5 w-5" />;
    default:
      return <Lightbulb className="h-5 w-5" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'dismissed':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4" />;
    case 'in_progress':
      return <Clock className="h-4 w-4" />;
    case 'dismissed':
      return <XCircle className="h-4 w-4" />;
    default:
      return <PlayCircle className="h-4 w-4" />;
  }
};

export function AIInsights({ restaurantId, startDate, endDate }: AIInsightsProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();

  // Fetch insights
  const fetchInsights = async () => {
    if (!restaurantId) return;
    try {
      setIsLoading(true);
      let url = `/api/restaurants/${restaurantId}/ai-insights`;
      if (startDate && endDate) {
        url += `?startDate=${encodeURIComponent(startDate.toISOString())}&endDate=${encodeURIComponent(endDate.toISOString())}`;
      }
      const response = await apiRequest('GET', url);
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      toast({
        title: "Error",
        description: "Failed to load AI insights",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate new insights
  const generateInsights = async () => {
    if (!restaurantId) return;
    
    try {
      setIsGenerating(true);
      const response = await apiRequest('POST', `/api/restaurants/${restaurantId}/ai-insights/generate`);
      const data = await response.json();
      
      // Refresh insights list
      await fetchInsights();
      
      toast({
        title: "Insights Generated",
        description: `Generated ${data.length} new insights for your restaurant`,
      });
    } catch (error) {
      console.error('Error generating AI insights:', error);
      toast({
        title: "Error",
        description: "Failed to generate new insights",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Mark insight as read
  const markAsRead = async (insightId: number) => {
    try {
      await apiRequest('PUT', `/api/restaurants/${restaurantId}/ai-insights/${insightId}/read`);
      setInsights(prev => prev.map(insight => 
        insight.id === insightId ? { ...insight, isRead: true } : insight
      ));
    } catch (error) {
      console.error('Error marking insight as read:', error);
    }
  };

  // Update implementation status
  const updateStatus = async (insightId: number, status: 'pending' | 'in_progress' | 'completed' | 'dismissed') => {
    try {
      await apiRequest('PUT', `/api/restaurants/${restaurantId}/ai-insights/${insightId}/status`, {
        status
      });
      setInsights(prev => prev.map(insight => 
        insight.id === insightId ? { ...insight, implementationStatus: status } : insight
      ));
      toast({
        title: "Status Updated",
        description: `Insight marked as ${status.replace('_', ' ')}`,
      });
    } catch (error) {
      console.error('Error updating insight status:', error);
      toast({
        title: "Error",
        description: "Failed to update insight status",
        variant: "destructive"
      });
    }
  };

  // Show insight details
  const showDetails = (insight: AIInsight) => {
    setSelectedInsight(insight);
    setIsDetailsOpen(true);
    if (!insight.isRead) {
      markAsRead(insight.id);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [restaurantId, startDate, endDate]);

  // Statistics
  const totalInsights = insights.length;
  const unreadInsights = insights.filter(i => !i.isRead).length;
  const highPriorityInsights = insights.filter(i => i.priority === 'high' || i.priority === 'critical').length;
  const completedInsights = insights.filter(i => i.implementationStatus === 'completed').length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Brain className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Insights</h2>
            <p className="text-gray-600">Actionable recommendations for your restaurant</p>
          </div>
        </div>
        <Button 
          onClick={generateInsights}
          disabled={isGenerating}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Insights
            </>
          )}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Brain className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Insights</p>
                <p className="text-2xl font-bold text-gray-900">{totalInsights}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Eye className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Unread</p>
                <p className="text-2xl font-bold text-gray-900">{unreadInsights}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-gray-900">{highPriorityInsights}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{completedInsights}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights List */}
      {insights.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Insights Available</h3>
            <p className="text-gray-600 mb-4">
              Generate AI insights to get personalized recommendations for your restaurant.
            </p>
            <Button onClick={generateInsights} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Insights"
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <Card 
              key={insight.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                !insight.isRead ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''
              }`}
              onClick={() => showDetails(insight)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <CardTitle className="text-lg">{insight.title}</CardTitle>
                        {!insight.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        {insight.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <Badge className={getPriorityColor(insight.priority)}>
                      {insight.priority.toUpperCase()}
                    </Badge>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <span>{Math.round(insight.confidence)}% confidence</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="capitalize">{insight.type.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>{insight.dataSource.timeframe}</span>
                    <span>•</span>
                    <span>{insight.recommendations.length} recommendations</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className={getStatusColor(insight.implementationStatus)}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(insight.implementationStatus)}
                        <span className="capitalize">
                          {insight.implementationStatus.replace('_', ' ')}
                        </span>
                      </div>
                    </Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
                    <span>Confidence</span>
                  </div>
                  <Progress value={insight.confidence} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Insight Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          {selectedInsight && (
            <>
              <DialogHeader>
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {getInsightIcon(selectedInsight.type)}
                  </div>
                  <div className="flex-1">
                    <DialogTitle className="text-xl">{selectedInsight.title}</DialogTitle>
                    <DialogDescription className="text-base mt-2">
                      {selectedInsight.description}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-6">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Priority</p>
                      <Badge className={getPriorityColor(selectedInsight.priority)}>
                        {selectedInsight.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Confidence</p>
                      <div className="flex items-center space-x-2">
                        <Progress value={selectedInsight.confidence} className="h-2 flex-1" />
                        <span className="text-sm text-gray-600">{Math.round(selectedInsight.confidence)}%</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Recommendations */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3">Recommendations</h4>
                    <div className="space-y-3">
                      {selectedInsight.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                            {index + 1}
                          </div>
                          <p className="text-sm text-gray-700">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Data Source */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3">Data Source</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">Metrics Used</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedInsight.dataSource.metrics.map((metric, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {metric}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">Timeframe</p>
                        <Badge variant="outline">{selectedInsight.dataSource.timeframe}</Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Implementation Status */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3">Implementation Status</h4>
                    <div className="flex items-center space-x-4">
                      <Select
                        value={selectedInsight.implementationStatus}
                        onValueChange={(value: 'pending' | 'in_progress' | 'completed' | 'dismissed') => updateStatus(selectedInsight.id, value)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="dismissed">Dismissed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 