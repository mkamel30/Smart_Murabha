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
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ customerId: '', note: '', nextFollowUp: '' });

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
                  <td className="px-4 py-3">{fu.customer?.name} ({fu.customer?.bkCode})</td>
                  <td className="px-4 py-3">{fu.note}</td>
                  <td className="px-4 py-3">{fu.nextFollowUp ? formatDate(fu.nextFollowUp) : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${fu.isCompleted ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      {fu.isCompleted ? ar.followUps.completed : ar.followUps.pending}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TableActions>
                      {!fu.isCompleted && (
                        <SecondaryButton size="sm" onClick={() => handleComplete(fu.id)}>
                          {ar.followUps.complete}
                        </SecondaryButton>
                      )}
                      <DangerButton size="sm" onClick={() => handleDelete(fu.id)}>
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
    </div>
  );
}