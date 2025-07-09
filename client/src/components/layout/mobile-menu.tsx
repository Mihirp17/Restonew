import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface MobileMenuProps {
  active: string;
}

export function MobileMenu({ active }: MobileMenuProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Menu items for restaurant admin
  const restaurantMenuItems = [
    { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
    { label: "Menu Management", href: "/menu-management", icon: "restaurant_menu" },
    { label: "Tables", href: "/tables", icon: "table_bar" },
    { label: "Orders", href: "/orders", icon: "receipt_long" },
    { label: "Analytics", href: "/analytics", icon: "bar_chart" },
    { label: "Settings", href: "/settings", icon: "settings" },
  ];

  // Menu items for admin section
  const adminMenuItems = [
    { label: "Dashboard", href: "/admin", icon: "dashboard" },
    { label: "Restaurants", href: "/admin/restaurants", icon: "storefront" },
    { label: "Subscriptions", href: "/admin/subscriptions", icon: "payments" },
    { label: "Settings", href: "/admin/settings", icon: "settings" },
  ];

  const menuItems = user?.role === 'platform_admin' ? adminMenuItems : restaurantMenuItems;

  return (
    <>
      {/* Top Header for Mobile */}
      <header className="bg-white dark:bg-gray-800 shadow-sm md:hidden">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-blue-600">Restomate</h1>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <button 
              className="text-gray-500 dark:text-gray-400"
              onClick={() => setIsOpen(true)}
            >
              <span className="material-icons">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu (hidden by default) */}
      <div className={`fixed inset-0 z-40 md:hidden ${isOpen ? '' : 'hidden'}`}>
        <div 
          className="absolute inset-0 bg-gray-600 opacity-75" 
          onClick={() => setIsOpen(false)}
        ></div>
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800 transform transition ease-in-out duration-300">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button 
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setIsOpen(false)}
            >
              <span className="material-icons text-white">close</span>
            </button>
          </div>
          <div className="px-4 pt-5 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <h2 className="text-xl font-bold text-blue-600">Restomate</h2>
            </div>
          </div>
          <div className="mt-5 flex-1 h-0 overflow-y-auto">
            <nav className="px-2 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    active === item.href
                      ? "bg-brand text-white"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="material-icons mr-3 text-sm">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              
              {user?.role === 'restaurant' && (
                <>
                  <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Your Restaurant</p>
                    </div>
                  </div>
                  <Link
                    href="/subscription"
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      active === "/subscription"
                        ? "bg-brand text-white"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="material-icons mr-3 text-sm">credit_card</span>
                    Subscription
                  </Link>
                  <Link
                    href="/support"
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      active === "/support"
                        ? "bg-brand text-white"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="material-icons mr-3 text-sm">support_agent</span>
                    Support
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button 
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md"
            >
              <span className="material-icons mr-3 text-sm">logout</span>
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
