import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Placeholder payment form component (Stripe removed)
const PaymentForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate processing time
    setTimeout(() => {
      toast({
        title: "Payment Successful",
        description: "Your subscription is now active (placeholder implementation)",
      });
      onSuccess();
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This is a placeholder implementation. No actual payment processing occurs.
        </AlertDescription>
      </Alert>
      
      <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Payment processing has been replaced with a no-op implementation.
          Click "Subscribe Now" to simulate a successful payment.
        </p>
      </div>
      
      <Button 
        type="submit" 
        disabled={isProcessing} 
        className="w-full bg-brand hover:bg-red-700 text-white"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center">
            <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
            Processing...
          </span>
        ) : (
          "Subscribe Now (Placeholder)"
        )}
      </Button>
    </form>
  );
};

const PlanCard = ({ 
  name, 
  price, 
  features, 
  isCurrentPlan, 
  onSelect, 
  disabled 
}: { 
  name: string, 
  price: string, 
  features: string[], 
  isCurrentPlan?: boolean, 
  onSelect: () => void, 
  disabled?: boolean 
}) => {
  return (
    <Card className={`${isCurrentPlan ? 'border-brand' : ''}`}>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">${price}</span>
          <span className="text-gray-500 dark:text-gray-400">/month</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onSelect} 
          className={`w-full ${isCurrentPlan ? 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : 'bg-brand hover:bg-red-700 text-white'}`}
          disabled={isCurrentPlan || disabled}
        >
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function Subscription() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const { toast } = useToast();
  
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  
  // Fetch subscription details
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!restaurantId) return;
      
      try {
        const response = await fetch(`/api/restaurants/${restaurantId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const restaurant = await response.json();
          
          // Check if restaurant has subscription relation
          if (restaurant.subscription) {
            setSubscription(restaurant.subscription);
          }
        }
      } catch (error) {
        console.error("Error fetching subscription details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSubscription();
  }, [restaurantId]);
  
  // Initialize payment when plan is selected
  const handlePlanSelect = async (planId: string) => {
    if (!restaurantId) return;
    
    try {
      const response = await apiRequest("POST", `/api/restaurants/${restaurantId}/subscription`, {
        planId
      });
      
      const data = await response.json();
      setShowPaymentForm(true);
      setSelectedPlan(planId);
      
      toast({
        title: "Plan Selected",
        description: `Selected ${planId} plan. Complete payment to activate.`,
      });
    } catch (error) {
      console.error("Error initializing subscription:", error);
      toast({
        title: "Error",
        description: "Failed to initialize subscription",
        variant: "destructive"
      });
    }
  };
  
  // Reset payment form after successful payment
  const handlePaymentSuccess = () => {
    setShowPaymentForm(false);
    setSelectedPlan(null);
    
    // Simulate successful subscription creation
    setSubscription({
      status: 'active',
      plan: selectedPlan || 'basic',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
  };
  
  // Define plans
  const plans = [
    {
      id: "basic",
      name: "Basic",
      price: isAnnual ? "24.99" : "29.99",
      features: [
        "Up to 50 menu items",
        "Up to 10 tables",
        "Basic analytics",
        "Email support"
      ]
    },
    {
      id: "premium",
      name: "Premium",
      price: isAnnual ? "41.99" : "49.99",
      features: [
        "Unlimited menu items",
        "Up to 30 tables",
        "Advanced analytics",
        "Priority email support",
        "Custom QR code branding"
      ]
    }
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-300 rounded"></div>
              <div className="h-64 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your restaurant's subscription plan and billing (placeholder implementation)
          </p>
        </div>

        {subscription ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Active Subscription
              </CardTitle>
              <CardDescription>
                Your current subscription details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="font-medium">Plan</p>
                  <p className="text-lg capitalize">{subscription.plan}</p>
                </div>
                <div>
                  <p className="font-medium">Status</p>
                  <p className="text-lg capitalize text-green-600">{subscription.status}</p>
                </div>
                <div>
                  <p className="font-medium">Next Billing Date</p>
                  <p className="text-lg">
                    {subscription.currentPeriodEnd 
                      ? formatDate(new Date(subscription.currentPeriodEnd)) 
                      : "N/A"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have an active subscription. Choose a plan below to get started.
            </AlertDescription>
          </Alert>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center mb-8">
          <Label htmlFor="billing-toggle" className="mr-4">Monthly</Label>
          <Switch
            id="billing-toggle"
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <Label htmlFor="billing-toggle" className="ml-4">
            Annual <span className="text-green-600">(Save 20%)</span>
          </Label>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {plans.map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-gray-500">/{isAnnual ? 'year' : 'month'}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handlePlanSelect(plan.id)}
                  disabled={subscription?.plan === plan.id}
                  variant={subscription?.plan === plan.id ? "secondary" : "default"}
                >
                  {subscription?.plan === plan.id ? "Current Plan" : "Select Plan"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {showPaymentForm && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
              <CardDescription>
                Complete your subscription (placeholder implementation - no actual payment)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentForm onSuccess={handlePaymentSuccess} />
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
