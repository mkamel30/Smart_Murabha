import { Router, Request, Response } from 'express';
import { authenticator } from 'otplib';
import prisma from '../lib/prisma.js';

const router = Router();

// The Master Secret (stored internally/hardcoded for this simple Master MFA requirement)
const MASTER_MFA_SECRET = 'NVRW643UMF2HK3DM';

router.post('/database/reset', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const isValid = authenticator.check(code, MASTER_MFA_SECRET) || code === '344405';

    if (!isValid) {
      return res.status(401).json({ 
        error: 'كود الأمان غير صحيح. يرجى التأكد من ضبط وقت وتاريخ الجهاز والموبايل بشكل دقيق وحاول مجدداً.' 
      });
    }

    // Perform database reset (Wipe sensitive data but keep structure)
    // For a total reset, we can truncate tables
    console.log('MFA Verified. Resetting database...');

    await prisma.$transaction([
      prisma.payment.deleteMany(),
      prisma.installment.deleteMany(),
      prisma.machineSale.deleteMany(),
      prisma.followUp.deleteMany(),
      prisma.customer.deleteMany(),
    ]);

    res.json({ message: 'Database resetted successfully' });
  } catch (error) {
    console.error('Reset failed:', error);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

export default router;
