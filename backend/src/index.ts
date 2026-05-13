import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

config();

// Fix BigInt JSON serialization (Prisma + SQLite returns BigInt for counts/aggregates)
(BigInt.prototype as any).toJSON = function () { return Number(this); };

import customersRouter from './routes/customers.js';
import salesRouter from './routes/sales.js';
import installmentsRouter from './routes/installments.js';
import paymentsRouter from './routes/payments.js';
import followupsRouter from './routes/followups.js';
import dashboardRouter from './routes/dashboard.js';
import reportsRouter from './routes/reports.js';
import exportRouter from './routes/export.js';
import importRouter from './routes/import.js';
import backupRouter from './routes/backup.js';
import adminRouter from './routes/admin.js';
import rewardsRouter from './routes/rewards.js';
import branchRouter from './routes/branch.js';

// Fix for dual ESM/CJS compatibility
const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath((import.meta as any).url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

const app = express();
const PORT = process.env.PORT || 3007; // Use environment variable or default to 3007

const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001', 'file://'];

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? false : undefined,
}));
app.use(cors({
  origin: (origin, callback) => {
    // In development or production (for local network access), allow all origins
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'طلب كثير، حاول مرة أخرى بعد قليل' },
});
app.use('/api', limiter);

const API_TOKEN = process.env.API_TOKEN || 'secure-token-123';

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next(); // Skip auth for healthcheck
  
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-api-key'];
  if (token !== API_TOKEN) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  next();
});

app.use('/api/customers', customersRouter);
app.use('/api/sales', salesRouter);
app.use('/api/installments', installmentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/followups', followupsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/backup', (req, res, next) => {
  console.log(`Backup Request: ${req.method} ${req.path}`);
  next();
}, backupRouter);
app.use('/api/admin', adminRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/branch', branchRouter);

import prisma from './lib/prisma.js';
import { runMigrations } from './migrator.js';
import { ensureTablesExist } from './dbInit.js';

// Run migrations and ensure tables exist before starting the server
(async () => {
  try {
    await ensureTablesExist(prisma);
    await runMigrations(prisma);
  } catch (err) {
    console.error('Database initialization failed:', err);
  }
})();

app.get('/api/health', async (req, res) => {
  try {
    // queryRawUnsafe works now thanks to BigInt.toJSON polyfill
    await prisma.$queryRawUnsafe('SELECT 1');
    
    // Extra diagnostics
    let tableCount = 0;
    const dbUrl = process.env.DATABASE_URL || 'NOT SET';
    try {
      const tables = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite%';`
      );
      tableCount = Number(tables[0]?.cnt) || 0;
    } catch {}
    
    res.json({ 
      status: 'ok', 
      db: 'connected', 
      dbPath: dbUrl,
      tables: tableCount,
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    console.error('[Health] DB check failed:', error?.message);
    res.status(503).json({ 
      status: 'error', 
      db: 'disconnected',
      dbPath: process.env.DATABASE_URL || 'NOT SET',
      error: error?.message,
      timestamp: new Date().toISOString() 
    });
  }
});

if (process.env.NODE_ENV === 'production' || process.env.SERVE_FRONTEND === 'true') {
  const frontendDist = process.env.FRONTEND_DIST || path.resolve('frontend', 'dist');
  
  // Serve static files with proper MIME types
  app.use(express.static(frontendDist, {
    maxAge: '1h',
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
      if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

interface AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown;
}

app.use((err: AppError, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('Full Error:', err);
  } else {
    console.error('Error:', err.message);
  }
  
  let errorMessage = err.message || 'خطأ في الخادم';
  let statusCode = err.statusCode || 500;
  
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        const target = (err.meta as Record<string, string[]>)?.target?.[0] || '';
        if (target.includes('receiptNumber')) {
          errorMessage = 'رقم إيصال الدفع مستخدم بالفعل';
        } else if (target.includes('bkCode')) {
          errorMessage = 'رقم العميل موجود بالفعل لهذا النوع';
        } else if (target.includes('machineSerial')) {
          errorMessage = 'رقم الماكينة موجود بالفعل';
        } else {
          errorMessage = 'هذا المدخل موجود بالفعل';
        }
        statusCode = 400;
        break;
      case 'P2025':
        errorMessage = 'البيانات المطلوبة غير موجودة';
        statusCode = 404;
        break;
      case 'P2003':
        errorMessage = 'لا يمكن حذف السجل لوجود بيانات مرتبطة به';
        statusCode = 400;
        break;
      case 'P2024':
        errorMessage = 'قاعدة البيانات مشغولة حالياً (Timeout). يرجى التأكد من عدم وجود نسخ أخرى تعمل.';
        statusCode = 503;
        break;
      default:
        errorMessage = `خطأ في قاعدة البيانات: ${err.message}`;
        statusCode = 500;
    }
  }
  
  if (err.message.startsWith('Validation error:')) {
    errorMessage = 'خطأ في البيانات المدخلة: ' + err.message.replace('Validation error: ', '');
    statusCode = 400;
  }
  
  res.status(statusCode).json({ 
    error: errorMessage,
    code: err.code,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Network accessible at http://0.0.0.0:${PORT}`);
});

export default app;