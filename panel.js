'use strict';

const api = window.panelAPI;
const content = document.getElementById('panel-content');
const heading = document.getElementById('panel-heading');
const toastElement = document.getElementById('toast');
let state = null;
let section = 'workspaces';
let historyQuery = '';
let toastTimer = null;
let performanceSnapshot = null;
let siteCookieCache = [];
let updateStatusMessage = ''; 

const SECTION_NAMES = {
  workspaces: 'Workspaces', containers: 'Tab containers', bookmarks: 'Bookmarks', history: 'History', downloads: 'Downloads',
  split: 'Split screen', ai: 'AI assistant', privacy: 'Privacy', extensions: 'Extensions',
  groups: 'Tab groups', notes: 'Notes', collections: 'Collections', sessions: 'Saved sessions', journeys: 'Browsing journeys',
  performance: 'Performance manager', webpanels: 'Web panels', notifications: 'Notifications', tools: 'Research tools',
  profiles: 'Browser profiles', migration: 'Import and backup', sitecontrols: 'Site controls', apps: 'Installed web apps',
  accessibility: 'Accessibility and translation', developer: 'Developer tools', updates: 'Browser updates', adblock: 'Ad blocker',
  passwords: 'Password manager', services: 'Connected services', automations: 'Browser automations', research: 'Research library', themes: 'Personalization studio', security: 'Security dashboard', plugins: 'Local plugins', about: 'About Minimal Browser'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function bytes(value) {
  const n = Number(value) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function dateLabel(value) {
  if (!value) return '';
  try { return new Date(value).toLocaleString(); } catch { return ''; }
}
function showToast(message, isError = false) {
  toastElement.textContent = message;
  toastElement.classList.toggle('error', isError);
  toastElement.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 2600);
}
function currentWorkspace() {
  return state?.workspaces?.find((workspace) => workspace.id === state.activeWorkspaceId);
}
function updateSectionButtons() {
  document.querySelectorAll('.section-nav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.section === section);
  });
  heading.textContent = SECTION_NAMES[section] || 'Browser tools';
}
function setSection(next) {
  if (!SECTION_NAMES[next]) return;
  section = next;
  api.setSection(next);
  historyQuery = '';
  updateSectionButtons();
  renderContent();
  if (next === 'performance') {
    const requestedSection = next;
    api.performance().then((snapshot) => { if (section === requestedSection) { performanceSnapshot = snapshot; renderContent(); } }).catch((error) => showToast(`Could not read performance metrics: ${error.message}`, true));
  }
  if (next === 'sitecontrols') { api.action('list-site-cookies').then((result) => { siteCookieCache = result?.ok ? result.cookies : []; renderContent(); }).catch(() => { siteCookieCache = []; }); }
}
function actionButton(label, action, payload = '', extraClass = '', disabled = false) {
  const payloadAttr = payload ? `data-value="${escapeHtml(payload)}"` : '';
  return `<button type="button" class="small-button ${extraClass}" data-action="${action}" ${payloadAttr} ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`;
}
function emptyState(title, detail) {
  return `<div class="empty-state"><div class="empty-mark">·</div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div>`;
}

function renderWorkspaces() {
  const active = currentWorkspace();
  const workspaceCards = (state.workspaces || []).map((workspace) => `
    <button class="workspace-card ${workspace.id === state.activeWorkspaceId ? 'selected' : ''}" data-action="switch-workspace" data-value="${escapeHtml(workspace.id)}" type="button">
      <span class="workspace-dot" style="--workspace-color:${escapeHtml(workspace.color || '#93a9ff')}"></span>
      <span class="workspace-card-text"><strong>${escapeHtml(workspace.name)}</strong><small>${workspace.tabCount} tab${workspace.tabCount === 1 ? '' : 's'}</small></span>
      ${workspace.id === state.activeWorkspaceId ? '<span class="selected-mark">✓</span>' : ''}
    </button>`).join('');
  const tabs = (state.tabs || []).map((tab) => `
    <button class="list-row tab-row ${tab.active ? 'current' : ''}" data-action="open-tab" data-value="${escapeHtml(tab.id)}" type="button">
      <span class="row-icon">${tab.isPrivate ? '◉' : tab.pinned ? '◆' : '↗'}</span>
      <span class="row-main"><strong>${escapeHtml(tab.title)}</strong><small>${escapeHtml(tab.url || 'New tab page')}</small></span>
      ${tab.active ? '<span class="row-tag">Active</span>' : ''}
    </button>`).join('');
  return `
    <section class="section-block">
      <div class="section-heading"><div><strong>Your spaces</strong><p>Keep tabs organized by project or activity.</p></div></div>
      <div class="workspace-list">${workspaceCards || emptyState('No workspaces', 'Create a workspace to organize tabs.')}</div>
      <div class="inline-form"><input id="new-workspace-name" type="text" maxlength="32" placeholder="New workspace name"><input id="new-workspace-color" type="color" value="#93a9ff" aria-label="Workspace color"><button class="primary-button" data-action="create-workspace">Create</button></div>
    </section>
    <section class="section-block workspace-management">
      <div class="section-heading"><div><strong>Current workspace</strong><p>Rename or remove this space.</p></div></div>
      <div class="inline-form"><input id="rename-workspace-name" type="text" maxlength="32" value="${escapeHtml(active?.name || '')}" placeholder="Workspace name">${actionButton('Rename', 'rename-workspace')}</div>
      <div class="button-line">${actionButton('Delete workspace', 'delete-workspace', active?.id || '', 'danger-button', (state.workspaces || []).length <= 1)}</div>
    </section>
    <section class="section-block">
      <div class="section-heading"><div><strong>Tabs in this space</strong><p>${(state.tabs || []).length} open tab${(state.tabs || []).length === 1 ? '' : 's'}.</p></div></div>
      <div class="row-list">${tabs || emptyState('No tabs here', 'Create a tab to get started.')}</div>
    </section>`;
}

function renderBookmarks() {
  const activeTab = (state.tabs || []).find((tab) => tab.id === state.activeTabId);
  const canBookmark = Boolean(activeTab && !activeTab.isPrivate && !activeTab.isNewTab);
  const rows = (state.bookmarks || []).map((bookmark) => `
    <div class="list-row">
      <button class="row-open" data-action="open-bookmark" data-value="${escapeHtml(bookmark.url)}" type="button">
        <span class="row-icon">☆</span><span class="row-main"><strong>${escapeHtml(bookmark.title || bookmark.url)}</strong><small>${escapeHtml(bookmark.url)}</small></span>
      </button>
      <button class="row-remove" data-action="remove-bookmark" data-value="${escapeHtml(bookmark.id)}" title="Remove bookmark" aria-label="Remove bookmark">×</button>
    </div>`).join('');
  return `
    <section class="section-block">
      <div class="section-heading"><div><strong>Saved pages</strong><p>Keep useful websites close at hand.</p></div></div>
      <div class="button-line">${actionButton('Bookmark current page', 'add-bookmark', '', 'primary-button', !canBookmark)}</div>
      <div class="row-list">${rows || emptyState('No bookmarks yet', 'Use the bookmark button in the toolbar to save the current page.')}</div>
    </section>`;
}

function renderHistory() {
  const entries = (state.history || []).filter((entry) => {
    const query = historyQuery.toLowerCase();
    return !query || `${entry.title} ${entry.url}`.toLowerCase().includes(query);
  });
  const rows = entries.map((entry) => `
    <div class="list-row">
      <button class="row-open" data-action="open-history" data-value="${escapeHtml(entry.url)}" type="button">
        <span class="row-icon">◷</span><span class="row-main"><strong>${escapeHtml(entry.title || entry.url)}</strong><small>${escapeHtml(entry.url)} · ${escapeHtml(dateLabel(entry.visitedAt))}</small></span>
      </button>
      <button class="row-remove" data-action="remove-history" data-value="${escapeHtml(entry.id)}" title="Remove from history" aria-label="Remove from history">×</button>
    </div>`).join('');
  return `
    <section class="section-block">
      <div class="section-heading"><div><strong>Recently visited</strong><p>History is stored on this device. Private tabs are not added.</p></div></div>
      <input class="full-input" id="history-search" type="search" placeholder="Search history" value="${escapeHtml(historyQuery)}">
      <div class="button-line">${actionButton('Clear all history', 'clear-history', '', 'danger-button')}</div>
      <div class="row-list" id="history-rows">${rows || emptyState('No matching history', 'Visited websites will appear here.')}</div>
    </section>`;
}

function renderDownloads() {
  const downloads = state.downloads || [];
  const rows = downloads.map((item) => {
    const inProgress = ['progressing', 'paused', 'interrupted', 'queued'].includes(item.state);
    const isDone = item.state === 'completed';
    const progress = Math.max(0, Math.min(100, Number(item.percent) || 0));
    let controls = '';
    if (item.state === 'queued') controls = `${actionButton('Cancel', 'download-cancel', item.id, 'danger-button')}`;
    else if (item.state === 'progressing') controls = `${actionButton('Pause', 'download-pause', item.id)} ${actionButton('Cancel', 'download-cancel', item.id, 'danger-button')}`;
    else if (item.state === 'paused') controls = `${actionButton('Resume', 'download-resume', item.id)} ${actionButton('Cancel', 'download-cancel', item.id, 'danger-button')}`;
    else if (item.state === 'interrupted' && item.canResume) controls = `${actionButton('Resume', 'download-resume', item.id)} ${actionButton('Cancel', 'download-cancel', item.id, 'danger-button')}`;
    else if (item.state === 'interrupted') controls = '<span class="muted-note">Interrupted — restart from the source website.</span>';
    else if (isDone) controls = `${actionButton('Open', 'download-open', item.id)} ${actionButton('Show', 'download-show', item.id)} ${actionButton('Scan', 'scan-download', item.id)}`;
    return `
      <div class="download-card">
        <div class="download-top"><span class="download-file-icon">↓</span><div class="row-main"><strong>${escapeHtml(item.filename)}</strong><small>${escapeHtml(item.state)}${item.totalBytes ? ` · ${bytes(item.receivedBytes)} / ${bytes(item.totalBytes)}` : ` · ${bytes(item.receivedBytes)}`}</small></div></div>
        ${inProgress ? `<div class="progress-track"><span style="width:${progress}%"></span></div>` : ''}
        <div class="download-controls">${isDone ? '100%' : `${progress}%`} <span>${controls}</span></div>
      </div>`;
  }).join('');
  return `
    <section class="section-block">
      <div class="section-heading"><div><strong>Downloads</strong><p>Progress and completed files.</p></div></div>
      <div class="folder-setting"><div><strong>Download location</strong><small>${escapeHtml(settingsPathLabel())}</small></div>${actionButton('Change', 'choose-download-folder')}</div>
      <label class="toggle-row"><span><strong>Organize downloads automatically</strong><small>Sort new downloads into Images, Media, Documents, Archives and Other folders.</small></span><input id="download-organize-toggle" type="checkbox" ${state.settings?.organizeDownloads?'checked':''}></label>
      <div class="folder-setting"><div><strong>Simultaneous downloads</strong><small>Excess transfers wait in the queue. Active downloads are not stopped if you lower this limit.</small></div><select id="download-concurrency-choice" aria-label="Simultaneous downloads">${Array.from({length:10},(_,index)=>index+1).map((value)=>`<option value="${value}" ${Number(state.settings?.maxConcurrentDownloads || 3)===value?'selected':''}>${value}</option>`).join('')}</select></div><div class="button-line">${actionButton('Clear completed', 'download-clear-completed')}</div>
      <div class="download-list">${rows || emptyState('Nothing downloaded yet', 'Files you download will appear here.')}</div>
    </section>`;
}
function settingsPathLabel() {
  return state.settings?.downloadPath || 'System Downloads folder';
}

function renderSplit() {
  const candidates = (state.tabs || []).filter((tab) => tab.id !== state.activeTabId);
  const selected = state.splitTabIds || (state.splitTabId ? [state.splitTabId] : []);
  const rows = candidates.map((tab) => {
    const inSplit = selected.includes(tab.id);
    return `<div class="list-row selectable-row"><span class="row-icon">▣</span><span class="row-main"><strong>${escapeHtml(tab.title)}</strong><small>${escapeHtml(tab.url || 'New tab page')}</small></span>${inSplit ? actionButton('Remove', 'remove-split-tab', tab.id, 'danger-button') : actionButton('Add', 'split-tab', tab.id, 'primary-button', selected.length >= 3)}</div>`;
  }).join('');
  const selectedRows = selected.map((id, index) => {
    const tab = candidates.find((item) => item.id === id) || state.tabs.find((item) => item.id === id);
    return tab ? `<div class="mini-row-wrap"><span class="mini-row"><strong>${index + 2}.</strong> ${escapeHtml(tab.title || tab.url || 'New tab')}</span>${actionButton('Remove', 'remove-split-tab', tab.id, 'danger-button')}</div>` : '';
  }).join('');
  return `
    <section class="section-block">
      <div class="section-heading"><div><strong>Multi-page workspace</strong><p>Show up to four tabs at once. The active tab is the first pane; add up to three more pages.</p></div></div>
      <div class="status-card"><span class="status-dot"></span><div><strong>${selected.length + 1} of 4 panes selected</strong><small>${state.splitEnabled ? 'Split view is active.' : 'Choose additional tabs below to start.'}</small></div></div>
      ${selectedRows ? `<div class="feature-list">${selectedRows}</div>` : ''}
      <label class="field-label" for="split-layout">Layout</label>
      <select class="full-input" id="split-layout"><option value="grid" ${state.splitLayout === 'grid' ? 'selected' : ''}>2 × 2 grid</option><option value="columns" ${state.splitLayout === 'columns' ? 'selected' : ''}>Equal columns</option><option value="focus" ${state.splitLayout === 'focus' ? 'selected' : ''}>Focus + stacked pages</option></select>
      ${selected.length === 1 ? `<label class="range-setting"><span>First pane width <strong id="split-ratio-value">${Math.round((state.splitRatio || 0.5) * 100)}%</strong></span><input id="split-ratio" type="range" min="30" max="70" step="1" value="${Math.round((state.splitRatio || 0.5) * 100)}"></label>` : ''}
      <div class="button-line">${actionButton('Exit split view', 'exit-split', '', 'danger-button', selected.length === 0)}</div>
    </section>
    <section class="section-block"><div class="section-heading"><div><strong>Add pages</strong><p>Only tabs in this workspace can be placed into the same split layout.</p></div></div><div class="row-list">${rows || emptyState('No additional tabs', 'Open another tab in this workspace first.')}</div></section>`;
}

function renderAI() {
  const configured = Boolean(state.settings?.hasAiKey);
  return `
    <section class="section-block">
      <div class="section-heading"><div><strong>Ask about the page</strong><p>Page text is shared with your configured AI endpoint only when you submit a request.</p></div></div>
      <div class="button-line"><button class="primary-button" id="summarize-page" type="button">Summarize current page</button></div><div class="button-line"><button class="small-button" id="compare-tabs" type="button">Compare loaded tabs in this workspace</button></div>
      <textarea id="ai-question" class="full-textarea" rows="3" placeholder="Ask a question about the current webpage…"></textarea>
      <div class="button-line"><button class="primary-button" id="ask-ai" type="button">Ask assistant</button><span id="ai-status" class="muted-note">${configured ? 'API key is saved securely.' : 'AI provider setup needed.'}</span></div>
      <pre id="ai-answer" class="ai-answer" aria-live="polite">Your response will appear here.</pre>
    </section>
    <section class="section-block">
      <div class="section-heading"><div><strong>AI provider</strong><p>Uses an OpenAI-compatible chat completions endpoint. A provider may charge for API usage.</p></div></div>
      <label class="field-label" for="ai-endpoint">Endpoint URL</label>
      <input class="full-input" id="ai-endpoint" value="${escapeHtml(state.settings?.aiEndpoint || 'https://api.openai.com/v1/chat/completions')}" placeholder="https://…/v1/chat/completions">
      <label class="field-label" for="ai-model">Model</label>
      <input class="full-input" id="ai-model" value="${escapeHtml(state.settings?.aiModel || 'gpt-4o-mini')}" placeholder="Model name">
      <label class="field-label" for="ai-key">API key ${configured ? '(saved; leave blank to keep)' : ''}</label>
      <input class="full-input" id="ai-key" type="password" autocomplete="new-password" placeholder="Paste API key (stored using OS secure storage)">
      <div class="button-line"><button class="primary-button" id="save-ai-config" type="button">Save provider settings</button></div>
    </section>`;
}

function renderPrivacy() {
  const origin = state.activeOrigin || '';
  const stats = state.adblock?.stats || {};
  const protectedSite = origin && (state.adblock?.whitelist || []).includes(origin);
  const perms = [['geolocation','Location'],['notifications','Notifications'],['media','Camera and microphone']];
  const permissionRows = perms.map(([id,label]) => `<div class="permission-row"><div><strong>${label}</strong><small>${state.permissions?.[id] === 'allow' ? 'Allowed for this site' : 'Blocked by default'}</small></div><select data-permission="${id}" aria-label="${label} permission"><option value="deny" ${state.permissions?.[id] === 'allow' ? '' : 'selected'}>Block</option><option value="allow" ${state.permissions?.[id] === 'allow' ? 'selected' : ''}>Allow</option></select></div>`).join('');
  const autoLock = Number(state.settings?.passwordVaultAutoLockMinutes ?? 10);
  return `<section class="section-block"><div class="section-heading"><div><strong>Privacy overview</strong><p>Ad blocking, tracking protection, site permissions and local privacy controls.</p></div></div><div class="status-card"><span class="status-dot"></span><div><strong>${state.adblockStatus?.enabled ? 'Ad blocker enabled' : 'Ad blocker not active'}</strong><small>${escapeHtml(state.adblockStatus?.message || 'Filter engine status unavailable.')}</small></div></div><div class="stat-grid"><div class="stat-card"><strong>${Number(stats.blocked || 0).toLocaleString()}</strong><small>Total blocked requests</small></div><div class="stat-card"><strong>${Number(stats.trackers || 0).toLocaleString()}</strong><small>Tracking requests</small></div></div><div class="button-line">${actionButton('Open ad blocker settings','open-adblock-panel','','primary-button')}${actionButton('Open site controls','open-site-controls')}</div></section>
  <section class="section-block"><div class="section-heading"><div><strong>Current site</strong><p>${escapeHtml(origin || 'No active website')}</p></div></div><div class="button-line">${actionButton(protectedSite ? 'Allow protection on this site' : 'Pause protection on this site','adblock-whitelist-toggle','',protectedSite?'danger-button':'')}</div>${permissionRows}${origin ? `<div class="button-line">${actionButton('Manage cookies and site data','open-site-controls')}${actionButton('Clear site data','clear-site-data','','danger-button')}</div>` : ''}</section>
  <section class="section-block"><div class="section-heading"><div><strong>Local privacy preferences</strong><p>These settings apply to the current browser profile and are stored locally.</p></div></div><label class="setting-toggle"><span><strong>Reduce cross-site referrer details</strong><small>Send only the referring origin on cross-origin requests where the session API permits it.</small></span><input id="privacy-strict-referrer" type="checkbox" ${state.settings?.strictReferrerPolicy !== false ? 'checked' : ''}></label><label class="setting-toggle"><span><strong>Clear cookies on browser exit</strong><small>Clears cookies for the active profile on exit. Other profile data such as bookmarks and history is retained.</small></span><input id="privacy-clear-cookies-exit" type="checkbox" ${state.settings?.clearCookiesOnExit ? 'checked' : ''}></label><div class="vault-warning">Cookie clearing signs you out of websites in this profile. It does not clear cookies in other profiles.</div><div class="button-line">${actionButton('Open site permissions dashboard','open-site-controls')}</div></section>
  <section class="section-block"><div class="section-heading"><div><strong>Password vault security</strong><p>Set how long an unlocked password vault may remain idle.</p></div></div><label class="field-label" for="password-vault-autolock">Automatically lock vault after</label><select id="password-vault-autolock" class="full-input"><option value="0" ${autoLock===0?'selected':''}>Never (not recommended)</option><option value="1" ${autoLock===1?'selected':''}>1 minute</option><option value="5" ${autoLock===5?'selected':''}>5 minutes</option><option value="10" ${autoLock===10?'selected':''}>10 minutes</option><option value="15" ${autoLock===15?'selected':''}>15 minutes</option><option value="30" ${autoLock===30?'selected':''}>30 minutes</option></select><p class="muted-note">The vault also locks when you switch profiles or close the browser.</p></section>
  <section class="section-block"><div class="section-heading"><div><strong>Private browsing</strong><p>Temporary in-memory session. Tabs are excluded from saved history and profile backups.</p></div></div><div class="button-line">${actionButton('Open private tab','open-private-tab','','primary-button')}</div></section>`;
}

function renderExtensions() {
  const extensions = state.extensions || [];
  const rows = extensions.map((extension) => {
    const warnings = [];
    if (Number(extension.manifest?.manifest_version) === 2) warnings.push('Manifest V2 may be unsupported in future Chromium versions.');
    if (extension.manifest?.host_permissions?.includes('<all_urls>') || extension.permissions?.includes('<all_urls>')) warnings.push('Broad website access requested.');
    return `<article class="extension-card"><div class="extension-icon">⌘</div><div class="row-main"><strong>${escapeHtml(extension.name)}</strong><small>v${escapeHtml(extension.version)} · ${escapeHtml(extension.id)}</small><small>Permissions: ${escapeHtml((extension.permissions || []).join(', ') || 'Not declared')}</small><small>${extension.enabled ? 'Enabled' : 'Disabled'} · ${escapeHtml(extension.path)}</small>${warnings.map((warning) => `<small class="muted-note">⚠ ${escapeHtml(warning)}</small>`).join('')}</div><button class="small-button" data-action="extension-toggle" data-value="${escapeHtml(extension.id)}" data-enabled="${extension.enabled ? 'false' : 'true'}">${extension.enabled ? 'Disable' : 'Enable'}</button><button class="small-button" data-action="extension-reload" data-value="${escapeHtml(extension.id)}">Reload</button><button class="row-remove" data-action="remove-extension" data-value="${escapeHtml(extension.id)}" title="Remove extension">×</button></article>`;
  }).join('');
  const catalog = (state.extensionCatalog || []).map((item) => `<article class="catalog-card"><strong>${escapeHtml(item.name)} <span class="muted-note">${escapeHtml(item.version)}</span></strong><small class="muted-note">${escapeHtml(item.category)}</small><p>${escapeHtml(item.description)}</p>${actionButton('Open listing','open-extension-listing',item.id,'primary-button')}</article>`).join('');
  return `<section class="section-block"><div class="button-line">${actionButton('Export extension collection','export-extension-collection')} ${actionButton('Import extension collection','import-extension-collection')}</div><div class="section-heading"><div><strong>Installed extensions</strong><p>Manage compatible unpacked extensions for this profile. Paths are remembered between launches.</p></div></div><div class="button-line"><button class="primary-button" id="add-extension" type="button">Add unpacked extension</button></div><div class="extension-list">${rows || emptyState('No extensions installed','Choose a trusted unpacked extension folder to add one.')}</div></section>
  <section class="section-block"><div class="section-heading"><div><strong>Extension library</strong><p>Connect a trusted HTTPS catalog that publishes metadata and listing links. This browser does not install CRX files or execute catalog downloads.</p></div></div><label class="field-label" for="extension-catalog-url">Catalog JSON URL</label><input class="full-input" id="extension-catalog-url" value="${escapeHtml(state.settings?.extensionCatalogUrl || '')}" placeholder="https://your-domain.example/extensions.json"><div class="button-line">${actionButton('Save catalog URL','save-extension-catalog','','primary-button')}${actionButton('Refresh catalog','refresh-extension-catalog')}</div><div class="feature-list">${catalog || emptyState('No catalog entries','Set a trusted catalog URL. The catalog format is documented in the README.')}</div></section>
  <section class="notice-card"><strong>Compatibility and security</strong><p>Electron supports only a subset of Chrome extension APIs. The browser loads unpacked folders only. Catalog entries are listing links, not verified packages. Always inspect extension source and permissions before loading it.</p></section>`;
}


function renderContainers() {
  const containers = state.containers || [];
  const tabs = state.allTabs || [];
  const active = tabs.find((tab) => tab.id === state.activeTabId) || (state.tabs || []).find((tab) => tab.id === state.activeTabId);
  const cards = containers.map((container) => {
    const members = tabs.filter((tab) => tab.containerId === container.id);
    const isDefault = container.id === 'default';
    return `<article class="feature-card container-card" style="--container-color:${escapeHtml(container.color)}">
      <div class="feature-card-head"><span class="container-dot"></span><strong>${escapeHtml(container.icon)} ${escapeHtml(container.name)}</strong><small>${container.tabCount || members.length} tabs</small></div>
      <p class="muted-note">${container.id === 'default' ? 'Uses this profile’s main browsing session and existing website logins.' : (container.sessionTemporary ? 'Temporary storage · cookies and site data are cleared when the browser closes.' : 'Persistent isolated storage · cookies, local storage and cache are separate from other containers.')}</p>
      <div class="mini-list">${members.slice(0, 8).map((tab) => `<span class="mini-row">${escapeHtml(tab.title || tab.url || 'New tab')}</span>`).join('') || '<span class="muted-note">No open tabs in this container.</span>'}</div>
      <div class="button-line">${actionButton('Open new tab','open-container',container.id,'primary-button')}${!isDefault ? actionButton('Edit','edit-container',container.id) : ''}${!isDefault ? actionButton('Delete','delete-container',container.id,'danger-button') : ''}</div>
    </article>`;
  }).join('');
  const ruleOptions = containers.filter((item) => item.id !== 'default').map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.icon)} ${escapeHtml(item.name)}</option>`).join('');
  const rules = (state.containerRules || []).map((rule) => {
    const target = containers.find((item) => item.id === rule.containerId);
    return `<div class="mini-row-wrap"><span class="mini-row">${escapeHtml(rule.domain)} → ${escapeHtml(target?.name || 'Unknown container')}</span>${actionButton('Remove','remove-container-rule',rule.id,'danger-button')}</div>`;
  }).join('');
  const assignOptions = tabs.map((tab) => `<option value="${escapeHtml(tab.id)}" ${tab.id === state.activeTabId ? 'selected' : ''}>${escapeHtml(tab.title || tab.url || 'New tab')} · ${escapeHtml(tab.containerId || 'default')}</option>`).join('');
  const moveOptions = containers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.icon)} ${escapeHtml(item.name)}</option>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Separate browsing contexts</strong><p>Containers isolate cookies, local storage, cache and website logins while keeping tabs inside the same browser profile and workspace.</p></div></div><div class="container-explainer"><strong>How containers differ from profiles</strong><p>Profiles separate the whole browser identity. Containers separate website sessions inside one profile, so you can stay signed into the same service with different accounts.</p></div></section>
    <section class="section-block"><div class="section-heading"><div><strong>Create a container</strong><p>Choose a name, icon, color and whether its storage should be temporary.</p></div></div><div class="inline-form"><input id="new-container-name" maxlength="32" placeholder="e.g. Work, Shopping, Social"><input id="new-container-icon" maxlength="4" value="◉" aria-label="Container icon"><input id="new-container-color" type="color" value="#75b8a5" aria-label="Container color"></div><label class="check-row"><input id="new-container-temporary" type="checkbox"> Temporary container (session data is not saved after the app exits)</label><div class="button-line">${actionButton('Create container','create-container','','primary-button')}</div></section>
    <section class="section-block"><div class="section-heading"><div><strong>Your containers</strong><p>${containers.length} containers · ${tabs.filter((tab) => tab.containerId && tab.containerId !== 'default').length} tabs using isolated sessions.${state.profile?.guest ? ' Guest profile: all container sessions are temporary.' : ''}</p></div></div><div class="feature-list">${cards || emptyState('No containers','Create a container to separate website logins and storage.')}</div></section>
    <section class="section-block"><div class="section-heading"><div><strong>Move a tab</strong><p>Moving a tab reloads it in the destination container so it uses that container’s cookies and storage.</p></div></div><select id="container-tab-target" class="full-input">${assignOptions}</select><select id="container-move-target" class="full-input">${moveOptions}</select><div class="button-line">${actionButton('Move selected tab','move-tab-container','','primary-button')}</div></section>
    <section class="section-block"><div class="section-heading"><div><strong>Automatic website assignment</strong><p>Automatically open matching domains in a chosen container. The most specific matching domain rule wins.</p></div></div><input id="container-rule-domain" class="full-input" placeholder="example.com or mail.example.com"><select id="container-rule-target" class="full-input">${ruleOptions}</select><label class="check-row"><input id="container-rule-subdomains" type="checkbox" checked> Include subdomains</label><div class="button-line">${actionButton('Add automatic rule','add-container-rule','','primary-button',containers.length <= 1)}</div><div class="feature-list">${rules || emptyState('No automatic rules','Add a domain rule to route a site into a container automatically.')}</div></section>`;
}

function renderGroups() {
  const groups = state.tabGroups || [];
  const currentTabs = state.tabs || [];
  const options = groups.filter((group) => group.workspaceId === state.activeWorkspaceId).map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join('');
  const rows = groups.filter((group) => group.workspaceId === state.activeWorkspaceId).map((group) => {
    const members = currentTabs.filter((tab) => tab.groupId === group.id);
    return `<article class="feature-card"><div class="feature-card-head"><span class="group-chip" style="--group-color:${escapeHtml(group.color)}"></span><strong>${escapeHtml(group.name)}</strong><small>${members.length} tabs</small></div><div class="button-line">${actionButton(group.collapsed ? 'Expand group' : 'Collapse group', 'toggle-tab-group', group.id)}</div>${group.collapsed ? '<p class="muted-note">This group is collapsed in the tab strip.</p>' : `<div class="mini-list">${members.map((tab) => `<button class="mini-row" data-action="open-tab" data-value="${escapeHtml(tab.id)}">${escapeHtml(tab.title)}</button>`).join('') || '<span class="muted-note">No tabs in this group.</span>'}</div>`}<div class="button-line">${actionButton('Remove group', 'delete-tab-group', group.id, 'danger-button')}</div></article>`;
  }).join('');
  const assignTabs = currentTabs.map((tab) => `<option value="${escapeHtml(tab.id)}" ${tab.id === state.activeTabId ? 'selected' : ''}>${escapeHtml(tab.title)}</option>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Tab Islands</strong><p>Group related tabs by project. Groups stay inside the current workspace.</p></div></div><div class="inline-form"><input id="new-group-name" maxlength="32" placeholder="Group name"><input id="new-group-color" type="color" value="#93a9ff" aria-label="Group color"><button class="primary-button" data-action="create-tab-group">Create group</button></div><div class="feature-list">${rows || emptyState('No tab groups yet', 'Create a group, then assign tabs to it.')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Assign a tab</strong><p>Move a tab into a group or remove it from its current group.</p></div></div><select class="full-input" id="group-tab-target">${assignTabs}</select><select class="full-input" id="group-target"><option value="">No group</option>${options}</select><div class="button-line"><button class="primary-button" data-action="assign-tab-group">Apply group</button></div></section>`;
}

function renderNotes() {
  const notes = (state.notes || []).filter((note) => !note.workspaceId || note.workspaceId === state.activeWorkspaceId);
  const cards = notes.map((note) => `<article class="feature-card"><input class="full-input" id="note-title-${escapeHtml(note.id)}" maxlength="100" value="${escapeHtml(note.title || 'Quick note')}"><textarea class="full-textarea" id="note-content-${escapeHtml(note.id)}" rows="4">${escapeHtml(note.content)}</textarea><small class="muted-note">${note.url ? escapeHtml(note.url) + ' · ' : ''}Updated ${escapeHtml(dateLabel(note.updatedAt))}</small><div class="button-line"><button class="small-button" data-action="update-note" data-value="${escapeHtml(note.id)}">Save changes</button>${note.url ? actionButton('Open page', 'open-bookmark', note.url) : ''}${actionButton('Delete', 'delete-note', note.id, 'danger-button')}</div></article>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Quick notes</strong><p>Keep research notes connected to the website and workspace where they belong.</p></div></div><input class="full-input" id="new-note-title" maxlength="100" placeholder="Note title"><textarea class="full-textarea" id="new-note-content" rows="4" placeholder="Write a note…"></textarea><div class="button-line"><button class="primary-button" data-action="create-note">Save note</button>${actionButton('Save selected webpage text', 'capture-selection')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Your notes</strong><p>${notes.length} saved note${notes.length === 1 ? '' : 's'}.</p></div></div><div class="feature-list">${cards || emptyState('No notes yet', 'Write a note or save selected text from a webpage.')}</div></section>`;
}

function renderCollections() {
  const collections = state.collections || [];
  const activeTab = (state.tabs || []).find((tab) => tab.id === state.activeTabId);
  const canSave = Boolean(activeTab && activeTab.url && !activeTab.isPrivate);
  const cards = collections.map((collection) => `<article class="feature-card"><div class="feature-card-head"><strong>${escapeHtml(collection.name)}</strong><small>${collection.items.length} saved pages</small></div><div class="mini-list">${collection.items.map((item) => `<div class="mini-row-wrap"><button class="mini-row" data-action="open-bookmark" data-value="${escapeHtml(item.url)}">${escapeHtml(item.title || item.url)}</button><button class="row-remove" data-action="remove-collection-item" data-value="${escapeHtml(item.id)}" data-collection="${escapeHtml(collection.id)}">×</button></div>`).join('') || '<span class="muted-note">No pages saved yet.</span>'}</div><div class="button-line">${actionButton('Save current page here', 'add-current-to-collection', collection.id, '', !canSave)}${actionButton('Delete collection', 'delete-collection', collection.id, 'danger-button')}</div></article>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Research collections</strong><p>Collect pages around a topic and add your own notes.</p></div></div><div class="inline-form"><input id="new-collection-name" maxlength="60" placeholder="Collection name"><button class="primary-button" data-action="create-collection">Create</button></div></section><section class="section-block"><div class="feature-list">${cards || emptyState('No collections yet', 'Create a collection to save pages for a research project.')}</div></section>`;
}

function renderSessions() {
  const sessions = state.sessions || [];
  const cards = sessions.map((item) => `<article class="feature-card"><div class="feature-card-head"><strong>${escapeHtml(item.name)}</strong><small>${item.tabs.length} tabs · ${escapeHtml(dateLabel(item.savedAt))}</small></div><p class="muted-note">Workspace: ${escapeHtml(item.workspaceName || 'Workspace')}</p><div class="mini-list">${item.tabs.slice(0, 5).map((tab) => `<span class="mini-row">${escapeHtml(tab.title || tab.url || 'New tab')}</span>`).join('')}${item.tabs.length > 5 ? `<span class="muted-note">+ ${item.tabs.length - 5} more</span>` : ''}</div><div class="button-line">${actionButton('Restore session', 'restore-session', item.id, 'primary-button')}${actionButton('Delete', 'delete-session', item.id, 'danger-button')}</div></article>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Save this workspace</strong><p>Save the tabs and pinned state in the active workspace for later.</p></div></div><div class="inline-form"><input id="session-name" maxlength="60" placeholder="Session name"><button class="primary-button" data-action="save-session">Save session</button></div></section><section class="section-block"><div class="section-heading"><div><strong>Saved sessions</strong><p>Restore a session to replace the tabs in its saved workspace.</p></div></div><div class="feature-list">${cards || emptyState('No saved sessions', 'Save your current workspace to return to it later.')}</div></section>`;
}

function renderJourneys() {
  const journeys = state.journeys || [];
  const cards = journeys.map((journey) => `<article class="feature-card"><div class="feature-card-head"><strong>${escapeHtml(journey.date)}</strong><small>${journey.count} visits</small></div><div class="mini-list">${journey.items.slice(0, 12).map((item) => `<button class="mini-row" data-action="open-bookmark" data-value="${escapeHtml(item.url)}"><strong>${escapeHtml(item.title || item.url)}</strong><small>${escapeHtml(item.url)}</small></button>`).join('')}${journey.count > 12 ? `<span class="muted-note">${journey.count - 12} additional visits</span>` : ''}</div></article>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Browsing journeys</strong><p>History grouped by day so you can return to a previous research session.</p></div></div><div class="feature-list">${cards || emptyState('No journeys yet', 'As you browse, activity will be grouped here by day.')}</div></section>`;
}

function renderPerformance() {
  const snapshot = performanceSnapshot || {};
  const system = snapshot.system || {};
  const rows = snapshot.tabs || (state.allTabs || []).map((tab) => ({ ...tab, memoryKB: null, cpuPercent: null, sleeping: false }));
  const events = snapshot.healthEvents || state.healthEvents || [];
  const formatMB = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? `${(Number(value) / 1024).toFixed(1)} MB` : '—';
  const formatCPU = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—';
  const cards = rows.map((tab) => {
    const status = tab.recovering ? 'Recovering' : tab.crashed ? 'Crashed' : tab.unresponsive ? 'Not responding' : tab.sleeping ? 'Sleeping' : tab.active ? 'Active' : 'Awake';
    const statusClass = tab.crashed || tab.unresponsive ? 'health-danger' : tab.recovering ? 'health-warning' : 'health-good';
    const page = tab.url || 'New tab page';
    const memoryLabel = tab.memoryKB ? formatMB(tab.memoryKB) : 'Unavailable';
    const cpuLabel = tab.cpuPercent !== undefined ? formatCPU(tab.cpuPercent) : '—';
    const processLabel = tab.processId ? `PID ${tab.processId}${tab.processShared ? ' · shared renderer' : ''}` : 'Process unavailable';
    const primaryAction = tab.sleeping
      ? actionButton('Wake tab', 'open-tab', tab.id, 'primary-button')
      : (tab.crashed || tab.unresponsive || tab.crashPage)
        ? actionButton('Reload tab', 'reload-tab', tab.id, 'primary-button')
        : actionButton('Put to sleep', 'sleep-tab', tab.id, '', tab.active || tab.pinned || tab.audible || tab.recovering);
    return `<article class="feature-card performance-tab-card"><div class="feature-card-head"><strong>${escapeHtml(tab.title || 'Untitled tab')}</strong><small class="${statusClass}">${escapeHtml(status)}</small></div><p class="muted-note performance-url">${escapeHtml(page)}</p><div class="performance-mini-stats"><span><small>Memory</small><strong>${memoryLabel}</strong></span><span><small>Renderer CPU</small><strong>${cpuLabel}</strong></span><span><small>Process</small><strong>${escapeHtml(processLabel)}</strong></span></div>${tab.crashReason ? `<p class="muted-note">Crash reason: ${escapeHtml(tab.crashReason)}</p>` : ''}<div class="button-line">${primaryAction}</div></article>`;
  }).join('');
  const eventRows = events.slice(0, 30).map((event) => `<div class="health-event-row"><span class="health-event-dot ${event.type?.includes('crash') || event.type?.includes('unclean') ? 'danger' : event.type?.includes('responsive') ? 'success' : ''}"></span><div><strong>${escapeHtml(event.title || event.type)}</strong><small>${escapeHtml(event.detail || '')}</small><small>${escapeHtml(dateLabel(event.at))}${event.url ? ` · ${escapeHtml(event.url)}` : ''}</small></div></div>`).join('');
  const processRows = (snapshot.processes || []).slice(0, 12).map((item) => `<div class="health-process-row"><span><strong>${escapeHtml(item.type)}</strong><small>${escapeHtml(item.name || `PID ${item.pid}`)}</small></span><span>${formatMB(item.memoryKB)}<small>${formatCPU(item.cpuPercent)} CPU</small></span></div>`).join('');
  return `<section class="section-block">
    <div class="section-heading"><div><strong>Browser performance</strong><p>Live process and tab measurements. Chromium can share one renderer process between multiple tabs, so shared-process figures are estimates rather than page-exclusive usage.</p></div></div>
    <div class="button-line"><button class="primary-button" id="refresh-performance" type="button">Refresh measurements</button>${actionButton('Sleep eligible inactive tabs', 'sleep-inactive')}${actionButton('Export diagnostics', 'export-health-report')}</div>
    <div class="performance-summary-grid">
      <article class="performance-summary-card"><small>App memory</small><strong>${formatMB(system.appMemoryKB)}</strong><span>${formatCPU(system.appCpuPercent)} total process CPU</span></article>
      <article class="performance-summary-card"><small>Renderer memory</small><strong>${formatMB(system.rendererMemoryKB)}</strong><span>${formatCPU(system.rendererCpuPercent)} renderer CPU</span></article>
      <article class="performance-summary-card"><small>System memory</small><strong>${Number(system.usedMemoryPercent) || 0}%</strong><span>${formatMB((Number(system.totalMemoryBytes) - Number(system.freeMemoryBytes)) / 1024)} used</span></article>
      <article class="performance-summary-card"><small>Browser processes</small><strong>${Number(system.processCount) || 0}</strong><span>${Number(system.rendererProcessCount) || 0} renderer processes</span></article>
    </div>
    <p class="muted-note">Last sampled: ${snapshot.sampledAt ? escapeHtml(dateLabel(snapshot.sampledAt)) : 'Refresh to collect measurements'} · ${Number(system.totalTabCount) || rows.length} total tabs, ${Number(system.privateTabCount) || 0} private tabs hidden from this report.</p>
  </section>
  <section class="section-block"><div class="section-heading"><div><strong>Tab resource manager</strong><p>Inspect memory, CPU estimates and renderer health for regular-profile tabs.</p></div></div><label class="field-label" for="auto-sleep-choice">Automatic tab sleeping</label><select class="full-input" id="auto-sleep-choice"><option value="0" ${state.settings?.autoSleepMinutes === 0 ? 'selected' : ''}>Off</option><option value="15" ${state.settings?.autoSleepMinutes === 15 ? 'selected' : ''}>After 15 minutes</option><option value="30" ${state.settings?.autoSleepMinutes === 30 ? 'selected' : ''}>After 30 minutes</option><option value="60" ${state.settings?.autoSleepMinutes === 60 ? 'selected' : ''}>After 1 hour</option><option value="120" ${state.settings?.autoSleepMinutes === 120 ? 'selected' : ''}>After 2 hours</option></select><div class="feature-list">${cards || emptyState('No tabs to inspect', 'Open a few pages to see them here.')}</div><p class="muted-note">Sleeping reloads a page when reopened. Unsaved form entries and in-page state may be lost.</p></section>
  <section class="section-block"><div class="section-heading"><div><strong>Reliability controls</strong><p>Choose how the browser monitors tab health and recovers from renderer failures.</p></div></div><label class="toggle-row"><span><strong>Health monitoring</strong><small>Sample process usage periodically and keep a local diagnostic event log.</small></span><input id="health-monitor-toggle" type="checkbox" ${state.settings?.healthMonitoringEnabled !== false ? 'checked' : ''}></label><label class="toggle-row"><span><strong>Automatically recover crashed tabs</strong><small>Attempt one automatic reload after a renderer crash. If it fails again, show a recovery page instead of looping.</small></span><input id="auto-recover-toggle" type="checkbox" ${state.settings?.autoRecoverCrashedTabs !== false ? 'checked' : ''}></label><div class="button-line">${actionButton('Restart normally', 'restart-browser', '', '')}${actionButton('Restart in Safe Mode', 'restart-safe-mode', '', 'danger-button')}</div><p class="muted-note">Safe Mode temporarily skips loading extensions and the ad-blocking engine for this run. Your saved settings are not changed.</p></section>
  <section class="section-block"><div class="section-heading"><div><strong>Browser process breakdown</strong><p>Process memory is reported by Electron. Multiple tabs may share a renderer PID.</p></div></div><div class="health-process-list">${processRows || '<p class="muted-note">Process metrics are not available yet. Refresh measurements.</p>'}</div></section>
  <section class="section-block"><div class="section-heading"><div><strong>Reliability event log</strong><p>Recent renderer crashes, unresponsive pages, recovery events and previous unclean shutdowns. Private tab URLs are never recorded.</p></div></div><div class="button-line">${actionButton('Clear event log', 'clear-health-log', '', 'danger-button')}</div><div class="health-event-list">${eventRows || emptyState('No reliability events', 'The browser has not recorded any renderer or recovery problems.')}</div></section>`;
}
function renderWebPanels() {
  const rows = (state.webPanels || []).map((panel) => {
    const isOpen = state.activeWebPanelId === panel.id;
    return `<article class="feature-card"><div class="feature-card-head"><strong>${escapeHtml(panel.name)}</strong>${isOpen ? '<small>Open in sidebar</small>' : ''}</div><p class="muted-note">${escapeHtml(panel.url)}</p><div class="button-line">${actionButton(isOpen ? 'Close sidebar panel' : 'Open in sidebar', isOpen ? 'close-web-panel' : 'open-web-panel', panel.id, 'primary-button')}${actionButton('Remove', 'delete-web-panel', panel.id, 'danger-button')}</div></article>`;
  }).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Custom web panels</strong><p>Open a saved website in an embedded browser panel beside your current page.</p></div></div><input class="full-input" id="web-panel-name" maxlength="40" placeholder="Panel name"><input class="full-input" id="web-panel-url" placeholder="https://example.com"><div class="button-line"><button class="primary-button" data-action="add-web-panel">Add web panel</button>${state.activeWebPanelId ? actionButton('Close current panel', 'close-web-panel', '', 'danger-button') : ''}</div></section><section class="section-block"><div class="feature-list">${rows || emptyState('No custom panels', 'Add a website you often use alongside your main work.')}</div><p class="muted-note">Panels use a separate Chromium view with no access to the browser's privileged UI APIs. Pop-up links open as normal browser tabs.</p></section>`;
}

function renderNotifications() {
  const items = state.notificationLog || [];
  const rows = items.map((item) => `<article class="feature-card"><div class="feature-card-head"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(dateLabel(item.createdAt))}</small></div><p>${escapeHtml(item.body || '')}</p>${item.url ? actionButton('Open related page', 'open-bookmark', item.url) : ''}</article>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Browser alerts</strong><p>Browser-generated notices such as completed captures and backups. Website push notifications are managed through site permissions and are not mirrored here.</p></div></div><div class="button-line">${actionButton('Mark all read', 'mark-notifications-read')}${actionButton('Clear alerts', 'clear-notifications', '', 'danger-button')}</div><div class="feature-list">${rows || emptyState('No browser alerts', 'Important browser actions will appear here.')}</div></section>`;
}

function renderTools() {
  return `<section class="section-block"><div class="section-heading"><div><strong>Research and page tools</strong><p>Quickly capture, read, translate, or export the current page.</p></div></div><div class="tool-grid">${actionButton('Open reader view', 'reader-view', '', 'primary-button')}${actionButton('Capture webpage', 'capture-page')}${actionButton('Export page as PDF', 'export-pdf')}${actionButton('Open floating mini window', 'mini-window')}${actionButton('Translate to English', 'translate-page')}${actionButton('Open local PDF', 'open-local-pdf')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Browser backup</strong><p>Export bookmarks, workspaces, notes, collections, sessions and preferences. AI credentials are never included.</p></div></div><div class="button-line">${actionButton('Export backup', 'export-backup', '', 'primary-button')}${actionButton('Import backup', 'import-backup')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Custom command sequences</strong><p>Create a reusable command from a short sequence of browser actions. Run it from Ctrl+K.</p></div></div><input class="full-input" id="custom-command-name" maxlength="48" placeholder="Command name"><select class="full-input" id="custom-command-actions" multiple size="10"><option value="new-tab">Open a new tab</option><option value="reader">Open reader view</option><option value="capture">Capture current page</option><option value="pdf">Export current page as PDF</option><option value="downloads">Open downloads</option><option value="notes">Open notes</option><option value="bookmark">Toggle bookmark</option><option value="split">Open split controls</option><option value="groups">Open tab groups</option><option value="sessions">Open saved sessions</option><option value="history">Open history</option><option value="bookmarks">Open bookmarks</option><option value="new-private-tab">Open private tab</option><option value="mini-window">Open mini window</option><option value="translate">Translate current page</option><option value="sleep-inactive">Sleep inactive tabs</option><option value="performance">Open performance manager</option></select><div class="button-line"><button class="primary-button" data-action="create-custom-command">Save command sequence</button></div>${(state.customCommands || []).map((item) => `<div class="mini-row-wrap"><span class="mini-row">${escapeHtml(item.name)} · ${item.actions.map(escapeHtml).join(' → ')}</span>${actionButton('Delete', 'delete-custom-command', item.id, 'danger-button')}</div>`).join('')}</section><section class="section-block"><div class="section-heading"><div><strong>Default search engine</strong><p>Choose which search provider handles address-bar searches.</p></div></div><select class="full-input" id="search-engine-default"><option value="google" ${state.settings?.searchEngine==='google'?'selected':''}>Google</option><option value="duckduckgo" ${state.settings?.searchEngine==='duckduckgo'?'selected':''}>DuckDuckGo</option><option value="bing" ${state.settings?.searchEngine==='bing'?'selected':''}>Bing</option>${(state.settings?.customSearchEngines||[]).map((engine)=>`<option value="${escapeHtml(engine.id)}" ${state.settings?.searchEngine===engine.id?'selected':''}>${escapeHtml(engine.name)}</option>`).join('')}</select></section><section class="section-block"><div class="section-heading"><div><strong>Custom search engines</strong><p>Use an HTTPS query template with the literal {searchTerms} placeholder.</p></div></div><input id="engine-name" class="full-input" placeholder="Engine name"><input id="engine-id" class="full-input" placeholder="Short ID, e.g. wikipedia"><input id="engine-template" class="full-input" placeholder="https://…?q={searchTerms}"><div class="button-line">${actionButton('Add search engine','add-search-engine')}</div>${(state.settings?.customSearchEngines||[]).map((engine)=>`<div class="mini-row-wrap"><span class="mini-row">${escapeHtml(engine.name)} · ${escapeHtml(engine.template)}</span>${actionButton('Remove','remove-search-engine',engine.id,'danger-button')}</div>`).join('')}</section><section class="section-block"><div class="section-heading"><div><strong>Site shortcuts</strong><p>Type a saved keyword into the address bar to open its website.</p></div></div><input id="shortcut-name" class="full-input" placeholder="Shortcut name"><input id="shortcut-keyword" class="full-input" placeholder="Keyword"><input id="shortcut-url" class="full-input" placeholder="https://example.com"><div class="button-line">${actionButton('Add site shortcut','add-site-shortcut')}</div>${(state.siteShortcuts||[]).map((item)=>`<div class="mini-row-wrap"><span class="mini-row">${escapeHtml(item.keyword)} → ${escapeHtml(item.name)}</span>${actionButton('Remove','remove-site-shortcut',item.id,'danger-button')}</div>`).join('')}</section>`;
}


function renderProfiles() {
  const rows = (state.profiles || []).map((profile) => `<article class="profile-card"><span class="profile-avatar" style="border:2px solid ${escapeHtml(profile.color || '#93a9ff')}">${escapeHtml(profile.icon || '👤')}</span><div class="row-main"><strong>${escapeHtml(profile.name)}</strong><small>${profile.guest ? 'Temporary guest profile' : 'Independent cookies, storage, bookmarks, history and settings'}</small></div>${profile.active ? '<span class="row-tag">Current</span>' : actionButton('Switch','switch-profile',profile.id)}${!profile.active && !profile.guest ? actionButton('Delete','delete-profile',profile.id,'danger-button') : ''}</article>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Browser profiles</strong><p>Separate browsing data, cookies, website logins, bookmarks, history, extensions and settings.</p></div></div><div class="feature-list">${rows}</div><div class="section-heading"><div><strong>Edit current profile</strong><p>Change the active profile's display name and appearance.</p></div></div><div class="inline-form"><input id="current-profile-name" maxlength="36" value="${escapeHtml(state.profile?.name || 'Profile')}" placeholder="Profile name"><input id="current-profile-icon" maxlength="4" value="${escapeHtml(state.profile?.icon || '👤')}" aria-label="Profile icon"><input id="current-profile-color" type="color" value="${escapeHtml(state.profile?.color || '#93a9ff')}" aria-label="Profile color"><button class="primary-button" data-action="update-current-profile">Save profile</button></div><div class="section-heading"><div><strong>Create profile</strong><p>Each profile has independent browser data and settings.</p></div></div><div class="inline-form"><input id="profile-name" maxlength="36" placeholder="New profile name"><input id="profile-icon" maxlength="4" value="👤" aria-label="Profile icon"><input id="profile-color" type="color" value="#93a9ff" aria-label="Profile color"><button class="primary-button" data-action="create-profile">Create</button></div><div class="button-line">${actionButton('Start guest session','guest-profile','','primary-button')}</div><p class="muted-note">Guest browsing uses a non-persistent Chromium session and temporary profile files. Switching profiles closes the current profile's open tabs after saving them.</p></section>`;
}
function renderMigration() {
  const deleted = (state.deletedBookmarks || []).map((item) => `<div class="mini-row-wrap"><span class="mini-row">${escapeHtml(item.title || item.url)}<small>${escapeHtml(item.url)}</small></span>${actionButton('Restore','restore-deleted-bookmark',item.id)}</div>`).join('');
  const diag = state.importDiagnostics;
  return `<section class="section-block"><div class="section-heading"><div><strong>Import from another browser</strong><p>Import Netscape HTML bookmarks, Chromium bookmark JSON, or browser history SQLite databases when the runtime supports node:sqlite.</p></div></div><div class="button-line">${actionButton('Choose import file','import-browser-data','','primary-button')}${actionButton('Export bookmarks (HTML)','export-bookmarks')}${actionButton('Export history (JSON)','export-history')}</div>${diag ? `<div class="status-card"><span class="status-dot"></span><div><strong>${escapeHtml(diag.file || 'Last import')}</strong><small>${diag.error ? escapeHtml(diag.error) : `${diag.importedBookmarks || 0} bookmarks · ${diag.importedHistory || 0} history entries · ${diag.skipped || 0} duplicates skipped`}</small></div></div>` : ''}</section><section class="section-block"><div class="section-heading"><div><strong>Backup and recovery</strong><p>Profile-local JSON backups. AI credentials and live cookies are not exported.</p></div></div><label class="toggle-row"><span><strong>Automatic backups</strong><small>Keep the latest 14 automatic snapshots inside this profile.</small></span><input id="auto-backup-toggle" type="checkbox" ${state.settings?.autoBackupEnabled !== false ? 'checked' : ''}></label><label class="field-label" for="auto-backup-days">Backup interval</label><select class="full-input" id="auto-backup-days"><option value="1" ${state.settings?.autoBackupDays===1?'selected':''}>Daily</option><option value="7" ${state.settings?.autoBackupDays===7?'selected':''}>Weekly</option><option value="14" ${state.settings?.autoBackupDays===14?'selected':''}>Every 14 days</option><option value="30" ${state.settings?.autoBackupDays===30?'selected':''}>Monthly</option></select><div class="button-line">${actionButton('Create backup now','backup-now','','primary-button')}${actionButton('Export portable backup','export-backup')}${actionButton('Restore portable backup','import-backup')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Recently deleted bookmarks</strong><p>Restore bookmarks removed from this profile.</p></div></div><div class="mini-list">${deleted || emptyState('Nothing to recover','Removed bookmarks will appear here temporarily.')}</div></section>`;
}
function renderSiteControls() {
  const origin = state.activeOrigin || '';
  const site = state.siteSettings || {};
  const perms = [['geolocation','Location'],['notifications','Notifications'],['media','Camera and microphone'],['clipboard-read','Clipboard read']];
  const permissionRows = perms.map(([id,label]) => `<div class="permission-row"><div><strong>${label}</strong><small>${state.permissions?.[id] === 'allow' ? 'Allowed' : state.permissions?.[id] === 'deny' ? 'Blocked' : 'Ask is not granted; default is blocked'}</small></div><select data-permission="${id}" aria-label="${label}"><option value="deny" ${state.permissions?.[id]==='allow'?'':'selected'}>Block</option><option value="allow" ${state.permissions?.[id]==='allow'?'selected':''}>Allow</option></select></div>`).join('');
  const cookies = siteCookieCache.map((cookie) => `<div class="cookie-card"><div><strong>${escapeHtml(cookie.name)}</strong><small>${escapeHtml(cookie.domain)} · ${cookie.secure?'Secure · ':''}${cookie.httpOnly?'HttpOnly':''}</small></div>${actionButton('Remove','clear-cookie',cookie.name,'danger-button')}</div>`).join('');
  let secureLabel = 'No active website'; try { secureLabel = new URL(origin).protocol === 'https:' ? 'HTTPS connection' : 'HTTP connection — not encrypted'; } catch {}
  return `<section class="section-block"><div class="section-heading"><div><strong>Site security</strong><p>${escapeHtml(origin || 'Open a website to manage its settings.')}</p></div></div><div class="status-card"><span class="status-dot" style="background:${origin.startsWith('https:')?'#65c99a':'#e8bd73'}"></span><div><strong>${escapeHtml(secureLabel)}</strong><small>Connection indicator only; certificate validation is still enforced by Chromium.</small></div></div></section><section class="section-block"><div class="section-heading"><div><strong>Website permissions</strong><p>Permissions are blocked by default unless you explicitly allow them.</p></div></div>${origin ? permissionRows : emptyState('No website selected','Open an HTTPS page to manage permissions.') }<label class="field-label" for="permission-expiry">Permission expiry for the next change</label><select class="full-input" id="permission-expiry"><option value="0">Keep until changed</option><option value="1">1 hour</option><option value="24">1 day</option><option value="168">7 days</option><option value="720">30 days</option></select></section><section class="section-block"><div class="section-heading"><div><strong>Per-site behavior</strong><p>These preferences apply to the active website.</p></div></div><label class="toggle-row"><span><strong>JavaScript</strong><small>Disabling JavaScript can break complex websites.</small></span><input id="site-javascript-toggle" type="checkbox" ${site.javascriptDisabled?'':'checked'} ${origin?'':'disabled'}></label><label class="field-label" for="site-popup-policy">Pop-ups and new windows</label><select id="site-popup-policy" class="full-input" ${origin?'':'disabled'}><option value="allow" ${site.popupPolicy==='block'?'':'selected'}>Allow (open as tabs)</option><option value="block" ${site.popupPolicy==='block'?'selected':''}>Block</option></select><label class="range-setting"><span>Site zoom <strong id="site-zoom-value">${Math.round((site.zoomFactor||1)*100)}%</strong></span><input id="site-zoom" type="range" min="50" max="200" step="5" value="${Math.round((site.zoomFactor||1)*100)}" ${origin?'':'disabled'}></label>${origin?actionButton('Clear cookies and storage','clear-site-data','','danger-button'):''}</section><section class="section-block"><div class="section-heading"><div><strong>Cookies for this website</strong><p>Cookie values are never displayed in this panel. Remove cookies individually.</p></div></div><div class="button-line">${actionButton('Refresh cookies','refresh-site-cookies')}</div>${cookies || '<p class="muted-note">No cookies found, or no website is currently selected.</p>'}</section>`;
}
function renderAdblock() {
  const stats = state.adblock?.stats || {};
  const whitelist = state.adblock?.whitelist || [];
  const origin = state.activeOrigin || '';
  const topSites = Object.entries(stats.bySite || {}).sort((a,b) => b[1]-a[1]).slice(0,8).map(([site,count]) => `<div class="mini-row-wrap"><span class="mini-row">${escapeHtml(site)} · ${Number(count).toLocaleString()} blocked</span></div>`).join('');
  const hosts = (state.settings?.adblockCustomHosts || []).map((host) => `<div class="mini-row-wrap"><span class="mini-row">${escapeHtml(host)}</span>${actionButton('Remove','adblock-remove-host',host,'danger-button')}</div>`).join('');
  const customLists = (state.settings?.adblockCustomLists || []).map((url) => `<div class="mini-row-wrap"><span class="mini-row">${escapeHtml(url)}</span>${actionButton('Remove','adblock-remove-list',url,'danger-button')}</div>`).join('');
  const updated = state.adblockStatus?.updatedAt ? new Date(state.adblockStatus.updatedAt).toLocaleString() : 'Not yet updated';
  return `<section class="section-block"><div class="section-heading"><div><strong>Built-in ad and tracker blocking</strong><p>${escapeHtml(state.adblockStatus?.message || 'Filter engine status is being checked.')}</p></div></div><label class="toggle-row"><span><strong>Enable protection</strong><small>Network-level filtering applies to browser sessions.</small></span><input id="adblock-main-toggle" type="checkbox" ${state.settings?.adBlockingEnabled!==false?'checked':''}></label><div class="stat-grid"><div class="stat-card"><strong>${Number(stats.blocked||0).toLocaleString()}</strong><small>Total blocked</small></div><div class="stat-card"><strong>${Number(stats.ads||0).toLocaleString()}</strong><small>Ads / custom hosts</small></div><div class="stat-card"><strong>${Number(stats.trackers||0).toLocaleString()}</strong><small>Trackers</small></div><div class="stat-card"><strong>${Number(Object.keys(stats.bySite||{}).length).toLocaleString()}</strong><small>Sites affected</small></div></div><p class="muted-note">Last filter refresh: ${escapeHtml(updated)}. Private-session counters are temporary and are cleared when the private session ends.</p></section><section class="section-block"><div class="section-heading"><div><strong>Filter lists</strong><p>Choose which public filter sets to load.</p></div></div><label class="toggle-row"><span><strong>EasyList — advertisements</strong><small>Common ad network and page ad rules.</small></span><input id="filter-ads" type="checkbox" ${state.settings?.adblockAds!==false?'checked':''}></label><label class="toggle-row"><span><strong>EasyPrivacy — tracking</strong><small>Known tracking request rules.</small></span><input id="filter-trackers" type="checkbox" ${state.settings?.adblockTrackers!==false?'checked':''}></label><label class="toggle-row"><span><strong>Fanboy Annoyances</strong><small>Optional cosmetic and annoyance rules. May hide some page elements.</small></span><input id="filter-annoyances" type="checkbox" ${state.settings?.adblockAnnoyances?'checked':''}></label><label class="toggle-row"><span><strong>Automatic filter updates</strong><small>Refresh filter lists approximately once every 24 hours when enabled.</small></span><input id="adblock-auto-update" type="checkbox" ${state.settings?.adblockAutoUpdate!==false?'checked':''}></label><div class="button-line">${actionButton('Update filter lists now','adblock-update','','primary-button')}</div><p class="muted-note">Filter-list updates require internet access. The last cached engine remains available if an update cannot be downloaded.</p></section><section class="section-block"><div class="section-heading"><div><strong>Custom filter-list URLs</strong><p>Add a compatible HTTPS filter list. Only add lists from sources you trust.</p></div></div><div class="inline-form"><input id="adblock-list-url" placeholder="https://example.com/filters.txt"><button class="primary-button" data-action="adblock-add-list">Add list</button></div><div class="mini-list">${customLists || '<span class="muted-note">No custom filter lists.</span>'}</div></section><section class="section-block"><div class="section-heading"><div><strong>This website</strong><p>${escapeHtml(origin || 'Open a website to change its protection.')}</p></div></div>${actionButton(whitelist.includes(origin)?'Re-enable protection here':'Pause protection on this website','adblock-whitelist-toggle','',whitelist.includes(origin)?'danger-button':'primary-button',!origin)}<div class="mini-list">${whitelist.map((site) => `<div class="mini-row-wrap"><span class="mini-row">${escapeHtml(site)}</span>${actionButton('Remove exception','adblock-whitelist-remove',site)}</div>`).join('') || '<span class="muted-note">No website exceptions.</span>'}</div></section><section class="section-block"><div class="section-heading"><div><strong>Custom domain rules</strong><p>Block all requests to a specific hostname or its subdomains.</p></div></div><div class="inline-form"><input id="adblock-host" placeholder="ads.example.com"><button class="primary-button" data-action="adblock-add-host">Add domain</button></div><div class="mini-list">${hosts || '<span class="muted-note">No custom domains.</span>'}</div></section><section class="section-block"><div class="section-heading"><div><strong>Most affected websites</strong><p>Counts are cumulative for this profile.</p></div></div>${topSites || '<p class="muted-note">No blocked requests recorded yet.</p>'}<div class="button-line">${actionButton('Reset statistics','adblock-clear-stats','','danger-button')}</div></section>`;
}
function renderApps() {
  const apps = (state.installedApps || []).map((app) => `<article class="app-card"><span class="profile-avatar">🌐</span><div class="row-main"><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.url)}</small></div>${actionButton('Open','open-web-app',app.id,'primary-button')}${actionButton('Remove','remove-web-app',app.id,'danger-button')}</article>`).join('');
  const sessionOptions = (state.sessions || []).map((item) => `<option value="${escapeHtml(item.id)}" ${state.settings?.startupSessionId===item.id?'selected':''}>${escapeHtml(item.name)}</option>`).join('');
  const startupValue = state.settings?.startupBehavior === 'session' ? 'session' : (state.settings?.startupBehavior || 'restore');
  return `<section class="section-block"><div class="section-heading"><div><strong>Install a website as an app</strong><p>Creates a standalone Chromium window with its own title. It still uses this profile's cookies and data.</p></div></div><input class="full-input" id="webapp-name" placeholder="Application name"><input class="full-input" id="webapp-url" placeholder="https://example.com"><div class="inline-form"><input class="full-input" id="webapp-icon-path" placeholder="Optional app icon image path" readonly>${actionButton('Choose icon','choose-webapp-icon')}</div><div class="button-line">${actionButton('Install website','install-web-app','','primary-button')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Installed websites</strong><p>${(state.installedApps||[]).length} installed</p></div></div><div class="feature-list">${apps || emptyState('No installed websites','Install websites you use frequently as standalone windows.')}</div><label class="toggle-row"><span><strong>Open installed web apps at startup</strong><small>Login launch behavior is configured only in packaged Windows builds.</small></span><input id="apps-startup-toggle" type="checkbox" ${state.settings?.launchInstalledAppsAtStartup?'checked':''}></label></section><section class="section-block"><div class="section-heading"><div><strong>Startup behavior</strong><p>Choose what this profile opens when the browser starts.</p></div></div><select class="full-input" id="startup-behavior"><option value="restore" ${startupValue==='restore'?'selected':''}>Restore previous tabs</option><option value="newtab" ${startupValue==='newtab'?'selected':''}>Open a new tab</option><option value="session" ${startupValue==='session'?'selected':''}>Restore a saved session</option></select><select class="full-input" id="startup-session" ${startupValue==='session'?'':'disabled'}>${sessionOptions || '<option value="">No saved sessions available</option>'}</select><p class="muted-note">Saved sessions are profile-specific. If the selected session was removed, the browser falls back to restoring previous tabs.</p></section>`;
}
function renderAccessibility() {
  return `<section class="section-block"><div class="section-heading"><div><strong>Accessibility preferences</strong><p>Browser UI and webpage display preferences.</p></div></div><label class="toggle-row"><span><strong>High contrast pages</strong><small>Apply a stronger contrast treatment to webpage content.</small></span><input id="a11y-contrast" type="checkbox" ${state.settings?.highContrastMode?'checked':''}></label><label class="toggle-row"><span><strong>Reduce motion</strong><small>Reduce page and browser animation where CSS can control it.</small></span><input id="a11y-motion" type="checkbox" ${state.settings?.reducedMotion?'checked':''}></label><label class="toggle-row"><span><strong>Spellchecking</strong><small>Use Chromium spellchecking for editable text fields.</small></span><input id="spellcheck-toggle" type="checkbox" ${state.settings?.spellcheckEnabled!==false?'checked':''}></label><label class="range-setting"><span>Default page text scale <strong id="page-scale-value">${state.settings?.pageTextScale||100}%</strong></span><input id="page-scale" type="range" min="80" max="150" step="5" value="${state.settings?.pageTextScale||100}"></label><label class="field-label" for="translation-target">Preferred translation language</label><input class="full-input" id="translation-target" value="${escapeHtml(state.settings?.translationTarget||'en')}" placeholder="en"><label class="field-label" for="translation-page-template">Full-page translation URL template</label><input class="full-input" id="translation-page-template" value="${escapeHtml(state.settings?.translationPageTemplate||'https://translate.google.com/translate?sl=auto&tl={target}&u={url}')}"><label class="field-label" for="translation-text-template">Selected-text translation URL template</label><input class="full-input" id="translation-text-template" value="${escapeHtml(state.settings?.translationTextTemplate||'https://translate.google.com/?sl=auto&tl={target}&text={text}&op=translate')}"><p class="muted-note">Use an HTTPS template with {target} and {url} for full pages, or {target} and {text} for selected text. The defaults use Google Translate; you can substitute a trusted provider's URL format. This opens the translation provider in a new tab rather than silently sending page contents to a browser-owned API.</p><div class="button-line">${actionButton('Save accessibility settings','save-accessibility','','primary-button')}${actionButton('Translate current webpage','translate-page')}${actionButton('Translate selected text','translate-selection')}</div></section>`;
}
function renderDeveloper() {
  const logs = (state.networkLog || []).slice().reverse().slice(0,80).map((item) => `<div class="log-row"><strong>${escapeHtml(item.method)} · ${escapeHtml(item.resourceType)} · ${escapeHtml(item.status)}</strong><small>${escapeHtml(item.url)}</small></div>`).join('');
  const presets = developerToolsPlaceholder();
  return `<section class="section-block"><div class="section-heading"><div><strong>Developer toolkit</strong><p>Inspect the active page, review request events, and test responsive layouts.</p></div></div><div class="tool-grid">${actionButton('Open DevTools (F12)','open-developer-tools','','primary-button')}${actionButton('Save page source','view-source')}${actionButton('Inspect page structure','inspect-page-structure')}${actionButton('Inspect selected text style','inspect-selection-style')}</div><div class="folder-setting"><div><strong>Responsive viewport</strong><small>${state.responsiveViewport ? escapeHtml(state.responsiveViewport.label + ' · ' + state.responsiveViewport.width + ' × ' + state.responsiveViewport.height) : 'Use a fixed test viewport for the active tab.'}</small></div><select id="responsive-preset" aria-label="Responsive viewport"><option value="">Choose device preset</option><option value="mobile-small">Small mobile</option><option value="mobile">Mobile</option><option value="mobile-large">Large mobile</option><option value="tablet">Tablet portrait</option><option value="laptop">Laptop</option><option value="desktop">Desktop</option></select>${actionButton('Apply','apply-responsive-viewport')}${actionButton('Exit','clear-responsive-viewport')}</div><p class="muted-note">Responsive mode resizes the active page viewport; it does not emulate mobile hardware, touch sensors, or device-specific user agents.</p></section><section class="section-block"><div class="section-heading"><div><strong>JSON viewer</strong><p>Format and inspect JSON from the active JSON page or pasted text.</p></div></div><textarea id="dev-json-input" class="full-textarea" rows="5" placeholder="Paste JSON here, or leave blank to inspect the active page…"></textarea><div class="button-line">${actionButton('Format JSON','inspect-json','','primary-button')}</div><pre id="dev-output" class="code-output" hidden></pre></section><section class="section-block"><div class="section-heading"><div><strong>Recent network activity</strong><p>Last ${logs ? Math.min(80,(state.networkLog||[]).length) : 0} recorded requests. This is a diagnostic request log, not a full HAR capture.</p></div></div><input class="full-input" id="network-search" type="search" placeholder="Filter requests by URL, method or status"><div id="network-log-rows">${logs || emptyState('No network events','Visit a website to populate the request log.')}</div></section>`;
}
function developerToolsPlaceholder() { return ''; }


  const logs = (state.networkLog || []).slice().reverse().slice(0,80).map((item) => `<div class="log-row"><strong>${escapeHtml(item.method)} · ${escapeHtml(item.resourceType)} · ${escapeHtml(item.status)}</strong><small>${escapeHtml(item.url)}</small></div>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Developer toolkit</strong><p>Open Chromium DevTools, inspect the current page, and review recent network request events.</p></div></div><div class="tool-grid">${actionButton('Open DevTools (F12)','open-developer-tools','','primary-button')}${actionButton('Save page source','view-source')}${actionButton('Refresh network log','refresh-network-log')}</div><p class="muted-note">Chromium DevTools includes Elements, Console, Network and Performance tools. Split-view tabs have their own DevTools when their pane is active.</p></section><section class="section-block"><div class="section-heading"><div><strong>Recent network activity</strong><p>Last ${logs ? Math.min(80,(state.networkLog||[]).length) : 0} recorded requests. This diagnostic view is not a full HAR capture.</p></div></div>${logs || emptyState('No network events','Visit a website to populate the request log.')}</section>`;
}
function renderUpdates() {
  const status = state.updateCheck;
  return `<section class="section-block"><div class="section-heading"><div><strong>Browser update channel</strong><p>Configure a JSON manifest URL hosted by your release server.</p></div></div><label class="field-label" for="update-manifest-url">HTTPS manifest URL</label><input class="full-input" id="update-manifest-url" value="${escapeHtml(state.settings?.updateManifestUrl||'')}" placeholder="https://example.com/browser-update.json"><div class="button-line">${actionButton('Save update URL','save-update-url','','primary-button')}${actionButton('Check for updates','check-updates')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Update status</strong><p>Current app version: ${escapeHtml(status?.currentVersion || 'unknown')}</p></div></div>${status ? `<div class="status-card"><span class="status-dot"></span><div><strong>${status.error?'Check failed':status.updateAvailable?`Version ${escapeHtml(status.latestVersion)} is available`:`Latest checked: ${escapeHtml(status.latestVersion || status.currentVersion || 'unknown')}`}</strong><small>${escapeHtml(status.error || status.notes || dateLabel(status.at))}</small></div></div>${status.updateAvailable ? actionButton('Open download page','open-update-download','','primary-button') : ''}` : emptyState('No update check yet','Check the release manifest to see whether a newer build is available.')}</section><p class="muted-note">The update checker only verifies a JSON manifest and opens its HTTPS download URL. Automatic application replacement needs a packaged build, signed release artifacts and a configured update feed.</p>`;
}


function renderPasswords() {
  const vault = state.passwordVault || { exists: false, unlocked: false, count: 0 };
  if (!vault.exists) {
    return `<section class="section-block"><div class="section-heading"><div><strong>Create your local password vault</strong><p>Each browser profile has a separate encrypted vault stored only on this computer.</p></div></div><div class="vault-warning">Choose a strong master password and keep it somewhere safe. The browser does not have a recovery service. If you forget the master password, the encrypted vault cannot be recovered.</div><label class="field-label" for="vault-master-password">Master password (12+ characters)</label><input class="full-input" id="vault-master-password" type="password" autocomplete="new-password"><label class="field-label" for="vault-master-confirm">Confirm master password</label><input class="full-input" id="vault-master-confirm" type="password" autocomplete="new-password"><div class="button-line">${actionButton('Create encrypted vault','vault-setup','','primary-button')}</div></section>`;
  }
  if (!vault.unlocked) {
    return `<section class="section-block"><div class="section-heading"><div><strong>Password vault is locked</strong><p>${vault.count} encrypted entries · Profile: ${escapeHtml(state.profile?.name || 'Current profile')}</p></div></div>${vault.damaged ? '<div class="vault-warning">The vault file exists but could not be read. Import a valid encrypted vault backup or restore a profile backup.</div>' : ''}<label class="field-label" for="vault-master-password">Master password</label><input class="full-input" id="vault-master-password" type="password" autocomplete="current-password"><div class="button-line">${actionButton('Unlock vault','vault-unlock','','primary-button')}${actionButton('Import encrypted vault','vault-import')}</div><p class="muted-note">The master password is never written to browser settings. Vault content remains encrypted while locked.</p></section>`;
  }
  const entries = state.passwordVaultEntries || [];
  const cards = entries.map((entry) => {
    const subtitle = entry.type === 'credential' ? `${entry.hostname} · ${entry.username || 'No username'}` : entry.type === 'identity' ? 'Saved identity' : 'Secure note';
    const fill = entry.type === 'credential' ? actionButton('Fill on matching site','vault-fill-entry',entry.id,'primary-button') : '';
    return `<article class="vault-entry"><div class="vault-entry-head"><strong>${escapeHtml(entry.title || entry.hostname || 'Vault entry')}</strong><small class="muted-note">${escapeHtml(entry.type)}</small></div><div class="vault-entry-meta">${escapeHtml(subtitle)}</div><div class="button-line">${actionButton('Reveal','vault-reveal-entry',entry.id)}${fill}${actionButton('Delete','vault-delete-entry',entry.id,'danger-button')}</div><pre class="vault-secret" id="vault-secret-${escapeHtml(entry.id)}" hidden></pre></article>`;
  }).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Encrypted password vault</strong><p>${entries.length} entries · This profile only</p></div></div><label class="field-label" for="password-vault-autolock">Automatic lock</label><select id="password-vault-autolock" class="full-input"><option value="0" ${Number(state.settings?.passwordVaultAutoLockMinutes)===0?'selected':''}>Never (not recommended)</option><option value="1" ${Number(state.settings?.passwordVaultAutoLockMinutes)===1?'selected':''}>1 minute</option><option value="5" ${Number(state.settings?.passwordVaultAutoLockMinutes)===5?'selected':''}>5 minutes</option><option value="10" ${Number(state.settings?.passwordVaultAutoLockMinutes??10)===10?'selected':''}>10 minutes</option><option value="15" ${Number(state.settings?.passwordVaultAutoLockMinutes)===15?'selected':''}>15 minutes</option><option value="30" ${Number(state.settings?.passwordVaultAutoLockMinutes)===30?'selected':''}>30 minutes</option></select><div class="button-line">${actionButton('Lock vault now','vault-lock','','danger-button')}${actionButton('Export encrypted backup','vault-export')}${actionButton('Import encrypted backup','vault-import')}</div><div class="vault-warning">Autofill is manual and asks for confirmation. The browser only fills credentials when the current hostname exactly matches the saved hostname, and it never submits the form.</div></section>
  <section class="section-block"><div class="section-heading"><div><strong>Save a website login</strong><p>Enter the exact website origin, username and password. Use HTTPS sites.</p></div></div><label class="field-label" for="vault-site">Website URL</label><input class="full-input" id="vault-site" type="url" placeholder="https://example.com/"><label class="field-label" for="vault-entry-title">Entry name</label><input class="full-input" id="vault-entry-title" maxlength="120" placeholder="Example account"><label class="field-label" for="vault-username">Username or email</label><input class="full-input" id="vault-username" autocomplete="off"><label class="field-label" for="vault-password">Password</label><input class="full-input" id="vault-password" type="password" autocomplete="new-password"><div class="button-line">${actionButton('Generate strong password','vault-generate-password')}${actionButton('Save login','vault-save-credential','','primary-button')}</div><label class="field-label" for="vault-login-notes">Notes (optional)</label><textarea class="full-textarea" id="vault-login-notes" rows="2"></textarea></section>
  <section class="section-block"><div class="section-heading"><div><strong>Secure note</strong><p>Store private notes inside the encrypted vault.</p></div></div><input class="full-input" id="vault-note-title" maxlength="120" placeholder="Note title"><textarea class="full-textarea" id="vault-note-content" rows="4" placeholder="Private note content"></textarea><div class="button-line">${actionButton('Save secure note','vault-save-note','','primary-button')}</div></section>
  <section class="section-block"><div class="section-heading"><div><strong>Saved identity</strong><p>Store contact information in encrypted form. This does not automatically fill payment or identity fields.</p></div></div><input class="full-input" id="vault-identity-title" placeholder="Identity name (e.g. Personal)"><input class="full-input" id="vault-identity-name" placeholder="Full name"><input class="full-input" id="vault-identity-email" type="email" placeholder="Email"><input class="full-input" id="vault-identity-phone" placeholder="Phone"><textarea class="full-textarea" id="vault-identity-address" rows="2" placeholder="Address"></textarea><div class="button-line">${actionButton('Save identity','vault-save-identity')}</div></section>
  <section class="section-block"><div class="section-heading"><div><strong>Vault entries</strong><p>Reveal only when needed. Use the fill action only on the matching website.</p></div></div><div class="feature-list">${cards || emptyState('Your vault is empty','Save a login, secure note, or identity above.')}</div></section>
  <section class="section-block"><div class="section-heading"><div><strong>Change master password</strong><p>Changing the password re-encrypts the existing vault with a new key.</p></div></div><input class="full-input" id="vault-new-master" type="password" autocomplete="new-password" placeholder="New master password (12+ characters)"><input class="full-input" id="vault-new-master-confirm" type="password" autocomplete="new-password" placeholder="Confirm new master password"><div class="button-line">${actionButton('Change master password','vault-change-password')}</div></section>`;
}

function renderServices() {
  const services = state.services || [];
  const tiles = services.map((service) => `<button class="service-tile" data-action="open-service" data-value="${escapeHtml(service.id)}" type="button"><strong>${escapeHtml(service.name)}</strong><small>${escapeHtml(service.category)} · Opens in a browser tab</small></button>`).join('');
  const customApps = (state.installedApps || []).map((app) => `<article class="feature-card"><div class="feature-card-head"><strong>${escapeHtml(app.name)}</strong><small>Installed web app</small></div><p class="muted-note">${escapeHtml(app.url)}</p>${actionButton('Open app','open-web-app',app.id,'primary-button')}</article>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Connected services</strong><p>Quick access to websites you use for work, planning, files, design and development.</p></div></div><div class="service-grid">${tiles}</div></section><section class="section-block"><div class="section-heading"><div><strong>Your installed web apps</strong><p>These open as standalone windows using your current browser profile.</p></div></div><div class="feature-list">${customApps || emptyState('No installed web apps','Install a website from the Web Apps panel to keep it here.')}</div></section><div class="notice-card"><strong>Website shortcuts, not account connections</strong><p>These tiles open the providers' websites. The browser does not store service passwords here or create OAuth connections. Use the provider's own sign-in page and review its privacy settings.</p></div>`;
}

function renderAutomations() {
  const steps = [
    ['new-tab','Open a new tab'], ['new-private-tab','Open a private tab'], ['open-url','Open a URL'],
    ['sleep-inactive','Sleep inactive tabs'], ['save-session','Save current session'], ['capture-page','Capture current page'],
    ['reader-view','Open reader view'], ['export-pdf','Export page as PDF'], ['translate-page','Translate current page'],
    ['bookmark-active','Bookmark current page'], ['open-services','Open Services panel'], ['open-passwords','Open Password Manager'], ['open-settings','Open settings']
  ];
  const options = steps.map(([value,label]) => `<label><input type="checkbox" value="${value}" data-workflow-step> ${label}</label>`).join('');
  const cards = (state.automations || []).map((workflow) => `<article class="feature-card"><div class="feature-card-head"><strong>${escapeHtml(workflow.name)}</strong><small>${workflow.steps.length} steps</small></div><div class="mini-list">${workflow.steps.map((step,index) => `<span class="mini-row">${index+1}. ${escapeHtml(steps.find(([key])=>key===step.type)?.[1] || step.type)}${step.value ? ` · ${escapeHtml(step.value)}` : ''}</span>`).join('')}</div><div class="button-line">${actionButton('Run workflow','run-workflow',workflow.id,'primary-button')}${actionButton('Delete','delete-workflow',workflow.id,'danger-button')}</div></article>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Build a browser workflow</strong><p>Create a safe sequence of built-in browser actions. Workflows cannot execute arbitrary code or silently submit website forms.</p></div></div><label class="field-label" for="workflow-name">Workflow name</label><input class="full-input" id="workflow-name" maxlength="70" placeholder="Morning research setup"><strong class="field-label">Steps</strong><div class="workflow-step-list">${options}</div><label class="field-label" for="workflow-urls">URLs to open (optional, one per line)</label><textarea class="full-textarea" id="workflow-urls" rows="3" placeholder="https://example.com/&#10;https://developer.mozilla.org/"></textarea><div class="button-line">${actionButton('Save workflow','create-browser-workflow','','primary-button')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Saved workflows</strong><p>Run a sequence when you need it. Each action uses the browser's existing permission and confirmation rules.</p></div></div><div class="feature-list">${cards || emptyState('No workflows saved','Create a workflow above to automate repeated browser setup tasks.')}</div></section>`;
}

function renderAbout() {
  return `<section class="section-block"><div class="about-hero"><strong>Minimal Browser 2.2</strong><p>A local-first Chromium productivity browser. Profiles, workspaces, tab containers, password vault, bookmarks, notes, sessions and preferences stay on this device unless you explicitly open a connected website or configure an AI provider.</p></div></section><section class="section-block"><div class="section-heading"><div><strong>V2.2 — Advanced Tab Ecosystem</strong><p>Separate browsing contexts with persistent or temporary container sessions, custom identities, per-domain routing and easy tab movement.</p></div></div><div class="feature-list"><article class="feature-card"><strong>Isolated site sessions</strong><p>Persistent containers use separate Chromium partitions for cookies, local storage, IndexedDB, cache and website logins.</p></article><article class="feature-card"><strong>Temporary containers</strong><p>Temporary container site data is not persisted. Its URLs are excluded from persistent history, tab restore, diagnostics, and download history.</p></article><article class="feature-card"><strong>Automatic assignment</strong><p>Domain rules route typed URLs and user-initiated top-level navigation into the most specific matching container.</p></article><article class="feature-card"><strong>Tab controls</strong><p>Open tabs in a container, move tabs from the tab context menu, and manage containers from Browser Hub.</p></article></div></section><section class="section-block"><div class="section-heading"><div><strong>Local-first promise</strong><p>Cloud synchronization has deliberately been left out. There is no browser account or cross-device sync system in this build.</p></div></div><div class="vault-warning">Important: moving a tab reloads it and may lose unsaved page state. Some site permissions and password vault credentials remain profile-wide, not container-specific. AI requests send page text to your configured provider only when you submit a request.</div></section><section class="section-block"><strong>Technical details</strong><p class="muted-note">Product version label: 2.2.0 · Electron / Chromium engine · Local profile storage · No package manifest included for Electron Fiddle.</p>${actionButton('Open browser updates','open-updates')}</section>`;
}

function renderThemeStudio() {
  const profiles = state.themeProfiles || [];
  const workspaceOptions = (state.workspaces || []).map((workspace) => `<option value="${escapeHtml(workspace.id)}" ${workspace.id === state.activeWorkspaceId ? 'selected' : ''}>${escapeHtml(workspace.name)}</option>`).join('');
  const profileOptions = profiles.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`).join('');
  const rows = profiles.map((profile) => `<article class="feature-card"><div class="section-heading"><div><strong>${escapeHtml(profile.name)}</strong><p>${escapeHtml(profile.themePreset)} · ${escapeHtml(profile.theme)} · ${escapeHtml(profile.density)}</p></div></div><div class="button-line">${actionButton('Preview','preview-theme-profile',profile.id)} ${actionButton('Assign to workspace','assign-theme-profile',profile.id)} ${actionButton('Export','export-theme-profile',profile.id)} ${actionButton('Delete','delete-theme-profile',profile.id,'danger-button')}</div></article>`).join('');
  const assigned = state.workspaceThemeProfiles?.[state.activeWorkspaceId] || '';
  return `<section class="section-block"><div class="section-heading"><div><strong>Workspace appearance profiles</strong><p>Create reusable visual profiles, preview them, then assign them to individual workspaces. Theme documents use a validated schema and cannot execute CSS or scripts.</p></div></div><div class="inline-form"><select id="theme-workspace-target">${workspaceOptions}</select><select id="theme-profile-target"><option value="">Choose profile</option>${profileOptions}</select>${actionButton('Assign','assign-selected-theme')}</div><div class="button-line">${actionButton('Reset workspace appearance','reset-workspace-theme','','danger-button')} ${actionButton('Import theme','import-theme-profile')}</div>${state.themePreviewActive ? '<p class="muted-note">Preview is active and has not been assigned. Apply it to keep the appearance, or cancel to roll back.</p><div class="button-line">'+actionButton('Apply preview','apply-theme-preview','')+' '+actionButton('Cancel preview','cancel-theme-preview')+'</div>' : ''}</section><section class="section-block"><div class="section-heading"><div><strong>Create a theme profile</strong><p>CSS variables are restricted to a safe allow-list of color tokens.</p></div></div><div class="setting-grid"><label>Profile name<input id="theme-profile-name" class="full-input" maxlength="48" placeholder="e.g. Work"></label><label>Theme<select id="theme-profile-theme" class="full-input"><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Preset<select id="theme-profile-preset" class="full-input">${['graphite','midnight','nord','forest','sunset','paper','ocean','lavender','ember'].map((x)=>`<option value="${x}">${x}</option>`).join('')}</select></label><label>Accent<select id="theme-profile-accent" class="full-input">${['blue','violet','green','orange','rose','cyan','amber','coral'].map((x)=>`<option value="${x}">${x}</option>`).join('')}</select></label><label>Density<select id="theme-profile-density" class="full-input"><option>comfortable</option><option>compact</option><option>spacious</option></select></label><label>Corners<select id="theme-profile-corners" class="full-input"><option>soft</option><option>sharp</option><option>rounded</option></select></label><label>Font<select id="theme-profile-font" class="full-input"><option>system</option><option>inter</option><option>arial</option><option>georgia</option><option>mono</option></select></label><label>Custom accent<input id="theme-profile-custom-accent" class="full-input" type="color" value="#93a9ff"></label></div><label>Validated color variables (JSON)<textarea id="theme-profile-variables" class="full-textarea" rows="4" placeholder='{"--accent":"#93a9ff","--surface":"#20242c"}'></textarea></label><div class="button-line">${actionButton('Save theme profile','create-theme-profile','','primary-button')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Saved profiles</strong><p>${profiles.length} profiles stored locally.</p></div></div><div class="feature-list">${rows || emptyState('No theme profiles','Create a profile to customize a workspace.')}</div></section>`;
}

function renderSecurityDashboard() {
  const audit = state.privacyAudit || {};
  const extensions = (audit.extensions || []).map((item) => `<div class="log-row"><strong>${escapeHtml(item.level.toUpperCase())} · ${escapeHtml(item.name)} ${item.enabled ? '' : '(disabled)'}</strong><small>${escapeHtml(item.permissions.join(', ') || 'No declared permissions')}</small></div>`).join('');
  const events = (state.securityEvents || []).slice(0, 50).map((item) => `<div class="log-row"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)} · ${escapeHtml(dateLabel(item.at))}</small></div>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Privacy and security overview</strong><p>Local permission and extension audit. Risk labels are indicators based on declared permissions, not proof that an extension is malicious.</p></div></div><div class="stats-grid"><div class="stat-card"><strong>${audit.allowedPermissionCount || 0}</strong><small>Allowed site permissions</small></div><div class="stat-card"><strong>${audit.deniedPermissionCount || 0}</strong><small>Denied site permissions</small></div><div class="stat-card"><strong>${audit.highRiskExtensionCount || 0}</strong><small>High-risk extensions</small></div><div class="stat-card"><strong>${audit.extensionCount || 0}</strong><small>Installed extensions</small></div></div></section><section class="section-block"><div class="section-heading"><div><strong>Secure DNS</strong><p>Uses Chromium DNS-over-HTTPS with a fixed trusted provider. A browser restart is required. This does not protect traffic from all network monitoring or replace a VPN.</p></div></div><select id="secure-dns-provider" class="full-input"><option value="system" ${state.secureDnsProvider==='system'?'selected':''}>Use system DNS</option><option value="cloudflare" ${state.secureDnsProvider==='cloudflare'?'selected':''}>Cloudflare DNS over HTTPS</option><option value="google" ${state.secureDnsProvider==='google'?'selected':''}>Google DNS over HTTPS</option><option value="quad9" ${state.secureDnsProvider==='quad9'?'selected':''}>Quad9 DNS over HTTPS</option></select><div class="button-line">${actionButton('Save DNS provider','save-secure-dns','','primary-button')}</div></section><section class="section-block"><div class="section-heading"><div><strong>Extension permission audit</strong><p>Review broad host access, cookies, history, network interception and other powerful permissions.</p></div></div>${extensions || emptyState('No extensions found','Installed extension manifests will appear here.')}</section><section class="section-block"><div class="section-heading"><div><strong>Security event log</strong><p>Local audit entries for permission changes and download scans.</p></div></div>${events || emptyState('No security events','Security-relevant actions will be recorded here.')}</section>`;
}

function renderPlugins() {
  const plugins = state.installedPlugins || [];
  const rows = plugins.map((plugin) => `<article class="feature-card"><div class="section-heading"><div><strong>${escapeHtml(plugin.name)}</strong><p>${escapeHtml(plugin.id)} · v${escapeHtml(plugin.version)}</p></div><span class="row-tag">${plugin.compatible ? (plugin.enabled ? 'Enabled' : 'Disabled') : 'Incompatible'}</span></div><p class="muted-note">${escapeHtml(plugin.description || plugin.compatibilityReason || '')}</p><small>Permissions: ${escapeHtml((plugin.permissions || []).join(', ') || 'None')}</small><div class="button-line">${actionButton('Open','open-local-plugin',plugin.id,'primary-button',!plugin.enabled || !plugin.compatible)} ${actionButton(plugin.enabled ? 'Disable' : 'Enable','toggle-local-plugin',plugin.id)} ${actionButton('Remove','remove-local-plugin',plugin.id,'danger-button')}</div></article>`).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Local plugin ecosystem</strong><p>Install local plugins that run in isolated sandboxed windows. Plugins receive only the capability APIs explicitly listed in their manifest; they never receive raw IPC or Node.js access.</p></div></div><div class="button-line">${actionButton('Install local plugin','install-local-plugin','','primary-button')}</div><p class="muted-note">Only install plugins from sources you trust. Plugin code can still access the network from its own web context; review its source and permissions first.</p><div class="feature-list">${rows || emptyState('No local plugins installed','Choose a folder containing a valid plugin.json and entry HTML file.')}</div></section>`;
}

function renderResearchLibrary() {
  const items = state.researchItems || [];
  const rows = items.map((item) => {
    const annotations = (item.annotations || []).map((annotation) => `<div class="log-row"><strong>${escapeHtml(annotation.type)} · ${escapeHtml(annotation.quote || 'Note')}</strong><small>${escapeHtml(annotation.note || '')}</small></div>`).join('');
    return `<article class="feature-card"><div class="section-heading"><div><strong>${escapeHtml(item.title)}</strong><p><a href="#" data-action="open-research-item" data-value="${escapeHtml(item.id)}">${escapeHtml(item.sourceRef || item.url)}</a></p></div><span class="row-tag">${item.versionCount || 0} versions</span></div><p class="muted-note">Updated ${escapeHtml(dateLabel(item.updatedAt))} · ${(item.annotations || []).length} annotations</p><div class="button-line">${actionButton('Read offline','open-research-item',item.id)} ${actionButton('Add annotation','annotate-research-item',item.id)} ${actionButton('Compare versions','compare-research-item',item.id,'',Number(item.versionCount)<2)} ${actionButton('Delete','delete-research-item',item.id,'danger-button')}</div>${annotations}</article>`;
  }).join('');
  return `<section class="section-block"><div class="section-heading"><div><strong>Local research library</strong><p>Save readable page snapshots for offline reading, keep source references, annotate important passages, and search saved text.</p></div></div><div class="button-line">${actionButton('Save current page','capture-research-article','','primary-button')} ${actionButton('Export JSON','export-research-json')} ${actionButton('Export Markdown','export-research-markdown')}</div><input class="full-input" id="research-search" type="search" placeholder="Search saved articles, source URLs and full text"><div id="research-comparison" class="muted-note" hidden></div><div class="feature-list" id="research-items">${rows || emptyState('No saved research yet','Save a normal webpage to keep an offline snapshot here.')}</div></section>`;
}

function renderContent() {
  if (!state) return;
  document.documentElement.dataset.theme = state.settings?.theme || 'dark';
  document.documentElement.dataset.accent = state.settings?.accent || 'blue';
  document.documentElement.dataset.preset = state.settings?.themePreset || 'graphite';
  document.documentElement.dataset.density = state.settings?.density || 'comfortable';
  document.documentElement.dataset.corners = state.settings?.cornerStyle || 'soft';
  document.documentElement.dataset.font = state.settings?.fontFamily || 'system';
  document.documentElement.dataset.animations = String(state.settings?.animations !== false);
  if (state.settings?.customAccent) document.documentElement.style.setProperty('--custom-accent', state.settings.customAccent);
  else document.documentElement.style.removeProperty('--custom-accent');
  for (const key of ['--accent','--custom-accent','--bg','--surface','--surface-2','--surface-3','--text','--muted','--border','--tab-active','--toolbar-bg','--panel-bg']) {
    const value = state.settings?.customThemeVariables?.[key];
    if (/^#[0-9a-f]{6}$/i.test(value || '')) document.documentElement.style.setProperty(key, value);
    else if (key !== '--custom-accent') document.documentElement.style.removeProperty(key);
  }
  const activeElement = document.activeElement;
  const isEditing = activeElement && content.contains(activeElement) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName);
  if (isEditing && activeElement.id !== 'history-search') return;
  updateSectionButtons();
  const renderers = {
    workspaces: renderWorkspaces,
    bookmarks: renderBookmarks,
    research: renderResearchLibrary,
    themes: renderThemeStudio,
    security: renderSecurityDashboard,
    plugins: renderPlugins,
    history: renderHistory,
    downloads: renderDownloads,
    split: renderSplit,
    ai: renderAI,
    privacy: renderPrivacy,
    extensions: renderExtensions,
    groups: renderGroups, containers: renderContainers, notes: renderNotes, collections: renderCollections, sessions: renderSessions,
    journeys: renderJourneys, performance: renderPerformance, webpanels: renderWebPanels, notifications: renderNotifications, tools: renderTools,
    profiles: renderProfiles, migration: renderMigration, sitecontrols: renderSiteControls, apps: renderApps, accessibility: renderAccessibility, developer: renderDeveloper, updates: renderUpdates, adblock: renderAdblock, passwords: renderPasswords, services: renderServices, automations: renderAutomations, about: renderAbout
  };
  content.innerHTML = (renderers[section] || renderWorkspaces)();
}

async function runAction(action, value, extra = {}) {
  const result = await api.action(action, { ...extra, ...(value !== undefined ? { id: value, url: value } : {}) });
  if (result && result.ok === false && result.error) showToast(result.error, true);
  else if (action === 'choose-download-folder' && typeof result === 'string') showToast('Download folder updated.');
  renderContent();
  return result;
}

async function handleClick(event) {
  const sectionButton = event.target.closest('[data-section]');
  if (sectionButton) { setSection(sectionButton.dataset.section); return; }

  const button = event.target.closest('[data-action]');
  if (button) {
    const action = button.dataset.action;
    const value = button.dataset.value;
    if (action === 'create-theme-profile') {
      let cssVariables = {};
      try { cssVariables = JSON.parse(document.getElementById('theme-profile-variables')?.value || '{}'); }
      catch { showToast('Custom variables must be valid JSON.', true); return; }
      const result = await api.action(action, { name: document.getElementById('theme-profile-name')?.value || '', theme: document.getElementById('theme-profile-theme')?.value, themePreset: document.getElementById('theme-profile-preset')?.value, accent: document.getElementById('theme-profile-accent')?.value, density: document.getElementById('theme-profile-density')?.value, cornerStyle: document.getElementById('theme-profile-corners')?.value, fontFamily: document.getElementById('theme-profile-font')?.value, customAccent: document.getElementById('theme-profile-custom-accent')?.value, cssVariables });
      showToast(result?.ok ? 'Theme profile saved.' : result?.error || 'Could not save theme profile.', !result?.ok); renderContent(); return;
    }
    if (action === 'assign-selected-theme') {
      const id = document.getElementById('theme-profile-target')?.value;
      const workspaceId = document.getElementById('theme-workspace-target')?.value;
      const result = await api.action('assign-theme-profile', { id, workspaceId });
      showToast(result?.ok ? 'Theme assigned to workspace.' : result?.error || 'Could not assign theme.', !result?.ok); renderContent(); return;
    }
    if (action === 'assign-theme-profile') {
      const result = await api.action('assign-theme-profile', { id: value, workspaceId: state.activeWorkspaceId });
      showToast(result?.ok ? 'Theme assigned to active workspace.' : result?.error || 'Could not assign theme.', !result?.ok); renderContent(); return;
    }
    if (action === 'preview-theme-profile') {
      const result = await api.action(action, { id: value });
      if (!result?.ok) showToast(result?.error || 'Could not preview theme.', true); else showToast('Preview active. Apply or cancel to finish.');
      return;
    }
    if (action === 'apply-theme-preview') {
      const result = await api.action(action);
      showToast(result?.ok ? 'Theme applied to this workspace.' : result?.error || 'Could not apply theme.', !result?.ok);
      renderContent(); return;
    }
    if (action === 'cancel-theme-preview') { await api.action(action); showToast('Theme preview cancelled.'); return; }
    if (action === 'reset-workspace-theme') {
      const result = await api.action(action, { workspaceId: state.activeWorkspaceId });
      showToast(result?.ok ? 'Workspace appearance reset.' : result?.error || 'Could not reset appearance.', !result?.ok); renderContent(); return;
    }
    if (action === 'delete-theme-profile') {
      if (!window.confirm('Delete this theme profile and remove its workspace assignments?')) return;
      const result = await api.action(action, { id: value });
      showToast(result?.ok ? 'Theme profile deleted.' : result?.error || 'Could not delete theme.', !result?.ok); renderContent(); return;
    }
    if (action === 'export-theme-profile') {
      const result = await api.action(action, { id: value });
      showToast(result?.ok ? 'Theme exported.' : result?.cancelled ? 'Export cancelled.' : result?.error || 'Export failed.', !result?.ok && !result?.cancelled); return;
    }
    if (action === 'import-theme-profile') {
      const result = await api.action(action);
      showToast(result?.ok ? 'Theme imported.' : result?.cancelled ? 'Import cancelled.' : result?.error || 'Import failed.', !result?.ok && !result?.cancelled); renderContent(); return;
    }
    if (action === 'apply-responsive-viewport') {
      const result = await api.action('set-responsive-viewport', { preset: document.getElementById('responsive-preset')?.value || '' });
      showToast(result?.ok ? 'Responsive viewport enabled.' : result?.error || 'Could not apply viewport.', !result?.ok); renderContent(); return;
    }
    if (action === 'clear-responsive-viewport') {
      const result = await api.action(action);
      showToast(result?.ok ? 'Responsive viewport disabled.' : result?.error || 'Could not reset viewport.', !result?.ok); renderContent(); return;
    }
    if (action === 'inspect-json') {
      const result = await api.action(action, { text: document.getElementById('dev-json-input')?.value || '' });
      const output = document.getElementById('dev-output');
      if (result?.ok && output) { output.hidden = false; output.textContent = result.result.pretty; showToast('JSON parsed successfully.'); }
      else showToast(result?.error || 'Could not parse JSON.', true);
      return;
    }
    if (action === 'inspect-page-structure' || action === 'inspect-selection-style') {
      const result = await api.action(action);
      const output = document.getElementById('dev-output');
      if (result?.ok && output) { output.hidden = false; output.textContent = JSON.stringify(result.result, null, 2); }
      else showToast(result?.error || 'Inspection failed.', true);
      return;
    }
    if (action === 'save-secure-dns') {
      const provider = document.getElementById('secure-dns-provider')?.value || 'system';
      const result = await api.action('set-secure-dns-provider', { provider });
      if (!result?.ok) showToast(result?.error || 'Could not save DNS preference.', true);
      else if (window.confirm('Secure DNS preference saved. Restart the browser now to apply it?')) await api.action('restart-browser');
      else showToast('Saved. Restart the browser later to apply Secure DNS.');
      return;
    }
    if (action === 'scan-download') {
      showToast('Starting Microsoft Defender scan…');
      const result = await api.action(action, { id: value });
      showToast(result?.ok ? 'Download scan completed.' : result?.error || 'Download scan failed.', !result?.ok);
      return;
    }
    if (action === 'export-extension-collection' || action === 'import-extension-collection') {
      const result = await api.action(action);
      if (result?.ok) showToast(action.startsWith('export') ? 'Extension collection exported.' : 'Extension collection imported: ' + result.count + ' loaded.');
      else showToast(result?.cancelled ? 'Operation cancelled.' : result?.error || 'Extension collection operation failed.', !result?.cancelled);
      renderContent(); return;
    }
    if (action === 'install-local-plugin') {
      const result = await api.action(action);
      showToast(result?.ok ? 'Plugin installed.' : result?.cancelled ? 'Installation cancelled.' : result?.error || 'Plugin install failed.', !result?.ok && !result?.cancelled);
      renderContent(); return;
    }
    if (action === 'open-local-plugin') {
      const result = await api.action(action, { id: value });
      if (!result?.ok) showToast(result?.error || 'Could not open plugin.', true);
      return;
    }
    if (action === 'toggle-local-plugin') {
      const plugin = (state.installedPlugins || []).find((item) => item.id === value);
      const result = await api.action(action, { id: value, enabled: !plugin?.enabled });
      showToast(result?.ok ? 'Plugin state updated.' : result?.error || 'Could not update plugin.', !result?.ok);
      renderContent(); return;
    }
    if (action === 'remove-local-plugin') {
      if (!window.confirm('Remove this plugin and delete its local installed files?')) return;
      const result = await api.action(action, { id: value });
      showToast(result?.ok ? 'Plugin removed.' : result?.error || 'Could not remove plugin.', !result?.ok);
      renderContent(); return;
    }
    if (action === 'capture-research-article') {
      const result = await api.action(action);
      if (result?.ok) {
        showToast(result.changed ? 'Article snapshot saved.' : 'This article version is already up to date.');
        if (result.selectedText) {
          const note = window.prompt('Add a note for the selected passage (optional):', '');
          if (note !== null && (note.trim() || result.selectedText.trim())) await api.action('add-research-annotation', { id: result.itemId, type: 'highlight', quote: result.selectedText, note });
        }
      } else showToast(result?.error || 'Could not save article.', true);
      renderContent(); return;
    }
    if (action === 'annotate-research-item') {
      const quote = window.prompt('Selected passage or quote (optional):', '');
      if (quote === null) return;
      const note = window.prompt('Your note:', '');
      if (note === null) return;
      const result = await api.action('add-research-annotation', { id: value, type: quote.trim() ? 'highlight' : 'note', quote, note });
      showToast(result?.ok ? 'Annotation saved.' : result?.error || 'Could not save annotation.', !result?.ok);
      renderContent(); return;
    }
    if (action === 'compare-research-item') {
      const result = await api.action(action, { id: value });
      const output = document.getElementById('research-comparison');
      if (result?.ok && output) {
        const diff = result.comparison;
        output.hidden = false;
        output.textContent = 'Changes between saved versions: ' + diff.added.length + ' added and ' + diff.removed.length + ' removed paragraphs. Added: ' + diff.added.join(' | ').slice(0, 2500) + ' Removed: ' + diff.removed.join(' | ').slice(0, 2500);
      } else showToast(result?.error || 'Could not compare versions.', true);
      return;
    }
    if (action === 'export-research-json' || action === 'export-research-markdown') {
      const result = await api.action('export-research-library', { format: action.endsWith('markdown') ? 'markdown' : 'json' });
      showToast(result?.ok ? 'Research library exported.' : result?.cancelled ? 'Export cancelled.' : result?.error || 'Export failed.', !result?.ok && !result?.cancelled);
      return;
    }
    if (action === 'open-research-item') {
      const result = await api.action(action, { id: value });
      if (!result?.ok) showToast(result?.error || 'Could not open saved article.', true);
      return;
    }
    if (action === 'delete-research-item') {
      if (!window.confirm('Delete this saved article and its annotations?')) return;
      await runAction(action, value);
      return;
    }
    if (action === 'create-container') {
      const result = await api.action('create-container', { name: document.getElementById('new-container-name')?.value, icon: document.getElementById('new-container-icon')?.value, color: document.getElementById('new-container-color')?.value, temporary: Boolean(document.getElementById('new-container-temporary')?.checked) });
      if (result?.ok) showToast('Container created.'); else showToast(result?.error || 'Could not create container.', true);
      return;
    }
    if (action === 'delete-container') {
      if (!window.confirm('Delete this container? Its tabs will move to Default and its stored website data will be cleared.')) return;
      const result = await api.action('delete-container', { id: value });
      if (!result?.ok) showToast(result?.error || 'Could not delete container.', true); else showToast('Container deleted.');
      return;
    }
    if (action === 'edit-container') {
      const container = (state.containers || []).find((item) => item.id === value);
      if (!container) return;
      const name = window.prompt('Container name', container.name);
      if (name === null) return;
      const icon = window.prompt('Container icon (emoji or short symbol)', container.icon);
      if (icon === null) return;
      const color = window.prompt('Container color (hex, for example #75b8a5)', container.color);
      if (color === null) return;
      if (!/^#[0-9a-f]{6}$/i.test(color.trim())) { showToast('Enter a valid six-digit hex color.', true); return; }
      const result = await api.action('update-container', { id: value, name, icon, color: color.trim(), temporary: container.temporary });
      if (!result?.ok) showToast(result?.error || 'Could not update container.', true); else showToast('Container updated.');
      return;
    }
    if (action === 'move-tab-container') {
      const tabId = document.getElementById('container-tab-target')?.value;
      const containerId = document.getElementById('container-move-target')?.value;
      const result = await api.action('move-tab-container', { id: tabId, containerId });
      if (!result?.ok) showToast(result?.error || 'Could not move tab.', true); else showToast('Tab moved to container.');
      return;
    }
    if (action === 'add-container-rule') {
      const result = await api.action('add-container-rule', { domain: document.getElementById('container-rule-domain')?.value, containerId: document.getElementById('container-rule-target')?.value, includeSubdomains: Boolean(document.getElementById('container-rule-subdomains')?.checked) });
      if (!result?.ok) showToast(result?.error || 'Could not add rule.', true); else showToast('Automatic container rule added.');
      return;
    }
    if (action === 'restart-safe-mode') {
      if (!window.confirm('Restart the browser in Safe Mode? Extensions and the ad-blocking engine will be temporarily disabled for this session.')) return;
      const result = await api.action(action);
      if (result?.ok === false) showToast(result.error || 'Could not restart in Safe Mode.', true);
      return;
    }
    if (action === 'restart-browser') {
      if (!window.confirm('Restart the browser now? Your saved tabs and settings will be kept.')) return;
      const result = await api.action(action);
      if (result?.ok === false) showToast(result.error || 'Could not restart the browser.', true);
      return;
    }
    if (action === 'export-health-report') {
      const result = await api.action(action);
      showToast(result?.ok ? `Diagnostics exported to ${result.path}` : (result?.cancelled ? 'Export cancelled.' : result?.error || 'Could not export diagnostics.'), !result?.ok && !result?.cancelled);
      return;
    }
    if (action === 'clear-health-log') {
      if (!window.confirm('Clear the local browser reliability event log?')) return;
      const result = await api.action(action);
      if (result?.ok) { performanceSnapshot = null; showToast('Reliability event log cleared.'); renderContent(); }
      else showToast(result?.error || 'Could not clear the log.', true);
      return;
    }
    if (action === 'vault-setup' || action === 'vault-unlock') {
      const result = await api.action(action, { password: document.getElementById('vault-master-password')?.value || '', confirm: document.getElementById('vault-master-confirm')?.value || '' });
      if (result?.ok) { showToast(action === 'vault-setup' ? 'Encrypted vault created.' : 'Vault unlocked.'); renderContent(); }
      else showToast(result?.error || 'Vault action failed.', true);
      return;
    }
    if (action === 'vault-save-credential') {
      const result = await api.action('vault-save-credential', { title: document.getElementById('vault-entry-title')?.value || '', site: document.getElementById('vault-site')?.value || '', username: document.getElementById('vault-username')?.value || '', password: document.getElementById('vault-password')?.value || '', notes: document.getElementById('vault-login-notes')?.value || '' });
      if (result?.ok) { showToast('Login saved in the encrypted vault.'); renderContent(); } else showToast(result?.error || 'Could not save login.', true);
      return;
    }
    if (action === 'vault-save-note') {
      const result = await api.action('vault-save-note', { title: document.getElementById('vault-note-title')?.value || '', content: document.getElementById('vault-note-content')?.value || '' });
      if (result?.ok) { showToast('Secure note saved.'); renderContent(); } else showToast(result?.error || 'Could not save note.', true);
      return;
    }
    if (action === 'vault-save-identity') {
      const result = await api.action('vault-save-identity', { title: document.getElementById('vault-identity-title')?.value || '', fullName: document.getElementById('vault-identity-name')?.value || '', email: document.getElementById('vault-identity-email')?.value || '', phone: document.getElementById('vault-identity-phone')?.value || '', address: document.getElementById('vault-identity-address')?.value || '' });
      if (result?.ok) { showToast('Identity saved in the encrypted vault.'); renderContent(); } else showToast(result?.error || 'Could not save identity.', true);
      return;
    }
    if (action === 'vault-generate-password') {
      const result = await api.action('vault-generate-password', { length: 24 });
      if (result?.ok) { const input = document.getElementById('vault-password'); if (input) { input.value = result.password; input.type = 'text'; } showToast('Generated a 24-character password.'); }
      else showToast(result?.error || 'Could not generate a password.', true);
      return;
    }
    if (action === 'vault-change-password') {
      const result = await api.action('vault-change-password', { password: document.getElementById('vault-new-master')?.value || '', confirm: document.getElementById('vault-new-master-confirm')?.value || '' });
      showToast(result?.ok ? 'Master password changed and vault re-encrypted.' : (result?.error || 'Could not change master password.'), !result?.ok);
      renderContent(); return;
    }
    if (action === 'vault-reveal-entry') {
      const result = await api.action('vault-reveal-entry', { id: value });
      const output = document.getElementById(`vault-secret-${value}`);
      if (result?.ok && output) {
        const entry = result.entry || {};
        output.textContent = entry.type === 'credential'
          ? `Username: ${entry.username || '(none)'}\nPassword: ${entry.password || ''}\nNotes: ${entry.notes || ''}`
          : entry.type === 'identity'
            ? `Name: ${entry.fullName || ''}\nEmail: ${entry.email || ''}\nPhone: ${entry.phone || ''}\nAddress: ${entry.address || ''}`
            : entry.content || '';
        output.hidden = false;
      } else showToast(result?.error || 'Could not reveal entry.', true);
      return;
    }
    if (action === 'vault-fill-entry') { const result = await api.action('vault-fill-entry', { id: value }); showToast(result?.ok ? 'Login fields filled. Review them and submit the form yourself.' : (result?.error || (result?.cancelled ? 'Fill cancelled.' : 'Could not fill login.')), !result?.ok && !result?.cancelled); return; }
    if (action === 'vault-delete-entry') { if (!window.confirm('Delete this encrypted vault entry?')) return; const result=await api.action('vault-delete-entry',{id:value}); showToast(result?.ok?'Vault entry deleted.':result.error,!result?.ok); renderContent(); return; }
    if (action === 'vault-lock') { await api.action('vault-lock'); showToast('Password vault locked.'); renderContent(); return; }
    if (action === 'vault-export' || action === 'vault-import') { if (action === 'vault-import' && !window.confirm('Importing replaces this profile’s vault. The existing vault is backed up first. Continue?')) return; const result=await api.action(action); showToast(result?.ok ? (action==='vault-export'?'Encrypted vault backup exported.':'Encrypted vault backup imported. Unlock it with its original master password.') : (result?.error || 'Vault backup action failed.'),!result?.ok && !result?.cancelled); renderContent(); return; }
    if (action === 'save-extension-catalog') { const result=await api.action('save-extension-catalog-url',{url:document.getElementById('extension-catalog-url')?.value || ''}); showToast(result?.ok?`Catalog loaded: ${(result.entries||[]).length} listings.`:result.error,!result?.ok); renderContent(); return; }
    if (action === 'refresh-extension-catalog') { const result=await api.action('refresh-extension-catalog'); showToast(result?.ok?`Catalog refreshed: ${(result.entries||[]).length} listings.`:result.error,!result?.ok); renderContent(); return; }
    if (action === 'create-browser-workflow') {
      const steps=[...document.querySelectorAll('[data-workflow-step]:checked')].map((input)=>({type:input.value}));
      const urls=(document.getElementById('workflow-urls')?.value || '').split(/\r?\n/).map((url)=>url.trim()).filter(Boolean).slice(0,10);
      for (const url of urls) steps.push({type:'open-url',value:url});
      const result=await api.action('create-workflow',{name:document.getElementById('workflow-name')?.value || '',steps});
      showToast(result?.ok?'Workflow saved.':result.error,!result?.ok); renderContent(); return;
    }
    if (action === 'save-accessibility') { const result = await api.action('set-accessibility', { highContrastMode: document.getElementById('a11y-contrast')?.checked || false, reducedMotion: document.getElementById('a11y-motion')?.checked || false, pageTextScale: Number(document.getElementById('page-scale')?.value || 100), translationTarget: document.getElementById('translation-target')?.value || 'en', translationPageTemplate: document.getElementById('translation-page-template')?.value || '', translationTextTemplate: document.getElementById('translation-text-template')?.value || '' }); showToast(result?.ok === false ? result.error : 'Accessibility preferences saved.', result?.ok === false); renderContent(); return; }
    if (action === 'choose-webapp-icon') { const result = await api.action('choose-webapp-icon'); if (result?.ok) { const input = document.getElementById('webapp-icon-path'); if (input) input.value = result.path; showToast('Website icon selected.'); } else if (result?.error) showToast(result.error, true); return; }
    if (action === 'create-profile') await runAction(action, undefined, { name: document.getElementById('profile-name')?.value || '', icon: document.getElementById('profile-icon')?.value || '👤', color: document.getElementById('profile-color')?.value || '#93a9ff' });
    else if (action === 'update-current-profile') await runAction(action, undefined, { name: document.getElementById('current-profile-name')?.value || '', icon: document.getElementById('current-profile-icon')?.value || '👤', color: document.getElementById('current-profile-color')?.value || '#93a9ff' });
    else if (action === 'install-web-app') await runAction(action, undefined, { name: document.getElementById('webapp-name')?.value || '', url: document.getElementById('webapp-url')?.value || '', iconPath: document.getElementById('webapp-icon-path')?.value || '' });
    else if (action === 'add-search-engine') await runAction(action, undefined, { name: document.getElementById('engine-name')?.value || '', id: document.getElementById('engine-id')?.value || '', template: document.getElementById('engine-template')?.value || '' });
    else if (action === 'add-site-shortcut') await runAction(action, undefined, { name: document.getElementById('shortcut-name')?.value || '', keyword: document.getElementById('shortcut-keyword')?.value || '', url: document.getElementById('shortcut-url')?.value || '' });
    else if (action === 'adblock-add-host') await runAction(action, undefined, { host: document.getElementById('adblock-host')?.value || '' });
    else if (action === 'adblock-add-list') await runAction(action, undefined, { url: document.getElementById('adblock-list-url')?.value || '' });
    else if (action === 'save-update-url') await runAction('set-update-manifest', undefined, { url: document.getElementById('update-manifest-url')?.value || '' });
    else if (action === 'open-update-download') { const url = state.updateCheck?.downloadUrl; if (url) await api.action('open-update-download', { url }); }
    else if (action === 'open-adblock-panel') setSection('adblock');
    else if (action === 'open-site-controls') setSection('sitecontrols');
    else if (action === 'refresh-site-cookies') { const result = await api.action('list-site-cookies'); siteCookieCache = result?.ok ? result.cookies : []; renderContent(); }
    else if (action === 'refresh-network-log') { state = await api.getState(); renderContent(); }
    else if (action === 'extension-toggle') { const result = await api.setExtensionEnabled(value, button.dataset.enabled === 'true'); showToast(result?.ok ? 'Extension state updated.' : result.error, !result?.ok); renderContent(); }
    else if (action === 'extension-reload') { const result = await api.reloadExtension(value); showToast(result?.ok ? 'Extension reloaded.' : result.error, !result?.ok); renderContent(); }
    else if (action === 'delete-profile') { if (window.confirm('Delete this profile and its local browser data?')) await runAction(action, value); }
    else if (action === 'restore-deleted-bookmark' || action === 'switch-profile' || action === 'guest-profile' || action === 'import-browser-data' || action === 'export-bookmarks' || action === 'export-history' || action === 'backup-now' || action === 'open-web-app' || action === 'remove-web-app' || action === 'check-updates' || action === 'open-developer-tools' || action === 'view-source' || action === 'translate-page' || action === 'adblock-update' || action === 'adblock-clear-stats' || action === 'adblock-whitelist-toggle' || action === 'adblock-whitelist-remove' || action === 'adblock-remove-host' || action === 'remove-search-engine' || action === 'remove-site-shortcut' || action === 'clear-cookie' || action === 'clear-site-data' || action === 'clear-history' || action === 'export-backup' || action === 'import-backup' || action === 'reader-view' || action === 'capture-page' || action === 'export-pdf' || action === 'mini-window' || action === 'open-private-tab' || action === 'choose-download-folder' || action === 'download-clear-completed' || action === 'exit-split' || action === 'add-bookmark' || action === 'mark-notifications-read' || action === 'clear-notifications') {
      if (action === 'adblock-whitelist-remove') await api.action('adblock-whitelist-toggle', { origin: value });
      else if (action === 'clear-cookie') await runAction(action, undefined, { origin: state.activeOrigin, name: value });
      else if (action === 'clear-site-data' && !window.confirm('Clear cookies and local storage for this website?')) return;
      else if (action === 'clear-history' && !window.confirm('Clear all browsing history?')) return;
      else await runAction(action, value);
    }
    else if (action === 'create-tab-group') { await runAction(action, undefined, { name: document.getElementById('new-group-name')?.value || '', color: document.getElementById('new-group-color')?.value || '#93a9ff' }); }
    else if (action === 'assign-tab-group') { await runAction(action, undefined, { id: document.getElementById('group-tab-target')?.value || state.activeTabId, groupId: document.getElementById('group-target')?.value || null }); }
    else if (action === 'create-note') { await runAction(action, undefined, { title: document.getElementById('new-note-title')?.value || 'Quick note', content: document.getElementById('new-note-content')?.value || '', url: state.activeUrl || '' }); }
    else if (action === 'capture-selection') { const result = await runAction(action); if (result?.ok) showToast('Selected text saved as a note.'); }
    else if (action === 'update-note') { const id = value; await runAction(action, undefined, { id, title: document.getElementById(`note-title-${id}`)?.value || '', content: document.getElementById(`note-content-${id}`)?.value || '' }); }
    else if (action === 'create-collection') { await runAction(action, undefined, { name: document.getElementById('new-collection-name')?.value || '' }); }
    else if (action === 'add-current-to-collection') { await runAction('add-collection-item', undefined, { collectionId: value, url: state.activeUrl, title: state.activeTitle }); }
    else if (action === 'save-session') { await runAction(action, undefined, { name: document.getElementById('session-name')?.value || '' }); }
    else if (action === 'add-web-panel') { await runAction(action, undefined, { name: document.getElementById('web-panel-name')?.value || '', url: document.getElementById('web-panel-url')?.value || '' }); }
    else if (action === 'create-custom-command') { const select = document.getElementById('custom-command-actions'); await runAction(action, undefined, { name: document.getElementById('custom-command-name')?.value || '', actions: [...(select?.selectedOptions || [])].map((option) => option.value) }); }
    else if (action === 'remove-collection-item') { await runAction(action, value, { collectionId: button.dataset.collection || '' }); }
    else if (action === 'create-workspace') {
      const input = document.getElementById('new-workspace-name');
      await runAction(action, undefined, { name: input?.value || '', color: document.getElementById('new-workspace-color')?.value || '#93a9ff' });
    } else if (action === 'rename-workspace') {
      const input = document.getElementById('rename-workspace-name');
      await runAction(action, undefined, { id: state.activeWorkspaceId, name: input?.value || '' });
    } else if (action === 'delete-workspace') {
      if (window.confirm('Delete this workspace and close its tabs?')) await runAction(action, value);
    } else if (action === 'open-history') {
      await api.action('open-bookmark', { url: value });
    } else if (action === 'set-split-layout') { await runAction(action, undefined, { layout: document.getElementById('split-layout')?.value || 'grid' });
    } else if (action === 'restore-session') { if (window.confirm('Restore this session? It replaces the tabs in its saved workspace.')) await runAction(action, value);
    } else if (action === 'remove-bookmark' || action === 'remove-history') {
      await runAction(action, value);
    } else if (action === 'download-pause' || action === 'download-resume' || action === 'download-cancel' || action === 'download-open' || action === 'download-show' || action === 'split-tab' || action === 'switch-workspace' || action === 'open-tab' || action === 'open-bookmark' || action === 'remove-extension' || action === 'delete-tab-group' || action === 'delete-note' || action === 'delete-collection' || action === 'restore-session' || action === 'delete-session' || action === 'sleep-tab' || action === 'wake-all-tabs' || action === 'open-web-panel' || action === 'close-web-panel' || action === 'delete-web-panel' || action === 'delete-custom-command' || action === 'mark-notifications-read' || action === 'clear-notifications' || action === 'run-workflow' || action === 'delete-workflow' || action === 'open-service' || action === 'open-extension-listing' || action === 'open-updates' || action === 'reader-view' || action === 'capture-page' || action === 'export-pdf' || action === 'translate-page' || action === 'mini-window' || action === 'export-backup' || action === 'import-backup' || action === 'choose-wallpaper') {
      if (action === 'remove-extension' && !window.confirm('Remove this extension from the browser?')) return;
      if (action === 'remove-extension') {
        const result = await api.removeExtension(value);
        if (result?.ok === false) showToast(result.error, true);
        else showToast('Extension removed.');
      } else await runAction(action, value);
    } else if (action === 'clear-history' || action === 'download-clear-completed' || action === 'exit-split' || action === 'open-private-tab' || action === 'add-bookmark' || action === 'choose-download-folder' || action === 'clear-site-data') {
      if (action === 'clear-history' && !window.confirm('Clear all browsing history?')) return;
      if (action === 'clear-site-data' && !window.confirm('Clear cookies and local storage for this website?')) return;
      const result = await runAction(action);
      if (action === 'clear-site-data' && result?.ok) showToast('Site data cleared.');
    }
    return;
  }

  if (event.target.id === 'summarize-page' || event.target.id === 'ask-ai') {
    const summarize = event.target.id === 'summarize-page';
    const question = document.getElementById('ai-question')?.value || '';
    const status = document.getElementById('ai-status');
    const answer = document.getElementById('ai-answer');
    status.textContent = 'Working…';
    answer.textContent = 'Reading the page and contacting the AI provider…';
    const result = await api.askAI({ summarize, question });
    status.textContent = result.ok ? 'Response received.' : 'Request failed.';
    answer.textContent = result.ok ? result.answer : result.error;
    return;
  }
  if (event.target.id === 'compare-tabs') {
    const status = document.getElementById('ai-status');
    const answer = document.getElementById('ai-answer');
    const question = document.getElementById('ai-question')?.value || 'Compare the pages in this workspace.';
    if (status) status.textContent = 'Reading up to five loaded tabs…';
    if (answer) answer.textContent = 'Collecting page text and contacting the configured AI provider…';
    const result = await api.action('compare-workspace-tabs', { question });
    if (status) status.textContent = result?.ok ? 'Comparison complete.' : 'Comparison failed.';
    if (answer) answer.textContent = result?.ok ? result.answer : (result?.error || 'Comparison failed.');
    return;
  }
  if (event.target.id === 'save-ai-config') {
    const config = {
      endpoint: document.getElementById('ai-endpoint')?.value || '',
      model: document.getElementById('ai-model')?.value || '',
      apiKey: document.getElementById('ai-key')?.value || ''
    };
    const status = event.target;
    status.disabled = true;
    const result = await api.configureAI(config);
    status.disabled = false;
    showToast(result.ok ? 'AI provider settings saved.' : result.error, !result.ok);
    if (result.ok) renderContent();
    return;
  }
  if (event.target.id === 'refresh-performance') {
    const button = event.target; button.disabled = true;
    performanceSnapshot = await api.performance(); button.disabled = false; renderContent(); return;
  }
  if (event.target.id === 'add-extension') {
    const result = await api.chooseExtension();
    if (result.cancelled) return;
    showToast(result.ok ? `Loaded ${result.extension?.name || 'extension'}.` : result.error, !result.ok);
    return;
  }
}

content.addEventListener('click', (event) => { handleClick(event).catch((error) => showToast(error.message, true)); });
content.addEventListener('input', (event) => {
  if (event.target.id === 'network-search') {
    const query = event.target.value.toLowerCase();
    document.querySelectorAll('#network-log-rows .log-row').forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(query); });
  }
  if (event.target.id === 'research-search') {
    api.action('search-research-library', { query: event.target.value }).then((result) => {
      const allowed = new Set(result?.ids || []);
      document.querySelectorAll('#research-items .feature-card').forEach((row) => {
        const id = row.querySelector('[data-action="open-research-item"]')?.dataset.value;
        row.hidden = !allowed.has(id);
      });
    }).catch(() => {});
  }

  if (event.target.id === 'split-ratio') {
    const label = document.getElementById('split-ratio-value');
    if (label) label.textContent = `${event.target.value}%`;
  }
});
content.addEventListener('change', async (event) => {
  if (event.target.id === 'download-concurrency-choice') {
    const result = await api.action('set-download-concurrency', { limit: Number(event.target.value) });
    if (!result?.ok) showToast(result?.error || 'Could not update download concurrency.', true);
    else showToast('Download concurrency updated.');
  }
  if (event.target.id === 'split-ratio') {
    await api.action('set-split-ratio', { ratio: Number(event.target.value) });
  }
  if (event.target.id === 'split-layout') { await api.action('set-split-layout', { layout: event.target.value }); }
  if (event.target.id === 'auto-sleep-choice') { await api.action('set-auto-sleep', { minutes: Number(event.target.value) }); showToast('Automatic tab sleeping updated.'); }
  if (event.target.id === 'health-monitor-toggle' || event.target.id === 'auto-recover-toggle') { const result = await api.action('save-performance-settings', { monitoring: document.getElementById('health-monitor-toggle')?.checked, autoRecover: document.getElementById('auto-recover-toggle')?.checked }); showToast(result?.ok ? 'Reliability preferences saved.' : (result?.error || 'Could not save reliability preferences.'), !result?.ok); }
  if (event.target.id === 'password-vault-autolock') { const result=await api.action('set-vault-autolock',{minutes:Number(event.target.value)}); showToast(result?.ok?'Password vault auto-lock updated.':result.error,!result?.ok); }
  if (event.target.id === 'privacy-strict-referrer' || event.target.id === 'privacy-clear-cookies-exit') { const result=await api.action('set-privacy-preferences',{strictReferrerPolicy:document.getElementById('privacy-strict-referrer')?.checked,clearCookiesOnExit:document.getElementById('privacy-clear-cookies-exit')?.checked}); showToast(result?.ok?'Privacy preferences saved.':result.error,!result?.ok); }
  if (event.target.id === 'download-organize-toggle') { const result=await api.action('set-download-organization',{enabled:event.target.checked}); if(result?.ok) showToast('Download organization updated.'); }
  if (event.target.id === 'adblock-main-toggle') { const result=await api.action('toggle-adblock',{enabled:event.target.checked}); showToast(result?.status?.message || (result?.ok?'Ad blocker updated.':result.error), !result?.ok); }
  if (event.target.id === 'adblock-auto-update') { const result=await api.action('set-adblock-auto-update',{enabled:event.target.checked}); showToast(result?.ok?'Automatic filter updates saved.':result.error,!result?.ok); }
  if (['filter-ads','filter-trackers','filter-annoyances'].includes(event.target.id)) { const result=await api.action('adblock-lists',{ads:document.getElementById('filter-ads')?.checked,trackers:document.getElementById('filter-trackers')?.checked,annoyances:document.getElementById('filter-annoyances')?.checked}); showToast(result?.ok?'Filter lists updated.':result.error,!result?.ok); }
  if (event.target.id === 'site-javascript-toggle') { const result=await api.action('site-javascript',{enabled:event.target.checked}); showToast(result?.ok?'Site JavaScript preference saved.':result.error,!result?.ok); }
  if (event.target.id === 'site-popup-policy') { const result=await api.action('site-popups',{policy:event.target.value}); showToast(result?.ok?'Pop-up preference saved.':result.error,!result?.ok); }
  if (event.target.id === 'site-zoom') { const result=await api.action('site-zoom',{factor:Number(event.target.value)/100}); showToast(result?.ok?'Site zoom saved.':result.error,!result?.ok); }
  if (event.target.id === 'auto-backup-toggle' || event.target.id === 'auto-backup-days') { const result=await api.action('save-backup-settings',{enabled:document.getElementById('auto-backup-toggle')?.checked,days:Number(document.getElementById('auto-backup-days')?.value||1)}); showToast(result?.ok?'Backup schedule saved.':result.error,!result?.ok); }
  if (event.target.id === 'apps-startup-toggle') { const result=await api.action('set-apps-startup',{enabled:event.target.checked}); showToast(result?.ok?'Startup preference saved.':result.error,!result?.ok); }
  if (event.target.id === 'startup-behavior' || event.target.id === 'startup-session') { const mode=document.getElementById('startup-behavior')?.value || 'restore'; const result=await api.action('set-startup-behavior',{mode,sessionId:document.getElementById('startup-session')?.value || ''}); const sessionSelect=document.getElementById('startup-session'); if(sessionSelect) sessionSelect.disabled=mode!=='session'; showToast(result?.ok?'Startup behavior saved.':result.error,!result?.ok); }
  if (event.target.id === 'search-engine-default') { const result=await api.action('set-search-engine',{id:event.target.value}); showToast(result?.ok?'Default search engine updated.':result.error,!result?.ok); }
  if (event.target.id === 'spellcheck-toggle') { const result=await api.action('set-spellcheck',{enabled:event.target.checked}); showToast(result?.ok?'Spellchecking preference saved.':result.error,!result?.ok); }
  if (event.target.id === 'site-permission-expiry') { /* Expiry is read by the subsequent permission change. */ }
  if (event.target.id === 'page-scale') { const label=document.getElementById('page-scale-value'); if(label) label.textContent=`${event.target.value}%`; }
  if (event.target.id === 'site-zoom') { const label=document.getElementById('site-zoom-value'); if(label) label.textContent=`${event.target.value}%`; }
  if (event.target.id === 'tracker-toggle') {
    const result = await api.action('toggle-tracker-blocking', { enabled: event.target.checked });
    if (result?.ok) showToast(event.target.checked ? 'Tracker blocking enabled.' : 'Tracker blocking disabled.');
  }
  if (event.target.id === 'a11y-contrast' || event.target.id === 'a11y-motion' || event.target.id === 'page-scale') { /* Save together using the button below. */ }
  if (event.target.matches('[data-permission]')) {
    const result = await api.action('site-permission-expiry', { origin: state.activeOrigin, permission: event.target.dataset.permission, allowed: event.target.value === 'allow', expiryHours: Number(document.getElementById('permission-expiry')?.value || 0) });
    showToast(result?.ok ? 'Website permission updated.' : result.error, !result?.ok);
  }
});
content.addEventListener('focusout', () => { setTimeout(() => { if (!content.contains(document.activeElement)) renderContent(); }, 0); });
content.addEventListener('input', (event) => {
  if (event.target.id === 'history-search') {
    historyQuery = event.target.value;
    const query = historyQuery.toLowerCase();
    document.querySelectorAll('#history-rows .list-row').forEach((row) => {
      row.hidden = !row.textContent.toLowerCase().includes(query);
    });
  }
});

document.querySelectorAll('.section-nav button').forEach((button) => button.addEventListener('click', () => setSection(button.dataset.section)));
document.getElementById('close-panel').addEventListener('click', () => api.close());
document.getElementById('open-settings-from-hub')?.addEventListener('click', () => api.action('open-settings'));
document.getElementById('panel-filter')?.addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll('.nav-group').forEach((group) => {
    const buttons = [...group.querySelectorAll('button[data-section]')];
    let visible = 0;
    for (const button of buttons) {
      const match = !query || button.textContent.toLowerCase().includes(query) || button.dataset.section.includes(query);
      button.hidden = !match;
      if (match) visible += 1;
    }
    group.hidden = visible === 0;
  });
});

api.onState((nextState) => {
  state = nextState;
  if (nextState.activePanelSection && nextState.activePanelSection !== section) section = nextState.activePanelSection;
  if (section === 'history' && document.activeElement?.id === 'history-search') return;
  renderContent();
});
api.getState().then(async (nextState) => { state = nextState; section = nextState?.activePanelSection || section; updateSectionButtons(); renderContent(); if (section === 'performance') { performanceSnapshot = await api.performance(); renderContent(); } }).catch((error) => showToast(error.message, true));

let performanceRefreshBusy = false;
setInterval(async () => {
  if (section !== 'performance' || document.hidden || performanceRefreshBusy) return;
  performanceRefreshBusy = true;
  try { performanceSnapshot = await api.performance(); renderContent(); }
  catch (error) { console.warn('Performance refresh failed:', error.message); }
  finally { performanceRefreshBusy = false; }
}, 5000);
