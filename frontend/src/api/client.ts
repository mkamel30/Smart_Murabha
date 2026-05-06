import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:3007/api';
  }
  return '/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_API_TOKEN || 'secure-token-123',
  },
});

export const healthApi = {
  check: () => api.get('/health').then(r => r.data),
};

export const customersApi = {
  getAll: (search?: string) => api.get('/customers', { params: { search } }).then(r => r.data),
  getById: (id: string) => api.get(`/customers/${id}`).then(r => r.data),
  create: (data: unknown) => api.post('/customers', data).then(r => r.data),
  update: (id: string, data: unknown) => api.put(`/customers/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/customers/${id}`).then(r => r.data),
  generateBkCode: () => api.get('/customers/generate-bkcode').then(r => r.data),
};

export const salesApi = {
  getAll: (search?: string) => api.get('/sales', { params: { search } }).then(r => r.data),
  getById: (id: string) => api.get(`/sales/${id}`).then(r => r.data),
  create: (data: unknown) => api.post('/sales', data).then(r => r.data),
  update: (id: string, data: unknown) => api.put(`/sales/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/sales/${id}`).then(r => r.data),
  void: (id: string, reason: string) => api.post(`/sales/${id}/void`, { reason }).then(r => r.data),
  pay: (saleId: string, data: unknown) => api.post(`/sales/${saleId}/pay`, data).then(r => r.data),
  previewPayment: (id: string, amount: number, installmentIds?: string[]) => api.post(`/sales/${id}/preview-payment`, { amount, installmentIds }).then(r => r.data),
};

export const installmentsApi = {
  getAll: (filters?: { isPaid?: boolean; saleId?: string }) => 
    api.get('/installments', { params: filters }).then(r => r.data),
  getBySale: (saleId: string) => api.get('/installments', { params: { saleId } }).then(r => r.data),
  pay: (id: string, data: { amount: number; receiptNumber?: string; paymentPlace?: string }) => 
    api.post(`/installments/${id}/pay`, data).then(r => r.data),
  update: (id: string, data: Partial<{ receiptNumber: string; paidDate: string | null; isPaid: boolean; paidAmount: number }>) => 
    api.patch(`/installments/${id}`, data).then(r => r.data),
  getOverdue: () => api.get('/installments/overdue').then(r => r.data),
};

export const rewardsApi = {
  waiveInstallments: (data: { saleId: string; installmentIds: string[]; reason?: string }) => 
    api.post('/rewards/waive-installments', data).then(r => r.data),
};

export const paymentsApi = {
  getAll: (filters?: { startDate?: string; endDate?: string }) => 
    api.get('/payments', { params: filters }).then(r => r.data),
  getById: (id: string) => api.get(`/payments/${id}`).then(r => r.data),
  void: (id: string) => api.post(`/payments/${id}/void`).then(r => r.data),
};

export const followupsApi = {
  getAll: (filters?: { customerId?: string; isCompleted?: boolean }) => 
    api.get('/followups', { params: filters }).then(r => r.data),
  create: (data: unknown) => api.post('/followups', data).then(r => r.data),
  update: (id: string, data: unknown) => api.put(`/followups/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/followups/${id}`).then(r => r.data),
  complete: (id: string) => api.post(`/followups/${id}/complete`).then(r => r.data),
};

export const followUpsApi = followupsApi;

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats').then(r => r.data),
};

export const reportsApi = {
  sales: (params: { startDate?: string; endDate?: string; saleType?: string }) => 
    api.get('/reports/sales', { params }).then(r => r.data),
  collections: (params: { startDate?: string; endDate?: string; paymentType?: string; paymentPlace?: string }) => 
    api.get('/reports/collections', { params }).then(r => r.data),
  overdue: (params: { startDate?: string; endDate?: string }) => 
    api.get('/reports/overdue', { params }).then(r => r.data),
  monthClosing: (params: { month: string; year: number | string }) => 
    api.get('/reports/month-closing', { params }).then(r => r.data),
  statement: (customerId: string, params?: { startDate?: string; endDate?: string }) => 
    api.get(`/reports/customer/${customerId}`, { params }).then(r => r.data),
};

export const exportApi = {
  sales: (params: { startDate?: string; endDate?: string }) => 
    api.get('/export/sales', { params, responseType: 'blob' }).then(r => r.data),
  collections: (params: { startDate?: string; endDate?: string }) => 
    api.get('/export/collections', { params, responseType: 'blob' }).then(r => r.data),
  overdue: (params: { startDate?: string; endDate?: string } = {}) => 
    api.get('/export/overdue', { params, responseType: 'blob' }).then(r => r.data),
  receipt: (paymentId: string) => 
    api.get(`/export/receipt/${paymentId}`).then(r => r.data),
  contract: (saleId: string) => 
    api.get(`/export/contract/${saleId}`).then(r => r.data),
  statement: (customerId: string) => 
    api.get(`/export/statement/${customerId}`).then(r => r.data),
};

export const backupApi = {
  export: () => api.get('/backup/export', { responseType: 'blob' }).then(r => r.data),
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/backup/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  auto: () => api.post('/backup/auto').then(r => r.data),
  list: () => api.get('/backup/list').then(r => r.data),
};

export const importApi = {
  uploadExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/excel', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  downloadTemplate: () => api.get('/import/template', { responseType: 'blob' }).then(r => r.data),
};

export const adminApi = {
  resetDatabase: (code: string) => api.post('/admin/database/reset', { code }).then(r => r.data),
};

export const branchApi = {
  getConfig: () => api.get('/branch/config').then(r => r.data),
  setConfig: (branchName: string) => api.put('/branch/config', { branchName }).then(r => r.data),
  exportMonthly: (month: number, year: number) =>
    api.get('/branch/export-monthly', { params: { month, year }, responseType: 'blob' }).then(r => r),
};

export default api;