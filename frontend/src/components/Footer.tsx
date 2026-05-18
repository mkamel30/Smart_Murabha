import { useEffect, useState, useCallback } from 'react';
import { healthApi } from '@/api/client';
import { useToast } from '@/lib/toast';
import { Globe, ExternalLink } from 'lucide-react';

interface HealthStatus {
  status: 'ok' | 'error';
  db: 'connected' | 'disconnected';
  timestamp: string;
}

interface FooterProps {
  autoBackup?: boolean;
  onBackupClick?: () => void;
}

function isNewerVersion(remote: string, current: string): boolean {
  const r = remote.replace('v', '').split('.').map(Number);
  const c = current.replace('v', '').split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    if ((r[i] || 0) > (c[i] || 0)) return true;
    if ((r[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

export function Footer({ autoBackup = false, onBackupClick }: FooterProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [networkURL, setNetworkURL] = useState<string>('');
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [latestVersion, setLatestVersion] = useState<string>('');
  const { showToast } = useToast();

  const checkHealth = useCallback(async () => {
    try {
      const data = await healthApi.check();
      setHealth(data);
      const time = new Date(data.timestamp);
      setLastUpdate(time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setHealth({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    if (window.electronAPI?.getNetworkURL) {
      window.electronAPI.getNetworkURL().then(setNetworkURL).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (health?.db === 'disconnected') {
      showToast('انقطع الاتصال بالخادم', 'error');
    }
  }, [health?.db, showToast]);

  // Check for GitHub updates periodically
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/mkamel30/Smart_Murabha/releases/latest');
        if (res.status === 200) {
          const data = await res.json();
          const remoteVersion = data.tag_name.replace('v', '');
          const currentVersion = __APP_VERSION__;
          
          if (isNewerVersion(remoteVersion, currentVersion)) {
            setHasUpdate(true);
            setLatestVersion(data.tag_name);
          }
        }
      } catch (err) {
        console.log('Failed to check for updates in web browser context:', err);
      }
    };

    checkUpdates();
    // Check every 30 minutes
    const interval = setInterval(checkUpdates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = health?.db === 'connected';

  const handleOpenNetwork = () => {
    if (networkURL && window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(networkURL);
    }
  };

  const handleShowUpdateDetails = () => {
    alert(`📢 تحديث جديد متاح: ${latestVersion}\n\nيرجى الطلب من مسؤول الجهاز الرئيسي في الفرع إغلاق وإعادة فتح تطبيق سطح المكتب (Desktop App) ليقوم النظام بتثبيت التحديث وتحديث قاعدة البيانات تلقائياً دون فقد أي بيانات.`);
  };

  return (
    <footer className="h-8 bg-white border-t border-slate-200 flex items-center justify-between px-4 text-xs text-slate-500 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          <span>{isConnected ? 'متصل' : 'منقطع'}</span>
        </div>
        {lastUpdate && (
          <span className="text-slate-400">آخر تحديث: {lastUpdate}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {networkURL && (
          <button 
            onClick={handleOpenNetwork}
            className="flex items-center gap-1 hover:text-[#0A2472] transition-colors text-blue-600"
            title="فتح رابط الشبكة"
          >
            <Globe size={14} />
            <span>الشبكة</span>
            <ExternalLink size={12} />
          </button>
        )}
        {onBackupClick && (
          <button 
            onClick={onBackupClick}
            className="hover:text-[#0A2472] transition-colors flex items-center gap-1"
          >
            <span>Backup:</span>
            <span className={autoBackup ? 'text-emerald-600' : 'text-slate-400'}>
              {autoBackup ? 'تلقائي' : 'يدوي'}
            </span>
          </button>
        )}
        <div className="flex items-center gap-2">
          {hasUpdate && (
            <button 
              onClick={handleShowUpdateDetails}
              className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 transition-colors text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-200 cursor-pointer shadow-sm animate-bounce"
              title={`إصدار جديد متاح: ${latestVersion} - اضغط للتفاصيل`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
              <span>تحديث متاح</span>
            </button>
          )}
          <span className={`text-slate-300 transition-colors duration-300 ${hasUpdate ? 'text-amber-500 font-bold' : ''}`}>
            V.{__APP_VERSION__}
          </span>
        </div>
      </div>
    </footer>
  );
}
