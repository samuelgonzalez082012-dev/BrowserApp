'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

function resolveFirefoxExecutable(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const existsSync = options.existsSync || fs.existsSync;
  const pathApi = platform === 'win32' ? path.win32 : path;
  const candidates = [];

  if (env.FIREFOX_PATH) candidates.push(env.FIREFOX_PATH);
  if (platform === 'win32') {
    for (const root of [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA]) {
      if (root) candidates.push(pathApi.join(root, 'Mozilla Firefox', 'firefox.exe'));
    }
  } else if (platform === 'darwin') {
    candidates.push('/Applications/Firefox.app/Contents/MacOS/firefox');
    candidates.push(pathApi.join(env.HOME || '', 'Applications/Firefox.app/Contents/MacOS/firefox'));
  } else {
    candidates.push('/usr/bin/firefox', '/usr/bin/firefox-esr', '/snap/bin/firefox');
  }

  return candidates.find((candidate) => candidate && existsSync(candidate)) || null;
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

class FirefoxLauncher {
  constructor({ profileRoot, executable = null, spawnProcess = spawn, platform = process.platform } = {}) {
    if (!profileRoot) throw new TypeError('FirefoxLauncher requires a dedicated profileRoot.');
    this.profileRoot = path.resolve(profileRoot);
    this.executable = executable || resolveFirefoxExecutable({ platform });
    this.spawnProcess = spawnProcess;
    this.platform = platform;
    this.child = null;
    this.port = null;
    this.profilePath = path.join(this.profileRoot, 'profile');
  }

  async launch() {
    if (this.platform !== 'win32') throw new Error('The Firefox embedding proof of concept currently supports Windows only.');
    if (this.child && this.child.exitCode === null && !this.child.killed) throw new Error('The managed Firefox instance is already running.');
    if (!this.executable || !fs.existsSync(this.executable)) {
      throw new Error('Firefox was not found. Install Firefox or set FIREFOX_PATH to firefox.exe.');
    }

    fs.mkdirSync(this.profilePath, { recursive: true });
    this.port = await reserveLoopbackPort();
    const args = ['-no-remote', '-profile', this.profilePath, '--remote-debugging-port', String(this.port), '--new-window', 'about:blank'];
    this.child = this.spawnProcess(this.executable, args, {
      stdio: 'ignore',
      windowsHide: false,
      detached: false
    });

    await new Promise((resolve, reject) => {
      const onError = (error) => { cleanup(); reject(error); };
      const onExit = (code, signal) => {
        cleanup();
        reject(new Error(\`Firefox exited before startup (code \${code ?? 'unknown'}, signal \${signal || 'none'}).\`));
      };
      const cleanup = () => {
        this.child.removeListener('error', onError);
        this.child.removeListener('exit', onExit);
      };
      this.child.once('error', onError);
      this.child.once('exit', onExit);
      const timer = setTimeout(() => { cleanup(); resolve(); }, 350);
      timer.unref?.();
    });

    return {
      executable: this.executable,
      pid: this.child.pid,
      port: this.port,
      websocketUrl: \`ws://127.0.0.1:\${this.port}/session\`,
      profilePath: this.profilePath,
      args: [...args]
    };
  }

  isRunning() {
    return Boolean(this.child && this.child.exitCode === null && !this.child.killed);
  }

  async close({ gracePeriodMs = 3000 } = {}) {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;

    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        child.removeListener('exit', finish);
        resolve();
      };
      const timeout = setTimeout(() => {
        if (child.exitCode === null) {
          try { child.kill(); } catch {}
        }
        finish();
      }, gracePeriodMs);
      child.once('exit', finish);
    });
  }
}

module.exports = { FirefoxLauncher, resolveFirefoxExecutable, reserveLoopbackPort };
