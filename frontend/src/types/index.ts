export interface Customer {
  id: string;
  bkCode: string;
  customerType: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  sales?: MachineSale[];
  followUps?: FollowUp[];
}

export interface MachineSale {
  id: string;
  receiptNumber: string;
  customerId: string;
  machineSerial: string;
  saleType: 'CASH' | 'INSTALLMENT';
  totalPrice: number;
  downPayment: number;
  downPaymentReceipt?: string;
  paidAmount: number;
  remainingAmount: number;
  paymentPlace?: string;
  notes?: string;
  saleDate: string;
  firstDueDate?: string;
  months?: number;
  status: 'ACTIVE' | 'VOIDED' | 'COMPLETED';
  voidReason?: string;
  voidedAt?: string;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  installments?: Installment[];
  payments?: Payment[];
}

export interface Installment {
  id: string;
  saleId: string;
  installmentNo: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  isPaid: boolean;
  isWaived: boolean;
  waiveReason?: string;
  paidDate?: string;
  receiptNumber?: string;
  createdAt: string;
  updatedAt: string;
  sale?: MachineSale;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  saleId: string;
  paymentType: 'CASH_SALE' | 'INSTALLMENT' | 'DOWN_PAYMENT' | 'REWARD';
  amount: number;
  paymentPlace?: string;
  notes?: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
  sale?: MachineSale;
}

export interface FollowUp {
  id: string;
  customerId: string;
  note: string;
  nextFollowUp?: string;
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
}

export interface DashboardStats {
  todayCollections: number;
  todayPaymentCount: number;
  overdueTotal: number;
  overdueCount: number;
  cashSalesTotal: number;
  installmentSalesTotal: number;
  totalSalesCount: number;
  totalPaidAll: number;
  totalRemainingAll: number;
  activeCustomers: number;
  recentPayments: Payment[];
  upcomingDue: Installment[];
  dueThisMonth: Installment[];
  dueThisMonthTotal: number;
}

export interface SalesReport {
  sales: MachineSale[];
  summary: {
    totalSales: number;
    cashSales: number;
    installmentSales: number;
    totalAmount: number;
    totalPaid: number;
    totalRemaining: number;
  };
}

export interface CollectionsReport {
  payments: Payment[];
  summary: {
    totalPayments: number;
    totalAmount: number;
    cashPayments: number;
    downPayments: number;
    installmentPayments: number;
  };
}

export interface OverdueReport {
  overdue: Installment[];
  summary: {
    totalOverdue: number;
    totalAmount: number;
    byCustomer: Record<string, { customer: Customer; count: number; amount: number }>;
  };
}

export interface CustomerStatement {
  customer: Customer;
  sales: MachineSale[];
  summary: {
    totalSales: number;
    totalPaid: number;
    totalRemaining: number;
    salesCount: number;
  };
}