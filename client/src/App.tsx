import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { LanguageProvider } from "@/contexts/language-context";
import NotFound from "@/pages/not-found";

// Pages
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import MenuManagement from "@/pages/menu-management";
import Tables from "@/pages/tables";
import Orders from "@/pages/orders";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import Subscription from "@/pages/subscription";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminRestaurants from "@/pages/admin-restaurants";
import AdminSubscriptions from "@/pages/admin-subscriptions";
import AdminSettings from "@/pages/admin-settings";
import CustomerMenu from "@/pages/customer-menu";
import Landing from "@/pages/landing";

function Router() {
  return (
    <Switch>
      {/* Auth Routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Restaurant Routes */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/menu-management" component={MenuManagement} />
      <Route path="/tables" component={Tables} />
      <Route path="/orders" component={Orders} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/subscription" component={Subscription} />
      
      {/* Admin Routes */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/restaurants" component={AdminRestaurants} />
      <Route path="/admin/subscriptions" component={AdminSubscriptions} />
      <Route path="/admin/settings" component={AdminSettings} />
      
      {/* Customer-facing Routes */}
      <Route path="/menu/:restaurantId/:tableId" component={CustomerMenu} />
      
      {/* Default Route */}
      <Route path="/" component={Landing} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
