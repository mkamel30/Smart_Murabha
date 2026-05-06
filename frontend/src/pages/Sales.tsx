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
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || ar.common.error);
      showToast(ar.common.error, 'error');
    }
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
                    <span className="font-mono text-sm text-gray-700">{sale.receiptNumber}</span>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={ar.sales.addNew}>
        {error && <div className="smart-alert smart-alert-error">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
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
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
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
              <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.totalPrice}</label>
              <input
                type="number"
                value={formData.totalPrice || ''}
                onChange={(e) => setFormData({ ...formData, totalPrice: Number(e.target.value) })}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                required
                min="0"
              />
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
             <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">بيانات الدفعة الأولى</p>
                {formData.saleType === 'INSTALLMENT' && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">نظام Smart Murabha</span>
                )}
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ المدفوع فعلياً</label>
                  <input
                    type="number"
                    value={formData.actualPaidAmount || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      // Default DP to val (capped by 3000 only if empty, otherwise let user decide)
                      setFormData(prev => ({ 
                        ...prev, 
                        actualPaidAmount: val, 
                        downPayment: prev.downPayment === 0 || prev.downPayment === 3000 ? Math.min(val, 3000) : prev.downPayment 
                      }));
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-[#0A2472]"
                    placeholder="مثلاً 7530"
                  />
                  {formData.saleType === 'INSTALLMENT' && (
                    <p className="text-[9px] text-blue-600 mt-1 italic">المبلغ الذي يتجاوز "المقدم التعاقدي" سيتم توزيعه كأقساط مقدمة.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الحركة</label>
                  <input
                    type="date"
                    value={formData.lastDepositDate}
                    onChange={(e) => setFormData({ ...formData, lastDepositDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
                  />
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">رقم الإيصال</label>
                  <input
                    type="text"
                    value={formData.downPaymentReceipt}
                    onChange={(e) => setFormData({ ...formData, downPaymentReceipt: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]"
                    placeholder="رقم إيصال الدفع"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.downPayment} (التعاقدي)</label>
                  <input
                    type="number"
                    value={formData.downPayment || ''}
                    onChange={(e) => setFormData({ ...formData, downPayment: Number(e.target.value) })}
                    className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] font-bold text-teal-700`}
                    placeholder="3000"
                  />
                </div>
             </div>
          </div>

          {formData.saleType === 'INSTALLMENT' && (
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.months}</label>
                <input
                  type="number"
                  value={formData.months}
                  onChange={(e) => {
                    const months = Number(e.target.value);
                    setFormData({ ...formData, months });
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                  min="1"
                  max="120"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{ar.common.monthlyInstallment}</label>
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
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-bold text-[#0A2472] focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  min="0"
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.saleDate}</label>
                <input
                  type="date"
                  value={formData.saleDate}
                  onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">رقم الإيصال</label>
                <input
                  type="text"
                  value={formData.downPaymentReceipt}
                  onChange={(e) => setFormData({ ...formData, downPaymentReceipt: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                  placeholder={ar.common.receiptNumberPlaceholder}
                />
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.paymentPlace}</label>
              <PaymentPlaceSelect
                value={formData.paymentPlace}
                onChange={(value) => setFormData({ ...formData, paymentPlace: value })}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.notes}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
              rows={2}
              placeholder="أضف أي ملاحظات إضافية هنا..."
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton type="button" onClick={() => setShowModal(false)}>
              {ar.common.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit">
              {ar.common.save}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}