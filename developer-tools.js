'use strict';

const DEVICE_PRESETS = Object.freeze([
  { id: 'mobile-small', label: 'Small mobile', width: 320, height: 640 },
  { id: 'mobile', label: 'Mobile', width: 375, height: 812 },
  { id: 'mobile-large', label: 'Large mobile', width: 430, height: 932 },
  { id: 'tablet', label: 'Tablet portrait', width: 768, height: 1024 },
  { id: 'laptop', label: 'Laptop', width: 1280, height: 800 },
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900 }
]);
const MAX_JSON_CHARS = 2_000_000;

function getViewportPreset(id) {
  return DEVICE_PRESETS.find((item) => item.id === String(id)) || null;
}
function inspectJson(source) {
  const text = String(source || '').trim();
  if (!text || text.length > MAX_JSON_CHARS) throw new Error('JSON input is empty or exceeds the 2 MB inspection limit.');
  let value;
  try { value = JSON.parse(text); }
  catch (error) { throw new Error('Invalid JSON: ' + error.message); }
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const keys = value && typeof value === 'object' ? Object.keys(value).slice(0, 500) : [];
  return { kind, keys, pretty: JSON.stringify(value, null, 2), bytes: Buffer.byteLength(text, 'utf8') };
}
function summarizePageStructure(input = {}) {
  const headings = Array.isArray(input.headings) ? input.headings.slice(0, 300).map((item) => ({ level: Math.min(6, Math.max(1, Number(item.level) || 1), text: String(item.text || '').slice(0, 500) })) : [];
  const links = Array.isArray(input.links) ? input.links.slice(0, 500).map((item) => ({ text: String(item.text || '').slice(0, 300), url: String(item.url || '').slice(0, 2048) })) : [];
  const images = Array.isArray(input.images) ? input.images.slice(0, 300).map((item) => ({ alt: String(item.alt || '').slice(0, 300), src: String(item.src || '').slice(0, 2048) })) : [];
  return { title: String(input.title || '').slice(0, 300), url: String(input.url || '').slice(0, 2048), headings, links, images, counts: { headings: headings.length, links: links.length, images: images.length, forms: Math.max(0, Number(input.forms) || 0), tables: Math.max(0, Number(input.tables) || 0) } };
}
function filterNetworkLog(entries, query = '', type = 'all', status = 'all') {
  const normalized = String(query || '').trim().toLowerCase();
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (type !== 'all' && String(entry.resourceType || '').toLowerCase() !== type) return false;
    if (status !== 'all' && !String(entry.status || '').toLowerCase().includes(status)) return false;
    return !normalized || [entry.url, entry.method, entry.resourceType, entry.status].join(' ').toLowerCase().includes(normalized);
  });
}
module.exports = { DEVICE_PRESETS, getViewportPreset, inspectJson, summarizePageStructure, filterNetworkLog, MAX_JSON_CHARS };
