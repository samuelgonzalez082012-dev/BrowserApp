'use strict';

function normalizeLoopbackEndpoint(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { throw new Error('Enter a valid local model endpoint URL.'); }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['localhost','127.0.0.1','::1'].includes(hostname)) throw new Error('Local model endpoints must resolve to localhost or loopback IP addresses.');
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Local model endpoints must use HTTP or HTTPS.');
  if (url.username || url.password) throw new Error('Do not embed credentials in the local model endpoint URL.');
  return url.toString();
}
class LocalModelAdapter {
  constructor({ endpoint, model, timeoutMs = 45000 } = {}) {
    this.endpoint = normalizeLoopbackEndpoint(endpoint);
    this.model = String(model || '').trim().slice(0, 120);
    if (!this.model) throw new Error('A local model name is required.');
    this.timeoutMs = Math.min(120000, Math.max(1000, Number(timeoutMs) || 45000));
  }
  async complete(messages, fetchImpl = fetch) {
    if (!Array.isArray(messages) || !messages.length) throw new Error('At least one message is required.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetchImpl(this.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, temperature: 0.3 }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || payload?.message || 'Local model returned HTTP ' + response.status + '.');
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        const text = content.map((part) => part?.text || '').join('\n').trim();
        if (text) return text;
      }
      throw new Error('Local model returned an unexpected response format.');
    } finally { clearTimeout(timeout); }
  }
}
module.exports = { normalizeLoopbackEndpoint, LocalModelAdapter };
