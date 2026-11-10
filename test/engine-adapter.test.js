'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EngineManager } = require('../engine-adapters/engine-manager');
const { ChromiumEngineAdapter } = require('../engine-adapters/chromium-engine');

class FakeContents {
  constructor() {
    this.id = 17;
    this.handlers = new Map();
    this.navigationHistory = {
      canGoBack: () => true,
      canGoForward: () => false,
      goBack() {},
      goForward() {}
    };
    this.debugger = {
      attached: false,
      isAttached: () => this.debugger.attached,
      attach: () => { this.debugger.attached = true; },
      sendCommand: async () => {},
      detach: () => { this.debugger.attached = false; }
    };
    this.closed = false;
    this.url = 'https://example.com/';
  }
  on(name, handler) {
    const listeners = this.handlers.get(name) || [];
    listeners.push(handler);
    this.handlers.set(name, listeners);
  }
  removeListener(name, handler) {
    this.handlers.set(name, (this.handlers.get(name) || []).filter((item) => item !== handler));
  }
  emit(name, ...args) {
    for (const handler of this.handlers.get(name) || []) handler(...args);
  }
  isDestroyed() { return this.closed; }
  getURL() { return this.url; }
  getTitle() { return 'Example'; }
  isLoading() { return false; }
  isCrashed() { return false; }
  loadURL(url) { this.url = url; return Promise.resolve(); }
  loadFile() { return Promise.resolve(); }
  reload() {}
  stop() {}
  focus() {}
  setWindowOpenHandler(handler) { this.popupHandler = handler; }
  isCurrentlyAudible() { return false; }
  isAudioMuted() { return false; }
  setAudioMuted() {}
  setZoomFactor() {}
  executeJavaScript() { return Promise.resolve('ok'); }
  insertCSS() { return Promise.resolve('css'); }
  viewSource() {}
  capturePage() { return Promise.resolve({}); }
  printToPDF() { return Promise.resolve(Buffer.from('pdf')); }
  getOSProcessId() { return 123; }
  getProcessMemoryInfo() { return Promise.resolve({ private: 10 }); }
  openDevTools() {}
  close() { this.closed = true; }
}

class FakeView {
  static instances = [];
  constructor(options) {
    this.options = options;
    this.webContents = new FakeContents();
    this.bounds = null;
    FakeView.instances.push(this);
  }
  setBounds(bounds) { this.bounds = bounds; }
}

class FakeWindow {
  constructor() {
    this.children = [];
    this.contentView = {
      addChildView: (view) => this.children.push(view),
      removeChildView: (view) => { this.children = this.children.filter((item) => item !== view); }
    };
  }
  isDestroyed() { return false; }
}

test('manager registers Chromium and reports its capabilities', () => {
  const manager = new EngineManager();
  manager.register(new ChromiumEngineAdapter(FakeView));
  assert.equal(manager.getDefaultEngineInfo().id, 'chromium');
  assert.equal(manager.listEngines()[0].capabilities.embeddedTabs, true);
});

test('manager rejects unknown and duplicate engines explicitly', () => {
  const manager = new EngineManager();
  const adapter = new ChromiumEngineAdapter(FakeView);
  manager.register(adapter);
  assert.throws(() => manager.register(adapter), /already registered/);
  assert.throws(() => manager.createTab({ engineId: 'gecko' }), /not installed or registered/);
});

test('Chromium tab handle owns navigation, view hosting and cleanup', async () => {
  const manager = new EngineManager();
  manager.register(new ChromiumEngineAdapter(FakeView));
  const tab = manager.createTab({ contextId: 'persist:test', preferences: { spellcheckEnabled: false } });
  const lastView = FakeView.instances.at(-1);
  assert.equal(lastView.options.webPreferences.partition, 'persist:test');
  assert.equal(lastView.options.webPreferences.nodeIntegration, false);
  assert.equal(lastView.options.webPreferences.sandbox, true);
  assert.equal(lastView.options.webPreferences.spellcheck, false);
  const window = new FakeWindow();

  assert.equal(tab.getURL(), 'https://example.com/');
  await tab.navigate('https://example.org/');
  assert.equal(tab.getURL(), 'https://example.org/');
  assert.equal(tab.navigationHistory.canGoBack(), true);

  tab.attachTo(window);
  tab.setBounds({ x: 0, y: 0, width: 800, height: 600 });
  assert.equal(window.children.length, 1);
  tab.detachFrom(window);
  assert.equal(window.children.length, 0);

  tab.close();
  assert.equal(tab.isDestroyed(), true);
});

test('normalized events expose values without leaking Electron event objects', () => {
  const manager = new EngineManager();
  manager.register(new ChromiumEngineAdapter(FakeView));
  const tab = manager.createTab();
  let receivedTitle = '';
  tab.on('title-changed', (title) => { receivedTitle = title; });
  FakeView.instances.at(-1).webContents.emit('page-title-updated', {}, 'Hello');
  assert.equal(receivedTitle, 'Hello');
});

test('cancellable events are translated through the adapter boundary', () => {
  const manager = new EngineManager();
  manager.register(new ChromiumEngineAdapter(FakeView));
  const tab = manager.createTab();
  let prevented = false;
  tab.on('before-navigate', (_url, control) => control.preventDefault());
  FakeView.instances.at(-1).webContents.emit('will-navigate', { preventDefault() { prevented = true; } }, 'https://blocked.example/');
  assert.equal(prevented, true);
});

test('cancellable input events expose the native input payload', () => {
  const manager = new EngineManager();
  manager.register(new ChromiumEngineAdapter(FakeView));
  const tab = manager.createTab();
  let receivedKey = '';
  tab.on('before-input', (input, cancellation) => {
    receivedKey = input.key;
    cancellation.preventDefault();
  });
  let prevented = false;
  FakeView.instances.at(-1).webContents.emit('before-input-event', { preventDefault() { prevented = true; } }, { type: 'keyDown', key: 'F12' });
  assert.equal(receivedKey, 'F12');
  assert.equal(prevented, true);
});
