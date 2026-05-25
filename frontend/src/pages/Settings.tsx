import { useState, useRef, useEffect } from 'react';
import { backupApi, adminApi, branchApi, exportApi } from '@/api/client';
import { PageHeader, PrimaryButton } from '@/lib/Actions';
import { useToast } from '@/lib/toast';
import { Settings, Download, Upload, RefreshCw, Trash2, Lock, ShieldCheck, Building2, FileSpreadsheet, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [activeHelpTab, setActiveHelpTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'system' | 'data' | 'guide'>('system');

  const toggleHelpTab = (tab: string) => {
    setActiveHelpTab(activeHelpTab === tab ? null : tab);
  };

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



  const handleFullExport = async () => {
    setLoading(true);
    try {
      const data = await exportApi.full();
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `murabha-full-export-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('تم تصدير البيانات الكاملة بنجاح', 'success');
    } catch (err) {
      console.error('Full export failed:', err);
      showToast('فشل تصدير البيانات', 'error');
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

      {/* Glassmorphic Tabs Switcher */}
      <div className="flex p-1.5 bg-slate-100/80 backdrop-blur-md rounded-2xl border border-slate-200/50 gap-2 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
            activeTab === 'system'
              ? 'bg-[#0A2472] text-white shadow-lg shadow-[#0A2472]/20 scale-[1.02]'
              : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>الفرع والنظام</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('data')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
            activeTab === 'data'
              ? 'bg-[#0A2472] text-white shadow-lg shadow-[#0A2472]/20 scale-[1.02]'
              : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>النسخ والبيانات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guide')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
            activeTab === 'guide'
              ? 'bg-[#0A2472] text-white shadow-lg shadow-[#0A2472]/20 scale-[1.02]'
              : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>دليل المساعدة</span>
        </button>
      </div>

      {/* Tab: System Update, Branch Identity, and Network Access */}
      {activeTab === 'system' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
        </div>
      )}

      {/* Tab: Backups & Data Section */}
      {activeTab === 'data' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Full Data Export */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="w-5 h-5 text-[#0A2472]" />
              <h2 className="text-lg font-semibold">تصدير البيانات الكاملة (Excel)</h2>
            </div>
            <div className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg">
              <div>
                <h3 className="font-medium text-emerald-900">تصدير كل البيانات</h3>
                <p className="text-sm text-emerald-700 mt-1">
                  ملف Excel يطابق تمبليت الاستيراد + تفاصيل إضافية (الحالة، المتبقي، المتأخرات)
                </p>
              </div>
              <PrimaryButton onClick={handleFullExport} disabled={loading}>
                <Download size={16} className="ml-2" />
                تصدير Excel
              </PrimaryButton>
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
                  type="button"
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
                  type="button"
                  onClick={() => setShowMfaModal(true)}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold text-sm disabled:opacity-50"
                >
                  تصفير الآن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Help Center */}
      {activeTab === 'guide' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Help Guide & Instructions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-5 h-5 text-[#0A2472]" />
              <h2 className="text-lg font-semibold text-slate-800">دليل المساعدة واستخدام البرنامج</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              أهلاً بك في دليل المساعدة السريع لبرنامج **المرابحة الذكية**. يوضح هذا الدليل بالخطوات والرسومات التوضيحية البسيطة كيفية إنجاز العمليات اليومية الأساسية بكفاءة وسرعة.
            </p>

            <div className="space-y-4">
              {/* Card 1: Add Sale */}
              <div className="border border-slate-100 rounded-xl overflow-hidden transition-all shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleHelpTab('addSale')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 transition-colors text-right cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0A2472] flex items-center justify-center font-bold">
                      ١
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">تسجيل عملية بيع جديدة</h3>
                      <p className="text-xs text-slate-500 mt-0.5">كيفية فتح عقد جديد وتحديد الأقساط والمقدم</p>
                    </div>
                  </div>
                  {activeHelpTab === 'addSale' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {activeHelpTab === 'addSale' && (
                  <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-in fade-in duration-200">
                    <div className="flex gap-4 flex-wrap md:flex-nowrap items-center justify-between">
                      {/* Step Indicators */}
                      <div className="flex-1 space-y-4 pr-2">
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-[#0A2472] text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">1</div>
                          <p className="text-sm text-slate-600 font-semibold">اختر العميل من القائمة (أو أضف عميلاً جديداً أولاً بضغطة زر).</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-[#0A2472] text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">2</div>
                          <p className="text-sm text-slate-600 font-semibold">أدخل رقم الماكينة (السيريال) وتاريخ العقد والبيع.</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-[#0A2472] text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">3</div>
                          <p className="text-sm text-slate-600 font-semibold">اكتب القيمة الإجمالية للعقد، وقيمة الدفعة الأولى المستلمة فعلياً (المقدم).</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-[#0A2472] text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">4</div>
                          <p className="text-sm text-slate-600 font-semibold">حدد عدد أشهر التقسيط، وسيقوم النظام بحساب القسط الشهري تلقائياً.</p>
                        </div>
                      </div>

                      {/* Minimal Diagram */}
                      <div className="w-full md:w-56 p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-col justify-center text-center">
                        <span className="text-xs font-black text-blue-700 tracking-wider mb-2 uppercase">مخطط دورة العقد</span>
                        <div className="space-y-1.5 text-xs">
                          <div className="p-1.5 bg-white rounded border border-blue-200 font-bold text-slate-700">بيانات العميل والماكينة</div>
                          <div className="text-blue-400 font-bold">⬇️</div>
                          <div className="p-1.5 bg-white rounded border border-blue-200 font-bold text-slate-700">تحديد المقدم والمتبقي</div>
                          <div className="text-blue-400 font-bold">⬇️</div>
                          <div className="p-1.5 bg-emerald-600 text-white rounded font-bold shadow-sm">إنشاء العقد وجدول الأقساط</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Pay Single */}
              <div className="border border-slate-100 rounded-xl overflow-hidden transition-all shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleHelpTab('paySingle')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 transition-colors text-right cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      ٢
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">تحصيل قسط منفرد</h3>
                      <p className="text-xs text-slate-500 mt-0.5">خطوات سداد قسط محدد لعميل نشط</p>
                    </div>
                  </div>
                  {activeHelpTab === 'paySingle' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {activeHelpTab === 'paySingle' && (
                  <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-in fade-in duration-200">
                    <div className="flex gap-4 flex-wrap md:flex-nowrap items-center justify-between">
                      <div className="flex-1 space-y-4 pr-2">
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">1</div>
                          <p className="text-sm text-slate-600 font-semibold">اذهب لصفحة الأقساط وابحث بكود أو اسم العميل أو السيريال.</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">2</div>
                          <p className="text-sm text-slate-600 font-semibold">اضغط على زر "تحصيل" الأخضر المقابل للقسط المطلوب سداده.</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">3</div>
                          <p className="text-sm text-slate-600 font-semibold">في النافذة المنبثقة، حدد مكان الدفع (ضامن، البريد، البنك).</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">4</div>
                          <p className="text-sm text-slate-600 font-semibold">أدخل رقم الإيصال وتاريخ الدفع الفعلي ثم أكد الدفع.</p>
                        </div>
                      </div>

                      <div className="w-full md:w-56 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col justify-center text-center">
                        <span className="text-xs font-black text-emerald-700 tracking-wider mb-2 uppercase">مخطط التحصيل المنفرد</span>
                        <div className="space-y-1.5 text-xs">
                          <div className="p-1.5 bg-white rounded border border-emerald-200 font-bold text-slate-700">قسط مستحق (غير مدفوع)</div>
                          <div className="text-emerald-400 font-bold">⬇️</div>
                          <div className="p-1.5 bg-white rounded border border-emerald-200 font-bold text-slate-700">إدخال الإيصال ومكان الدفع</div>
                          <div className="text-emerald-400 font-bold">⬇️</div>
                          <div className="p-1.5 bg-teal-600 text-white rounded font-bold shadow-sm">حفظ السداد وتحديث العقد</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Pay Multiple */}
              <div className="border border-slate-100 rounded-xl overflow-hidden transition-all shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleHelpTab('payMultiple')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 transition-colors text-right cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                      ٣
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">تحصيل مجموعة أقساط معاً</h3>
                      <p className="text-xs text-slate-500 mt-0.5">آلية الدمج وتوزيع المبالغ المدفوعة مسبقاً</p>
                    </div>
                  </div>
                  {activeHelpTab === 'payMultiple' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {activeHelpTab === 'payMultiple' && (
                  <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-in fade-in duration-200">
                    <div className="flex gap-4 flex-wrap md:flex-nowrap items-center justify-between">
                      <div className="flex-1 space-y-4 pr-2">
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">1</div>
                          <p className="text-sm text-slate-600 font-semibold">اذهب لصفحة العميل أو تفاصيل العقد لمشاهدة الجدول.</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">2</div>
                          <p className="text-sm text-slate-600 font-semibold">تسجيل دفعة تفوق قيمة قسط واحد، يقوم النظام تلقائياً بتوزيع المبلغ بطريقة FIFO (التحصيل التلقائي للأقدم أولاً).</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">3</div>
                          <p className="text-sm text-slate-600 font-semibold">أو حدد أقساطاً معينة يدوياً من قائمة الاختيار المتعدد وتطبيق السداد عليها لتصدر في إيصال واحد مجمع.</p>
                        </div>
                      </div>

                      <div className="w-full md:w-56 p-4 bg-purple-50/50 rounded-xl border border-purple-100 flex flex-col justify-center text-center">
                        <span className="text-xs font-black text-purple-700 tracking-wider mb-2 uppercase">مخطط سداد مجمع (FIFO)</span>
                        <div className="space-y-1 bg-white p-2 rounded border border-purple-200 text-[10px]">
                          <div className="flex justify-between font-bold text-slate-700"><span>المبلغ المجمع</span> <span className="text-purple-600">٢٠٠٠ج</span></div>
                          <div className="w-full h-px bg-slate-100 my-1"></div>
                          <div className="text-right text-slate-500">
                            <p className="text-emerald-600">✔️ قسط ١: ١٠٠٠ج (مغلق)</p>
                            <p className="text-emerald-600">✔️ قسط ٢: ١٠٠٠ج (مغلق)</p>
                            <p className="text-slate-400">⏳ قسط ٣: ١٠٠٠ج (مستحق)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 4: Excel Correction */}
              <div className="border border-slate-100 rounded-xl overflow-hidden transition-all shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleHelpTab('excelCorrection')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 transition-colors text-right cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      ٤
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">التصحيح الجماعي للأقساط بملف إكسيل</h3>
                      <p className="text-xs text-slate-500 mt-0.5">آلية التحديث الجماعي السريع للإيصالات والتواريخ</p>
                    </div>
                  </div>
                  {activeHelpTab === 'excelCorrection' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {activeHelpTab === 'excelCorrection' && (
                  <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-in fade-in duration-200">
                    <div className="flex gap-4 flex-wrap md:flex-nowrap items-center justify-between">
                      <div className="flex-1 space-y-4 pr-2">
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">1</div>
                          <p className="text-sm text-slate-600 font-semibold">من صفحة الأقساط، اضغط على زر **"تصدير للتصحيح (Excel)"** لتنزيل الملف الحالي.</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">2</div>
                          <p className="text-sm text-slate-600 font-semibold">افتح الملف على جهازك وحدث أرقام الإيصالات، أو التواريخ، أو حالة الدفع (نعم / لا).</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">!</div>
                          <p className="text-sm text-red-600 font-bold">تنبيه هام جداً: لا تعدل أبداً محتوى عمود "معرف القسط (Installment ID)" لتتم مطابقة البيانات بشكل سليم.</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm">3</div>
                          <p className="text-sm text-slate-600 font-semibold">احفظ الملف، ثم اذهب لصفحة الأقساط واضغط **"رفع ملف الأقساط المصححة"** للتطبيق الفوري بلحظة واحدة.</p>
                        </div>
                      </div>

                      <div className="w-full md:w-56 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col justify-center text-center">
                        <span className="text-xs font-black text-indigo-700 tracking-wider mb-2 uppercase">مخطط التحديث الجماعي</span>
                        <div className="space-y-1 text-xs">
                          <div className="p-1 bg-white rounded border border-indigo-200 font-bold text-slate-700">تصدير الأقساط الحالية</div>
                          <div className="text-indigo-400 font-bold">⬇️</div>
                          <div className="p-1 bg-white rounded border border-indigo-200 font-bold text-slate-700">تعديل الإيصالات والتواريخ</div>
                          <div className="text-indigo-400 font-bold">⬇️</div>
                          <div className="p-1 bg-indigo-600 text-white rounded font-bold shadow-sm">الرفع والمطابقة السريعة بالـ ID</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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