'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLoopbackEndpoint, LocalModelAdapter } = require('../local-model-adapter');

test('local model adapter accepts only loopback endpoints', () => {
  assert.equal(normalizeLoopbackEndpoint('http://127.0.0.1:11434/v1/chat/completions'), 'http://127.0.0.1:11434/v1/chat/completions');
  assert.throws(() => normalizeLoopbackEndpoint('https://api.example.com/v1/chat/completions'));
  assert.throws(() => normalizeLoopbackEndpoint('http://localhost:8080@evil.example/v1'));
});
test('local model adapter validates model and response content', async () => {
  const adapter = new LocalModelAdapter({ endpoint: 'http://localhost:11434/v1/chat/completions', model: 'llama3.1' });
  const answer = await adapter.complete([{ role: 'user', content: 'hello' }], async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Hello' } }] }) }));
  assert.equal(answer, 'Hello');
  await assert.rejects(() => adapter.complete([], async () => ({})));
});
test('local model adapter reports provider errors', async () => {
  const adapter = new LocalModelAdapter({ endpoint: 'http://localhost:11434/v1/chat/completions', model: 'model' });
  await assert.rejects(() => adapter.complete([{ role: 'user', content: 'x' }], async () => ({ ok: false, status: 503, json: async () => ({ error: { message: 'offline' } }) })), /offline/);
});
