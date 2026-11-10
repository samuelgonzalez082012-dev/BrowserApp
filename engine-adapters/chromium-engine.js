'use strict';

/**
 * Chromium implementation of BrowserApp's engine-tab contract.
 *
 * Electron-specific objects (WebContentsView and WebContents) remain private
 * to this adapter. The rest of the application works with the handle methods
 * below and does not need to know how Chromium is hosted.
 */

const EVENT_BINDINGS = {
  'title-changed': ['page-title-updated', (_event, title) => [title]],
  'favicon-changed': ['page-favicon-updated', (_event, favicons) => [favicons]],
  'loading-started': ['did-start-loading', () => []],
  'unresponsive': ['unresponsive', () => []],
  'responsive': ['responsive', () => []],
  'loading-stopped': ['did-stop-loading', () => []],
  'navigated': ['did-navigate', (_event, url) => [url]],
  'navigated-in-page': ['did-navigate-in-page', (_event, url) => [url]],
  'load-failed': ['did-fail-load', (_event, code, description, url, isMainFrame, frameProcessId, frameRoutingId) => [{
    code,
    description,
    url,
    isMainFrame: Boolean(isMainFrame),
    frameProcessId,
    frameRoutingId
  }]],
  'loaded': ['did-finish-load', () => []],
  'media-started': ['media-started-playing', () => []],
  'media-paused': ['media-paused', () => []],
  'context-menu': ['context-menu', (_event, params) => [params]],
  'dom-ready': ['dom-ready', () => []],
  'crashed': ['render-process-gone', (_event, details = {}) => [details]]
};

function bindCancellable(contents, nativeEventName, listener, projectArgs) {
  const nativeListener = (event, ...nativeArgs) => {
    let prevented = false;
    const cancellation = {
      preventDefault() { prevented = true; },
      get defaultPrevented() { return prevented; }
    };

    const args = projectArgs(...nativeArgs);
    const result = listener(...args, cancellation);
    if (result === false) prevented = true;
    if (prevented) event.preventDefault();
  };

  contents.on(nativeEventName, nativeListener);
  return () => contents.removeListener(nativeEventName, nativeListener);
}

class ChromiumEngineTab {
  constructor(view) {
    this.engineId = 'chromium';
    this._view = view;
    this._contents = view.webContents;
    this._hostWindow = null;
    this._scriptExecutionDisabled = false;
    this._closed = false;
  }

  get id() {
    return this._contents.id;
  }

  isDestroyed() {
    return this._closed || this._contents.isDestroyed();
  }

  getURL() {
    return this.isDestroyed() ? '' : this._contents.getURL();
  }

  getTitle() {
    return this.isDestroyed() ? '' : this._contents.getTitle();
  }

  isLoading() {
    return !this.isDestroyed() && this._contents.isLoading();
  }

  isCrashed() {
    return this.isDestroyed() || Boolean(this._contents.isCrashed?.());
  }

  get navigationHistory() {
    if (this.isDestroyed()) {
      return {
        canGoBack: () => false,
        canGoForward: () => false,
        goBack: () => false,
        goForward: () => false
      };
    }

    const history = this._contents.navigationHistory;
    return {
      canGoBack: () => history.canGoBack(),
      canGoForward: () => history.canGoForward(),
      goBack: () => history.canGoBack() && history.goBack(),
      goForward: () => history.canGoForward() && history.goForward()
    };
  }

  on(eventName, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Engine event listeners must be functions.');
    }
    if (this.isDestroyed()) return () => {};

    if (eventName === 'before-input') {
      return bindCancellable(this._contents, 'before-input-event', listener, (input) => [input]);
    }
    if (eventName === 'before-navigate') {
      return bindCancellable(this._contents, 'will-navigate', listener, (url) => [url]);
    }
    if (eventName === 'before-redirect') {
      return bindCancellable(this._contents, 'will-redirect', listener, (url) => [url]);
    }

    const binding = EVENT_BINDINGS[eventName];
    if (!binding) {
      throw new Error(`Unsupported engine-tab event: ${eventName}`);
    }

    const [nativeEventName, projectArgs] = binding;
    const nativeListener = (...nativeArgs) => listener(...projectArgs(...nativeArgs));
    this._contents.on(nativeEventName, nativeListener);
    return () => this._contents.removeListener(nativeEventName, nativeListener);
  }

  navigate(url) {
    if (this.isDestroyed()) return Promise.reject(new Error('The browser tab is closed.'));
    return this._contents.loadURL(String(url));
  }

  loadInternalFile(filePath, options = {}) {
    if (this.isDestroyed()) return Promise.reject(new Error('The browser tab is closed.'));
    return this._contents.loadFile(filePath, options);
  }

  reload() {
    if (!this.isDestroyed()) this._contents.reload();
  }

  stop() {
    if (!this.isDestroyed()) this._contents.stop();
  }

  focus() {
    if (!this.isDestroyed()) this._contents.focus();
  }

  setBounds(bounds) {
    if (!this.isDestroyed()) this._view.setBounds(bounds);
  }

  attachTo(window) {
    if (this.isDestroyed() || !window || window.isDestroyed?.()) return false;
    if (this._hostWindow === window) return true;

    if (this._hostWindow) this.detachFrom(this._hostWindow);
    window.contentView.addChildView(this._view);
    this._hostWindow = window;
    return true;
  }

  detachFrom(window = this._hostWindow) {
    if (!window || this._hostWindow !== window) return false;
    try {
      if (!window.isDestroyed?.()) window.contentView.removeChildView(this._view);
    } catch {
      // The view may already have been detached during a window transition.
    }
    this._hostWindow = null;
    return true;
  }

  setPopupHandler(handler) {
    if (this.isDestroyed()) return;
    this._contents.setWindowOpenHandler((details) => ({
      action: handler({ url: details.url, frameName: details.frameName }) === true ? 'allow' : 'deny'
    }));
  }

  isCurrentlyAudible() {
    return !this.isDestroyed() && this._contents.isCurrentlyAudible();
  }

  isAudioMuted() {
    return !this.isDestroyed() && this._contents.isAudioMuted();
  }

  setAudioMuted(muted) {
    if (!this.isDestroyed()) this._contents.setAudioMuted(Boolean(muted));
  }

  setZoomFactor(factor) {
    if (!this.isDestroyed()) this._contents.setZoomFactor(Number(factor) || 1);
  }

  executeJavaScript(source, userGesture = false) {
    if (this.isDestroyed()) return Promise.reject(new Error('The browser tab is closed.'));
    return this._contents.executeJavaScript(source, Boolean(userGesture));
  }

  insertCSS(css, options = {}) {
    if (this.isDestroyed()) return Promise.reject(new Error('The browser tab is closed.'));
    return this._contents.insertCSS(css, options);
  }

  viewSource() {
    if (!this.isDestroyed()) this._contents.viewSource();
  }

  capturePage() {
    if (this.isDestroyed()) return Promise.reject(new Error('The browser tab is closed.'));
    return this._contents.capturePage();
  }

  printToPDF(options = {}) {
    if (this.isDestroyed()) return Promise.reject(new Error('The browser tab is closed.'));
    return this._contents.printToPDF(options);
  }

  getOSProcessId() {
    return this.isDestroyed() ? 0 : this._contents.getOSProcessId();
  }

  getProcessMemoryInfo() {
    if (this.isDestroyed()) return Promise.resolve(null);
    return this._contents.getProcessMemoryInfo();
  }

  async setJavaScriptEnabled(enabled) {
    if (this.isDestroyed()) throw new Error('The browser tab is closed.');
    const debuggerRef = this._contents.debugger;
    const shouldDisable = !Boolean(enabled);

    if (shouldDisable) {
      if (!debuggerRef.isAttached()) debuggerRef.attach('1.3');
      await debuggerRef.sendCommand('Emulation.setScriptExecutionDisabled', { value: true });
      this._scriptExecutionDisabled = true;
      return;
    }

    if (this._scriptExecutionDisabled && debuggerRef.isAttached()) {
      await debuggerRef.sendCommand('Emulation.setScriptExecutionDisabled', { value: false });
      debuggerRef.detach();
    }
    this._scriptExecutionDisabled = false;
  }

  detachDebugger() {
    if (this.isDestroyed()) return;
    try {
      const debuggerRef = this._contents.debugger;
      if (debuggerRef.isAttached()) debuggerRef.detach();
    } catch {
      // Debugger detachment is best-effort during tab cleanup.
    }
    this._scriptExecutionDisabled = false;
  }

  openDevTools() {
    if (this.isDestroyed()) return;
    this.detachDebugger();
    this._contents.openDevTools({ mode: 'detach' });
  }

  close() {
    if (this._closed) return;
    this.detachFrom();
    this.detachDebugger();
    this._closed = true;
    if (!this._contents.isDestroyed()) this._contents.close();
  }
}

class ChromiumEngineAdapter {
  constructor(WebContentsView) {
    if (typeof WebContentsView !== 'function') {
      throw new TypeError('ChromiumEngineAdapter requires Electron WebContentsView.');
    }

    this.id = 'chromium';
    this.name = 'Chromium';
    this.family = 'chromium';
    this.runtime = 'Electron WebContentsView';
    this.capabilities = Object.freeze({
      embeddedTabs: true,
      navigation: true,
      scriptExecutionControl: true,
      pageCapture: true,
      pdfExport: true,
      processMetrics: true,
      developerTools: true,
      audioState: true,
      zoom: true,
      popupControl: true
    });
    this.WebContentsView = WebContentsView;
  }

  createTab({ contextId, preferences = {} } = {}) {
    // Electron-specific security and storage settings live here rather than in
    // BrowserApp's engine-neutral tab manager.
    const webPreferences = {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: preferences.spellcheckEnabled !== false
    };

    if (typeof contextId === 'string' && contextId.trim()) {
      // BrowserApp passes a stable context identifier. Chromium maps that
      // identifier to Electron's session partition; another engine can map it
      // to its own profile/container mechanism.
      webPreferences.partition = contextId;
    }

    const view = new this.WebContentsView({ webPreferences });
    return new ChromiumEngineTab(view);
  }
}

module.exports = { ChromiumEngineAdapter, ChromiumEngineTab };
