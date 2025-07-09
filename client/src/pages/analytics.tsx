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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AIInsights } from "@/components/dashboard/ai-insights";
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

  // Define colors for charts
  const COLORS = ['#e53e3e', '#dd6b20', '#38a169', '#3182ce', '#805ad5', '#d53f8c'];

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

  // Prepare data for popular items chart
  const popularItemsChartData = analyticsData?.popularItems.map(item => ({
    name: item.name || `Item #${item.id}`,
    value: item.count
  })) || [];

  // Prepare data for revenue by item chart
  const revenueByItemData = analyticsData?.popularItems.map(item => ({
    name: item.name || `Item #${item.id}`,
    revenue: parseFloat(item.price) * item.count
  })) || [];

  return (
    <Layout
      title={t("analytics", "Analytics & AI")}
      description="View performance metrics and get AI-powered insights for your restaurant"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics">{t("analytics", "Analytics")}</TabsTrigger>
          <TabsTrigger value="ai-insights">{t("aiInsights", "AI Insights")}</TabsTrigger>
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
                      {isLoading ? "Loading..." : analyticsData?.orderCount}
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
                      {isLoading ? "Loading..." : formatCurrency(analyticsData?.revenue || 0)}
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
                      {isLoading ? "Loading..." : formatCurrency(analyticsData?.averageOrderValue || 0)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {dateRange === 'today' ? 'Today' : 
                       dateRange === 'week' ? 'Past 7 days' : 
                       dateRange === 'month' ? 'Past 30 days' : 'Past year'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Popular Items Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Popular Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex justify-center items-center h-80">
                        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
                      </div>
                    ) : popularItemsChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={popularItemsChartData}
                          layout="vertical"
                          margin={{ top: 20, right: 20, left: 40, bottom: 20 }}
                          >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax + 5']} />
                          <YAxis dataKey="name" type="category" width={150} />
                          <Tooltip formatter={(value) => [`${value} orders`, 'Orders']} />
                          <Bar dataKey="value" fill="#e53e3e" radius={[0, 6, 6, 0]}>
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                        No data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Revenue by Item Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue by Item</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex justify-center items-center h-80">
                        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
                      </div>
                    ) : revenueByItemData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={revenueByItemData}
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 60,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="name" 
                            angle={-45} 
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis tickFormatter={(value) => `$${value}`} />
                          <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                          <Bar dataKey="revenue" fill="#e53e3e" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                        No data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Popular Items Table */}
              <Card>
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

        <TabsContent value="ai-assistant">
          {restaurantId ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <AIChatbox restaurantId={restaurantId} />
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-sm font-medium">AI Insights Available</span>
                      </div>
                      <span className="text-sm text-purple-600 font-semibold">4 New</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium">Chat Sessions</span>
                      </div>
                      <span className="text-sm text-blue-600 font-semibold">12 Active</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Recommendations</span>
                      </div>
                      <span className="text-sm text-green-600 font-semibold">8 Pending</span>
                    </div>
                  </CardContent>
                </Card>
                
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
