'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorkflow, updateWorkflow, getConfirmationSummary, sanitizeWorkflows } = require('../workflow-engine');

test('creates a versioned workflow with validated steps', () => {
  const item = createWorkflow({ name: 'Research', steps: [{ type: 'new-tab' }, { type: 'open-url', value: 'https://example.com' }] });
  assert.equal(item.version, 1);
  assert.equal(item.steps.length, 2);
});
test('rejects unsupported actions, unsafe URLs and oversized step lists', () => {
  assert.throws(() => createWorkflow({ name: 'Bad', steps: [{ type: 'shell-command' }] }));
  assert.throws(() => createWorkflow({ name: 'Bad', steps: [{ type: 'open-url', value: 'file:///tmp/x' }] }));
  assert.throws(() => createWorkflow({ name: 'Bad', steps: Array.from({ length: 21 }, () => ({ type: 'new-tab' })) }));
});
test('updates preserve a bounded version history', () => {
  let item = createWorkflow({ name: 'One', steps: [{ type: 'new-tab' }] });
  item = updateWorkflow(item, { name: 'Two', steps: [{ type: 'open-url', value: 'https://example.com' }] });
  assert.equal(item.version, 2);
  assert.equal(item.versions[0].name, 'One');
});
test('consequential actions require an explicit confirmation summary', () => {
  const item = createWorkflow({ name: 'Open page', steps: [{ type: 'open-url', value: 'https://example.com' }, { type: 'new-tab' }] });
  const summary = getConfirmationSummary(item);
  assert.equal(summary.required, true);
  assert.equal(summary.count, 1);
});
test('sanitizer discards malformed workflows', () => {
  assert.equal(sanitizeWorkflows([{ id: 'ok', name: 'Ok', steps: [{ type: 'new-tab' }] }, { id: 'bad', name: 'Bad', steps: [{ type: 'arbitrary' }] }]).length, 1);
});
