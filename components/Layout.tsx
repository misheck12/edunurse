import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SIDEBAR_ITEMS } from '../constants';
import { Menu, LogOut, User } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-[#f6f7f8] font-sans text-slate-800">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0
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

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <Link to="/login" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors">
            <LogOut size={20} />
            <span>Sign Out</span>
          </Link>
          <Link to="/settings" className="mt-4 flex items-center gap-3 px-2 group cursor-pointer hover:bg-slate-50 rounded-lg p-2 transition-colors">
            <img
              src="https://picsum.photos/100/100"
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-blue-100 object-cover"
            />
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600">Sarah Jenkins</p>
              <p className="text-xs text-slate-500 truncate">Senior Nurse Tutor</p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
                 <span>EduNurse</span>
            </div>
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600">
                <Menu />
            </button>
        </div>

        <main className="flex-1 overflow-y-auto">
            {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;