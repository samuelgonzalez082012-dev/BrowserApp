'use strict';

const params = new URLSearchParams(window.location.search);
const title = (params.get('title') || 'Untitled page').slice(0, 180);
const reason = (params.get('reason') || 'The webpage renderer stopped unexpectedly.').slice(0, 180);
const target = params.get('url') || '';
const titleNode = document.getElementById('page-title');
const summaryNode = document.getElementById('summary');
const addressNode = document.getElementById('page-address');
const retryButton = document.getElementById('retry');

let safeTarget = '';
try {
  const parsed = new URL(target);
  if (parsed.protocol === 'https:' || parsed.protocol === 'http:') safeTarget = parsed.href;
} catch { /* Invalid or missing URL: leave reload disabled. */ }

titleNode.textContent = title;
summaryNode.textContent = reason;
if (safeTarget) {
  const parsed = new URL(safeTarget);
  addressNode.textContent = parsed.origin;
  retryButton.disabled = false;
} else {
  addressNode.textContent = 'There is no saved web address to reload.';
}

retryButton.addEventListener('click', () => {
  if (!safeTarget) return;
  // Revalidate at the moment of navigation; the browser main process also
  // enforces the HTTP(S)-only navigation policy.
  try {
    const parsed = new URL(safeTarget);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') window.location.replace(parsed.href);
  } catch { /* Keep the recovery screen visible. */ }
});

document.getElementById('back').addEventListener('click', () => {
  if (window.history.length > 1) window.history.back();
});
