'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const browserAPI = {
  getState: () => ipcRenderer.invoke('browser:get-state'),
  newTab: () => ipcRenderer.invoke('browser:new-tab'),
  newPrivateTab: () => ipcRenderer.invoke('browser:new-private-tab'),
  closeTab: (id) => ipcRenderer.invoke('browser:close-tab', String(id)),
  switchTab: (id) => ipcRenderer.invoke('browser:switch-tab', String(id)),
  reorderTabs: (sourceId, targetId) => ipcRenderer.invoke('browser:reorder-tabs', String(sourceId), String(targetId)),
  moveTabToContainer: (tabId, containerId) => ipcRenderer.invoke('browser:move-tab-container', String(tabId), String(containerId)),
  navigate: (value) => ipcRenderer.invoke('browser:navigate', String(value)),
  back: () => ipcRenderer.invoke('browser:back'),
  forward: () => ipcRenderer.invoke('browser:forward'),
  reload: () => ipcRenderer.invoke('browser:reload'),
  stop: () => ipcRenderer.invoke('browser:stop'),
  home: () => ipcRenderer.invoke('browser:home'),
  togglePanel: (section) => ipcRenderer.invoke('browser:toggle-panel', String(section || 'workspaces')),
  toggleBookmark: () => ipcRenderer.invoke('browser:toggle-bookmark'),
  tabAction: (id, action) => ipcRenderer.invoke('browser:tab-action', String(id), String(action)),
  reopenClosed: () => ipcRenderer.invoke('browser:reopen-closed'),
  openSettings: () => ipcRenderer.invoke('browser:open-settings'),
  setSplit: (id) => ipcRenderer.invoke('browser:set-split', id ? String(id) : ''),
  command: (command, payload = {}) => ipcRenderer.invoke('browser:command', String(command), payload),
  onState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('browser:state', listener);
    return () => ipcRenderer.removeListener('browser:state', listener);
  }
};
contextBridge.exposeInMainWorld('browserAPI', browserAPI);
