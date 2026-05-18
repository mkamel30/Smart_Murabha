import { Router, Request, Response, NextFunction } from 'express';
import { InstallmentRepository } from '../repositories/index.js';
import { SaleService } from '../services/saleService.js';
import prisma from '../lib/prisma.js';

const router = Router();
const installmentRepo = new InstallmentRepository();
const saleService = new SaleService();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { saleId, isPaid, startDate, endDate } = req.query;
    const installments = await installmentRepo.findAll({
      saleId: saleId as string | undefined,
      isPaid: isPaid === 'true' ? true : isPaid === 'false' ? false : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    res.json(installments);
  } catch (error) {
    next(error);
  }
});

router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overdue = await installmentRepo.findOverdue();
    res.json(overdue);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const installment = await installmentRepo.findById(req.params.id as string);
    if (!installment) {
      return res.status(404).json({ error: 'القسط غير موجود' });
    }
    res.json(installment);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { receiptNumber, paidDate, isPaid, paidAmount } = req.body;
    
    // Fetch old installment first
    const oldInstallment = await prisma.installment.findUnique({
      where: { id: req.params.id as string }
    });
    if (!oldInstallment) {
      return res.status(404).json({ error: 'القسط غير موجود' });
    }

    // Check if new receiptNumber is already used in a different sale
    if (receiptNumber && receiptNumber !== oldInstallment.receiptNumber) {
      const existingPayment = await prisma.payment.findFirst({
        where: { 
          receiptNumber: receiptNumber,
          saleId: { not: oldInstallment.saleId }
        },
        include: {
          sale: {
            include: {
              customer: true
            }
          }
        }
      });

      if (existingPayment && existingPayment.sale) {
        const customer = existingPayment.sale.customer;
        const machineSerial = existingPayment.sale.machineSerial;
        return res.status(400).json({ 
          error: `رقم الإيصال هذا تم استخدامه مسبقاً مع العميل: ${customer.name} (كود: ${customer.bkCode}) للماكينة رقم: ${machineSerial}` 
        });
      }
    }

    const updatedInstallment = await prisma.$transaction(async (tx) => {
      // 1. Update target installment
      const inst = await tx.installment.update({
        where: { id: req.params.id as string },
        data: {
          receiptNumber: receiptNumber !== undefined ? receiptNumber : undefined,
          paidDate: paidDate ? new Date(paidDate) : (paidDate === null ? null : undefined),
          isPaid: isPaid !== undefined ? isPaid : undefined,
          paidAmount: paidAmount !== undefined ? paidAmount : undefined,
        }
      });

      // 2. Find linked Payment (by paymentId first, then by receiptNumber fallback)
      let payment = null;
      if (oldInstallment.paymentId) {
        payment = await tx.payment.findUnique({ where: { id: oldInstallment.paymentId } });
      }
      if (!payment && oldInstallment.receiptNumber) {
        payment = await tx.payment.findFirst({
          where: {
            saleId: oldInstallment.saleId,
            receiptNumber: oldInstallment.receiptNumber
          }
        });
      }

      if (payment) {
        const newReceiptNumber = receiptNumber !== undefined ? receiptNumber : oldInstallment.receiptNumber;
        const newPaidDate = paidDate ? new Date(paidDate) : oldInstallment.paidDate;

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            receiptNumber: newReceiptNumber || payment.receiptNumber,
            paidAt: newPaidDate ? new Date(newPaidDate) : undefined
          }
        });

        // Save the link if not already saved
        if (!oldInstallment.paymentId) {
          await tx.installment.update({
            where: { id: req.params.id as string },
            data: { paymentId: payment.id }
          });
        }

        // Update any OTHER installments of this sale sharing the old payment
        if (receiptNumber !== undefined || paidDate !== undefined) {
          await tx.installment.updateMany({
            where: {
              saleId: oldInstallment.saleId,
              paymentId: payment.id,
              id: { not: req.params.id as string }
            },
            data: {
              receiptNumber: newReceiptNumber,
              paidDate: newPaidDate
            }
          });
        }
      }

      return inst;
    });

    res.json(updatedInstallment);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const installment = await installmentRepo.findById(req.params.id as string);
    if (!installment) {
      return res.status(404).json({ error: 'القسط غير موجود' });
    }
    const data = req.body;
    const result = await saleService.pay(
      installment.saleId,
      data.amount,
      'INSTALLMENT',
      data.paymentPlace,
      data.notes,
      [installment.id],
      data.receiptNumber
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;