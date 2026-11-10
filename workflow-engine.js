'use strict';

const crypto = require('node:crypto');
const ALLOWED_STEPS = new Set(['new-tab','new-private-tab','open-url','sleep-inactive','save-session','capture-page','reader-view','export-pdf','translate-page','bookmark-active','open-services','open-passwords','open-settings']);
const CONFIRMATION_STEPS = new Set(['open-url','capture-page','export-pdf','translate-page']);
const MAX_STEPS = 20;

function normalizeSteps(input) {
  if (!Array.isArray(input) || !input.length || input.length > MAX_STEPS) throw new Error('A workflow must contain between 1 and 20 steps.');
  return input.map((step) => {
    if (!step || !ALLOWED_STEPS.has(step.type)) throw new Error('Workflow contains an unsupported action.');
    const value = step.type === 'open-url' ? String(step.value || '').trim().slice(0, 1500) : '';
    if (step.type === 'open-url') {
      let url;
      try { url = new URL(value); } catch { throw new Error('Workflow URLs must be valid HTTP or HTTPS addresses.'); }
      if (!['http:','https:'].includes(url.protocol)) throw new Error('Workflow URLs must use HTTP or HTTPS.');
    }
    return { type: step.type, value };
  });
}
function createWorkflow(input = {}) {
  const name = String(input.name || '').trim().slice(0, 70);
  if (!name) throw new Error('Enter a workflow name.');
  const steps = normalizeSteps(input.steps);
  const now = Date.now();
  return { id: String(input.id || crypto.randomUUID()), schemaVersion: 1, name, version: 1, steps, versions: [], createdAt: now, updatedAt: now };
}
function updateWorkflow(existing, input = {}) {
  if (!existing || typeof existing.id !== 'string') throw new Error('Workflow not found.');
  const name = String(input.name || existing.name || '').trim().slice(0, 70);
  if (!name) throw new Error('Enter a workflow name.');
  const steps = normalizeSteps(input.steps);
  const previous = { version: Number(existing.version) || 1, name: existing.name, steps: existing.steps, savedAt: Date.now() };
  return { ...existing, name, steps, version: previous.version + 1, versions: [previous, ...(existing.versions || [])].slice(0, 10), updatedAt: Date.now() };
}
function getConfirmationSummary(workflow) {
  const sensitive = (workflow?.steps || []).filter((step) => CONFIRMATION_STEPS.has(step.type));
  return { required: sensitive.length > 0, steps: sensitive.map((step) => step.type === 'open-url' ? 'Open ' + step.value : step.type.replace(/-/g, ' ')), count: sensitive.length };
}
function sanitizeWorkflows(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 100).flatMap((item) => {
    try {
      const created = createWorkflow({ id: item.id, name: item.name, steps: item.steps });
      return [{ ...created, version: Math.max(1, Number(item.version) || 1), createdAt: Number(item.createdAt) || created.createdAt, updatedAt: Number(item.updatedAt) || created.updatedAt, versions: Array.isArray(item.versions) ? item.versions.slice(0, 10) : [] }];
    } catch { return []; }
  });
}
module.exports = { ALLOWED_STEPS, CONFIRMATION_STEPS, normalizeSteps, createWorkflow, updateWorkflow, getConfirmationSummary, sanitizeWorkflows };
