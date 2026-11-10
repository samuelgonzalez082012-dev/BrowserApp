'use strict';

const PRESETS = ['graphite','midnight','nord','forest','sunset','paper','ocean','lavender','ember'];
const DENSITIES = ['compact','comfortable','spacious'];
const CORNERS = ['sharp','soft','rounded'];
const FONTS = ['system','inter','arial','georgia','mono'];
const ALLOWED_VARIABLES = new Set(['--accent','--custom-accent','--bg','--surface','--surface-2','--surface-3','--text','--muted','--border','--tab-active','--toolbar-bg','--panel-bg']);
const COLOR = /^#[0-9a-f]{6}$/i;

function cleanName(value) {
  const name = String(value || '').trim().slice(0, 48);
  if (!name) throw new Error('Theme profile name is required.');
  return name;
}
function normalizeThemeProfile(input = {}) {
  const variables = {};
  const raw = input.cssVariables && typeof input.cssVariables === 'object' && !Array.isArray(input.cssVariables) ? input.cssVariables : {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_VARIABLES.has(key) || !COLOR.test(String(value))) throw new Error('Custom theme variables must use an approved variable name and a six-digit hex color.');
    variables[key] = String(value).toLowerCase();
  }
  return {
    id: typeof input.id === 'string' && /^[a-z0-9_-]{4,100}$/i.test(input.id) ? input.id : '',
    name: cleanName(input.name),
    theme: ['dark','light'].includes(input.theme) ? input.theme : 'dark',
    themePreset: PRESETS.includes(input.themePreset) ? input.themePreset : 'graphite',
    accent: /^[a-z]+$/.test(input.accent || '') ? String(input.accent).slice(0, 24) : 'blue',
    customAccent: COLOR.test(input.customAccent || '') ? input.customAccent : '',
    density: DENSITIES.includes(input.density) ? input.density : 'comfortable',
    cornerStyle: CORNERS.includes(input.cornerStyle) ? input.cornerStyle : 'soft',
    fontFamily: FONTS.includes(input.fontFamily) ? input.fontFamily : 'system',
    cssVariables: variables,
    schemaVersion: 1
  };
}
function applyThemeProfile(baseSettings, profile) {
  if (!profile) return { ...baseSettings, customThemeVariables: {} };
  const clean = normalizeThemeProfile(profile);
  return {
    ...baseSettings,
    theme: clean.theme,
    themePreset: clean.themePreset,
    accent: clean.accent,
    customAccent: clean.customAccent,
    density: clean.density,
    cornerStyle: clean.cornerStyle,
    fontFamily: clean.fontFamily,
    customThemeVariables: { ...clean.cssVariables }
  };
}
function sanitizeThemeProfiles(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.slice(0, 100).flatMap((item) => {
    try {
      const clean = normalizeThemeProfile(item);
      const id = clean.id || 'theme-' + Math.random().toString(36).slice(2, 12);
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ ...clean, id }];
    } catch { return []; }
  });
}
function resolveWorkspaceTheme(baseSettings, profiles, assignments, workspaceId, previewId = '') {
  const selectedId = previewId || assignments?.[workspaceId] || '';
  const profile = (profiles || []).find((item) => item.id === selectedId);
  return applyThemeProfile(baseSettings, profile);
}
module.exports = { PRESETS, DENSITIES, CORNERS, FONTS, ALLOWED_VARIABLES, normalizeThemeProfile, applyThemeProfile, sanitizeThemeProfiles, resolveWorkspaceTheme };
