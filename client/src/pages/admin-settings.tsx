import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function AdminSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile settings
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  
  // Password change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Platform settings
  const [platformName, setPlatformName] = useState("Restomate");
  const [supportEmail, setSupportEmail] = useState("support@restomate.com");
  // Payment processing state removed - using placeholder implementation
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully"
      });
      setIsSaving(false);
    }, 1000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully"
      });
      
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      setIsSaving(false);
    }, 1000);
  };

  const handlePlatformSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Settings updated",
        description: "Platform settings have been updated successfully"
      });
      setIsSaving(false);
    }, 1000);
  };

  return (
    <Layout
      title="Platform Settings"
      description="Manage platform-wide settings and your admin account"
      requireAuth
      allowedRoles={['platform_admin']}
    >
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="profile">Admin Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="platform">Platform Settings</TabsTrigger>
            <TabsTrigger value="billing">Billing & Subscriptions</TabsTrigger>
          </TabsList>
          
          {/* Admin Profile Tab */}
          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Admin Profile</CardTitle>
                <CardDescription>
                  Update your administrator profile information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
          
          {/* Platform Settings Tab */}
          <TabsContent value="platform" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Settings</CardTitle>
                <CardDescription>
                  Configure platform-wide settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePlatformSettingsUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="platformName">Platform Name</Label>
                    <Input
                      id="platformName"
                      value={platformName}
                      onChange={(e) => setPlatformName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="supportEmail">Support Email</Label>
                    <Input
                      id="supportEmail"
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label htmlFor="paymentEnabled">Payment Processing</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Payment processing currently uses placeholder implementation
                      </p>
                    </div>
                    <Switch
                      id="paymentEnabled"
                      checked={true}
                      disabled={true}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label htmlFor="maintenanceMode" className="text-red-600 dark:text-red-400">Maintenance Mode</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Put the platform in maintenance mode (users will see a maintenance page)
                      </p>
                    </div>
                    <Switch
                      id="maintenanceMode"
                      checked={maintenanceMode}
                      onCheckedChange={setMaintenanceMode}
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
                        Saving...
                      </span>
                    ) : (
                      "Save Settings"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Billing & Subscriptions Tab */}
          <TabsContent value="billing" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Billing & Subscription Plans</CardTitle>
                <CardDescription>
                  Manage subscription plans and pricing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Basic Plan */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">Basic Plan</h3>
                      <Switch id="basic-active" defaultChecked />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="basic-price">Monthly Price ($)</Label>
                        <Input id="basic-price" type="number" defaultValue="29.99" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="basic-annual">Annual Price ($)</Label>
                        <Input id="basic-annual" type="number" defaultValue="24.99" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="basic-features">Features (one per line)</Label>
                      <Textarea 
                        id="basic-features" 
                        className="mt-1" 
                        rows={3}
                        defaultValue={`Up to 50 menu items
Up to 10 tables
Basic analytics
Email support`}
                      />
                    </div>
                  </div>
                  
                  {/* Premium Plan */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">Premium Plan</h3>
                      <Switch id="premium-active" defaultChecked />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="premium-price">Monthly Price ($)</Label>
                        <Input id="premium-price" type="number" defaultValue="49.99" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="premium-annual">Annual Price ($)</Label>
                        <Input id="premium-annual" type="number" defaultValue="41.99" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="premium-features">Features (one per line)</Label>
                      <Textarea 
                        id="premium-features" 
                        className="mt-1" 
                        rows={3}
                        defaultValue={`Unlimited menu items
Up to 30 tables
Advanced analytics
Priority email support
Custom QR code branding`}
                      />
                    </div>
                  </div>
                  
                  {/* Enterprise Plan */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">Enterprise Plan</h3>
                      <Switch id="enterprise-active" defaultChecked />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="enterprise-price">Monthly Price ($)</Label>
                        <Input id="enterprise-price" type="number" defaultValue="99.99" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="enterprise-annual">Annual Price ($)</Label>
                        <Input id="enterprise-annual" type="number" defaultValue="83.99" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="enterprise-features">Features (one per line)</Label>
                      <Textarea 
                        id="enterprise-features" 
                        className="mt-1" 
                        rows={3}
                        defaultValue={`Unlimited everything
24/7 phone support
Custom branding
API access
Dedicated account manager`}
                      />
                    </div>
                  </div>
                </div>
                
                <Button
                  className="mt-6 bg-brand hover:bg-red-700 text-white"
                >
                  Save Plan Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
