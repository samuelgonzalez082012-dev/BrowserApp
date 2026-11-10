'use strict';
const params = new URLSearchParams(window.location.search);
const engine = params.get('engine') || 'brave';
const theme = params.get('theme') === 'light' ? 'light' : 'dark';
const accent = params.get('accent') || 'blue';
const preset = params.get('preset') || 'graphite';
const density = params.get('density') || 'comfortable';
const corners = params.get('corners') || 'soft';
const font = params.get('font') || 'system';
const customAccent = params.get('customAccent') || '';
const wallpaper = params.get('wallpaper') || '';
const greeting = (params.get('greeting') || 'What would you like to explore?').slice(0, 100);
const browserName = (params.get('browserName') || 'Minimal Browser').slice(0, 40);
const layout = ['cards','compact','focus'].includes(params.get('layout')) ? params.get('layout') : 'cards';
const wallpaperDim = Math.min(90, Math.max(20, Number(params.get('wallpaperDim') || 62)));
const showWorkspaceDashboard = params.get('showWorkspaceDashboard') !== 'false';
const showClock = params.get('showClock') !== 'false';
const showRecent = params.get('showRecent') !== 'false';
const showNotes = params.get('showNotes') !== 'false';
const showFavorites = params.get('showFavorites') !== 'false';
const showSessions = params.get('showSessions') !== 'false';
const background = ['default', 'aurora', 'midnight', 'sunset'].includes(params.get('background')) ? params.get('background') : 'default';
document.documentElement.dataset.theme = theme;
document.documentElement.dataset.accent = accent;
document.documentElement.dataset.background = background;
document.documentElement.dataset.preset = preset;
document.documentElement.dataset.density = density;
document.documentElement.dataset.corners = corners;
document.documentElement.dataset.font = font;
document.documentElement.dataset.layout = layout;
document.documentElement.style.setProperty('--wallpaper-dim', String(wallpaperDim / 100));
document.querySelector('h1').textContent = greeting;
document.querySelector('.home-footer span:first-child').textContent = browserName;
document.getElementById('workspace-section').hidden = !showWorkspaceDashboard;
if (/^#[0-9a-f]{6}$/i.test(customAccent)) document.documentElement.style.setProperty('--accent', customAccent);
if (wallpaper.startsWith('file:') || wallpaper.startsWith('https://')) { const dim = wallpaperDim / 100; document.body.style.backgroundImage = `linear-gradient(rgba(10,12,18,${dim}),rgba(10,12,18,${Math.min(.96, dim + .16)})),url("${wallpaper.replace(/["\\]/g, '')}")`; }
const clock = document.getElementById('newtab-clock');
if (!showClock) clock.hidden = true;
else { const updateClock = () => { const now = new Date(); clock.textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }; updateClock(); setInterval(updateClock, 30000); }
document.getElementById('saved-section').hidden = !showFavorites;
document.getElementById('recent-section').hidden = !showRecent;
document.getElementById('notes-section').hidden = !showNotes;

const searchEngines = {
  brave: (query) => `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
  google: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  duckduckgo: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  bing: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
};

function parseList(key) {
  try {
    const parsed = JSON.parse(params.get(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
function addShortcut(container, title, url, symbol) {
  const link = document.createElement('a');
  link.className = 'shortcut';
  link.href = url;
  const icon = document.createElement('span');
  icon.className = 'shortcut-icon';
  icon.textContent = symbol || (title || url).trim().charAt(0).toUpperCase();
  const label = document.createElement('span');
  label.className = 'shortcut-label';
  label.textContent = title || hostname(url);
  link.append(icon, label);
  container.appendChild(link);
}

const bookmarks = parseList('bookmarks');
const recents = parseList('recent');
const workspaces = parseList('workspaces');
const notes = parseList('notes');
const sessions = parseList('sessions');
const savedLinks = document.getElementById('saved-links');
const recentLinks = document.getElementById('recent-links');
const workspaceLinks = document.getElementById('workspace-links');
const noteLinks = document.getElementById('note-links');
const sessionLinks = document.getElementById('session-links');

if (bookmarks.length) {
  bookmarks.forEach((item) => addShortcut(savedLinks, item.title || hostname(item.url), item.url));
} else {
  const note = document.createElement('p');
  note.className = 'dashboard-empty';
  note.textContent = 'Bookmark a page to pin it here.';
  savedLinks.appendChild(note);
}

if (recents.length) {
  recents.forEach((item) => {
    const link = document.createElement('a');
    link.className = 'recent-item';
    link.href = item.url;
    const title = document.createElement('strong');
    title.textContent = item.title || hostname(item.url);
    const url = document.createElement('small');
    url.textContent = hostname(item.url);
    link.append(title, url);
    recentLinks.appendChild(link);
  });
} else {
  const note = document.createElement('p');
  note.className = 'dashboard-empty';
  note.textContent = 'Websites you visit will appear here.';
  recentLinks.appendChild(note);
}

notes.forEach((note) => {
  const card = document.createElement('article');
  card.className = 'note-shortcut';
  const title = document.createElement('strong');
  title.textContent = note.title || 'Quick note';
  const body = document.createElement('p');
  body.textContent = note.content || '';
  card.append(title, body);
  noteLinks.appendChild(card);
});
if (!notes.length) document.getElementById('notes-section').hidden = true;


sessions.forEach((session) => {
  const link = document.createElement('a');
  link.className = 'session-shortcut';
  link.href = `minimal-browser://session/${encodeURIComponent(session.id)}`;
  const title = document.createElement('strong');
  title.textContent = session.name || 'Saved session';
  const detail = document.createElement('small');
  detail.textContent = `${Number(session.count) || 0} tabs · ${session.savedAt ? new Date(session.savedAt).toLocaleDateString() : 'Saved'}`;
  link.append(title, detail);
  sessionLinks.appendChild(link);
});
if (!showSessions || !sessions.length) document.getElementById('sessions-section').hidden = true;

workspaces.forEach((workspace) => {
  const link = document.createElement('a');
  link.className = 'workspace-shortcut';
  link.href = `minimal-browser://workspace/${encodeURIComponent(workspace.id)}`;
  const dot = document.createElement('span');
  dot.className = 'workspace-dot';
  dot.style.background = workspace.color || 'var(--accent)';
  const label = document.createElement('span');
  label.textContent = workspace.name;
  link.append(dot, label);
  workspaceLinks.appendChild(link);
});

document.getElementById('newtab-search').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = document.getElementById('newtab-query').value.trim();
  if (!query) return;
  window.location.href = (searchEngines[engine] || searchEngines.google)(query);
});
