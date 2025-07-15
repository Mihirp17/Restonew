import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/contexts/language-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { getRelativeDateRange } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AIInsights } from "@/components/dashboard/ai-insights";
import { NewAIInsights } from "@/components/dashboard/new-ai-insights-fixed";
import { AIChatbox } from "@/components/dashboard/ai-chatbox";


// Define the type of analytics data
interface AnalyticsData {
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
  popularItems: Array<{
    id: number;
    name: string;
    count: number;
    price: string;
  }>;
}

export default function Analytics() {
  const { user } = useAuth();
  const { t } = useLang();
  const restaurantId = user?.restaurantId;
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const { toast } = useToast();
  const COLORS = ['#e53e3e', '#dd6b20', '#38a169', '#3182ce', '#805ad5', '#d53f8c'];
  const sortedItems = [...(analyticsData?.popularItems || [])].sort((a, b) => b.count - a.count);
  const chartItems = sortedItems.slice(0, 10);
  const popularItemsChartData = chartItems.map((item, idx) => ({
    name: item.name.length > 15 ? item.name.slice(0, 12) + '...' : item.name,
    fullName: item.name,
    value: item.count,
    rank: idx + 1
  }));
  const revenueByItemData = chartItems.map((item, idx) => ({
    name: item.name.length > 15 ? item.name.slice(0, 12) + '...' : item.name,
    fullName: item.name,
    revenue: parseFloat(item.price) * item.count,
    rank: idx + 1
  }));
  const pieChartData = chartItems.map(item => ({
    name: item.name || `Item #${item.id}`,
    value: item.count
  }));
  const dailySalesData = Array.from({ length: 7 }, (_, i) => ({
    date: `Day ${i + 1}`,
    revenue: Math.round(Math.random() * 1000 + 200) // Mock data
  }));



  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!restaurantId) {
        setError({
          title: "Authentication Error",
          message: "Please log in to view analytics"
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const { startDate, endDate } = getRelativeDateRange(dateRange);
        
        // Fetch all analytics data in parallel
        const [orderCountResponse, revenueResponse, avgOrderResponse, popularItemsResponse] = await Promise.all([
          apiRequest('POST', `/api/restaurants/${restaurantId}/analytics/orders`, { startDate, endDate }),
          apiRequest('POST', `/api/restaurants/${restaurantId}/analytics/revenue`, { startDate, endDate }),
          apiRequest('POST', `/api/restaurants/${restaurantId}/analytics/average-order`, { startDate, endDate }),
          fetch(`/api/restaurants/${restaurantId}/analytics/popular-items?limit=10`, { credentials: 'include' })
        ]);

        // Check for errors in responses
        const responses = [orderCountResponse, revenueResponse, avgOrderResponse, popularItemsResponse];
        for (const response of responses) {
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || errorData.error || 'Failed to fetch analytics data');
          }
        }

        const [orderCountData, revenueData, avgOrderData, popularItemsData] = await Promise.all([
          orderCountResponse.json(),
          revenueResponse.json(),
          avgOrderResponse.json(),
          popularItemsResponse.json()
        ]);
        
        setAnalyticsData({
          orderCount: orderCountData.orderCount || 0,
          revenue: revenueData.revenue || 0,
          averageOrderValue: avgOrderData.averageOrderValue || 0,
          popularItems: popularItemsData || []
        });
      } catch (error) {
        console.error('Error fetching analytics data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load analytics data';
        setError({
          title: "Error Loading Analytics",
          message: errorMessage
        });
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [restaurantId, dateRange, toast]);

  return (
    <Layout
      title={t("analytics", "Analytics & AI")}
      description="View performance metrics and get AI-powered insights for your restaurant"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analytics">{t("analytics", "Analytics")}</TabsTrigger>
          <TabsTrigger value="ai-insights">{t("aiInsights", "AI Insights")}</TabsTrigger>
          <TabsTrigger value="restaurant-analytics">{t("restaurantAnalytics", "Restaurant Analytics")}</TabsTrigger>
          <TabsTrigger value="ai-assistant">{t("aiAssistant", "AI Assistant")}</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          {/* Date Range Selector */}
          <div className="flex justify-end">
            <Select
              value={dateRange}
              onValueChange={(value: any) => setDateRange(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("today", "Today")}</SelectItem>
                <SelectItem value="week">{t("thisWeek", "This Week")}</SelectItem>
                <SelectItem value="month">{t("thisMonth", "This Month")}</SelectItem>
                <SelectItem value="year">{t("thisYear", "This Year")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* If there's an error, show error state */}
          {error ? (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
              <div className="text-red-500 text-5xl mb-4">
                <span className="material-icons">error_outline</span>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{error.title}</h2>
              <p className="text-gray-500 dark:text-gray-400">{error.message}</p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                <span className="material-icons mr-2">refresh</span>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("totalOrders", "Total Orders")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {isLoading ? (
                        <div className="flex flex-col gap-2 h-[350px] justify-center">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-gray-200 rounded h-7 w-full" style={{ marginBottom: 8 }} />
                          ))}
                        </div>
                      ) : analyticsData?.orderCount}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {dateRange === 'today' ? 'Today' : 
                       dateRange === 'week' ? 'Past 7 days' : 
                       dateRange === 'month' ? 'Past 30 days' : 'Past year'}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("totalRevenue", "Total Revenue")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {isLoading ? (
                        <div className="flex flex-col gap-2 h-[350px] justify-center">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-gray-200 rounded h-7 w-full" style={{ marginBottom: 8 }} />
                          ))}
                        </div>
                      ) : formatCurrency(analyticsData?.revenue || 0)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {dateRange === 'today' ? 'Today' : 
                       dateRange === 'week' ? 'Past 7 days' : 
                       dateRange === 'month' ? 'Past 30 days' : 'Past year'}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("averageOrderValue", "Average Order Value")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {isLoading ? (
                        <div className="flex flex-col gap-2 h-[350px] justify-center">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-gray-200 rounded h-7 w-full" style={{ marginBottom: 8 }} />
                          ))}
                        </div>
                      ) : formatCurrency(analyticsData?.averageOrderValue || 0)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {dateRange === 'today' ? 'Today' : 
                       dateRange === 'week' ? 'Past 7 days' : 
                       dateRange === 'month' ? 'Past 30 days' : 'Past year'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Section: Sales Analytics */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-[#373643] mb-4">Sales Analytics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Popular Items Chart */}
                  <Card className="bg-white border border-[#373643]/10 shadow-lg rounded-2xl p-4">
                  <CardHeader>
                    <CardTitle>Popular Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                        <div className="flex flex-col gap-2 h-[350px] justify-center">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-gray-200 rounded h-7 w-full" style={{ marginBottom: 8 }} />
                          ))}
                      </div>
                    ) : popularItemsChartData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                            data={popularItemsChartData}
                          layout="vertical"
                              margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                          >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis type="number" stroke="#666" fontSize={12} />
                              <YAxis
                                dataKey="name"
                                type="category"
                                width={140}
                                stroke="#666"
                                fontSize={12}
                                tick={({ x, y, payload }) => (
                                  <>
                                    <title>{payload.fullName}</title>
                                    <text x={x} y={y + 4} fontSize="13" fill="#373643">{payload.value}</text>
                                  </>
                                )}
                              />
                              <Tooltip
                                content={({ active, payload }) =>
                                  active && payload && payload.length ? (
                                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                      <p className="font-medium text-gray-800">{payload[0].payload.fullName}</p>
                                      <p className="text-sm" style={{ color: "#ba1d1d" }}>
                                        Orders: {payload[0].value}
                                      </p>
                                    </div>
                                  ) : null
                                }
                              />
                              <Bar
                                dataKey="value"
                                fill="url(#colorGradient1)"
                                radius={[0, 6, 6, 0]}
                                strokeWidth={1}
                                stroke="#ba1d1d"
                                label={({ x, y, width, height, value, index }) => (
                                  <g>
                                    <text x={x + 8} y={y + height / 2 + 5} fontSize="13" fill="#ba1d1d" fontWeight="bold">
                                      {popularItemsChartData[index].rank}.
                                    </text>
                                    <text x={x + 32} y={y + height / 2 + 5} fontSize="13" fill="#373643">
                                      {popularItemsChartData[index].name}
                                    </text>
                                  </g>
                                )}
                              />
                              <defs>
                                <linearGradient id="colorGradient1" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#ba1d1d" />
                                  <stop offset="100%" stopColor="#e53e3e" />
                                </linearGradient>
                              </defs>
                        </BarChart>
                      </ResponsiveContainer>
                        </>
                    ) : (
                      <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                        No data available
                      </div>
                    )}
                  </CardContent>
                </Card>
                {/* Revenue by Item Chart */}
                  <Card className="bg-white border border-[#373643]/10 shadow-lg rounded-2xl p-4">
                  <CardHeader>
                    <CardTitle>Revenue by Item</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                        <div className="flex flex-col gap-2 h-[350px] justify-center">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-gray-200 rounded h-7 w-full" style={{ marginBottom: 8 }} />
                          ))}
                      </div>
                    ) : revenueByItemData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                          data={revenueByItemData}
                            layout="vertical"
                            margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis type="number" stroke="#666" fontSize={12} tickFormatter={formatCurrency} />
                            <YAxis
                            dataKey="name" 
                              type="category"
                              width={140}
                              stroke="#666"
                              fontSize={12}
                              tick={({ x, y, payload }) => (
                                <>
                                  <title>{payload.fullName}</title>
                                  <text x={x} y={y + 4} fontSize="13" fill="#373643">{payload.value}</text>
                                </>
                              )}
                            />
                            <Tooltip
                              content={({ active, payload }) =>
                                active && payload && payload.length ? (
                                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                    <p className="font-medium text-gray-800">{payload[0].payload.fullName}</p>
                                    <p className="text-sm" style={{ color: "#178a29" }}>
                                      Revenue: {formatCurrency(payload[0].payload.revenue)}
                                    </p>
                                  </div>
                                ) : null
                              }
                            />
                            <Bar
                              dataKey="revenue"
                              fill="url(#colorGradient3)"
                              radius={[0, 6, 6, 0]}
                              strokeWidth={1}
                              stroke="#178a29"
                              label={({ x, y, width, height, value, index }) => (
                                <g>
                                  <text x={x + 8} y={y + height / 2 + 5} fontSize="13" fill="#178a29" fontWeight="bold">
                                    {revenueByItemData[index].rank}.
                                  </text>
                                  <text x={x + 32} y={y + height / 2 + 5} fontSize="13" fill="#373643">
                                    {revenueByItemData[index].name}
                                  </text>
                                </g>
                              )}
                            />
                            <defs>
                              <linearGradient id="colorGradient3" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#22bb33" />
                                <stop offset="100%" stopColor="#178a29" />
                              </linearGradient>
                            </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                        No data available
                      </div>
                    )}
                  </CardContent>
                </Card>
                  {/* Pie Chart: Order Share by Item */}
                  <Card className="bg-white border border-[#373643]/10 shadow-lg rounded-2xl p-4">
                    <CardHeader>
                      <CardTitle>Order Share by Item</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="flex justify-center items-center h-80">
                          <div className="animate-spin w-8 h-8 border-4 border-[#ba1d1d] border-t-transparent rounded-full"></div>
                        </div>
                      ) : pieChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={120}
                              paddingAngle={2}
                              dataKey="value"
                              label={false}
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) =>
                                active && payload && payload.length ? (
                                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                    <p className="font-medium text-gray-800">{payload[0].payload.fullName}</p>
                                    <p className="text-sm" style={{ color: payload[0].color }}>
                                      Orders: {payload[0].value}
                                    </p>
                                  </div>
                                ) : null
                              }
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={36}
                              formatter={(value, entry) => (
                                <span style={{ color: entry.color, fontSize: '12px' }}>{value}</span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                          No data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  {/* Daily Sales Area Chart */}
                  <Card className="bg-white border border-[#373643]/10 shadow-lg rounded-2xl p-4">
                    <CardHeader>
                      <CardTitle>Daily Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="flex justify-center items-center h-80">
                          <div className="animate-spin w-8 h-8 border-4 border-[#ba1d1d] border-t-transparent rounded-full"></div>
                        </div>
                      ) : dailySalesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <AreaChart data={dailySalesData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} tickFormatter={formatCurrency} />
                            <Tooltip
                              content={({ active, payload, label }) =>
                                active && payload && payload.length ? (
                                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                    <p className="font-medium text-gray-800">{label}</p>
                                    <p className="text-sm" style={{ color: "#3182ce" }}>
                                      Revenue: {formatCurrency(typeof payload[0].value === "number" ? payload[0].value : 0)}
                                    </p>
                                  </div>
                                ) : null
                              }
                            />
                            <Area
                              type="monotone"
                              dataKey="revenue"
                              stroke="#3182ce"
                              fill="url(#colorGradient2)"
                              strokeWidth={3}
                              name="Revenue"
                            />
                            <defs>
                              <linearGradient id="colorGradient2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3182ce" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#3182ce" stopOpacity={0.1} />
                              </linearGradient>
                            </defs>
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                          No data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Section: Menu Performance */}
              <div className="mt-12">
                <h2 className="text-xl font-semibold text-[#373643] mb-4">Menu Performance</h2>
                <Card className="bg-white border border-[#373643]/10 shadow-lg rounded-2xl p-4">
                <CardHeader>
                  <CardTitle>Popular Menu Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
                    </div>
                  ) : analyticsData?.popularItems && analyticsData.popularItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Orders</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Price</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {analyticsData.popularItems.map((item) => (
                            <tr key={item.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.name || `Item #${item.id}`}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.count}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(parseFloat(item.price))}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(parseFloat(item.price) * item.count)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="ai-insights">
          {restaurantId ? (
            <AIInsights restaurantId={restaurantId} />
          ) : (
            <div className="flex justify-center items-center py-12">
              <p className="text-gray-500">Please log in to view AI insights.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="restaurant-analytics">
          {restaurantId ? (
            <NewAIInsights restaurantId={restaurantId} />
          ) : (
            <div className="flex justify-center items-center py-12">
              <p className="text-gray-500">Please log in to view restaurant analytics.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-assistant">
          {restaurantId ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <AIChatbox restaurantId={restaurantId} />
              </div>
              <div className="space-y-6">
                {/* Remove Quick Stats Card here */}
                {/* <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    ...
                  </CardContent>
                </Card> */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI Tips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-700">💡 Ask about menu performance</p>
                        <p className="text-gray-600">Get insights on your best and worst performing items</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-700">📊 Revenue analysis</p>
                        <p className="text-gray-600">Understand your peak hours and revenue trends</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-700">🎯 Operational efficiency</p>
                        <p className="text-gray-600">Get tips to improve kitchen workflow and wait times</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center py-12">
              <p className="text-gray-500">Please log in to use the AI assistant.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
