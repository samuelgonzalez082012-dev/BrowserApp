'use strict';

const path = require('node:path');
const PLUGIN_PERMISSIONS = Object.freeze(['activeTab.read','tabs.open','notes.create','notifications.show','external.open']);
const PLUGIN_ID = /^[a-z0-9][a-z0-9.-]{2,63}$/i;
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;

function validatePluginManifest(manifest, rootPath) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Plugin manifest must be a JSON object.');
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported plugin manifest schema version.');
  const id = String(manifest.id || '').trim();
  if (!PLUGIN_ID.test(id)) throw new Error('Plugin ID must be 3–64 characters using letters, numbers, dots or hyphens.');
  const name = String(manifest.name || '').trim().slice(0, 80);
  if (!name) throw new Error('Plugin name is required.');
  const version = String(manifest.version || '').trim();
  if (!VERSION.test(version)) throw new Error('Plugin version must use semantic versioning.');
  const entry = String(manifest.entry || 'index.html').trim();
  if (!entry || path.isAbsolute(entry)) throw new Error('Plugin entry must be a relative path.');
  const root = path.resolve(rootPath);
  const resolvedEntry = path.resolve(root, entry);
  const relative = path.relative(root, resolvedEntry);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Plugin entry must remain inside its plugin folder.');
  const permissions = [...new Set(Array.isArray(manifest.permissions) ? manifest.permissions.map(String) : [])];
  const unknown = permissions.filter((permission) => !PLUGIN_PERMISSIONS.includes(permission));
  if (unknown.length) throw new Error('Unsupported plugin permissions: ' + unknown.join(', '));
  return {
    schemaVersion: 1, id, name, version, description: String(manifest.description || '').slice(0, 500),
    entry, permissions, minAppVersion: String(manifest.minAppVersion || '0.0.0').slice(0, 40),
    author: String(manifest.author || '').slice(0, 100)
  };
}
function pluginCompatibility(manifest, appVersion) {
  const current = String(appVersion || '0.0.0').split('.').map(Number);
  const minimum = String(manifest.minAppVersion || '0.0.0').split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((current[index] || 0) > (minimum[index] || 0)) return { compatible: true, reason: '' };
    if ((current[index] || 0) < (minimum[index] || 0)) return { compatible: false, reason: 'Requires browser version ' + manifest.minAppVersion + ' or newer.' };
  }
  return { compatible: true, reason: '' };
}
function sanitizePluginRegistry(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).filter((item) => item && PLUGIN_ID.test(String(item.id || '')) && typeof item.path === 'string' && path.isAbsolute(item.path))
    .map((item) => ({
      id: String(item.id), name: String(item.name || 'Plugin').slice(0, 80), version: String(item.version || '0.0.0').slice(0, 40),
      path: path.resolve(item.path), entry: String(item.entry || 'index.html'), permissions: (Array.isArray(item.permissions) ? item.permissions : []).filter((permission) => PLUGIN_PERMISSIONS.includes(permission)),
      enabled: item.enabled !== false, description: String(item.description || '').slice(0, 500), minAppVersion: String(item.minAppVersion || '0.0.0')
    }));
}
function hasPermission(plugin, permission) {
  return Boolean(plugin && plugin.enabled !== false && Array.isArray(plugin.permissions) && plugin.permissions.includes(permission));
}
module.exports = { PLUGIN_PERMISSIONS, PLUGIN_ID, validatePluginManifest, pluginCompatibility, sanitizePluginRegistry, hasPermission };
