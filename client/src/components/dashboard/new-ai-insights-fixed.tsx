import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface MenuItem {
  id: number;
  name: string;
  count: number;
  revenue: number;
  category: string;
  trend: 'up' | 'down' | 'stable';
  growth: number;
  type?: 'Top Selling' | 'Low Selling';
}

interface MenuAnalytics {
  topSelling: MenuItem[];
  lowSelling: MenuItem[];
  categoryBreakdown: {
    category: string;
    count: number;
    revenue: number;
  }[];
  recommendations: {
    item: string;
    action: 'promote' | 'remove' | 'adjust_price';
    reason: string;
  }[];
}

interface DemandPrediction {
  item: string;
  predictedDemand: number;
  confidence: number;
  peakHours: string[];
  trend: 'up' | 'down' | 'stable';
  currentPeriodOrders: number; // Current period orders (today/this week/this month)
  totalOrders: number; // Total orders in timeframe
  timeframe: 'day' | 'week' | 'month'; // Timeframe for context
}

interface FoodPairing {
  pair: string;
  count: number;
  items: string[];
  percentage: number;
}

interface PairingRecommendation {
  type: 'combo_meal' | 'suggest_pairing';
  items: string[];
  reason: string;
  potential_revenue: number;
}

interface FoodPairingsData {
  topPairings: FoodPairing[];
  recommendations: PairingRecommendation[];
  totalOrders: number;
  totalPairings: number;
}

interface AIInsightsProps {
  restaurantId: number;
  startDate?: Date;
  endDate?: Date;
}

const BRAND_RED = "#ba1d1d";
const BRAND_GREEN = "#22bb33";
const BRAND_GREEN_DARK = "#178a29";
const BRAND_GRAY = "#373643";
const BRAND_COLORS = [BRAND_RED, BRAND_GREEN, BRAND_GREEN_DARK, BRAND_GRAY];

export function NewAIInsights({ restaurantId, startDate, endDate }: AIInsightsProps) {
  const [menuAnalytics, setMenuAnalytics] = useState<MenuAnalytics | null>(null);
  const [demandPredictions, setDemandPredictions] = useState<DemandPrediction[]>([]);
  const [foodPairings, setFoodPairings] = useState<FoodPairingsData | null>(null);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [showAllBars, setShowAllBars] = useState(false);
  const [activeTab, setActiveTab] = useState("menu");

  useEffect(() => {
    fetchData();
  }, [restaurantId, timeframe]);

  const fetchData = async () => {
    if (!restaurantId) return;
    
    try {
      setIsLoading(true);
      const [menuData, demandData, pairingsData] = await Promise.all([
        apiRequest('GET', `/api/restaurants/${restaurantId}/analytics/menu?timeframe=${timeframe}`),
        apiRequest('GET', `/api/restaurants/${restaurantId}/analytics/demand-prediction?timeframe=${timeframe}`),
        apiRequest('GET', `/api/restaurants/${restaurantId}/analytics/food-pairings?timeframe=${timeframe}`)
      ]);

      setMenuAnalytics(await menuData.json());
      setDemandPredictions(await demandData.json());
      setFoodPairings(await pairingsData.json());
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-[200px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Header and TabsList inside Tabs for correct tab switching */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#ba1d1d]/10 rounded-lg">
                <span className="material-icons text-xl text-[#ba1d1d]">analytics</span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Restaurant Analytics</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">AI-powered insights for your business</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">View data by:</span>
              <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily View</SelectItem>
                  <SelectItem value="week">Weekly View</SelectItem>
                  <SelectItem value="month">Monthly View</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <TabsList className="flex w-full justify-center gap-2 bg-transparent border-b border-gray-100 mb-4">
            <TabsTrigger value="menu" className="flex items-center gap-2 px-5 py-2 border-b-2 data-[state=active]:border-[#ba1d1d] data-[state=active]:text-[#ba1d1d] data-[state=inactive]:border-transparent data-[state=inactive]:text-[#373643] transition bg-transparent font-medium">
              <span className="material-icons text-lg">restaurant_menu</span>
              Menu Performance
            </TabsTrigger>
            <TabsTrigger value="pairings" className="flex items-center gap-2 px-5 py-2 border-b-2 data-[state=active]:border-[#22bb33] data-[state=active]:text-[#22bb33] data-[state=inactive]:border-transparent data-[state=inactive]:text-[#373643] transition bg-transparent font-medium">
              <span className="material-icons text-lg">restaurant</span>
              F&P
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2 px-5 py-2 border-b-2 data-[state=active]:border-[#178a29] data-[state=active]:text-[#178a29] data-[state=inactive]:border-transparent data-[state=inactive]:text-[#373643] transition bg-transparent font-medium">
              <span className="material-icons text-lg">category</span>
              Categories
            </TabsTrigger>
            <TabsTrigger value="demand" className="flex items-center gap-2 px-5 py-2 border-b-2 data-[state=active]:border-[#ba1d1d] data-[state=active]:text-[#ba1d1d] data-[state=inactive]:border-transparent data-[state=inactive]:text-[#373643] transition bg-transparent font-medium">
              <span className="material-icons text-lg">analytics</span>
              Predictions
            </TabsTrigger>
          </TabsList>
        </div>
        {/* All TabsContent remain as before */}
        <TabsContent value="menu" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stats Summary */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Top Selling Items */}
              <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#373643]">
                    <span className="material-icons text-base" style={{ color: BRAND_RED }}>trending_up</span>
                    Top Performers
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">Best selling menu items</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-4">
                      {menuAnalytics?.topSelling.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white/60 dark:bg-white/10 rounded-lg hover:bg-white/80 dark:hover:bg-white/20 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#ba1d1d]/10 dark:bg-[#ba1d1d]/80 flex items-center justify-center text-[#ba1d1d] dark:text-[#ba1d1d]/20 font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-300">{item.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{item.count} orders</p>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              {item.growth > 0 ? '+' : ''}{item.growth}% vs prev.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Low Selling Items */}
              <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className="material-icons text-[#22bb33]">trending_down</span>
                        Needs Attention
                      </CardTitle>
                      <CardDescription>Under-performing items</CardDescription>
                    </div>
                    <Badge className="bg-[#22bb33]/10 text-[#22bb33] dark:bg-[#22bb33]/80 dark:text-[#22bb33]">
                      {timeframe === 'day' ? 'Today' : timeframe === 'week' ? 'This Week' : 'This Month'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-4">
                      {menuAnalytics?.lowSelling.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white/60 dark:bg-white/10 rounded-lg hover:bg-white/80 dark:hover:bg-white/20 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#22bb33]/10 dark:bg-[#22bb33]/80 flex items-center justify-center text-[#22bb33] dark:text-[#22bb33]/20 font-medium">
                              <span className="material-icons text-sm">warning</span>
                            </div>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-300">{item.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{item.count} orders</p>
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {item.growth}% vs prev.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart */}
            <Card className="md:row-span-2 w-full bg-white shadow-sm rounded-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#373643]">
                  <span className="material-icons text-base" style={{ color: BRAND_RED }}>insights</span>
                  Sales Performance
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">Comparing top vs bottom items</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={420} minWidth={420}>
                  <BarChart
                    data={[
                      ...(menuAnalytics?.topSelling || []).map(item => ({ ...item, type: 'Top Selling' })),
                      ...(menuAnalytics?.lowSelling || []).map(item => ({ ...item, type: 'Low Selling' }))
                    ].slice(0, showAllBars ? 20 : 8)}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="name"
                      angle={-30}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tick={{ fontSize: 13, fill: '#373643' }}
                    />
                    <YAxis tick={{ fontSize: 13, fill: '#373643' }} />
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload && payload.length ? (
                          <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                            <p className="font-medium text-gray-800">{payload[0].payload.name}</p>
                            <p className="text-sm" style={{ color: payload[0].payload.type === 'Top Selling' ? '#ba1d1d' : '#22bb33' }}>
                              Orders: {payload[0].value}
                            </p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      label={({ x, y, width, height, value }) => (
                        <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize="13" fill="#373643">{value}</text>
                      )}
                    >
                      {[
                        ...(menuAnalytics?.topSelling || []).map(item => ({ ...item, type: 'Top Selling' })),
                        ...(menuAnalytics?.lowSelling || []).map(item => ({ ...item, type: 'Low Selling' }))
                      ].slice(0, showAllBars ? 20 : 8).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.type === 'Top Selling' ? '#ba1d1d' : '#22bb33'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {((menuAnalytics?.topSelling?.length || 0) + (menuAnalytics?.lowSelling?.length || 0)) > 8 && (
                  <div className="flex justify-end mt-2">
                    <Button size="sm" variant="outline" onClick={() => setShowAllBars(v => !v)}>
                      {showAllBars ? 'Show Top 8' : 'Show All'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Recommendations */}
          <Card className="mt-6 bg-white shadow-sm rounded-xl border border-gray-100">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="material-icons text-[#ba1d1d]">lightbulb</span>
                    AI-Powered Recommendations
                  </CardTitle>
                  <CardDescription>Smart suggestions to optimize your menu</CardDescription>
                </div>
                <Button variant="outline" className="gap-2" onClick={fetchData}>
                  <span className="material-icons text-sm">refresh</span>
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {menuAnalytics?.recommendations.map((rec, index) => (
                    <div key={index} className="p-4 bg-white/80 dark:bg-gray-800/50 rounded-lg hover:shadow-md transition-all">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          rec.action === 'promote' ? 'bg-[#22bb33]/10 text-[#22bb33]' :
                          rec.action === 'remove' ? 'bg-[#ba1d1d]/10 text-[#ba1d1d]' :
                          'bg-[#ba1d1d]/10 text-[#ba1d1d]'
                        }`}>
                          <span className="material-icons">
                            {rec.action === 'promote' ? 'trending_up' :
                             rec.action === 'remove' ? 'remove_circle' :
                             'price_change'}
                          </span>
                        </div>
                        <div>
                          <Badge className={`
                            ${rec.action === 'promote' ? 'bg-[#22bb33]/10 text-[#22bb33] dark:bg-[#22bb33]/80 dark:text-[#22bb33]' : 
                              rec.action === 'remove' ? 'bg-[#ba1d1d]/10 text-[#ba1d1d] dark:bg-[#ba1d1d]/80 dark:text-[#ba1d1d]' : 
                              'bg-[#ba1d1d]/10 text-[#ba1d1d] dark:bg-[#ba1d1d]/80 dark:text-[#ba1d1d]'}
                          `}>
                            {rec.action === 'promote' ? 'Promotion Recommended' :
                             rec.action === 'remove' ? 'Consider Removing' :
                             'Price Adjustment'}
                          </Badge>
                          <h4 className="font-semibold mt-1">{rec.item}</h4>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 pl-13">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pairings" className="space-y-4">
          {/* Move summary stats above pairings and recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="material-icons text-[#ba1d1d]">receipt_long</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{foodPairings?.totalOrders || 0}</p>
                    <p className="text-sm text-gray-600">Total Orders Analyzed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="material-icons text-[#22bb33]">restaurant</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{foodPairings?.totalPairings || 0}</p>
                    <p className="text-sm text-gray-600">Unique Pairings Found</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="material-icons text-[#ba1d1d]">trending_up</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{foodPairings?.recommendations?.length || 0}</p>
                    <p className="text-sm text-gray-600">AI Recommendations</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Food Pairings */}
            <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#373643]">
                  <span className="material-icons text-base" style={{ color: BRAND_GREEN }}>restaurant</span>
                  Top Food Pairings
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">Most frequently ordered together</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {foodPairings?.topPairings.map((pairing, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-white/60 dark:bg-white/10 rounded-lg hover:bg-white/80 dark:hover:bg-white/20 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#22bb33]/10 dark:bg-[#22bb33]/80 flex items-center justify-center text-[#22bb33] dark:text-[#22bb33]/20 font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{pairing.items[0]}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">+ {pairing.items[1]}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{pairing.count} orders</p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            {pairing.percentage}% of orders
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Pairing Recommendations */}
            <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="material-icons text-[#ba1d1d]">lightbulb</span>
                      Pairing Recommendations
                    </CardTitle>
                    <CardDescription>AI suggestions for menu optimization</CardDescription>
                  </div>
                  <Badge className="bg-[#ba1d1d]/10 text-[#ba1d1d] dark:bg-[#ba1d1d]/80 dark:text-[#ba1d1d]">
                    Smart Insights
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {foodPairings?.recommendations.map((rec, index) => (
                      <div key={index} className="p-4 bg-white/80 dark:bg-gray-800/50 rounded-lg hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            rec.type === 'combo_meal' ? 'bg-[#22bb33]/10 text-[#22bb33]' : 'bg-[#ba1d1d]/10 text-[#ba1d1d]'
                          }`}>
                            <span className="material-icons">
                              {rec.type === 'combo_meal' ? 'restaurant_menu' : 'suggestions'}
                            </span>
                          </div>
                          <div>
                            <Badge className={`
                              ${rec.type === 'combo_meal' ? 'bg-[#22bb33]/10 text-[#22bb33] dark:bg-[#22bb33]/80 dark:text-[#22bb33]' : 
                                'bg-[#ba1d1d]/10 text-[#ba1d1d] dark:bg-[#ba1d1d]/80 dark:text-[#ba1d1d]'}
                            `}>
                              {rec.type === 'combo_meal' ? 'Combo Meal' : 'Suggest Pairing'}
                            </Badge>
                            <h4 className="font-semibold mt-1">
                              {rec.items.join(' + ')}
                            </h4>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 pl-13">{rec.reason}</p>
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">
                            Potential Revenue: ${rec.potential_revenue}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Distribution */}
            <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#373643]">
                  <span className="material-icons text-base" style={{ color: BRAND_GRAY }}>category</span>
                  Food Categories
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">Distribution by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={menuAnalytics?.categoryBreakdown}
                      dataKey="count"
                      nameKey="category"
                      label
                    >
                      {menuAnalytics?.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Revenue */}
            <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#373643]">
                  <span className="material-icons text-base" style={{ color: BRAND_GRAY }}>receipt_long</span>
                  Category Revenue
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">Revenue by food category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={menuAnalytics?.categoryBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#8884d8">
                      {menuAnalytics?.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="demand" className="space-y-6">
          {/* Explanation Card */}
          <Card className="bg-white shadow-sm rounded-xl border border-gray-100">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="material-icons text-2xl text-[#ba1d1d]">auto_awesome</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">AI-Powered Demand Prediction</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Our AI analyzes your historical sales data, seasonal patterns, and real-time trends to predict demand for each menu item. These predictions help you optimize inventory and reduce waste.
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-[#22bb33] rounded-full"></span>
                      High Confidence (80%+)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-[#ba1d1d] rounded-full"></span>
                      Medium Confidence (60-79%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-[#373643] rounded-full"></span>
                      Low Confidence (&lt;60%)
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demand Predictions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {demandPredictions.map((prediction, index) => {
              // Get timeframe-specific labels
              const getTimeframeLabel = () => {
                switch (timeframe) {
                  case 'day':
                    return 'today';
                  case 'week':
                    return 'this week';
                  case 'month':
                    return 'this month';
                  default:
                    return 'this period';
                }
              };

              const getPredictionLabel = () => {
                switch (timeframe) {
                  case 'day':
                    return 'units tomorrow';
                  case 'week':
                    return 'units next week';
                  case 'month':
                    return 'units next month';
                  default:
                    return 'units';
                }
              };

              const getCurrentPeriodLabel = () => {
                switch (timeframe) {
                  case 'day':
                    return 'orders today';
                  case 'week':
                    return 'orders this week';
                  case 'month':
                    return 'orders this month';
                  default:
                    return 'orders';
                }
              };

              return (
                <Card key={index} className="bg-white shadow-sm rounded-xl border border-gray-100 transition-all hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className={`material-icons ${
                            prediction.trend === 'up' ? 'text-[#22bb33]' : 
                            prediction.trend === 'down' ? 'text-[#ba1d1d]' : 
                            'text-[#373643]'
                          }`}>
                            {prediction.trend === 'up' ? 'trending_up' : 
                             prediction.trend === 'down' ? 'trending_down' : 
                             'trending_flat'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{prediction.item}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">Predicted Demand</p>
                        </div>
                      </div>
                      <Badge className={`
                        ${prediction.trend === 'up' ? 'bg-[#22bb33]/10 text-[#22bb33] border-[#22bb33]/20' : 
                          prediction.trend === 'down' ? 'bg-[#ba1d1d]/10 text-[#ba1d1d] border-[#ba1d1d]/20' : 
                          'bg-[#373643]/10 text-[#373643] border-[#373643]/20'}
                      `}>
                        {prediction.trend === 'up' ? '↑' : prediction.trend === 'down' ? '↓' : '→'} {prediction.predictedDemand} {getPredictionLabel()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Current Period Activity */}
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="material-icons text-gray-600 dark:text-gray-300">schedule</span>
                            <span className="font-medium">Current Activity</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {prediction.currentPeriodOrders} {getCurrentPeriodLabel()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Total: {prediction.totalOrders} orders in {getTimeframeLabel()}
                        </div>
                      </div>

                      {/* Peak Hours */}
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-icons text-gray-600 dark:text-gray-300">schedule</span>
                          <span className="font-medium">Peak Hours</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {prediction.peakHours.map((hour, i) => (
                            <Badge key={i} variant="outline" className="bg-white border-gray-200 text-gray-700">
                              {hour}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Confidence Score with Real-time Indicator */}
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="material-icons text-gray-600 dark:text-gray-300">analytics</span>
                            <span className="font-medium">Prediction Confidence</span>
                            {prediction.confidence >= 80 && (
                              <span className="w-2 h-2 bg-[#22bb33] rounded-full animate-pulse"></span>
                            )}
                          </div>
                          <span className="font-semibold">{prediction.confidence}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              prediction.confidence >= 80 ? 'bg-[#22bb33]' :
                              prediction.confidence >= 60 ? 'bg-[#ba1d1d]' :
                              'bg-[#373643]'
                            }`}
                            style={{ width: `${prediction.confidence}%` }}
                          ></div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {prediction.confidence >= 80 ? 'High confidence - Strong data patterns' :
                           prediction.confidence >= 60 ? 'Medium confidence - Limited recent data' :
                           'Low confidence - Insufficient historical data'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
