'use strict';
const $ = (id) => document.getElementById(id);
const fields = ['theme','theme-preset','accent','font-family','corner-style','density','new-tab-background','search-engine','auto-sleep'];
const toolbarKeys = ['bookmark','split','downloads','ai','library','private','command','reader','capture','pdf','mini','translate','profile','adblock','settings'];
const shortcutKeys = ['command','reader','capture','split','downloads','history','notes','private'];
let savedSettings = {};
function readForm() {
  const toolbarVisibility = {};
  for (const key of toolbarKeys) toolbarVisibility[key] = document.querySelector(`[data-toolbar="${key}"]`)?.checked !== false;
  return {
    theme: $('theme').value, themePreset: $('theme-preset').value, accent: $('accent').value,
    customAccent: $('custom-accent').dataset.enabled === 'true' ? $('custom-accent').value : '',
    fontFamily: $('font-family').value, cornerStyle: $('corner-style').value, density: $('density').value,
    compactTabs: $('compact-tabs').value === 'true', newTabBackground: $('new-tab-background').value,
    searchEngine: $('search-engine').value, autoSleepMinutes: Number($('auto-sleep').value),
    animations: $('animations').checked, trackerBlocking: $('tracker-blocking').checked,
    cookieBannerFiltering: $('cookie-banner-filtering').checked, toolbarVisibility,
    customShortcuts: Object.fromEntries(shortcutKeys.map((key) => [key, $(`shortcut-${key}`).value.toLowerCase()])),
    browserName: $('browser-name').value.trim(), newTabGreeting: $('newtab-greeting').value.trim(), newTabLayout: $('newtab-layout').value,
    tabWidth: Number($('tab-width').value), sidebarWidth: Number($('sidebar-width').value), wallpaperDim: Number($('wallpaper-dim').value),
    mouseGestures: $('mouse-gestures').checked, showWorkspaceDashboard: $('workspace-dashboard').checked,
    toolbarOrder: [...document.querySelectorAll('#toolbar-order-list [data-order]')].map((item) => item.dataset.order),
    showClock: $('show-clock').checked, showFavorites: $('show-favorites').checked, showRecent: $('show-recent').checked, showNotes: $('show-notes').checked, showSessions: $('show-sessions').checked,
    wallpaperPath: savedSettings.wallpaperPath || ''
  };
}
function previewTheme() {
  document.documentElement.dataset.theme = $('theme').value;
  document.documentElement.dataset.accent = $('accent').value;
  document.documentElement.dataset.preset = $('theme-preset').value;
  document.documentElement.dataset.density = $('density').value;
  document.documentElement.dataset.corners = $('corner-style').value;
  document.documentElement.dataset.font = $('font-family').value;
  if ($('custom-accent').dataset.enabled === 'true') document.documentElement.style.setProperty('--custom-accent', $('custom-accent').value);
  else document.documentElement.style.removeProperty('--custom-accent');
}
async function loadSettings() {
  try {
    savedSettings = await window.settingsAPI.get() || {};
    $('theme').value = savedSettings.theme || 'dark'; $('theme-preset').value = savedSettings.themePreset || 'graphite';
    $('accent').value = savedSettings.accent || 'blue'; $('custom-accent').value = savedSettings.customAccent || '#93a9ff';
    $('custom-accent').dataset.enabled = String(Boolean(savedSettings.customAccent));
    $('font-family').value = savedSettings.fontFamily || 'system'; $('corner-style').value = savedSettings.cornerStyle || 'soft';
    $('density').value = savedSettings.density || 'comfortable'; $('compact-tabs').value = String(Boolean(savedSettings.compactTabs));
    $('new-tab-background').value = savedSettings.newTabBackground || 'default'; $('search-engine').value = savedSettings.searchEngine || 'google';
    $('auto-sleep').value = String(savedSettings.autoSleepMinutes || 0); $('animations').checked = savedSettings.animations !== false;
    $('tracker-blocking').checked = Boolean(savedSettings.trackerBlocking); $('cookie-banner-filtering').checked = Boolean(savedSettings.cookieBannerFiltering);
    $('show-clock').checked = savedSettings.showClock !== false; $('show-favorites').checked = savedSettings.showFavorites !== false; $('show-recent').checked = savedSettings.showRecent !== false; $('show-notes').checked = savedSettings.showNotes !== false; $('show-sessions').checked = savedSettings.showSessions !== false;
    for (const key of toolbarKeys) { const input = document.querySelector(`[data-toolbar="${key}"]`); if (input) input.checked = savedSettings.toolbarVisibility?.[key] !== false; }
    const shortcuts = savedSettings.customShortcuts || {};
    for (const key of shortcutKeys) { const input = $(`shortcut-${key}`); if (input) input.value = shortcuts[key] || ({command:'k',reader:'r',capture:'s',split:'d',downloads:'j',history:'h',notes:'n',private:'p'}[key]); }
    $('browser-name').value = savedSettings.browserName || 'Minimal Browser'; $('newtab-greeting').value = savedSettings.newTabGreeting || 'What would you like to explore?'; $('newtab-layout').value = savedSettings.newTabLayout || 'cards';
    $('tab-width').value = String(savedSettings.tabWidth || 210); $('sidebar-width').value = String(savedSettings.sidebarWidth || 356); $('wallpaper-dim').value = String(savedSettings.wallpaperDim || 62);
    $('mouse-gestures').checked = savedSettings.mouseGestures !== false; $('workspace-dashboard').checked = savedSettings.showWorkspaceDashboard !== false;
    const order = Array.isArray(savedSettings.toolbarOrder) ? savedSettings.toolbarOrder : [];
    const list = $('toolbar-order-list'); const byKey = new Map([...list.children].map((item) => [item.dataset.order, item]));
    for (const key of [...order, ...[...byKey.keys()].filter((key) => !order.includes(key))]) { const item = byKey.get(key); if (item) list.appendChild(item); }
    updateRangeLabels();
    $('wallpaper-status').textContent = savedSettings.wallpaperPath ? 'A custom wallpaper is selected.' : 'No custom wallpaper selected.';
    $('download-path').textContent = savedSettings.downloadPath || 'System Downloads folder (change from Downloads panel).';
    previewTheme();
  } catch (error) { console.error('Could not load settings:', error); $('save-status').textContent = 'Could not load settings.'; }
}
for (const id of ['theme','theme-preset','accent','font-family','corner-style','density','custom-accent']) $(id).addEventListener('change', previewTheme);
$('custom-accent').addEventListener('input', () => { $('custom-accent').dataset.enabled = 'true'; previewTheme(); });
$('clear-custom-accent').addEventListener('click', () => { $('custom-accent').dataset.enabled = 'false'; previewTheme(); });
$('choose-wallpaper').addEventListener('click', async () => { const result = await window.settingsAPI.chooseWallpaper(); if (result?.ok) { savedSettings.wallpaperPath = result.path; $('wallpaper-status').textContent = 'Custom wallpaper selected.'; } else if (result?.error) $('save-status').textContent = result.error; });
$('remove-wallpaper').addEventListener('click', () => { savedSettings.wallpaperPath = ''; $('wallpaper-status').textContent = 'Custom wallpaper will be removed when you save preferences.'; });
$('export-backup').addEventListener('click', async () => { const result = await window.settingsAPI.exportBackup(); $('save-status').textContent = result?.ok ? 'Backup exported.' : result?.error || (result?.cancelled ? 'Export cancelled.' : 'Export failed.'); });
$('import-backup').addEventListener('click', async () => { if (!confirm('Importing a backup replaces stored browser data. Continue?')) return; const result = await window.settingsAPI.importBackup(); $('save-status').textContent = result?.ok ? 'Backup imported. Restart the browser to fully reload tabs.' : result?.error || (result?.cancelled ? 'Import cancelled.' : 'Import failed.'); });
$('save-settings').addEventListener('click', async () => {
  const settings = readForm();
  for (const key of shortcutKeys) {
    const name = key;
    if (!/^[a-z0-9]$/i.test(settings.customShortcuts[key])) { $('save-status').textContent = `Enter one letter or number for the ${name} shortcut.`; return; }
  }
  $('save-settings').disabled = true; $('save-status').textContent = 'Saving preferences…';
  try { await window.settingsAPI.save(settings); savedSettings = { ...savedSettings, ...settings }; $('save-status').textContent = 'Your browser preferences have been saved.'; }
  catch (error) { console.error(error); $('save-status').textContent = `Could not save preferences: ${error.message}`; }
  finally { $('save-settings').disabled = false; }
});

function updateRangeLabels() {
  $('tab-width-value').textContent = `${$('tab-width').value} px`;
  $('sidebar-width-value').textContent = `${$('sidebar-width').value} px`;
  $('wallpaper-dim-value').textContent = `${$('wallpaper-dim').value}%`;
}
for (const id of ['tab-width','sidebar-width','wallpaper-dim']) $(id).addEventListener('input', updateRangeLabels);
$('toolbar-order-list').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-move]');
  if (!button) return;
  const item = button.closest('[data-order]');
  if (!item) return;
  if (button.dataset.move === 'up' && item.previousElementSibling) item.parentNode.insertBefore(item, item.previousElementSibling);
  if (button.dataset.move === 'down' && item.nextElementSibling) item.parentNode.insertBefore(item.nextElementSibling, item);
});

// Brave-style settings navigation: search settings and keep the active category visible.
const settingsSearch = $('settings-search');
const settingsNavLinks = [...document.querySelectorAll('.settings-nav a')];
const settingsSections = [...document.querySelectorAll('.settings-main .settings-section')];
if (settingsSearch) {
  settingsSearch.addEventListener('input', () => {
    const query = settingsSearch.value.trim().toLowerCase();
    for (const section of settingsSections) {
      const link = settingsNavLinks.find((item) => item.hash === `#${section.id}`);
      const matches = !query || section.textContent.toLowerCase().includes(query);
      section.hidden = !matches;
      if (link) link.hidden = !matches;
    }
  });
}
for (const link of settingsNavLinks) {
  link.addEventListener('click', () => {
    settingsNavLinks.forEach((item) => item.classList.toggle('active', item === link));
  });
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    settingsNavLinks.forEach((link) => link.classList.toggle('active', link.hash === `#${visible.target.id}`));
  }, { root: $('settings-main'), rootMargin: '-8% 0px -72% 0px', threshold: [0, .1, .3] });
  settingsSections.forEach((section) => observer.observe(section));
}
document.querySelectorAll('[data-open-hub]').forEach((button) => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    const result = await window.settingsAPI.openHub(button.dataset.openHub);
    if (!result?.ok) $('save-status').textContent = result?.error || 'Could not open Browser Hub.';
    button.disabled = false;
  });
});

loadSettings();
