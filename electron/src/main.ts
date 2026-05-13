import { app, BrowserWindow, ipcMain, shell, Notification } from 'electron';
import path from 'path';
import log from 'electron-log';
import os from 'os';
import fs from 'fs';
import { pathToFileURL } from 'url';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('Application starting...');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.info('Another instance is already running, quitting...');
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) candidates.push(iface.address);
    }
  }
  return candidates.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.')) || candidates[0] || 'localhost';
}

function getBackendDir(): string {
  return app.isPackaged 
    ? path.join(app.getAppPath(), 'backend') 
    : path.join(__dirname, '..', '..', 'backend');
}

function getBackendResourcesDir(): string {
  return app.isPackaged 
    ? path.join(process.resourcesPath, 'backend') 
    : getBackendDir();
}

// === DATABASE: Store alongside the program, not in AppData ===
function getProgramDir(): string {
  if (app.isPackaged) {
    // The .exe is in the program folder — go up from exe to get the root
    return path.dirname(app.getPath('exe'));
  }
  // Dev mode: use backend/prisma as before
  return getBackendDir();
}

function getDbPath(): string {
  if (!app.isPackaged) {
    return path.join(getBackendDir(), 'prisma', 'dev.db');
  }

  const programDir = getProgramDir();
  const dbDir = path.join(programDir, 'data');
  
  if (!fs.existsSync(dbDir)) {
    log.info(`Creating data directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const dbPath = path.join(dbDir, 'dev.db');
  
  // Migration: if DB exists in old AppData location but not in new program dir, move it
  if (!fs.existsSync(dbPath)) {
    const oldAppDataDb = path.join(app.getPath('userData'), 'data', 'dev.db');
    if (fs.existsSync(oldAppDataDb)) {
      log.info(`Migrating database from AppData to program directory...`);
      log.info(`  From: ${oldAppDataDb}`);
      log.info(`  To:   ${dbPath}`);
      fs.copyFileSync(oldAppDataDb, dbPath);
      // Also copy WAL/SHM files if they exist
      if (fs.existsSync(oldAppDataDb + '-wal')) fs.copyFileSync(oldAppDataDb + '-wal', dbPath + '-wal');
      if (fs.existsSync(oldAppDataDb + '-shm')) fs.copyFileSync(oldAppDataDb + '-shm', dbPath + '-shm');
      log.info(`Database migration complete!`);
    } else {
      // Seed from bundled resources
      const seedDb = path.join(getBackendResourcesDir(), 'prisma', 'dev.db');
      if (fs.existsSync(seedDb)) {
        log.info(`Seeding initial database to: ${dbPath}`);
        fs.copyFileSync(seedDb, dbPath);
      } else {
        log.warn(`Seed database not found at: ${seedDb}`);
      }
    }
  }
  
  return dbPath;
}

// === BACKUP SYSTEM ===
function getBackupDir(): string {
  const programDir = app.isPackaged ? getProgramDir() : path.join(getBackendDir(), '..');
  const backupDir = path.join(programDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

function createBackup(reason: string): boolean {
  try {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      log.warn(`[Backup] Cannot backup: DB file not found at ${dbPath}`);
      return false;
    }

    const backupDir = getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `murabha-${reason}-${timestamp}.db`;
    const backupPath = path.join(backupDir, backupName);

    fs.copyFileSync(dbPath, backupPath);
    log.info(`[Backup] ✅ Created: ${backupName} (${reason})`);

    // Store last backup time
    const metaPath = path.join(backupDir, '.last_backup');
    fs.writeFileSync(metaPath, new Date().toISOString());

    // Cleanup: keep only last 15 backups
    const maxBackups = 15;
    const allBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('murabha-') && f.endsWith('.db'))
      .sort()
      .reverse();

    for (let i = maxBackups; i < allBackups.length; i++) {
      fs.unlinkSync(path.join(backupDir, allBackups[i]));
      log.info(`[Backup] 🗑️ Removed old backup: ${allBackups[i]}`);
    }

    return true;
  } catch (err: any) {
    log.error(`[Backup] ❌ Failed (${reason}):`, err?.message || err);
    return false;
  }
}

function checkBackupAlert() {
  try {
    const backupDir = getBackupDir();
    const metaPath = path.join(backupDir, '.last_backup');
    
    if (!fs.existsSync(metaPath)) {
      // No backup ever taken — alert
      showBackupAlert();
      return;
    }

    const lastBackup = new Date(fs.readFileSync(metaPath, 'utf-8').trim());
    const hoursSince = (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60);
    
    if (hoursSince > 24) {
      showBackupAlert();
    }
  } catch (err) {
    log.error('[Backup] Alert check failed:', err);
  }
}

function showBackupAlert() {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: '⚠️ تنبيه: النسخ الاحتياطي',
      body: 'مرّ أكثر من 24 ساعة بدون نسخة احتياطية. يتم إنشاء نسخة تلقائية الآن...',
      icon: undefined,
    });
    notification.show();
  }
  // Auto-create a backup since the user was alerted
  createBackup('auto-alert');
}

let scheduledBackupInterval: NodeJS.Timeout | null = null;

function startScheduledBackups() {
  // Backup every 2 hours
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  scheduledBackupInterval = setInterval(() => {
    log.info('[Backup] Running scheduled backup...');
    createBackup('scheduled');
  }, TWO_HOURS);
  log.info('[Backup] Scheduled backups started (every 2 hours)');
}

// === BACKEND STARTUP ===
async function startBackend() {
  const dbPath = getDbPath();
  const formattedDbPath = dbPath.replace(/\\/g, '/');
  
  process.env.PORT = '3007';
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = `file:${formattedDbPath}`;
  process.env.SERVE_FRONTEND = 'true';

  // Tell the backup route where to find things
  process.env.APP_DB_PATH = dbPath;
  process.env.APP_BACKUP_DIR = getBackupDir();

  // === CRITICAL: Log and verify database ===
  log.info(`=== DATABASE DIAGNOSTICS ===`);
  log.info(`DB Path (raw): ${dbPath}`);
  log.info(`DB Path (formatted): ${formattedDbPath}`);
  log.info(`DATABASE_URL: ${process.env.DATABASE_URL}`);
  log.info(`Backup Dir: ${getBackupDir()}`);
  
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    log.info(`DB File EXISTS - Size: ${stats.size} bytes, Modified: ${stats.mtime.toISOString()}`);
  } else {
    log.error(`❌ DB File DOES NOT EXIST at: ${dbPath}`);
    const dataDir = path.dirname(dbPath);
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      log.info(`Files in ${dataDir}: ${files.join(', ') || '(empty)'}`);
    } else {
      log.error(`Data directory also doesn't exist: ${dataDir}`);
    }
  }
  log.info(`============================`);

  if (app.isPackaged) {
    process.env.FRONTEND_DIST = path.join(process.resourcesPath, 'frontend');
  } else {
    process.env.FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
  }

  if (app.isPackaged) {
    const net = await import('net');
    const isPortBusy = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(true));
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(3007);
    });

    if (isPortBusy) {
      log.error('Port 3007 is already in use');
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'خطأ في تشغيل البرنامج', 
        'المنفذ (Port 3007) مستخدم بالفعل. يرجى التأكد من إغلاق أي نسخة أخرى من البرنامج أو إعادة تشغيل الجهاز.'
      );
      app.quit();
      return;
    }

    try {
      const serverPath = path.join(getBackendDir(), 'dist', 'index.cjs');
      log.info(`Loading backend module: ${serverPath}`);
      require(serverPath);
      log.info('Backend module loaded successfully');
    } catch (err: any) {
      log.error('Failed to load backend module:', err);
      const { dialog } = require('electron');
      dialog.showErrorBox('Backend Error', `Failed to start the backend server:\n\n${err.message || err}\n\nPath: ${path.join(getBackendDir(), 'dist', 'index.cjs')}`);
    }
  } else {
    log.info('Development mode: checking if backend is already running on 3007...');
    const net = await import('net');
    const isPortBusy = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(true));
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(3007);
    });

    if (isPortBusy) {
      log.warn('Backend already running on port 3007. This might be an orphaned process from a previous session.');
      const { dialog } = require('electron');
      dialog.showMessageBox({
        type: 'warning',
        title: 'تنبيه: نسخة أخرى تعمل',
        message: 'يوجد نسخة من محرك البيانات تعمل بالفعل في الخلفية. إذا واجهت أخطاء، يرجى إغلاق البرنامج وإنهاء عملية node.exe من مدير المهام (Task Manager).',
        buttons: ['موافق']
      });
    } else {
      log.info('Starting backend fork on port 3007...');
      const { fork } = await import('child_process');
      const backendProcess = fork(path.join(getBackendDir(), 'src', 'index.ts'), [], {
        execArgv: ['--import', 'tsx'],
        cwd: getBackendDir(),
        env: { ...process.env, PORT: '3007', NODE_ENV: 'development' }
      });

      app.on('before-quit', () => {
        log.info('Terminating backend process...');
        backendProcess.kill();
      });
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Smart Murabha - نظام المبيعات والتحصيل',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Required to access local backend from file protocol
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  
  if (app.isPackaged) {
    const indexPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    log.info(`Loading UI from file: ${indexPath}`);
    mainWindow.loadFile(indexPath).catch(err => log.error('Failed to load index.html:', err));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

import { checkForUpdates } from './updater.js';

app.whenReady().then(async () => {
  await startBackend();
  createWindow();
  
  // Create startup backup
  createBackup('startup');

  // Start scheduled backups (every 2 hours)
  startScheduledBackups();
  
  // Check if backup alert is needed (>24h without backup)
  setTimeout(() => checkBackupAlert(), 10000);

  // Auto check for updates on startup (with slight delay)
  setTimeout(() => {
    checkForUpdates().catch(err => log.error('Initial update check failed:', err));
  }, 5000);
});

// Backup on close
app.on('before-quit', () => {
  log.info('[Backup] Creating shutdown backup...');
  createBackup('shutdown');
  if (scheduledBackupInterval) {
    clearInterval(scheduledBackupInterval);
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
ipcMain.handle('get-network-url', () => `http://${getLocalIP()}:3007`);
ipcMain.handle('shell:openExternal', (e, url) => shell.openExternal(url));
ipcMain.handle('check-for-updates', () => checkForUpdates(true));