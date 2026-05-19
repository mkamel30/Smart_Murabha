import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
}

export class AnalyticsService {
  async getDashboardData(filters: AnalyticsFilter) {
    const { startDate, endDate } = filters;
    const now = new Date();

    // Base conditions for date filtering where applicable
    const dateCondition = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {})
    };
    
    const hasDateCondition = Object.keys(dateCondition).length > 0;

    // 1. KPI: Total Sales Value
    const salesFilter = hasDateCondition ? { saleDate: dateCondition } : {};
    const totalSales = await prisma.machineSale.aggregate({
      _sum: { totalPrice: true, downPayment: true },
      where: { status: 'ACTIVE', ...salesFilter }
    });

    // 2. KPI: Collections (Payments made in this period)
    const paymentsFilter = hasDateCondition ? { paidAt: dateCondition } : {};
    const collections = await prisma.payment.groupBy({
      by: ['paymentType'],
      _sum: { amount: true },
      where: paymentsFilter
    });

    const totalDownPaymentsCollected = Number(collections.find(c => c.paymentType === 'DOWN_PAYMENT')?._sum.amount || 0);
    const totalInstallmentsCollected = Number(collections.find(c => c.paymentType === 'INSTALLMENT')?._sum.amount || 0);

    // 3. KPI: Expected Installments Due in this period
    const dueInstallmentsFilter = hasDateCondition ? { dueDate: dateCondition } : {};
    const expectedInstallments = await prisma.installment.aggregate({
      _sum: { amount: true },
      where: { sale: { status: 'ACTIVE' }, ...dueInstallmentsFilter }
    });

    // 4. Payment Channels Distribution
    const paymentChannelsData = await prisma.payment.groupBy({
      by: ['paymentPlace'],
      _sum: { amount: true },
      where: paymentsFilter
    });
    
    const paymentChannels = paymentChannelsData.map(p => ({
      place: p.paymentPlace || 'unknown',
      total: Number(p._sum.amount || 0)
    }));

    // 5. Overdue Risk (Aging) - Independent of the selected date filter usually, but we consider all overdue till now.
    const overdueInstallments = await prisma.installment.findMany({
      where: {
        isPaid: false,
        dueDate: { lt: new Date(now.setHours(0,0,0,0)) },
        sale: { status: 'ACTIVE' }
      },
      select: {
        amount: true,
        paidAmount: true,
        dueDate: true
      }
    });

    let risk1to30 = 0;
    let risk31to60 = 0;
    let riskOver60 = 0;
    const todayMs = new Date().getTime();

    overdueInstallments.forEach(inst => {
      const remaining = Number(inst.amount) - Number(inst.paidAmount || 0);
      const daysOverdue = Math.floor((todayMs - inst.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue <= 30) risk1to30 += remaining;
      else if (daysOverdue <= 60) risk31to60 += remaining;
      else riskOver60 += remaining;
    });

    const overdueRisk = [
      { name: '1-30 يوم', value: risk1to30 },
      { name: '31-60 يوم', value: risk31to60 },
      { name: 'أكثر من 60 يوم', value: riskOver60 }
    ];

    // 6. Cash Flow Forecast (Next 6 months)
    const next6Months = new Date(now.getFullYear(), now.getMonth() + 6, 1);
    const upcomingInstallments = await prisma.installment.findMany({
      where: {
        isPaid: false,
        dueDate: { 
          gte: new Date(now.getFullYear(), now.getMonth(), 1), // from start of current month
          lt: next6Months 
        },
        sale: { status: 'ACTIVE' }
      },
      select: {
        amount: true,
        paidAmount: true,
        dueDate: true
      }
    });

    const cashFlowMap = new Map<string, number>();
    upcomingInstallments.forEach(inst => {
      const monthYear = `${inst.dueDate.getFullYear()}-${String(inst.dueDate.getMonth() + 1).padStart(2, '0')}`;
      const remaining = Number(inst.amount) - Number(inst.paidAmount || 0);
      cashFlowMap.set(monthYear, (cashFlowMap.get(monthYear) || 0) + remaining);
    });

    const cashFlowForecast = Array.from(cashFlowMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, expected]) => ({ month, expected }));

    // 7. Top 10 Defaulters
    // In SQLite, complex groupBy with relations can be tricky, so we'll fetch unpaid overdue and group in memory
    const defaultingSales = await prisma.machineSale.findMany({
      where: {
        status: 'ACTIVE',
        installments: {
          some: {
            isPaid: false,
            dueDate: { lt: new Date(new Date().setHours(0,0,0,0)) }
          }
        }
      },
      include: {
        customer: true,
        installments: {
          where: {
            isPaid: false,
            dueDate: { lt: new Date(new Date().setHours(0,0,0,0)) }
          }
        }
      }
    });

    const defaultersMap = new Map<string, { customerName: string, bkCode: string, totalOverdue: number }>();
    defaultingSales.forEach(sale => {
      const saleOverdue = sale.installments.reduce((sum, inst) => sum + (Number(inst.amount) - Number(inst.paidAmount || 0)), 0);
      if (saleOverdue > 0) {
        if (!defaultersMap.has(sale.customerId)) {
          defaultersMap.set(sale.customerId, {
            customerName: sale.customer.name,
            bkCode: sale.customer.bkCode,
            totalOverdue: 0
          });
        }
        defaultersMap.get(sale.customerId)!.totalOverdue += saleOverdue;
      }
    });

    const topDefaulters = Array.from(defaultersMap.values())
      .sort((a, b) => b.totalOverdue - a.totalOverdue)
      .slice(0, 10);

    return {
      kpi: {
        totalSales: Number(totalSales._sum.totalPrice || 0),
        totalDownPayments: Number(totalSales._sum.downPayment || 0),
        expectedInstallments: Number(expectedInstallments._sum.amount || 0),
        collectedInstallments: totalInstallmentsCollected,
        collectedDownPayments: totalDownPaymentsCollected,
        totalCollected: totalInstallmentsCollected + totalDownPaymentsCollected,
      },
      paymentChannels,
      overdueRisk,
      cashFlowForecast,
      topDefaulters
    };
  }
}
