import { app, dialog, BrowserWindow } from 'electron';
import https from 'https';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

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

/**
 * Download file using https with redirect support.
 * GitHub download URLs redirect (302), so we follow them manually.
 */
function downloadFile(url: string, destPath: string, win: BrowserWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    const doGet = (currentUrl: string) => {
      const parsedUrl = new URL(currentUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: { 'User-Agent': 'Smart-Murabha-Updater' }
      };

      https.get(options, (res) => {
        // Follow redirects
        if (res.statusCode === 302 || res.statusCode === 301) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            log.info(`[Updater] Redirecting to: ${redirectUrl.substring(0, 80)}...`);
            doGet(redirectUrl);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            updateProgress(win, percent);
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          fs.unlinkSync(destPath);
          reject(err);
        });
      }).on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    };

    doGet(url);
  });
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
        log.info('Starting update process...');
        const asset = release.assets.find(a => a.name.endsWith('-win.zip'));
        if (!asset) {
          throw new Error('لم يتم العثور على ملف التحديث (ZIP) في الإصدار.');
        }

        const win = showProgressWindow();
        
        const tempDir = app.getPath('temp');
        const zipPath = path.join(tempDir, 'murabha_update.zip');
        const targetDir = path.dirname(app.getPath('exe'));

        log.info(`[Updater] Download URL: ${asset.browser_download_url}`);
        log.info(`[Updater] ZIP Path: ${zipPath}`);
        log.info(`[Updater] Target Dir: ${targetDir}`);
        
        try {
          // Step 1: Download the ZIP
          await downloadFile(asset.browser_download_url, zipPath, win);
          
          log.info(`[Updater] Download complete. ZIP size: ${fs.statSync(zipPath).size} bytes`);
          updateStatus(win, 'جاري تطبيق التحديث...');

          // Step 2: Generate a PowerShell update script
          // PowerShell handles ZIP extraction natively (no extract-zip dependency issues)
          // and can overwrite the running exe after it quits
          const ps1Path = path.join(tempDir, 'apply_murabha_update.ps1');
          
          const ps1Content = `
# Smart Murabha Auto-Update Script
$ErrorActionPreference = "Stop"
$zipPath = "${zipPath.replace(/\\/g, '\\\\')}"
$targetDir = "${targetDir.replace(/\\/g, '\\\\')}"
$exeName = "Smart_Murabha.exe"
$exePath = Join-Path $targetDir $exeName

Write-Host "Waiting for application to close..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# Kill the process if still running
Stop-Process -Name "Smart_Murabha" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Extracting update to $targetDir..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipPath -DestinationPath $targetDir -Force
    Write-Host "Update applied successfully!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    pause
    exit 1
}

# Clean up
Remove-Item $zipPath -ErrorAction SilentlyContinue

# Restart the application
if (Test-Path $exePath) {
    Write-Host "Starting application..." -ForegroundColor Green
    Start-Process -FilePath $exePath -WorkingDirectory $targetDir
} else {
    Write-Host "WARNING: Could not find $exePath" -ForegroundColor Yellow
}

Start-Sleep -Seconds 2
`;
          fs.writeFileSync(ps1Path, ps1Content, 'utf-8');
          
          log.info('[Updater] Update script created. Quitting app...');
          
          // Run the PowerShell script and quit
          exec(`powershell -ExecutionPolicy Bypass -File "${ps1Path}"`, (error) => {
            if (error) {
              log.error('[Updater] Failed to run update script:', error);
            }
          });

          // Give it a moment to start, then quit
          setTimeout(() => {
            app.quit();
          }, 1000);
          
        } catch (downloadErr: any) {
          log.error('[Updater] Update process failed:', downloadErr);
          if (win && !win.isDestroyed()) win.close();
          dialog.showErrorBox('خطأ في التحديث', `فشل في تحميل أو تطبيق التحديث:\n${downloadErr.message || downloadErr}`);
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
