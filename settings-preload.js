const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  get: () => ipcRenderer.invoke('settings:get'),
  save: (settings) => ipcRenderer.invoke('settings:save', settings),
  chooseWallpaper: () => ipcRenderer.invoke('settings:choose-wallpaper'),
  exportBackup: () => ipcRenderer.invoke('settings:export-backup'),
  importBackup: () => ipcRenderer.invoke('settings:import-backup'),
  openHub: (section) => ipcRenderer.invoke('settings:open-hub', String(section || 'workspaces'))
});
