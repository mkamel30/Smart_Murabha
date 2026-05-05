import { Router, Request, Response, NextFunction } from 'express';
import { ExportService } from '../services/exportService.js';

const router = Router();
const exportService = new ExportService();

router.get('/sales', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    const workbook = await exportService.exportSales(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

router.get('/collections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    const workbook = await exportService.exportCollections(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=collections.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    const workbook = await exportService.exportOverdue(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=overdue-report.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

router.get('/receipt/:paymentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await exportService.generateReceiptPdf(req.params.paymentId as string, res);
  } catch (error) {
    next(error);
  }
});

router.get('/contract/:saleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await exportService.generateContractPdf(req.params.saleId as string, res);
  } catch (error) {
    next(error);
  }
});

router.get('/statement/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await exportService.generateCustomerStatementHtml(req.params.customerId as string, res);
  } catch (error) {
    next(error);
  }
});

export default router;