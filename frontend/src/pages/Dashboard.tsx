import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/api/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { DashboardStats } from '@/types';
import { ar } from '@/i18n/ar';
import { LoadingScreen } from '@/lib/Spinner';
import { PrimaryButton, PageHeader } from '@/lib/Actions';
import {
  TrendingUp,
  AlertTriangle,
  Banknote,
  ShoppingCart,
  Users,
  CalendarCheck,
  CreditCard,
  Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

function StatCard({ icon: Icon, label, value, sub, colorClass, onClick }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  colorClass: string;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm min-w-0 transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-95' : ''}`}
    >
      <div className={`p-2 rounded-lg ${colorClass} shrink-0`}>
        <Icon size={18} className={colorClass.replace('bg-', 'text-').replace('/10', '/70').replace('/5', '/60')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 whitespace-nowrap">{label}</p>
        <p className="text-sm sm:text-base font-bold text-slate-800 whitespace-nowrap leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 whitespace-nowrap">{sub}</p>}
      </div>
    </div>
  );
}

function LoanStatCard({ icon: Icon, label, value, sub, bgColor, onClick }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  bgColor: string;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-2 p-3 rounded-xl ${bgColor} text-white min-w-0 shadow-sm transition-all ${onClick ? 'cursor-pointer hover:brightness-110 hover:shadow-md active:scale-95' : ''}`}
    >
      <div className="p-2 rounded-lg bg-white/20 shrink-0">
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/70 whitespace-nowrap">{label}</p>
        <p className="font-bold text-sm sm:text-base whitespace-nowrap leading-tight">{value}</p>
        {sub && <p className="text-xs text-white/60 whitespace-nowrap">{sub}</p>}
      </div>
    </div>
  );
}

const COLORS = ['#0A2472', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError(ar.common.errorLoading);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen message={ar.common.loading} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-red-500 text-lg font-bold">{error}</div>
        <PrimaryButton onClick={loadStats}>{ar.common.tryAgain}</PrimaryButton>
      </div>
    );
  }

  const s = stats!;

  // Charts data - ensure all values are numbers
  const cashTotal = Number(s.cashSalesTotal) || 0;
  const installmentTotal = Number(s.installmentSalesTotal) || 0;
  const paidTotal = Number(s.totalPaidAll) || 0;
  const remainingTotal = Number(s.totalRemainingAll) || 0;
  const dueThisMonthAmt = Number(s.dueThisMonthTotal) || 0;
  const overdueAmt = Number(s.overdueTotal) || 0;

  const salesPieData = [
    { name: 'دفعة كاملة', value: cashTotal },
    { name: 'أقساط', value: installmentTotal },
  ].filter(d => d.value > 0);

  const collectionsPieData = [
    { name: 'المدفوع', value: paidTotal },
    { name: 'المتبقي', value: remainingTotal },
  ];

  const overdueBarData = [
    { name: 'مستحق الشهر', amount: dueThisMonthAmt },
    { name: 'المتأخر', amount: overdueAmt },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={ar.dashboard.title} />

      {/* Summary Cards Row - Large */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LoanStatCard
          icon={TrendingUp}
          label={ar.dashboard.todayCollections}
          value={formatCurrency(Number(s.todayCollections))}
          sub={`${s.todayPaymentCount} عملية`}
          bgColor="bg-[#0A2472]"
          onClick={() => navigate('/payments')}
        />
        <LoanStatCard
          icon={AlertTriangle}
          label={ar.dashboard.overdueTotal}
          value={formatCurrency(Number(s.overdueTotal))}
          sub={`${s.overdueCount} قسط متأخر`}
          bgColor="bg-red-600"
          onClick={() => navigate('/reports', { state: { reportType: 'overdue' } })}
        />
        <LoanStatCard
          icon={CalendarCheck}
          label={ar.dashboard.dueThisMonth}
          value={formatCurrency(Number(s.dueThisMonthTotal))}
          sub={`${s.dueThisMonth.length} قسط`}
          bgColor="bg-amber-600"
          onClick={() => navigate('/reports', { state: { reportType: 'overdue', filter: 'currentMonth' } })}
        />
        <LoanStatCard
          icon={Banknote}
          label={ar.dashboard.totalRemaining}
          value={formatCurrency(Number(s.totalRemainingAll))}
          sub={`${s.totalSalesCount} عملية`}
          bgColor="bg-[#1e3a8a]"
          onClick={() => navigate('/sales', { state: { filter: 'active' } })}
        />
      </div>

      {/* Secondary Stats - Minimal Icons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={ShoppingCart}
          label={ar.dashboard.cashSales}
          value={formatCurrency(Number(s.cashSalesTotal))}
          colorClass="bg-blue-50 text-blue-600"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          icon={CreditCard}
          label={ar.dashboard.installmentSales}
          value={formatCurrency(Number(s.installmentSalesTotal))}
          colorClass="bg-purple-50 text-purple-600"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          icon={Banknote}
          label={ar.dashboard.totalPaid}
          value={formatCurrency(Number(s.totalPaidAll))}
          colorClass="bg-emerald-50 text-emerald-600"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          icon={ShoppingCart}
          label={ar.dashboard.totalSales}
          value={String(s.totalSalesCount)}
          colorClass="bg-slate-50 text-slate-600"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          icon={Users}
          label={ar.dashboard.activeCustomers}
          value={String(s.activeCustomers)}
          colorClass="bg-teal-50 text-teal-600"
          onClick={() => navigate('/customers')}
        />
        <StatCard
          icon={Calendar}
          label={ar.dashboard.dueThisMonth}
          value={String(s.dueThisMonth.length)}
          sub={formatCurrency(Number(s.dueThisMonthTotal))}
          colorClass="bg-orange-50 text-orange-600"
          onClick={() => navigate('/followups')}
        />
      </div>

      {/* Charts Row - Now at bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">المبيعات</h3>
          <div className="h-64 min-h-[256px]">
            {salesPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {salesPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                {ar.common.noData}
              </div>
            )}
          </div>
        </div>

        {/* Collections vs Remaining */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">المحفظة</h3>
          <div className="h-64 min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={collectionsPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {collectionsPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bar Chart - Overdue vs Due */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">الأقساط</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overdueBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="amount" fill="#0A2472" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-sm font-bold text-[#0A2472]">{ar.dashboard.recentPayments}</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {s.recentPayments?.slice(0, 5).map((payment) => (
              <div 
                key={payment.id} 
                onClick={() => navigate(`/sales/${payment.saleId}`)}
                className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 truncate text-sm">
                    {payment.sale?.customer?.name} ({payment.sale?.customer?.bkCode})
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{payment.receiptNumber}</div>
                </div>
                <div className="text-left mr-3 shrink-0">
                  <div className="font-bold text-emerald-600 text-sm">{formatCurrency(payment.amount)}</div>
                  <div className="text-xs text-slate-400">{formatDate(payment.paidAt)}</div>
                </div>
              </div>
            ))}
            {(!s.recentPayments || s.recentPayments.length === 0) && (
              <div className="text-slate-400 text-center py-6 text-sm">{ar.common.noData}</div>
            )}
          </div>
        </div>

        {/* Upcoming Due */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-sm font-bold text-[#0A2472]">{ar.dashboard.upcomingDue}</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {s.upcomingDue?.slice(0, 5).map((inst) => (
              <div 
                key={inst.id} 
                onClick={() => navigate(`/customers/${inst.sale?.customerId}`)}
                className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 truncate text-sm">
                    {inst.sale?.customer?.name} ({inst.sale?.customer?.bkCode})
                  </div>
                  <div className="text-xs text-slate-400">قسط {inst.installmentNo}</div>
                </div>
                <div className="text-left mr-3 shrink-0">
                  <div className="font-bold text-amber-600 text-sm">{formatCurrency(inst.amount)}</div>
                  <div className="text-xs text-slate-400">{formatDate(inst.dueDate)}</div>
                </div>
              </div>
            ))}
            {(!s.upcomingDue || s.upcomingDue.length === 0) && (
              <div className="text-slate-400 text-center py-6 text-sm">{ar.common.noData}</div>
            )}
          </div>
        </div>
      </div>

      {/* Due This Month Table */}
      {s.dueThisMonth && s.dueThisMonth.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-sm font-bold text-[#0A2472]">الأقساط المستحقة هذا الشهر</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-slate-500">العميل</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-slate-500">القسط</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500">المبلغ</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-slate-500">تاريخ الاستحقاق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {s.dueThisMonth.slice(0, 8).map((inst) => (
                  <tr 
                    key={inst.id} 
                    onClick={() => navigate(`/customers/${inst.sale?.customerId}`)}
                    className="hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-2.5 text-sm font-medium text-slate-800">
                      {inst.sale?.customer?.name} ({inst.sale?.customer?.bkCode})
                    </td>
                    <td className="px-5 py-2.5 text-sm text-slate-600">{inst.installmentNo}</td>
                    <td className="px-5 py-2.5 text-sm font-bold text-amber-600">{formatCurrency(Number(inst.amount) - Number(inst.paidAmount))}</td>
                    <td className="px-5 py-2.5 text-sm text-slate-500">{formatDate(inst.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}