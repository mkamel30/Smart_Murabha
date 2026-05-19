import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analyticsService.js';

const router = Router();
const analyticsService = new AnalyticsService();

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const data = await analyticsService.getDashboardData({ startDate, endDate });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
