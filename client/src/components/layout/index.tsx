import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileMenu } from "./mobile-menu";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  requireAuth?: boolean;
  allowedRoles?: string[];
}

export function Layout({ 
  children, 
  title, 
  description, 
  requireAuth = true,
  allowedRoles = []
}: LayoutProps) {
  const [location, navigate] = useLocation();
  const { user, loading } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  
  useEffect(() => {
    // Authentication and authorization logic
    if (loading) return;
    
    if (requireAuth && !user) {
      navigate("/login");
    } else if (user && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      if (user.role === 'platform_admin') {
        navigate("/admin");
      } else if (user.role === 'restaurant') {
        navigate("/dashboard");
      }
    }
    setAuthChecked(true);
  }, [loading, user, requireAuth, allowedRoles, navigate]);

  // Show loading state
  if (loading || !authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#ffffff]">
        <div className="animate-spin w-8 h-8 border-4 border-[#ba1d1d] border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  // Don't render the protected content if auth check failed
  if ((requireAuth && !user) || 
      (user && allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return null;
  }

  // Extract the last segment of the path for active tab highlighting
  const activeTab = location.split("/").filter(Boolean).pop() || "dashboard";

  // Main layout
  return (
    <div className="flex h-screen overflow-hidden bg-[#ffffff]">
      {/* Sidebar (desktop only) */}
      <Sidebar active={activeTab} />

      {/* Mobile Menu */}
      <MobileMenu active={activeTab} />

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Main Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto bg-[#ffffff] p-4 md:p-6">
          {/* Page header */}
          {(title || description) && (
            <div className="mb-8">
              {title && <h2 className="text-2xl font-bold text-[#373643]">{title}</h2>}
              {description && <p className="mt-2 text-sm text-[#373643]/80">{description}</p>}
            </div>
          )}
          
          {/* Page content */}
          {children}
        </main>
      </div>
    </div>
  );
}
