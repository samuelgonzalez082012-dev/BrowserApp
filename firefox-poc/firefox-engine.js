'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { EventEmitter } = require('node:events');
const { FirefoxLauncher } = require('./firefox-launcher');
const { WebDriverBidiClient } = require('./webdriver-bidi');
const { WindowsWindowHost } = require('./windows-window-host');

function normalizeWebUrl(value) {
  const input = String(value || '').trim();
  if (!input) throw new Error('Enter a website address.');
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : 'https://' + input;
  let parsed;
  try { parsed = new URL(candidate); } catch { throw new Error('Enter a valid website address.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('For safety, Firefox POC navigation is limited to HTTP and HTTPS websites.');
  }
  if (parsed.username || parsed.password) throw new Error('Website addresses containing embedded credentials are not accepted.');
  return parsed.href;
}

class FirefoxEngineTab extends EventEmitter {
  constructor({ launcher, host, initialUrl = 'about:blank' }) {
    super();
    this.engineId = 'firefox';
    this.launcher = launcher;
    this.host = host;
    this.initialUrl = initialUrl;
    this.client = null;
    this.contextId = null;
    this.sessionInfo = null;
    this._url = 'about:blank';
    this._title = 'Firefox';
    this._loading = false;
    this._closed = false;
    this._history = ['about:blank'];
    this._historyIndex = 0;
    this.ready = this._initialize();
  }

  async _initialize() {
    this.sessionInfo = await this.launcher.launch();
    this.client = new WebDriverBidiClient({ websocketUrl: this.sessionInfo.websocketUrl });
    await this.client.connect();
    this.contextId = await this.client.getTopLevelContext();
    this._bindProtocolEvents();
    if (this.initialUrl && this.initialUrl !== 'about:blank') await this.navigate(this.initialUrl);
    return this;
  }

  _bindProtocolEvents() {
    const belongsToTab = (params) => !params.context || params.context === this.contextId;
    this.client.on('browsingContext.navigationStarted', (params) => {
      if (!belongsToTab(params)) return;
      this._loading = true;
      if (params.url) this._recordUrl(params.url);
      this.emit('loading-started');
    });
    this.client.on('browsingContext.navigationCommitted', (params) => {
      if (!belongsToTab(params)) return;
      const url = params.url || this._url;
      this._recordUrl(url);
      this.emit('navigated', url);
    });
    this.client.on('browsingContext.domContentLoaded', (params) => {
      if (!belongsToTab(params)) return;
      this._refreshTitle();
      this.emit('dom-ready');
    });
    this.client.on('browsingContext.load', (params) => {
      if (!belongsToTab(params)) return;
      this._loading = false;
      this._refreshTitle();
      this.emit('loading-stopped');
      this.emit('loaded');
    });
    this.client.on('browsingContext.navigationAborted', (params) => {
      if (!belongsToTab(params)) return;
      this._loading = false;
      this.emit('load-failed', { code: -1, description: 'Navigation was aborted.', url: params.url || this._url, isMainFrame: true });
      this.emit('loading-stopped');
    });
    this.client.on('browsingContext.navigationFailed', (params) => {
      if (!belongsToTab(params)) return;
      this._loading = false;
      this.emit('load-failed', { code: -1, description: 'Firefox reported a navigation failure.', url: params.url || this._url, isMainFrame: true });
      this.emit('loading-stopped');
    });
    this.client.on('disconnected', () => {
      if (!this._closed) {
        this._closed = true;
        this.emit('crashed', { reason: 'Firefox WebDriver BiDi connection closed.' });
      }
    });
    this.launcher.child?.on('exit', (code, signal) => {
      if (this._closed) return;
      this._closed = true;
      this.emit('crashed', { reason: 'Firefox process exited.', exitCode: code, signal });
    });
  }

  _recordUrl(url) {
    if (!url) return;
    const existingIndex = this._history.indexOf(url);
    if (existingIndex >= 0) {
      this._historyIndex = existingIndex;
      this._url = url;
      return;
    }
    this._history = this._history.slice(0, this._historyIndex + 1);
    this._history.push(url);
    this._historyIndex = this._history.length - 1;
    this._url = url;
  }

  async _refreshTitle() {
    if (this.isDestroyed() || !this.contextId) return;
    try {
      const title = await this.client.evaluate(this.contextId, 'document.title');
      if (typeof title === 'string' && title) this._title = title;
      this.emit('title-changed', this._title);
    } catch {}
  }

  get id() { return this.sessionInfo?.pid || 0; }
  isDestroyed() { return this._closed || !this.launcher.isRunning(); }
  isCrashed() { return this.isDestroyed(); }
  getURL() { return this._url; }
  getTitle() { return this._title; }
  isLoading() { return this._loading; }
  isCurrentlyAudible() { return false; }
  isAudioMuted() { return false; }
  setAudioMuted() {}
  setZoomFactor(factor) {
    if (!this.isDestroyed()) this.executeJavaScript('document.documentElement.style.zoom = ' + JSON.stringify(String(Number(factor) || 1))).catch(() => {});
  }

  get navigationHistory() {
    return {
      canGoBack: () => this._historyIndex > 0,
      canGoForward: () => this._historyIndex < this._history.length - 1,
      goBack: () => {
        if (!this.navigationHistory.canGoBack()) return false;
        this._historyIndex -= 1;
        this._navigateHistory(this._history[this._historyIndex]);
        return true;
      },
      goForward: () => {
        if (!this.navigationHistory.canGoForward()) return false;
        this._historyIndex += 1;
        this._navigateHistory(this._history[this._historyIndex]);
        return true;
      }
    };
  }

  _navigateHistory(url) {
    if (this.isDestroyed()) return;
    this.client.evaluate(this.contextId, 'location.href = ' + JSON.stringify(url)).catch(() => {});
  }

  on(eventName, listener) {
    super.on(eventName, listener);
    return () => this.removeListener(eventName, listener);
  }

  async navigate(url) {
    await this.ready;
    if (this.isDestroyed()) throw new Error('The Firefox tab is closed.');
    const safeUrl = normalizeWebUrl(url);
    this._loading = true;
    return this.client.navigate(this.contextId, safeUrl);
  }

  async loadInternalFile(filePath, options = {}) {
    await this.ready;
    if (this.isDestroyed()) throw new Error('The Firefox tab is closed.');
    const url = new URL(pathToFileURL(path.resolve(filePath)).href);
    for (const [key, value] of Object.entries(options.query || {})) url.searchParams.set(key, String(value));
    this._loading = true;
    return this.client.navigate(this.contextId, url.href);
  }

  async reload() {
    await this.ready;
    if (!this.isDestroyed()) { this._loading = true; return this.client.reload(this.contextId); }
  }

  async stop() {
    await this.ready;
    if (!this.isDestroyed()) return this.client.stop(this.contextId);
  }

  focus() {
    if (!this.isDestroyed()) this.host.focus().catch((error) => this.emit('host-error', error));
  }

  setBounds(bounds) {
    if (!this.isDestroyed()) this.host.setBounds(bounds).catch((error) => this.emit('host-error', error));
  }

  async attachTo(window) {
    await this.ready;
    if (this.isDestroyed() || !window || window.isDestroyed?.()) return false;
    const handle = window.getNativeWindowHandle();
    const parentHandle = handle.length >= 8 ? handle.readBigUInt64LE(0).toString(16) : handle.readUInt32LE(0).toString(16);
    await this.host.attach({
      processId: this.sessionInfo.pid,
      parentHandle,
      bounds: { x: 0, y: 82, width: 900, height: 600 }
    });
    return true;
  }

  detachFrom() {
    this.host.detach().catch((error) => this.emit('host-error', error));
    return true;
  }

  setPopupHandler() {}
  async executeJavaScript(source) {
    await this.ready;
    if (this.isDestroyed()) throw new Error('The Firefox tab is closed.');
    return this.client.evaluate(this.contextId, String(source));
  }
  async insertCSS(css) {
    const source = '(() => { const style = document.createElement("style"); style.textContent = ' +
      JSON.stringify(String(css)) + '; document.documentElement.appendChild(style); return true; })()';
    return this.executeJavaScript(source);
  }
  async capturePage() {
    await this.ready;
    const png = await this.client.screenshot(this.contextId);
    return { toPNG: () => Buffer.from(png) };
  }
  getOSProcessId() { return this.sessionInfo?.pid || 0; }
  getProcessMemoryInfo() { return Promise.resolve(null); }
  viewSource() {
    if (this._url.startsWith('http:') || this._url.startsWith('https:')) {
      this.client.navigate(this.contextId, 'view-source:' + this._url).catch(() => {});
    }
  }
  async printToPDF() { throw new Error('PDF export is not implemented in the Firefox proof of concept.'); }
  async setJavaScriptEnabled() { throw new Error('Per-tab JavaScript control is not implemented in the Firefox proof of concept.'); }
  detachDebugger() {}
  openDevTools() { throw new Error('Firefox Developer Tools are not controlled by this proof of concept.'); }

  async close() {
    if (this._closed) return;
    this._closed = true;
    try { await this.host.detach(); } catch {}
    try { await this.host.close(); } catch {}
    try { await this.client?.command('browser.close', {}); } catch {}
    try { await this.client?.close(); } catch {}
    await this.launcher.close();
    this.emit('closed');
  }
}

class FirefoxEngineAdapter {
  constructor({ profileRoot, host = new WindowsWindowHost(), executable = null } = {}) {
    if (!profileRoot) throw new TypeError('FirefoxEngineAdapter requires a profileRoot.');
    this.id = 'firefox';
    this.name = 'Firefox';
    this.family = 'gecko';
    this.runtime = 'Firefox desktop + WebDriver BiDi + Windows SetParent (experimental)';
    this.capabilities = Object.freeze({
      embeddedTabs: 'experimental-single-window',
      navigation: true,
      pageTitle: true,
      pageCapture: true,
      pdfExport: false,
      processMetrics: false,
      developerTools: false,
      audioState: false,
      zoom: 'css-only',
      popupControl: false,
      profileIsolation: 'dedicated-firefox-profile'
    });
    this.profileRoot = profileRoot;
    this.host = host;
    this.executable = executable;
    this.activeTab = null;
  }

  createTab({ initialUrl = 'about:blank' } = {}) {
    if (this.activeTab && !this.activeTab.isDestroyed()) {
      throw new Error('The Firefox proof of concept currently supports one embedded Firefox window at a time.');
    }
    const launcher = new FirefoxLauncher({ profileRoot: this.profileRoot, executable: this.executable });
    const tab = new FirefoxEngineTab({ launcher, host: this.host, initialUrl });
    this.activeTab = tab;
    return tab;
  }
}

module.exports = { FirefoxEngineAdapter, FirefoxEngineTab, normalizeWebUrl };
