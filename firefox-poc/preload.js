'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('firefoxPoc', {
  getState: () => ipcRenderer.invoke('firefox-poc:state'),
  navigate: (url) => ipcRenderer.invoke('firefox-poc:navigate', String(url || '')),
  back: () => ipcRenderer.invoke('firefox-poc:back'),
  forward: () => ipcRenderer.invoke('firefox-poc:forward'),
  reload: () => ipcRenderer.invoke('firefox-poc:reload'),
  focus: () => ipcRenderer.invoke('firefox-poc:focus'),
  onState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('firefox-poc:state', listener);
    return () => ipcRenderer.removeListener('firefox-poc:state', listener);
  }
});
