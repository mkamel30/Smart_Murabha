import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getAppPath: () => ipcRenderer.invoke('app:getPath'),
  getNetworkURL: () => ipcRenderer.invoke('get-network-url'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  showSaveDialog: (options: unknown) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  showOpenDialog: (options: unknown) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, data: string) => ipcRenderer.invoke('fs:writeFile', filePath, data),
  onNotification: (callback: (notification: unknown) => void) => {
    ipcRenderer.on('notification', callback);
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
});

console.log('Preload script loaded');
