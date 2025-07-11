import { apiRequest } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price: string;
  category: string;
  image?: string;
  isAvailable: boolean;
  restaurantId: number;
  createdAt: string;
  updatedAt: string;
}

export function useMenu(restaurantId: number) {
  const queryClient = useQueryClient();
  
  const { data: menuItems, isLoading, error } = useQuery<MenuItem[]>({
    queryKey: [`/api/restaurants/${restaurantId}/menu`],
    queryFn: async () => {
      try {
        const result = await apiRequest({
          method: 'GET',
          url: `/api/restaurants/${restaurantId}/menu-items`
        });
        return result;
      } catch (error) {
        throw error;
      }
    },
    enabled: !!restaurantId && restaurantId > 0
  });
  
  // Create menu item mutation
  const createMenuItemMutation = useMutation({
    mutationFn: async (menuItemData: Omit<MenuItem, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>) => {
      return apiRequest({
        method: 'POST',
        url: `/api/restaurants/${restaurantId}/menu-items`,
        data: menuItemData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/menu`]
      });
    }
  });
  
  // Update menu item mutation
  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ menuItemId, data }: { menuItemId: number; data: Partial<MenuItem> }) => {
      return apiRequest({
        method: 'PUT',
        url: `/api/restaurants/${restaurantId}/menu-items/${menuItemId}`,
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/menu`]
      });
    }
  });
  
  // Delete menu item mutation
  const deleteMenuItemMutation = useMutation({
    mutationFn: async (menuItemId: number) => {
      return apiRequest({
        method: 'DELETE',
        url: `/api/restaurants/${restaurantId}/menu-items/${menuItemId}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/restaurants/${restaurantId}/menu`]
      });
    }
  });
  
  // Get menu items by category
  const getMenuItemsByCategory = (category: string) => {
    return menuItems?.filter(item => item.category === category) || [];
  };
  
  // Get all unique categories
  const getCategories = () => {
    if (!menuItems) return [];
    return Array.from(new Set(menuItems.map(item => item.category)));
  };
  
  return {
    menuItems: menuItems || [],
    isLoading,
    error,
    createMenuItem: createMenuItemMutation.mutate,
    updateMenuItem: updateMenuItemMutation.mutate,
    deleteMenuItem: deleteMenuItemMutation.mutate,
    isCreating: createMenuItemMutation.isPending,
    isUpdating: updateMenuItemMutation.isPending,
    isDeleting: deleteMenuItemMutation.isPending,
    getMenuItemsByCategory,
    getCategories
  };
}

export function useMenuItem(restaurantId: number, menuItemId: number) {
  const { menuItems, isLoading } = useMenu(restaurantId);
  
  return {
    menuItem: menuItems.find(item => item.id === menuItemId),
    isLoading
  };
}
