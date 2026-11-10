'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const pluginArgument = process.argv.find((argument) => argument.startsWith('--browser-plugin-id='));
const pluginId = pluginArgument ? pluginArgument.slice('--browser-plugin-id='.length) : '';

function invoke(capability, payload = {}) {
  return ipcRenderer.invoke('plugin:invoke', pluginId, capability, payload);
}

contextBridge.exposeInMainWorld('pluginAPI', Object.freeze({
  getActiveTab: () => invoke('activeTab.read'),
  openTab: (url) => invoke('tabs.open', { url: String(url || '') }),
  saveNote: (title, content) => invoke('notes.create', { title: String(title || ''), content: String(content || '') }),
  showNotification: (title, body) => invoke('notifications.show', { title: String(title || ''), body: String(body || '') }),
  openExternal: (url) => invoke('external.open', { url: String(url || '') })
}));
