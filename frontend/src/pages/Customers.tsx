import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '@/api/client';
import type { Customer } from '@/types';
import { ar } from '@/i18n/ar';
import { useToast } from '@/lib/toast';
import { LoadingScreen } from '@/lib/Spinner';
import { Modal } from '@/lib/Modal';
import { PrimaryButton, SecondaryButton, DangerButton, Toolbar, PageHeader, EmptyState, TableActions } from '@/lib/Actions';

export default function Customers() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ bkCode: '', customerType: 'عام', name: '', phone: '', address: '', notes: '' });
  const [error, setError] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const loadCustomers = useCallback(async (searchTerm?: string) => {
    try {
      const data = await customersApi.getAll(searchTerm || undefined);
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadCustomers(search);
    }, 300);
  }, [search, loadCustomers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingCustomer) {
        await customersApi.update(editingCustomer.id, formData);
        showToast(ar.common.success, 'success');
      } else {
        await customersApi.create(formData);
        showToast(ar.common.success, 'success');
      }
      setShowModal(false);
      setEditingCustomer(null);
      setFormData({ bkCode: '', customerType: 'عام', name: '', phone: '', address: '', notes: '' });
      loadCustomers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : ar.common.error);
      showToast(ar.common.error, 'error');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      bkCode: customer.bkCode,
      customerType: customer.customerType || 'عام',
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(ar.customers.deleteConfirm)) return;
    try {
      await customersApi.delete(id);
      loadCustomers();
      showToast(ar.common.deleted, 'success');
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || ar.common.error;
      showToast(message, 'error');
    }
  };

  const generateBkCode = async () => {
    try {
      const { bkCode } = await customersApi.generateBkCode();
      setFormData((prev) => ({ ...prev, bkCode }));
    } catch (err) {
      console.error('Failed to generate BK code:', err);
    }
  };

  if (loading) {
    return <LoadingScreen message={ar.common.loading} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader 
        title={ar.customers.title}
        actions={
          <PrimaryButton
            onClick={() => {
              setEditingCustomer(null);
              setFormData({ bkCode: '', customerType: 'عام', name: '', phone: '', address: '', notes: '' });
              setShowModal(true);
            }}
          >
            {ar.customers.addNew}
          </PrimaryButton>
        }
      />

      <Toolbar>
        <input
          type="text"
          placeholder={ar.customers.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
        />
      </Toolbar>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.customers.bkCode}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.customers.customerType}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.customers.name}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.customers.phone}</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.customers.address}</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">{ar.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-sm text-gray-700">{customer.bkCode}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                      customer.customerType === 'مخبز' ? 'bg-amber-100 text-amber-700' : 
                      customer.customerType === 'تموين' ? 'bg-blue-100 text-blue-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {customer.customerType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{customer.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{customer.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{customer.address || '-'}</td>
                  <td className="px-4 py-3">
                    <TableActions>
                      <SecondaryButton onClick={() => navigate(`/customers/${customer.id}`)}>
                        {ar.common.details}
                      </SecondaryButton>
                      <SecondaryButton onClick={() => handleEdit(customer)}>
                        {ar.common.edit}
                      </SecondaryButton>
                      <DangerButton onClick={() => handleDelete(customer.id)}>
                        {ar.common.delete}
                      </DangerButton>
                    </TableActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {customers.length === 0 && (
          <EmptyState message={ar.common.noData} />
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCustomer ? ar.common.edit : ar.customers.addNew}>
        {error && <div className="smart-alert smart-alert-error">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{ar.customers.bkCode}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.bkCode}
                  onChange={(e) => setFormData({ ...formData, bkCode: e.target.value })}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                  required
                />
                <SecondaryButton type="button" onClick={generateBkCode}>
                  {ar.common.add}
                </SecondaryButton>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{ar.customers.customerType}</label>
              <select
                value={formData.customerType}
                onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
                required
              >
                <option value="عام">عام</option>
                <option value="مخبز">مخبز</option>
                <option value="تموين">تموين</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.customers.name}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.customers.phone}</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.customers.address}</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{ar.customers.notes}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
              rows={3}
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