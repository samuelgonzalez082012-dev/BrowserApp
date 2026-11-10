'use strict';

const { EventEmitter } = require('node:events');

class WebDriverBidiClient extends EventEmitter {
  constructor({ websocketUrl, WebSocketImpl = globalThis.WebSocket, commandTimeoutMs = 10000 } = {}) {
    super();
    if (!websocketUrl) throw new TypeError('A WebDriver BiDi websocketUrl is required.');
    if (typeof WebSocketImpl !== 'function') throw new Error('This Node.js runtime does not provide the WebSocket API.');
    this.websocketUrl = websocketUrl;
    this.WebSocketImpl = WebSocketImpl;
    this.commandTimeoutMs = commandTimeoutMs;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.session = null;
    this.closed = false;
  }

  async connect({ attempts = 30, retryDelayMs = 300 } = {}) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (this.closed) throw new Error('The WebDriver BiDi client was closed.');
      try {
        await this._openSocket();
        const response = await this.command('session.new', { capabilities: { alwaysMatch: {} } });
        this.session = response.result?.sessionId || null;
        await this.command('session.subscribe', {
          events: [
            'browsingContext.navigationStarted',
            'browsingContext.navigationCommitted',
            'browsingContext.domContentLoaded',
            'browsingContext.load',
            'browsingContext.navigationAborted',
            'browsingContext.navigationFailed',
            'browsingContext.contextCreated',
            'browsingContext.contextDestroyed'
          ]
        });
        return response;
      } catch (error) {
        lastError = error;
        this._disposeSocket();
        if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
    throw new Error(\`Could not establish a Firefox WebDriver BiDi session: \${lastError?.message || 'connection timed out'}\`);
  }

  _openSocket() {
    return new Promise((resolve, reject) => {
      const socket = new this.WebSocketImpl(this.websocketUrl);
      this.socket = socket;
      let settled = false;
      const timeout = setTimeout(() => finish(new Error('Timed out connecting to Firefox WebDriver BiDi.')), 5000);
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.removeEventListener?.('open', onOpen);
        socket.removeEventListener?.('error', onError);
        if (error) reject(error); else resolve();
      };
      const onOpen = () => finish();
      const onError = () => finish(new Error('Firefox WebDriver BiDi websocket is not ready yet.'));
      socket.addEventListener('open', onOpen, { once: true });
      socket.addEventListener('error', onError, { once: true });
      socket.addEventListener('message', (event) => this._onMessage(event.data));
      socket.addEventListener('close', () => {
        for (const entry of this.pending.values()) {
          clearTimeout(entry.timeout);
          entry.reject(new Error('Firefox WebDriver BiDi connection closed.'));
        }
        this.pending.clear();
        if (!this.closed) this.emit('disconnected');
      });
    });
  }

  _onMessage(raw) {
    let message;
    try { message = JSON.parse(typeof raw === 'string' ? raw : String(raw)); }
    catch { return; }
    if (message.type === 'event') {
      this.emit('event', message);
      this.emit(message.method, message.params || {});
      return;
    }
    if (message.type !== 'success' && message.type !== 'error') return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.type === 'error') pending.reject(new Error(\`\${message.error || 'BiDi error'}: \${message.message || 'Command failed'}\`));
    else pending.resolve(message);
  }

  command(method, params = {}) {
    if (!this.socket || this.socket.readyState !== 1) return Promise.reject(new Error('Firefox WebDriver BiDi is not connected.'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(\`Firefox BiDi command timed out: \${method}\`));
      }, this.commandTimeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async getTopLevelContext() {
    const response = await this.command('browsingContext.getTree', { maxDepth: 0 });
    const context = (response.result?.contexts || []).find((item) => !item.parent);
    if (!context?.context) throw new Error('Firefox started, but no top-level browsing context was found.');
    return context.context;
  }

  navigate(context, url) { return this.command('browsingContext.navigate', { context, url, wait: 'none' }); }
  reload(context) { return this.command('browsingContext.reload', { context, wait: 'none' }); }
  stop(context) { return this.command('browsingContext.stopLoad', { context }); }

  async evaluate(context, expression) {
    const response = await this.command('script.evaluate', {
      expression: String(expression), target: { context }, awaitPromise: true, resultOwnership: 'none'
    });
    if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text || 'Firefox script evaluation failed.');
    return response.result?.result?.value;
  }

  async screenshot(context) {
    const response = await this.command('browsingContext.captureScreenshot', { context });
    if (!response.result?.data) throw new Error('Firefox did not return a screenshot.');
    return Buffer.from(response.result.data, 'base64');
  }

  async close() {
    this.closed = true;
    try { this.socket?.close(1000, 'BrowserApp Firefox POC closing'); } catch {}
    this._disposeSocket();
  }

  _disposeSocket() {
    try { this.socket?.close(); } catch {}
    this.socket = null;
  }
}

module.exports = { WebDriverBidiClient };
