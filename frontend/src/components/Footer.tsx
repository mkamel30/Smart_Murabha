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



export function Footer({ autoBackup = false, onBackupClick }: FooterProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [networkURL, setNetworkURL] = useState<string>('');
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

  const isConnected = health?.db === 'connected';

  const handleOpenNetwork = () => {
    if (networkURL && window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(networkURL);
    }
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
        <span className="text-slate-300">{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'V.1.2.3'}</span>
      </div>
    </footer>
  );
}
