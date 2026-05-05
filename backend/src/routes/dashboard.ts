import { Router, Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService.js';

const router = Router();
const dashboardService = new DashboardService();

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await dashboardService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;