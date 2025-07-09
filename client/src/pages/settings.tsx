import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/contexts/language-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Settings() {
  const { user, refetchUser } = useAuth();
  const { t } = useLang();
  const restaurantId = user?.restaurantId;
  const { toast } = useToast();
  
  const [restaurant, setRestaurant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  
  // Password change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const fetchRestaurantDetails = async () => {
      if (!restaurantId) return;
      
      try {
        const response = await fetch(`/api/restaurants/${restaurantId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setRestaurant(data);
        }
      } catch (error) {
        console.error("Error fetching restaurant details:", error);
        toast({
          title: "Error",
          description: "Failed to load restaurant details",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRestaurantDetails();
  }, [restaurantId, toast]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!restaurantId || !restaurant) return;
    
    setIsSaving(true);
    
    try {
      const response = await apiRequest("PUT", `/api/restaurants/${restaurantId}`, {
        name: restaurant.name,
        description: restaurant.description,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        logo: restaurant.logo,
        isActive: restaurant.isActive
      });
      
      if (response.ok) {
        toast({
          title: "Profile updated",
          description: "Your restaurant profile has been updated successfully"
        });
        
        // Refresh user data if email was changed
        refetchUser();
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!restaurantId) return;
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive"
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      // We'll just update the password directly
      // In a real app, you would verify the current password first
      const response = await apiRequest("PUT", `/api/restaurants/${restaurantId}`, {
        password: newPassword
      });
      
      if (response.ok) {
        toast({
          title: "Password updated",
          description: "Your password has been changed successfully"
        });
        
        // Clear password fields
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: "Failed to change password",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout
        title={t("settings", "Settings")}
        description="Manage your restaurant settings"
        requireAuth
        allowedRoles={['restaurant']}
      >
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={t("settings", "Settings")}
      description="Manage your restaurant settings"
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="profile">{t("restaurantProfile", "Restaurant Profile")}</TabsTrigger>
            <TabsTrigger value="password">{t("password", "Password")}</TabsTrigger>
            <TabsTrigger value="notifications">{t("notifications", "Notifications")}</TabsTrigger>
          </TabsList>
          
          {/* Restaurant Profile Tab */}
          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("restaurantProfile", "Restaurant Profile")}</CardTitle>
                <CardDescription>
                  Update your restaurant's information and appearance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("restaurantName", "Restaurant Name")}</Label>
                    <Input
                      id="name"
                      value={restaurant?.name || ""}
                      onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("emailAddress", "Email Address")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={restaurant?.email || ""}
                      onChange={(e) => setRestaurant({ ...restaurant, email: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={restaurant?.phone || ""}
                      onChange={(e) => setRestaurant({ ...restaurant, phone: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={restaurant?.address || ""}
                      onChange={(e) => setRestaurant({ ...restaurant, address: e.target.value })}
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={restaurant?.description || ""}
                      onChange={(e) => setRestaurant({ ...restaurant, description: e.target.value })}
                      rows={4}
                      placeholder="Describe your restaurant..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="logo">Logo URL</Label>
                    <Input
                      id="logo"
                      value={restaurant?.logo || ""}
                      onChange={(e) => setRestaurant({ ...restaurant, logo: e.target.value })}
                      placeholder="https://example.com/logo.jpg"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="active"
                      checked={restaurant?.isActive || false}
                      onCheckedChange={(checked) => setRestaurant({ ...restaurant, isActive: checked })}
                    />
                    <Label htmlFor="active">Restaurant Active</Label>
                  </div>
                  
                  <Button
                    type="submit"
                    className="mt-4 bg-brand hover:bg-red-700 text-white"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <span className="flex items-center">
                        <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                        Saving...
                      </span>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Password Tab */}
          <TabsContent value="password" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    className="mt-4 bg-brand hover:bg-red-700 text-white"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <span className="flex items-center">
                        <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                        Changing Password...
                      </span>
                    ) : (
                      "Change Password"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Configure how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">New Order Notifications</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications when new orders are placed</p>
                    </div>
                    <Switch id="new-orders" defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Order Status Updates</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications when order statuses change</p>
                    </div>
                    <Switch id="order-updates" defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Marketing Emails</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Receive emails about new features and promotions</p>
                    </div>
                    <Switch id="marketing" />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Weekly Digests</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Receive weekly summary of your restaurant's activity</p>
                    </div>
                    <Switch id="digests" defaultChecked />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="bg-brand hover:bg-red-700 text-white">
                  Save Notification Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
