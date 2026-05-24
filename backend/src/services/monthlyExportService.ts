import prisma from '../lib/prisma.js'; // Prisma client for database access
import crypto from 'crypto';
import type { Customer } from '@prisma/client';
import { BranchConfigService } from './branchConfigService.js';

export interface MonthlyExportJson {
  meta: {
    version: string;
    branchId: string;
    branchName: string;
    reportMonth: number;
    reportYear: number;
    generatedAt: string;
    dataHash: string;
  };
  summary: {
    activeContracts: number;
    totalContractValue: number;
    totalPaidAllTime: number;
    totalRemainingAllTime: number;
    dueThisMonth: { count: number; amount: number };
    paidThisMonth: { count: number; amount: number };
    overdueTotal: { count: number; amount: number };
    newSalesThisMonth: {
      cashCount: number;
      cashAmount: number;
      installmentCount: number;
      installmentAmount: number;
    };
    collectionsThisMonth: {
      downPayments: { count: number; amount: number };
      installments: { count: number; amount: number };
      cashSales: { count: number; amount: number };
    };
  };
  details: {
    dueInstallments: DueInstallmentDetail[];
    paymentsThisMonth: PaymentDetail[];
    overdueInstallments: OverdueInstallmentDetail[];
    customerSummary: CustomerSummaryDetail[];
  };
}

interface DueInstallmentDetail {
  customerName: string;
  customerCode: string;
  customerType: string;
  receiptNumber: string;
  machineSerial: string;
  installmentNo: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  isPaid: boolean;
}

interface PaymentDetail {
  receiptNumber: string;
  customerName: string;
  customerCode: string;
  customerType: string;
  machineSerial: string;
  amount: number;
  paymentType: string;
  paymentPlace: string | null;
  paidAt: string;
}

interface OverdueInstallmentDetail {
  customerName: string;
  customerCode: string;
  customerType: string;
  receiptNumber: string;
  machineSerial: string;
  installmentNo: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  daysOverdue: number;
}

interface CustomerSummaryDetail {
  customerCode: string;
  customerType: string;
  customerName: string;
  phone: string | null;
  activeSales: number;
  totalContractValue: number;
  totalPaid: number;
  totalRemaining: number;
  dueThisMonth: number;
  paidThisMonth: number;
  overdueCount: number;
  overdueAmount: number;
  downPayment?: number;
  totalInstallments?: number;
  installmentAmount?: number;
  installmentSystem?: string;
}

export class MonthlyExportService {
  private branchConfig = new BranchConfigService();

  async generateMonthlyReport(year: number, month: number): Promise<MonthlyExportJson> {
    const config = this.branchConfig.getConfig();

    if (!config.branchName) {
      throw new Error('يجب إدخال اسم الفرع في الإعدادات أولاً');
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ---- Fetch all needed data in parallel ----
    const [
      activeSales,
      dueInstallments,
      paymentsInMonth,
      overdueInstallments,
      salesInMonth,
    ] = await Promise.all([
      // All active/completed sales (for totals)
      prisma.machineSale.findMany({
        where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
        include: { customer: true, installments: true },
      }),
      // Installments due this month
      prisma.installment.findMany({
        where: {
          dueDate: { gte: startOfMonth, lte: endOfMonth },
          sale: { status: 'ACTIVE' },
        },
        include: { sale: { include: { customer: true } } },
      }),
      // Payments made this month
      prisma.payment.findMany({
        where: {
          paidAt: { gte: startOfMonth, lte: endOfMonth },
          sale: { status: { not: 'VOIDED' } },
        },
        include: { sale: { include: { customer: true } } },
      }),
      // Overdue installments (due before today, not paid)
      prisma.installment.findMany({
        where: {
          isPaid: false,
          dueDate: { lt: today },
          sale: { status: 'ACTIVE' },
        },
        include: { sale: { include: { customer: true } } },
      }),
      // New sales this month
      prisma.machineSale.findMany({
        where: {
          saleDate: { gte: startOfMonth, lte: endOfMonth },
          status: { not: 'VOIDED' },
        },
        include: { customer: true },
      }),
    ]);

    // ---- Build Summary ----
    const totalContractValue = activeSales.reduce((sum, s) => sum + Number(s.totalPrice), 0);
    const totalPaidAllTime = activeSales.reduce((sum, s) => sum + Number(s.paidAmount), 0);
    const totalRemainingAllTime = activeSales.reduce((sum, s) => sum + Number(s.remainingAmount), 0);

    const dueThisMonthAmount = dueInstallments.reduce((sum, inst) => sum + Number(inst.amount) - Number(inst.paidAmount), 0);
    const paidThisMonthInstallments = paymentsInMonth.filter(p => p.paymentType === 'INSTALLMENT');
    const paidThisMonthDownPayments = paymentsInMonth.filter(p => p.paymentType === 'DOWN_PAYMENT');
    const paidThisMonthCashSales = paymentsInMonth.filter(p => p.paymentType === 'CASH_SALE');

    const overdueAmount = overdueInstallments.reduce((sum, inst) => sum + Number(inst.amount) - Number(inst.paidAmount), 0);

    const cashSalesInMonth = salesInMonth.filter(s => s.saleType === 'CASH');
    const installmentSalesInMonth = salesInMonth.filter(s => s.saleType === 'INSTALLMENT');

    const summary = {
      activeContracts: activeSales.filter(s => s.status === 'ACTIVE').length,
      totalContractValue: Math.round(totalContractValue),
      totalPaidAllTime: Math.round(totalPaidAllTime),
      totalRemainingAllTime: Math.round(totalRemainingAllTime),
      dueThisMonth: {
        count: dueInstallments.length,
        amount: Math.round(dueThisMonthAmount),
      },
      paidThisMonth: {
        count: paymentsInMonth.length,
        amount: Math.round(paymentsInMonth.reduce((sum, p) => sum + Number(p.amount), 0)),
      },
      overdueTotal: {
        count: overdueInstallments.length,
        amount: Math.round(overdueAmount),
      },
      newSalesThisMonth: {
        cashCount: cashSalesInMonth.length,
        cashAmount: Math.round(cashSalesInMonth.reduce((sum, s) => sum + Number(s.totalPrice), 0)),
        installmentCount: installmentSalesInMonth.length,
        installmentAmount: Math.round(installmentSalesInMonth.reduce((sum, s) => sum + Number(s.totalPrice), 0)),
      },
      collectionsThisMonth: {
        downPayments: {
          count: paidThisMonthDownPayments.length,
          amount: Math.round(paidThisMonthDownPayments.reduce((sum, p) => sum + Number(p.amount), 0)),
        },
        installments: {
          count: paidThisMonthInstallments.length,
          amount: Math.round(paidThisMonthInstallments.reduce((sum, p) => sum + Number(p.amount), 0)),
        },
        cashSales: {
          count: paidThisMonthCashSales.length,
          amount: Math.round(paidThisMonthCashSales.reduce((sum, p) => sum + Number(p.amount), 0)),
        },
      },
    };

    // ---- Build Details ----
    const dueInstallmentDetails: DueInstallmentDetail[] = dueInstallments.map(inst => ({
      customerName: inst.sale.customer.name,
      customerCode: inst.sale.customer.bkCode,
      customerType: inst.sale.customer.customerType,
      receiptNumber: inst.sale.receiptNumber,
      machineSerial: inst.sale.machineSerial,
      installmentNo: inst.installmentNo,
      totalInstallments: inst.sale.months || 0,
      dueDate: inst.dueDate.toISOString(),
      amount: Math.round(Number(inst.amount)),
      paidAmount: Math.round(Number(inst.paidAmount)),
      isPaid: inst.isPaid,
    }));

    const paymentDetails: PaymentDetail[] = paymentsInMonth.map(p => ({
      receiptNumber: p.receiptNumber,
      customerName: p.sale.customer.name,
      customerCode: p.sale.customer.bkCode,
      customerType: p.sale.customer.customerType,
      machineSerial: p.sale.machineSerial,
      amount: Math.round(Number(p.amount)),
      paymentType: p.paymentType,
      paymentPlace: p.paymentPlace,
      paidAt: p.paidAt.toISOString(),
    }));

    const overdueDetails: OverdueInstallmentDetail[] = overdueInstallments.map(inst => {
      const daysOverdue = Math.floor((today.getTime() - inst.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        customerName: inst.sale.customer.name,
        customerCode: inst.sale.customer.bkCode,
        customerType: inst.sale.customer.customerType,
        receiptNumber: inst.sale.receiptNumber,
        machineSerial: inst.sale.machineSerial,
        installmentNo: inst.installmentNo,
        totalInstallments: inst.sale.months || 0,
        dueDate: inst.dueDate.toISOString(),
        amount: Math.round(Number(inst.amount)),
        paidAmount: Math.round(Number(inst.paidAmount)),
        remaining: Math.round(Number(inst.amount) - Number(inst.paidAmount)),
        daysOverdue,
      };
    });

    // Customer summary: group by customer across all active sales
    const customerMap = new Map<string, CustomerSummaryDetail & {
      tempSales?: Array<{
        downPayment: number;
        totalInstallments: number;
        installmentAmount: number;
      }>;
    }>();
    for (const sale of activeSales) {
      const cid = sale.customerId;
      if (!customerMap.has(cid)) {
        customerMap.set(cid, {
          customerCode: sale.customer.bkCode,
          customerType: sale.customer.customerType,
          customerName: sale.customer.name,
          phone: sale.customer.phone,
          activeSales: 0,
          totalContractValue: 0,
          totalPaid: 0,
          totalRemaining: 0,
          dueThisMonth: 0,
          paidThisMonth: 0,
          overdueCount: 0,
          overdueAmount: 0,
          tempSales: [],
        });
      }
      const cs = customerMap.get(cid)!;
      cs.activeSales++;
      cs.totalContractValue += Math.round(Number(sale.totalPrice));
      cs.totalPaid += Math.round(Number(sale.paidAmount));
      cs.totalRemaining += Math.round(Number(sale.remainingAmount));

      const dp = Math.round(Number(sale.downPayment));
      const totalInstallments = sale.months || 0;
      const installmentAmount = sale.installments.length > 0 ? Math.round(Number(sale.installments[0].amount)) : 0;
      if (cs.tempSales) {
        cs.tempSales.push({ downPayment: dp, totalInstallments, installmentAmount });
      }
    }

    // Add due/paid/overdue info per customer
    for (const inst of dueInstallments) {
      const cs = customerMap.get(inst.sale.customerId);
      if (cs) {
        cs.dueThisMonth += Math.round(Number(inst.amount) - Number(inst.paidAmount));
      }
    }
    for (const p of paymentsInMonth) {
      const cs = customerMap.get(p.sale.customerId);
      if (cs) {
        cs.paidThisMonth += Math.round(Number(p.amount));
      }
    }
    for (const inst of overdueInstallments) {
      const cs = customerMap.get(inst.sale.customerId);
      if (cs) {
        cs.overdueCount++;
        cs.overdueAmount += Math.round(Number(inst.amount) - Number(inst.paidAmount));
      }
    }

    // Process systems and clean up tempSales
    for (const cs of customerMap.values()) {
      if (cs.tempSales && cs.tempSales.length > 0) {
        const totalDP = cs.tempSales.reduce((sum, s) => sum + s.downPayment, 0);
        cs.downPayment = totalDP;
        
        if (cs.tempSales.length === 1) {
          const s = cs.tempSales[0];
          cs.totalInstallments = s.totalInstallments;
          cs.installmentAmount = s.installmentAmount;
          if (s.totalInstallments > 0) {
            cs.installmentSystem = `نظام ${s.totalInstallments} أشهر (${s.installmentAmount.toLocaleString('en-US')} ج.م شهرياً)`;
          } else {
            cs.installmentSystem = 'كاش';
          }
        } else {
          const first = cs.tempSales[0];
          const allSameDuration = cs.tempSales.every(s => s.totalInstallments === first.totalInstallments);
          if (allSameDuration && first.totalInstallments > 0) {
            const sumInstAmt = cs.tempSales.reduce((sum, s) => sum + s.installmentAmount, 0);
            cs.totalInstallments = first.totalInstallments;
            cs.installmentAmount = sumInstAmt;
            cs.installmentSystem = `نظام ${first.totalInstallments} أشهر (${sumInstAmt.toLocaleString('en-US')} ج.م شهرياً لـ ${cs.tempSales.length} عقود)`;
          } else {
            cs.totalInstallments = Math.round(cs.tempSales.reduce((sum, s) => sum + s.totalInstallments, 0) / cs.tempSales.length);
            cs.installmentAmount = cs.tempSales.reduce((sum, s) => sum + s.installmentAmount, 0);
            cs.installmentSystem = `${cs.tempSales.length} عقود بأنظمة مختلفة (مجموع الأقساط: ${cs.installmentAmount.toLocaleString('en-US')} ج.م)`;
          }
        }
      }
      delete cs.tempSales;
    }

    const customerSummary = Array.from(customerMap.values())
      .sort((a, b) => b.overdueAmount - a.overdueAmount);

    const details = {
      dueInstallments: dueInstallmentDetails,
      paymentsThisMonth: paymentDetails,
      overdueInstallments: overdueDetails,
      customerSummary,
    };

    // ---- Assemble report ----
    const reportData: Omit<MonthlyExportJson, 'meta'> & { meta: Omit<MonthlyExportJson['meta'], 'dataHash'> } = {
      meta: {
        version: '1.0',
        branchId: config.branchId,
        branchName: config.branchName,
        reportMonth: month,
        reportYear: year,
        generatedAt: new Date().toISOString(),
      },
      summary,
      details,
    };

    // Generate hash from summary+details for integrity
    const dataString = JSON.stringify({ summary, details });
    const dataHash = `sha256:${crypto.createHash('sha256').update(dataString).digest('hex').slice(0, 16)}`;

    const report: MonthlyExportJson = {
      ...reportData,
      meta: { ...reportData.meta, dataHash },
    };

    return report;
  }
}
