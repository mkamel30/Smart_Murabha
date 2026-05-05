import { ar } from '../i18n/ar';

const paymentPlaceIcons: Record<string, string> = {
  dhamen: '👤',
  post: '📬',
  bank: '🏦',
};

export function formatPaymentPlace(place: string | null | undefined): string {
  if (!place) return '-';
  const labels: Record<string, string> = {
    dhamen: ar.payments.dhamen,
    post: ar.payments.post,
    bank: ar.payments.bank,
  };
  const icon = paymentPlaceIcons[place] || '';
  return icon ? `${icon} ${labels[place] || place}` : place;
}

export function formatCurrency(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) return '٠';
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function isOverdue(dueDate: string | Date): boolean {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : new Date(dueDate.getTime());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

export function isDueToday(dueDate: string | Date): boolean {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : new Date(dueDate.getTime());
  const today = new Date();
  return due.toDateString() === today.toDateString();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}