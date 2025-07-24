import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/contexts/language-context";
import { apiRequest } from "@/lib/queryClient";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useSocket } from "@/hooks/use-socket";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const { addEventListener, removeEventListener } = useSocket();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRestaurants: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    revenueByPlan: [
      { name: "Basic", value: 0 },
      { name: "Premium", value: 0 },
      { name: "Enterprise", value: 0 }
    ]
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  // Mock revenue data for chart
  const revenueData = [
    { name: "Jan", revenue: 12500 },
    { name: "Feb", revenue: 15000 },
    { name: "Mar", revenue: 18000 },
    { name: "Apr", revenue: 16000 },
    { name: "May", revenue: 21000 },
    { name: "Jun", revenue: 25000 },
    { name: "Jul", revenue: 28000 },
    { name: "Aug", revenue: 32000 },
    { name: "Sep", revenue: 34000 },
    { name: "Oct", revenue: 36000 },
    { name: "Nov", revenue: 40000 },
    { name: "Dec", revenue: 42000 }
  ];

  // Colors for pie chart
  const COLORS = ['#e53e3e', '#38a169', '#3182ce'];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all restaurants
        const restaurantsResponse = await fetch("/api/restaurants", {
          credentials: 'include'
        });
        const restaurants = await restaurantsResponse.json();
        
        let activeSubscriptions = 0;
        let totalRevenue = 0;
        const revenueByPlan = {
          basic: 0,
          premium: 0,
          enterprise: 0
        };
        
        // Count active subscriptions and calculate revenue
        restaurants.forEach((restaurant: any) => {
          if (restaurant.subscription && restaurant.subscription.status === 'active') {
            activeSubscriptions++;
            
            // Calculate monthly revenue based on plan
            let monthlyRevenue = 0;
            switch (restaurant.subscription.plan.toLowerCase()) {
              case 'basic':
                monthlyRevenue = 29.99;
                revenueByPlan.basic += monthlyRevenue;
                break;
              case 'premium':
                monthlyRevenue = 49.99;
                revenueByPlan.premium += monthlyRevenue;
                break;
              case 'enterprise':
                monthlyRevenue = 99.99;
                revenueByPlan.enterprise += monthlyRevenue;
                break;
            }
            
            totalRevenue += monthlyRevenue;
          }
        });
        
        setStats({
          totalRestaurants: restaurants.length,
          activeSubscriptions,
          totalRevenue,
          revenueByPlan: [
            { name: "Basic", value: revenueByPlan.basic },
            { name: "Premium", value: revenueByPlan.premium },
            { name: "Enterprise", value: revenueByPlan.enterprise }
          ]
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchRecentActivities = async () => {
      const response = await fetch("/api/recent-activities", { credentials: "include" });
      const activities = await response.json();
      setRecentActivities(activities);
    };

    fetchRecentActivities();

    const handleNewActivity = (activity: any) => {
      setRecentActivities((prev) => [activity, ...prev].slice(0, 10));
    };

    addEventListener("new-activity", handleNewActivity);

    return () => {
      removeEventListener("new-activity", handleNewActivity);
    };
  }, [addEventListener, removeEventListener]);



  return (
    <Layout
      title="Platform Administration"
      description="Overview of the restaurant management platform"
      requireAuth
      allowedRoles={['platform_admin']}
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-[#373643]/10 bg-[#ffffff]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#373643]">
                {t("admin.dashboard.totalRestaurants")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ba1d1d]">
                {isLoading ? t("status.loading") : stats.totalRestaurants}
              </div>
              <p className="text-xs text-[#373643]/60 mt-1">
                {t("admin.dashboard.registeredPlatform")}
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-[#373643]/10 bg-[#ffffff]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#373643]">
                {t("admin.dashboard.activeSubscriptions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ba1d1d]">
                {isLoading ? t("status.loading") : stats.activeSubscriptions}
              </div>
              <p className="text-xs text-[#373643]/60 mt-1">
                {t("admin.dashboard.currentlyActive")}
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-[#373643]/10 bg-[#ffffff]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#373643]">
                {t("admin.dashboard.totalRevenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ba1d1d]">
                {isLoading ? t("status.loading") : `$${stats.totalRevenue.toLocaleString()}`}
              </div>
              <p className="text-xs text-[#373643]/60 mt-1">
                {t("admin.dashboard.thisMonth")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-[#373643]/10 bg-[#ffffff]">
            <CardHeader>
              <CardTitle className="text-[#373643]">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={revenueData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#373643" opacity={0.1} />
                    <XAxis dataKey="name" stroke="#373643" />
                    <YAxis tickFormatter={(value) => `$${value}`} stroke="#373643" />
                    <Tooltip 
                      formatter={(value) => [`$${value}`, 'Revenue']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #373643',
                        borderRadius: '6px',
                        color: '#373643'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#ba1d1d" 
                      activeDot={{ r: 8, fill: '#ba1d1d' }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-[#373643]/10 bg-[#ffffff]">
            <CardHeader>
              <CardTitle className="text-[#373643]">Revenue by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.revenueByPlan}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.revenueByPlan.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`$${value}`, 'Revenue']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #373643',
                        borderRadius: '6px',
                        color: '#373643'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-[#373643]/10 bg-[#ffffff]">
          <CardHeader>
            <CardTitle className="text-[#373643]">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center border-b border-[#373643]/10 pb-4 last:border-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${activity.iconBgClass}`}>
                    <span className={`material-icons ${activity.iconColor}`}>{activity.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#373643]">{activity.title}</p>
                    <p className="text-xs text-[#373643]/60">{activity.description}</p>
                  </div>
                  <div className="text-xs text-[#373643]/60">{activity.timeAgo}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
