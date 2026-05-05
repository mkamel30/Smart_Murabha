import { useEffect, useState, useMemo } from 'react';
import { paymentsApi, exportApi } from '@/api/client';
import { formatCurrency, formatDate, formatPaymentPlace } from '@/lib/utils';
import type { Payment } from '@/types';
import { ar } from '@/i18n/ar';
import { useToast } from '@/lib/toast';
import { LoadingScreen } from '@/lib/Spinner';
import { SecondaryButton, DangerButton, PageHeader, EmptyState, TableActions } from '@/lib/Actions';
import { SearchFilterBar } from '@/lib/SearchFilterBar';

type PaymentTypeFilter = '' | 'CASH_SALE' | 'DOWN_PAYMENT' | 'INSTALLMENT';

export default function Payments() {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PaymentTypeFilter>('');
  const [isVoiding, setIsVoiding] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'customer' | 'month'>('none');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const data = await paymentsApi.getAll();
      setPayments(data);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = useMemo(() => {
    let data = payments;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((p) =>
        p.sale?.customer?.name?.toLowerCase().includes(q) ||
        p.sale?.customer?.bkCode?.toLowerCase().includes(q) ||
        p.sale?.machineSerial?.toLowerCase().includes(q) ||
        p.receiptNumber?.toLowerCase().includes(q)
      );
    }
    if (typeFilter) data = data.filter((p) => p.paymentType === typeFilter);
    return data;
  }, [payments, search, typeFilter]);

  const stats = useMemo(() => {
    const totalCollected = filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const uniqueCustomers = new Set(filteredPayments.map(p => p.sale?.customerId).filter(Boolean)).size;
    return {
      totalAmount: Math.round(totalCollected),
      customerCount: uniqueCustomers,
      paymentCount: filteredPayments.length
    };
  }, [filteredPayments]);

  const handlePrintReceipt = async (paymentId: string) => {
    try {
      const html = await exportApi.receipt(paymentId);
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
      console.error('Failed to print receipt:', err);
    }
  };

  const handleVoid = async (paymentId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء هذه العملية؟ سيتم التراجع عن تحصيل المبالغ والأقساط المرتبطة بها.')) return;
    
    setIsVoiding(paymentId);
    try {
      await paymentsApi.void(paymentId);
      showToast('تم إلغاء الدفع وإعادة توزيع الأرصدة بنجاح', 'success');
      loadPayments();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'فشل إلغاء العملية', 'error');
    } finally {
      setIsVoiding(null);
    }
  };

  if (loading) {
    return <LoadingScreen message={ar.common.loading} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={ar.payments.title} />

      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={`${ar.common.search}...`}
        filters={[
          {
            key: 'type',
            value: typeFilter,
            onChange: (v) => setTypeFilter(v as PaymentTypeFilter),
            allLabel: ar.payments.paymentType,
            options: [
              { value: 'CASH_SALE', label: ar.payments.cashSale },
              { value: 'DOWN_PAYMENT', label: ar.payments.downPayment },
              { value: 'INSTALLMENT', label: ar.payments.installment },
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
            <div className="text-[10px] text-slate-500 font-bold mb-0.5">إجمالي المحصل</div>
            <div className="text-sm font-black text-emerald-600 font-mono leading-none">{formatCurrency(stats.totalAmount)}</div>
          </div>
          <div className="w-px h-8 bg-slate-200 my-auto"></div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 font-bold mb-0.5">عدد العملاء</div>
            <div className="text-sm font-black text-[#0A2472] leading-none">{stats.customerCount}</div>
          </div>
          <div className="w-px h-8 bg-slate-200 my-auto"></div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 font-bold mb-0.5">عدد العمليات</div>
            <div className="text-sm font-black text-slate-700 leading-none">{stats.paymentCount}</div>
          </div>
        </div>
      </div>

      {groupBy === 'none' ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.payments.receiptNumber}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.customers.title}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.payments.paymentType}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.payments.amount}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.payments.paymentPlace}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.payments.paidAt}</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.common.actions}</th>
              </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
               {filteredPayments.map((payment) => (
                 <tr key={payment.id} className="hover:bg-gray-50">
                   <td className="px-4 py-3 whitespace-nowrap font-mono text-sm">{payment.receiptNumber}</td>
                   <td className="px-4 py-3">{payment.sale?.customer?.name} ({payment.sale?.customer?.bkCode})</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className={`px-2 py-1 rounded text-xs font-medium w-fit ${payment.paymentType === 'CASH_SALE' ? 'bg-blue-50 text-blue-700' : payment.paymentType === 'DOWN_PAYMENT' ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'}`}>
                          {payment.paymentType === 'CASH_SALE' ? ar.payments.cashSale : payment.paymentType === 'DOWN_PAYMENT' ? ar.payments.downPayment : ar.payments.installment}
                        </span>
                        {payment.sale?.months && payment.sale?.saleType === 'INSTALLMENT' && (
                          <span className="text-[10px] text-slate-500 italic mt-0.5 px-1">على {payment.sale.months} شهر</span>
                        )}
                      </div>
                    </td>
                   <td className="px-4 py-3 font-bold text-teal-600">{formatCurrency(payment.amount)}</td>
                   <td className="px-4 py-3">{formatPaymentPlace(payment.paymentPlace)}</td>
                   <td className="px-4 py-3">{formatDate(payment.paidAt)}</td>
                   <td className="px-4 py-3">
                     <TableActions>
                       <SecondaryButton size="sm" onClick={() => handlePrintReceipt(payment.id)}>
                         {ar.payments.printReceipt}
                       </SecondaryButton>
                       <DangerButton 
                         size="sm" 
                         onClick={() => handleVoid(payment.id)}
                         disabled={isVoiding === payment.id}
                       >
                         {isVoiding === payment.id ? ar.common.loading : 'إلغاء'}
                       </DangerButton>
                     </TableActions>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
          </div>
          {filteredPayments.length === 0 && (
            <EmptyState message={ar.common.noData} />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(
            filteredPayments.reduce((groups: any, pay) => {
              const key = groupBy === 'customer' 
                ? `${pay.sale?.customer?.name || 'غير معروف'} (${pay.sale?.customer?.bkCode || '-'})`
                : new Date(pay.paidAt).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
              if (!groups[key]) groups[key] = { items: [], total: 0 };
              groups[key].items.push(pay);
              groups[key].total = Math.round((groups[key].total + Number(pay.amount || 0)) * 100) / 100;
              return groups;
            }, {})
          ).map(([groupName, group]: any) => (
            <div key={groupName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-emerald-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-bold text-emerald-800 text-sm">{groupName} ({group.items.length} تحصيل)</h3>
                  {groupBy === 'customer' && (() => {
                    const months = [...new Set(group.items.map((p: any) => p.sale?.months).filter(Boolean))];
                    if (months.length > 0) {
                      return (
                        <div className="flex gap-2">
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                            {months.length === 1 
                              ? `نظام تقسيط ${months[0]} شهر` 
                              : `أنظمة تقسيط: ${months.join('، ')} شهر`}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="font-bold text-emerald-700">إجمالي: {formatCurrency(group.total)}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-4 py-2 text-right text-xs text-slate-500">الإيصال</th>
                      {groupBy === 'month' && (
                        <th className="px-4 py-2 text-right text-xs text-slate-500">العميل / الماكينة</th>
                      )}
                      <th className="px-4 py-2 text-right text-xs text-slate-500">النوع</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500">المبلغ</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500">التاريخ</th>
                      <th className="px-4 py-2 text-center text-xs text-slate-500">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((pay: any) => (
                      <tr key={pay.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono">{pay.receiptNumber}</td>
                        {groupBy === 'month' && (
                          <td className="px-4 py-2">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-xs">{pay.sale?.customer?.name}</span>
                              <span className="text-[9px] text-slate-500 font-mono tracking-tight">{pay.sale?.machineSerial || '-'}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-2 text-xs">
                           {pay.paymentType === 'CASH_SALE' ? 'كامل' : pay.paymentType === 'DOWN_PAYMENT' ? 'مقدم' : 'قسط'}
                        </td>
                        <td className="px-4 py-2 font-bold text-emerald-600">{formatCurrency(pay.amount)}</td>
                        <td className="px-4 py-2 text-slate-500">{formatDate(pay.paidAt)}</td>
                        <td className="px-4 py-2">
                           <div className="flex justify-center gap-2">
                              <button onClick={() => handlePrintReceipt(pay.id)} className="text-blue-600 hover:text-blue-800 text-xs">طباعة</button>
                              <button 
                                onClick={() => handleVoid(pay.id)} 
                                disabled={isVoiding === pay.id}
                                className="text-red-600 hover:text-red-800 text-xs"
                              >
                                {isVoiding === pay.id ? '...' : 'إلغاء'}
                              </button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {filteredPayments.length === 0 && <EmptyState message={ar.common.noData} />}
        </div>
      )}
    </div>
  );
}