import React, { useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  BrainCircuit,
  CreditCard,
  Database,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../src/context/AuthContext";
import { logoutCurrentSession } from "../src/services/backendApi";

interface OpsLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: "/ops/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/ops/syllabus", label: "Syllabus", icon: BookOpen },
  { to: "/ops/users", label: "Users", icon: Users },
  { to: "/ops/connectors", label: "Connectors", icon: Database },
  { to: "/ops/services", label: "Services", icon: SlidersHorizontal },
  { to: "/ops/plans", label: "Plans", icon: Package },
  { to: "/ops/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/ops/transactions", label: "Transactions", icon: ReceiptText },
  { to: "/ops/ai", label: "AI Health", icon: BrainCircuit },
  { to: "/ops/settings", label: "Settings", icon: Settings },
];

const OpsLayout: React.FC<OpsLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, refreshUser } = useAuth();

  // Allow login page to render without auth check
  const isLoginPage = location.pathname === "/ops/login";

  // Redirect to login if not authenticated or not an admin (but not on login page)
  useEffect(() => {
    if (!isLoginPage && !isLoading && (!user || user.role !== "admin")) {
      // Session expired or user not authorized
      navigate("/ops/login", { 
        replace: true,
        state: { message: user ? "Access denied. Admin role required." : "Session expired. Please sign in again." }
      });
    }
  }, [user, isLoading, navigate, isLoginPage]);

  // Render login page without layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f2f4f7] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render layout until auth check is complete
  if (!user || user.role !== "admin") {
    return null;
  }

  const handleSignOut = () => {
    logoutCurrentSession();
    void refreshUser();
    navigate("/ops/login");
  };

  return (
    <div className="min-h-screen bg-[#f2f4f7] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 sm:py-0 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-blue-600 p-1.5 text-white">
              <ShieldCheck size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">EduNurse Ops</p>
              <p className="text-[11px] text-slate-500 leading-tight">
                Superadmin Console
              </p>
            </div>
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Link
              to="/"
              className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:px-3"
            >
              Open Client Studio
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:px-3"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
        {user && (
          <div className="border-t border-slate-100 bg-slate-50">
            <div className="mx-auto w-full px-4 py-2 text-xs text-slate-600 sm:px-6 lg:px-8">
              {user.fullName ?? user.email} ({user.role})
            </div>
          </div>
        )}
      </header>
      <div className="mx-auto flex w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-64 shrink-0 md:block">
          <nav className="space-y-1 rounded-xl border border-slate-200 bg-white p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 md:pl-6">
          <div className="mb-4 flex gap-2 overflow-auto md:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium ${
                    isActive
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
};

export default OpsLayout;
