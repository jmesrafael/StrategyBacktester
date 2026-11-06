// push.js - the recorder's heartbeat to the dashboard: one small signed POST every few minutes, as the bot "recorder" (the dashboard only accepts heartbeats from it).
// Same signing as the bots (HMAC-SHA256 of "<timestamp>.<body>" with DASHBOARD_PUSH_SECRET, 5-minute clock window on the server). Off unless DASHBOARD_URL and the secret are set.
// It never queues: a heartbeat that cannot be sent is simply not sent, the next one replaces it. It can never throw into the recorder.
'use strict';
const crypto = require('crypto');

const enabled = () => !!(process.env.DASHBOARD_URL && process.env.DASHBOARD_PUSH_SECRET);
const sign = (secret, ts, body) => crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');

function heartbeatEvent(data, nowMs = Date.now()) {
  return { event_id: `rec|hb:${Math.floor(nowMs / 1000)}`, type: 'heartbeat', ts_ms: Math.round(nowMs), mode: 'paper', bot: 'recorder', data };
}

async function send(event, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!enabled()) return { ok: false, skipped: true };
  try {
    const body = JSON.stringify({ events: [event] }), url = String(process.env.DASHBOARD_URL).replace(/\/+$/, '') + '/api/ingest';
    const res = await fetchImpl(url, { method: 'POST', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', 'X-Lucidio-Timestamp': String(now), 'X-Lucidio-Signature': sign(process.env.DASHBOARD_PUSH_SECRET, now, body) }, body });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (e) { return { ok: false, error: e && e.name === 'TimeoutError' ? 'timeout' : (e && e.message) || 'error' }; }
}

module.exports = { enabled, sign, heartbeatEvent, send };
