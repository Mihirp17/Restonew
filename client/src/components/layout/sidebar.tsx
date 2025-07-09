import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { Link } from "wouter";
import { getInitials } from "@/lib/utils";
import { useLang } from "@/contexts/language-context";

interface SidebarProps {
  active: string;
}

export function Sidebar({ active }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useLang();

  // Menu items for restaurant admin
  const restaurantMenuItems = [
    { label: t("dashboard", "Dashboard"), href: "/dashboard", icon: "dashboard" },
    { label: t("menuManagement", "Menu Management"), href: "/menu-management", icon: "restaurant_menu" },
    { label: t("tables", "Tables"), href: "/tables", icon: "table_bar" },
    { label: t("orders", "Orders"), href: "/orders", icon: "receipt_long" },
    { label: t("analytics", "Analytics"), href: "/analytics", icon: "bar_chart" },
    { label: t("settings", "Settings"), href: "/settings", icon: "settings" },
  ];

  // Menu items for admin section
  const adminMenuItems = [
    { label: t("dashboard", "Dashboard"), href: "/admin", icon: "dashboard" },
    { label: t("restaurants", "Restaurants"), href: "/admin/restaurants", icon: "storefront" },
    { label: t("subscriptions", "Subscriptions"), href: "/admin/subscriptions", icon: "payments" },
    { label: t("settings", "Settings"), href: "/admin/settings", icon: "settings" },
  ];

  const menuItems = user?.role === 'platform_admin' ? adminMenuItems : restaurantMenuItems;

  const secondaryMenuItems = [
    { label: t("subscription", "Subscription"), href: "/subscription", icon: "credit_card" },
    { label: t("support", "Support"), href: "/support", icon: "support_agent" },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-[#373643]/10 bg-[#ffffff]">
      {/* Logo */}
      <div className="p-4 border-b border-[#373643]/10">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-[#ba1d1d]">Restomate</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              active === item.href
                ? "bg-[#ba1d1d]/10 text-[#ba1d1d]"
                : "text-[#373643] hover:bg-[#373643]/5"
            }`}
          >
            <span className="material-icons mr-3 text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Secondary Navigation */}
      <div className="p-4 border-t border-[#373643]/10">
        {secondaryMenuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              active === item.href
                ? "bg-[#ba1d1d]/10 text-[#ba1d1d]"
                : "text-[#373643] hover:bg-[#373643]/5"
            }`}
          >
            <span className="material-icons mr-3 text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-[#373643]/10">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-[#ba1d1d] flex items-center justify-center text-white">
            {user ? getInitials(user.name) : "U"}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-[#373643]">{user?.name || t("user", "User")}</p>
            <p className="text-xs text-[#373643]/60">{user?.role === 'platform_admin' ? t("admin", "Admin") : t("manager", "Manager")}</p>
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <LanguageSelector />
            <ThemeToggle />
            <button 
              onClick={() => logout()} 
              className="text-[#373643]/60 hover:text-[#373643] transition-colors"
            >
              <span className="material-icons">logout</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
