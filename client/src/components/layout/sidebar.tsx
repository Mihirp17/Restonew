import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import LanguageSelector from "@/components/ui/language-selector";
import { Link } from "wouter";
import { getInitials } from "@/lib/utils";
import { useLang } from "@/contexts/language-context";

interface SidebarProps {
  active: string;
}

export function Sidebar({ active }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useLang();

  // Main navigation (no Settings here)
  const restaurantMenuItems = [
    { label: t("dashboard", "Dashboard"), href: "/dashboard", icon: "dashboard" },
    { label: t("orders", "Orders"), href: "/orders", icon: "receipt_long" },
    { label: t("tables", "Tables"), href: "/tables", icon: "table_bar" },
    { label: t("menu", "Menu"), href: "/menu-management", icon: "restaurant_menu" },
    { label: t("analytics", "Analytics"), href: "/analytics", icon: "bar_chart" },
  ];

  // Menu items for admin section
  const adminMenuItems = [
    { label: t("dashboard", "Dashboard"), href: "/admin", icon: "dashboard" },
    { label: t("restaurants", "Restaurants"), href: "/admin/restaurants", icon: "storefront" },
    { label: t("subscriptions", "Subscriptions"), href: "/admin/subscriptions", icon: "payments" },
    { label: t("settings", "Settings"), href: "/admin/settings", icon: "settings" },
  ];

  const menuItems = user?.role === 'platform_admin' ? adminMenuItems : restaurantMenuItems;

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-white border-r border-[#373643]/10 shadow-sm rounded-r-2xl">
      <div className="flex-1 flex flex-col p-2">
        {/* Logo */}
        <div className="p-4 border-b border-[#373643]/10">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-[#ba1d1d]">Restomate</span>
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            // Compare active to the last segment of the item's href
            const itemKey = item.href.split("/").filter(Boolean).pop();
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active === itemKey
                    ? "bg-[#ba1d1d]/10 text-[#ba1d1d]"
                    : "text-[#373643] hover:bg-[#373643]/5"
                }`}
              >
                <span className="material-icons mr-3 text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Settings and Support at the bottom */}
        <div className="mt-auto px-4 py-2 flex flex-col gap-1">
          <Link
            href="/settings"
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              active === "settings"
                ? "bg-[#ba1d1d]/10 text-[#ba1d1d]"
                : "text-[#373643] hover:bg-[#373643]/5"
            }`}
          >
            <span className="material-icons mr-3 text-lg">settings</span>
            <span>{t("settings", "Settings")}</span>
          </Link>
          <Link
            href="/support"
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              active === "support"
                ? "bg-[#ba1d1d]/10 text-[#ba1d1d]"
                : "text-[#373643] hover:bg-[#373643]/5"
            }`}
          >
            <span className="material-icons mr-3 text-lg">support_agent</span>
            <span>{t("support", "Support")}</span>
          </Link>
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
      </div>
    </aside>
  );
}
