// keyinfo.js - the MEXC API key(s): which one is in use, when each one expires, what to tell the manager, and how a new reserve key is added.
// MEXC API keys can run out (90 days here), so mexc-keys.json may hold a PRIMARY key and a RESERVE key. The bot signs with the primary until MEXC rejects it as
// expired (or its recorded expiry day has started), then uses the reserve, with no restart. The watchdog uses this file to warn by Telegram before that day.
//
//   mexc-keys.json fields (all optional except apiKey / apiSecret):
//     apiKey, apiSecret, apiKeyCreated "2026-10-23", apiKeyExpires "2027-01-21"            the primary. Give the creation day, or the expiry day if MEXC shows it.
//     apiKeyIpBound true / reserveApiKeyIpBound true     the key is linked to this server's IP on MEXC: MEXC does not expire it, so no expiry day, no warnings
//     reserveApiKey, reserveApiSecret, reserveApiKeyCreated, reserveApiKeyExpires          the reserve (added with deploy/add-reserve-key.sh)
//     apiKeyLifetimeDays   90 (default): expiry = creation day + this, when no explicit expiry day is given
//
// An expiry day counts from the START of that day (UTC): a key is treated as expired from 00:00 UTC on its expiry day, so the bot moves to the reserve a little early
// rather than late (the exchange's own rejection moves it too, whichever comes first). Pure functions: no network, and no secret is ever returned by status() / alerts() / describe().
//   node keyinfo.js --status        the lines the menu's Health check shows (no secrets)
'use strict';
const fs = require('fs'), path = require('path');

const DAY = 86400000, DEFAULT_LIFETIME_DAYS = 90, THRESHOLDS = [14, 7, 3, 1];
const ADD_CMD = 'sudo bash /opt/lucidio/deploy/add-reserve-key.sh';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseDay = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim()); if (!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return Number.isFinite(t) && new Date(t).getUTCMonth() === +m[2] - 1 ? t : null; };
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const fmtDay = (ms) => { const d = new Date(ms); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };   // Jan 21, 2027

// { expiresMs, expirySource } for one key: an explicit expiry day wins; else creation day + lifetime; else unknown
function expiryOf({ created, expires }, lifetimeDays = DEFAULT_LIFETIME_DAYS) {
  const e = parseDay(expires); if (e != null) return { expiresMs: e, expirySource: 'expiry day' };
  const c = parseDay(created); if (c != null) return { expiresMs: c + lifetimeDays * DAY, expirySource: `created + ${lifetimeDays} days` };
  return { expiresMs: null, expirySource: null };
}
// the keys in mexc-keys.json, primary first. Secrets are inside these objects (mexc.js signs with them): never print one.
function candidates(k) {
  k = k || {}; const out = [], life = +k.apiKeyLifetimeDays > 0 ? +k.apiKeyLifetimeDays : DEFAULT_LIFETIME_DAYS;
  const add = (label, key, secret, created, expires, bound) => { if (key && secret && !/your MEXC/i.test(String(key))) out.push({ label, apiKey: String(key).trim(), apiSecret: String(secret).trim(), ...(bound === true ? { expiresMs: null, expirySource: 'IP-bound', ipBound: true } : expiryOf({ created, expires }, life)) }); };
  add('primary', k.apiKey, k.apiSecret, k.apiKeyCreated, k.apiKeyExpires, k.apiKeyIpBound);
  add('reserve', k.reserveApiKey, k.reserveApiSecret, k.reserveApiKeyCreated, k.reserveApiKeyExpires, k.reserveApiKeyIpBound);
  return out;
}
const expired = (c, now) => c.expiresMs != null && now >= c.expiresMs;
const daysLeft = (c, now) => (c.expiresMs == null ? null : Math.ceil((c.expiresMs - now) / DAY));   // 90 = three months; 0 or less = expired
// the one in use right now: the first key whose expiry day has not started
const activeOf = (list, now) => list.find((c) => !expired(c, now)) || null;

// what a person is told: no secrets. -> [{ label, expires: 'Jan 21, 2027' | null, source, daysLeft, state: 'in use'|'standby'|'expired'|'no date', text }]
function status(k, now = Date.now()) {
  const list = candidates(k), act = activeOf(list, now);
  const rows = list.map((c) => {
    const left = daysLeft(c, now), isAct = c === act, st = expired(c, now) ? 'expired' : isAct ? 'in use' : 'standby';
    const when = c.ipBound ? 'linked to the server IP: does not expire' : c.expiresMs == null ? 'no date recorded (add apiKeyCreated to get warnings)' : expired(c, now) ? `EXPIRED ${fmtDay(c.expiresMs)}` : `expires ${fmtDay(c.expiresMs)} (in ${left} day${left === 1 ? '' : 's'})`;
    return { label: c.label, expires: c.expiresMs == null ? null : fmtDay(c.expiresMs), source: c.expirySource, daysLeft: left, state: c.expiresMs == null && !expired(c, now) ? (isAct ? 'in use' : 'standby') : st, noDate: c.expiresMs == null && !c.ipBound, ipBound: !!c.ipBound, text: `${c.label} key ${when} · ${st === 'expired' ? 'expired' : isAct ? 'IN USE' : 'standby'}` };
  });
  if (!list.some((c) => c.label === 'reserve')) rows.push({ label: 'reserve', expires: null, source: null, daysLeft: null, state: 'none', noDate: false, text: `reserve key: none attached (add one: ${ADD_CMD})` });
  return rows;
}
const describe = (k, now) => status(k, now).map((r) => r.text);

// Telegram warnings that are due now and not yet sent. sent = { id: timestamp } (what the watchdog has already delivered). -> [{ id, text }]
function alerts(k, now = Date.now(), sent = {}) {
  const list = candidates(k), out = [], act = activeOf(list, now);
  const push = (id, text) => { if (!sent[id]) out.push({ id, text }); };
  if (!list.length) return out;
  for (const c of list) {
    const others = list.filter((x) => x !== c), backup = others.find((x) => !expired(x, now) && (x.expiresMs == null || c.expiresMs == null || x.expiresMs > c.expiresMs));
    if (c.ipBound) continue;
    if (c.expiresMs == null) { push(`${c.label}:nodate`, `MEXC API ${c.label} key has no creation or expiry day recorded, so the bot cannot warn you before it runs out. Add apiKeyCreated ("YYYY-MM-DD") for it in mexc-keys.json, or run: ${ADD_CMD}`); continue; }
    const iso = isoDay(c.expiresMs), left = daysLeft(c, now), name = c.label === 'primary' ? 'primary' : 'reserve';
    if (expired(c, now)) {
      push(`${c.label}:${iso}:expired`, backup
        ? `MEXC API ${name} key EXPIRED on ${fmtDay(c.expiresMs)}. The bot is now using the ${backup.label} key${backup.expiresMs == null ? '' : ` (expires ${fmtDay(backup.expiresMs)})`}. Create the next key on MEXC and add it: ${ADD_CMD}`
        : `MEXC API ${name} key EXPIRED on ${fmtDay(c.expiresMs)} and there is no other valid key: the bot cannot read the account or place orders. Create a new key on MEXC (bound to this server's IP) and add it now: ${ADD_CMD}`);
      continue;
    }
    const t = [...THRESHOLDS].sort((a, b) => a - b).find((x) => x >= left);   // the tightest threshold we are inside
    if (t == null) continue;
    push(`${c.label}:${iso}:d${t}`, backup
      ? `MEXC API ${name} key expires ${fmtDay(c.expiresMs)} (in ${left} day${left === 1 ? '' : 's'}). The ${backup.label} key${backup.expiresMs == null ? '' : ` (expires ${fmtDay(backup.expiresMs)})`} is attached and takes over by itself. Create the next key on MEXC and add it as the new reserve: ${ADD_CMD}`
      : `MEXC API ${name} key expires ${fmtDay(c.expiresMs)} (in ${left} day${left === 1 ? '' : 's'}) and NO reserve key outlives it. Create a new key on MEXC (bound to this server's IP, trade permission, never withdraw) and add it now: ${ADD_CMD}. Without another key the bot cannot trade after that day.`);
  }
  if (!act) push(`allexpired:${isoDay(now)}`, `ALL MEXC API KEYS HAVE EXPIRED: the bot cannot read the account or place orders. Create a new key on MEXC and add it now: ${ADD_CMD}`);
  return out;
}

// the reserve is added so that the bot never has a gap: normally it REPLACES the reserve. When the primary has already expired (the reserve took over), the reserve is
// promoted to primary and the new key becomes the reserve. -> { keys, action }   input fields: apiKey, apiSecret, created ("YYYY-MM-DD"), expires (optional)
function addReserve(k, n, now = Date.now()) {
  k = { ...(k || {}) };
  if (!n || !n.apiKey || !n.apiSecret) throw new Error('give the API key AND its secret');
  if (!k.apiKey || !k.apiSecret) throw new Error('there is no primary key yet: add it first with deploy/make-keys.sh');
  const created = n.created ? n.created.trim() : isoDay(now), expires = n.expires ? n.expires.trim() : '', bound = n.ipBound === true;
  if (parseDay(created) == null) throw new Error('the creation day must look like 2026-10-23');
  if (parseDay(created) > now + DAY) throw new Error('the creation day is in the future');
  if (expires && parseDay(expires) == null) throw new Error('the expiry day must look like 2027-01-21');
  if (String(n.apiKey).trim() === String(k.apiKey).trim() || String(n.apiKey).trim() === String(k.reserveApiKey || '').trim()) throw new Error('that key is already in the file');
  const prim = candidates(k).find((c) => c.label === 'primary');
  let action = 'reserve key added';
  if (prim && expired(prim, now) && k.reserveApiKey && k.reserveApiSecret) {   // the reserve is carrying the bot: it becomes the primary
    k.apiKey = k.reserveApiKey; k.apiSecret = k.reserveApiSecret; k.apiKeyCreated = k.reserveApiKeyCreated; k.apiKeyExpires = k.reserveApiKeyExpires; k.apiKeyIpBound = k.reserveApiKeyIpBound;
    for (const f of ['apiKeyCreated', 'apiKeyExpires', 'apiKeyIpBound']) if (k[f] == null) delete k[f];
    action = 'the old reserve was promoted to primary and the new key is the reserve';
  }
  k.reserveApiKey = String(n.apiKey).trim(); k.reserveApiSecret = String(n.apiSecret).trim(); k.reserveApiKeyCreated = created;
  if (expires) k.reserveApiKeyExpires = expires; else delete k.reserveApiKeyExpires;
  if (bound) k.reserveApiKeyIpBound = true; else delete k.reserveApiKeyIpBound;
  return { keys: k, action };
}
const loadFile = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch { return {}; } };

module.exports = { DAY, DEFAULT_LIFETIME_DAYS, THRESHOLDS, ADD_CMD, parseDay, isoDay, fmtDay, expiryOf, candidates, expired, daysLeft, activeOf, status, describe, alerts, addReserve, loadFile };

if (require.main === module && process.argv.includes('--status')) {
  const file = process.env.LUCIDIO_KEYS || path.join(__dirname, 'mexc-keys.json'), k = loadFile(file);
  if (!candidates(k).length) console.log('MEXC API keys: none configured (paper mode needs none)');
  else { console.log('MEXC API keys:'); for (const t of describe(k)) console.log('  ' + t); }
}
