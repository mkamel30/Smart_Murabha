import { app, dialog, shell, BrowserWindow } from 'electron';
import https from 'https';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import axios from 'axios';
import extractZip from 'extract-zip';
const GITHUB_OWNER = 'mkamel30';
const GITHUB_REPO = 'Smart_Murabha';
const CURRENT_VERSION = app.getVersion();

interface GithubRelease {
  tag_name: string;
  name: string;
  body: string;
  assets: { name: string; browser_download_url: string }[];
}

function fetchLatestRelease(): Promise<GithubRelease> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'Smart-Murabha-Updater'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`GitHub API returned ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function isNewerVersion(remote: string, current: string): boolean {
  const r = remote.replace('v', '').split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    if ((r[i] || 0) > (c[i] || 0)) return true;
    if ((r[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

function showProgressWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 450,
    height: 150,
    title: 'تحديث البرنامج',
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <html dir="rtl">
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f0f0; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 85%; text-align: center; }
        .progress-bar { width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin-top: 15px; }
        .progress-fill { height: 100%; background: #007bff; width: 0%; transition: width 0.2s; }
      </style>
    </head>
    <body>
      <div class="container">
        <h3 style="margin:0;color:#333;">جاري تحميل التحديث... يرجى الانتظار</h3>
        <div class="progress-bar"><div class="progress-fill" id="fill"></div></div>
        <p id="status" style="margin-top:10px;font-size:14px;color:#666;">0%</p>
      </div>
      <script>
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('download-progress', (event, percent) => {
          document.getElementById('fill').style.width = percent + '%';
          document.getElementById('status').innerText = percent + '%';
        });
        ipcRenderer.on('download-status', (event, text) => {
          document.getElementById('status').innerText = text;
        });
      </script>
    </body>
    </html>
  `));

  return win;
}

function updateProgress(win: BrowserWindow, percent: number) {
  if (!win.isDestroyed()) {
    win.webContents.send('download-progress', percent);
  }
}

function updateStatus(win: BrowserWindow, text: string) {
  if (!win.isDestroyed()) {
    win.webContents.send('download-status', text);
  }
}

export async function checkForUpdates(manual = false): Promise<void> {
  try {
    log.info('Checking for updates...');
    const release = await fetchLatestRelease();
    const remoteVersion = release.tag_name.replace('v', '');
    
    if (isNewerVersion(remoteVersion, CURRENT_VERSION)) {
      const result = await dialog.showMessageBox({
        type: 'info',
        title: 'تحديث متاح',
        message: `يوجد إصدار جديد متاح: ${release.tag_name}`,
        detail: release.body || 'تحسينات وإصلاحات جديدة.',
        buttons: ['تحديث الآن', 'لاحقاً'],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        log.info('Starting in-process automated update...');
        const asset = release.assets.find(a => a.name.endsWith('-win.zip'));
        if (!asset) {
          throw new Error('لم يتم العثور على ملف التحديث (ZIP) في الإصدار.');
        }

        const win = showProgressWindow();
        
        const tempDir = app.getPath('temp');
        const zipPath = path.join(tempDir, 'murabha_update.zip');
        const extractPath = path.join(tempDir, 'murabha_update_extracted');

        log.info(`Downloading update from ${asset.browser_download_url} to ${zipPath}`);
        
        try {
          const response = await axios({
            method: 'GET',
            url: asset.browser_download_url,
            responseType: 'stream',
            onDownloadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                updateProgress(win, percent);
              }
            }
          });

          const writer = fs.createWriteStream(zipPath);
          response.data.pipe(writer);

          await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', reject);
          });

          log.info('Download complete. Extracting...');
          updateStatus(win, 'جاري فك الضغط... يرجى الانتظار (قد يستغرق بضع ثوان)');

          // Clean up old extraction dir if exists
          if (fs.existsSync(extractPath)) {
            fs.rmSync(extractPath, { recursive: true, force: true });
          }
          
          await extractZip(zipPath, { dir: extractPath });
          
          log.info('Extraction complete. Preparing update script...');
          updateStatus(win, 'جاري تطبيق التحديث...');

          // Generate simple batch script
          const batPath = path.join(tempDir, 'apply_murabha_update.bat');
          const targetDir = path.dirname(app.getPath('exe'));
          
          const batContent = `@echo off
chcp 65001 > nul
echo جاري تثبيت التحديث... يرجى عدم إغلاق هذه النافذة.
timeout /t 3 /nobreak > nul
xcopy /s /e /y "${extractPath}\\*" "${targetDir}\\"
start "" "${targetDir}\\Smart_Murabha.exe"
del "${zipPath}"
rmdir /s /q "${extractPath}"
del "%~f0"
`;
          fs.writeFileSync(batPath, batContent);
          
          log.info('Update script generated. Quitting app to apply...');
          
          exec(`start "" "${batPath}"`, (error) => {
            if (error) {
              log.error('Failed to run update script:', error);
            }
          });
          
          app.quit();
          
        } catch (downloadErr) {
          log.error('Update process failed:', downloadErr);
          win.close();
          dialog.showErrorBox('خطأ في التحديث', 'فشل في تحميل أو تطبيق التحديث. يرجى التحقق من اتصالك بالإنترنت.');
        }
      }
    } else if (manual) {
      dialog.showMessageBox({
        type: 'info',
        title: 'لا يوجد تحديث',
        message: 'أنت تستخدم أحدث إصدار بالفعل.',
        buttons: ['حسناً']
      });
    }
  } catch (err: any) {
    log.error('Update check failed:', err);
    if (manual) {
      dialog.showErrorBox('خطأ في التحديث', `تعذر الاتصال بخادم التحديث:\n${err.message}`);
    }
  }
}
