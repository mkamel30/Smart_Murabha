import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersApi } from '@/api/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Customer } from '@/types';
import { ar } from '@/i18n/ar';
import { LoadingScreen } from '@/lib/Spinner';
import { SecondaryButton, PageHeader } from '@/lib/Actions';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadCustomer();
  }, [id]);

  const loadCustomer = async () => {
    try {
      const data = await customersApi.getById(id!);
      setCustomer(data);
    } catch (err) {
      console.error('Failed to load customer:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen message={ar.common.loading} />;
  }

  if (!customer) {
    return <div className="text-center py-8">{ar.common.noData}</div>;
  }

  const activeSales = customer.sales?.filter(s => s.status !== 'VOIDED') || [];
  const totalSales = activeSales.reduce((sum, s) => sum + Number(s.totalPrice), 0);
  const totalPaid = activeSales.reduce((sum, s) => sum + Number(s.paidAmount), 0);
  const totalRemaining = activeSales.reduce((sum, s) => sum + Number(s.remainingAmount), 0);

  return (
    <div className="space-y-4">
      <PageHeader title={customer.name} actions={
        <SecondaryButton onClick={() => navigate(-1)}>
          ← {ar.common.back}
        </SecondaryButton>
      } />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{ar.customers.customerDetails}</h2>
          <div className="space-y-3">
            <div><span className="text-gray-500">{ar.customers.bkCode}:</span> {customer.bkCode}</div>
            <div><span className="text-gray-500">{ar.customers.customerType}:</span> {customer.customerType}</div>
            <div><span className="text-gray-500">{ar.customers.phone}:</span> {customer.phone || '-'}</div>
            <div><span className="text-gray-500">{ar.customers.address}:</span> {customer.address || '-'}</div>
            <div><span className="text-gray-500">{ar.customers.notes}:</span> {customer.notes || '-'}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{ar.customers.totalSales}</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">{ar.sales.totalPrice}</span>
              <span className="font-bold">{formatCurrency(totalSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{ar.sales.paidAmount}</span>
              <span className="font-bold text-teal-600">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{ar.sales.remainingAmount}</span>
              <span className="font-bold text-orange-600">{formatCurrency(totalRemaining)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{ar.nav.sales}</h2>
        <div className="space-y-4">
          {customer.sales?.map((sale) => (
            <div key={sale.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{sale.receiptNumber}</div>
                  <div className="text-gray-500">{ar.sales.machineSerial}: {sale.machineSerial}</div>
                  <div className="text-gray-500">{ar.sales.saleType}: {sale.saleType === 'CASH' ? ar.sales.cash : ar.sales.installment}</div>
                  <div className="text-gray-500">{ar.sales.saleDate}: {formatDate(sale.saleDate)}</div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">{formatCurrency(sale.totalPrice)}</div>
                  <div className={`text-sm ${sale.status === 'ACTIVE' ? 'text-green-600' : sale.status === 'VOIDED' ? 'text-red-600' : 'text-gray-500'}`}>
                    {sale.status === 'ACTIVE' ? ar.sales.active : sale.status === 'VOIDED' ? ar.sales.voided : ar.sales.completed}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(!customer.sales || customer.sales.length === 0) && (
            <div className="text-gray-500 text-center py-4">{ar.common.noData}</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{ar.nav.followUps}</h2>
        <div className="space-y-3">
          {customer.followUps?.map((fu) => (
            <div key={fu.id} className="border-b pb-2">
              <div>{fu.note}</div>
              <div className="text-sm text-gray-500">
                {fu.nextFollowUp ? `${ar.followUps.nextFollowUp}: ${formatDate(fu.nextFollowUp)}` : ''}
                <span className={`mr-2 ${fu.isCompleted ? 'text-green-600' : 'text-orange-600'}`}>
                  {fu.isCompleted ? ar.followUps.completed : ar.followUps.pending}
                </span>
              </div>
            </div>
          ))}
          {(!customer.followUps || customer.followUps.length === 0) && (
            <div className="text-gray-500 text-center py-4">{ar.common.noData}</div>
          )}
        </div>
      </div>
    </div>
  );
}