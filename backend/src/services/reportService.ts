import prisma from '../lib/prisma.js';
import { startOfDay, endOfDay } from '../utils/helpers.js';
import type { Prisma } from '@prisma/client';

export class ReportService {
  async salesReport(startDate?: Date, endDate?: Date, saleType?: string) {
    const where: Prisma.MachineSaleWhereInput = { status: { not: 'VOIDED' } };
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = startDate;
      if (endDate) where.saleDate.lte = endDate;
    }
    if (saleType) {
      where.saleType = saleType as any;
    }

    const sales = await prisma.machineSale.findMany({
      where,
      include: { customer: true },
      orderBy: { saleDate: 'desc' },
    });

    const summary = {
      totalSales: sales.length,
      cashSales: sales.filter(s => s.saleType === 'CASH').length,
      installmentSales: sales.filter(s => s.saleType === 'INSTALLMENT').length,
      totalAmount: Math.round(sales.reduce((sum, s) => sum + Number(s.totalPrice), 0)),
      totalPaid: Math.round(sales.reduce((sum, s) => sum + Number(s.paidAmount), 0)),
      totalRemaining: Math.round(sales.reduce((sum, s) => sum + Number(s.remainingAmount), 0)),
    };

    return { sales, summary };
  }

  async collectionsReport(startDate?: Date, endDate?: Date, paymentType?: string, paymentPlace?: string) {
    const where: Prisma.PaymentWhereInput = {
      sale: { status: { not: 'VOIDED' } }
    };
    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) where.paidAt.gte = startDate;
      if (endDate) where.paidAt.lte = endDate;
    }
    if (paymentType) {
      where.paymentType = paymentType as any;
    }
    if (paymentPlace) {
      where.paymentPlace = paymentPlace;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { sale: { include: { customer: true } } },
      orderBy: { paidAt: 'desc' },
    });

    const summary = {
      totalPayments: payments.length,
      totalAmount: Math.round(payments.reduce((sum, p) => sum + Number(p.amount), 0)),
      cashPayments: Math.round(payments.filter(p => p.paymentType === 'CASH_SALE').reduce((sum, p) => sum + Number(p.amount), 0)),
      downPayments: Math.round(payments.filter(p => p.paymentType === 'DOWN_PAYMENT').reduce((sum, p) => sum + Number(p.amount), 0)),
      installmentPayments: Math.round(payments.filter(p => p.paymentType === 'INSTALLMENT').reduce((sum, p) => sum + Number(p.amount), 0)),
    };

    return { payments, summary };
  }

  async overdueReport(startDate?: Date, endDate?: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: Prisma.InstallmentWhereInput = {
      isPaid: false,
      sale: { status: 'ACTIVE' },
    };

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = startDate;
      if (endDate) where.dueDate.lte = endDate;
    } else {
      where.dueDate = { lt: today };
    }

    const overdue = await prisma.installment.findMany({
      where,
      include: {
        sale: {
          include: { customer: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const summary = {
      totalOverdue: overdue.length,
      totalAmount: Math.round(overdue.reduce((sum, inst) => sum + (Number(inst.amount) - Number(inst.paidAmount)), 0)),
      byCustomer: overdue.reduce((acc, inst) => {
        const key = inst.sale.customerId;
        if (!acc[key]) {
          acc[key] = { customer: inst.sale.customer, count: 0, amount: 0 };
        }
        acc[key].count++;
        acc[key].amount += Number(inst.amount) - Number(inst.paidAmount);
        return acc;
      }, {} as Record<string, { customer: import('@prisma/client').Customer; count: number; amount: number }>),
    };

    return { overdue, summary };
  }

  async customerStatement(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        sales: {
          where: { status: { not: 'VOIDED' } },
          include: {
            installments: { orderBy: { installmentNo: 'asc' } },
            payments: { orderBy: { paidAt: 'desc' } },
          },
        },
      },
    });

    if (!customer) {
      throw new Error('العميل غير موجود');
    }

    const totalSales = customer.sales.reduce((sum, s) => sum + Number(s.totalPrice), 0);
    const totalPaid = customer.sales.reduce((sum, s) => sum + Number(s.paidAmount), 0);
    const totalRemaining = customer.sales.reduce((sum, s) => sum + Number(s.remainingAmount), 0);

    return {
      customer,
      sales: customer.sales,
      summary: {
        totalSales: Math.round(totalSales),
        totalPaid: Math.round(totalPaid),
        totalRemaining: Math.round(totalRemaining),
        salesCount: customer.sales.length,
      },
    };
  }

  async monthClosingReport(year: number, month: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const salesInMonth = await prisma.machineSale.findMany({
      where: {
        saleDate: { gte: startOfMonth, lte: endOfMonth },
        status: { not: 'VOIDED' },
      },
      include: { customer: true },
    });

    const cashSales = salesInMonth.filter(s => s.saleType === 'CASH');
    const installmentSales = salesInMonth.filter(s => s.saleType === 'INSTALLMENT');

    const paymentsInMonth = await prisma.payment.findMany({
      where: {
        paidAt: { gte: startOfMonth, lte: endOfMonth },
        sale: { status: { not: 'VOIDED' } }
      },
      include: { sale: { include: { customer: true } } },
    });

    const cashPayments = paymentsInMonth.filter(p => p.paymentType === 'CASH_SALE');
    const downPayments = paymentsInMonth.filter(p => p.paymentType === 'DOWN_PAYMENT');
    const installmentPayments = paymentsInMonth.filter(p => p.paymentType === 'INSTALLMENT');

    const overdueAtEnd = await prisma.installment.findMany({
      where: {
        dueDate: { lte: endOfMonth },
        isPaid: false,
        sale: { status: 'ACTIVE' }
      },
      include: { sale: { include: { customer: true } } },
    });

    const activeSales = await prisma.machineSale.findMany({
      where: { status: 'ACTIVE' },
    });

    return {
      month: { year, month, name: new Date(year, month - 1).toLocaleString('ar', { month: 'long', year: 'numeric' }) },
      period: { start: startOfMonth, end: endOfMonth },
      sales: {
        cash: { count: cashSales.length, amount: Math.round(cashSales.reduce((sum, s) => sum + Number(s.totalPrice), 0)) },
        installment: { count: installmentSales.length, amount: Math.round(installmentSales.reduce((sum, s) => sum + Number(s.totalPrice), 0)) },
        total: { count: salesInMonth.length, amount: Math.round(salesInMonth.reduce((sum, s) => sum + Number(s.totalPrice), 0)) },
      },
      collections: {
        cashSale: { count: cashPayments.length, amount: Math.round(cashPayments.reduce((sum, p) => sum + Number(p.amount), 0)) },
        downPayment: { count: downPayments.length, amount: Math.round(downPayments.reduce((sum, p) => sum + Number(p.amount), 0)) },
        installment: { count: installmentPayments.length, amount: Math.round(installmentPayments.reduce((sum, p) => sum + Number(p.amount), 0)) },
        total: { count: paymentsInMonth.length, amount: Math.round(paymentsInMonth.reduce((sum, p) => sum + Number(p.amount), 0)) },
      },
      overdue: {
        count: overdueAtEnd.length,
        amount: Math.round(overdueAtEnd.reduce((sum, inst) => sum + (Number(inst.amount) - Number(inst.paidAmount)), 0)),
        details: overdueAtEnd.slice(0, 50),
      },
      summary: {
        activeDebt: Math.round(activeSales.reduce((sum, s) => sum + Number(s.remainingAmount), 0)),
        customerCount: await prisma.customer.count(),
      }
    };
  }
}