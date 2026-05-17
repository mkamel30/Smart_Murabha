import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { reportsApi, exportApi, customersApi } from '@/api/client';
import { formatCurrency, formatDate, downloadBlob } from '@/lib/utils';
import type { SalesReport, CollectionsReport, OverdueReport, Customer } from '@/types';
import { ar } from '@/i18n/ar';
import { LoadingScreen } from '@/lib/Spinner';
import { PageHeader, PrimaryButton, SecondaryButton } from '@/lib/Actions';
import { SmartSelect } from '@/lib/SmartSelect';
import { Banknote, Users } from 'lucide-react';

interface MonthClosingReport {
  month: { year: number; month: number; name: string };
  period: { start: string; end: string };
  sales: {
    cash: { count: number; amount: number };
    installment: { count: number; amount: number };
    total: { count: number; amount: number };
  };
  collections: {
    cashSale: { count: number; amount: number };
    downPayment: { count: number; amount: number };
    installment: { count: number; amount: number };
    total: { count: number; amount: number };
  };
  overdue: {
    count: number;
    amount: number;
    details: any[];
  };
  summary: {
    activeDebt: number;
    customerCount: number;
  };
}

export default function Reports() {
  const location = useLocation();
  const state = location.state as any;
  const [reportType, setReportType] = useState<'sales' | 'collections' | 'overdue' | 'monthClosing' | 'collectionRatio'>(
    state?.reportType || 'sales'
  );
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [collectionsReport, setCollectionsReport] = useState<CollectionsReport | null>(null);
  const [overdueReport, setOverdueReport] = useState<OverdueReport | null>(null);
  const [monthClosingReport, setMonthClosingReport] = useState<MonthClosingReport | null>(null);
  const [collectionRatioReport, setCollectionRatioReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Auto-set dates if currentMonth filter is requested
  const [startDate, setStartDate] = useState(() => {
    if (state?.filter === 'currentMonth') {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
    return '';
  });
  
  const [endDate, setEndDate] = useState(() => {
    if (state?.filter === 'currentMonth') {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }
    return '';
  });

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saleTypeFilter, setSaleTypeFilter] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('');
  const [paymentPlaceFilter, setPaymentPlaceFilter] = useState('');
  const [customerStatement, setCustomerStatement] = useState<{ customer: Customer; sales: any[]; summary: any } | null>(null);
  const [expandedSales, setExpandedSales] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'none' | 'customer' | 'month'>('none');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await customersApi.getAll();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'sales') {
        const data = await reportsApi.sales({ 
          startDate: startDate || undefined, 
          endDate: endDate || undefined,
          saleType: saleTypeFilter || undefined
        });
        setSalesReport(data);
      } else if (reportType === 'collections') {
        const data = await reportsApi.collections({ 
          startDate: startDate || undefined, 
          endDate: endDate || undefined,
          paymentType: paymentTypeFilter || undefined,
          paymentPlace: paymentPlaceFilter || undefined
        });
        setCollectionsReport(data);
      } else if (reportType === 'overdue') {
        const data = await reportsApi.overdue({ 
          startDate: startDate || undefined, 
          endDate: endDate || undefined 
        });
        setOverdueReport(data);
      } else if (reportType === 'monthClosing') {
        const data = await reportsApi.monthClosing({ month: String(selectedMonth), year: selectedYear });
        setMonthClosingReport(data);
      } else if (reportType === 'collectionRatio') {
        const data = await reportsApi.collectionRatio({ 
          startDate: startDate || undefined, 
          endDate: endDate || undefined 
        });
        setCollectionRatioReport(data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, startDate, endDate, selectedYear, selectedMonth, saleTypeFilter, paymentTypeFilter, paymentPlaceFilter]);

  const handleExport = async () => {
    try {
      let blob: Blob;
      let filename: string;
      if (reportType === 'sales') {
        blob = await exportApi.sales({ startDate: startDate || undefined, endDate: endDate || undefined });
        filename = `sales-report-${startDate || 'all'}-to-${endDate || 'now'}.xlsx`;
      } else if (reportType === 'collections') {
        blob = await exportApi.collections({ startDate: startDate || undefined, endDate: endDate || undefined });
        filename = `collections-report-${startDate || 'all'}-to-${endDate || 'now'}.xlsx`;
      } else if (reportType === 'overdue') {
        blob = await exportApi.overdue({ startDate: startDate || undefined, endDate: endDate || undefined });
        filename = `overdue-report-${startDate || 'all'}-to-${endDate || 'now'}.xlsx`;
      } else {
        return;
      }
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const handleOverdueExport = async () => {
    try {
      const blob = await exportApi.overdue();
      downloadBlob(blob, 'overdue-report.xlsx');
    } catch (err) {
      console.error('Failed to export overdue:', err);
    }
  };

  const loadCustomerStatement = async () => {
    if (!selectedCustomer) {
      setCustomerStatement(null);
      return;
    }
    try {
      const data = await reportsApi.statement(selectedCustomer);
      setCustomerStatement(data);
    } catch (err) {
      console.error('Failed to load customer statement:', err);
    }
  };

  useEffect(() => {
    loadCustomerStatement();
  }, [selectedCustomer]);

  if (loading) {
    return <LoadingScreen message={ar.common.loading} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={ar.reports.title} />

      {/* Report Type Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setReportType('sales')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            reportType === 'sales' ? 'bg-[#0A2472] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {ar.reports.salesReport}
        </button>
        <button
          onClick={() => setReportType('collections')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            reportType === 'collections' ? 'bg-[#0A2472] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {ar.reports.collectionsReport}
        </button>
        <button
          onClick={() => setReportType('overdue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            reportType === 'overdue' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {ar.reports.overdueReport}
        </button>
        <button
          onClick={() => setReportType('monthClosing')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            reportType === 'monthClosing' ? 'bg-[#0A2472] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          إقفال الشهر
        </button>
        <button
          onClick={() => setReportType('collectionRatio')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            reportType === 'collectionRatio' ? 'bg-[#0A2472] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          نسبة التحصيل
        </button>
      </div>

      {/* Month Closing Filter */}
      {reportType === 'monthClosing' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex gap-4 items-center flex-wrap">
          <div className="min-w-[120px]">
            <label className="block text-xs text-slate-500 mb-1">السنة</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px]">
            <label className="block text-xs text-slate-500 mb-1">الشهر</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
        </div>
      )}

      {/* Date Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex gap-4 items-center flex-wrap">
        {reportType !== 'monthClosing' && (
          <>
            <div className="min-w-[140px]">
              <label className="block text-xs text-slate-500 mb-1">{ar.reports.from}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs text-slate-500 mb-1">{ar.reports.to}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </>
        )}
        
        <SecondaryButton onClick={handleExport} className={reportType === 'monthClosing' ? '' : 'mt-5'}>
          {ar.reports.exportExcel}
        </SecondaryButton>
        
        {reportType === 'sales' && (
          <div className="min-w-[140px]">
            <label className="block text-xs text-slate-500 mb-1">{ar.sales.saleType}</label>
            <select
              value={saleTypeFilter}
              onChange={(e) => setSaleTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">{ar.common.all}</option>
              <option value="CASH">{ar.sales.cash}</option>
              <option value="INSTALLMENT">{ar.sales.installment}</option>
            </select>
          </div>
        )}
        
        {reportType === 'collections' && (
          <>
            <div className="min-w-[140px]">
              <label className="block text-xs text-slate-500 mb-1">{ar.payments.paymentType}</label>
              <select
                value={paymentTypeFilter}
                onChange={(e) => setPaymentTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">{ar.common.all}</option>
                <option value="CASH_SALE">{ar.payments.cashSale}</option>
                <option value="DOWN_PAYMENT">{ar.payments.downPayment}</option>
                <option value="INSTALLMENT">{ar.payments.installment}</option>
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs text-slate-500 mb-1">{ar.payments.paymentPlace}</label>
              <select
                value={paymentPlaceFilter}
                onChange={(e) => setPaymentPlaceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">{ar.common.all}</option>
                <option value="dhamen">ضامن</option>
                <option value="post">البريد</option>
                <option value="bank">البنك</option>
              </select>
            </div>
          </>
        )}

        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">تجميع حسب</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-blue-50/50"
          >
            <option value="none">بدون تجميع</option>
            <option value="customer">العميل</option>
            <option value="month">الشهر</option>
          </select>
        </div>
      </div>

      {/* Sales Report */}
      {reportType === 'sales' && salesReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.reports.totalSales}</div>
              <div className="text-xl font-bold">{salesReport.summary.totalSales} <span className="text-xs font-normal">عملية</span></div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.sales.cash}</div>
              <div className="text-xl font-bold text-blue-600">{salesReport.summary.cashSales} <span className="text-xs font-normal">عملية</span></div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.sales.installment}</div>
              <div className="text-xl font-bold text-purple-600">{salesReport.summary.installmentSales} <span className="text-xs font-normal">عملية</span></div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.sales.totalPrice}</div>
              <div className="text-xl font-bold">{formatCurrency(salesReport.summary.totalAmount)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.sales.paidAmount}</div>
              <div className="text-xl font-bold text-teal-600">{formatCurrency(salesReport.summary.totalPaid)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.sales.remainingAmount}</div>
              <div className="text-xl font-bold text-orange-600">{formatCurrency(salesReport.summary.totalRemaining)}</div>
            </div>
          </div>

          {groupBy === 'none' ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.sales.receiptNumber}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.customers.name}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">الإدارة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">رقم الماكينة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">النظام</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.sales.saleType}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.sales.totalPrice}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.sales.paidAmount}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.sales.remainingAmount}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.sales.saleDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesReport.sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-sm">{sale.receiptNumber}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{sale.customer?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{sale.customer?.bkCode}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{sale.customer?.department || '-'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{sale.machineSerial}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {sale.saleType === 'INSTALLMENT' ? `${sale.months} شهر` : '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs ${sale.saleType === 'CASH' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {sale.saleType === 'CASH' ? ar.sales.cash : ar.sales.installment}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-bold">{formatCurrency(sale.totalPrice)}</td>
                      <td className="px-4 py-2.5 text-teal-600">{formatCurrency(sale.paidAmount)}</td>
                      <td className="px-4 py-2.5 text-orange-600">{formatCurrency(sale.remainingAmount)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{formatDate(sale.saleDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(
              salesReport.sales.reduce((groups: any, sale) => {
                const key = groupBy === 'customer' 
                  ? (sale.customer?.name || 'غير معروف')
                  : new Date(sale.saleDate).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
                if (!groups[key]) groups[key] = { items: [], total: 0, paid: 0, remaining: 0 };
                groups[key].items.push(sale);
                groups[key].total = Math.round((groups[key].total + Number(sale.totalPrice || 0)) * 100) / 100;
                groups[key].paid = Math.round((groups[key].paid + Number(sale.paidAmount || 0)) * 100) / 100;
                groups[key].remaining = Math.round((groups[key].remaining + Number(sale.remainingAmount || 0)) * 100) / 100;
                return groups;
              }, {})
            ).map(([groupName, group]: any) => (
              <div key={groupName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-[#0A2472]">{groupName} ({group.items.length} عملية)</h3>
                  <div className="flex gap-4 text-xs">
                    <span className="font-semibold text-slate-600">إجمالي: {formatCurrency(group.total)}</span>
                    <span className="font-semibold text-teal-600">مدفوع: {formatCurrency(group.paid)}</span>
                    <span className="font-semibold text-orange-600">متبقي: {formatCurrency(group.remaining)}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">العقد</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">الماكينة</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">النوع</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">الإجمالي</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((sale: any) => (
                        <tr key={sale.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-mono">{sale.receiptNumber}</td>
                          <td className="px-4 py-2 font-mono text-xs">{sale.machineSerial}</td>
                          <td className="px-4 py-2 text-xs">{sale.saleType === 'INSTALLMENT' ? `${sale.months} شهر` : 'كاش'}</td>
                          <td className="px-4 py-2 font-bold">{formatCurrency(sale.totalPrice)}</td>
                          <td className="px-4 py-2 text-slate-500">{formatDate(sale.saleDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      )}

      {/* Collections Report */}
      {reportType === 'collections' && collectionsReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.reports.totalCollections}</div>
              <div className="text-xl font-bold text-teal-600">{formatCurrency(collectionsReport.summary.totalAmount)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.payments.cashSale}</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(collectionsReport.summary.cashPayments)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.payments.downPayment}</div>
              <div className="text-xl font-bold text-purple-600">{formatCurrency(collectionsReport.summary.downPayments)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.payments.installment}</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(collectionsReport.summary.installmentPayments)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.common.paymentCount}</div>
              <div className="text-xl font-bold">{collectionsReport.summary.totalPayments}</div>
            </div>
          </div>

          {groupBy === 'none' ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.payments.receiptNumber}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.customers.name}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">الإدارة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">رقم الماكينة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">النظام</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.payments.paymentType}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.payments.amount}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.payments.paidAt}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collectionsReport.payments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-sm">{pay.receiptNumber}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{pay.sale?.customer?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{pay.sale?.customer?.bkCode}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{pay.sale?.customer?.department || '-'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{pay.sale?.machineSerial}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {pay.sale?.saleType === 'INSTALLMENT' ? `${pay.sale?.months} شهر` : '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          pay.paymentType === 'CASH_SALE' ? 'bg-blue-50 text-blue-600' : 
                          pay.paymentType === 'DOWN_PAYMENT' ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'
                        }`}>
                          {pay.paymentType === 'CASH_SALE' ? ar.payments.cashSale : pay.paymentType === 'DOWN_PAYMENT' ? ar.payments.downPayment : ar.payments.installment}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-teal-600">{formatCurrency(pay.amount)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{formatDate(pay.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(
              collectionsReport.payments.reduce((groups: any, pay) => {
                const key = groupBy === 'customer' 
                  ? (pay.sale?.customer?.name || 'غير معروف')
                  : new Date(pay.paidAt).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
                if (!groups[key]) groups[key] = { items: [], total: 0 };
                groups[key].items.push(pay);
                groups[key].total = Math.round((groups[key].total + Number(pay.amount || 0)) * 100) / 100;
                return groups;
              }, {})
            ).map(([groupName, group]: any) => (
              <div key={groupName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-emerald-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-emerald-800">{groupName} ({group.items.length} تحصيل)</h3>
                  <div className="font-bold text-emerald-700">إجمالي: {formatCurrency(group.total)}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">الإيصال</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">النوع</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">المبلغ</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((pay: any) => (
                        <tr key={pay.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-mono">{pay.receiptNumber}</td>
                          <td className="px-4 py-2 text-xs">
                            {pay.paymentType === 'CASH_SALE' ? 'كامل' : pay.paymentType === 'DOWN_PAYMENT' ? 'مقدم' : 'قسط'}
                          </td>
                          <td className="px-4 py-2 font-bold text-emerald-600">{formatCurrency(pay.amount)}</td>
                          <td className="px-4 py-2 text-slate-500">{formatDate(pay.paidAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      )}

      {/* Overdue Report */}
      {reportType === 'overdue' && overdueReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.reports.totalOverdue}</div>
              <div className="text-xl font-bold text-red-600">{overdueReport.summary.totalOverdue}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{ar.reports.overdueAmount}</div>
              <div className="text-xl font-bold text-red-600">{formatCurrency(overdueReport.summary.totalAmount)}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <PrimaryButton onClick={handleOverdueExport}>
              {ar.reports.exportExcel}
            </PrimaryButton>
          </div>

          {groupBy === 'none' ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.customers.name}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">الإدارة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">رقم الماكينة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">النظام</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">رقم العقد</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.installments.installmentNo}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.installments.dueDate}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">{ar.installments.amount}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdueReport.overdue.map((inst) => (
                    <tr key={inst.id} className="bg-red-50/50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{inst.sale?.customer?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{inst.sale?.customer?.bkCode}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">{inst.sale?.customer?.department || '-'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{inst.sale?.machineSerial}</td>
                      <td className="px-4 py-2.5 text-xs">{inst.sale?.months} شهر</td>
                      <td className="px-4 py-2.5 font-mono text-sm">{inst.sale?.receiptNumber}</td>
                      <td className="px-4 py-2.5 font-bold">قسط {inst.installmentNo}</td>
                      <td className="px-4 py-2.5 text-red-600 font-medium">{formatDate(inst.dueDate)}</td>
                      <td className="px-4 py-2.5 font-bold">{formatCurrency(Number(inst.amount) - Number(inst.paidAmount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(
              overdueReport.overdue.reduce((groups: any, inst) => {
                const key = groupBy === 'customer' 
                  ? (inst.sale?.customer?.name || 'غير معروف')
                  : new Date(inst.dueDate).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
                if (!groups[key]) groups[key] = { items: [], total: 0 };
                groups[key].items.push(inst);
                const amt = Number(inst.amount || 0) - Number(inst.paidAmount || 0);
                groups[key].total = Math.round((groups[key].total + amt) * 100) / 100;
                return groups;
              }, {})
            ).map(([groupName, group]: any) => (
              <div key={groupName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
                <div className="bg-red-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-red-800">{groupName} ({group.items.length} قسط متأخر)</h3>
                  <div className="font-bold text-red-700">المبلغ المتأخر: {formatCurrency(group.total)}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">العميل</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">العقد</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">القسط</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">التاريخ</th>
                        <th className="px-4 py-2 text-right text-xs text-slate-500">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((inst: any) => (
                        <tr key={inst.id} className="hover:bg-red-50/50">
                          <td className="px-4 py-2">
                             <div className="font-medium text-[11px]">{inst.sale?.customer?.name}</div>
                             {inst.sale?.customer?.department && (
                               <div className="text-[9px] text-slate-400 font-semibold">{inst.sale?.customer?.department}</div>
                             )}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">{inst.sale?.receiptNumber}</td>
                          <td className="px-4 py-2">قسط {inst.installmentNo}</td>
                          <td className="px-4 py-2 text-red-600 font-medium">{formatDate(inst.dueDate)}</td>
                          <td className="px-4 py-2 font-bold">{formatCurrency(Number(inst.amount) - Number(inst.paidAmount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      )}

      {/* Collection Ratio Report */}
      {reportType === 'collectionRatio' && collectionRatioReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 col-span-2 md:col-span-4 flex flex-col items-center justify-center py-8">
              <div className="text-sm text-slate-500 font-bold mb-2">نسبة التحصيل الكلية (المحصل / المستحق)</div>
              <div className="text-4xl font-black text-[#0A2472]">{collectionRatioReport.ratio}%</div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-bold mb-1">إجمالي المستحق</div>
              <div className="text-xl font-bold text-red-600">{formatCurrency(collectionRatioReport.totalDue)}</div>
              <div className="text-xs text-slate-400 mt-1">{collectionRatioReport.dueInstallmentsCount} قسط مستحق</div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-bold mb-1">إجمالي المحصل من الأقساط</div>
              <div className="text-xl font-bold text-teal-600">{formatCurrency(collectionRatioReport.totalCollected)}</div>
              <div className="text-xs text-slate-400 mt-1">{collectionRatioReport.paymentsCount} عملية دفع</div>
            </div>
          </div>
        </div>
      )}

      {/* Month Closing Report */}
      {reportType === 'monthClosing' && monthClosingReport && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-[#0A2472] mb-2">
              تقرير إقفال الشهر - {monthClosingReport.month.name} {monthClosingReport.month.year}
            </h2>
            <p className="text-sm text-slate-500">
              الفترة: {formatDate(monthClosingReport.period.start)} - {formatDate(monthClosingReport.period.end)}
            </p>
          </div>

          {/* Sales Section */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="text-base font-semibold mb-3">المبيعات</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-600">مبيعات بدفعة كاملة</div>
                <div className="text-lg font-bold text-blue-700">{monthClosingReport.sales.cash.count} <span className="text-xs font-normal">عملية</span></div>
                <div className="text-sm text-blue-600 font-medium">{formatCurrency(monthClosingReport.sales.cash.amount)}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-xs text-purple-600">مبيعات أقساط</div>
                <div className="text-lg font-bold text-purple-700">{monthClosingReport.sales.installment.count} <span className="text-xs font-normal">عملية</span></div>
                <div className="text-sm text-purple-600 font-medium">{formatCurrency(monthClosingReport.sales.installment.amount)}</div>
              </div>
              <div className="bg-slate-100 rounded-lg p-3 col-span-2">
                <div className="text-xs text-slate-600">إجمالي المبيعات</div>
                <div className="text-xl font-bold text-slate-800">{monthClosingReport.sales.total.count} <span className="text-sm font-normal">عملية</span></div>
                <div className="text-sm text-slate-700 font-medium">{formatCurrency(monthClosingReport.sales.total.amount)}</div>
              </div>
            </div>
          </div>

          {/* Collections Section */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="text-base font-semibold mb-3">التحصيلات</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-600">تحصيل بدفعة كاملة</div>
                <div className="text-lg font-bold text-blue-700">{monthClosingReport.collections.cashSale.count} <span className="text-xs font-normal">عملية</span></div>
                <div className="text-sm text-blue-600 font-medium">{formatCurrency(monthClosingReport.collections.cashSale.amount)}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-xs text-purple-600">دفعة مقدمة</div>
                <div className="text-lg font-bold text-purple-700">{monthClosingReport.collections.downPayment.count} <span className="text-xs font-normal">عملية</span></div>
                <div className="text-sm text-purple-600 font-medium">{formatCurrency(monthClosingReport.collections.downPayment.amount)}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-green-600">تحصيل أقساط</div>
                <div className="text-lg font-bold text-green-700">{monthClosingReport.collections.installment.count} <span className="text-xs font-normal">عملية</span></div>
                <div className="text-sm text-green-600 font-medium">{formatCurrency(monthClosingReport.collections.installment.amount)}</div>
              </div>
              <div className="bg-teal-50 rounded-lg p-3">
                <div className="text-xs text-teal-600">إجمالي التحصيل</div>
                <div className="text-lg font-bold text-teal-700">{monthClosingReport.collections.total.count} <span className="text-xs font-normal">عملية</span></div>
                <div className="text-sm text-teal-600 font-medium">{formatCurrency(monthClosingReport.collections.total.amount)}</div>
              </div>
            </div>
          </div>

          {/* Overdue Section */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="text-base font-semibold mb-3">المتأخرين عن السداد</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-600">عدد الأقساط المتأخرة</div>
                <div className="text-xl font-bold text-red-700">{monthClosingReport.overdue.count}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-600">المبلغ المتأخر</div>
                <div className="text-xl font-bold text-red-700">{formatCurrency(Number(monthClosingReport.overdue.amount))}</div>
              </div>
            </div>
            {monthClosingReport.overdue.details.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full mt-3">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-3 py-2 text-right text-xs text-red-600">العميل</th>
                      <th className="px-3 py-2 text-right text-xs text-red-600">الماكينة/النظام</th>
                      <th className="px-3 py-2 text-right text-xs text-red-600">القسط</th>
                      <th className="px-3 py-2 text-right text-xs text-red-600">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {monthClosingReport.overdue.details.map((inst: any) => (
                      <tr key={inst.id} className="hover:bg-red-50/50">
                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium">{inst.sale?.customer?.name}</div>
                          <div className="text-[10px] text-red-400 font-mono">{inst.sale?.customer?.bkCode}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="font-mono">{inst.sale?.machineSerial}</div>
                          <div className="text-red-400">{inst.sale?.months} شهر</div>
                        </td>
                        <td className="px-3 py-2 text-sm">قسط {inst.installmentNo}</td>
                        <td className="px-3 py-2 text-sm font-bold text-red-600">{formatCurrency(Number(inst.amount) - Number(inst.paidAmount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Portfolio Snapshot Section */}
          <div className="bg-[#0A2472] rounded-lg shadow-sm p-6 text-white">
            <h3 className="text-base font-semibold mb-4 text-white/90">حالة المحفظة بنهاية الشهر</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl">
                  <Banknote size={24} />
                </div>
                <div>
                  <div className="text-sm text-white/70">إجمالي المديونية القائمة</div>
                  <div className="text-2xl font-bold">{formatCurrency(Number(monthClosingReport.summary.activeDebt))}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl">
                  <Users size={24} />
                </div>
                <div>
                  <div className="text-sm text-white/70">عدد العملاء الإجمالي</div>
                  <div className="text-2xl font-bold">{monthClosingReport.summary.customerCount} عميل</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Statement */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Users className="text-[#0A2472]" />
          {ar.reports.customerStatement}
        </h2>
        
        <div className="flex flex-wrap gap-4 mb-8 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs text-slate-500 mb-2">{ar.reports.selectCustomer}</label>
            <SmartSelect
              options={customers.map((c) => ({ id: c.id, label: c.name, sublabel: c.bkCode }))}
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              placeholder={`-- ${ar.reports.selectCustomer} --`}
              allowEmpty
              emptyLabel={`-- ${ar.reports.selectCustomer} --`}
            />
          </div>
          {selectedCustomer && (
            <PrimaryButton
              onClick={async () => {
                try {
                  const html = await exportApi.statement(selectedCustomer);
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
                  console.error('Failed to print statement:', err);
                }
              }}
            >
              {ar.reports.printStatement}
            </PrimaryButton>
          )}
        </div>

        {customerStatement && (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Account Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                <div className="text-xs text-slate-500 mb-1">{ar.sales.totalPrice}</div>
                <div className="text-xl font-bold">{formatCurrency(customerStatement.summary.totalSales)}</div>
              </div>
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="text-xs text-emerald-600 mb-1">{ar.sales.paidAmount}</div>
                <div className="text-xl font-bold text-emerald-700">{formatCurrency(customerStatement.summary.totalPaid)}</div>
              </div>
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                <div className="text-xs text-orange-600 mb-1">{ar.sales.remainingAmount}</div>
                <div className="text-xl font-bold text-orange-700">{formatCurrency(customerStatement.summary.totalRemaining)}</div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="text-xs text-blue-600 mb-1">عدد العمليات</div>
                <div className="text-xl font-bold text-blue-700">{customerStatement.summary.salesCount} عمليات</div>
              </div>
            </div>

            {/* Detailed Sales View */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-700 border-r-4 border-[#0A2472] pr-3">تفاصيل المعاملات</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-right">{ar.sales.receiptNumber}</th>
                      <th className="px-4 py-3 text-right">{ar.sales.saleDate}</th>
                      <th className="px-4 py-3 text-right">{ar.sales.totalPrice}</th>
                      <th className="px-4 py-3 text-right">{ar.sales.paidAmount}</th>
                      <th className="px-4 py-3 text-right">{ar.sales.remainingAmount}</th>
                      <th className="px-4 py-3 text-right">{ar.sales.status}</th>
                      <th className="px-4 py-3 text-center">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customerStatement.sales.map((sale) => (
                      <React.Fragment key={sale.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-[#0A2472]">{sale.receiptNumber}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(sale.saleDate)}</td>
                          <td className="px-4 py-3 font-bold">{formatCurrency(sale.totalPrice)}</td>
                          <td className="px-4 py-3 text-emerald-600 font-medium">{formatCurrency(sale.paidAmount)}</td>
                          <td className="px-4 py-3 text-orange-600 font-medium">{formatCurrency(sale.remainingAmount)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              sale.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                              sale.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {sale.status === 'ACTIVE' ? ar.sales.active : sale.status === 'COMPLETED' ? ar.sales.completed : ar.sales.voided}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              onClick={() => {
                                setExpandedSales(prev => 
                                  prev.includes(sale.id) ? prev.filter(id => id !== sale.id) : [...prev, sale.id]
                                )
                              }}
                              className="text-[#0A2472] hover:bg-blue-50 p-1 rounded-md transition-colors"
                            >
                              {expandedSales.includes(sale.id) ? 'إغلاق' : 'عرض الأقساط'}
                            </button>
                          </td>
                        </tr>
                        {expandedSales.includes(sale.id) && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-8 py-4">
                              <div className="animate-in slide-in-from-right-2 duration-200">
                                <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">تنفيذ الأقساط والمدفوعات</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Installments Table Mini */}
                                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-100/50 border-b border-slate-200">
                                        <tr>
                                          <th className="px-3 py-2 text-right">قسط</th>
                                          <th className="px-3 py-2 text-right">التاريخ</th>
                                          <th className="px-3 py-2 text-right">المبلغ</th>
                                          <th className="px-3 py-2 text-right">الحالة</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {sale.installments?.map((inst: any) => (
                                          <tr key={inst.id}>
                                            <td className="px-3 py-2">قسط {inst.installmentNo}</td>
                                            <td className="px-3 py-2">{formatDate(inst.dueDate)}</td>
                                            <td className="px-3 py-2 font-bold">{formatCurrency(inst.amount)}</td>
                                            <td className="px-3 py-2">
                                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${inst.isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {inst.isPaid ? 'مدفوع' : 'مستحق'}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  {/* Payments Table Mini */}
                                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                     <table className="w-full text-xs">
                                      <thead className="bg-slate-100/50 border-b border-slate-200">
                                        <tr>
                                          <th className="px-3 py-2 text-right">رقم الإيصال</th>
                                          <th className="px-3 py-2 text-right">تاريخ الدفع</th>
                                          <th className="px-3 py-2 text-right">المبلغ</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {sale.payments?.map((pay: any) => (
                                          <tr key={pay.id}>
                                            <td className="px-3 py-2 font-mono">{pay.receiptNumber}</td>
                                            <td className="px-3 py-2">{formatDate(pay.paidAt)}</td>
                                            <td className="px-3 py-2 text-emerald-600 font-bold">{formatCurrency(pay.amount)}</td>
                                          </tr>
                                        ))}
                                        {(!sale.payments || sale.payments.length === 0) && (
                                          <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">لا توجد مدفوعات مسجلة</td></tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}