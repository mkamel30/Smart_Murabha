import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath((import.meta as any).url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const getDbPath = () => {
  // Always try to find the actual dev.db file
  const rootDir = path.resolve(_dirname, '..', '..');
  
  const locations: string[] = [];
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
    locations.push(path.resolve(process.env.DATABASE_URL.replace('file:', '')));
  }
  
  locations.push(
    path.join(rootDir, 'prisma', 'dev.db'),
    path.join(process.cwd(), 'prisma', 'dev.db'),
    path.join(process.cwd(), 'backend', 'prisma', 'dev.db'),
    path.join(process.cwd(), 'dev.db'),
    path.join(process.cwd(), 'resources', 'backend', 'prisma', 'dev.db')
  );

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }
  return locations[0]; // Fallback to first one
};

const getBackupDir = () => {
  const dbPath = getDbPath();
  const dir = path.join(path.dirname(dbPath), '..', 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

router.get('/export', async (req: Request, res: Response) => {
  try {
    const dbPath = getDbPath();
    console.log(`Exporting DB from: ${dbPath}`);
    
    if (!fs.existsSync(dbPath)) {
      console.error(`DB NOT FOUND AT: ${dbPath}`);
      return res.status(404).json({ error: 'Database file not found at ' + dbPath });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=murabha-backup-${new Date().toISOString().split('T')[0]}.db`);
    
    const fileStream = fs.createReadStream(dbPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const dbPath = getDbPath();
    const tempPath = dbPath + '.backup';
    
    console.log(`Restoring database to: ${dbPath}`);

    // Create a safety backup of current DB if it exists
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, tempPath);
      console.log(`Safety backup created at: ${tempPath}`);
    }

    // Disconnect Prisma to release file locks
    await prisma.$disconnect();

    try {
      const fileBuffer = req.file.buffer;
      fs.writeFileSync(dbPath, fileBuffer);

      // Clean up WAL and SHM files to prevent corruption with the new DB
      if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
      if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
    } finally {
      // Reconnect Prisma
      await prisma.$connect();
      await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
      await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;');
    }

    console.log('Database restored successfully');
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore database' });
  }
});

router.post('/auto', async (req: Request, res: Response) => {
  try {
    const dbPath = getDbPath();
    const backupDir = getBackupDir();
    
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `murabha-auto-${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFileName);

    fs.copyFileSync(dbPath, backupPath);

    const autoBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('murabha-auto-'))
      .sort()
      .reverse();

    const maxAutoBackups = 10;
    for (let i = maxAutoBackups; i < autoBackups.length; i++) {
      fs.unlinkSync(path.join(backupDir, autoBackups[i]));
    }

    res.json({ success: true, message: 'Auto backup created', file: backupFileName });
  } catch (error) {
    console.error('Auto backup error:', error);
    res.status(500).json({ error: 'Failed to create auto backup' });
  }
});

router.get('/list', async (req: Request, res: Response) => {
  try {
    const backupDir = getBackupDir();
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('murabha-auto-'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stats.size, created: stats.birthtime };
      })
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    res.json({ files });
  } catch (error) {
    res.json({ files: [] });
  }
});

export default router;