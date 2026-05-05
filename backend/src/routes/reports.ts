import { Router, Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/reportService.js';

const router = Router();
const reportService = new ReportService();

router.get('/sales', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, saleType } = req.query;
    const result = await reportService.salesReport(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
      saleType as string
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/collections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, paymentType, paymentPlace } = req.query;
    const result = await reportService.collectionsReport(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
      paymentType as string,
      paymentPlace as string
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await reportService.overdueReport(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/customer/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reportService.customerStatement(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/month-closing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month } = req.query;
    const now = new Date();
    const y = year ? parseInt(year as string) : now.getFullYear();
    const m = month ? parseInt(month as string) : now.getMonth() + 1;
    const result = await reportService.monthClosingReport(y, m);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;