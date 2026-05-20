import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { salesApi, customersApi } from '@/api/client';
import { formatCurrency } from '@/lib/utils';
import type { MachineSale, Customer } from '@/types';
import { ar } from '@/i18n/ar';
import { useToast } from '@/lib/toast';
import { LoadingScreen } from '@/lib/Spinner';
import { Modal } from '@/lib/Modal';
import { PrimaryButton, SecondaryButton, PageHeader, EmptyState, TableActions } from '@/lib/Actions';
import { PaymentPlaceSelect } from '@/lib/PaymentPlace';
import { SearchFilterBar } from '@/lib/SearchFilterBar';
import { SmartSelect } from '@/lib/SmartSelect';

type SaleStatusFilter = '' | 'ACTIVE' | 'COMPLETED' | 'VOIDED';
type SaleTypeFilter = '' | 'CASH' | 'INSTALLMENT';

export default function Sales() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as any;
  const [sales, setSales] = useState<MachineSale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>(
    state?.filter === 'active' ? 'ACTIVE' : ''
  );
  const [typeFilter, setTypeFilter] = useState<SaleTypeFilter>('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '',
    machineSerial: '',
    saleType: 'CASH' as 'CASH' | 'INSTALLMENT',
    totalPrice: 0,
    downPayment: 0,
    actualPaidAmount: 0,
    installmentAmount: 0,
    paymentPlace: 'dhamen',
    downPaymentReceipt: '',
    notes: '',
    saleDate: new Date().toISOString().split('T')[0],
    lastDepositDate: new Date().toISOString().split('T')[0],
    months: 12,
  });
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const nextStep = () => {
    if (step === 1 && (!formData.customerId || !formData.machineSerial)) {
      setError('يرجى اختيار العميل وإدخال رقم الماكينة');
      return;
    }
    if (step === 2) {
      if (formData.totalPrice <= 0) {
        setError('إجمالي العقد يجب أن يكون أكبر من صفر');
        return;
      }
      if (formData.saleType === 'INSTALLMENT' && (formData.months <= 0 || !formData.months)) {
        setError('يرجى إدخال عدد الأشهر');
        return;
      }
    }
    setError('');
    setStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setError('');
    setStep(prev => Math.max(prev - 1, 1));
  };

  // Auto-calculate logic for display (User can still override)
  useEffect(() => {
    if (formData.saleType === 'INSTALLMENT' && formData.downPayment === 0 && formData.totalPrice > 0 && formData.actualPaidAmount === 0) {
      setFormData(prev => ({ ...prev, downPayment: 3000 }));
    }
  }, [formData.saleType, formData.totalPrice]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [salesData, customersData] = await Promise.all([
        salesApi.getAll(),
        customersApi.getAll(),
      ]);
      setSales(salesData);
      setCustomers(customersData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = useMemo(() => {
    let data = sales;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((s) =>
        s.customer?.name?.toLowerCase().includes(q) ||
        s.customer?.bkCode?.toLowerCase().includes(q) ||
        s.receiptNumber?.toLowerCase().includes(q) ||
        s.machineSerial?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) data = data.filter((s) => s.status === statusFilter);
    if (typeFilter) data = data.filter((s) => s.saleType === typeFilter);
    return data;
  }, [sales, search, statusFilter, typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const months = formData.months;

    try {
      await salesApi.create({
        ...formData,
        months: formData.saleType === 'INSTALLMENT' ? months : undefined,
      });
      showToast(ar.common.success, 'success');
      setShowModal(false);
      setFormData({
        customerId: '',
        machineSerial: '',
        saleType: 'CASH',
        totalPrice: 0,
        downPayment: 0,
        actualPaidAmount: 0,
        installmentAmount: 0,
        paymentPlace: 'dhamen',
        downPaymentReceipt: '',
        notes: '',
        saleDate: new Date().toISOString().split('T')[0],
        lastDepositDate: new Date().toISOString().split('T')[0],
        months: 12,
      });
      setStep(1);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || ar.common.error);
      showToast(ar.common.error, 'error');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setStep(1);
    setError('');
  };

  if (loading) {
    return <LoadingScreen message={ar.common.loading} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader 
        title={ar.sales.title}
        actions={
          <PrimaryButton onClick={() => setShowModal(true)}>
            {ar.sales.addNew}
          </PrimaryButton>
        }
      />

      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={`${ar.common.search}...`}
        filters={[
          {
            key: 'status',
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as SaleStatusFilter),
            allLabel: ar.sales.status,
            options: [
              { value: 'ACTIVE', label: ar.sales.active },
              { value: 'COMPLETED', label: ar.sales.completed },
              { value: 'VOIDED', label: ar.sales.voided },
            ],
          },
          {
            key: 'type',
            value: typeFilter,
            onChange: (v) => setTypeFilter(v as SaleTypeFilter),
            allLabel: ar.sales.saleType,
            options: [
              { value: 'CASH', label: ar.sales.cash },
              { value: 'INSTALLMENT', label: ar.sales.installment },
            ],
          },
        ]}
      />

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.sales.receiptNumber}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.customers.title}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.sales.machineSerial}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.sales.saleType}</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.sales.totalPrice}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.sales.status}</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-sm text-gray-700">{sale.downPaymentReceipt || sale.receiptNumber}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{sale.customer?.name} ({sale.customer?.bkCode})</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-600">{sale.machineSerial}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${sale.saleType === 'CASH' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                      {sale.saleType === 'CASH' ? ar.sales.cash : ar.sales.installment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left font-bold text-gray-900">{formatCurrency(sale.totalPrice)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${sale.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : sale.status === 'VOIDED' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                      {sale.status === 'ACTIVE' ? ar.sales.active : sale.status === 'VOIDED' ? ar.sales.voided : ar.sales.completed}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TableActions>
                      <SecondaryButton onClick={() => navigate(`/sales/${sale.id}`)}>
                        {ar.common.details}
                      </SecondaryButton>
                    </TableActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSales.length === 0 && (
          <EmptyState message={ar.common.noData} />
        )}
      </div>

      <Modal isOpen={showModal} onClose={handleCloseModal} title={ar.sales.addNew}>
        {error && <div className="smart-alert smart-alert-error mb-4">{error}</div>}
        
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                step >= num ? 'bg-[#0A2472] text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {num}
              </div>
              {num < 3 && (
                <div className={`h-1 w-12 md:w-24 ${
                  step > num ? 'bg-[#0A2472]' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 font-medium mb-6 px-1">
          <span>الأساسيات</span>
          <span className="-ml-4">المالية</span>
          <span>المراجعة</span>
        </div>

        <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }} className="space-y-5">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700">{ar.sales.selectCustomer}</label>
                  <button 
                    type="button" 
                    onClick={() => navigate('/customers')}
                    className="text-xs text-[#0A2472] hover:underline flex items-center gap-1"
                  >
                    + {ar.customers.addNew}
                  </button>
                </div>
                <SmartSelect
                  options={customers.map((c) => ({ id: c.id, label: c.name, sublabel: c.bkCode }))}
                  value={formData.customerId}
                  onChange={(value) => setFormData({ ...formData, customerId: value })}
                  placeholder={`-- ${ar.sales.selectCustomer} --`}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.machineSerial}</label>
                <input
                  type="text"
                  value={formData.machineSerial}
                  onChange={(e) => setFormData({ ...formData, machineSerial: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.saleType}</label>
                  <SmartSelect
                    options={[
                      { id: 'CASH', label: ar.sales.cash },
                      { id: 'INSTALLMENT', label: ar.sales.installment },
                    ]}
                    value={formData.saleType}
                    onChange={(value) => setFormData({ ...formData, saleType: value as 'CASH' | 'INSTALLMENT' })}
                    placeholder={ar.sales.saleType}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.saleDate}</label>
                  <input
                    type="date"
                    value={formData.saleDate}
                    onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">إجمالي قيمة العقد</label>
                <input
                  type="number"
                  value={formData.totalPrice || ''}
                  onChange={(e) => setFormData({ ...formData, totalPrice: Number(e.target.value) })}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-lg font-black text-[#0A2472] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                  min="0"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                 <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">بيانات الدفعة الأولى</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ المدفوع فعلياً الآن</label>
                      <input
                        type="number"
                        value={formData.actualPaidAmount || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormData(prev => ({ 
                            ...prev, 
                            actualPaidAmount: val, 
                            downPayment: prev.downPayment === 0 || prev.downPayment === 3000 ? Math.min(val, 3000) : prev.downPayment 
                          }));
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-bold text-[#0A2472]"
                        placeholder="مثلاً 7530"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.downPayment} (التعاقدي)</label>
                      <input
                        type="number"
                        value={formData.downPayment || ''}
                        onChange={(e) => setFormData({ ...formData, downPayment: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-bold text-teal-700"
                        placeholder="3000"
                      />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ استلام الدفعة</label>
                      <input
                        type="date"
                        value={formData.lastDepositDate}
                        onChange={(e) => setFormData({ ...formData, lastDepositDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">رقم إيصال الدفعة الأولى</label>
                      <input
                        type="text"
                        value={formData.downPaymentReceipt}
                        onChange={(e) => setFormData({ ...formData, downPaymentReceipt: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm"
                        placeholder="اختياري"
                      />
                    </div>
                 </div>
              </div>

              {formData.saleType === 'INSTALLMENT' && (
                <div className="grid grid-cols-2 gap-4 items-end bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">عدد الأشهر</label>
                    <input
                      type="number"
                      value={formData.months}
                      onChange={(e) => setFormData({ ...formData, months: Number(e.target.value) })}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-md text-sm font-bold"
                      min="1"
                      max="120"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">قيمة القسط الشهري (تقريبي)</label>
                    <input
                      type="number"
                      value={Math.round(((formData.totalPrice - (formData.downPayment || 0)) / (formData.months || 1)) * 100) / 100}
                      onChange={(e) => {
                        const amount = Number(e.target.value);
                        if (amount > 0) {
                          const calculatedMonths = Math.round((formData.totalPrice - (formData.downPayment || 0)) / amount);
                          setFormData({ ...formData, months: calculatedMonths > 0 ? calculatedMonths : 1 });
                        }
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-md text-sm font-bold text-purple-700"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <h4 className="font-bold text-[#0A2472] mb-3 border-b border-blue-200 pb-2">ملخص العملية</h4>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-gray-500">العميل:</div>
                  <div className="font-bold">{customers.find(c => c.id === formData.customerId)?.name}</div>
                  <div className="text-gray-500">الماكينة:</div>
                  <div className="font-bold">{formData.machineSerial}</div>
                  <div className="text-gray-500">النوع:</div>
                  <div className="font-bold">{formData.saleType === 'CASH' ? 'كاش' : 'قسط'}</div>
                  <div className="text-gray-500">الإجمالي:</div>
                  <div className="font-bold text-[#0A2472]">{formatCurrency(formData.totalPrice)}</div>
                  <div className="text-gray-500">المدفوع:</div>
                  <div className="font-bold text-green-600">{formatCurrency(formData.actualPaidAmount)}</div>
                  {formData.saleType === 'INSTALLMENT' && (
                    <>
                      <div className="text-gray-500">عدد الأشهر:</div>
                      <div className="font-bold">{formData.months} شهر</div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.paymentPlace}</label>
                <PaymentPlaceSelect
                  value={formData.paymentPlace}
                  onChange={(value) => setFormData({ ...formData, paymentPlace: value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.notes}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
                  rows={2}
                  placeholder="أضف أي ملاحظات إضافية هنا..."
                />
              </div>
            </div>
          )}
          
          <div className="flex justify-between pt-4 mt-2 border-t border-gray-100">
            {step > 1 ? (
              <SecondaryButton type="button" onClick={prevStep}>
                السابق
              </SecondaryButton>
            ) : (
              <SecondaryButton type="button" onClick={handleCloseModal}>
                إلغاء
              </SecondaryButton>
            )}
            
            {step < 3 ? (
              <PrimaryButton type="button" onClick={nextStep}>
                التالي
              </PrimaryButton>
            ) : (
              <PrimaryButton type="submit">
                تأكيد وحفظ
              </PrimaryButton>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}