import { Router, Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customerService.js';
import { customerSchema, updateCustomerSchema } from '../validators/schemas.js';

const router = Router();
const customerService = new CustomerService();

function validateCustomer(data: unknown) {
  const result = customerSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data as any;
}

function validateUpdateCustomer(data: unknown) {
  const result = updateCustomerSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data as any;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const customers = await customerService.getAll(search);
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

router.get('/count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await customerService.getCount();
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.get('/generate-bkcode', async (req: Request, res: Response) => {
  const bkCode = customerService.generateBKCode();
  res.json({ bkCode });
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await customerService.getById(req.params.id as string);
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateCustomer(req.body);
    const customer = await customerService.create(data);
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateUpdateCustomer(req.body);
    const customer = await customerService.update(req.params.id as string, data);
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await customerService.delete(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;