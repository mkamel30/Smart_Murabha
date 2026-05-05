import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '@/lib/toast';
import Layout from './Layout';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import CustomerDetail from '@/pages/CustomerDetail';
import Sales from '@/pages/Sales';
import SaleDetail from '@/pages/SaleDetail';
import Installments from '@/pages/Installments';
import Payments from '@/pages/Payments';
import FollowUps from '@/pages/FollowUps';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import ImportPage from '@/pages/Import';
import { ar } from '@/i18n/ar';
import { PrimaryButton } from '@/lib/Actions';
import { useNavigate } from 'react-router-dom';

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="text-6xl font-bold text-gray-300">404</div>
      <h2 className="text-xl font-bold text-gray-700">{ar.common.notFound}</h2>
      <p className="text-gray-500">{ar.common.notFoundMessage}</p>
      <PrimaryButton onClick={() => navigate('/dashboard')}>{ar.common.goHome}</PrimaryButton>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="sales" element={<Sales />} />
            <Route path="sales/:id" element={<SaleDetail />} />
            <Route path="installments" element={<Installments />} />
            <Route path="payments" element={<Payments />} />
            <Route path="followups" element={<FollowUps />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}