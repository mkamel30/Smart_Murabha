import { Router, Request, Response, NextFunction } from 'express';
import { InstallmentRepository } from '../repositories/index.js';
import { SaleService } from '../services/saleService.js';

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
    const installment = await installmentRepo.update(req.params.id as string, {
      receiptNumber: receiptNumber !== undefined ? receiptNumber : undefined,
      paidDate: paidDate ? new Date(paidDate) : (paidDate === null ? null : undefined),
      isPaid: isPaid !== undefined ? isPaid : undefined,
      paidAmount: paidAmount !== undefined ? paidAmount : undefined,
    });
    res.json(installment);
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