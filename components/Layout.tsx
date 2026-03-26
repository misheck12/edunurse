import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SIDEBAR_ITEMS } from '../constants';
import { ArrowUpRight, Menu, LogOut, Crown } from 'lucide-react';
import { useAuth } from '../src/context/AuthContext';
import { logoutCurrentSession } from '../src/services/backendApi';
import { UsageBadge } from '../src/components/UsageLimits';
import { PaymentModal } from '../src/components/PaymentModal';
import { useFeatureAccess, FEATURE_CONFIG } from '../src/components/FeatureGate';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/signin" ||
    location.pathname === "/signup";
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { user, refreshUser } = useAuth();
  
  // Feature access - safely handle when provider not available
  let canAccessFeature: (feature: string) => boolean = () => true;
  let subscriptionLoading = false;
  try {
    const featureAccess = useFeatureAccess();
    canAccessFeature = featureAccess.canAccessFeature;
    subscriptionLoading = featureAccess.subscription.isLoading;
  } catch {
    // FeatureAccessProvider not available, allow all access
  }

  const handleSignOut = () => {
    logoutCurrentSession();
    void refreshUser();
  };

  if (isAuthPage) {
    return <>{children}</>;
  }

  const visibleSidebarItems = SIDEBAR_ITEMS.filter((item) => !item.comingSoon);
  const mobilePrimaryPaths = ['/', '/create', '/library', '/assignment-support', '/curriculum', '/settings'] as const;
  const mobileNavLabels: Record<string, string> = {
    '/': 'Studio',
    '/create': 'Create',
    '/library': 'Library',
    '/assignment-support': 'Assignments',
    '/curriculum': 'Curriculum',
    '/settings': 'Settings',
  };
  const mobileNavItems = mobilePrimaryPaths
    .map((path) => visibleSidebarItems.find((item) => item.path === path))
    .filter((item): item is (typeof visibleSidebarItems)[number] => Boolean(item));

  return (
    <div className="flex min-h-[100dvh] bg-[#f6f7f8] font-sans text-slate-800">
      {/* Sidebar - Fixed on all screen sizes */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out
        md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <div className="bg-blue-600 text-white p-1 rounded">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <span>EduNurse</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {visibleSidebarItems.map((item, index) => {
            // Handle section headers
            if (item.name === 'section') {
              if (!item.label) {
                return <div key={`section-${index}`} className="my-3 border-t border-slate-200" />;
              }
              return (
                <div key={`section-${index}`} className="pt-4 pb-2 px-3 first:pt-0">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{item.label}</span>
                </div>
              );
            }
            
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path!));
            const isLocked = item.feature && !subscriptionLoading && !canAccessFeature(item.feature);
            const featureConfig = item.feature ? FEATURE_CONFIG[item.feature] : null;
            
            return (
              <Link
                key={item.name}
                to={item.path!}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : isLocked
                    ? 'text-slate-400 hover:bg-slate-50'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={18} />
                <span className="flex-1">{item.name}</span>
                {isLocked && featureConfig && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      featureConfig.minPlan === "premium"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    <Crown className="w-2.5 h-2.5" />
                    {featureConfig.minPlan === "premium" ? "Premium" : "Pro"}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Usage Badge in Sidebar */}
          <div className="pt-4 px-3">
            <UsageBadge onClick={() => setShowPaymentModal(true)} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="mb-3 flex w-full items-center justify-between rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <span>Upgrade Plan</span>
            <ArrowUpRight size={16} />
          </button>
          <Link to="/signin" onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors">
            <LogOut size={20} />
            <span>Sign Out</span>
          </Link>
          <Link to="/profile" className="mt-4 flex items-center gap-3 px-2 group cursor-pointer hover:bg-slate-50 rounded-lg p-2 transition-colors">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-blue-100 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-blue-600">
                    {(user?.fullName || "U")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600">
                {user?.fullName ?? "Educator"}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user?.role === "admin" ? "Superadmin" : user?.school || "View Profile"}
              </p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setShowPaymentModal(false);
          // Refresh the page to update usage limits
          window.location.reload();
        }}
      />

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content - Add left margin for fixed sidebar on desktop */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden md:ml-64">
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
                 <span>EduNurse</span>
            </div>
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600">
                <Menu />
            </button>
        </div>

        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-20 md:pb-0">
            {children}
        </main>

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, mobileNavItems.length)}, minmax(0, 1fr))`,
            }}
          >
            {mobileNavItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={`mobile-${item.path}`}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-blue-600' : 'text-slate-500'
                  }`}
                >
                  <item.icon size={18} />
                  <span className="truncate">{mobileNavLabels[item.path] ?? item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
