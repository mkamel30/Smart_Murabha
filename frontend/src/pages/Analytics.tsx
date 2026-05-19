import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, Users, DollarSign, Calendar, AlertTriangle, Briefcase, Activity } from 'lucide-react';
import { analyticsApi } from '@/api/client';
import { formatCurrency } from '@/lib/utils';
import { LoadingScreen } from '@/lib/Spinner';

// Modern Color Palette
const COLORS = ['#0A2472', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#EC4899'];
const RISK_COLORS = ['#22C55E', '#F59E0B', '#EF4444'];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  // Default to current year up to now
  const [startDate, setStartDate] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await analyticsApi.getDashboardData({ startDate, endDate });
      setData(result);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <LoadingScreen message="جاري تحليل البيانات..." />;
  }

  if (!data) {
    return <div className="text-center p-10">فشل في تحميل التحليلات</div>;
  }

  const { kpi, paymentChannels, overdueRisk, cashFlowForecast, topDefaulters } = data;

  const collectionRate = kpi.expectedInstallments > 0 
    ? ((kpi.collectedInstallments / kpi.expectedInstallments) * 100).toFixed(1)
    : 0;

  // Custom tooltips for recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-lg text-sm">
          <p className="font-bold text-[#0A2472] mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="font-semibold">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getPlaceLabel = (place: string) => {
    const labels: Record<string, string> = { dhamen: 'ضامن', post: 'البريد', bank: 'البنك', branch: 'الفرع' };
    return labels[place] || place;
  };

  const formattedChannels = paymentChannels.map((p: any) => ({
    name: getPlaceLabel(p.place),
    value: p.total
  }));

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-[#0A2472]/10 rounded-xl text-[#0A2472]">
              <Activity className="w-6 h-6" />
            </div>
            لوحة التحليلات الذكية
          </h1>
          <p className="text-sm text-slate-500 mt-1 mr-14">مؤشرات الأداء المالي والتشغيلي للمبيعات والتحصيلات</p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <div className="flex items-center bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 ml-2" />
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm border-none focus:ring-0 bg-transparent text-slate-700 font-medium"
            />
          </div>
          <span className="text-slate-400 text-sm font-medium">إلى</span>
          <div className="flex items-center bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 ml-2" />
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border-none focus:ring-0 bg-transparent text-slate-700 font-medium"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="معدل التحصيل" 
          value={`${collectionRate}%`} 
          subtitle={`من ${formatCurrency(kpi.expectedInstallments)} مستحقة`}
          icon={<TrendingUp className="w-6 h-6 text-emerald-500" />}
          color="emerald"
        />
        <KPICard 
          title="التحصيلات الفعلية" 
          value={formatCurrency(kpi.totalCollected)} 
          subtitle={`مقدمات: ${formatCurrency(kpi.collectedDownPayments)} | أقساط: ${formatCurrency(kpi.collectedInstallments)}`}
          icon={<DollarSign className="w-6 h-6 text-blue-500" />}
          color="blue"
        />
        <KPICard 
          title="إجمالي المبيعات" 
          value={formatCurrency(kpi.totalSales)} 
          subtitle="في الفترة المحددة"
          icon={<Briefcase className="w-6 h-6 text-indigo-500" />}
          color="indigo"
        />
        <KPICard 
          title="مخاطر التعثر (>60 يوم)" 
          value={formatCurrency(overdueRisk.find((r:any) => r.name.includes('60'))?.value || 0)} 
          subtitle="ديون عالية المخاطر"
          icon={<AlertTriangle className="w-6 h-6 text-rose-500" />}
          color="rose"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cash Flow Forecast */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">التدفقات النقدية المتوقعة (6 أشهر)</h3>
              <p className="text-sm text-slate-500">بناءً على تواريخ استحقاق الأقساط النشطة غير المسددة</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowForecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A2472" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0A2472" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{fill: '#64748B', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(val) => `${val / 1000}k`} tick={{fill: '#64748B', fontSize: 12}} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" name="المتوقع تحصيله" dataKey="expected" stroke="#0A2472" strokeWidth={3} fillOpacity={1} fill="url(#colorCash)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Channels */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100/50">
          <h3 className="text-lg font-bold text-slate-900 mb-2">توزيع قنوات التحصيل</h3>
          <p className="text-sm text-slate-500 mb-6">حسب أماكن الدفع في الفترة المحددة</p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formattedChannels}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {formattedChannels.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Overdue Risk */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-rose-50 rounded-lg text-rose-500"><AlertTriangle className="w-5 h-5"/></div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">مخاطر أعمار الديون (Aging)</h3>
              <p className="text-sm text-slate-500">إجمالي الأقساط المتأخرة مقسمة حسب فترة التأخير</p>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overdueRisk} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tickFormatter={(val) => `${val / 1000}k`} tick={{fill: '#64748B'}} />
                <YAxis dataKey="name" type="category" tick={{fill: '#334155', fontWeight: 600}} width={90} />
                <RechartsTooltip formatter={(value: any) => formatCurrency(value)} />
                <Bar dataKey="value" name="المبلغ المتأخر" radius={[0, 6, 6, 0]} barSize={30}>
                  {overdueRisk.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={RISK_COLORS[index % RISK_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Defaulters Table */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-500"><Users className="w-5 h-5"/></div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">أعلى العملاء تعثراً</h3>
              <p className="text-sm text-slate-500">العملاء ذوي أكبر مبالغ متأخرة حالياً</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">كود العميل</th>
                  <th className="px-4 py-3">اسم العميل</th>
                  <th className="px-4 py-3 text-left">إجمالي المتأخرات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topDefaulters.map((def: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500">{def.bkCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{def.customerName}</td>
                    <td className="px-4 py-3 text-left font-bold text-rose-600">{formatCurrency(def.totalOverdue)}</td>
                  </tr>
                ))}
                {topDefaulters.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">لا يوجد عملاء متعثرين! 🎉</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// Reusable KPI Card Component
function KPICard({ title, value, subtitle, icon, color }: { title: string, value: string, subtitle: string, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-100',
    blue: 'bg-blue-50 border-blue-100',
    indigo: 'bg-indigo-50 border-indigo-100',
    rose: 'bg-rose-50 border-rose-100',
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100/50 flex flex-col hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h4 className="text-slate-500 font-bold text-sm">{title}</h4>
        <div className={`p-2.5 rounded-xl ${colorMap[color]} border`}>
          {icon}
        </div>
      </div>
      <div className="mt-auto">
        <div className="text-2xl font-black text-slate-900 tracking-tight">{value}</div>
        <div className="text-xs text-slate-400 mt-1.5 font-medium">{subtitle}</div>
      </div>
    </div>
  );
}
