'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { validatePluginManifest, pluginCompatibility, sanitizePluginRegistry, hasPermission } = require('../plugin-manager');

const root = path.resolve('/tmp/browser-plugins/demo');
const valid = { schemaVersion: 1, id: 'sample.demo', name: 'Sample', version: '1.2.0', entry: 'index.html', permissions: ['activeTab.read','notes.create'] };

test('validates plugin manifests and declared capability permissions', () => {
  const manifest = validatePluginManifest(valid, root);
  assert.equal(manifest.id, 'sample.demo');
  assert.deepEqual(manifest.permissions, ['activeTab.read','notes.create']);
});
test('rejects unsupported schema, invalid IDs, versions and permissions', () => {
  assert.throws(() => validatePluginManifest({ ...valid, schemaVersion: 2 }, root));
  assert.throws(() => validatePluginManifest({ ...valid, id: '../evil' }, root));
  assert.throws(() => validatePluginManifest({ ...valid, version: 'latest' }, root));
  assert.throws(() => validatePluginManifest({ ...valid, permissions: ['node.require'] }, root));
});
test('rejects absolute and traversal plugin entry paths', () => {
  assert.throws(() => validatePluginManifest({ ...valid, entry: '../outside.html' }, root));
  assert.throws(() => validatePluginManifest({ ...valid, entry: '/etc/passwd' }, root));
});
test('compatibility checks minimum browser version', () => {
  const manifest = { minAppVersion: '3.0.0' };
  assert.equal(pluginCompatibility(manifest, '2.9.0').compatible, false);
  assert.equal(pluginCompatibility(manifest, '3.0.0').compatible, true);
});
test('registry sanitizer and capability checks preserve only supported permissions', () => {
  const items = sanitizePluginRegistry([{ id: 'demo.plugin', path: '/tmp/demo', permissions: ['tabs.open','rawIpc'], enabled: true }, { id: '../bad', path: '/tmp/bad' }]);
  assert.equal(items.length, 1);
  assert.equal(hasPermission(items[0], 'tabs.open'), true);
  assert.equal(hasPermission(items[0], 'rawIpc'), false);
});
