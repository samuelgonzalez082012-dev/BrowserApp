'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');

class WindowsWindowHost extends EventEmitter {
  constructor({ scriptPath = path.join(__dirname, 'windows-window-host.ps1'), spawnProcess = spawn, platform = process.platform } = {}) {
    super();
    this.platform = platform;
    this.scriptPath = scriptPath;
    this.spawnProcess = spawnProcess;
    this.child = null;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
  }

  _ensureProcess() {
    if (this.platform !== 'win32') throw new Error('Native Firefox window embedding is currently Windows-only.');
    if (this.child && this.child.exitCode === null && !this.child.killed) return;
    this.child = this.spawnProcess('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath
    ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this._onStdout(chunk));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk) => this.emit('diagnostic', chunk.trim()));
    this.child.on('error', (error) => this._failAll(error));
    this.child.on('exit', (code) => this._failAll(new Error('Windows window host exited (code ' + code + ').')));
  }

  _onStdout(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let response;
      try { response = JSON.parse(line); } catch { this.emit('diagnostic', line); continue; }
      const pending = this.pending.get(response.id);
      if (!pending) continue;
      this.pending.delete(response.id);
      clearTimeout(pending.timeout);
      if (response.ok) pending.resolve(response.result);
      else pending.reject(new Error(response.error || 'Native window operation failed.'));
    }
  }

  _failAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    this.child = null;
  }

  _request(operation, payload = {}) {
    this._ensureProcess();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Windows window-host operation timed out: ' + operation));
      }, 8000);
      this.pending.set(id, { resolve, reject, timeout });
      this.child.stdin.write(JSON.stringify({ id, operation, ...payload }) + '\n', (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  attach({ processId, parentHandle, bounds }) {
    return this._request('attach', { processId, parentHandle: String(parentHandle), bounds });
  }
  setBounds(bounds) { return this._request('resize', { bounds }); }
  focus() { return this._request('focus'); }
  detach() { return this._request('detach'); }

  async close() {
    if (!this.child) return;
    try { await this._request('shutdown'); } catch {}
    try { this.child.stdin.end(); this.child.kill(); } catch {}
    this.child = null;
  }
}

module.exports = { WindowsWindowHost };
