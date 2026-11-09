'use strict';

const api = window.browserAPI;
const tabsElement = document.getElementById('tabs');
const addressForm = document.getElementById('address-form');
const addressInput = document.getElementById('address-input');
const clearAddressButton = document.getElementById('clear-address');
const backButton = document.getElementById('back-button');
const forwardButton = document.getElementById('forward-button');
const homeButton = document.getElementById('home-button');
const reloadButton = document.getElementById('reload-button');
const bookmarkButton = document.getElementById('bookmark-button');
const splitButton = document.getElementById('split-button');
const panelButton = document.getElementById('panel-button');
const contextMenu = document.getElementById('tab-context-menu');

let currentState = { tabs: [], workspaces: [], activeWorkspaceId: null, settings: { theme: 'dark', accent: 'blue' } };
let addressHasFocus = false;
let contextTabId = null;
let commandItems = [];
let commandSelectedIndex = 0;
let gestureStart = null;
let toastTimeout = null;

const ICONS = {
  reload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-4.95L20 12"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>'
};


function toast(message) {
  const element = document.getElementById('chrome-toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.classList.remove('visible'), 2400);
}

function applyPersonalization(settings = {}) {
  const root = document.documentElement;
  root.dataset.theme = settings.theme || 'dark';
  root.dataset.accent = settings.accent || 'blue';
  root.dataset.compactTabs = String(Boolean(settings.compactTabs));
  root.dataset.preset = settings.themePreset || 'graphite';
  root.dataset.density = settings.density || 'comfortable';
  root.dataset.corners = settings.cornerStyle || 'soft';
  root.dataset.font = settings.fontFamily || 'system';
  root.dataset.animations = String(settings.animations !== false);
  root.style.setProperty('--tab-width', `${Number(settings.tabWidth) || 210}px`);
  root.style.setProperty('--sidebar-width', `${Number(settings.sidebarWidth) || 356}px`);
  if (settings.customAccent) root.style.setProperty('--custom-accent', settings.customAccent);
  else root.style.removeProperty('--custom-accent');

  const visibility = settings.toolbarVisibility || {};
  const buttonMap = {
    bookmark: 'bookmark-button', split: 'split-button', command: 'command-button', reader: 'reader-button',
    capture: 'capture-button', pdf: 'pdf-button', mini: 'mini-button', translate: 'translate-button', profile: 'profile-button', adblock: 'adblock-button',
    downloads: 'downloads-button', ai: 'ai-button', library: 'panel-button', private: 'private-button', settings: 'settings-button'
  };
  for (const [key, id] of Object.entries(buttonMap)) {
    const button = document.getElementById(id);
    if (button) button.hidden = visibility[key] === false;
  }

  const toolbar = document.getElementById('toolbar-actions');
  if (toolbar && Array.isArray(settings.toolbarOrder)) {
    const ordered = [...new Set(settings.toolbarOrder)].filter((key) => buttonMap[key]);
    for (const key of Object.keys(buttonMap)) if (!ordered.includes(key)) ordered.push(key);
    for (const key of ordered) {
      const button = document.getElementById(buttonMap[key]);
      if (button) toolbar.appendChild(button);
    }
  }
  if (settings.browserName) document.title = settings.browserName;
}

function makeTabGroupChip(group, memberTabs) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `tab-group-chip${group.collapsed ? ' collapsed' : ''}${memberTabs.some((tab) => tab.active) ? ' active' : ''}`;
  button.style.setProperty('--tab-group-color', group.color || 'var(--accent)');
  button.title = `${group.collapsed ? 'Expand' : 'Collapse'} ${group.name} · ${memberTabs.length} tabs`;
  const dot = document.createElement('span'); dot.className = 'tab-group-dot';
  const label = document.createElement('span'); label.className = 'tab-group-label'; label.textContent = group.name;
  const count = document.createElement('span'); count.className = 'tab-group-count'; count.textContent = String(memberTabs.length);
  button.append(dot, label, count);
  button.addEventListener('click', () => api.command('toggle-tab-group', { id: group.id }));
  return button;
}

function commandCatalog() {
  const actions = [
    ['New tab', 'Open a blank tab', 'new-tab'], ['New private tab', 'Open a temporary private tab', 'new-private-tab'],
    ['Back', 'Go to the previous page', 'back'], ['Forward', 'Go to the next page', 'forward'],
    ['Reload page', 'Reload the active tab', 'reload'], ['Reader view', 'Open a distraction-free reading window', 'reader'],
    ['Capture webpage', 'Save a screenshot and copy it', 'capture'], ['Export page as PDF', 'Save the active page as a PDF', 'pdf'],
    ['Open mini window', 'Float the current page above other windows', 'mini-window'], ['Translate page', 'Open a translated version in English', 'translate'],
    ['Open settings', 'Personalize your browser', 'settings'], ['Bookmarks', 'Open saved pages', 'bookmarks'], ['Reopen most recently closed tab', 'Restore the last closed webpage', 'reopen-closed'],
    ['History', 'Open browsing history', 'history'], ['Downloads', 'Manage downloaded files', 'downloads'], ['Tab containers', 'Manage isolated website sessions', 'containers'],
    ['Notes', 'Open your notes', 'notes'], ['Collections', 'Open saved research collections', 'collections'],
    ['Performance manager', 'Inspect tabs and memory usage', 'performance'], ['Sleep inactive tabs', 'Put eligible background tabs to sleep', 'sleep-inactive'], ['Tab groups', 'Organize tabs into collapsible groups', 'groups'], ['Saved sessions', 'Restore a named browsing session', 'sessions'], ['Web panels', 'Open custom website panels', 'webpanels'], ['Notification center', 'Review browser-generated notices', 'notifications']
  ].map(([label, detail, command]) => ({ kind: 'action', label, detail, command }));
  const tabs = (currentState.allTabs || []).map((tab) => ({ kind: 'tab', label: tab.title || tab.url || 'New tab', detail: `${currentState.workspaces?.find((w) => w.id === tab.workspaceId)?.name || 'Workspace'} · ${tab.url || 'New tab'}`, id: tab.id }));
  const workspaces = (currentState.workspaces || []).map((workspace) => ({ kind: 'workspace', label: `Workspace: ${workspace.name}`, detail: `${workspace.tabCount} tabs`, id: workspace.id }));
  const containers = (currentState.containers || []).map((container) => ({ kind: 'container', label: `Open new tab in ${container.name}`, detail: `${container.tabCount || 0} tabs · ${container.sessionTemporary ? 'Temporary session' : 'Isolated persistent session'}`, id: container.id }));
  const bookmarks = (currentState.bookmarks || []).map((item) => ({ kind: 'bookmark', label: item.title || item.url, detail: item.url, url: item.url }));
  const history = (currentState.history || []).slice(0, 70).map((item) => ({ kind: 'history-entry', label: item.title || item.url, detail: item.url, url: item.url }));
  const recentlyClosed = (currentState.recentlyClosed || []).slice(0, 20).map((item, index) => ({ kind: 'recently-closed', label: item.title || item.url || 'Closed tab', detail: `Recently closed · ${item.url || 'New tab'}`, index }));
  const sessions = (currentState.sessions || []).map((item) => ({ kind: 'saved-session', label: `Restore session: ${item.name}`, detail: `${item.tabs?.length || 0} tabs · ${new Date(item.savedAt || 0).toLocaleDateString()}`, id: item.id }));
  const custom = (currentState.customCommands || []).map((item) => ({ kind: 'custom-command', label: item.name, detail: `Custom sequence · ${item.actions.length} actions`, id: item.id }));
  return [...actions, ...tabs, ...workspaces, ...containers, ...bookmarks, ...history, ...recentlyClosed, ...sessions, ...custom];
}

function renderCommandResults(query = '') {
  const results = document.getElementById('command-results');
  if (!results) return;
  const normalized = query.trim().toLowerCase();
  const filtered = commandItems.filter((item) => !normalized || `${item.label} ${item.detail}`.toLowerCase().includes(normalized)).slice(0, 40);
  commandSelectedIndex = Math.min(commandSelectedIndex, Math.max(0, filtered.length - 1));
  results.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('div'); empty.className = 'command-empty'; empty.textContent = 'No matching tabs, pages or commands.'; results.appendChild(empty); return;
  }
  filtered.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `command-result${index === commandSelectedIndex ? ' selected' : ''}`;
    const icon = document.createElement('span'); icon.className = 'command-result-icon';
    icon.textContent = item.kind === 'tab' ? '◫' : item.kind === 'workspace' ? '▦' : item.kind === 'container' ? '◉' : item.kind === 'bookmark' ? '☆' : item.kind === 'history-entry' ? '◷' : item.kind === 'custom-command' ? '⚡' : item.kind === 'recently-closed' ? '↶' : item.kind === 'saved-session' ? '▤' : '⌘';
    const text = document.createElement('span'); text.className = 'command-result-text';
    const title = document.createElement('strong'); title.textContent = item.label;
    const detail = document.createElement('small'); detail.textContent = item.detail || '';
    text.append(title, detail); button.append(icon, text);
    button.addEventListener('mouseenter', () => { commandSelectedIndex = index; results.querySelectorAll('.command-result').forEach((row, i) => row.classList.toggle('selected', i === index)); });
    button.addEventListener('click', () => runCommandItem(item));
    results.appendChild(button);
  });
}

function openCommandCenter() {
  const backdrop = document.getElementById('command-backdrop');
  const input = document.getElementById('command-input');
  if (!backdrop || !input) return;
  commandItems = commandCatalog(); commandSelectedIndex = 0;
  backdrop.hidden = false; input.value = ''; renderCommandResults(''); input.focus();
}
function closeCommandCenter() {
  const backdrop = document.getElementById('command-backdrop');
  if (backdrop) backdrop.hidden = true;
}
async function runCommandItem(item) {
  closeCommandCenter();
  let result;
  if (item.kind === 'action') result = await api.command(item.command);
  else if (item.kind === 'tab') result = await api.command('tab', { id: item.id });
  else if (item.kind === 'workspace') result = await api.command('workspace', { id: item.id });
  else if (item.kind === 'container') result = await api.command('open-container', { id: item.id });
  else if (item.kind === 'bookmark') result = await api.command('bookmark', { url: item.url });
  else if (item.kind === 'history-entry') result = await api.command('history-entry', { url: item.url });
  else if (item.kind === 'recently-closed') result = await api.command('reopen-closed', { index: item.index });
  else if (item.kind === 'saved-session') result = await api.command('restore-session', { id: item.id });
  else if (item.kind === 'custom-command') result = await api.command('custom-command', { id: item.id });
  if (result?.ok === false && result.error) toast(result.error);
  else if (item.kind === 'action' && item.command === 'sleep-inactive') toast(`Put ${result?.count || 0} tabs to sleep.`);
}

function runMouseGesture(direction) {
  const commands = { left: () => api.back(), right: () => api.forward(), up: () => api.newTab(), down: () => currentState.activeTabId && api.closeTab(currentState.activeTabId) };
  commands[direction]?.();
}
function fallbackFavicon(tab) {
  const fallback = document.createElement('span');
  fallback.className = 'tab-favicon-fallback';
  fallback.textContent = tab.isPrivate ? '◉' : (tab.isNewTab ? 'N' : (tab.title || 'W').trim().charAt(0).toUpperCase());
  return fallback;
}

function createFavicon(tab) {
  if (!tab.favicon) return fallbackFavicon(tab);
  const image = document.createElement('img');
  image.className = 'tab-favicon';
  image.alt = '';
  image.src = tab.favicon;
  image.addEventListener('error', () => image.replaceWith(fallbackFavicon(tab)), { once: true });
  return image;
}

function makeTab(tab) {
  const element = document.createElement('div');
  element.className = `tab${tab.active ? ' active' : ''}${tab.pinned ? ' pinned' : ''}${tab.split ? ' split-tab' : ''}${tab.isPrivate ? ' private-tab' : ''}${tab.crashed ? ' crashed' : ''}${tab.unresponsive ? ' unresponsive' : ''}${tab.recovering ? ' recovering' : ''}`;
  if (tab.isLoading) element.classList.add('loading');
  if (tab.audible) element.classList.add('audible');
  element.setAttribute('role', 'tab');
  element.setAttribute('aria-selected', String(Boolean(tab.active)));
  element.tabIndex = tab.active ? 0 : -1;
  element.draggable = true;
  element.dataset.tabId = tab.id;
  const tabGroup = currentState.tabGroups?.find((group) => group.id === tab.groupId);
  if (tabGroup) { element.dataset.groupId = tabGroup.id; element.style.setProperty('--tab-group-color', tabGroup.color || 'var(--accent)'); }
  const healthLabel = tab.recovering ? '\nRecovering page…' : tab.crashed ? '\nPage crashed — open Performance to reload' : tab.unresponsive ? '\nPage is not responding' : '';
  element.title = `${tab.title || 'New tab'}${tab.url ? `\n${tab.url}` : ''}${healthLabel}`;
  element.appendChild(createFavicon(tab));
  const container = currentState.containers?.find((item) => item.id === tab.containerId);
  if (container && container.id !== 'default') {
    element.classList.add('contained-tab');
    element.style.setProperty('--container-color', container.color || '#93a9ff');
    const marker = document.createElement('span'); marker.className = 'tab-container-marker'; marker.textContent = container.icon || '◉'; marker.title = `${container.name}${container.sessionTemporary ? ' · Temporary' : ''}`; element.appendChild(marker);
  }

  if (tab.isLoading) {
    const spinner = document.createElement('span');
    spinner.className = 'tab-loading';
    spinner.setAttribute('aria-label', 'Loading');
    element.appendChild(spinner);
  }

  const title = document.createElement('span');
  title.className = 'tab-title';
  title.textContent = tab.title || 'New tab';
  element.appendChild(title);

  if (tab.muted) {
    const muted = document.createElement('span');
    muted.className = 'tab-muted';
    muted.textContent = '◖';
    muted.title = 'Muted';
    element.appendChild(muted);
  }

  const closeButton = document.createElement('button');
  closeButton.className = 'tab-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.title = 'Close tab';
  closeButton.setAttribute('aria-label', `Close ${tab.title || 'tab'}`);
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    api.closeTab(tab.id);
  });
  element.appendChild(closeButton);

  element.addEventListener('click', () => api.switchTab(tab.id));
  element.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    contextTabId = tab.id;
    const pinButton = contextMenu.querySelector('[data-action="pin"]');
    const muteButton = contextMenu.querySelector('[data-action="mute"]');
    pinButton.textContent = tab.pinned ? 'Unpin tab' : 'Pin tab';
    muteButton.textContent = tab.muted ? 'Unmute tab' : 'Mute tab';
    const containerOptions = document.getElementById('tab-container-options');
    containerOptions.replaceChildren();
    const containers = tab.isPrivate ? [] : (currentState.containers || []).filter((item) => item.id !== (tab.containerId || 'default'));
    for (const container of containers) {
      const option = document.createElement('button'); option.type = 'button'; option.className = 'container-menu-option'; option.dataset.containerId = container.id;
      const dot = document.createElement('span'); dot.className = 'container-menu-dot'; dot.style.background = container.color || '#93a9ff'; option.appendChild(dot);
      const label = document.createElement('span'); label.textContent = `${container.icon || '◉'} ${container.name}`; option.appendChild(label);
      containerOptions.appendChild(option);
    }
    if (!containers.length) { const empty = document.createElement('span'); empty.className = 'context-menu-empty'; empty.textContent = 'No other containers'; containerOptions.appendChild(empty); }
    contextMenu.hidden = false;
    const maxX = window.innerWidth - contextMenu.offsetWidth - 8;
    const maxY = window.innerHeight - contextMenu.offsetHeight - 8;
    contextMenu.style.left = `${Math.max(8, Math.min(event.clientX, maxX))}px`;
    contextMenu.style.top = `${Math.max(8, Math.min(event.clientY, maxY))}px`;
  });

  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      api.switchTab(tab.id);
    }
  });
  element.addEventListener('dragstart', (event) => {
    element.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tab.id);
  });
  element.addEventListener('dragend', () => {
    element.classList.remove('dragging');
    tabsElement.querySelectorAll('.drag-over').forEach((item) => item.classList.remove('drag-over'));
  });
  element.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    element.classList.add('drag-over');
  });
  element.addEventListener('dragleave', () => element.classList.remove('drag-over'));
  element.addEventListener('drop', (event) => {
    event.preventDefault();
    element.classList.remove('drag-over');
    const sourceId = event.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== tab.id) api.reorderTabs(sourceId, tab.id);
  });
  return element;
}

function render(state) {
  if (!state || !Array.isArray(state.tabs)) return;
  currentState = state;
  const fragment = document.createDocumentFragment();
  const groups = (state.tabGroups || []).filter((group) => group.workspaceId === state.activeWorkspaceId);
  const renderedGroups = new Set();
  for (const tab of state.tabs) {
    const group = groups.find((item) => item.id === tab.groupId);
    if (!group) { fragment.appendChild(makeTab(tab)); continue; }
    const members = state.tabs.filter((item) => item.groupId === group.id);
    if (!renderedGroups.has(group.id)) {
      fragment.appendChild(makeTabGroupChip(group, members));
      renderedGroups.add(group.id);
    }
    if (!group.collapsed) fragment.appendChild(makeTab(tab));
  }
  tabsElement.replaceChildren(fragment);

  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
  const workspace = state.workspaces?.find((item) => item.id === state.activeWorkspaceId);
  document.getElementById('workspace-indicator').textContent = workspace?.name || 'Workspace';
  const containerButton = document.getElementById('container-quick-button');
  if (containerButton) {
    const container = currentState.containers?.find((item) => item.id === activeTab?.containerId);
    containerButton.textContent = activeTab?.isPrivate ? '◉' : (container?.icon || '🌐');
    containerButton.title = activeTab?.isPrivate ? 'Private browsing session' : `Container: ${container?.name || 'Default'} · Manage containers`;
    containerButton.style.setProperty('--container-color', container?.color || 'transparent');
    containerButton.classList.toggle('container-active', Boolean(container && container.id !== 'default'));
  }

  if (activeTab) {
    if (!addressHasFocus) addressInput.value = activeTab.url || '';
    backButton.disabled = !activeTab.canGoBack;
    forwardButton.disabled = !activeTab.canGoForward;
    reloadButton.title = activeTab.isLoading ? 'Stop loading' : 'Reload';
    reloadButton.setAttribute('aria-label', activeTab.isLoading ? 'Stop loading' : 'Reload');
    reloadButton.innerHTML = activeTab.isLoading ? ICONS.stop : ICONS.reload;
  } else {
    backButton.disabled = true;
    forwardButton.disabled = true;
    addressInput.value = '';
    reloadButton.innerHTML = ICONS.reload;
  }

  const currentUrl = state.activeUrl || '';
  const bookmarkable = Boolean(activeTab && !activeTab.isPrivate && !activeTab.isNewTab && currentUrl);
  bookmarkButton.disabled = !bookmarkable;
  bookmarkButton.classList.toggle('is-active', Boolean(state.bookmarks?.some((item) => item.url === currentUrl)));
  bookmarkButton.title = !bookmarkable ? 'Open a normal webpage to bookmark it' : (state.bookmarks?.some((item) => item.url === currentUrl) ? 'Remove bookmark' : 'Bookmark this page');
  splitButton.classList.toggle('is-active', Boolean(state.splitEnabled));
  panelButton.setAttribute('aria-pressed', String(Boolean(state.panelVisible)));
  const profileButton = document.getElementById('profile-button');
  if (profileButton) { profileButton.textContent = `${state.profile?.icon || '👤'} ${state.profile?.name || 'Profile'}`; profileButton.title = `Current profile: ${state.profile?.name || 'Profile'} — switch profiles`; }
  const shieldCount = document.getElementById('shield-count');
  if (shieldCount) shieldCount.textContent = Number(state.adblock?.stats?.blocked || 0).toLocaleString();
  const shieldButton = document.getElementById('adblock-button');
  if (shieldButton) { shieldButton.classList.toggle('is-active', Boolean(state.adblockStatus?.enabled)); shieldButton.title = state.adblockStatus?.message || 'Privacy and ad blocking'; }
  applyPersonalization(state.settings || {});
}

function openPanel(section) {
  api.togglePanel(section);
}

document.getElementById('new-tab-button').addEventListener('click', () => api.newTab());
document.getElementById('container-quick-button')?.addEventListener('click', () => openPanel('containers'));
document.getElementById('workspace-indicator').addEventListener('click', () => openPanel('workspaces')); 
backButton.addEventListener('click', () => api.back());
forwardButton.addEventListener('click', () => api.forward());
homeButton.addEventListener('click', () => api.home());
reloadButton.addEventListener('click', () => {
  const active = currentState.tabs.find((tab) => tab.id === currentState.activeTabId);
  if (active?.isLoading) api.stop(); else api.reload();
});
bookmarkButton.addEventListener('click', () => api.toggleBookmark());
splitButton.addEventListener('click', () => openPanel('split'));
document.getElementById('downloads-button').addEventListener('click', () => openPanel('downloads'));
document.getElementById('ai-button').addEventListener('click', () => openPanel('ai'));
panelButton.addEventListener('click', () => openPanel('workspaces'));
document.getElementById('private-button').addEventListener('click', () => api.newPrivateTab());
document.getElementById('profile-button').addEventListener('click', () => openPanel('profiles'));
document.getElementById('adblock-button').addEventListener('click', () => openPanel('adblock'));
document.getElementById('settings-button').addEventListener('click', () => api.openSettings());
document.getElementById('command-button').addEventListener('click', openCommandCenter);
document.getElementById('reader-button').addEventListener('click', () => api.command('reader'));
document.getElementById('capture-button').addEventListener('click', () => api.command('capture'));
document.getElementById('pdf-button').addEventListener('click', () => api.command('pdf'));
document.getElementById('mini-button').addEventListener('click', () => api.command('mini-window'));
document.getElementById('translate-button').addEventListener('click', () => api.command('translate'));

addressForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = addressInput.value.trim();
  if (value) api.navigate(value);
  addressInput.blur();
});
addressInput.addEventListener('focus', () => {
  addressHasFocus = true;
  addressInput.select();
});
addressInput.addEventListener('blur', () => {
  addressHasFocus = false;
  const active = currentState.tabs.find((tab) => tab.id === currentState.activeTabId);
  addressInput.value = active?.url || '';
});
clearAddressButton.addEventListener('click', () => {
  addressInput.value = '';
  addressInput.focus();
});


const commandBackdrop = document.getElementById('command-backdrop');
const commandInput = document.getElementById('command-input');
commandInput.addEventListener('input', () => { commandSelectedIndex = 0; renderCommandResults(commandInput.value); });
commandInput.addEventListener('keydown', async (event) => {
  const visible = [...document.querySelectorAll('.command-result')];
  if (event.key === 'ArrowDown') { event.preventDefault(); commandSelectedIndex = Math.min(commandSelectedIndex + 1, Math.max(0, visible.length - 1)); renderCommandResults(commandInput.value); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); commandSelectedIndex = Math.max(0, commandSelectedIndex - 1); renderCommandResults(commandInput.value); }
  else if (event.key === 'Enter') { event.preventDefault(); const filtered = commandItems.filter((item) => !commandInput.value.trim() || `${item.label} ${item.detail}`.toLowerCase().includes(commandInput.value.trim().toLowerCase())).slice(0, 40); if (filtered[commandSelectedIndex]) await runCommandItem(filtered[commandSelectedIndex]); }
  else if (event.key === 'Escape') { event.preventDefault(); closeCommandCenter(); }
});
commandBackdrop.addEventListener('pointerdown', (event) => { if (event.target === commandBackdrop) closeCommandCenter(); });

contextMenu.addEventListener('click', (event) => {
  const containerButton = event.target.closest('button[data-container-id]');
  if (containerButton && contextTabId) {
    api.moveTabToContainer(contextTabId, containerButton.dataset.containerId);
    contextMenu.hidden = true;
    return;
  }
  const button = event.target.closest('button[data-action]');
  if (!button || !contextTabId) return;
  if (button.dataset.action === 'manage-containers') { api.togglePanel('containers'); contextMenu.hidden = true; return; }
  api.tabAction(contextTabId, button.dataset.action);
  contextMenu.hidden = true;
});
document.addEventListener('pointerdown', (event) => {
  if (!contextMenu.contains(event.target)) contextMenu.hidden = true;
});
document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  const shortcuts = currentState.settings?.customShortcuts || { command: 'k', reader: 'r', capture: 's', split: 'd', downloads: 'j', history: 'h', notes: 'n', private: 'p' };
  if (modifier && !event.shiftKey && key === String(shortcuts.command || 'k').toLowerCase()) { event.preventDefault(); openCommandCenter(); return; }
  const customShiftActions = { reader: 'reader', capture: 'capture', split: 'split', downloads: 'downloads', history: 'history', notes: 'notes', private: 'new-private-tab' };
  if (modifier && event.shiftKey) {
    const match = Object.entries(customShiftActions).find(([shortcut, command]) => key === String(shortcuts[shortcut] || '').toLowerCase());
    if (match) {
      event.preventDefault();
      if (match[1] === 'new-private-tab') api.newPrivateTab();
      else if (['split','downloads','history','notes'].includes(match[1])) openPanel(match[1]);
      else api.command(match[1]);
      return;
    }
  }
  if (modifier && key === 'l') {
    event.preventDefault(); addressInput.focus(); addressInput.select();
  } else if (modifier && event.shiftKey && key === 'p') {
    event.preventDefault(); api.newPrivateTab();
  } else if (modifier && key === 'tab') {
    event.preventDefault();
    const index = currentState.tabs.findIndex((tab) => tab.id === currentState.activeTabId);
    const step = event.shiftKey ? -1 : 1;
    const nextIndex = currentState.tabs.length ? (index + step + currentState.tabs.length) % currentState.tabs.length : -1;
    if (nextIndex >= 0) api.switchTab(currentState.tabs[nextIndex].id);
  } else if (modifier && event.shiftKey && key === 't') {
    event.preventDefault(); api.reopenClosed();
  } else if (modifier && key === 't') {
    event.preventDefault(); api.newTab();
  } else if (modifier && key === 'w') {
    event.preventDefault(); if (currentState.activeTabId) api.closeTab(currentState.activeTabId);
  } else if (modifier && key === 'r') {
    event.preventDefault(); api.reload();
  } else if (modifier && event.shiftKey && key === 'b') {
    event.preventDefault(); openPanel('bookmarks');
  } else if (modifier && key === 'h') {
    event.preventDefault(); openPanel('history');
  } else if (modifier && key === 'j') {
    event.preventDefault(); openPanel('downloads');
  } else if (modifier && event.shiftKey && key === 'a') {
    event.preventDefault(); openPanel('ai');
  } else if (event.key === 'Escape' && !commandBackdrop.hidden) {
    closeCommandCenter();
  } else if (event.altKey && event.key === 'ArrowLeft') {
    event.preventDefault(); api.back();
  } else if (event.altKey && event.key === 'ArrowRight') {
    event.preventDefault(); api.forward();
  } else if (modifier && /^[1-8]$/.test(key)) {
    event.preventDefault();
    const tab = currentState.tabs[Number(key) - 1];
    if (tab) api.switchTab(tab.id);
  } else if (modifier && key === '9') {
    event.preventDefault();
    const tab = currentState.tabs.at(-1);
    if (tab) api.switchTab(tab.id);
  } else if (event.key === 'F12') {
    event.preventDefault(); api.command('developer-tools');
  } else if (key === 'escape') {
    contextMenu.hidden = true;
  }
});


const chromeHeader = document.querySelector('.browser-chrome');
chromeHeader.addEventListener('pointerdown', (event) => {
  if (currentState.settings?.mouseGestures === false || event.button !== 2 || event.target.closest('input, button, .address-form')) return;
  gestureStart = { x: event.clientX, y: event.clientY, moved: false };
  event.preventDefault();
});
chromeHeader.addEventListener('pointermove', (event) => {
  if (!gestureStart) return;
  if (Math.hypot(event.clientX - gestureStart.x, event.clientY - gestureStart.y) > 25) gestureStart.moved = true;
});
chromeHeader.addEventListener('pointerup', (event) => {
  if (!gestureStart) return;
  const dx = event.clientX - gestureStart.x; const dy = event.clientY - gestureStart.y;
  const start = gestureStart; gestureStart = null;
  if (!start.moved || Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
  if (Math.abs(dx) > Math.abs(dy)) runMouseGesture(dx < 0 ? 'left' : 'right');
  else runMouseGesture(dy < 0 ? 'up' : 'down');
  toast('Mouse gesture: ' + (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'Back' : 'Forward') : (dy < 0 ? 'New tab' : 'Close tab')));
});
chromeHeader.addEventListener('contextmenu', (event) => { if (gestureStart) event.preventDefault(); });

api.onState(render);
api.getState().then(render).catch((error) => console.error('Could not load browser state:', error));
