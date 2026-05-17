import { useState } from 'react';
import { importApi } from '@/api/client';
import { PageHeader, PrimaryButton, SecondaryButton } from '@/lib/Actions';
import { useToast } from '@/lib/toast';
import { Upload, FileSpreadsheet, Download, CheckCircle, XCircle } from 'lucide-react';

interface ImportResult {
  customersCreated: number;
  customersFound: number;
  salesCreated: number;
  installmentsCreated: number;
  errors: string[];
}

export default function ImportPage() {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [dateWarnings, setDateWarnings] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.name.endsWith('.xlsx')) {
      setFile(selected);
      setResult(null);
      setPreviewRows(null);
      setDateWarnings([]);
    } else {
      showToast('يرجى اختيار ملف Excel (.xlsx)', 'error');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await importApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast('فشل تحميل النموذج', 'error');
    }
  };

  const handlePreview = async () => {
    if (!file) {
      showToast('يرجى اختيار ملف أولاً', 'error');
      return;
    }

    setLoading(true);
    try {
      const data = await importApi.preview(file);
      setPreviewRows(data.previewRows);
      setDateWarnings(data.dateWarnings);
      if (data.dateWarnings?.length > 0) {
        showToast('يوجد تحذيرات في التواريخ، يرجى المراجعة', 'error');
      } else {
        showToast('تمت المعاينة بنجاح، يمكنك الآن الاستيراد', 'success');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast(error.response?.data?.error || 'فشل المعاينة', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      showToast('يرجى اختيار ملف أولاً', 'error');
      return;
    }

    setLoading(true);
    try {
      const data = await importApi.uploadExcel(file);
      setResult(data.results);
      showToast('تم الاستيراد بنجاح', 'success');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast(error.response?.data?.error || 'فشل الاستيراد', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="استيراد بيانات قديمة" />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-[#0A2472]" />
          <h2 className="text-lg font-semibold">رفع ملف Excel</h2>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          قم برفع ملف Excel يحتوي على بيانات المبيعات والأقساط القديمة. سيقوم النظام بإنشاء العملاء والمبيعات والأقساط تلقائياً.
        </p>

        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center mb-4">
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="hidden"
            id="import-input"
          />
          <label htmlFor="import-input" className="cursor-pointer">
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-10 h-10 text-slate-400" />
              <span className="text-slate-600">
                {file ? file.name : 'اختر ملف Excel'}
              </span>
              <span className="text-xs text-slate-400">يجب أن يكون الملف بصيغة .xlsx</span>
            </div>
          </label>
        </div>

        <div className="flex justify-between gap-2 mb-4">
          <SecondaryButton onClick={handleDownloadTemplate}>
            <Download size={16} className="ml-2" />
            تحميل النموذج
          </SecondaryButton>
          {!previewRows ? (
            <PrimaryButton onClick={handlePreview} disabled={loading || !file}>
              {loading ? 'جاري المعاينة...' : 'معاينة التواريخ'}
            </PrimaryButton>
          ) : (
            <div className="flex gap-2">
              <SecondaryButton onClick={() => setPreviewRows(null)}>
                إلغاء المعاينة
              </SecondaryButton>
              <PrimaryButton onClick={handleImport} disabled={loading}>
                {loading ? 'جاري الاستيراد...' : 'تأكيد واستيراد'}
              </PrimaryButton>
            </div>
          )}
        </div>

        {previewRows && !result && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg animate-in fade-in zoom-in-95">
            <h3 className="font-bold mb-3 text-slate-800">معاينة التواريخ لأول 10 صفوف:</h3>
            
            {dateWarnings.length > 0 && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                <div className="font-bold flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4" />
                  تحذيرات التواريخ:
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {dateWarnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-right">السطر</th>
                    <th className="px-3 py-2 text-right">تاريخ البيع (الأصلي)</th>
                    <th className="px-3 py-2 text-right">تاريخ البيع (بعد التحويل)</th>
                    <th className="px-3 py-2 text-right">آخر دفعة (الأصلي)</th>
                    <th className="px-3 py-2 text-right">آخر دفعة (بعد التحويل)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 border-t border-slate-200">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-white">
                      <td className="px-3 py-2 font-mono text-slate-500">{row.rowNum}</td>
                      <td className="px-3 py-2">{row.saleDateOriginal}</td>
                      <td className={`px-3 py-2 ${!row.saleDateParsed && row.saleDateOriginal ? 'text-red-500 font-bold' : 'text-green-600'}`}>
                        {row.saleDateParsed ? new Date(row.saleDateParsed).toLocaleDateString('ar-EG') : 'خطأ'}
                      </td>
                      <td className="px-3 py-2">{row.lastDateOriginal || '-'}</td>
                      <td className={`px-3 py-2 ${!row.lastDateParsed && row.lastDateOriginal ? 'text-red-500 font-bold' : 'text-slate-600'}`}>
                        {row.lastDateParsed ? new Date(row.lastDateParsed).toLocaleDateString('ar-EG') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 text-xs text-slate-500 bg-blue-50 p-3 rounded flex gap-2">
              <span className="font-bold">ملاحظة:</span>
              يرجى التأكد من صحة التواريخ في المعاينة. إذا وجدت أخطاء، قم بتعديل ملف Excel وأعد رفعه.
            </div>
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-bold mb-2">نتائج الاستيراد:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                {result.customersCreated > 0 ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400" />
                )}
                <span>عملاء جدد: {result.customersCreated}</span>
              </div>
              <div className="flex items-center gap-2">
                {result.customersFound > 0 ? (
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400" />
                )}
                <span>عملاء موجودون: {result.customersFound}</span>
              </div>
              <div className="flex items-center gap-2">
                {result.salesCreated > 0 ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400" />
                )}
                <span>بيعات جديدة: {result.salesCreated}</span>
              </div>
              <div className="flex items-center gap-2">
                {result.installmentsCreated > 0 ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400" />
                )}
                <span>أقساط: {result.installmentsCreated}</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-600">
                <span className="font-bold">الأخطاء:</span>
                <ul className="list-disc list-inside mt-1">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>+ {result.errors.length - 5} أخطاء أخرى</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold mb-4">هيكل الملف المتوقع</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-right">العمود</th>
                <th className="px-3 py-2 text-right">الحقل في التطبيق</th>
                <th className="px-3 py-2 text-right">مطلوب؟</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="px-3 py-2">كود العميل</td><td className="px-3 py-2">bkCode</td><td className="px-3 py-2 text-red-500">نعم</td></tr>
              <tr><td className="px-3 py-2">نوع العميل</td><td className="px-3 py-2">customerType</td><td className="px-3 py-2 text-slate-400">اختياري (أمثلة: مخبز، تموين، عام)</td></tr>
              <tr><td className="px-3 py-2">اسم العميل</td><td className="px-3 py-2">name</td><td className="px-3 py-2 text-red-500">نعم</td></tr>
              <tr><td className="px-3 py-2">السيريال</td><td className="px-3 py-2">machineSerial</td><td className="px-3 py-2 text-red-500">نعم</td></tr>
              <tr><td className="px-3 py-2">تاريخ البيع القديم</td><td className="px-3 py-2">saleDate</td><td className="px-3 py-2 text-red-500">نعم</td></tr>
              <tr><td className="px-3 py-2">إجمالي قيمة العقد</td><td className="px-3 py-2">totalPrice</td><td className="px-3 py-2 text-red-500">نعم</td></tr>
              <tr><td className="px-3 py-2">إجمالي الأقساط المحصلة</td><td className="px-3 py-2">paidAmount</td><td className="px-3 py-2 text-red-500">نعم</td></tr>
              <tr><td className="px-3 py-2">المقدم (التعاقدي)</td><td className="px-3 py-2">downPayment</td><td className="px-3 py-2 text-red-500">نعم</td></tr>
              <tr><td className="px-3 py-2">عدد الأقساط</td><td className="px-3 py-2">months</td><td className="px-3 py-2 text-red-500">نعم</td></tr>
              <tr><td className="px-3 py-2">قيمة القسط الشهري</td><td className="px-3 py-2">monthly installment</td><td className="px-3 py-2 text-red-500">نعم</td></tr>
              <tr><td className="px-3 py-2">تاريخ آخر دفعة</td><td className="px-3 py-2">last payment date</td><td className="px-3 py-2 text-slate-400">اختياري</td></tr>
              <tr><td className="px-3 py-2">ملاحظات</td><td className="px-3 py-2">notes</td><td className="px-3 py-2 text-slate-400">اختياري</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}