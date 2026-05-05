import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import log from 'electron-log';
import os from 'os';
import fs from 'fs';
import { pathToFileURL } from 'url';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('Application starting...');

let mainWindow: BrowserWindow | null = null;

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

function getDbPath(): string {
  if (!app.isPackaged) {
    return path.join(getBackendDir(), 'prisma', 'dev.db');
  }

  const userDataDir = app.getPath('userData');
  const dbDir = path.join(userDataDir, 'data');
  
  if (!fs.existsSync(dbDir)) {
    log.info(`Creating data directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const dbPath = path.join(dbDir, 'dev.db');
  
  // Seed database if it doesn't exist in AppData
  if (!fs.existsSync(dbPath)) {
    const seedDb = path.join(getBackendResourcesDir(), 'prisma', 'dev.db');
    if (fs.existsSync(seedDb)) {
      log.info(`Seeding initial database to: ${dbPath}`);
      fs.copyFileSync(seedDb, dbPath);
    } else {
      log.warn(`Seed database not found at: ${seedDb}`);
    }
  }
  
  return dbPath;
}

async function startBackend() {
  const dbPath = getDbPath();
  const formattedDbPath = dbPath.replace(/\\/g, '/');
  
  process.env.PORT = '3005';
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = `file:${formattedDbPath}`;
  process.env.SERVE_FRONTEND = 'true'; // Allow network access

  if (app.isPackaged) {
    process.env.FRONTEND_DIST = path.join(process.resourcesPath, 'frontend');
  } else {
    process.env.FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
  }

  if (app.isPackaged) {
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
    log.info('Development mode: checking if backend is already running on 3005...');
    const net = await import('net');
    const isPortBusy = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(true));
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(3005);
    });

    if (isPortBusy) {
      log.info('Backend already running on port 3005, skipping fork.');
    } else {
      log.info('Starting backend fork on port 3005...');
      const { fork } = await import('child_process');
      fork(path.join(getBackendDir(), 'src', 'index.ts'), [], {
        execArgv: ['--import', 'tsx'],
        cwd: getBackendDir(),
        env: { ...process.env, PORT: '3005', NODE_ENV: 'development' }
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
  
  // Auto check for updates on startup (with slight delay)
  setTimeout(() => {
    checkForUpdates().catch(err => log.error('Initial update check failed:', err));
  }, 5000);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
ipcMain.handle('get-network-url', () => `http://${getLocalIP()}:3005`);
ipcMain.handle('shell:openExternal', (e, url) => shell.openExternal(url));
ipcMain.handle('check-for-updates', () => checkForUpdates(true));