import { Router, Request, Response, NextFunction } from 'express';
import { BranchConfigService } from '../services/branchConfigService.js';
import { MonthlyExportService } from '../services/monthlyExportService.js';

const router = Router();
const branchConfigService = new BranchConfigService();
const monthlyExportService = new MonthlyExportService();

// ---- Branch Config ----

// GET /api/branch/config — get current branch config
router.get('/config', (req: Request, res: Response) => {
  try {
    const config = branchConfigService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'فشل قراءة إعدادات الفرع' });
  }
});

// PUT /api/branch/config — update branch name
router.put('/config', (req: Request, res: Response) => {
  try {
    const { branchName } = req.body;
    if (!branchName || typeof branchName !== 'string' || !branchName.trim()) {
      return res.status(400).json({ error: 'اسم الفرع مطلوب' });
    }
    const config = branchConfigService.setBranchName(branchName);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'فشل تحديث إعدادات الفرع' });
  }
});

// ---- Monthly Export ----

// GET /api/branch/export-monthly?month=4&year=2026
router.get('/export-monthly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;

    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return res.status(400).json({ error: 'الشهر أو السنة غير صحيحة' });
    }

    const report = await monthlyExportService.generateMonthlyReport(year, month);

    // Return as downloadable JSON file
    const branchName = report.meta.branchName || 'فرع';
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const monthName = monthNames[month - 1];
    const filename = `تقرير-${branchName}-${monthName}-${year}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(JSON.stringify(report, null, 2));
  } catch (error: any) {
    if (error.message?.includes('اسم الفرع')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
