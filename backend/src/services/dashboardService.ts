import prisma from '../lib/prisma.js';
import { startOfDay, endOfDay } from '../utils/helpers.js';

// Safe wrapper: if a query fails, return a fallback instead of crashing everything
async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    console.error('[DashboardService] Query failed, using fallback:', err);
    return fallback;
  }
}

export class DashboardService {
  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Each query is individually wrapped so a single failure won't crash the dashboard
    const [
      todayPayments,
      overdueInstallments,
      cashSalesTotal,
      installmentSalesTotal,
      totalSalesCount,
      totalPaidAll,
      totalRemainingAll,
      activeCustomers,
      recentPayments,
      upcomingDue,
      dueThisMonth
    ] = await Promise.all([
      safe(prisma.payment.findMany({
        where: { 
          paidAt: { gte: todayStart, lte: todayEnd },
          sale: { status: { not: 'VOIDED' } }
        },
        include: { sale: { include: { customer: true } } },
      }), []),
      safe(prisma.installment.findMany({
        where: { 
          isPaid: false, 
          dueDate: { lt: today },
          sale: { status: 'ACTIVE' }
        },
        include: { sale: { include: { customer: true } } },
      }), []),
      safe(prisma.machineSale.aggregate({
        where: { saleType: 'CASH', status: { in: ['ACTIVE', 'COMPLETED'] } },
        _sum: { totalPrice: true },
      }), { _sum: { totalPrice: null }, _count: 0, _avg: { totalPrice: null }, _min: { totalPrice: null }, _max: { totalPrice: null } } as any),
      safe(prisma.machineSale.aggregate({
        where: { saleType: 'INSTALLMENT', status: { in: ['ACTIVE', 'COMPLETED'] } },
        _sum: { totalPrice: true },
      }), { _sum: { totalPrice: null }, _count: 0, _avg: { totalPrice: null }, _min: { totalPrice: null }, _max: { totalPrice: null } } as any),
      safe(prisma.machineSale.count({
        where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
      }), 0),
      safe(prisma.payment.aggregate({ 
        where: { sale: { status: { not: 'VOIDED' } } },
        _sum: { amount: true } 
      }), { _sum: { amount: null }, _count: 0, _avg: { amount: null }, _min: { amount: null }, _max: { amount: null } } as any),
      safe(prisma.machineSale.aggregate({
        where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
        _sum: { remainingAmount: true },
      }), { _sum: { remainingAmount: null }, _count: 0, _avg: { remainingAmount: null }, _min: { remainingAmount: null }, _max: { remainingAmount: null } } as any),
      safe(prisma.customer.count(), 0),
      safe(prisma.payment.findMany({
        where: { sale: { status: { not: 'VOIDED' } } },
        orderBy: { paidAt: 'desc' }, take: 10,
        include: { sale: { include: { customer: true } } },
      }), []),
      safe(prisma.installment.findMany({
        where: { 
          isPaid: false, 
          dueDate: { gte: today, lte: tomorrow },
          sale: { status: 'ACTIVE' }
        },
        include: { sale: { include: { customer: true } } },
        orderBy: { dueDate: 'asc' }, take: 10,
      }), []),
      safe(prisma.installment.findMany({
        where: {
          isPaid: false,
          dueDate: { gte: todayStart, lte: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999) },
          sale: { status: 'ACTIVE' }
        },
        include: { sale: { include: { customer: true } } },
      }), [])
    ]);

    const todayCollections = Math.round(todayPayments.reduce((sum, p) => sum + Number(p.amount), 0));
    const todayPaymentCount = todayPayments.length;
    
    const overdueTotal = Math.round(overdueInstallments.reduce((sum, inst) => sum + Number(inst.amount) - Number(inst.paidAmount), 0));
    const overdueCount = overdueInstallments.length;

    const dueThisMonthTotal = Math.round(dueThisMonth.reduce((sum, inst) => sum + Number(inst.amount) - Number(inst.paidAmount), 0));

    return {
      todayCollections,
      todayPaymentCount,
      overdueTotal,
      overdueCount,
      cashSalesTotal: cashSalesTotal._sum.totalPrice || 0,
      installmentSalesTotal: installmentSalesTotal._sum.totalPrice || 0,
      totalSalesCount,
      totalPaidAll: totalPaidAll._sum.amount || 0,
      totalRemainingAll: totalRemainingAll._sum.remainingAmount || 0,
      activeCustomers,
      recentPayments,
      upcomingDue,
      dueThisMonth,
      dueThisMonthTotal,
    };
  }
}