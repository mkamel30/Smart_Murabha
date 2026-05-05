import { Router, Request, Response, NextFunction } from 'express';
import { PaymentRepository, SaleRepository } from '../repositories/index.js';
import { SaleService } from '../services/saleService.js';

const router = Router();
const paymentRepo = new PaymentRepository();
const saleRepo = new SaleRepository();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { saleId, startDate, endDate } = req.query;
    const payments = await paymentRepo.findAll({
      saleId: saleId as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentRepo.findById(req.params.id as string);
    if (!payment) {
      return res.status(404).json({ error: 'الدفع غير موجود' });
    }
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const payment = await paymentRepo.create(data);
    
    // Auto-update the sale remaining amount
    const sale = await saleRepo.findById(data.saleId);
    if (sale) {
      const newPaid = Number(sale.paidAmount) + Number(data.amount);
      let newRemaining = Number(sale.remainingAmount) - Number(data.amount);
      if (newRemaining < 0) newRemaining = 0;
      await saleRepo.update(sale.id, {
        paidAmount: newPaid as any,
        remainingAmount: newRemaining as any,
      });
    }

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

const saleService = new SaleService();

router.post('/:id/void', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await saleService.voidPayment(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await saleService.voidPayment(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;