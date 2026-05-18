import { Prisma } from '@prisma/client';
import { SaleRepository, InstallmentRepository, PaymentRepository, CustomerRepository } from '../repositories/index.js';
import { generateReceiptNumber, addMonths } from '../utils/helpers.js';
import type { SaleInput } from '../validators/schemas.js';
import prisma from '../lib/prisma.js';

const saleRepo = new SaleRepository();
const installmentRepo = new InstallmentRepository();
const paymentRepo = new PaymentRepository();
const customerRepo = new CustomerRepository();

export class SaleService {
  async getAll(query?: { customerId?: string; status?: string; saleType?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number }) {
    return saleRepo.findAll(query);
  }

  async getById(id: string) {
    const sale = await saleRepo.findById(id);
    if (!sale) {
      throw new Error('البيع غير موجود');
    }
    return sale;
  }

  async create(data: SaleInput) {
    const customer = await customerRepo.findById(data.customerId);
    if (!customer) {
      const error = new Error('العميل غير موجود') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const existingMachine = await saleRepo.findByMachineSerial(data.machineSerial);
    if (existingMachine) {
      const customerName = (existingMachine as any).customer?.name || 'عميل غير معروف';
      const error = new Error(`رقم الماكينة مسجل بالفعل للعميل: ${customerName}`) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (data.saleType === 'CASH' && data.downPayment > 0 && data.downPayment < data.totalPrice) {
      const error = new Error('البيع النقدي يجب أن يكون الدفع كاملاً') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (data.saleType === 'CASH' && !data.downPaymentReceipt) {
      const error = new Error('رقم إيصال القبض مطلوب للبيع النقدي') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (data.downPayment > data.totalPrice) {
      const error = new Error('الدفعة المقدمة لا يمكن أن تتجاوز السعر الإجمالي') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (data.saleType === 'INSTALLMENT') {
      if (!data.months || data.months <= 0) {
        const error = new Error('عدد الأشهر مطلوب للبيع بالأقساط') as Error & { statusCode: number };
        error.statusCode = 400;
        throw error;
      }
    }

    const saleDate = typeof data.saleDate === 'string' ? new Date(data.saleDate) : data.saleDate;
    const lastDepositDate = data.lastDepositDate 
      ? (typeof data.lastDepositDate === 'string' ? new Date(data.lastDepositDate) : data.lastDepositDate) 
      : saleDate;
    
    let firstDueDate: Date;
    let months = data.months || 0;
    const remainingAfterDown = data.totalPrice - (data.downPayment || 0);

    if (data.saleType === 'INSTALLMENT') {
      if (data.installmentAmount && data.installmentAmount > 0 && !months) {
        months = Math.round(remainingAfterDown / data.installmentAmount);
        if (months === 0 && remainingAfterDown > 0) months = 1;
      }
      
      if (months <= 0) {
        const error = new Error('عدد الأشهر أو قيمة القسط مطلوبة للبيع بالأقساط') as Error & { statusCode: number };
        error.statusCode = 400;
        throw error;
      }

      firstDueDate = data.firstDueDate 
        ? (typeof data.firstDueDate === 'string' ? new Date(data.firstDueDate) : data.firstDueDate)
        : addMonths(saleDate, 2);
    } else {
      firstDueDate = addMonths(saleDate, 2);
    }

    const receiptNumber = generateReceiptNumber('SL');
    const actualAmountPaid = data.actualPaidAmount !== undefined ? data.actualPaidAmount : (data.downPayment || 0);

    // SM FIXED DP RULE: User now sets the Agreement Down Payment.
    const internalDownPayment = data.downPayment || 0;

    // For installment sales, we ensure 'months' are based on (Total - FixedDP)
    // even if the user entered a higher DP in the form.
    const totalToInstall = data.saleType === 'INSTALLMENT' 
      ? data.totalPrice - internalDownPayment 
      : 0;
    
    // We already calculated 'months' at the top of the function.
    // If the calculation was based on the wrong DP, we might need a small adjustment here.
    // However, the front-end will also be updated to show the correct months.

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Machine Sale
      const sale = await tx.machineSale.create({
        data: {
          receiptNumber,
          customerId: data.customerId,
          machineSerial: data.machineSerial,
          saleType: data.saleType,
          totalPrice: data.totalPrice,
          downPayment: internalDownPayment,
          downPaymentReceipt: data.downPaymentReceipt || null,
          paidAmount: 0,
          remainingAmount: data.totalPrice,
          paymentPlace: data.paymentPlace || null,
          notes: data.notes || null,
          saleDate,
          firstDueDate: data.saleType === 'INSTALLMENT' ? firstDueDate : null,
          months: data.saleType === 'INSTALLMENT' ? months : null,
          status: 'ACTIVE',
        },
      });

      // 2. Create Installments (Agreement: Total - Internal Fixed Down Payment)
      if (data.saleType === 'INSTALLMENT' && months > 0) {
        const installmentAmount = Math.round((totalToInstall / months) * 100) / 100;
        const installments = [];
        let remainingToDistribute = totalToInstall;

        for (let i = 1; i <= months; i++) {
          const dueDate = addMonths(firstDueDate, i - 1);
          const amt = i === months ? remainingToDistribute : installmentAmount;
          installments.push({
            saleId: sale.id,
            installmentNo: i,
            dueDate,
            amount: new Prisma.Decimal(amt),
            paidAmount: new Prisma.Decimal(0),
            isPaid: false,
            isWaived: false,
            waiveReason: null,
            paidDate: null,
            receiptNumber: null,
          });
          remainingToDistribute -= amt;
        }
        await tx.installment.createMany({ data: installments });
      }

      // 3. Record Actual Payment & Update Totals
      if (actualAmountPaid > 0) {
        const payReceipt = data.downPaymentReceipt || generateReceiptNumber('PAY');
        
        // Final totals for the Sale record
        const newPaidAmount = actualAmountPaid;
        const newRemainingAmount = Math.max(0, data.totalPrice - actualAmountPaid);

        await tx.machineSale.update({
          where: { id: sale.id },
          data: {
            paidAmount: newPaidAmount,
            remainingAmount: newRemainingAmount,
            status: newRemainingAmount <= 0.01 ? 'COMPLETED' : 'ACTIVE',
            downPaymentReceipt: payReceipt
          }
        });

        // Record the physical payment record(s)
        const dpToRecord = Math.min(actualAmountPaid, internalDownPayment);
        const instToRecord = Math.max(0, actualAmountPaid - internalDownPayment);

        // 1. Always record the Down Payment part (up to contract DP)
        await tx.payment.create({
          data: {
            receiptNumber: payReceipt,
            saleId: sale.id,
            paymentType: data.saleType === 'CASH' ? 'CASH_SALE' : 'DOWN_PAYMENT',
            amount: dpToRecord,
            paymentPlace: data.paymentPlace || null,
            notes: 'دفعة مقدم التعاقد',
            paidAt: lastDepositDate,
          },
        });

        // 2. Record the excess as an Installment payment if any
        let excessPayment: any = null;
        if (instToRecord > 0) {
          excessPayment = await tx.payment.create({
            data: {
              receiptNumber: `PAY-EX-${Date.now()}`,
              saleId: sale.id,
              paymentType: 'INSTALLMENT',
              amount: instToRecord,
              paymentPlace: data.paymentPlace || null,
              notes: 'رصيد إضافي مدفوع عند التعاقد',
              paidAt: lastDepositDate,
            },
          });
        }

        // Distribute EXTRA cash to installments (FIFO)
        if (data.saleType === 'INSTALLMENT') {
          // Cash left for installments = Total Paid - Fixed Down Payment
          let installmentCash = Math.max(0, actualAmountPaid - internalDownPayment);
          
          if (installmentCash > 0) {
            const insts = await tx.installment.findMany({
              where: { saleId: sale.id },
              orderBy: { installmentNo: 'asc' }
            });

            for (const inst of insts) {
              if (installmentCash <= 0) break;
              const unpaid = Number(inst.amount);
              const applied = Math.min(installmentCash, unpaid);
              const isFullyPaid = applied >= unpaid - 0.01;

              await tx.installment.update({
                where: { id: inst.id },
                data: {
                  paidAmount: isFullyPaid ? inst.amount : applied,
                  isPaid: isFullyPaid,
                  paidDate: isFullyPaid ? lastDepositDate : null,
                  receiptNumber: isFullyPaid ? payReceipt : null,
                  paymentId: excessPayment ? excessPayment.id : null
                }
              });
              installmentCash -= applied;
            }
          }
        }
      }

      return sale;
    });

    return result;
  }

  async generateInstallments(saleId: string, totalAmount: number, months: number, firstDueDate: Date) {
    const installmentAmount = totalAmount / months;
    const installments: Omit<import('@prisma/client').Installment, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    let remainingTotal = totalAmount;

    for (let i = 1; i <= months; i++) {
      const dueDate = addMonths(firstDueDate, i - 1);
      const amt = i === months ? remainingTotal : Math.round(installmentAmount * 100) / 100;
      installments.push({
        saleId,
        installmentNo: i,
        dueDate,
        amount: new Prisma.Decimal(amt),
        paidAmount: new Prisma.Decimal(0),
        isPaid: false,
        isWaived: false,
        waiveReason: null,
        paidDate: null,
        receiptNumber: null,
        paymentId: null,
      });
      remainingTotal -= amt;
    }

    await installmentRepo.createMany(installments);
  }

  async recordPayment(saleId: string, amount: number, paymentType: string, paymentPlace?: string, notes?: string, installmentIds?: string[], customReceiptNumber?: string, paidAt?: Date | string) {
    const receiptNumber = customReceiptNumber || generateReceiptNumber('PAY');
    const paymentDate = paidAt ? new Date(paidAt) : new Date();
    const sale = await saleRepo.findById(saleId);
    if (!sale) {
      const error = new Error('البيع غير موجود') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    if (sale.status === 'VOIDED') {
      const error = new Error('لا يمكن تسجيل دفعة لبيع ملغى') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (amount <= 0) {
      const error = new Error('المبلغ يجب أن يكون أكبر من صفر') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (customReceiptNumber) {
      const existingReceipt = await prisma.payment.findFirst({
        where: { 
          receiptNumber: customReceiptNumber,
          saleId: { not: saleId }
        },
        include: {
          sale: {
            include: {
              customer: true
            }
          }
        }
      });

      if (existingReceipt && existingReceipt.sale) {
        const customer = existingReceipt.sale.customer;
        const machineSerial = existingReceipt.sale.machineSerial;
        const error = new Error(`رقم الإيصال هذا تم استخدامه مسبقاً مع العميل: ${customer.name} (كود: ${customer.bkCode}) للماكينة رقم: ${machineSerial}`) as Error & { statusCode: number };
        error.statusCode = 400;
        throw error;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch the sale INSIDE the transaction to ensure we have fresh data and a lock
      const freshSale = await tx.machineSale.findUnique({
        where: { id: saleId }
      });

      if (!freshSale) throw new Error('البيع غير موجود');
      if (freshSale.status === 'VOIDED') throw new Error('لا يمكن تسجيل دفعة لبيع ملغى');

      const createdPayment = await tx.payment.create({
        data: {
          receiptNumber,
          saleId,
          paymentType,
          amount,
          paymentPlace: paymentPlace || null,
          notes: notes || null,
          paidAt: paymentDate,
        },
      });

      const newPaidAmount = Number(freshSale.paidAmount) + amount;
      let newRemaining = Number(freshSale.remainingAmount) - amount;
      
      // Allow minor floating point discrepancies (up to 0.05 EGP)
      if (newRemaining < 0 && newRemaining > -0.05) newRemaining = 0;

      await tx.machineSale.update({
        where: { id: saleId },
        data: {
          paidAmount: newPaidAmount,
          remainingAmount: newRemaining,
          status: Number(newRemaining) <= 0.01 ? 'COMPLETED' : freshSale.status,
          // Set or update downPaymentReceipt if this is a DP payment
          ...(paymentType === 'DOWN_PAYMENT' ? { downPaymentReceipt: receiptNumber } : {})
        },
      });

      // Determine which installments to apply the payment to
      let installmentsToProcess: any[] = [];
      
      // CRITICAL FIX: Only apply to installments if paymentType is NOT DOWN_PAYMENT
      if (paymentType !== 'DOWN_PAYMENT') {
        if (installmentIds && installmentIds.length > 0) {
          installmentsToProcess = await tx.installment.findMany({
            where: { id: { in: installmentIds } },
            orderBy: { installmentNo: 'asc' }
          });
        } else {
          // Auto-select ALL unpaid installments if none provided (FIFO)
          installmentsToProcess = await tx.installment.findMany({
            where: { saleId, isPaid: false },
            orderBy: { installmentNo: 'asc' }
          });
        }
      }

      const { distribution, remaining } = this.calculateDistribution(amount, installmentsToProcess);

      for (const item of distribution) {
        await tx.installment.update({
          where: { id: item.id },
          data: {
            paidAmount: item.paidAmount,
            isPaid: item.isPaid,
            paidDate: item.isPaid ? paymentDate : item.paidDate,
            receiptNumber: item.isPaid ? receiptNumber : item.receiptNumber,
            paymentId: item.appliedAmount > 0 ? createdPayment.id : undefined,
          },
        });
      }

      return { receiptNumber, amount };
    });

    return result;
  }

  private calculateDistribution(amount: number, installments: any[]) {
    let remainingToDistribute = amount;
    const distribution = [];

    for (const inst of installments) {
      if (remainingToDistribute <= 0) break;

      const unpaidForThis = Number(inst.amount) - Number(inst.paidAmount);
      if (unpaidForThis <= 0) continue;

      const paymentForThis = Math.min(remainingToDistribute, unpaidForThis);
      const newPaidAmountInst = Number(inst.paidAmount) + paymentForThis;
      const isFullyPaid = newPaidAmountInst >= Number(inst.amount) - 0.01;

      distribution.push({
        id: inst.id,
        installmentNo: inst.installmentNo,
        amount: inst.amount,
        paidAmount: isFullyPaid ? inst.amount : newPaidAmountInst,
        isPaid: isFullyPaid,
        appliedAmount: paymentForThis,
        paidDate: inst.paidDate,
        receiptNumber: inst.receiptNumber
      });

      remainingToDistribute -= paymentForThis;
    }

    return { distribution, remaining: remainingToDistribute };
  }

  async previewPayment(saleId: string, amount: number, installmentIds?: string[]) {
    const sale = await saleRepo.findById(saleId);
    if (!sale) throw new Error('البيع غير موجود');

    let installmentsToProcess = [];
    if (installmentIds && installmentIds.length > 0) {
      installmentsToProcess = sale.installments.filter(i => installmentIds.includes(i.id));
    } else {
      installmentsToProcess = sale.installments.filter(i => !i.isPaid).sort((a, b) => a.installmentNo - b.installmentNo);
    }

    const { distribution, remaining } = this.calculateDistribution(amount, installmentsToProcess);

    return {
      distribution,
      remainingAmount: Number(sale.remainingAmount),
      newRemainingAmount: Math.max(0, Number(sale.remainingAmount) - amount),
      credit: Math.max(0, amount - Number(sale.remainingAmount))
    };
  }

  async pay(saleId: string, amount: number, paymentType: string, paymentPlace?: string, notes?: string, installmentIds?: string[], customReceiptNumber?: string, paidAt?: Date | string) {
    return this.recordPayment(saleId, amount, paymentType, paymentPlace, notes, installmentIds, customReceiptNumber, paidAt);
  }

  async voidPayment(paymentId: string) {
    return prisma.$transaction(async (tx: any) => {
      // 1. Get payment details
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { sale: true }
      });
      if (!payment) throw new Error('الدفع غير موجود');

      const saleId = payment.saleId;
      const sale = payment.sale;

      // 2. Delete the payment
      await tx.payment.delete({ where: { id: paymentId } });

      // 3. Reset all installments for this sale
      await tx.installment.updateMany({
        where: { saleId },
        data: {
          paidAmount: 0,
          isPaid: false,
          paidDate: null,
          receiptNumber: null,
          paymentId: null
        }
      });

      // 4. Reset machine sale totals (temporarily to 0, then re-apply)
      await tx.machineSale.update({
        where: { id: saleId },
        data: {
          paidAmount: 0,
          remainingAmount: sale.totalPrice,
          status: 'ACTIVE',
          downPaymentReceipt: null
        }
      });

      // 5. Fetch all REMAINING payments for this sale (ordered by date)
      const remainingPayments = await tx.payment.findMany({
        where: { saleId },
        orderBy: { paidAt: 'asc' }
      });

      // 6. Re-apply all remaining payments one by one
      let totalPaid = 0;
      for (const p of remainingPayments) {
        const pAmount = Number(p.amount);
        totalPaid += pAmount;

        // Apply to installments (FIFO) - ONLY if not a down payment type
        if (p.paymentType !== 'DOWN_PAYMENT' && p.paymentType !== 'CASH_SALE') {
          const unpaidInstallments = await tx.installment.findMany({
            where: { saleId, isPaid: false },
            orderBy: { installmentNo: 'asc' }
          });

          if (unpaidInstallments.length > 0) {
            let remainingToDistribute = pAmount;
            for (const inst of unpaidInstallments) {
              if (remainingToDistribute <= 0) break;
              const unpaidForThis = Number(inst.amount) - Number(inst.paidAmount);
              if (unpaidForThis <= 0) continue;

              const paymentForThis = Math.min(remainingToDistribute, unpaidForThis);
              const newPaidAmountInst = Number(inst.paidAmount) + paymentForThis;
              const isFullyPaid = newPaidAmountInst >= Number(inst.amount) - 0.01;

              await tx.installment.update({
                where: { id: inst.id },
                data: {
                  paidAmount: isFullyPaid ? inst.amount : newPaidAmountInst,
                  isPaid: isFullyPaid,
                  paidDate: isFullyPaid ? p.paidAt : inst.paidDate,
                  receiptNumber: isFullyPaid ? p.receiptNumber : inst.receiptNumber,
                  paymentId: p.id
                },
              });
              remainingToDistribute -= paymentForThis;
            }
          }
        }

        // Update downPaymentReceipt if this is a DOWN_PAYMENT or CASH_SALE
        if (p.paymentType === 'DOWN_PAYMENT' || p.paymentType === 'CASH_SALE') {
          await tx.machineSale.update({
            where: { id: saleId },
            data: { downPaymentReceipt: p.receiptNumber }
          });
        }
      }

      // 7. Final update to MachineSale totals
      const finalRemaining = Number(sale.totalPrice) - totalPaid;
      await tx.machineSale.update({
        where: { id: saleId },
        data: {
          paidAmount: totalPaid,
          remainingAmount: finalRemaining,
          status: finalRemaining <= 0.01 ? 'COMPLETED' : 'ACTIVE'
        }
      });

      return { success: true, message: 'تم إلغاء الدفع وإعادة توزيع الأرصدة بنجاح' };
    });
  }

  async void(id: string, reason: string) {
    const sale = await saleRepo.findById(id);
    if (!sale) {
      throw new Error('البيع غير موجود');
    }
    if (sale.status === 'VOIDED') {
      throw new Error('البيع ملغى بالفعل');
    }

    return prisma.$transaction(async (tx: any) => {
      // 1. Delete all unpaid installments
      await tx.installment.deleteMany({
        where: { saleId: id, isPaid: false }
      });

      // 2. Void the sale
      return tx.machineSale.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidReason: reason,
          voidedAt: new Date(),
        },
      });
    });
  }

  async recalculateInstallments(id: string, newMonths: number) {
    const sale = await saleRepo.findById(id);
    if (!sale) {
      throw new Error('البيع غير موجود');
    }
    if (sale.saleType !== 'INSTALLMENT') {
      throw new Error('هذا البيع ليس بالأقساط');
    }
    if (sale.status === 'VOIDED') {
      throw new Error('لا يمكن إعادة حساب الأقساط لبيع ملغى');
    }
    if (newMonths <= 0 || newMonths > 120) {
      throw new Error('عدد الأشهر يجب أن يكون بين 1 و 120');
    }

    const unpaidInstallments = await prisma.installment.findMany({
      where: { saleId: id, isPaid: false },
      orderBy: { installmentNo: 'asc' },
    });

    if (unpaidInstallments.length === 0) {
      throw new Error('لا توجد أقساط غير مدفوعة لإعادة الحساب');
    }

    const totalUnpaid = unpaidInstallments.reduce((sum: number, inst: any) => sum + Number(inst.amount) - Number(inst.paidAmount), 0);
    const newInstallmentAmount = Math.round((totalUnpaid / newMonths) * 100) / 100;

    await prisma.$transaction(async (tx: any) => {
      await tx.installment.deleteMany({ where: { saleId: id, isPaid: false } });

      // Calculate base date for new installments
      const paidInstallments = Array.isArray(sale.installments) ? sale.installments.filter(inst => inst.isPaid) : [];
      const lastPaidInst = paidInstallments.length > 0 ? paidInstallments.sort((a: any, b: any) => b.installmentNo - a.installmentNo)[0] : null;
      
      const baseDate = lastPaidInst 
        ? new Date(lastPaidInst.dueDate) 
        : (sale.firstDueDate ? addMonths(new Date(sale.firstDueDate), -1) : addMonths(new Date(sale.saleDate), 0));

      const newInstallments = [];
      let currentRemaining = totalUnpaid;
      for (let i = 1; i <= newMonths; i++) {
        const amt = i === newMonths ? Math.round(currentRemaining * 100) / 100 : newInstallmentAmount;
        currentRemaining -= amt;
        newInstallments.push({
          saleId: id,
          installmentNo: i + paidInstallments.length,
          dueDate: addMonths(new Date(baseDate), i),
          amount: amt,
          paidAmount: 0,
          isPaid: false,
          isWaived: false,
          waiveReason: null,
          paidDate: null,
          receiptNumber: null,
        });
      }
      await tx.installment.createMany({ data: newInstallments });

      await tx.machineSale.update({
        where: { id },
        data: { months: newMonths },
      });
    });

    return saleRepo.findById(id);
  }

  async fullRecalculate(id: string, updates: { firstDueDate?: Date | string; months?: number; downPayment?: number; downPaymentReceipt?: string; totalPrice?: number }) {
    const sale = await saleRepo.findById(id);
    if (!sale) throw new Error('البيع غير موجود');
    if (sale.status === 'VOIDED') throw new Error('لا يمكن تعديل بيع ملغى');
    if (sale.saleType !== 'INSTALLMENT') throw new Error('هذا البيع ليس بالأقساط');

    const newTotalPrice = updates.totalPrice !== undefined ? updates.totalPrice : Number(sale.totalPrice);
    const newDownPayment = updates.downPayment !== undefined ? updates.downPayment : Number(sale.downPayment);
    const newMonths = updates.months !== undefined ? updates.months : Number(sale.months);
    const newFirstDueDate = updates.firstDueDate ? new Date(updates.firstDueDate) : sale.firstDueDate;
    const newDownPaymentReceipt = updates.downPaymentReceipt !== undefined ? updates.downPaymentReceipt : sale.downPaymentReceipt;

    if (newMonths <= 0) throw new Error('عدد الأشهر يجب أن يكون أكبر من 0');
    if (newDownPayment > newTotalPrice) throw new Error('المقدم لا يمكن أن يكون أكبر من الإجمالي');

    const totalToInstall = newTotalPrice - newDownPayment;
    const installmentAmount = Math.round((totalToInstall / newMonths) * 100) / 100;

    await prisma.$transaction(async (tx: any) => {
      // 1. Delete ALL installments
      await tx.installment.deleteMany({ where: { saleId: id } });

      // 2. Create new installments
      const newInstallments = [];
      let remainingToDistribute = totalToInstall;
      for (let i = 1; i <= newMonths; i++) {
        const dueDate = newFirstDueDate ? addMonths(new Date(newFirstDueDate), i - 1) : addMonths(new Date(sale.saleDate), i);
        const amt = i === newMonths ? Math.round(remainingToDistribute * 100) / 100 : installmentAmount;
        newInstallments.push({
          saleId: id,
          installmentNo: i,
          dueDate,
          amount: amt,
          paidAmount: 0,
          isPaid: false,
          isWaived: false,
          waiveReason: null,
          paidDate: null,
          receiptNumber: null,
        });
        remainingToDistribute -= amt;
      }
      await tx.installment.createMany({ data: newInstallments });

      // 3. Update MachineSale fields temporarily to reset state
      await tx.machineSale.update({
        where: { id },
        data: {
          totalPrice: newTotalPrice,
          downPayment: newDownPayment,
          months: newMonths,
          firstDueDate: newFirstDueDate,
          downPaymentReceipt: newDownPaymentReceipt,
          paidAmount: 0,
          remainingAmount: newTotalPrice,
          status: 'ACTIVE'
        }
      });

      // 4. Fetch all payments and re-apply them
      const payments = await tx.payment.findMany({
        where: { saleId: id },
        orderBy: { paidAt: 'asc' }
      });

      let totalPaid = 0;
      for (const p of payments) {
        const pAmount = Number(p.amount);
        totalPaid += pAmount;

        // Distribute installment payments
        if (p.paymentType !== 'DOWN_PAYMENT' && p.paymentType !== 'CASH_SALE') {
          const unpaidInstallments = await tx.installment.findMany({
            where: { saleId: id, isPaid: false },
            orderBy: { installmentNo: 'asc' }
          });

          let remToDistribute = pAmount;
          for (const inst of unpaidInstallments) {
            if (remToDistribute <= 0) break;
            const unpaidForThis = Number(inst.amount) - Number(inst.paidAmount);
            if (unpaidForThis <= 0) continue;

            const paymentForThis = Math.min(remToDistribute, unpaidForThis);
            const newPaidAmountInst = Number(inst.paidAmount) + paymentForThis;
            const isFullyPaid = newPaidAmountInst >= Number(inst.amount) - 0.01;

            await tx.installment.update({
              where: { id: inst.id },
              data: {
                paidAmount: isFullyPaid ? inst.amount : newPaidAmountInst,
                isPaid: isFullyPaid,
                paidDate: isFullyPaid ? p.paidAt : inst.paidDate,
                receiptNumber: isFullyPaid ? p.receiptNumber : inst.receiptNumber,
                paymentId: p.id
              }
            });
            remToDistribute -= paymentForThis;
          }
        }
      }

      // 5. Final update to MachineSale totals
      const finalRemaining = newTotalPrice - totalPaid;
      await tx.machineSale.update({
        where: { id },
        data: {
          paidAmount: totalPaid,
          remainingAmount: finalRemaining,
          status: finalRemaining <= 0.01 ? 'COMPLETED' : 'ACTIVE'
        }
      });
    });

    return saleRepo.findById(id);
  }
}