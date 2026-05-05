import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.post('/waive-installments', async (req: Request, res: Response) => {
  try {
    const { saleId, installmentIds, reason } = req.body;

    if (!saleId || !installmentIds || !Array.isArray(installmentIds) || installmentIds.length === 0) {
      res.status(400).json({ error: 'يرجى اختيار الأقساط المراد تنزيلها' });
      return;
    }

    const sale = await prisma.machineSale.findUnique({
      where: { id: saleId },
      include: { installments: true },
    });

    if (!sale) {
      res.status(404).json({ error: 'البيع غير موجود' });
      return;
    }

    if (sale.status === 'VOIDED') {
      res.status(400).json({ error: 'لا يمكن تنزيل أقساط من بيع ملغي' });
      return;
    }

    const receiptNumber = `WRV-${Date.now()}`;
    let totalWaived = 0;
    
    // Validate first to ensure we don't start a transaction for no reason
    const validInstallments: import('@prisma/client').Installment[] = [];
    for (const instId of installmentIds) {
      const installment = await prisma.installment.findUnique({
        where: { id: instId },
      });
      if (installment && installment.saleId === saleId && !installment.isPaid) {
        validInstallments.push(installment);
        totalWaived += Number(installment.amount);
      }
    }

    if (validInstallments.length === 0) {
      res.status(400).json({ error: 'لم يتم العثور على أقساط صالحة للتنزيل، أو تم دفعها بالفعل' });
      return;
    }

    const { updatedInstallmentsCount, newPaidAmount, newRemainingAmount } = await prisma.$transaction(async (tx) => {
      // 1. Update all valid installments
      for (const inst of validInstallments) {
        await tx.installment.update({
          where: { id: inst.id },
          data: {
            isPaid: true,
            isWaived: true,
            waiveReason: reason || 'مكافأة',
            paidAmount: inst.amount,
            paidDate: new Date(),
            receiptNumber,
          },
        });
      }

      // 2. Create the reward payment record
      await tx.payment.create({
        data: {
          receiptNumber,
          saleId,
          paymentType: 'REWARD',
          amount: totalWaived,
          paymentPlace: 'dhamen',
          notes: reason || 'تنزيل أقساط - مكافأة',
          paidAt: new Date(),
        },
      });

      // 3. Update the total sale balance
      const newPaid = Number(sale.paidAmount) + totalWaived;
      const newRemaining = Math.max(0, Number(sale.totalPrice) - newPaid);

      await tx.machineSale.update({
        where: { id: saleId },
        data: {
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE',
        },
      });

      return {
        updatedInstallmentsCount: validInstallments.length,
        newPaidAmount: newPaid,
        newRemainingAmount: newRemaining
      };
    });

    res.json({
      success: true,
      message: `تم تنزيل ${updatedInstallmentsCount} قسط بنجاح`,
      waivedCount: updatedInstallmentsCount,
      totalWaived,
    });
  } catch (error) {
    console.error('Waive installments error:', error);
    res.status(500).json({ error: 'فشل في تنزيل الأقساط' });
  }
});

export default router;