import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { salesApi, rewardsApi, installmentsApi } from '@/api/client';
import { formatCurrency, formatDate, isOverdue } from '@/lib/utils';
import type { MachineSale } from '@/types';
import { ar } from '@/i18n/ar';
import { exportApi } from '@/api/client';
import { useToast } from '@/lib/toast';
import { LoadingScreen } from '@/lib/Spinner';
import { Modal } from '@/lib/Modal';
import { PrimaryButton, SecondaryButton, DangerButton, PageHeader, EmptyState } from '@/lib/Actions';
import { PaymentPlaceSelect } from '@/lib/PaymentPlace';
import { SmartSelect } from '@/lib/SmartSelect';
import { Gift, Edit2 } from 'lucide-react';

export default function SaleDetail() {
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sale, setSale] = useState<MachineSale | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [showEditSaleModal, setShowEditSaleModal] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<{id: string; amount: number} | null>(null);
  const [selectedWaiveIds, setSelectedWaiveIds] = useState<string[]>([]);
  const [waiveReason, setWaiveReason] = useState('');
  const [paymentForm, setPaymentForm] = useState({ 
    amount: 0, 
    paymentType: 'INSTALLMENT' as 'INSTALLMENT' | 'DOWN_PAYMENT', 
    paymentPlace: 'dhamen', 
    notes: '', 
    installmentIds: [] as string[],
    receiptNumber: '',
    paidAt: new Date().toISOString().split('T')[0]
  });
  const [voidReason, setVoidReason] = useState('');
  const [quickPaymentPlace, setQuickPaymentPlace] = useState('dhamen');
  const [quickReceiptNumber, setQuickReceiptNumber] = useState('');
  const [quickPaidAt, setQuickPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [editSaleForm, setEditSaleForm] = useState({
    saleDate: '',
    notes: '',
    totalPrice: 0,
    downPayment: 0,
    months: 0,
    firstDueDate: '',
    downPaymentReceipt: ''
  });
  const [paymentPreview, setPaymentPreview] = useState<any>(null);
  
  // Installment Editing state
  const [showEditInstModal, setShowEditInstModal] = useState(false);
  const [editingInst, setEditingInst] = useState<{
    id: string;
    receiptNumber: string;
    paidDate: string;
    installmentNo: number;
    paymentPlace?: string;
  } | null>(null);

  useEffect(() => {
    if (showPaymentModal && paymentForm.amount > 0) {
      const timer = setTimeout(async () => {
        try {
          const preview = await salesApi.previewPayment(id!, paymentForm.amount, paymentForm.installmentIds);
          setPaymentPreview(preview);
        } catch (err) {
          console.error('Failed to fetch payment preview:', err);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPaymentPreview(null);
    }
  }, [paymentForm.amount, paymentForm.installmentIds, showPaymentModal, id]);

  useEffect(() => {
    if (id) loadSale();
  }, [id]);

  const loadSale = async () => {
    try {
      const data = await salesApi.getById(id!);
      setSale(data);
    } catch (err) {
      console.error('Failed to load sale:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await salesApi.pay(id!, {
        ...paymentForm,
        saleId: id,
        amount: Number(paymentForm.amount)
      });
      showToast(ar.common.success, 'success');
      setShowPaymentModal(false);
      setPaymentForm({ 
        amount: 0, 
        paymentType: 'INSTALLMENT', 
        paymentPlace: 'dhamen', 
        notes: '', 
        installmentIds: [], 
        receiptNumber: '',
        paidAt: new Date().toISOString().split('T')[0]
      });
      loadSale();
    } catch (err: unknown) {
      showToast(ar.common.error, 'error');
    }
  };

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await salesApi.void(id!, voidReason);
      showToast(ar.common.success, 'success');
      setShowVoidModal(false);
      loadSale();
    } catch (err: unknown) {
      showToast(ar.common.error, 'error');
    }
  };

  const handlePrintContract = async () => {
    try {
      const html = await exportApi.contract(id!);
      const printWindow = window.open('', '_blank', 'width=1000,height=800,menubar=no,toolbar=no,location=no,status=no');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Wait for styles and content to render before printing
        setTimeout(() => {
          printWindow.print();
        }, 300);
      }
    } catch (err) {
      console.error('Failed to print contract:', err);
    }
  };

  const handlePayInstallment = (installmentId: string, amount: any) => {
    setSelectedInstallment({ id: installmentId, amount: Number(amount) });
    setShowPayModal(true);
  };

  const handleQuickPay = async () => {
    if (!selectedInstallment) return;
    try {
      await salesApi.pay(id!, {
        saleId: id,
        amount: Number(selectedInstallment.amount),
        paymentType: 'INSTALLMENT',
        paymentPlace: quickPaymentPlace,
        notes: '',
        installmentIds: [selectedInstallment.id],
        receiptNumber: quickReceiptNumber,
        paidAt: quickPaidAt
      });
      showToast(ar.common.success, 'success');
      setShowPayModal(false);
      setQuickPaymentPlace('dhamen');
      setQuickReceiptNumber('');
      setQuickPaidAt(new Date().toISOString().split('T')[0]);
      setSelectedInstallment(null);
      loadSale();
    } catch (err: unknown) {
      showToast(ar.common.error, 'error');
    }
  };

  const handleWaiveInstallments = async () => {
    if (selectedWaiveIds.length === 0) {
      showToast('يرجى اختيار الأقساط المراد تنزيلها', 'error');
      return;
    }
    try {
      const result = await rewardsApi.waiveInstallments({
        saleId: id!,
        installmentIds: selectedWaiveIds,
        reason: waiveReason || 'مكافأة',
      });
      showToast(result.message || 'تم تنزيل الأقساط بنجاح', 'success');
      setShowWaiveModal(false);
      setSelectedWaiveIds([]);
      setWaiveReason('');
      loadSale();
    } catch (err: unknown) {
      showToast(ar.common.error, 'error');
    }
  };

  const handleEditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;
    
    const isCoreChanged = (
      Number(editSaleForm.totalPrice) !== Number(sale.totalPrice) ||
      Number(editSaleForm.downPayment) !== Number(sale.downPayment) ||
      Number(editSaleForm.months) !== Number(sale.months) ||
      (editSaleForm.firstDueDate && editSaleForm.firstDueDate !== (sale.firstDueDate ? new Date(sale.firstDueDate).toISOString().split('T')[0] : '')) ||
      editSaleForm.downPaymentReceipt !== (sale.downPaymentReceipt || '')
    );

    try {
      if (isCoreChanged && sale.saleType === 'INSTALLMENT') {
        if (!window.confirm('تحذير: تغيير بيانات العقد الأساسية سيؤدي إلى مسح الأقساط الحالية وإعادة حسابها وتوزيع الدفعات السابقة من جديد. هل أنت متأكد؟')) {
          return;
        }
        await salesApi.fullRecalculate(id!, {
          totalPrice: Number(editSaleForm.totalPrice),
          downPayment: Number(editSaleForm.downPayment),
          months: Number(editSaleForm.months),
          firstDueDate: editSaleForm.firstDueDate || undefined,
          downPaymentReceipt: editSaleForm.downPaymentReceipt
        });
      }

      await salesApi.update(id!, {
        saleDate: editSaleForm.saleDate,
        notes: editSaleForm.notes
      });
      
      showToast(ar.common.success, 'success');
      setShowEditSaleModal(false);
      loadSale();
    } catch (err: unknown) {
      showToast(ar.common.error, 'error');
    }
  };

  const openEditSaleModal = () => {
    if (!sale) return;
    setEditSaleForm({
      saleDate: new Date(sale.saleDate).toISOString().split('T')[0],
      notes: sale.notes || '',
      totalPrice: Number(sale.totalPrice),
      downPayment: Number(sale.downPayment),
      months: Number(sale.months || 0),
      firstDueDate: sale.firstDueDate ? new Date(sale.firstDueDate).toISOString().split('T')[0] : '',
      downPaymentReceipt: sale.downPaymentReceipt || ''
    });
    setShowEditSaleModal(true);
  };

  const handleUpdateInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;
    try {
      await installmentsApi.update(editingInst.id, {
        receiptNumber: editingInst.receiptNumber,
        paidDate: editingInst.paidDate,
        paymentPlace: editingInst.paymentPlace,
      });
      showToast(ar.common.success, 'success');
      setShowEditInstModal(false);
      setEditingInst(null);
      loadSale();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || ar.common.error;
      showToast(errMsg, 'error');
    }
  };

  const openEditInstModal = (inst: any) => {
    const linkedPayment = sale?.payments?.find((p: any) => p.id === inst.paymentId || (inst.receiptNumber && p.receiptNumber === inst.receiptNumber));
    setEditingInst({
      id: inst.id,
      receiptNumber: inst.receiptNumber || '',
      paidDate: inst.paidDate ? new Date(inst.paidDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      installmentNo: inst.installmentNo,
      paymentPlace: linkedPayment?.paymentPlace || 'dhamen'
    });
    setShowEditInstModal(true);
  };

  if (loading) {
    return <LoadingScreen message={ar.common.loading} />;
  }

  if (!sale) {
    return <EmptyState message={ar.common.noData} />;
  }

  const unpaidInstallments = sale.installments?.filter(i => !i.isPaid) || [];
  const waiveableInstallments = unpaidInstallments.filter(i => !i.isWaived);

  // Helper to get payment place display name
  const getPlaceLabel = (place?: string) => {
    if (!place) return '';
    const places: Record<string, string> = {
      'dhamen': 'ضامن',
      'post': 'البريد',
      'bank': 'البنك'
    };
    return places[place] || place;
  };

  return (
    <div className="space-y-4">
      <PageHeader title={ar.sales.saleDetails} actions={
        <SecondaryButton onClick={() => navigate('/sales')}>
          ← {ar.common.back}
        </SecondaryButton>
      } />

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="mb-6 pb-4 border-b border-gray-100 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-[#0A2472]">{sale.customer?.name}</h2>
            <p className="text-sm text-gray-500">كود العميل: <span className="font-mono">{sale.customer?.bkCode || '-'}</span></p>
          </div>
          <SecondaryButton size="sm" onClick={openEditSaleModal}>
            <Edit2 size={14} className="ml-1" />
            تعديل البيانات
          </SecondaryButton>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div><span className="text-gray-500 text-sm">{ar.sales.receiptNumber}:</span> <span className="font-mono">{sale.receiptNumber}</span></div>
          <div><span className="text-gray-500 text-sm">{ar.sales.machineSerial}:</span> <span className="font-mono">{sale.machineSerial}</span></div>
          <div><span className="text-gray-500 text-sm">{ar.sales.saleType}:</span> <span className="font-medium">{sale.saleType === 'CASH' ? ar.sales.cash : ar.sales.installment}</span></div>
          <div><span className="text-gray-500 text-sm">{ar.sales.saleDate}:</span> {formatDate(sale.saleDate)}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div><span className="text-gray-500 text-sm">{ar.sales.totalPrice}:</span> <span className="font-bold">{formatCurrency(sale.totalPrice)}</span></div>
          {sale.saleType === 'INSTALLMENT' && <div><span className="text-gray-500 text-sm">{ar.sales.downPayment}:</span> {formatCurrency(sale.downPayment)}</div>}
          <div><span className="text-gray-500 text-sm">{sale.saleType === 'CASH' ? 'دفعة كاملة' : ar.sales.paidAmount}:</span> <span className="font-bold text-green-600">{formatCurrency(sale.paidAmount)}</span></div>
          {sale.saleType === 'INSTALLMENT' && <div><span className="text-gray-500 text-sm">{ar.sales.remainingAmount}:</span> <span className="font-bold text-orange-600">{formatCurrency(sale.remainingAmount)}</span></div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <span className={`px-2 py-1 rounded text-xs font-medium ${sale.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : sale.status === 'VOIDED' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
            {sale.status === 'ACTIVE' ? ar.sales.active : sale.status === 'VOIDED' ? ar.sales.voided : ar.sales.completed}
          </span>
          {sale.saleType === 'INSTALLMENT' && (
            <SecondaryButton size="sm" onClick={handlePrintContract}>
              {ar.sales.contract}
            </SecondaryButton>
          )}
          {sale.status === 'ACTIVE' && sale.saleType === 'INSTALLMENT' && (
            <PrimaryButton size="sm" onClick={() => setShowPaymentModal(true)}>
              {ar.payments.addNew}
            </PrimaryButton>
          )}
          {sale.status === 'ACTIVE' && sale.saleType === 'INSTALLMENT' && waiveableInstallments.length > 0 && (
            <SecondaryButton size="sm" onClick={() => setShowWaiveModal(true)}>
              <Gift size={14} className="ml-1" />
              تنزيل قسط
            </SecondaryButton>
          )}
          {sale.status === 'ACTIVE' && (
            <DangerButton size="sm" onClick={() => setShowVoidModal(true)}>
              {ar.sales.voidSale}
            </DangerButton>
          )}
        </div>
      </div>

      {sale.saleType === 'INSTALLMENT' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">{ar.installments.title}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">{ar.installments.installmentNo}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">{ar.installments.dueDate}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">{ar.installments.amount}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">{ar.installments.paidAmount}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">المتبقي</th>
                  <th className="px-1 py-1 whitespace-nowrap text-right text-xs font-bold text-gray-500">{ar.installments.isPaid}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">رقم الإيصال / المكان / التاريخ</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">{ar.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sale.installments?.map((inst) => {
                  // Find associated payment to get payment place
                  const payment = sale.payments?.find(p => p.receiptNumber === inst.receiptNumber);
                  
                  return (
                    <tr key={inst.id} className={`hover:bg-gray-50 transition-colors ${inst.isWaived ? 'bg-emerald-50' : (!inst.isPaid && Number(inst.paidAmount) > 0 ? 'bg-amber-50/50' : '')}`}>
                      <td className="px-4 py-3 font-medium">{inst.installmentNo}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(inst.dueDate)}</td>
                      <td className="px-4 py-3 text-left font-bold">{formatCurrency(inst.amount)}</td>
                      <td className="px-4 py-3 text-left text-green-600 font-medium">{formatCurrency(inst.paidAmount)}</td>
                      <td className="px-4 py-3 text-left text-red-600 font-bold">{inst.isPaid ? '0' : formatCurrency(Number(inst.amount) - Number(inst.paidAmount))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {inst.isWaived ? (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                              مكافأة
                            </span>
                          ) : (
                            <>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${inst.isPaid ? 'bg-green-50 text-green-700' : isOverdue(inst.dueDate) ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                                {inst.isPaid ? ar.installments.paid : ar.installments.unpaid}
                              </span>
                              {!inst.isPaid && Number(inst.paidAmount) > 0 && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                  مدفوع جزئياً
                                </span>
                              )}
                              {!inst.isPaid && isOverdue(inst.dueDate) && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                                  {ar.installments.overdue}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inst.isPaid && (
                          <div className="flex flex-col text-[10px] text-gray-500">
                             <div className="flex items-center justify-end gap-1 font-mono">
                              <span className="flex items-center gap-1 group relative">
                                {inst.receiptNumber || '-'}
                                <button 
                                  onClick={() => openEditInstModal(inst)}
                                  className="p-1 hover:bg-blue-50 text-blue-400 hover:text-blue-600 rounded transition-colors"
                                  title="تعديل الإيصال"
                                >
                                  <Edit2 size={10} />
                                </button>
                              </span>
                              {payment && (
                                <span className="px-1 bg-slate-100 rounded text-slate-600 text-[8px] font-sans">
                                  {getPlaceLabel(payment.paymentPlace)}
                                </span>
                              )}
                            </div>
                            <span>{inst.paidDate ? formatDate(inst.paidDate) : '-'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!inst.isPaid && !inst.isWaived && sale.status === 'ACTIVE' && (
                          <PrimaryButton 
                            size="sm" 
                            onClick={() => handlePayInstallment(inst.id, Number(inst.amount) - Number(inst.paidAmount))}
                          >
                            {Number(inst.paidAmount) > 0 ? 'استكمال التحصيل' : ar.payments.pay}
                          </PrimaryButton>
                        )}
                        {inst.isWaived && inst.waiveReason && (
                          <span className="text-xs text-emerald-600" title={inst.waiveReason}>
                            {inst.waiveReason}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Waive Installments Modal */}
      <Modal isOpen={showWaiveModal} onClose={() => { setShowWaiveModal(false); setSelectedWaiveIds([]); setWaiveReason(''); }} title="تنزيل أقساط (مكافأة)">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">اختر الأقساط المراد تنزيلها</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
              {waiveableInstallments.map((inst) => (
                <label key={inst.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedWaiveIds.includes(inst.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedWaiveIds([...selectedWaiveIds, inst.id]);
                      } else {
                        setSelectedWaiveIds(selectedWaiveIds.filter(id => id !== inst.id));
                      }
                    }}
                  />
                  <span>قسط {inst.installmentNo} - {formatCurrency(inst.amount)} - تستحق: {formatDate(inst.dueDate)}</span>
                </label>
              ))}
            </div>
            {selectedWaiveIds.length > 0 && (
              <div className="mt-2 p-2 bg-emerald-50 rounded-md text-sm text-emerald-700">
                إجمالي الأقساط المتنزلة: {formatCurrency(selectedWaiveIds.reduce((sum, instId) => {
                  const inst = waiveableInstallments.find(i => i.id === instId);
                  return sum + Number(inst?.amount || 0);
                }, 0))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">سبب التنزيل (اختياري)</label>
            <input
              type="text"
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
              placeholder="مثال: وصل لمبيعات 50 ألف"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton type="button" onClick={() => { setShowWaiveModal(false); setSelectedWaiveIds([]); setWaiveReason(''); }}>
              {ar.common.cancel}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={handleWaiveInstallments} disabled={selectedWaiveIds.length === 0}>
              تنزيل ({selectedWaiveIds.length}) قسط
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title={ar.payments.addNew}>
        <form onSubmit={handlePayment} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.payments.amount}</label>
            <input
              type="number"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
              required
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.payments.paymentType}</label>
            <SmartSelect
              options={[
                { id: 'INSTALLMENT', label: ar.payments.installment },
                { id: 'DOWN_PAYMENT', label: ar.payments.downPayment },
              ]}
              value={paymentForm.paymentType}
              onChange={(value) => setPaymentForm({ ...paymentForm, paymentType: value as 'INSTALLMENT' | 'DOWN_PAYMENT' })}
              placeholder={ar.payments.paymentType}
            />
          </div>
          {unpaidInstallments.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{ar.common.selectInstallments}</label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                {unpaidInstallments.map((inst) => (
                  <label key={inst.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={paymentForm.installmentIds.includes(inst.id)}
                      onChange={(e) => {
                        const newIds = e.target.checked
                          ? [...paymentForm.installmentIds, inst.id]
                          : paymentForm.installmentIds.filter(id => id !== inst.id);
                        
                        const totalAmount = newIds.reduce((sum, instId) => {
                          const installment = unpaidInstallments.find(i => i.id === instId);
                          return sum + (Number(installment?.amount || 0) - Number(installment?.paidAmount || 0));
                        }, 0);
                        
                        setPaymentForm({ ...paymentForm, installmentIds: newIds, amount: totalAmount });
                      }}
                    />
                    <span>{ar.common.installment} {inst.installmentNo} - {formatCurrency(Number(inst.amount) - Number(inst.paidAmount))} متبقي</span>
                  </label>
                ))}
              </div>
              {paymentForm.installmentIds.length === 0 && (
                <p className="text-xs text-blue-600 mt-1">{ar.payments.autoApplyHelp}</p>
              )}
            </div>
          )}

          {/* Payment Preview Section (Server-side) */}
          {paymentPreview && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{ar.payments.remainingBalance}</span>
                <span>{formatCurrency(paymentPreview.remainingAmount)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-[#0A2472] border-t border-slate-100 pt-1">
                <span>{ar.payments.newBalance}</span>
                <span className={paymentPreview.credit > 0 ? 'text-green-600' : ''}>
                  {paymentPreview.credit > 0 
                    ? `${formatCurrency(paymentPreview.credit)} (${ar.payments.credit})`
                    : formatCurrency(paymentPreview.newRemainingAmount)}
                </span>
              </div>
              
              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">توزيع المبلغ</p>
                <div className="space-y-1">
                  {paymentPreview.distribution.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-600">قسط {item.installmentNo}</span>
                      <span className={item.isPaid ? 'text-green-600 font-bold' : 'text-orange-600'}>
                        {formatCurrency(item.appliedAmount)} {item.isPaid ? `(${ar.payments.paidCompletely})` : `(${ar.payments.partiallyPaid})`}
                      </span>
                    </div>
                  ))}
                  
                  {paymentPreview.credit > 0.01 && (
                    <div className="flex justify-between items-center text-[10px] text-green-600 font-bold bg-green-50 p-1 rounded">
                      <span>{ar.payments.credit}</span>
                      <span>{formatCurrency(paymentPreview.credit)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.payments.paymentPlace}</label>
            <PaymentPlaceSelect
              value={paymentForm.paymentPlace}
              onChange={(value) => setPaymentForm({ ...paymentForm, paymentPlace: value })}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.payments.receiptNumber}</label>
            <input
              type="text"
              value={paymentForm.receiptNumber}
              onChange={(e) => setPaymentForm({ ...paymentForm, receiptNumber: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
              placeholder={ar.common.receiptNumberPlaceholder}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الدفع الفعلي</label>
            <input
              type="date"
              value={paymentForm.paidAt}
              onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton type="button" onClick={() => setShowPaymentModal(false)}>
              {ar.common.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit">
              {ar.common.save}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showVoidModal} onClose={() => setShowVoidModal(false)} title={ar.sales.voidSale}>
        <form onSubmit={handleVoid} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.voidReason}</label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
              required
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton type="button" onClick={() => setShowVoidModal(false)}>
              {ar.common.cancel}
            </SecondaryButton>
            <DangerButton type="submit">
              {ar.sales.voidSale}
            </DangerButton>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPayModal} onClose={() => { setShowPayModal(false); setSelectedInstallment(null); }} title={ar.payments.pay}>
        {selectedInstallment && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-500">القيمة الإجمالية:</span>
                <span className="font-bold">{formatCurrency(selectedInstallment.amount)}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-900 font-bold">المطلوب سداده الآن:</span>
                <span className="font-black text-xl text-red-600">{formatCurrency(selectedInstallment.amount)}</span>
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
                placeholder={ar.common.receiptNumberPlaceholder}
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
              <SecondaryButton type="button" onClick={() => { setShowPayModal(false); setSelectedInstallment(null); }}>
                {ar.common.cancel}
              </SecondaryButton>
              <PrimaryButton type="button" onClick={handleQuickPay}>
                {ar.payments.pay}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showEditSaleModal} onClose={() => setShowEditSaleModal(false)} title="تعديل بيانات البيع">
        <form onSubmit={handleEditSale} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.saleDate}</label>
              <input
                type="date"
                value={editSaleForm.saleDate}
                onChange={(e) => setEditSaleForm({ ...editSaleForm, saleDate: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
                required
              />
            </div>
            {sale?.saleType === 'INSTALLMENT' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ أول قسط</label>
                <input
                  type="date"
                  value={editSaleForm.firstDueDate}
                  onChange={(e) => setEditSaleForm({ ...editSaleForm, firstDueDate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
                />
              </div>
            )}
          </div>
          
          {sale?.saleType === 'INSTALLMENT' && (
            <>
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs font-bold text-red-700 mb-3 text-center">
                  ⚠️ تغيير الحقول التالية سيؤدي إلى إعادة حساب وجدولة جميع الأقساط
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.totalPrice}</label>
                    <input
                      type="number"
                      value={editSaleForm.totalPrice}
                      onChange={(e) => setEditSaleForm({ ...editSaleForm, totalPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-red-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.downPayment}</label>
                    <input
                      type="number"
                      value={editSaleForm.downPayment}
                      onChange={(e) => setEditSaleForm({ ...editSaleForm, downPayment: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-red-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">عدد الأشهر</label>
                    <input
                      type="number"
                      value={editSaleForm.months}
                      onChange={(e) => setEditSaleForm({ ...editSaleForm, months: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-red-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">رقم إيصال المقدم (إن وجد)</label>
                  <input
                    type="text"
                    value={editSaleForm.downPaymentReceipt}
                    onChange={(e) => setEditSaleForm({ ...editSaleForm, downPaymentReceipt: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-red-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.notes}</label>
            <textarea
              value={editSaleForm.notes}
              onChange={(e) => setEditSaleForm({ ...editSaleForm, notes: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton type="button" onClick={() => setShowEditSaleModal(false)}>
              {ar.common.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit">
              {ar.common.save}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* Edit Installment Details Modal */}
      <Modal 
        isOpen={showEditInstModal} 
        onClose={() => { setShowEditInstModal(false); setEditingInst(null); }} 
        title={`تعديل بيانات القسط رقم ${editingInst?.installmentNo}`}
      >
        <form onSubmit={handleUpdateInstallment} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">رقم الإيصال</label>
            <input
              type="text"
              value={editingInst?.receiptNumber || ''}
              onChange={(e) => setEditingInst(prev => prev ? { ...prev, receiptNumber: e.target.value } : null)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ السداد</label>
            <input
              type="date"
              value={editingInst?.paidDate || ''}
              onChange={(e) => setEditingInst(prev => prev ? { ...prev, paidDate: e.target.value } : null)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">مكان الدفع</label>
            <PaymentPlaceSelect
              value={editingInst?.paymentPlace || 'dhamen'}
              onChange={(value) => setEditingInst(prev => prev ? { ...prev, paymentPlace: value } : null)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton type="button" onClick={() => { setShowEditInstModal(false); setEditingInst(null); }}>
              {ar.common.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit">
              حفظ التعديلات
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}