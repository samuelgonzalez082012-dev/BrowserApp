'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { auditExtensionPermissions, summarizePrivacyState, sanitizeSecurityEvents, normalizeSecureDnsProvider } = require('../privacy-audit');

test('extension audit identifies high-risk host and browser-control permissions', () => {
  const audit = auditExtensionPermissions([{ id: 'x', name: 'Test', enabled: true, permissions: ['tabs','cookies','<all_urls>'] }])[0];
  assert.equal(audit.level, 'high');
  assert.ok(audit.risky.includes('cookies'));
  assert.ok(audit.risky.includes('<all_urls>'));
});
test('extension audit distinguishes moderate and low permission sets', () => {
  const result = auditExtensionPermissions([{ permissions: ['storage','activeTab'] }, { permissions: ['bookmarks'] }]);
  assert.equal(result[0].level, 'review');
  assert.equal(result[1].level, 'low');
});
test('privacy summary counts explicit permission decisions and extension risk', () => {
  const result = summarizePrivacyState({ permissions: { 'https://example.com': { camera: 'allow', location: 'deny' } }, extensions: [{ permissions: ['debugger'] }] });
  assert.equal(result.sitePermissionCount, 2);
  assert.equal(result.allowedPermissionCount, 1);
  assert.equal(result.highRiskExtensionCount, 1);
});
test('security event sanitizer bounds and filters data', () => {
  const result = sanitizeSecurityEvents([{ id: '1', type: 'permission', title: 'Granted', detail: 'x', at: 1, origin: 'https://example.com' }, { id: 2, type: 'bad' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].origin, 'https://example.com');
});
test('secure DNS provider is selected from a fixed allow-list', () => {
  assert.equal(normalizeSecureDnsProvider('cloudflare'), 'cloudflare');
  assert.equal(normalizeSecureDnsProvider('javascript:alert(1)'), 'system');
});
