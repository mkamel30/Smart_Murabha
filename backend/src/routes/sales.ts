import { Router, Request, Response, NextFunction } from 'express';
import { SaleService } from '../services/saleService.js';
import { saleSchema, voidSaleSchema, recalculateInstallmentsSchema, paymentSchema, fullRecalculateSchema } from '../validators/schemas.js';

import { SaleRepository } from '../repositories/index.js';

const router = Router();
const saleService = new SaleService();
const saleRepo = new SaleRepository();

function validateSale(data: unknown) {
  const result = saleSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data as any;
}

function validatePayment(data: unknown) {
  const result = paymentSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error('Payment Validation Error:', errors, 'Data received:', data);
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data as any;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.query.customerId ? String(req.query.customerId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const saleType = req.query.saleType ? String(req.query.saleType) : undefined;
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const sales = await saleService.getAll({
      customerId: customerId || undefined,
      status: status || undefined,
      saleType: saleType || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
    });
    res.json(sales);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sale = await saleService.getById(req.params.id as string);
    res.json(sale);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateSale(req.body);
    const sale = await saleService.create(data);
    res.status(201).json(sale);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/preview-payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, installmentIds } = req.body;
    const preview = await saleService.previewPayment(req.params.id as string, Number(amount), installmentIds);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.body.saleId) req.body.saleId = req.params.id;
    const data = validatePayment(req.body);
    const result = await saleService.pay(
      req.params.id as string,
      data.amount,
      data.paymentType,
      data.paymentPlace,
      data.notes,
      data.installmentIds,
      data.receiptNumber,
      data.paidAt
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Alias for /pay to handle 404 from frontend
router.post('/:id/payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.body.saleId) req.body.saleId = req.params.id;
    const data = validatePayment(req.body);
    const result = await saleService.pay(
      req.params.id as string,
      data.amount,
      data.paymentType,
      data.paymentPlace,
      data.notes,
      data.installmentIds,
      data.receiptNumber,
      data.paidAt
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

function validateVoid(data: unknown) {
  const result = voidSaleSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data;
}

function validateRecalculate(data: unknown) {
  const result = recalculateInstallmentsSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data;
}

router.post('/:id/void', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateVoid(req.body);
    const sale = await saleService.void(req.params.id as string, data.reason);
    res.json(sale);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/recalculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateRecalculate(req.body);
    const sale = await saleService.recalculateInstallments(req.params.id as string, data.months);
    res.json(sale);
  } catch (error) {
    next(error);
  }
});

function validateFullRecalculate(data: unknown) {
  const result = fullRecalculateSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data;
}

router.post('/:id/full-recalculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateFullRecalculate(req.body);
    const sale = await saleService.fullRecalculate(req.params.id as string, data);
    res.json(sale);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only allow updating notes and payment place safely
    const data = req.body;
    const sale = await saleRepo.update(req.params.id as string, {
      notes: data.notes,
      paymentPlace: data.paymentPlace,
      saleDate: data.saleDate ? new Date(data.saleDate) : undefined
    });
    res.json(sale);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sale = await saleRepo.findById(req.params.id as string);
    if (!sale) return res.status(404).json({ error: 'Sales not found' });
    if (sale.payments.length > 0) return res.status(403).json({ error: 'Cannot delete sale with existing payments' });
    
    await saleRepo.delete(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;