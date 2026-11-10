'use strict';

const $ = (id) => document.getElementById(id);
const address = $('address');
const notice = $('notice');

function setState(state) {
  $('status-dot').classList.toggle('ready', Boolean(state.connected));
  $('status-text').textContent = state.connected ? (state.loading ? 'Firefox loading' : 'Firefox connected') : 'Firefox unavailable';
  if (state.url && document.activeElement !== address) address.value = state.url;
  $('back').disabled = !state.connected;
  $('forward').disabled = !state.connected;
  $('reload').disabled = !state.connected;
  if (state.error) notice.textContent = state.error;
  else if (state.message) notice.textContent = state.message;
  else if (state.connected) notice.textContent = '';
  else notice.textContent = 'The Firefox runtime could not be attached. See the console for the startup error.';
}

$('address-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = await window.firefoxPoc.navigate(address.value);
  if (!result.ok) notice.textContent = result.error;
});
$('back').addEventListener('click', () => window.firefoxPoc.back());
$('forward').addEventListener('click', () => window.firefoxPoc.forward());
$('reload').addEventListener('click', () => window.firefoxPoc.reload());
document.querySelector('.content').addEventListener('mousedown', () => window.firefoxPoc.focus());

window.firefoxPoc.onState(setState);
window.firefoxPoc.getState().then(setState).catch((error) => { notice.textContent = error.message; });
