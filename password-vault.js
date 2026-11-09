'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const VERSION = 1;
const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MIN_MASTER_PASSWORD_LENGTH = 12;

function safeString(value, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validateRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const type = ['credential', 'secure-note', 'identity'].includes(record.type) ? record.type : '';
  if (!type || typeof record.id !== 'string') return null;
  const clean = {
    id: record.id.slice(0, 100),
    type,
    title: safeString(record.title, 120),
    createdAt: Number(record.createdAt) || Date.now(),
    updatedAt: Number(record.updatedAt) || Date.now()
  };
  if (type === 'credential') {
    const site = safeString(record.site, 1000);
    let parsed;
    try { parsed = new URL(site); } catch { return null; }
    if (!(parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)))) return null;
    if (parsed.username || parsed.password) return null;
    clean.site = `${parsed.origin}/`;
    clean.hostname = parsed.hostname.toLowerCase();
    clean.username = safeString(record.username, 250);
    clean.password = typeof record.password === 'string' ? record.password.slice(0, 4096) : '';
    clean.notes = safeString(record.notes, 2000);
    if (!clean.title) clean.title = clean.hostname;
    if (!clean.password) return null;
  } else if (type === 'secure-note') {
    clean.content = safeString(record.content, 10000);
    if (!clean.title || !clean.content) return null;
  } else {
    clean.fullName = safeString(record.fullName, 160);
    clean.email = safeString(record.email, 250);
    clean.phone = safeString(record.phone, 80);
    clean.address = safeString(record.address, 1000);
    if (!clean.title) clean.title = clean.fullName || 'Identity';
  }
  return clean;
}

class PasswordVault {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.key = null;
    this.salt = null;
    this.entries = [];
    this.createdAt = 0;
  }

  exists() {
    return fs.existsSync(this.filePath);
  }

  _readEnvelope(filePath = this.filePath) {
    let envelope;
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size < 100 || stat.size > 12 * 1024 * 1024) {
        throw new Error('Vault file size is outside the supported range.');
      }
      envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      if (error && error.message === 'Vault file size is outside the supported range.') throw error;
      throw new Error('The vault file is unreadable or damaged.');
    }
    if (!envelope || envelope.version !== VERSION || envelope.kdf !== 'scrypt' || envelope.cipher !== 'aes-256-gcm' || typeof envelope.salt !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.tag !== 'string' || typeof envelope.ciphertext !== 'string') {
      throw new Error('This is not a supported password-vault file.');
    }
    const salt = Buffer.from(envelope.salt, 'base64');
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16 || ciphertext.length < 2 || ciphertext.length > 10 * 1024 * 1024) {
      throw new Error('The vault file contains invalid cryptographic parameters.');
    }
    return envelope;
  }

  _validateMasterPassword(password) {
    if (typeof password !== 'string' || password.length < MIN_MASTER_PASSWORD_LENGTH || password.length > 256) {
      throw new Error(`Use a master password between ${MIN_MASTER_PASSWORD_LENGTH} and 256 characters.`);
    }
  }

  async _derive(password, salt) {
    return scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  }

  async setup(masterPassword) {
    if (this.exists()) throw new Error('A password vault already exists for this profile. Unlock it instead.');
    this._validateMasterPassword(masterPassword);
    this.salt = crypto.randomBytes(16);
    this.key = await this._derive(masterPassword, this.salt);
    this.entries = [];
    this.createdAt = Date.now();
    try { await this.save(); }
    catch (error) { this.lock(); try { fs.rmSync(this.filePath, { force: true }); } catch {} throw error; }
    return this.status();
  }

  async unlock(masterPassword) {
    this._validateMasterPassword(masterPassword);
    const envelope = this._readEnvelope();
    const salt = Buffer.from(envelope.salt, 'base64');
    const key = await this._derive(masterPassword, salt);
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final()
      ]).toString('utf8');
      const payload = JSON.parse(plaintext);
      if (!payload || !Array.isArray(payload.entries)) throw new Error('Invalid vault payload.');
      this.key = key;
      this.salt = salt;
      this.entries = payload.entries.map(validateRecord).filter(Boolean).slice(0, 10000);
      this.createdAt = Number(envelope.createdAt) || Date.now();
      return this.status();
    } catch {
      key.fill(0);
      throw new Error('Incorrect master password, or the vault is damaged.');
    }
  }

  isUnlocked() {
    return Buffer.isBuffer(this.key) && this.key.length === KEY_LENGTH;
  }

  async save() {
    if (!this.isUnlocked() || !this.salt) throw new Error('Unlock the vault first.');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const plaintext = Buffer.from(JSON.stringify({ entries: this.entries }), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope = {
      version: VERSION,
      kdf: 'scrypt',
      kdfOptions: { N: SCRYPT_OPTIONS.N, r: SCRYPT_OPTIONS.r, p: SCRYPT_OPTIONS.p },
      cipher: 'aes-256-gcm',
      salt: this.salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      entryCount: this.entries.length,
      createdAt: this.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(envelope), { mode: 0o600 });
    fs.renameSync(temporaryPath, this.filePath);
  }

  list() {
    if (!this.isUnlocked()) throw new Error('Unlock the vault first.');
    return this.entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      site: entry.site || '',
      hostname: entry.hostname || '',
      username: entry.username || '',
      updatedAt: entry.updatedAt
    }));
  }

  async addCredential(payload) {
    if (!this.isUnlocked()) throw new Error('Unlock the vault first.');
    const record = validateRecord({
      id: `credential-${crypto.randomUUID()}`,
      type: 'credential',
      title: payload.title,
      site: payload.site,
      username: payload.username,
      password: payload.password,
      notes: payload.notes,
      createdAt: Date.now(), updatedAt: Date.now()
    });
    if (!record) throw new Error('Enter a valid HTTPS website and a password.');
    const existing = this.entries.findIndex((item) => item.type === 'credential' && item.hostname === record.hostname && item.username.toLowerCase() === record.username.toLowerCase());
    if (existing >= 0) this.entries.splice(existing, 1);
    this.entries.unshift(record);
    await this.save();
    return { ok: true, id: record.id };
  }

  async addSecureNote(payload) {
    if (!this.isUnlocked()) throw new Error('Unlock the vault first.');
    const record = validateRecord({ id: `secure-note-${crypto.randomUUID()}`, type: 'secure-note', title: payload.title, content: payload.content, createdAt: Date.now(), updatedAt: Date.now() });
    if (!record) throw new Error('Enter a title and note content.');
    this.entries.unshift(record);
    await this.save();
    return { ok: true, id: record.id };
  }

  async addIdentity(payload) {
    if (!this.isUnlocked()) throw new Error('Unlock the vault first.');
    const record = validateRecord({ id: `identity-${crypto.randomUUID()}`, type: 'identity', title: payload.title, fullName: payload.fullName, email: payload.email, phone: payload.phone, address: payload.address, createdAt: Date.now(), updatedAt: Date.now() });
    if (!record) throw new Error('Enter at least a name or an identity label.');
    this.entries.unshift(record);
    await this.save();
    return { ok: true, id: record.id };
  }

  reveal(id) {
    if (!this.isUnlocked()) throw new Error('Unlock the vault first.');
    const entry = this.entries.find((item) => item.id === String(id));
    if (!entry) throw new Error('Vault entry not found.');
    return { ...entry };
  }

  async remove(id) {
    if (!this.isUnlocked()) throw new Error('Unlock the vault first.');
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.id !== String(id));
    if (before === this.entries.length) return { ok: false, error: 'Vault entry not found.' };
    await this.save();
    return { ok: true };
  }

  async changeMasterPassword(newPassword) {
    if (!this.isUnlocked()) throw new Error('Unlock the vault first.');
    this._validateMasterPassword(newPassword);
    this.salt = crypto.randomBytes(16);
    const nextKey = await this._derive(newPassword, this.salt);
    const previousKey = this.key;
    this.key = nextKey;
    try { await this.save(); previousKey.fill(0); return { ok: true }; }
    catch (error) { this.key = previousKey; nextKey.fill(0); throw error; }
  }

  async exportEncrypted(destination) {
    if (!this.exists()) throw new Error('No vault exists for this profile.');
    fs.copyFileSync(this.filePath, destination);
    return { ok: true };
  }

  async importEncrypted(source) {
    const sourcePath = path.resolve(source);
    const envelope = this._readEnvelope(sourcePath);
    if (!envelope || envelope.version !== VERSION) throw new Error('Unsupported vault backup.');
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (sourcePath === this.filePath) return { ok: true, entryCount: Number(envelope.entryCount) || 0, unchanged: true };
    if (this.exists()) fs.copyFileSync(this.filePath, `${this.filePath}.pre-import-${Date.now()}.bak`);
    const temporaryPath = `${this.filePath}.import.tmp`;
    fs.copyFileSync(sourcePath, temporaryPath);
    fs.renameSync(temporaryPath, this.filePath);
    this.lock();
    return { ok: true, entryCount: Number(envelope.entryCount) || 0 };
  }

  lock() {
    if (Buffer.isBuffer(this.key)) this.key.fill(0);
    this.key = null;
    this.salt = null;
    this.entries = [];
  }

  status() {
    let envelope = null;
    if (this.exists()) {
      try { envelope = this._readEnvelope(); } catch { /* Report a present but invalid vault. */ }
    }
    return {
      exists: Boolean(envelope),
      unlocked: this.isUnlocked(),
      count: this.isUnlocked() ? this.entries.length : Number(envelope?.entryCount) || 0,
      createdAt: Number(envelope?.createdAt) || this.createdAt || 0,
      damaged: this.exists() && !envelope
    };
  }
}

module.exports = { PasswordVault };
