'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { upsertArticle, addAnnotation, removeAnnotation, searchLibrary, compareVersions, exportLibrary, sanitizeStoredItems } = require('../research-library');

test('captures a versioned article and avoids duplicate versions for identical content', () => {
  const first = upsertArticle([], { url: 'https://example.com/article', title: 'Article', content: 'First paragraph\nSecond paragraph' });
  assert.equal(first.items.length, 1);
  assert.equal(first.item.versions.length, 1);
  const duplicate = upsertArticle(first.items, { url: 'https://example.com/article', title: 'Article updated', content: 'First paragraph\nSecond paragraph' });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.item.versions.length, 1);
  const changed = upsertArticle(duplicate.items, { url: 'https://example.com/article', title: 'Article updated', content: 'First paragraph\nChanged paragraph' });
  assert.equal(changed.changed, true);
  assert.equal(changed.item.versions.length, 2);
});
test('rejects invalid source URLs and empty article text', () => {
  assert.throws(() => upsertArticle([], { url: 'file:///tmp/page', content: 'x' }));
  assert.throws(() => upsertArticle([], { url: 'https://example.com' }));
});
test('annotations are linked to an article and can be removed', () => {
  const saved = upsertArticle([], { url: 'https://example.com', content: 'Readable content' });
  const annotated = addAnnotation(saved.items, saved.item.id, { type: 'highlight', quote: 'Readable', note: 'Important' });
  assert.equal(annotated.items[0].annotations[0].type, 'highlight');
  assert.equal(annotated.items[0].annotations[0].quote, 'Readable');
  const removed = removeAnnotation(annotated.items, saved.item.id, annotated.annotation.id);
  assert.equal(removed[0].annotations.length, 0);
  assert.throws(() => addAnnotation(saved.items, 'missing', { note: 'x' }));
});
test('full-text search includes article content and annotations', () => {
  const saved = upsertArticle([], { url: 'https://example.com', title: 'Research', content: 'The browser engine uses isolated contexts.' });
  const annotated = addAnnotation(saved.items, saved.item.id, { note: 'Important privacy consideration' });
  assert.equal(searchLibrary(annotated.items, 'isolated contexts').length, 1);
  assert.equal(searchLibrary(annotated.items, 'privacy consideration').length, 1);
  assert.equal(searchLibrary(annotated.items, 'missing term').length, 0);
});
test('version comparison reports added and removed paragraphs', () => {
  const a = upsertArticle([], { url: 'https://example.com', content: 'Keep\nRemove' });
  const b = upsertArticle(a.items, { url: 'https://example.com', content: 'Keep\nAdd' });
  const diff = compareVersions(b.item, b.item.versions[1].id, b.item.versions[0].id);
  assert.deepEqual(diff.removed, ['Remove']);
  assert.deepEqual(diff.added, ['Add']);
});
test('exports Markdown and versioned JSON and sanitizes stored data', () => {
  const saved = upsertArticle([], { url: 'https://example.com', title: 'Example', content: 'Text' });
  assert.match(exportLibrary(saved.items, 'markdown'), /Source: https:\/\/example.com/);
  assert.equal(JSON.parse(exportLibrary(saved.items)).schemaVersion, 1);
  assert.equal(sanitizeStoredItems([{ id: 'x', url: 'javascript:alert(1)' }]).length, 0);
});
