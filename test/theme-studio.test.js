'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeThemeProfile, applyThemeProfile, sanitizeThemeProfiles, resolveWorkspaceTheme } = require('../theme-studio');

test('validates and normalizes versioned theme profiles', () => {
  const profile = normalizeThemeProfile({ name: 'Work', theme: 'light', themePreset: 'paper', density: 'compact', cornerStyle: 'sharp', fontFamily: 'inter', cssVariables: { '--accent': '#123abc' } });
  assert.equal(profile.schemaVersion, 1);
  assert.equal(profile.theme, 'light');
  assert.equal(profile.cssVariables['--accent'], '#123abc');
});
test('rejects arbitrary CSS properties and non-color values', () => {
  assert.throws(() => normalizeThemeProfile({ name: 'Unsafe', cssVariables: { '--background-image': 'url(https://example.com/x)' } }));
  assert.throws(() => normalizeThemeProfile({ name: 'Unsafe', cssVariables: { '--accent': 'expression(alert(1))' } }));
  assert.throws(() => normalizeThemeProfile({ name: '' }));
});
test('theme profile applies only validated design tokens', () => {
  const base = { theme: 'dark', accent: 'blue', density: 'comfortable', customThemeVariables: {} };
  const applied = applyThemeProfile(base, { name: 'Paper', theme: 'light', themePreset: 'paper', cssVariables: { '--accent': '#abcdef' } });
  assert.equal(applied.theme, 'light');
  assert.equal(applied.customThemeVariables['--accent'], '#abcdef');
});
test('workspace theme assignment and preview override are deterministic', () => {
  const profiles = [{ id: 'work-theme', name: 'Work', theme: 'light' }];
  const assigned = resolveWorkspaceTheme({ theme: 'dark' }, profiles, { work: 'work-theme' }, 'work');
  const preview = resolveWorkspaceTheme({ theme: 'dark' }, profiles, {}, 'personal', 'work-theme');
  assert.equal(assigned.theme, 'light');
  assert.equal(preview.theme, 'light');
});
test('stored profile sanitizer rejects invalid profiles and duplicate IDs', () => {
  const clean = sanitizeThemeProfiles([{ id: 'theme-one', name: 'One' }, { id: 'theme-one', name: 'Duplicate' }, { id: 'bad', name: '' }]);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].id, 'theme-one');
});
