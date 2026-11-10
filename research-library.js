'use strict';

const crypto = require('node:crypto');

const MAX_ITEMS = 500;
const MAX_VERSIONS = 30;
const MAX_TEXT_LENGTH = 500000;
const MAX_ANNOTATIONS = 1000;

function cleanText(value, limit = MAX_TEXT_LENGTH) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, limit);
}
function safeSourceUrl(value) {
  try { const url = new URL(String(value || '')); return ['http:', 'https:'].includes(url.protocol) ? url.href.slice(0, 2048) : ''; }
  catch { return ''; }
}
function makeVersion(input, previous = null) {
  const content = cleanText(input.content || input.text);
  if (!content) throw new Error('The page did not contain readable article text.');
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  if (previous?.contentHash === hash) return null;
  return { id: crypto.randomUUID(), createdAt: Number(input.capturedAt) || Date.now(), content, contentHash: hash, wordCount: content.split(/\s+/).filter(Boolean).length };
}
function upsertArticle(items, input = {}) {
  const url = safeSourceUrl(input.url);
  if (!url) throw new Error('A valid HTTP or HTTPS source URL is required.');
  const title = cleanText(input.title || url, 300) || url;
  const sourceRef = cleanText(input.sourceRef || url, 2048);
  const current = Array.isArray(items) ? [...items] : [];
  let item = current.find((entry) => entry.url === url);
  if (!item) {
    item = { id: crypto.randomUUID(), title, url, sourceRef, createdAt: Date.now(), updatedAt: Date.now(), versions: [], annotations: [] };
    current.unshift(item);
  }
  const version = makeVersion(input, item.versions?.[0]);
  if (version) {
    item.versions = [version, ...(Array.isArray(item.versions) ? item.versions : [])].slice(0, MAX_VERSIONS);
    item.updatedAt = version.createdAt;
  }
  item.title = title;
  item.sourceRef = sourceRef;
  item.annotations = Array.isArray(item.annotations) ? item.annotations.slice(0, MAX_ANNOTATIONS) : [];
  return { items: current.slice(0, MAX_ITEMS), item, changed: Boolean(version) };
}
function addAnnotation(items, itemId, input = {}) {
  const current = Array.isArray(items) ? [...items] : [];
  const index = current.findIndex((entry) => entry.id === String(itemId));
  if (index < 0) throw new Error('Saved article not found.');
  const quote = cleanText(input.quote, 4000);
  const note = cleanText(input.note, 8000);
  const type = ['highlight', 'note', 'clip'].includes(input.type) ? input.type : 'note';
  if (!quote && !note) throw new Error('Add selected text or a note before saving.');
  const annotation = { id: crypto.randomUUID(), type, quote, note, createdAt: Date.now(), sourceRef: cleanText(input.sourceRef || current[index].sourceRef || current[index].url, 2048) };
  current[index] = { ...current[index], annotations: [...(current[index].annotations || []), annotation].slice(-MAX_ANNOTATIONS), updatedAt: annotation.createdAt };
  return { items: current, annotation };
}
function removeAnnotation(items, itemId, annotationId) {
  return (Array.isArray(items) ? items : []).map((entry) => entry.id === String(itemId)
    ? { ...entry, annotations: (entry.annotations || []).filter((annotation) => annotation.id !== String(annotationId)), updatedAt: Date.now() }
    : entry);
}
function searchLibrary(items, query = '') {
  const terms = cleanText(query, 200).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (Array.isArray(items) ? items : []).filter((item) => {
    const latest = item.versions?.[0]?.content || '';
    const annotations = (item.annotations || []).map((annotation) => annotation.quote + ' ' + annotation.note).join(' ');
    const haystack = (item.title + ' ' + item.url + ' ' + item.sourceRef + ' ' + latest + ' ' + annotations).toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
function compareVersions(item, firstId, secondId) {
  const versions = item?.versions || [];
  const first = versions.find((version) => version.id === String(firstId));
  const second = versions.find((version) => version.id === String(secondId));
  if (!first || !second) throw new Error('Choose two saved versions to compare.');
  const a = first.content.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const b = second.content.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const aSet = new Set(a), bSet = new Set(b);
  return { firstVersionId: first.id, secondVersionId: second.id, removed: a.filter((line) => !bSet.has(line)), added: b.filter((line) => !aSet.has(line)) };
}
function exportLibrary(items, format = 'json') {
  const safe = (Array.isArray(items) ? items : []).slice(0, MAX_ITEMS);
  if (format === 'markdown') return safe.map((item) => {
    const latest = item.versions?.[0]?.content || '';
    const annotations = (item.annotations || []).map((annotation) => {
      const quote = annotation.quote ? '> ' + annotation.quote + '\n' : '';
      return '\n### ' + annotation.type + '\n' + quote + (annotation.note || '');
    }).join('\n');
    return '# ' + item.title + '\n\nSource: ' + (item.sourceRef || item.url) + '\n\n' + latest + annotations;
  }).join('\n\n---\n\n');
  return JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), items: safe }, null, 2);
}
function sanitizeStoredItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_ITEMS).filter((item) => item && typeof item.id === 'string' && safeSourceUrl(item.url)).map((item) => ({
    id: item.id.slice(0, 100), title: cleanText(item.title, 300), url: safeSourceUrl(item.url), sourceRef: cleanText(item.sourceRef || item.url, 2048),
    createdAt: Number(item.createdAt) || Date.now(), updatedAt: Number(item.updatedAt) || Date.now(),
    versions: (Array.isArray(item.versions) ? item.versions : []).slice(0, MAX_VERSIONS).filter((version) => version && typeof version.id === 'string' && typeof version.content === 'string').map((version) => {
      const content = cleanText(version.content);
      return { id: version.id.slice(0, 100), createdAt: Number(version.createdAt) || Date.now(), content, contentHash: /^[a-f0-9]{64}$/.test(version.contentHash || '') ? version.contentHash : crypto.createHash('sha256').update(content).digest('hex'), wordCount: Number(version.wordCount) || content.split(/\s+/).filter(Boolean).length };
    }),
    annotations: (Array.isArray(item.annotations) ? item.annotations : []).slice(-MAX_ANNOTATIONS).filter((annotation) => annotation && typeof annotation.id === 'string').map((annotation) => ({
      id: annotation.id.slice(0, 100), type: ['highlight','note','clip'].includes(annotation.type) ? annotation.type : 'note', quote: cleanText(annotation.quote, 4000), note: cleanText(annotation.note, 8000), createdAt: Number(annotation.createdAt) || Date.now(), sourceRef: cleanText(annotation.sourceRef || item.url, 2048)
    }))
  }));
}
module.exports = { MAX_ITEMS, cleanText, safeSourceUrl, upsertArticle, addAnnotation, removeAnnotation, searchLibrary, compareVersions, exportLibrary, sanitizeStoredItems };
