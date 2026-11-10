'use strict';

const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 10;

/**
 * In-memory scheduler for Electron DownloadItem instances.
 * The scheduler owns only queue state; Electron continues to own the transfer.
 */
class DownloadQueue {
  constructor(limit = DEFAULT_CONCURRENCY) {
    this.limit = this.normalizeLimit(limit);
    this.jobs = new Map();
    this.sequence = 0;
  }

  normalizeLimit(value) {
    const number = Number(value);
    return Number.isInteger(number) ? Math.max(1, Math.min(MAX_CONCURRENCY, number)) : DEFAULT_CONCURRENCY;
  }

  enqueue(id) {
    const key = String(id);
    if (this.jobs.has(key)) return this.jobs.get(key).status;
    const status = this.runningCount() < this.limit ? 'active' : 'queued';
    this.jobs.set(key, { id: key, status, sequence: this.sequence++ });
    return status;
  }

  status(id) {
    return this.jobs.get(String(id))?.status || 'missing';
  }

  runningCount() {
    return [...this.jobs.values()].filter((job) => job.status === 'active').length;
  }

  pause(id) {
    const job = this.jobs.get(String(id));
    if (!job) return [];
    if (job.status === 'active') job.status = 'paused';
    return this.promote();
  }

  resume(id) {
    const job = this.jobs.get(String(id));
    if (!job) return false;
    if (job.status === 'active') return true;
    if (this.runningCount() >= this.limit) {
      job.status = 'queued';
      return false;
    }
    job.status = 'active';
    return true;
  }

  finish(id) {
    this.jobs.delete(String(id));
    return this.promote();
  }

  promote() {
    const promoted = [];
    while (this.runningCount() < this.limit) {
      const next = [...this.jobs.values()]
        .filter((job) => job.status === 'queued')
        .sort((a, b) => a.sequence - b.sequence)[0];
      if (!next) break;
      next.status = 'active';
      promoted.push(next.id);
    }
    return promoted;
  }

  setLimit(value) {
    this.limit = this.normalizeLimit(value);
    return this.promote();
  }

  snapshot() {
    return [...this.jobs.values()]
      .sort((a, b) => a.sequence - b.sequence)
      .map(({ id, status }) => ({ id, status }));
  }
}

module.exports = { DownloadQueue, DEFAULT_CONCURRENCY, MAX_CONCURRENCY };
