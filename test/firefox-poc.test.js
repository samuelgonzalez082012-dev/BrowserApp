'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveFirefoxExecutable } = require('../firefox-poc/firefox-launcher');
const { normalizeWebUrl, FirefoxEngineAdapter } = require('../firefox-poc/firefox-engine');
const { WindowsWindowHost } = require('../firefox-poc/windows-window-host');

test('Firefox discovery honors an explicit executable override', () => {
  const executable = path.join('C:', 'Apps', 'Firefox', 'firefox.exe');
  const found = resolveFirefoxExecutable({
    platform: 'win32',
    env: { FIREFOX_PATH: executable },
    existsSync: (candidate) => candidate === executable
  });
  assert.equal(found, executable);
});

test('Firefox discovery checks standard Windows installation paths', () => {
  const expected = path.join('C:', 'Program Files', 'Mozilla Firefox', 'firefox.exe');
  const found = resolveFirefoxExecutable({
    platform: 'win32',
    env: { PROGRAMFILES: 'C:\\\\Program Files' },
    existsSync: (candidate) => candidate === expected
  });
  assert.equal(found, expected);
});

test('Firefox POC only accepts HTTP and HTTPS website navigation', () => {
  assert.equal(normalizeWebUrl('example.com'), 'https://example.com/');
  assert.equal(normalizeWebUrl('http://example.com/path'), 'http://example.com/path');
  assert.throws(() => normalizeWebUrl('file:///C:/secret.txt'), /limited to HTTP and HTTPS/);
  assert.throws(() => normalizeWebUrl('javascript:alert(1)'), /limited to HTTP and HTTPS/);
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
