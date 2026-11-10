'use strict';

const RISKY_PERMISSIONS = new Set(['<all_urls>','*://*/*','webRequest','webRequestBlocking','cookies','history','downloads','nativeMessaging','proxy','debugger','clipboardRead','management','privacy','contentSettings','declarativeNetRequest']);
const MODERATE_PERMISSIONS = new Set(['tabs','scripting','activeTab','storage','notifications','geolocation','clipboardWrite']);

function auditExtensionPermissions(extensions) {
  return (Array.isArray(extensions) ? extensions : []).map((extension) => {
    const permissions = [...new Set([...(extension.permissions || []), ...(extension.manifest?.host_permissions || [])].map(String))].slice(0, 200);
    const risky = permissions.filter((permission) => RISKY_PERMISSIONS.has(permission) || permission.includes('*://*/*'));
    const moderate = permissions.filter((permission) => MODERATE_PERMISSIONS.has(permission));
    const level = risky.length ? 'high' : moderate.length ? 'review' : 'low';
    return { id: String(extension.id || ''), name: String(extension.name || 'Extension').slice(0, 100), enabled: Boolean(extension.enabled), level, permissions, risky, moderate };
  });
}
function summarizePrivacyState(input = {}) {
  const permissionEntries = Object.entries(input.permissions || {}).flatMap(([origin, permissions]) => Object.entries(permissions || {}).map(([permission, decision]) => ({ origin, permission, decision })));
  const extensionAudit = auditExtensionPermissions(input.extensions);
  const highRisk = extensionAudit.filter((item) => item.level === 'high');
  const review = extensionAudit.filter((item) => item.level === 'review');
  return {
    sitePermissionCount: permissionEntries.length,
    allowedPermissionCount: permissionEntries.filter((item) => item.decision === 'allow').length,
    deniedPermissionCount: permissionEntries.filter((item) => item.decision === 'deny').length,
    extensionCount: extensionAudit.length,
    highRiskExtensionCount: highRisk.length,
    reviewExtensionCount: review.length,
    extensions: extensionAudit,
    permissions: permissionEntries.slice(0, 1000)
  };
}
function sanitizeSecurityEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.slice(0, 200).filter((event) => event && typeof event.id === 'string' && typeof event.type === 'string').map((event) => ({
    id: event.id.slice(0, 100), type: event.type.slice(0, 48), title: String(event.title || '').slice(0, 120),
    detail: String(event.detail || '').slice(0, 500), at: Number(event.at) || Date.now(),
    origin: /^https?:\/\//i.test(event.origin || '') ? String(event.origin).slice(0, 300) : ''
  }));
}
const SECURE_DNS_PROVIDERS = Object.freeze({
  system: '',
  cloudflare: 'https://cloudflare-dns.com/dns-query{?dns}',
  google: 'https://dns.google/dns-query{?dns}',
  quad9: 'https://dns.quad9.net/dns-query{?dns}'
});
function normalizeSecureDnsProvider(value) {
  return Object.hasOwn(SECURE_DNS_PROVIDERS, String(value)) ? String(value) : 'system';
}
module.exports = { RISKY_PERMISSIONS, MODERATE_PERMISSIONS, SECURE_DNS_PROVIDERS, auditExtensionPermissions, summarizePrivacyState, sanitizeSecurityEvents, normalizeSecureDnsProvider };
