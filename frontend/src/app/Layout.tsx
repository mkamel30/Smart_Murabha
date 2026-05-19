import { useState } from 'react';
import logo from '@/assets/logo.png';
import { NavLink, Outlet } from 'react-router-dom';
import { ar } from '@/i18n/ar';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Calendar, 
  CreditCard, 
  UserCheck, 
  BarChart3,
  Menu,
  Settings,
  FileSpreadsheet,
  Activity
} from 'lucide-react';
import { Footer } from '@/components/Footer';



export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - auto width based on content */}
      <aside className={`
        fixed lg:relative top-0 right-0 z-50 h-full 
        bg-white border-r border-slate-200 shadow-lg
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        lg:w-auto min-w-[180px] max-w-[280px]
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-slate-100 px-4">
          <img src={logo} alt="Logo" className="h-10 w-auto" />
        </div>
        
        {/* Nav Items */}
        <nav className="p-3 space-y-6 overflow-y-auto h-[calc(100vh-120px)]">
          {/* Operations Group */}
          <div>
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">العمليات</p>
            <div className="space-y-1">
              {[
                { path: '/dashboard', label: ar.nav.dashboard, icon: LayoutDashboard },
                { path: '/customers', label: ar.nav.customers, icon: Users },
                { path: '/sales', label: ar.nav.sales, icon: ShoppingCart },
                { path: '/followups', label: ar.nav.followUps, icon: UserCheck },
              ].map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                    ${isActive 
                      ? 'bg-[#0A2472] text-white' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#0A2472]'
                    }
                  `}
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          {/* Finance Group */}
          <div>
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">المالية</p>
            <div className="space-y-1">
              {[
                { path: '/installments', label: ar.nav.installments, icon: Calendar },
                { path: '/payments', label: ar.nav.payments, icon: CreditCard },
                { path: '/reports', label: ar.nav.reports, icon: BarChart3 },
                { path: '/analytics', label: ar.nav.analytics, icon: Activity },
              ].map((item) => (
                <NavLink
                  key={item.path}
                   to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                    ${isActive 
                      ? 'bg-[#0A2472] text-white' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#0A2472]'
                    }
                  `}
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          {/* Management Group */}
          <div>
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">النظام</p>
            <div className="space-y-1">
              {[
                { path: '/import', label: ar.nav.import, icon: FileSpreadsheet },
                { path: '/settings', label: ar.nav.settings, icon: Settings },
              ].map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                    ${isActive 
                      ? 'bg-[#0A2472] text-white' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#0A2472]'
                    }
                  `}
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
        
      </aside>
      
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 right-4 z-30 p-2 bg-white rounded-lg shadow lg:hidden"
      >
        <Menu size={20} className="text-slate-600" />
      </button>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 shadow-sm">
          <div className="flex-1" />
        </header>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
        
        <Footer />
      </main>
    </div>
  );
}