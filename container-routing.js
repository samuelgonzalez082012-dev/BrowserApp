'use strict';

/** Pure container-domain routing helpers; intentionally independent of Electron. */
function normalizeContainerDomain(value) {
  let input = String(value || '').trim().toLowerCase();
  if (!input) return '';
  input = input.replace(/^https?:\/\//, '').split(/[/?#:]/)[0].replace(/^\*\./, '').replace(/^\./, '').replace(/\.$/, '');
  const validHostname = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  return validHostname.test(input) ? input : '';
}

function resolveContainerForUrl(url, rules = [], containers = [], fallbackId = 'default') {
  const fallback = containers.find((item) => item.id === String(fallbackId)) || containers.find((item) => item.id === 'default') || { id: 'default' };
  let hostname = '';
  try {
    const parsed = new URL(String(url));
    if (!['http:', 'https:'].includes(parsed.protocol)) return fallback.id;
    hostname = parsed.hostname.toLowerCase();
  } catch { return fallback.id; }
  const available = new Set(containers.map((item) => String(item.id)));
  const matches = (Array.isArray(rules) ? rules : []).filter((rule) => {
    if (!rule || rule.enabled === false || !available.has(String(rule.containerId))) return false;
    const domain = normalizeContainerDomain(rule.domain);
    return Boolean(domain) && (hostname === domain || (rule.includeSubdomains !== false && hostname.endsWith('.' + domain)));
  }).sort((a, b) => normalizeContainerDomain(b.domain).length - normalizeContainerDomain(a.domain).length);
  return matches.length ? String(matches[0].containerId) : fallback.id;
}

module.exports = { normalizeContainerDomain, resolveContainerForUrl };
