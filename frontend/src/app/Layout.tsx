import { useState, useEffect } from 'react';
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
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/mkamel30/Smart_Murabha/releases/latest');
        if (res.status === 200) {
          const data = await res.json();
          const remoteVersion = data.tag_name.replace('v', '');
          const currentVersion = __APP_VERSION__;
          
          const isNewer = (rStr: string, cStr: string) => {
            const r = rStr.replace('v', '').split('.').map(Number);
            const c = cStr.replace('v', '').split('.').map(Number);
            for (let i = 0; i < Math.max(r.length, c.length); i++) {
              if ((r[i] || 0) > (c[i] || 0)) return true;
              if ((r[i] || 0) < (c[i] || 0)) return false;
            }
            return false;
          };

          if (isNewer(remoteVersion, currentVersion)) {
            setHasUpdate(true);
            setLatestVersion(data.tag_name);
          }
        }
      } catch (err) {
        console.log('Failed to check for updates:', err);
      }
    };

    checkUpdates();
    const interval = setInterval(checkUpdates, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
        {hasUpdate && (
          <div 
            onClick={async () => {
              if (window.electronAPI?.checkForUpdates) {
                await window.electronAPI.checkForUpdates();
              } else {
                alert(`📢 تحديث جديد متاح: ${latestVersion}\n\nيرجى إعادة تحميل صفحة الويب للحصول على آخر التحديثات.`);
                window.location.reload();
              }
            }}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-center py-2.5 text-xs font-bold cursor-pointer hover:from-amber-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 animate-pulse shadow-md select-none"
            title="اضغط لتثبيت التحديث"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span>📢 تحديث جديد متاح الآن من التطبيق ({latestVersion})! اضغط هنا لتنزيل وتثبيت التحديث فوراً تلقائياً وبأمان دون فقد أي بيانات.</span>
          </div>
        )}
        
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