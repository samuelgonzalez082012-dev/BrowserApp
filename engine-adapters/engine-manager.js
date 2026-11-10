'use strict';

/**
 * Registry and factory for browser rendering engines.
 *
 * The manager deliberately knows nothing about Electron or Gecko. Concrete
 * adapters own their native view/process implementation and return a tab
 * handle that conforms to the BrowserApp engine-tab contract.
 */
class EngineManager {
  constructor() {
    this.adapters = new Map();
    this.defaultEngineId = 'chromium';
  }

  register(adapter) {
    if (!adapter || typeof adapter.id !== 'string' || !adapter.id.trim()) {
      throw new TypeError('An engine adapter must have a non-empty id.');
    }
    if (typeof adapter.createTab !== 'function') {
      throw new TypeError(`Engine adapter "${adapter.id}" must implement createTab().`);
    }

    const id = adapter.id.trim().toLowerCase();
    if (this.adapters.has(id)) {
      throw new Error(`Engine adapter "${id}" is already registered.`);
    }

    this.adapters.set(id, adapter);
    return adapter;
  }

  has(engineId) {
    return this.adapters.has(String(engineId || '').toLowerCase());
  }

  get(engineId = this.defaultEngineId) {
    const id = String(engineId || this.defaultEngineId).toLowerCase();
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`The "${id}" browser engine is not installed or registered.`);
    }
    return adapter;
  }

  createTab(options = {}) {
    const engineId = String(options.engineId || this.defaultEngineId).toLowerCase();
    const adapter = this.get(engineId);
    const tab = adapter.createTab(options);

    if (!tab || tab.engineId !== engineId) {
      throw new Error(`Engine adapter "${engineId}" returned an invalid tab handle.`);
    }

    return tab;
  }

  listEngines() {
    return [...this.adapters.values()].map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      family: adapter.family,
      runtime: adapter.runtime,
      available: true,
      capabilities: { ...(adapter.capabilities || {}) }
    }));
  }

  getDefaultEngineInfo() {
    const adapter = this.get(this.defaultEngineId);
    return {
      id: adapter.id,
      name: adapter.name,
      family: adapter.family,
      runtime: adapter.runtime
    };
  }
}

module.exports = { EngineManager };
