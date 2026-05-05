import { useState, useRef, useEffect } from 'react';
import { backupApi, adminApi, branchApi } from '@/api/client';
import { PageHeader, PrimaryButton } from '@/lib/Actions';
import { useToast } from '@/lib/toast';
import { Settings, Download, Upload, RefreshCw, Trash2, Lock, ShieldCheck, Building2, FileJson } from 'lucide-react';

interface BackupFile {
  name: string;
  size: number;
  created: string;
}

export default function SettingsPage() {
  const { showToast } = useToast();
  const [autoBackup, setAutoBackup] = useState(() => {
    const saved = localStorage.getItem('autoBackup');
    return saved === 'true';
  });
  const [loading, setLoading] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [networkUrl, setNetworkUrl] = useState<string>('');
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [branchName, setBranchName] = useState('');
  const [savedBranchName, setSavedBranchName] = useState('');
  const [branchLoading, setBranchLoading] = useState(false);
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());

  const loadNetworkUrl = async () => {
    if (window.electronAPI?.getNetworkURL) {
      const url = await window.electronAPI.getNetworkURL();
      setNetworkUrl(url);
    }
  };

  const loadBackupFiles = async () => {
    try {
      const data = await backupApi.list();
      setBackupFiles(data.files || []);
    } catch (err) {
      console.error('Failed to load backup files:', err);
    }
  };

  const loadBranchConfig = async () => {
    try {
      const config = await branchApi.getConfig();
      setBranchName(config.branchName || '');
      setSavedBranchName(config.branchName || '');
    } catch (err) {
      console.error('Failed to load branch config:', err);
    }
  };

  const handleSaveBranchName = async () => {
    if (!branchName.trim()) {
      showToast('يرجى إدخال اسم الفرع', 'error');
      return;
    }
    setBranchLoading(true);
    try {
      await branchApi.setConfig(branchName.trim());
      setSavedBranchName(branchName.trim());
      showToast('تم حفظ اسم الفرع بنجاح', 'success');
    } catch (err) {
      showToast('فشل حفظ اسم الفرع', 'error');
    } finally {
      setBranchLoading(false);
    }
  };

  const handleExportMonthly = async () => {
    if (!savedBranchName) {
      showToast('يجب إدخال اسم الفرع أولاً في الإعدادات', 'error');
      return;
    }
    setBranchLoading(true);
    try {
      const response = await branchApi.exportMonthly(exportMonth, exportYear);
      const disposition = response.headers['content-disposition'];
      let filename = `تقرير-${savedBranchName}-${exportMonth}-${exportYear}.json`;
      if (disposition) {
        const match = disposition.match(/filename\*=UTF-8''(.+)/);
        if (match) filename = decodeURIComponent(match[1]);
      }
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('تم تصدير التقرير بنجاح', 'success');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'فشل تصدير التقرير';
      showToast(msg, 'error');
    } finally {
      setBranchLoading(false);
    }
  };

  useEffect(() => {
    loadBackupFiles();
    loadNetworkUrl();
    loadBranchConfig();
  }, []);

  useEffect(() => {
    localStorage.setItem('autoBackup', String(autoBackup));
  }, [autoBackup]);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const data = await backupApi.export();
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `murabha-backup-${new Date().toISOString().split('T')[0]}.db`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('تم تحميل النسخة الاحتياطية', 'success');
    } catch (err) {
      console.error('Backup failed:', err);
      showToast('فشل تحميل النسخة الاحتياطية', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await backupApi.import(file);
      showToast('تم استعادة النسخة الاحتياطية بنجاح، يرجى إعادة تحميل الصفحة', 'success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error('Restore failed:', err);
      showToast('فشل استعادة النسخة الاحتياطية', 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAutoBackup = async () => {
    setLoading(true);
    try {
      await backupApi.auto();
      showToast('تم إنشاء النسخ الاحتياطي التلقائي', 'success');
      loadBackupFiles();
    } catch (err) {
      console.error('Auto backup failed:', err);
      showToast('فشل إنشاء النسخ الاحتياطي التلقائي', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!mfaCode) {
      showToast('يرجى إدخال رمز التحقق', 'error');
      return;
    }

    setLoading(true);
    try {
      await adminApi.resetDatabase(mfaCode);
      showToast('تم تصفير قاعدة البيانات بنجاح', 'success');
      setShowMfaModal(false);
      setMfaCode('');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error('Reset failed:', err);
      showToast(err.response?.data?.error || 'فشل تصفير قاعدة البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };



  const handleCheckUpdates = async () => {
    if (window.electronAPI?.checkForUpdates) {
      setLoading(true);
      try {
        await window.electronAPI.checkForUpdates();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <PageHeader title="الإعدادات" />

      {/* System Update */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <RefreshCw className="w-5 h-5 text-[#0A2472]" />
          <h2 className="text-lg font-semibold">تحديث النظام</h2>
        </div>
        <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-800 font-medium">التحقق من وجود إصدارات جديدة</p>
            <p className="text-xs text-emerald-600 mt-1">تأكد من الاتصال بالإنترنت لتلقي آخر التحسينات.</p>
          </div>
          <PrimaryButton onClick={handleCheckUpdates} disabled={loading}>
            <RefreshCw size={16} className={`ml-2 ${loading ? 'animate-spin' : ''}`} />
            فحص الآن
          </PrimaryButton>
        </div>
      </div>

      {/* Branch Identity */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-5 h-5 text-[#0A2472]" />
          <h2 className="text-lg font-semibold">هوية الفرع</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <label className="block text-sm font-medium text-slate-700 mb-2">اسم الفرع</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="مثال: فرع المنصورة"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-[#0A2472] focus:outline-none"
              />
              <PrimaryButton onClick={handleSaveBranchName} disabled={branchLoading || branchName === savedBranchName}>
                {branchLoading ? 'جاري الحفظ...' : 'حفظ'}
              </PrimaryButton>
            </div>
            {savedBranchName && (
              <p className="text-xs text-emerald-600 mt-2">✅ الاسم المسجل: {savedBranchName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Export for HQ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileJson className="w-5 h-5 text-[#0A2472]" />
          <h2 className="text-lg font-semibold">تصدير تقرير شهري للإدارة المالية</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-800 mb-4">
              يتم تصدير ملف JSON يحتوي على إجماليات وتفصيليات الأقساط والمدفوعات والمتأخرات لإرساله للإدارة المالية.
            </p>
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-xs text-slate-500 mb-1">السنة</label>
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">الشهر</label>
                <select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {[
                    { v: 1, n: 'يناير' }, { v: 2, n: 'فبراير' }, { v: 3, n: 'مارس' },
                    { v: 4, n: 'أبريل' }, { v: 5, n: 'مايو' }, { v: 6, n: 'يونيو' },
                    { v: 7, n: 'يوليو' }, { v: 8, n: 'أغسطس' }, { v: 9, n: 'سبتمبر' },
                    { v: 10, n: 'أكتوبر' }, { v: 11, n: 'نوفمبر' }, { v: 12, n: 'ديسمبر' }
                  ].map(m => (
                    <option key={m.v} value={m.v}>{m.n}</option>
                  ))}
                </select>
              </div>
              <PrimaryButton onClick={handleExportMonthly} disabled={branchLoading || !savedBranchName}>
                <Download size={16} className="ml-2" />
                تصدير التقرير
              </PrimaryButton>
            </div>
            {!savedBranchName && (
              <p className="text-xs text-amber-600 mt-3">⚠️ يجب إدخال اسم الفرع أولاً لتتمكن من التصدير</p>
            )}
          </div>
        </div>
      </div>

      {/* Backup Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-[#0A2472]" />
          <h2 className="text-lg font-semibold">النسخ الاحتياطي</h2>
        </div>

        <div className="space-y-4">
          {/* Manual Backup */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <h3 className="font-medium">النسخ الاحتياطي اليدوي</h3>
              <p className="text-sm text-slate-500">تحميل نسخة من قاعدة البيانات</p>
            </div>
            <PrimaryButton onClick={handleBackup} disabled={loading}>
              <Download size={16} className="ml-2" />
              تحميل
            </PrimaryButton>
          </div>

          {/* Auto Backup Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <h3 className="font-medium">النسخ الاحتياطي التلقائي</h3>
              <p className="text-sm text-slate-500">تفعيل النسخ التلقائي (يدوي)</p>
            </div>
            <button
              onClick={() => setAutoBackup(!autoBackup)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoBackup ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoBackup ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Create Auto Backup Now */}
          {autoBackup && (
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <h3 className="font-medium">إنشاء نسخ تلقائي الآن</h3>
                <p className="text-sm text-slate-500">إنشاء نسخة في مجلد النسخ التلقائي</p>
              </div>
              <PrimaryButton onClick={handleAutoBackup} disabled={loading}>
                <RefreshCw size={16} className="ml-2" />
                إنشاء
              </PrimaryButton>
            </div>
          )}

          {/* Restore */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <h3 className="font-medium">استعادة نسخة</h3>
              <p className="text-sm text-slate-500">رفع نسخة احتياطية سابقة</p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db"
                onChange={handleRestore}
                className="hidden"
                id="restore-input"
              />
              <label htmlFor="restore-input" className="cursor-pointer">
                <span className="inline-flex items-center justify-center font-bold rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 px-3 py-1.5 text-xs bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-400 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Upload size={16} className="ml-2" />
                  رفع
                </span>
              </label>
            </div>
          </div>

          {/* Auto Backup Files List */}
          {autoBackup && backupFiles.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">النسخ التلقائية ({backupFiles.length})</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {backupFiles.slice(0, 5).map((file) => (
                  <div key={file.name} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">{file.name}</span>
                    <span className="text-slate-400 text-xs">
                      {new Date(file.created).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Network Access */}
      {networkUrl && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="w-5 h-5 text-[#0A2472]" />
            <h2 className="text-lg font-semibold">الوصول عبر الشبكة</h2>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">
              يمكن للأجهزة الأخرى على نفس الشبكة الوصول إلى التطبيق عبر الرابط التالي:
            </p>
            <div className="bg-white p-3 rounded border border-blue-200 text-center font-mono font-bold text-blue-700 text-lg">
              {networkUrl}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              * تأكد من أن الأجهزة متصلة بنفس شبكة Wi-Fi
            </p>
          </div>
        </div>
      )}

      {/* Admin Security */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-[#0A2472]" />
          <h2 className="text-lg font-semibold">الأمان والإدارة</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-900">حماية الخبير (MFA)</h3>
                <p className="text-sm text-amber-700 mt-1">
                  العمليات الحساسة مثل تصفير قاعدة البيانات محمية بكلمة مرور متغيرة من هاتف المسؤول.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 ring-1 ring-red-50">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-semibold text-red-600">منطقة الخطر</h2>
        </div>
        <div className="p-4 border border-red-100 rounded-lg bg-red-50/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-red-900">تصفير قاعدة البيانات</h3>
              <p className="text-sm text-red-600">حذف جميع المبيعات والعملاء والمدفوعات نهائياً.</p>
            </div>
            <button
              onClick={() => setShowMfaModal(true)}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold text-sm disabled:opacity-50"
            >
              تصفير الآن
            </button>
          </div>
        </div>
      </div>

      {/* MFA Modal */}
      {showMfaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-[#0A2472]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">تأكيد رمز الأمان</h3>
              <p className="text-sm text-slate-500 mb-6">
                يرجى إدخال الرمز المكون من 6 أرقام من تطبيق Google Authenticator الخاص بك.
              </p>
              
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-3xl font-bold tracking-[1em] focus:border-[#0A2472] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleResetDatabase}
                  disabled={loading || mfaCode.length < 6}
                  className="flex-1 py-3 bg-[#0A2472] text-white rounded-xl font-bold hover:bg-blue-900 transition-colors disabled:opacity-50"
                >
                  {loading ? 'جاري التحقق...' : 'تأكيد التصفير'}
                </button>
                <button
                  onClick={() => {
                    setShowMfaModal(false);
                    setMfaCode('');
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}