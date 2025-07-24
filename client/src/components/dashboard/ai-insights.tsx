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
import { useLang } from "@/contexts/language-context";

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

// Brand color constants
const BRAND_RED = "#ba1d1d";
const BRAND_GREEN = "#22bb33";
const BRAND_GREEN_DARK = "#178a29";
const BRAND_GRAY = "#373643";

const getPriorityColor = (priority: string) => {
  const colors = {
    'critical': 'bg-red-100 text-[#ba1d1d] border-[#ba1d1d]/30',
    'high': 'bg-orange-100 text-orange-800 border-orange-300',
    'medium': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'low': 'bg-green-100 text-[#178a29] border-[#22bb33]/30'
  } as Record<string, string>;
  return colors[priority] || 'bg-gray-100 text-gray-800 border-gray-300';
};

const getStatusColor = (status: string) => {
  const colors = {
    'completed': 'bg-green-100 text-[#178a29]',
    'in_progress': 'bg-yellow-100 text-yellow-800',
    'dismissed': 'bg-gray-100 text-gray-800',
    'pending': 'bg-orange-100 text-orange-800'
  } as Record<string, string>;
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getDifficultyColor = (difficulty: string) => {
  const colors = {
    'easy': 'bg-green-100 text-[#178a29]',
    'medium': 'bg-yellow-100 text-yellow-800',
    'hard': 'bg-red-100 text-[#ba1d1d]'
  } as Record<string, string>;
  return colors[difficulty] || 'bg-gray-100 text-gray-800';
};

const getInsightIcon = (type: string) => {
  const icons = {
    'revenue': <TrendingUp className="h-5 w-5 text-[#ba1d1d]" />,
    'menu': <UtensilsCrossed className="h-5 w-5 text-[#ba1d1d]" />,
    'customer_satisfaction': <Users className="h-5 w-5 text-[#22bb33]" />,
    'operations': <BarChart3 className="h-5 w-5 text-[#ba1d1d]" />,
    'marketing': <Target className="h-5 w-5 text-[#ba1d1d]" />,
  } as Record<string, JSX.Element>;
  return icons[type] || <Lightbulb className="h-5 w-5 text-[#ba1d1d]" />;
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

// Add localStorage helpers for last seen and archived insights
const getLastSeenTimestamp = () => localStorage.getItem('aiInsightsLastSeen') || '';
const setLastSeenTimestamp = (ts: string) => localStorage.setItem('aiInsightsLastSeen', ts);
const getArchivedIds = () => JSON.parse(localStorage.getItem('aiInsightsArchived') || '[]') as number[];
const setArchivedIds = (ids: number[]) => localStorage.setItem('aiInsightsArchived', JSON.stringify(ids));

export function AIInsights({ restaurantId, startDate, endDate }: AIInsightsProps) {
  const { lang } = useLang();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();

  // Add state for history and last seen
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AIInsight[]>([]);
  const [archivedIds, setArchivedIdsState] = useState<number[]>(getArchivedIds());
  const [lastSeen, setLastSeen] = useState(getLastSeenTimestamp());

  // Add state for feedback
  const [feedback, setFeedback] = useState<Record<number, { rating: number; reason: string }>>({});
  const { t } = useLang();
  const feedbackOptions = [
    t('aiInsights.feedback.notRelevant', 'Not relevant'),
    t('aiInsights.feedback.alreadyImplemented', 'Already implemented'),
    t('aiInsights.feedback.dataIncorrect', 'Data incorrect'),
  ];

  // Add state for filtered insights
  const [filteredInsights, setFilteredInsights] = useState<AIInsight[]>([]);

  // Fetch insights
  const fetchInsights = async () => {
    if (!restaurantId) return;
    try {
      setIsLoading(true);
      let url = `/api/restaurants/${restaurantId}/ai-insights?lang=${lang}`;
      if (startDate && endDate) {
        url += `&startDate=${encodeURIComponent(startDate.toISOString())}&endDate=${encodeURIComponent(endDate.toISOString())}`;
      }
      const response = await apiRequest('GET', url);
      const data: AIInsight[] = await response.json();
      setInsights(data);
      setFilteredInsights(data); // Initialize filteredInsights
      setHistory(prev => ([...data, ...prev.filter(h => !data.some(i => i.id === h.id))]));
      // Update last seen timestamp
      const latest = data.length > 0 ? data[0].createdAt : '';
      if (latest) {
        setLastSeenTimestamp(latest);
        setLastSeen(latest);
      }
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      toast({
        title: t('error'),
        description: t('aiInsights.error.fetch', 'Failed to load AI insights'),
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
      // Get the current number of insights before generating
      const beforeResponse = await apiRequest('GET', `/api/restaurants/${restaurantId}/ai-insights?lang=${lang}`);
      const beforeData = await beforeResponse.json();
      const beforeIds = new Set(beforeData.map((insight: any) => insight.id));

      // Generate new insights
      const response = await apiRequest('POST', `/api/restaurants/${restaurantId}/ai-insights/generate?lang=${lang}`);
      const generatedData = await response.json();
      
      // Fetch all insights after generation
      await fetchInsights();
      const afterResponse = await apiRequest('GET', `/api/restaurants/${restaurantId}/ai-insights`);
      const afterData = await afterResponse.json();
      const afterIds = new Set(afterData.map((insight: any) => insight.id));

      // Find new insight IDs
      const newIds = Array.from(afterIds).filter(id => !beforeIds.has(id));
      const newCount = newIds.length;

      if (newCount > 0) {
      toast({
        title: t('aiInsights.toast.generated.title', 'Insights Generated'),
          description: t('aiInsights.toast.generated.description', `Generated ${newCount} new insight${newCount > 1 ? 's' : ''} for your restaurant`, { count: newCount }),
      });
      } else {
        toast({
          title: t('aiInsights.toast.noNew.title', 'No New Insights'),
          description: t('aiInsights.toast.noNew.description', 'No new insights were generated. Try again later or adjust your data.'),
        });
      }
    } catch (error) {
      console.error('Error generating AI insights:', error);
      toast({
        title: t('error'),
        description: t('aiInsights.toast.generateFailed', 'Failed to generate new insights'),
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

  // Archive/dismiss insight
  const archiveInsight = (id: number) => {
    const updated = [...archivedIds, id];
    setArchivedIdsState(updated);
    setArchivedIds(updated);
    setFilteredInsights(prev => prev.filter(i => i.id !== id));
    toast({ title: 'Insight archived', description: 'This insight has been archived.' });
  };

  // Mark as implemented
  const markAsImplemented = async (id: number) => {
    await apiRequest('PUT', `/api/restaurants/${restaurantId}/ai-insights/${id}/status`, { status: 'completed' });
    setInsights(prev => prev.map(i => i.id === id ? { ...i, implementationStatus: 'completed' } : i));
    setFilteredInsights(prev => prev.map(i => i.id === id ? { ...i, implementationStatus: 'completed' } : i));
    toast({ 
      title: t('aiInsights.toast.implemented.title', 'Insight marked as implemented'), 
      description: t('aiInsights.toast.implemented.description', 'This insight has been marked as implemented.') 
    });
  };

  // Feedback
  const submitFeedback = (id: number) => {
    // Simulate feedback submission
    toast({ 
      title: t('aiInsights.toast.feedback.title', 'Feedback submitted'), 
      description: t('aiInsights.toast.feedback.description', 'Thank you for your feedback!') 
    });
  };

  // Export insights (stub for now)
  const exportInsights = (format: 'csv' | 'json') => {
    // For now, just show a toast
    toast({ 
      title: t('aiInsights.toast.export.title', 'Export'), 
      description: t('aiInsights.toast.export.description', `Exported insights as ${format.toUpperCase()}`, { format: format.toUpperCase() }) 
    });
  };

  // Filter out archived insights
  const visibleInsights = filteredInsights.filter((i: AIInsight) => !archivedIds.includes(i.id));

  // Deduplicate by type, title, and description (content)
  const uniqueInsights = Array.from(
    new Map(
      visibleInsights.map(i => [
        `${i.type}|${i.title}|${i.description}`,
        i
      ])
    ).values()
  );

  // Use unique, visible insights for stats
  const statsSource = uniqueInsights;
  const totalInsights = statsSource.length;
  const unreadInsights = statsSource.filter(i => !i.isRead).length;
  const highPriorityInsights = statsSource.filter(i => i.priority === 'high' || i.priority === 'critical').length;
  const completedInsights = statsSource.filter(i => i.implementationStatus === 'completed').length;

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

  // Subtle badge style
  const subtleBadge = 'px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-[#373643] border border-[#373643]/10';
  const newBadge = 'px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-[#178a29] border border-[#22bb33]/20';
  const archiveBtn = 'hover:bg-gray-100 text-gray-400 hover:text-[#ba1d1d] rounded-full p-1 transition';
  const implementedBtn = 'bg-[#22bb33]/10 text-[#178a29] border border-[#22bb33]/20 rounded-lg px-3 py-1 text-xs font-semibold hover:bg-[#22bb33]/20 transition';
  const feedbackStar = (active: boolean) => `h-4 w-4 cursor-pointer ${active ? 'text-yellow-400' : 'text-gray-300'} transition`;
  const feedbackSelect = 'w-28 text-xs rounded border border-gray-200 bg-white';
  const feedbackSubmit = 'ml-2 px-3 py-1 text-xs rounded bg-[#ba1d1d]/90 text-white hover:bg-[#ba1d1d] transition';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Brain className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('aiInsights.title', 'AI Insights')}</h2>
            <p className="text-gray-600">{t('aiInsights.description', 'Actionable recommendations for your restaurant')}</p>
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
              {t('aiInsights.generating', 'Generating...')}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('aiInsights.regenerate', 'Regenerate Insights')}
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
                <p className="text-sm font-medium text-gray-600">{t('aiInsights.stats.total', 'Total Insights')}</p>
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
                <p className="text-sm font-medium text-gray-600">{t('aiInsights.stats.unread', 'Unread')}</p>
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
                <p className="text-sm font-medium text-gray-600">{t('aiInsights.stats.highPriority', 'High Priority')}</p>
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
                <p className="text-sm font-medium text-gray-600">{t('aiInsights.stats.completed', 'Completed')}</p>
                <p className="text-2xl font-bold text-gray-900">{completedInsights}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights List */}
      {uniqueInsights.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('aiInsights.noInsights.title', 'No Insights Available')}</h3>
            <p className="text-gray-600 mb-4">
              {t('aiInsights.noInsights.description', 'Generate AI insights to get personalized recommendations for your restaurant.')}
            </p>
            <Button onClick={generateInsights} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('aiInsights.generating', 'Generating...')}
                </>
              ) : (
                t('aiInsights.noInsights.generate', 'Generate Insights')
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {uniqueInsights.map((insight) => (
            <Card key={insight.id} className="bg-white border border-[#373643]/10 shadow rounded-xl p-3">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                      {getInsightIcon(insight.type)}
                  <span className={subtleBadge}>{insight.type.replace('_', ' ')}</span>
                  {insight.createdAt > lastSeen && (
                    <span className={newBadge}>NEW</span>
                  )}
                  <Badge className={getPriorityColor(insight.priority)}>{insight.priority.toUpperCase()}</Badge>
                      </div>
                <div className="flex items-center gap-1">
                  <button className={archiveBtn} title="Dismiss" onClick={() => archiveInsight(insight.id)}>
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[#373643] text-base">{insight.title}</span>
                  {insight.implementationStatus !== 'completed' ? (
                    <button className={implementedBtn} onClick={() => markAsImplemented(insight.id)}>
                      <CheckCircle className="inline h-4 w-4 mr-1" /> {t('aiInsights.markAsImplemented', 'Mark as Implemented')}
                    </button>
                  ) : (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-[#178a29] border border-[#22bb33]/20 flex items-center gap-1 cursor-default"
                      title={t('aiInsights.implemented.tooltip', 'This insight has been marked as implemented')}
                    >
                      <CheckCircle className="h-4 w-4" /> {t('aiInsights.implemented', 'Implemented')}
                        </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-1">{insight.dataSource.timeframe} • {insight.recommendations.length} recs</div>
                <div className="text-sm text-gray-700 mb-2 line-clamp-2">{insight.description}</div>
                {/* Feedback */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{t('aiInsights.feedback.rate', 'Rate:')}:</span>
                  {[1,2,3,4,5].map(star => (
                    <span key={star} onClick={() => setFeedback(f => ({ ...f, [insight.id]: { ...(f[insight.id]||{}), rating: star } }))} className={feedbackStar(feedback[insight.id]?.rating >= star)}>★</span>
                  ))}
                  <Select value={feedback[insight.id]?.reason || ''} onValueChange={val => setFeedback(f => ({ ...f, [insight.id]: { ...(f[insight.id]||{}), reason: val } }))}>
                    <SelectTrigger className={feedbackSelect}><SelectValue placeholder={t('aiInsights.feedback.reasonPlaceholder', 'Reason')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="helpful">{t('aiInsights.feedback.reasons.helpful', 'Helpful')}</SelectItem>
                      <SelectItem value="not_relevant">{t('aiInsights.feedback.reasons.notRelevant', 'Not Relevant')}</SelectItem>
                      <SelectItem value="already_known">{t('aiInsights.feedback.reasons.alreadyKnown', 'Already Known')}</SelectItem>
                      <SelectItem value="too_generic">{t('aiInsights.feedback.reasons.tooGeneric', 'Too Generic')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <button className={feedbackSubmit} onClick={() => submitFeedback(insight.id)} disabled={!feedback[insight.id]?.rating || !feedback[insight.id]?.reason}>{t('aiInsights.feedback.submit', 'Submit')}</button>
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
                    <h4 className="text-lg font-semibold mb-3">{t('aiInsights.dialog.recommendations', 'Recommendations')}</h4>
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
                    <h4 className="text-lg font-semibold mb-3">{t('aiInsights.dialog.dataSource', 'Data Source')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">{t('aiInsights.dialog.metricsUsed', 'Metrics Used')}</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedInsight.dataSource.metrics.map((metric, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {metric}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">{t('aiInsights.dialog.timeframe', 'Timeframe')}</p>
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

      {/* History modal/dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl bg-white border border-[#373643]/10 shadow rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#373643]">Insight History</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto text-xs text-gray-600">
            {history.map(h => (
              <div key={h.id} className="border-b border-gray-100 py-2">
                <div className="flex justify-between"><span className="font-semibold text-[#373643]">{h.title}</span><span className="text-xs text-gray-400">{h.createdAt}</span></div>
                <div className="text-xs text-gray-500">{h.description}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border border-[#ba1d1d] text-[#ba1d1d] rounded" onClick={() => exportInsights('csv')}>Export CSV</Button>
            <Button variant="outline" className="border border-[#ba1d1d] text-[#ba1d1d] rounded" onClick={() => exportInsights('json')}>Export JSON</Button>
            <Button variant="ghost" onClick={() => setShowHistory(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
