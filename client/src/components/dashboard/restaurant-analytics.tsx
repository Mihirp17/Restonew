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
}

interface RestaurantAnalyticsProps {
  restaurantId: number;
  startDate?: Date;
  endDate?: Date;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#FF6B6B'];

export function RestaurantAnalytics({ restaurantId, startDate, endDate }: RestaurantAnalyticsProps) {
  const [menuAnalytics, setMenuAnalytics] = useState<MenuAnalytics | null>(null);
  const [demandPredictions, setDemandPredictions] = useState<DemandPrediction[]>([]);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [restaurantId, timeframe]);

  const fetchData = async () => {
    if (!restaurantId) return;
    
    try {
      setIsLoading(true);
      const [menuData, demandData] = await Promise.all([
        apiRequest('GET', `/api/restaurants/${restaurantId}/analytics/menu?timeframe=${timeframe}`),
        apiRequest('GET', `/api/restaurants/${restaurantId}/analytics/demand-prediction`)
      ]);

      setMenuAnalytics(await menuData.json());
      setDemandPredictions(await demandData.json());
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
    return <div className="space-y-4">
      <Skeleton className="h-8 w-[200px]" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <span className="material-icons text-xl text-purple-600 dark:text-purple-300">analytics</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Restaurant Analytics</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">AI-powered insights for your business</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">
                <div className="flex items-center gap-2">
                  <span className="material-icons text-sm">today</span>
                  Today's Analysis
                </div>
              </SelectItem>
              <SelectItem value="week">
                <div className="flex items-center gap-2">
                  <span className="material-icons text-sm">date_range</span>
                  Weekly Analysis
                </div>
              </SelectItem>
              <SelectItem value="month">
                <div className="flex items-center gap-2">
                  <span className="material-icons text-sm">calendar_month</span>
                  Monthly Analysis
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground mb-6">
          <TabsTrigger value="menu" className="flex items-center gap-2 px-4">
            <span className="material-icons text-lg">restaurant_menu</span>
            Menu Performance
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2 px-4">
            <span className="material-icons text-lg">trending_up</span>
            F&B Growth
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2 px-4">
            <span className="material-icons text-lg">category</span>
            Categories
          </TabsTrigger>
          <TabsTrigger value="demand" className="flex items-center gap-2 px-4">
            <span className="material-icons text-lg">analytics</span>
            Predictions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Menu Performance Grid */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Top Performing Items */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className="material-icons text-blue-600">trending_up</span>
                        Top Performers
                      </CardTitle>
                      <CardDescription>Most ordered items</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {menuAnalytics?.topSelling.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white/60 dark:bg-white/10 rounded-lg hover:bg-white/80 dark:hover:bg-white/20 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-200 font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {item.count} orders
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${
                              item.growth > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {item.growth > 0 ? '+' : ''}{item.growth}%
                            </div>
                            <p className="text-xs text-gray-500">vs. prev. {timeframe}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Low Performing Items */}
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/50 dark:to-orange-800/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className="material-icons text-orange-600">warning</span>
                        Needs Attention
                      </CardTitle>
                      <CardDescription>Low performing items</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {menuAnalytics?.lowSelling.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white/60 dark:bg-white/10 rounded-lg hover:bg-white/80 dark:hover:bg-white/20 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-800 flex items-center justify-center">
                              <span className="material-icons text-orange-600 dark:text-orange-200">priority_high</span>
                            </div>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {item.count} orders
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-red-600">
                              {item.growth}%
                            </div>
                            <p className="text-xs text-gray-500">vs. prev. {timeframe}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Sales Chart */}
            <Card className="md:row-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="material-icons text-purple-600">bar_chart</span>
                  Sales Overview
                </CardTitle>
                <CardDescription>Performance comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart 
                    data={[
                      ...(menuAnalytics?.topSelling || []).map(item => ({ ...item, type: 'Top' })),
                      ...(menuAnalytics?.lowSelling || []).map(item => ({ ...item, type: 'Low' }))
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end"
                      height={60}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar 
                      dataKey="count" 
                      radius={[4, 4, 0, 0]}
                    >
                      {(menuAnalytics?.topSelling || []).concat(menuAnalytics?.lowSelling || []).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.type === 'Top Selling' ? '#0088FE' : '#FF6B6B'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Growth Trends */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="material-icons text-green-600">trending_up</span>
                    F&B Growth Trends
                  </CardTitle>
                  <CardDescription>Revenue and order trends over time</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={menuAnalytics?.topSelling}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="#0088FE" />
                  <YAxis yAxisId="right" orientation="right" stroke="#FF6B6B" />
                  <Tooltip />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#0088FE" 
                    name="Orders"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#FF6B6B" 
                    name="Revenue"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="material-icons text-indigo-600">pie_chart</span>
                  Category Distribution
                </CardTitle>
                <CardDescription>Orders by food category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={menuAnalytics?.categoryBreakdown}
                      dataKey="count"
                      nameKey="category"
                      label
                      labelLine={false}
                    >
                      {menuAnalytics?.categoryBreakdown.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Revenue */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="material-icons text-purple-600">payments</span>
                  Revenue by Category
                </CardTitle>
                <CardDescription>Financial performance by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={menuAnalytics?.categoryBreakdown}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {menuAnalytics?.categoryBreakdown.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="demand" className="space-y-6">
          {/* AI Prediction Explanation */}
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center">
                  <span className="material-icons text-2xl text-purple-600 dark:text-purple-200">auto_awesome</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">AI-Powered Predictions</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Our AI analyzes historical data, seasonal patterns, and real-time trends to predict future demand for menu items.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demand Predictions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {demandPredictions.map((prediction, index) => (
              <Card key={index} className={`
                transition-all hover:shadow-lg
                ${prediction.trend === 'up' ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30' : 
                  prediction.trend === 'down' ? 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/30' : 
                  'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30'}
              `}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${prediction.trend === 'up' ? 'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-200' : 
                          prediction.trend === 'down' ? 'bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-200' : 
                          'bg-yellow-100 text-yellow-600 dark:bg-yellow-800 dark:text-yellow-200'}
                      `}>
                        <span className="material-icons">
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
                      ${prediction.trend === 'up' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 
                        prediction.trend === 'down' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' : 
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'}
                    `}>
                      {prediction.trend === 'up' ? '↑' : prediction.trend === 'down' ? '↓' : '→'} {prediction.predictedDemand} units
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-white/60 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-icons text-gray-600 dark:text-gray-300">schedule</span>
                        <span className="font-medium">Peak Hours</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {prediction.peakHours.map((hour, i) => (
                          <Badge key={i} variant="outline" className="bg-white/80 dark:bg-gray-700">
                            {hour}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/60 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="material-icons text-gray-600 dark:text-gray-300">analytics</span>
                          <span className="font-medium">Prediction Confidence</span>
                        </div>
                        <span className="font-semibold">{prediction.confidence}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            prediction.confidence >= 80 ? 'bg-green-500' :
                            prediction.confidence >= 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${prediction.confidence}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
