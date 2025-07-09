import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Pencil, Trash2, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";

interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price: string;
  image?: string;
  category: string;
  isAvailable: boolean;
}

interface MenuItemCardProps {
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
}

export function MenuItemCard({ item, onEdit, onDelete }: MenuItemCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Get category icon
  const getCategoryIcon = (category: string): string => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('starter') || lowerCategory.includes('appetizer')) return 'restaurant_menu';
    if (lowerCategory.includes('burger')) return 'lunch_dining';
    if (lowerCategory.includes('pizza')) return 'local_pizza';
    if (lowerCategory.includes('pasta') || lowerCategory.includes('noodle')) return 'ramen_dining';
    if (lowerCategory.includes('dessert')) return 'icecream';
    if (lowerCategory.includes('drink') || lowerCategory.includes('beverage')) return 'local_bar';
    return 'restaurant';
  };

  const handleDelete = () => {
    onDelete();
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center relative">
          {item.image ? (
            <img 
              src={item.image} 
              alt={item.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="material-icons text-6xl text-gray-400">{getCategoryIcon(item.category)}</span>
          )}
          
          {!item.isAvailable && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <Badge variant="destructive" className="text-sm px-3 py-1">
                Not Available
              </Badge>
            </div>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="absolute top-2 right-2 bg-gray-800 bg-opacity-50 text-white hover:bg-gray-800 hover:bg-opacity-70"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <CardContent className="pt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-lg">{item.name}</h3>
            <Badge variant={item.isAvailable ? "outline" : "secondary"}>
              {item.category}
            </Badge>
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 min-h-[4.5rem]">
            {item.description || "No description available."}
          </p>
          
          <div className="mt-2 font-semibold text-lg text-brand">
            {formatCurrency(parseFloat(item.price))}
          </div>
        </CardContent>
        
        <CardFooter className="justify-between border-t pt-4">
          <Badge variant={item.isAvailable ? "success" : "destructive"}>
            {item.isAvailable ? "Available" : "Unavailable"}
          </Badge>
          <Button 
            variant="ghost" 
            onClick={onEdit}
            className="text-brand hover:text-red-700 hover:bg-red-50 dark:hover:bg-gray-800"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </CardFooter>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Menu Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{item.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
