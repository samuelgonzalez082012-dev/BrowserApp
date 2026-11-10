'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DownloadQueue } = require('../download-queue');

test('starts up to the configured concurrency and queues excess jobs FIFO', () => {
  const queue = new DownloadQueue(2);
  assert.equal(queue.enqueue('a'), 'active');
  assert.equal(queue.enqueue('b'), 'active');
  assert.equal(queue.enqueue('c'), 'queued');
  assert.equal(queue.enqueue('d'), 'queued');
  assert.deepEqual(queue.snapshot().map(({ id, status }) => ({ id, status })), [
    { id: 'a', status: 'active' }, { id: 'b', status: 'active' }, { id: 'c', status: 'queued' }, { id: 'd', status: 'queued' }
  ]);
});
test('finishing a transfer promotes the oldest queued transfer', () => {
  const queue = new DownloadQueue(1);
  queue.enqueue('a'); queue.enqueue('b'); queue.enqueue('c');
  assert.deepEqual(queue.finish('a'), ['b']);
  assert.equal(queue.status('b'), 'active');
  assert.equal(queue.status('c'), 'queued');
});
test('pausing an active transfer frees a slot for the next queued transfer', () => {
  const queue = new DownloadQueue(1);
  queue.enqueue('a'); queue.enqueue('b');
  assert.deepEqual(queue.pause('a'), ['b']);
  assert.equal(queue.status('a'), 'paused');
  assert.equal(queue.status('b'), 'active');
});
test('manual resume queues a paused transfer when all slots are occupied', () => {
  const queue = new DownloadQueue(1);
  queue.enqueue('a'); queue.enqueue('b'); queue.pause('a');
  assert.equal(queue.resume('a'), false);
  assert.equal(queue.status('a'), 'queued');
  assert.equal(queue.status('b'), 'active');
});
test('raising the limit promotes queued work and lowering it never kills active work', () => {
  const queue = new DownloadQueue(1);
  queue.enqueue('a'); queue.enqueue('b');
  assert.deepEqual(queue.setLimit(2), ['b']);
  assert.equal(queue.runningCount(), 2);
  queue.setLimit(1);
  assert.equal(queue.runningCount(), 2);
  assert.equal(queue.enqueue('c'), 'queued');
});
test('invalid limits are clamped to safe defaults and bounds', () => {
  assert.equal(new DownloadQueue(0).limit, 1);
  assert.equal(new DownloadQueue(100).limit, 10);
  assert.equal(new DownloadQueue('nope').limit, 3);
});
test('finishing unknown or duplicate jobs is harmless', () => {
  const queue = new DownloadQueue(1);
  queue.enqueue('a');
  assert.equal(queue.enqueue('a'), 'active');
  assert.deepEqual(queue.finish('unknown'), []);
  assert.deepEqual(queue.finish('a'), []);
});
test('scheduled jobs do not consume a slot before their scheduled time', () => {
  const queue = new DownloadQueue(1);
  queue.enqueue('a');
  queue.enqueue('b', Date.now() + 60000);
  assert.equal(queue.status('b'), 'scheduled');
  assert.equal(queue.runningCount(), 1);
  assert.deepEqual(queue.finish('a'), []);
  assert.equal(queue.status('b'), 'scheduled');
});
test('due scheduled jobs are promoted FIFO when their time arrives', () => {
  const queue = new DownloadQueue(1);
  const now = Date.now();
  queue.enqueue('a', now + 10000);
  queue.enqueue('b');
  assert.equal(queue.status('a'), 'scheduled');
  assert.equal(queue.status('b'), 'active');
  assert.deepEqual(queue.activateDue(now + 11000), ['a']);
  assert.equal(queue.status('a'), 'active');
});
test('scheduling an active transfer releases its slot and resume clears the schedule', () => {
  const queue = new DownloadQueue(1);
  queue.enqueue('a'); queue.enqueue('b');
  assert.deepEqual(queue.schedule('a', Date.now() + 10000), ['b']);
  assert.equal(queue.status('a'), 'scheduled');
  assert.equal(queue.status('b'), 'active');
  assert.equal(queue.resume('a'), false);
  assert.equal(queue.status('a'), 'queued');
});
