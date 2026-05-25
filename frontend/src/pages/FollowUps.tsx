import { useEffect, useState, useMemo } from 'react';
import { followUpsApi, customersApi } from '@/api/client';
import { formatDate } from '@/lib/utils';
import type { FollowUp, Customer } from '@/types';
import { ar } from '@/i18n/ar';
import { useToast } from '@/lib/toast';
import { LoadingScreen } from '@/lib/Spinner';
import { Modal } from '@/lib/Modal';
import { PrimaryButton, SecondaryButton, DangerButton, PageHeader, EmptyState, TableActions } from '@/lib/Actions';
import { SearchFilterBar } from '@/lib/SearchFilterBar';
import { SmartSelect } from '@/lib/SmartSelect';

type FollowUpStatusFilter = '' | 'pending' | 'overdue' | 'completed';

export default function FollowUps() {
  const { showToast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FollowUpStatusFilter>('');
  const [formData, setFormData] = useState({ customerId: '', note: '', nextFollowUp: '' });
  const [showModal, setShowModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null);
  const [employeeName, setEmployeeName] = useState(() => localStorage.getItem('employeeName') || '');
  const [callStatus, setCallStatus] = useState('noAnswer');
  const [callNotes, setCallNotes] = useState('');
  const [nextCallDate, setNextCallDate] = useState('');
  const [closeTicket, setCloseTicket] = useState(false);

  const handleOpenLogs = (fu: FollowUp) => {
    setSelectedFollowUp(fu);
    setCloseTicket(fu.isCompleted);
    setNextCallDate(fu.nextFollowUp ? fu.nextFollowUp.split('T')[0] : '');
    setCallNotes('');
    setCallStatus('noAnswer');
    setShowLogsModal(true);
  };

  const handleAddCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowUp || !employeeName || !callNotes) {
      showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }

    // Save employee name to localStorage
    localStorage.setItem('employeeName', employeeName);

    try {
      const parsedLogs = selectedFollowUp.logs ? JSON.parse(selectedFollowUp.logs) : [];
      const newLog = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        employeeName,
        status: callStatus,
        notes: callNotes,
        calledAt: new Date().toISOString()
      };

      const updatedLogs = [...parsedLogs, newLog];

      await followUpsApi.update(selectedFollowUp.id, {
        logs: JSON.stringify(updatedLogs),
        nextFollowUp: nextCallDate || undefined,
      });

      if (closeTicket && !selectedFollowUp.isCompleted) {
        await followUpsApi.complete(selectedFollowUp.id);
      }

      showToast(ar.common.success, 'success');
      setShowLogsModal(false);
      loadData();
    } catch (err: any) {
      console.error('Failed to add call log:', err);
      showToast(ar.common.error, 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [followUpsData, customersData] = await Promise.all([
        followUpsApi.getAll(),
        customersApi.getAll(),
      ]);
      setFollowUps(followUpsData);
      setCustomers(customersData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredFollowUps = useMemo(() => {
    let data = followUps;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((fu) =>
        fu.customer?.name?.toLowerCase().includes(q) ||
        fu.customer?.bkCode?.toLowerCase().includes(q) ||
        fu.note?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      data = data.filter((fu) => {
        switch (statusFilter) {
          case 'pending': return !fu.isCompleted && fu.nextFollowUp && new Date(fu.nextFollowUp) >= new Date();
          case 'overdue': return !fu.isCompleted && fu.nextFollowUp && new Date(fu.nextFollowUp) < new Date();
          case 'completed': return fu.isCompleted;
          default: return true;
        }
      });
    }
    return data;
  }, [followUps, search, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await followUpsApi.create(formData);
      showToast(ar.common.success, 'success');
      setShowModal(false);
      setFormData({ customerId: '', note: '', nextFollowUp: '' });
      loadData();
    } catch (err: unknown) {
      showToast(ar.common.error, 'error');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await followUpsApi.complete(id);
      showToast(ar.common.success, 'success');
      loadData();
    } catch (err: unknown) {
      showToast(ar.common.error, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(ar.followUps.deleteConfirm)) return;
    try {
      await followUpsApi.delete(id);
      showToast(ar.common.deleted, 'success');
      loadData();
    } catch (err: unknown) {
      showToast(ar.common.error, 'error');
    }
  };

  if (loading) {
    return <LoadingScreen message={ar.common.loading} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader 
        title={ar.followUps.title}
        actions={
          <PrimaryButton onClick={() => setShowModal(true)}>
            {ar.followUps.addNew}
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
            onChange: (v) => setStatusFilter(v as FollowUpStatusFilter),
            allLabel: ar.followUps.all,
            options: [
              { value: 'pending', label: ar.followUps.pending },
              { value: 'overdue', label: ar.installments.overdue },
              { value: 'completed', label: ar.followUps.completed },
            ],
          },
        ]}
      />

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.customers.title}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.followUps.note}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.followUps.nextFollowUp}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.followUps.isCompleted}</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredFollowUps.map((fu) => (
                <tr key={fu.id} className={`hover:bg-gray-50 transition-colors ${!fu.isCompleted && fu.nextFollowUp && new Date(fu.nextFollowUp) < new Date() ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{fu.customer?.name} ({fu.customer?.bkCode})</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{fu.note}</span>
                      {(() => {
                        const logs = fu.logs ? JSON.parse(fu.logs) : [];
                        if (logs.length > 0) {
                          const latest = logs[logs.length - 1];
                          const statusLabel = 
                            latest.status === 'promisedToPay' ? 'تم الاتفاق على السداد' :
                            latest.status === 'noAnswer' ? 'لم يرد' :
                            latest.status === 'outOfCoverage' ? 'لا توجد تغطية' :
                            latest.status === 'wrongNumber' ? 'الرقم خطأ' :
                            'أخرى';
                          return (
                            <span className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              آخر اتصال بواسطة {latest.employeeName} ({statusLabel}): "{latest.notes}"
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{fu.nextFollowUp ? formatDate(fu.nextFollowUp) : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${fu.isCompleted ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      {fu.isCompleted ? ar.followUps.completed : ar.followUps.pending}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TableActions>
                      <SecondaryButton size="sm" onClick={() => handleOpenLogs(fu)} className="cursor-pointer">
                        سجل المكالمات ({fu.logs ? JSON.parse(fu.logs).length : 0})
                      </SecondaryButton>
                      {!fu.isCompleted && (
                        <SecondaryButton size="sm" onClick={() => handleComplete(fu.id)} className="cursor-pointer">
                          {ar.followUps.complete}
                        </SecondaryButton>
                      )}
                      <DangerButton size="sm" onClick={() => handleDelete(fu.id)} className="cursor-pointer">
                        {ar.common.delete}
                      </DangerButton>
                    </TableActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredFollowUps.length === 0 && (
          <EmptyState message={ar.common.noData} />
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={ar.followUps.addNew}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.sales.selectCustomer}</label>
            <SmartSelect
              options={customers.map((c) => ({ id: c.id, label: c.name, sublabel: c.bkCode }))}
              value={formData.customerId}
              onChange={(value) => setFormData({ ...formData, customerId: value })}
              placeholder={`-- ${ar.sales.selectCustomer} --`}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.followUps.note}</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
              required
              rows={4}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.followUps.nextFollowUp}</label>
            <input
              type="date"
              value={formData.nextFollowUp}
              onChange={(e) => setFormData({ ...formData, nextFollowUp: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
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

      {/* Call Logs Timeline & Recorder Modal */}
      {selectedFollowUp && (
        <Modal isOpen={showLogsModal} onClose={() => { setShowLogsModal(false); setSelectedFollowUp(null); }} title={`سجل المتابعة والاتصالات: ${selectedFollowUp.customer?.name}`}>
          <div className="space-y-6">
            
            {/* Call History Logs Timeline */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">سجل المكالمات السابقة</h4>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {(() => {
                  const logs = selectedFollowUp.logs ? JSON.parse(selectedFollowUp.logs) : [];
                  if (logs.length === 0) {
                    return <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">لا يوجد سجل مكالمات مسبقة لهذه المتابعة بعد.</div>;
                  }
                  return logs.map((log: any, idx: number) => (
                    <div key={log.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 relative text-xs animate-in fade-in duration-200">
                      <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
                        <span className="font-bold text-[#0A2472] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0A2472] shadow-sm"></span>
                          الموظف: {log.employeeName}
                        </span>
                        <span className="text-slate-400 font-mono">{new Date(log.calledAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-slate-400 font-semibold">حالة الاتصال:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'promisedToPay' ? 'bg-green-100 text-green-700' :
                          log.status === 'noAnswer' ? 'bg-yellow-100 text-yellow-800' :
                          log.status === 'outOfCoverage' ? 'bg-slate-200 text-slate-700' :
                          log.status === 'wrongNumber' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {log.status === 'promisedToPay' ? 'تم الاتفاق على السداد' :
                           log.status === 'noAnswer' ? 'لم يرد' :
                           log.status === 'outOfCoverage' ? 'لا يوجد تغطية / الهاتف مغلق' :
                           log.status === 'wrongNumber' ? 'الرقم خطأ' :
                           'أخرى'}
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium bg-white p-2.5 rounded-lg border border-slate-100 mt-1 leading-relaxed shadow-sm">
                        {log.notes}
                      </p>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Register New Call Log Form */}
            <form onSubmit={handleAddCallLog} className="border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">تسجيل اتصال جديد</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">اسم الموظف المتصل</label>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-[#0A2472] focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                    placeholder="مثال: أحمد"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">حالة الاتصال</label>
                  <select
                    value={callStatus}
                    onChange={(e) => setCallStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                  >
                    <option value="noAnswer">لم يرد</option>
                    <option value="outOfCoverage">لا توجد تغطية / مغلق</option>
                    <option value="promisedToPay">تم الاتفاق على السداد</option>
                    <option value="wrongNumber">الرقم خطأ</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">تفاصيل وملاحظات المكالمة</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                  rows={2}
                  placeholder="اكتب ما دار في المكالمة بالتفصيل..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">تاريخ المتابعة القادمة</label>
                  <input
                    type="date"
                    value={nextCallDate}
                    onChange={(e) => setNextCallDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2 mt-4 justify-end">
                  <input
                    type="checkbox"
                    id="closeTicketCheck"
                    checked={closeTicket}
                    onChange={(e) => setCloseTicket(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor="closeTicketCheck" className="text-xs font-bold text-emerald-700 select-none cursor-pointer">
                    إغلاق وتسويه تذكرة المتابعة
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100/50 mt-4">
                <SecondaryButton type="button" onClick={() => { setShowLogsModal(false); setSelectedFollowUp(null); }}>
                  إلغاء
                </SecondaryButton>
                <PrimaryButton type="submit">
                  تسجيل وحفظ الاتصال
                </PrimaryButton>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}