'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeContainerDomain, resolveContainerForUrl } = require('../container-routing');

const containers = [{ id: 'default' }, { id: 'work' }, { id: 'personal' }, { id: 'banking' }];

test('normalizes supported domain inputs and rejects malformed hostnames', () => {
  assert.equal(normalizeContainerDomain(' Example.COM '), 'example.com');
  assert.equal(normalizeContainerDomain('https://Example.com/path?q=1'), 'example.com');
  assert.equal(normalizeContainerDomain('*.example.com'), 'example.com');
  assert.equal(normalizeContainerDomain('.example.com.'), 'example.com');
  for (const value of ['', 'https://', 'bad domain.example', '-invalid.example', 'example..com', 'x'.repeat(254)]) assert.equal(normalizeContainerDomain(value), '');
});

test('routes exact domain matches to their assigned container', () => {
  assert.equal(resolveContainerForUrl('https://example.com/page', [{ domain: 'example.com', containerId: 'work' }], containers), 'work');
});

test('subdomain matching defaults to enabled and can be disabled', () => {
  const enabled = [{ domain: 'example.com', containerId: 'work' }];
  const disabled = [{ domain: 'example.com', containerId: 'work', includeSubdomains: false }];
  assert.equal(resolveContainerForUrl('https://mail.example.com', enabled, containers), 'work');
  assert.equal(resolveContainerForUrl('https://mail.example.com', disabled, containers), 'default');
});

test('the most specific matching domain wins', () => {
  const rules = [{ domain: 'example.com', containerId: 'work' }, { domain: 'accounts.example.com', containerId: 'banking' }];
  assert.equal(resolveContainerForUrl('https://login.accounts.example.com', rules, containers), 'banking');
});

test('disabled, malformed and stale rules are ignored', () => {
  const rules = [{ domain: 'example.com', containerId: 'work', enabled: false }, { domain: 'example.com', containerId: 'missing' }, { domain: 'bad domain', containerId: 'personal' }];
  assert.equal(resolveContainerForUrl('https://example.com', rules, containers), 'default');
});

test('invalid URLs and non-web protocols safely use the fallback', () => {
  const rules = [{ domain: 'example.com', containerId: 'work' }];
  assert.equal(resolveContainerForUrl('not a url', rules, containers), 'default');
  assert.equal(resolveContainerForUrl('file:///tmp/example.com', rules, containers), 'default');
  assert.equal(resolveContainerForUrl('about:blank', rules, containers), 'default');
});

test('unknown fallback IDs resolve to the Default container', () => {
  assert.equal(resolveContainerForUrl('https://unknown.example', [], containers, 'deleted'), 'default');
});
