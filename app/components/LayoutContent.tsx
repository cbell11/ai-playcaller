"use client";

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";

export function LayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');
  const [dashboardLogoUrl, setDashboardLogoUrl] = useState("https://res.cloudinary.com/dfvzvbygc/image/upload/v1756918320/logo_landscape_yszdv3.png");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showMobileNotification, setShowMobileNotification] = useState(false);

  // Check for custom dashboard logo URL on mount
  useEffect(() => {
    const customDashboardLogoUrl = localStorage.getItem('dashboardLogoUrl');
    if (customDashboardLogoUrl) {
      setDashboardLogoUrl(customDashboardLogoUrl);
    }
  }, []);

  // Show mobile notification after a few seconds if on mobile
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      if (isMobile && !isAuthPage) {
        const timer = setTimeout(() => {
          setShowMobileNotification(true);
        }, 3000); // Show after 3 seconds

        return () => clearTimeout(timer);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isAuthPage]);

  // Close mobile menu when clicking outside or on nav item
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      const target = e.target as HTMLElement;
      if (isMobileMenuOpen && !target.closest('.mobile-nav-menu') && !target.closest('.mobile-menu-button')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMobileMenuOpen]);

  if (isAuthPage) {
    return children;
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-[200px]" style={{ backgroundColor: '#0b2545' }}>
        <div className="h-14 flex items-center px-4 border-r border-gray-200" style={{ backgroundColor: '#ffffff' }}>
          <img 
            src={dashboardLogoUrl} 
            alt="AI Playcaller" 
            className="h-12 w-auto"
          />
        </div>
        <NavLinks />
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />
          
          {/* Sidebar */}
          <div className="mobile-nav-menu fixed inset-y-0 left-0 w-[280px] bg-white shadow-lg transform transition-transform">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200" style={{ backgroundColor: '#ffffff' }}>
              <img 
                src={dashboardLogoUrl} 
                alt="AI Playcaller" 
                className="h-10 w-auto"
              />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div style={{ backgroundColor: '#0b2545' }} className="flex-1">
              <NavLinks onMobileItemClick={() => setIsMobileMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <div className="h-14 flex items-center justify-between px-4 md:px-6 bg-white border-b border-gray-200">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="mobile-menu-button md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Mobile Logo (shown when sidebar is closed) */}
          <div className="md:hidden flex-1 flex justify-center">
            <img 
              src={dashboardLogoUrl} 
              alt="AI Playcaller" 
              className="h-8 w-auto"
            />
          </div>

          {/* User Menu */}
          <div className="flex items-center">
            <UserMenu />
          </div>
        </div>

        {/* Mobile Notification */}
        {showMobileNotification && (
          <div className="md:hidden bg-blue-50 border-l-4 border-blue-400 p-4 relative">
            <div className="flex items-start">
              <div className="flex-1">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Better on Desktop:</strong> AI Playcaller works best on desktop computers for the full coaching experience.
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowMobileNotification(false)}
                className="ml-4 flex-shrink-0 text-blue-400 hover:text-blue-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4">
          {children}
        </main>
      </div>
    </div>
  );
} 