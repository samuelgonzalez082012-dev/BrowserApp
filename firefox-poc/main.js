'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { FirefoxEngineAdapter } = require('./firefox-engine');

let mainWindow = null;
let firefoxTab = null;
let adapter = null;
let closing = false;

function getFirefoxBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return { x: 0, y: 82, width: 1, height: 1 };
  const [width, height] = mainWindow.getContentSize();
  return { x: 0, y: 82, width: Math.max(1, width), height: Math.max(1, height - 82) };
}

function publishState(extra = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('firefox-poc:state', {
    connected: Boolean(firefoxTab && !firefoxTab.isDestroyed()),
    loading: Boolean(firefoxTab?.isLoading()),
    url: firefoxTab?.getURL() || '',
    title: firefoxTab?.getTitle() || 'Firefox proof of concept',
    processId: firefoxTab?.getOSProcessId() || 0,
    capabilities: adapter?.capabilities || {},
    ...extra
  });
}

async function closeFirefox() {
  if (closing) return;
  closing = true;
  try { await firefoxTab?.close(); } catch (error) { console.warn('Firefox cleanup:', error.message); }
  firefoxTab = null;
}

function registerIpc() {
  ipcMain.handle('firefox-poc:state', () => ({
    connected: Boolean(firefoxTab && !firefoxTab.isDestroyed()),
    loading: Boolean(firefoxTab?.isLoading()),
    url: firefoxTab?.getURL() || '',
    title: firefoxTab?.getTitle() || 'Firefox proof of concept',
    processId: firefoxTab?.getOSProcessId() || 0,
    capabilities: adapter?.capabilities || {}
  }));
  ipcMain.handle('firefox-poc:navigate', async (_event, value) => {
    try {
      await firefoxTab.navigate(value);
      publishState();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle('firefox-poc:back', () => ({ ok: Boolean(firefoxTab?.navigationHistory.goBack()) }));
  ipcMain.handle('firefox-poc:forward', () => ({ ok: Boolean(firefoxTab?.navigationHistory.goForward()) }));
  ipcMain.handle('firefox-poc:reload', async () => {
    try { await firefoxTab?.reload(); return { ok: true }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle('firefox-poc:focus', async () => {
    try { await firefoxTab?.host.focus(); return { ok: true }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}

async function startFirefox() {
  adapter = new FirefoxEngineAdapter({
    profileRoot: path.join(app.getPath('userData'), 'firefox-poc')
  });
  firefoxTab = adapter.createTab({ initialUrl: 'about:blank' });
  firefoxTab.on('title-changed', (title) => publishState({ title }));
  firefoxTab.on('navigated', (url) => publishState({ url }));
  firefoxTab.on('loading-started', () => publishState({ loading: true }));
  firefoxTab.on('loading-stopped', () => publishState({ loading: false }));
  firefoxTab.on('crashed', (details) => publishState({ connected: false, error: details.reason || 'Firefox stopped.' }));
  firefoxTab.on('host-error', (error) => publishState({ error: error.message }));

  await firefoxTab.ready;
  await firefoxTab.attachTo(mainWindow);
  await firefoxTab.host.setBounds(getFirefoxBounds());
  publishState({ message: 'Firefox connected through WebDriver BiDi and embedded using the Windows native window host.' });
}

app.whenReady().then(async () => {
  if (process.platform !== 'win32') {
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 760,
    minHeight: 520,
    title: 'BrowserApp — Firefox Gecko proof of concept',
    backgroundColor: '#11151d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  registerIpc();
  await mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('resize', () => {
    if (firefoxTab && !firefoxTab.isDestroyed()) firefoxTab.setBounds(getFirefoxBounds());
  });
  mainWindow.on('closed', () => { mainWindow = null; closeFirefox().finally(() => app.quit()); });

  try {
    await startFirefox();
  } catch (error) {
    console.error('Firefox proof of concept failed to start:', error);
    publishState({ connected: false, error: error.message });
  }
});

app.on('before-quit', (event) => {
  if (closing) return;
  event.preventDefault();
  closeFirefox().finally(() => app.exit(0));
});
app.on('window-all-closed', () => app.quit());
