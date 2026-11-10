'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveFirefoxExecutable } = require('../firefox-poc/firefox-launcher');
const { normalizeWebUrl, FirefoxEngineAdapter } = require('../firefox-poc/firefox-engine');
const { WindowsWindowHost } = require('../firefox-poc/windows-window-host');
const { WebDriverBidiClient } = require('../firefox-poc/webdriver-bidi');

class MockWebSocket extends EventTarget {
  constructor() {
    super();
    this.readyState = 0;
    queueMicrotask(() => {
      this.readyState = 1;
      this.dispatchEvent(new Event('open'));
    });
  }

  send(raw) {
    const command = JSON.parse(raw);
    const payloads = {
      'session.new': { sessionId: 'session-1', capabilities: {} },
      'session.subscribe': {},
      'browsingContext.getTree': { contexts: [{ context: 'context-1' }] },
      'script.evaluate': { realm: 'realm-1', result: { type: 'string', value: 'Example title' } },
      'browsingContext.captureScreenshot': { data: Buffer.from('png').toString('base64') }
    };
    queueMicrotask(() => {
      this.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ type: 'success', id: command.id, result: payloads[command.method] || {} })
      }));
    });
  }

  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
}

test('Firefox discovery honors an explicit executable override', () => {
  const executable = path.win32.join('C:', 'Apps', 'Firefox', 'firefox.exe');
  const found = resolveFirefoxExecutable({
    platform: 'win32',
    env: { FIREFOX_PATH: executable },
    existsSync: (candidate) => candidate === executable
  });
  assert.equal(found, executable);
});

test('Firefox discovery checks standard Windows installation paths', () => {
  const expected = path.win32.join('C:/Program Files', 'Mozilla Firefox', 'firefox.exe');
  const found = resolveFirefoxExecutable({
    platform: 'win32',
    env: { PROGRAMFILES: 'C:/Program Files' },
    existsSync: (candidate) => candidate === expected
  });
  assert.equal(found, expected);
});

test('Firefox POC only accepts HTTP and HTTPS website navigation', () => {
  assert.equal(normalizeWebUrl('example.com'), 'https://example.com/');
  assert.equal(normalizeWebUrl('http://example.com/path'), 'http://example.com/path');
  assert.throws(() => normalizeWebUrl('file:///C:/secret.txt'), /limited to HTTP and HTTPS/);
  assert.throws(() => normalizeWebUrl('javascript:alert(1)'), /limited to HTTP and HTTPS/);
  assert.throws(() => normalizeWebUrl('https://user:pass@example.com'), /embedded credentials/);
  assert.throws(() => normalizeWebUrl(''), /Enter a website address/);
});

test('Firefox adapter exposes Gecko metadata and truthful capability limits', () => {
  const adapter = new FirefoxEngineAdapter({ profileRoot: path.join('tmp', 'firefox-profile') });
  assert.equal(adapter.id, 'firefox');
  assert.equal(adapter.family, 'gecko');
  assert.equal(adapter.capabilities.embeddedTabs, 'experimental-single-window');
  assert.equal(adapter.capabilities.pdfExport, false);
  assert.throws(() => new FirefoxEngineAdapter({}), /profileRoot/);
});

test('native Firefox embedding refuses unsupported platforms', () => {
  const host = new WindowsWindowHost({ platform: 'linux' });
  assert.throws(() => host.attach({ processId: 1, parentHandle: '1', bounds: { x: 0, y: 0, width: 1, height: 1 } }), /Windows-only/);
});

test('WebDriver BiDi client parses command results and screenshot payloads', async () => {
  const client = new WebDriverBidiClient({
    websocketUrl: 'ws://127.0.0.1:4444/session',
    WebSocketImpl: MockWebSocket,
    commandTimeoutMs: 1000
  });
  await client.connect({ attempts: 1 });
  assert.equal(client.session, 'session-1');
  assert.equal(await client.getTopLevelContext(), 'context-1');
  assert.equal(await client.evaluate('context-1', 'document.title'), 'Example title');
  assert.equal((await client.screenshot('context-1')).toString(), 'png');
  await client.close();
});
