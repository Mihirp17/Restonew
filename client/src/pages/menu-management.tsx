import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useMenu } from "@/hooks/use-menu";
import { useLang } from "@/contexts/language-context";
import { MenuItemCard } from "@/components/menu/menu-item-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

// Form schema for menu item
const menuItemSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  description: z.string().optional(),
  price: z.string().refine((val) => !isNaN(parseFloat(val)), { message: "Price must be a number" }),
  category: z.string().min(1, { message: "Category is required" }),
  image: z.string().optional(),
  isAvailable: z.boolean().default(true)
});

const DEFAULT_CATEGORIES = [
  "menuManagement.categories.tapas",
  "menuManagement.categories.salads",
  "menuManagement.categories.soups",
  "menuManagement.categories.sandwichesAndBurgers",
  "menuManagement.categories.entres",
  "menuManagement.categories.pastaAndPizza",
  "menuManagement.categories.beers",
  "menuManagement.categories.drinks",
  "menuManagement.categories.alcoholicDrinks"
];

export default function MenuManagement() {
  const { user } = useAuth();
  const { t } = useLang();
  const restaurantId = user?.restaurantId;
  const { menuItems, getCategories, isLoading, createMenuItem, updateMenuItem, deleteMenuItem } = useMenu(restaurantId || 0);
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  const form = useForm<z.infer<typeof menuItemSchema>>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      category: "",
      image: "",
      isAvailable: true
    }
  });

  // Reset form when editing item changes
  useEffect(() => {
    if (editingItem) {
      form.reset({
        name: editingItem.name,
        description: editingItem.description || "",
        price: editingItem.price.toString(),
        category: editingItem.category,
        image: editingItem.image || "",
        isAvailable: editingItem.isAvailable
      });
    } else {
      form.reset({
        name: "",
        description: "",
        price: "",
        category: "",
        image: "",
        isAvailable: true
      });
    }
  }, [editingItem, form]);

  const handleAddNewItem = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await deleteMenuItem(itemId);
      toast({
        title: t('menuManagement.toast.deleted.title'),
        description: t('menuManagement.toast.deleted.description')
      });
    } catch (error) {
      toast({
        title: t('menuManagement.toast.deleteFailed.title'),
        description: t('menuManagement.toast.deleteFailed.description'),
        variant: "destructive"
      });
    }
  };

  const onSubmit = async (data: z.infer<typeof menuItemSchema>) => {
    try {
      if (editingItem) {
        // Update existing item
        await updateMenuItem({
          menuItemId: editingItem.id,
          data: {
            ...data,
            price: data.price
          }
        });
        toast({
          title: t('menuManagement.toast.updated.title'),
          description: t('menuManagement.toast.updated.description')
        });
      } else {
        // Create new item
        await createMenuItem({
          ...data,
          price: data.price,
          description: data.description ?? undefined,
          image: data.image || undefined
        });
        toast({
          title: t('menuManagement.toast.created.title'),
          description: t('menuManagement.toast.created.description')
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: t('menuManagement.toast.saveFailed.title'),
        description: t('menuManagement.toast.saveFailed.description'),
        variant: "destructive"
      });
    }
  };

  // Filter menu items based on active category and search term
  const filteredItems = menuItems?.filter(item => {
    const matchesCategory = activeCategory === "all" || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = getCategories();

  // Early return if no restaurantId
  if (!restaurantId) {
    return (
      <Layout
        title={t("menuManagement", "Menu Management")}
        description={t('menuManagement.description')}
        requireAuth
        allowedRoles={['restaurant']}
      >
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">{t('menuManagement.loading')}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={t("menuManagement", "Menu Management")}
      description={t('menuManagement.description')}
      requireAuth
      allowedRoles={['restaurant']}
    >
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative">
            <Input
              placeholder={t('menuManagement.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 material-icons">search</span>
          </div>
          {/* Change Add Menu Item button to always be visible and use a standard color */}
          <Button 
            onClick={handleAddNewItem}
            className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white font-semibold shadow-md transition-all duration-200"
          >
            <span className="material-icons mr-2 text-sm">add</span>
            {t("addMenuItem", "Add Menu Item")}
          </Button>
        </div>

        {/* Categories Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="flex overflow-x-auto pb-px mb-4 space-x-2">
            <TabsTrigger value="all" className="px-4 py-2 whitespace-nowrap">
              {t('menuManagement.tabs.all')}
            </TabsTrigger>
            {categories.map(category => (
              <TabsTrigger 
                key={category}
                value={category}
                className="px-4 py-2 whitespace-nowrap"
              >
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Menu Items Grid */}
          <TabsContent value={activeCategory} className="mt-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-gray-500 dark:text-gray-400">{t('menuManagement.grid.loading')}</p>
              </div>
            ) : filteredItems && filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map(item => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onEdit={() => handleEditItem(item)}
                    onDelete={() => handleDeleteItem(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">{t('menuManagement.grid.noItems')}</p>
                <Button 
                  onClick={handleAddNewItem}
                  variant="outline"
                  className="mt-4"
                >
                  {t('menuManagement.grid.addFirstItem')}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Menu Item Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? t('menuManagement.dialog.editTitle') : t('menuManagement.dialog.addTitle')}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('nameLabel')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('menuManagement.dialog.namePlaceholder')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('descriptionLabel')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('menuManagement.dialog.descriptionPlaceholder')}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('priceLabel')}</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" min="0" placeholder={t('menuManagement.dialog.pricePlaceholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* In the category dropdown, always show all default categories */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('categoryLabel')}</FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectCategory')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEFAULT_CATEGORIES.map(category => (
                            <SelectItem key={category} value={t(category)}>
                              {t(category)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('imageUrlLabel')}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="https://example.com/image.jpg"
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isAvailable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t('availableLabel')}</FormLabel>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('availableDescription')}
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
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5"
                >
                  {t('cancel')}
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white transition-all duration-200"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      {t('menuManagement.dialog.saving')}
                    </span>
                  ) : (
                    editingItem ? t('updateItem') : t('addItem')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
