import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate, formatCurrency, getInitials, getStatusColor } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState("price_placeholder_basic");
  const [isProcessing, setIsProcessing] = useState(false);

  // Define available plans
  const plans = [
    { id: "price_placeholder_basic", name: "Basic", price: "29.99" },
    { id: "price_placeholder_premium", name: "Premium", price: "49.99" }
  ];

  // Fetch restaurants with their subscriptions
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await fetch("/api/restaurants", {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setRestaurants(data);
        }
      } catch (error) {
        console.error("Error fetching restaurants:", error);
        toast({
          title: "Error",
          description: "Failed to load restaurants",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRestaurants();
  }, [toast]);

  // Filter restaurants based on search term
  const filteredRestaurants = restaurants.filter(restaurant => 
    restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    restaurant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditSubscription = (restaurant: any) => {
    setSelectedRestaurant(restaurant);
    // If restaurant has subscription, set the current plan
    if (restaurant.subscription) {
      const currentPlan = plans.find(p => p.name.toLowerCase() === restaurant.subscription.plan.toLowerCase());
      if (currentPlan) {
        setSelectedPlan(currentPlan.id);
      }
    }
    setIsDialogOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!selectedRestaurant) return;
    
    setIsProcessing(true);
    
    try {
      // If restaurant already has a subscription, update it
      if (selectedRestaurant.subscription) {
        const response = await apiRequest("PUT", `/api/restaurants/${selectedRestaurant.id}/subscription`, {
          planId: selectedPlan
        });
        
        if (response.ok) {
          toast({
            title: "Subscription updated",
            description: "The subscription plan has been updated"
          });
          
          // Update the subscription in the list
          const plan = plans.find(p => p.id === selectedPlan)?.name.toLowerCase() || "basic";
          setRestaurants(restaurants.map(r => 
            r.id === selectedRestaurant.id 
              ? { 
                  ...r, 
                  subscription: { 
                    ...r.subscription, 
                    plan 
                  } 
                } 
              : r
          ));
        }
      } else {
        // Create new subscription
        const response = await apiRequest("POST", `/api/restaurants/${selectedRestaurant.id}/subscription`, {
          planId: selectedPlan
        });
        
        if (response.ok) {
          toast({
            title: "Subscription created",
            description: "The subscription has been created successfully"
          });
          
          // Refresh the restaurants list after adding a subscription
          const restaurantsResponse = await fetch("/api/restaurants", {
            credentials: 'include'
          });
          
          if (restaurantsResponse.ok) {
            const data = await restaurantsResponse.json();
            setRestaurants(data);
          }
        }
      }
      
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast({
        title: "Error",
        description: "Failed to update subscription",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async (restaurant: any) => {
    if (!restaurant.subscription) return;
    
    try {
      const response = await apiRequest("DELETE", `/api/restaurants/${restaurant.id}/subscription`, {});
      
      if (response.ok) {
        toast({
          title: "Subscription cancelled",
          description: "The subscription has been cancelled"
        });
        
        // Update the subscription status in the list
        setRestaurants(restaurants.map(r => 
          r.id === restaurant.id 
            ? { 
                ...r, 
                subscription: { 
                  ...r.subscription, 
                  status: 'canceled' 
                } 
              } 
            : r
        ));
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription",
        variant: "destructive"
      });
    }
  };

  // Calculate monthly revenue
  const calculateMonthlyRevenue = (restaurant: any): number => {
    if (!restaurant.subscription || restaurant.subscription.status !== 'active') {
      return 0;
    }
    
    // Return subscription price based on plan
    switch (restaurant.subscription.plan.toLowerCase()) {
      case 'basic':
        return 29.99;
      case 'premium':
        return 49.99;
      case 'enterprise':
        return 99.99;
      default:
        return 0;
    }
  };

  return (
    <Layout
      title="Subscription Management"
      description="Manage restaurant subscriptions and billing"
      requireAuth
      allowedRoles={['platform_admin']}
    >
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative">
            <Input
              placeholder="Search restaurants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 material-icons">search</span>
          </div>
        </div>

        {/* Subscription Table */}
        <Card>
          <CardHeader>
            <CardTitle>Restaurant Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Loading subscriptions...</p>
              </div>
            ) : filteredRestaurants.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Restaurant</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Billing Period</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monthly Revenue</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRestaurants.map((restaurant) => {
                      const hasSubscription = !!restaurant.subscription;
                      const subscriptionStatus = hasSubscription ? restaurant.subscription.status : "none";
                      const statusColors = getStatusColor(subscriptionStatus);
                      const monthlyRevenue = calculateMonthlyRevenue(restaurant);
                      
                      return (
                        <tr key={restaurant.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
                                {getInitials(restaurant.name)}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{restaurant.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{restaurant.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {hasSubscription ? (
                              <div>
                                <div className="text-sm text-gray-900 dark:text-white">
                                  {restaurant.subscription.plan.charAt(0).toUpperCase() + restaurant.subscription.plan.slice(1)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {restaurant.subscription.plan.toLowerCase() === 'basic' && '$29.99/month'}
                                  {restaurant.subscription.plan.toLowerCase() === 'premium' && '$49.99/month'}
                                  {restaurant.subscription.plan.toLowerCase() === 'enterprise' && '$99.99/month'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">No subscription</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {hasSubscription ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors.bgClass} ${statusColors.textClass} ${statusColors.darkBgClass} ${statusColors.darkTextClass}`}>
                                {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                None
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {hasSubscription ? (
                              `${formatDate(restaurant.subscription.currentPeriodStart)} - ${formatDate(restaurant.subscription.currentPeriodEnd)}`
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {monthlyRevenue > 0 ? formatCurrency(monthlyRevenue) : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button 
                              variant="ghost" 
                              className="text-brand hover:text-red-800 dark:hover:text-red-400 mr-3"
                              onClick={() => handleEditSubscription(restaurant)}
                            >
                              Edit
                            </Button>
                            {hasSubscription && subscriptionStatus === 'active' && (
                              <Button 
                                variant="ghost" 
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                onClick={() => handleCancelSubscription(restaurant)}
                              >
                                Cancel
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No restaurants found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subscription Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedRestaurant?.subscription ? "Update Subscription" : "Add Subscription"}
            </DialogTitle>
            <DialogDescription>
              {selectedRestaurant?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Subscription Plan</label>
              <Select
                value={selectedPlan}
                onValueChange={setSelectedPlan}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price}/month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-4 text-sm text-gray-500 dark:text-gray-400">
              {selectedRestaurant?.subscription ? (
                <p>
                  Current plan: <span className="font-medium">{selectedRestaurant.subscription.plan}</span><br />
                  Status: <span className="font-medium">{selectedRestaurant.subscription.status}</span><br />
                  Current period ends: <span className="font-medium">{formatDate(selectedRestaurant.subscription.currentPeriodEnd)}</span>
                </p>
              ) : (
                <p>The restaurant will be subscribed to the selected plan immediately.</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateSubscription}
              className="bg-brand hover:bg-red-700 text-white"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Processing...
                </span>
              ) : (
                selectedRestaurant?.subscription ? "Update Subscription" : "Add Subscription"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
