import { useEffect, useState, useMemo } from 'react';
import { installmentsApi, salesApi } from '@/api/client';
import { formatCurrency, formatDate, isOverdue, isDueToday } from '@/lib/utils';
import type { Installment } from '@/types';
import { ar } from '@/i18n/ar';
import { LoadingScreen } from '@/lib/Spinner';
import { PrimaryButton, SecondaryButton, PageHeader, EmptyState } from '@/lib/Actions';
import { PaymentPlaceSelect } from '@/lib/PaymentPlace';
import { Modal } from '@/lib/Modal';
import { useToast } from '@/lib/toast';
import { SearchFilterBar } from '@/lib/SearchFilterBar';

type StatusFilter = '' | 'unpaid' | 'overdue' | 'dueToday' | 'paid';

export default function Installments() {
  const { showToast } = useToast();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [overdue, setOverdue] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'overdue'>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [groupBy, setGroupBy] = useState<'none' | 'customer' | 'month'>('none');

  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInst, setSelectedInst] = useState<Installment | null>(null);
  const [quickPaymentPlace, setQuickPaymentPlace] = useState('dhamen');
  const [quickReceiptNumber, setQuickReceiptNumber] = useState('');
  const [quickPaidAt, setQuickPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportUpdateExcel = async () => {
    try {
      setExportingExcel(true);
      const data = await installmentsApi.exportUpdateTemplate();
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `تحديث-الأقساط-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('تم تصدير ملف الأقساط للتعديل بنجاح', 'success');
    } catch (err) {
      console.error('Failed to export template:', err);
      showToast('فشل تصدير ملف الأقساط', 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleImportUpdateExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value to allow uploading the same file again
    e.target.value = '';

    try {
      setLoading(true);
      const response = await installmentsApi.importUpdate(file);
      showToast(response.message || 'تم تحديث الأقساط بنجاح!', 'success');
      loadData();
    } catch (err: any) {
      console.error('Failed to import Excel:', err);
      const errorMsg = err.response?.data?.error || err.message || 'فشلت معالجة وتحديث ملف الأقساط';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [allData, overdueData] = await Promise.all([
        installmentsApi.getAll(),
        installmentsApi.getOverdue(),
      ]);
      setInstallments(allData);
      setOverdue(overdueData);
    } catch (err) {
      console.error('Failed to load installments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayClick = (inst: Installment) => {
    setSelectedInst(inst);
    setShowPayModal(true);
  };

  const handleQuickPay = async () => {
    if (!selectedInst) return;
    try {
      await salesApi.pay(selectedInst.saleId, {
        saleId: selectedInst.saleId,
        amount: Number(selectedInst.amount) - Number(selectedInst.paidAmount),
        paymentType: 'INSTALLMENT',
        paymentPlace: quickPaymentPlace,
        notes: '',
        installmentIds: [selectedInst.id],
        receiptNumber: quickReceiptNumber,
        paidAt: quickPaidAt
      });
      showToast(ar.common.success, 'success');
      setShowPayModal(false);
      setQuickPaymentPlace('dhamen');
      setQuickReceiptNumber('');
      setQuickPaidAt(new Date().toISOString().split('T')[0]);
      setSelectedInst(null);
      loadData();
    } catch (err: unknown) {
      showToast(ar.common.error, 'error');
    }
  };

  const filteredData = useMemo(() => {
    let data = tab === 'overdue' ? overdue : installments;

    if (search) {
      const q = search.toLowerCase();
      data = data.filter((inst) =>
        inst.sale?.customer?.name?.toLowerCase().includes(q) ||
        inst.sale?.customer?.bkCode?.toLowerCase().includes(q) ||
        inst.sale?.receiptNumber?.toLowerCase().includes(q) ||
        inst.sale?.machineSerial?.toLowerCase().includes(q) ||
        String(inst.installmentNo).includes(q)
      );
    }

    if (statusFilter) {
      data = data.filter((inst) => {
        switch (statusFilter) {
          case 'unpaid': return !inst.isPaid;
          case 'overdue': return !inst.isPaid && isOverdue(inst.dueDate);
          case 'dueToday': return !inst.isPaid && isDueToday(inst.dueDate);
          case 'paid': return inst.isPaid;
          default: return true;
        }
      });
    }

    return data.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tab, installments, overdue, search, statusFilter]);

  const stats = useMemo(() => {
    const unpaid = filteredData.filter(i => !i.isPaid);
    const overdueItems = unpaid.filter(i => isOverdue(i.dueDate));
    const totalOverdue = overdueItems.reduce((sum, i) => sum + (Number(i.amount) - Number(i.paidAmount)), 0);
    const uniqueCustomers = new Set(filteredData.map(i => i.sale?.customerId).filter(Boolean)).size;
    return {
      overdueAmount: Math.round(totalOverdue),
      customerCount: uniqueCustomers,
      installmentCount: filteredData.length,
      unpaidCount: unpaid.length
    };
  }, [filteredData]);

  if (loading) {
    return <LoadingScreen message={ar.common.loading} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={ar.installments.title} />

      <div className="flex justify-between items-center flex-wrap gap-2 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'all' 
                ? 'bg-[#0A2472] text-white shadow-sm' 
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#0A2472]'
            }`}
          >
            {ar.installments.title} ({installments.length})
          </button>
          <button
            onClick={() => setTab('overdue')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'overdue' 
                ? 'bg-red-600 text-white shadow-sm' 
                : 'bg-white text-gray-600 border border-gray-200 hover:border-red-400'
            }`}
          >
            {ar.installments.overdue} ({overdue.length})
          </button>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          {/* Excel Export Button */}
          <button
            onClick={handleExportUpdateExcel}
            disabled={exportingExcel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:bg-emerald-400 shadow-sm cursor-pointer"
          >
            {exportingExcel ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                جاري التصدير...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                تصدير للتصحيح (Excel)
              </>
            )}
          </button>

          {/* Excel Import Button */}
          <label className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            رفع ملف الأقساط المصححة
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportUpdateExcel}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={`${ar.common.search}...`}
        filters={[
          {
            key: 'status',
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as StatusFilter),
            allLabel: ar.installments.all,
            options: [
              { value: 'unpaid', label: ar.installments.unpaid },
              { value: 'overdue', label: ar.installments.overdue },
              { value: 'dueToday', label: ar.installments.dueToday },
              { value: 'paid', label: ar.installments.paid },
            ],
          },
        ]}
      />

      <div className="flex gap-2 mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100 items-center justify-between flex-wrap">
        <div className="flex gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center px-2">تجميع حسب:</span>
          <button
            onClick={() => setGroupBy('none')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              groupBy === 'none' ? 'bg-white shadow-sm text-[#0A2472] border border-slate-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {ar.common.all}
          </button>
          <button
            onClick={() => setGroupBy('customer')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              groupBy === 'customer' ? 'bg-white shadow-sm text-[#0A2472] border border-slate-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {ar.customers.title}
          </button>
          <button
            onClick={() => setGroupBy('month')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              groupBy === 'month' ? 'bg-white shadow-sm text-[#0A2472] border border-slate-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {ar.common.month}
          </button>
        </div>

        <div className="flex gap-4 px-2">
          <div className="text-center">
            <div className="text-[10px] text-slate-500 font-bold mb-0.5">إجمالي المتأخر</div>
            <div className="text-sm font-black text-red-600 font-mono leading-none">{formatCurrency(stats.overdueAmount)}</div>
          </div>
          <div className="w-px h-8 bg-slate-200 my-auto"></div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 font-bold mb-0.5">عدد العملاء</div>
            <div className="text-sm font-black text-[#0A2472] leading-none">{stats.customerCount}</div>
          </div>
          <div className="w-px h-8 bg-slate-200 my-auto"></div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 font-bold mb-0.5">عدد الأقساط</div>
            <div className="text-sm font-black text-slate-700 leading-none">{stats.installmentCount}</div>
          </div>
        </div>
      </div>

      {groupBy === 'none' ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">{ar.customers.title}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">رقم الماكينة</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">{ar.installments.installmentNo}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">{ar.installments.dueDate}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">{ar.installments.amount}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">{ar.installments.paidAmount}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">المتبقي</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">{ar.installments.isPaid}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">رقم الإيصال / التاريخ</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">{ar.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((inst) => {
                  const isOverdueStatus = !inst.isPaid && isOverdue(inst.dueDate);
                  const isDueTodayStatus = !inst.isPaid && isDueToday(inst.dueDate);
                  return (
                    <tr key={inst.id} className={`hover:bg-gray-50 transition-colors ${isOverdueStatus ? 'bg-red-50' : isDueTodayStatus ? 'bg-orange-50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium">{inst.sale?.customer?.name} ({inst.sale?.customer?.bkCode})</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">{inst.sale?.machineSerial || '-'}</td>
                      <td className="px-4 py-3">{inst.installmentNo}</td>
                      <td className="px-4 py-3">
                        <span className={isOverdueStatus ? 'text-red-600 font-bold' : isDueTodayStatus ? 'text-orange-600 font-bold' : ''}>
                          {formatDate(inst.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-left font-bold">{formatCurrency(inst.amount)}</td>
                      <td className="px-4 py-3 text-left text-green-600 font-medium">{formatCurrency(inst.paidAmount)}</td>
                      <td className="px-4 py-3 text-left text-red-600 font-bold">{inst.isPaid ? '0' : formatCurrency(Number(inst.amount) - Number(inst.paidAmount))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isOverdueStatus && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                              {ar.installments.overdue}
                            </span>
                          )}
                          {isDueTodayStatus && !isOverdueStatus && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700">
                              {ar.installments.dueToday}
                            </span>
                          )}
                          {!inst.isPaid && Number(inst.paidAmount) > 0 && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              مدفوع جزئياً
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${inst.isPaid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {inst.isPaid ? ar.installments.paid : ar.installments.unpaid}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inst.isPaid && (
                          <div className="flex flex-col text-[10px] text-gray-500">
                            <span className="font-mono">{inst.receiptNumber || '-'}</span>
                            <span>{inst.paidDate ? formatDate(inst.paidDate) : '-'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!inst.isPaid && (
                          <PrimaryButton size="sm" onClick={() => handlePayClick(inst)}>
                            {Number(inst.paidAmount) > 0 ? 'استكمال التحصيل' : ar.payments.pay}
                          </PrimaryButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredData.length === 0 && (
            <EmptyState message={ar.common.noData} />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(
            filteredData.reduce((groups: any, inst) => {
              const key = groupBy === 'customer' 
                ? (inst.sale?.customer?.name || 'غير معروف')
                : new Date(inst.dueDate).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
              if (!groups[key]) groups[key] = { items: [], total: 0, count: 0 };
              groups[key].items.push(inst);
              if (!inst.isPaid) {
                groups[key].total = Math.round((groups[key].total + (Number(inst.amount) - Number(inst.paidAmount))) * 100) / 100;
                groups[key].count++;
              }
              return groups;
            }, {})
          ).map(([groupName, group]: any) => (
            <div key={groupName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-[#0A2472]">{groupName} ({group.items.length} قسط)</h3>
                <div className="flex gap-4 text-xs">
                  <span className="font-semibold text-red-600">غير مدفوع: {group.count} ( {formatCurrency(group.total)} )</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-4 py-2 text-right text-xs text-slate-500">القسط</th>
                      {groupBy === 'month' ? (
                        <th className="px-4 py-2 text-right text-xs text-slate-500">العميل / الماكينة</th>
                      ) : (
                        <th className="px-4 py-2 text-right text-xs text-slate-500">رقم الماكينة</th>
                      )}
                      <th className="px-4 py-2 text-right text-xs text-slate-500">تاريخ الاستحقاق</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500">المبلغ</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500">المدفوع</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500">المتبقي</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500">الحالة</th>
                      <th className="px-4 py-2 text-center text-xs text-slate-500">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((inst: any) => {
                       const isOverdueStatus = !inst.isPaid && isOverdue(inst.dueDate);
                       return (
                        <tr key={inst.id} className={`hover:bg-slate-50 ${isOverdueStatus ? 'bg-red-50/30' : ''}`}>
                          <td className="px-4 py-2 font-medium">قسط {inst.installmentNo}</td>
                          {groupBy === 'month' ? (
                            <td className="px-4 py-2">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-xs">{inst.sale?.customer?.name} ({inst.sale?.customer?.bkCode})</span>
                                <span className="text-[9px] text-slate-500 font-mono tracking-tight">{inst.sale?.machineSerial || '-'}</span>
                              </div>
                            </td>
                          ) : (
                            <td className="px-4 py-2 text-xs font-mono">{inst.sale?.machineSerial || '-'}</td>
                          )}
                          <td className="px-4 py-2">
                             <span className={isOverdueStatus ? 'text-red-600 font-bold' : ''}>
                              {formatDate(inst.dueDate)}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-bold">{formatCurrency(inst.amount)}</td>
                          <td className="px-4 py-2 text-green-600 font-medium">{formatCurrency(inst.paidAmount)}</td>
                          <td className="px-4 py-2 text-red-600 font-bold">{inst.isPaid ? '0' : formatCurrency(Number(inst.amount) - Number(inst.paidAmount))}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isOverdueStatus && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                                  {ar.installments.overdue}
                                </span>
                              )}
                              {!inst.isPaid && isDueToday(inst.dueDate) && !isOverdueStatus && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
                                  {ar.installments.dueToday}
                                </span>
                              )}
                              {!inst.isPaid && Number(inst.paidAmount) > 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                                  مدفوع جزئياً
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${inst.isPaid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {inst.isPaid ? ar.installments.paid : ar.installments.unpaid}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {!inst.isPaid && (
                              <button 
                                onClick={() => handlePayClick(inst)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                              >
                                تحصيل
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {filteredData.length === 0 && <EmptyState message={ar.common.noData} />}
        </div>
      )}

      <Modal isOpen={showPayModal} onClose={() => { setShowPayModal(false); setSelectedInst(null); }} title={ar.payments.pay}>
        {selectedInst && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-500 text-sm">{ar.customers.title}:</span>
                <span className="font-medium">{selectedInst.sale?.customer?.name} ({selectedInst.sale?.customer?.bkCode})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{ar.installments.installmentNo}:</span>
                <span className="font-medium">{selectedInst.installmentNo}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-500">القيمة الإجمالية:</span>
                <span className="font-bold">{formatCurrency(selectedInst.amount)}</span>
              </div>
              {Number(selectedInst.paidAmount) > 0 && (
                <div className="flex justify-between items-center mt-1 text-green-600">
                  <span className="text-sm">ما تم دفعه مسبقاً:</span>
                  <span className="font-medium">{formatCurrency(selectedInst.paidAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-900 font-bold">المطلوب سداده الآن:</span>
                <span className="font-black text-xl text-red-600">{formatCurrency(Number(selectedInst.amount) - Number(selectedInst.paidAmount))}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{ar.payments.paymentPlace}</label>
              <PaymentPlaceSelect
                value={quickPaymentPlace}
                onChange={setQuickPaymentPlace}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{ar.payments.receiptNumber}</label>
              <input
                type="text"
                value={quickReceiptNumber}
                onChange={(e) => setQuickReceiptNumber(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
                placeholder="أدخل رقم الإيصال"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الدفع</label>
              <input
                type="date"
                value={quickPaidAt}
                onChange={(e) => setQuickPaidAt(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton type="button" onClick={() => { setShowPayModal(false); setSelectedInst(null); }}>
                {ar.common.cancel}
              </SecondaryButton>
              <PrimaryButton type="button" onClick={handleQuickPay}>
                {ar.payments.pay}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}