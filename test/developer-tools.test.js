'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getViewportPreset, inspectJson, summarizePageStructure, filterNetworkLog } = require('../developer-tools');

test('device presets are explicit and unknown presets are rejected', () => {
  assert.deepEqual(getViewportPreset('mobile'), { id: 'mobile', label: 'Mobile', width: 375, height: 812 });
  assert.equal(getViewportPreset('unknown'), null);
});
test('JSON inspector parses structured data and reports shape', () => {
  const result = inspectJson('{"name":"Browser","features":["tabs","privacy"]}');
  assert.equal(result.kind, 'object');
  assert.deepEqual(result.keys, ['name','features']);
  assert.match(result.pretty, /"features"/);
});
test('JSON inspector rejects invalid and oversized input', () => {
  assert.throws(() => inspectJson('{bad'));
  assert.throws(() => inspectJson(''));
});
test('page structure summary bounds and normalizes page metadata', () => {
  const summary = summarizePageStructure({ title: 'Example', url: 'https://example.com', headings: [{ level: 2, text: 'Heading' }], links: [{ text: 'Home', url: 'https://example.com' }], forms: 2 });
  assert.equal(summary.counts.headings, 1);
  assert.equal(summary.counts.forms, 2);
  assert.equal(summary.headings[0].level, 2);
});
test('network log filtering supports query, resource type and status', () => {
  const rows = [{ url: 'https://example.com/a.js', method: 'GET', resourceType: 'script', status: 'completed:200' }, { url: 'https://example.com/image.png', method: 'GET', resourceType: 'image', status: 'error:failed' }];
  assert.equal(filterNetworkLog(rows, 'example', 'script', 'completed').length, 1);
  assert.equal(filterNetworkLog(rows, '', 'image', 'error').length, 1);
});
