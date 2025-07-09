import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import { getStatusColor, getInitials, slugify } from "@/lib/utils";

// Form schema for restaurant
const restaurantSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  logo: z.string().optional(),
  isActive: z.boolean().default(true)
});

export default function AdminRestaurants() {
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [restaurantToDelete, setRestaurantToDelete] = useState<any>(null);
  const [editingRestaurant, setEditingRestaurant] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const form = useForm<z.infer<typeof restaurantSchema>>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      description: "",
      address: "",
      phone: "",
      logo: "",
      isActive: true
    }
  });

  useEffect(() => {
    // Reset form when editing restaurant changes
    if (editingRestaurant) {
      form.reset({
        name: editingRestaurant.name,
        email: editingRestaurant.email,
        description: editingRestaurant.description || "",
        address: editingRestaurant.address || "",
        phone: editingRestaurant.phone || "",
        logo: editingRestaurant.logo || "",
        isActive: editingRestaurant.isActive
      });
    } else {
      form.reset({
        name: "",
        email: "",
        password: "",
        description: "",
        address: "",
        phone: "",
        logo: "",
        isActive: true
      });
    }
  }, [editingRestaurant, form]);

  // Fetch restaurants
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

  const handleAddNew = () => {
    setEditingRestaurant(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (restaurant: any) => {
    setEditingRestaurant(restaurant);
    setIsDialogOpen(true);
  };

  const handleDelete = async (restaurant: any) => {
    setRestaurantToDelete(restaurant);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!restaurantToDelete) return;

    try {
      const response = await apiRequest("DELETE", `/api/restaurants/${restaurantToDelete.id}`, {});
      
      if (response.ok) {
        toast({
          title: "Restaurant deleted",
          description: "The restaurant has been successfully deleted."
        });
        
        // Remove the restaurant from the list
        setRestaurants(restaurants.filter(r => r.id !== restaurantToDelete.id));
      }
    } catch (error) {
      console.error("Error deleting restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to delete restaurant",
        variant: "destructive"
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setRestaurantToDelete(null);
    }
  };

  const onSubmit = async (data: z.infer<typeof restaurantSchema>) => {
    try {
      if (editingRestaurant) {
        // Update existing restaurant
        const response = await apiRequest("PUT", `/api/restaurants/${editingRestaurant.id}`, {
          ...data
        });
        
        if (response.ok) {
          toast({
            title: "Restaurant updated",
            description: "The restaurant has been successfully updated."
          });
          
          // Update the restaurant in the list
          setRestaurants(restaurants.map(r => 
            r.id === editingRestaurant.id ? { ...r, ...data } : r
          ));
        }
      } else {
        // Create new restaurant
        const slug = slugify(data.name);
        
        const response = await apiRequest("POST", "/api/restaurants", {
          ...data,
          slug
        });
        
        if (response.ok) {
          const newRestaurant = await response.json();
          toast({
            title: "Restaurant created",
            description: "The new restaurant has been successfully added."
          });
          
          // Add the new restaurant to the list
          setRestaurants([newRestaurant, ...restaurants]);
        }
      }
      
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to save restaurant",
        variant: "destructive"
      });
    }
  };

  // Filter restaurants based on search term
  const filteredRestaurants = restaurants.filter(restaurant => 
    restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    restaurant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout
      title="Restaurant Management"
      description="Manage restaurants on the platform"
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
          <Button 
            onClick={handleAddNew}
            className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white font-semibold shadow-md transition-all duration-200"
          >
            <span className="material-icons mr-2 text-sm">add</span>
            Add Restaurant
          </Button>
        </div>

        {/* Restaurants Table */}
        <Card>
          <CardHeader>
            <CardTitle>Restaurants</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Loading restaurants...</p>
              </div>
            ) : filteredRestaurants.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Restaurant</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subscription</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRestaurants.map((restaurant) => {
                      // Get subscription status
                      const hasSubscription = !!restaurant.subscription;
                      const subscriptionStatus = hasSubscription ? restaurant.subscription.status : "none";
                      const statusColors = getStatusColor(subscriptionStatus);
                      
                      return (
                        <tr key={restaurant.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
                                {getInitials(restaurant.name)}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{restaurant.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{restaurant.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {restaurant.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${restaurant.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                              {restaurant.isActive ? 'Active' : 'Inactive'}
                            </span>
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
                            {formatDate(restaurant.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button 
                              variant="ghost" 
                              className="text-brand hover:text-red-800 dark:hover:text-red-400 mr-2"
                              onClick={() => handleEdit(restaurant)}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 mr-2"
                              onClick={() => handleDelete(restaurant)}
                            >
                              Delete
                            </Button>
                            <Button variant="ghost" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                              View
                            </Button>
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
                <Button 
                  onClick={handleAddNew}
                  variant="outline"
                  className="mt-4 border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5"
                >
                  Add your first restaurant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restaurant Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">{editingRestaurant ? "Edit Restaurant" : "Add Restaurant"}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Restaurant Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. John's Bistro" className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="e.g. contact@restaurant.com" className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {!editingRestaurant && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Enter password" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe the restaurant..."
                        value={field.value || ""}
                        className="min-h-[80px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. (123) 456-7890" value={field.value || ""} className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="logo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Logo URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." value={field.value || ""} className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Address</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Full address..."
                        rows={2}
                        value={field.value || ""}
                        className="min-h-[60px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Active</FormLabel>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Restaurant will be accessible to customers
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter className="gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5 h-9"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white font-semibold shadow-md h-9 transition-all duration-200"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Saving...
                    </span>
                  ) : (
                    editingRestaurant ? "Update Restaurant" : "Add Restaurant"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Delete Restaurant</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 dark:text-gray-400">
              Are you sure you want to delete {restaurantToDelete?.name}? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setRestaurantToDelete(null);
              }}
              className="border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white transition-all duration-200"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
