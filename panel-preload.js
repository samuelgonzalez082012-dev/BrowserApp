'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const panelAPI = {
  getState: () => ipcRenderer.invoke('panel:get-state'),
  action: (name, payload = {}) => ipcRenderer.invoke('panel:action', name, payload),
  chooseExtension: () => ipcRenderer.invoke('panel:choose-extension'),
  removeExtension: (id) => ipcRenderer.invoke('panel:remove-extension', String(id)),
  setExtensionEnabled: (id, enabled) => ipcRenderer.invoke('panel:extension-enabled', String(id), Boolean(enabled)),
  reloadExtension: (id) => ipcRenderer.invoke('panel:extension-reload', String(id)),
  setPermission: (origin, permission, allowed) => ipcRenderer.invoke('panel:set-permission', origin, permission, Boolean(allowed)),
  configureAI: (config) => ipcRenderer.invoke('panel:ai-configure', config),
  askAI: (request) => ipcRenderer.invoke('panel:ai-ask', request),
  performance: () => ipcRenderer.invoke('panel:performance'),
  close: () => ipcRenderer.invoke('panel:close'),
  setSection: (section) => ipcRenderer.invoke('panel:set-section', section),
  onState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('panel:state', listener);
    return () => ipcRenderer.removeListener('panel:state', listener);
  }
};
contextBridge.exposeInMainWorld('panelAPI', panelAPI);
