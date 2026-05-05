import { Router, Request, Response, NextFunction } from 'express';
import { FollowUpService } from '../services/followUpService.js';
import { followUpSchema } from '../validators/schemas.js';

const router = Router();
const followUpService = new FollowUpService();

function validateFollowUp(data: unknown) {
  const result = followUpSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data as any;
}

function validateFollowUpUpdate(data: unknown) {
  const result = followUpSchema.partial().safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data as any;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, isCompleted } = req.query;
    const followUps = await followUpService.getAll({
      customerId: customerId as string | undefined,
      isCompleted: isCompleted === 'true' ? true : isCompleted === 'false' ? false : undefined,
    });
    res.json(followUps);
  } catch (error) {
    next(error);
  }
});

router.get('/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const upcoming = await followUpService.getUpcoming();
    res.json(upcoming);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const followUp = await followUpService.getById(req.params.id as string);
    res.json(followUp);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateFollowUp(req.body);
    const followUp = await followUpService.create(data);
    res.status(201).json(followUp);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateFollowUpUpdate(req.body);
    const followUp = await followUpService.update(req.params.id as string, data);
    res.json(followUp);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const followUp = await followUpService.complete(req.params.id as string);
    res.json(followUp);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await followUpService.delete(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;