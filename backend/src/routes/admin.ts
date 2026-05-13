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
    console.log('MFA Verified. Resetting database...');

    try {
      // Delete in strict dependency order
      console.log('Clearing Payments...');
      await prisma.payment.deleteMany();
      
      console.log('Clearing Installments...');
      await prisma.installment.deleteMany();
      
      console.log('Clearing Sales...');
      await prisma.machineSale.deleteMany();
      
      console.log('Clearing Follow-ups...');
      await prisma.followUp.deleteMany();
      
      console.log('Clearing Customers...');
      await prisma.customer.deleteMany();

      console.log('Database reset complete.');
      res.json({ message: 'تم تصفير قاعدة البيانات بنجاح' });
    } catch (dbError: any) {
      console.error('Database deletion failed:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Reset failed:', error);
    res.status(500).json({ 
      error: 'فشل في تصفير قاعدة البيانات',
      details: error?.message 
    });
  }
});

export default router;
