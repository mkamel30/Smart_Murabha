import { v4 as uuidv4 } from 'uuid';

export function generateReceiptNumber(prefix: string = 'RCP'): string {
  const uuidPart = uuidv4().split('-')[0].toUpperCase();
  const uuidPart2 = uuidv4().split('-')[1].toUpperCase();
  return `${prefix}-${uuidPart}-${uuidPart2}`;
}

export function generateBKCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `BK${timestamp}`;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function formatCurrency(amount: number, locale: string = 'ar-EG'): string {
  if (isNaN(amount) || !isFinite(amount)) return '٠';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string, locale: string = 'ar-EG'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function isOverdue(dueDate: Date | string): boolean {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}