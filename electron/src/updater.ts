import { app, dialog, shell } from 'electron';
import https from 'https';
import log from 'electron-log';

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
        buttons: ['تحميل التحديث', 'لاحقاً'],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        // Try to find the exe or zip asset
        const asset = release.assets.find(a => a.name.endsWith('.exe') || a.name.endsWith('-win.zip'));
        if (asset) {
          shell.openExternal(asset.browser_download_url);
        } else {
          shell.openExternal(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
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
