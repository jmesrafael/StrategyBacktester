#!/usr/bin/env node
'use strict';
// event-record.js: no-AI, no-network recorder for the event watch.
// For every event in inputs/owner-tags.csv from --since on, it measures:
//   BTC (candle library, Binance 1h): open of the event hour, then % move at +1h / +4h / +24h / +72h, and the 24 h high and low.
//   Our live book (inputs/event-watch/ledger-hourly.csv, an hourly export of wallet_snapshots, three live wallets added up):
//     unrealized and equity just before the event hour, at the end of the event hour, +4 h, +24 h, and the equity low / high in 24 h.
//   Closed trades (inputs/event-watch/ledger-closed.csv) inside the event hour and the next 4 h.
// It also lists the upcoming events (hours to go) and says when each one can be recorded.
// Writes reports/event-watch-auto.md. Never edits the CSV or the hand-written notes.
//
// Usage (from intel):  node scripts/event-record.js [--since 2026-11-17] [--now 2026-11-24T06:00Z] [--days 21]
// Refresh the inputs first:  node ../candles/update.js --no-1m   and re-export the two ledger CSVs (inputs/event-watch/ledger-*.csv).
// The ledger export needs a read-only database key (see IMPLEMENTATION-STATUS.md); until it is set, it is done by hand through the Supabase MCP.
// Hour convention: "before" = last snapshot of the hour before the event hour; "event hour" = last snapshot of the event hour;
// +4 h = last snapshot of hour H+3; +24 h = last snapshot of hour H+23. BTC uses the OPEN of hour H, H+1, H+4, H+24, H+72.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const since = Date.parse(arg('since', '2026-11-17') + (arg('since', '2026-11-17').length === 10 ? 'T00:00:00Z' : ''));
const now = arg('now') ? Date.parse(arg('now')) : Date.now();
const days = +arg('days', 21);
const H = 3600e3;

function csv(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',');
  return lines.slice(1).map((l) => {
    const c = l.split(',');                                   // owner-tags.csv has no commas inside fields (9 columns); extra commas go to the last column
    const o = {}; head.forEach((h, i) => { o[h] = i === head.length - 1 ? c.slice(i).join(',') : c[i]; }); return o;
  });
}

// BTC
const candles = require(path.join(ROOT, '..', 'candles', 'candles.js'));
const bars = candles.load('BTC', '1h');                         // [openTimeSec, o, h, l, c, v]
const byHour = new Map(bars.map((b) => [b[0] * 1000, b]));
const lastBar = bars[bars.length - 1][0] * 1000;
const open = (t) => (byHour.has(t) ? byHour.get(t)[1] : null);

// Ledger
const led = new Map(csv(path.join(ROOT, 'inputs', 'event-watch', 'ledger-hourly.csv')).map((r) => [Date.parse(r.hour_utc + ':00:00Z'), { u: +r.unreal, e: +r.equity, n: +r.open }]));
const closed = csv(path.join(ROOT, 'inputs', 'event-watch', 'ledger-closed.csv')).map((r) => ({ t: Date.parse(r.closed_utc + ':00Z'), w: r.wallet, s: r.symbol.replace('_USDT', ''), usd: +r.realized_usd, r: r.r_result }));
const ledLast = Math.max(...led.keys());

const pct = (a, b) => (a == null || b == null ? null : (b / a - 1) * 100);
const f1 = (x) => (x == null ? 'pending' : (x >= 0 ? '+' : '') + x.toFixed(1) + '%');
const n1 = (x) => (x == null ? 'pending' : x.toFixed(1));
const dl = (a, b) => (a == null || b == null ? 'pending' : ((b - a >= 0 ? '+' : '') + (b - a).toFixed(1)));
const iso = (t) => new Date(t).toISOString().slice(5, 16).replace('T', ' ');

const events = csv(path.join(ROOT, 'inputs', 'owner-tags.csv'))
  .map((r) => ({ ...r, t: Date.parse(r.event_time_utc) }))
  .filter((r) => r.t && !isNaN(r.t))
  .sort((a, b) => a.t - b.t);

const past = events.filter((e) => e.t >= since && e.t <= now);
const upcoming = events.filter((e) => e.t > now && e.t <= now + days * 24 * H);

const rows = past.map((e) => {
  const h0 = Math.floor(e.t / H) * H;
  const ref = open(h0);
  const at = (k) => (h0 + k * H <= lastBar + H ? open(h0 + k * H) : null);   // an open is known once that hour has started
  let hi = null, lo = null;
  for (let k = 0; k < 24; k++) { const b = byHour.get(h0 + k * H); if (!b) continue; hi = Math.max(hi ?? -Infinity, b[2]); lo = Math.min(lo ?? Infinity, b[3]); }
  const complete24 = h0 + 24 * H <= lastBar + H;
  const L = (k) => led.get(h0 + k * H);                          // snapshot of hour H+k
  const before = L(-1), ev = L(0), p4 = L(3), p24 = L(23);
  let eMin = null, eMax = null;
  for (let k = 0; k < 24; k++) { const x = L(k); if (!x) continue; eMin = Math.min(eMin ?? Infinity, x.e); eMax = Math.max(eMax ?? -Infinity, x.e); }
  const cl = closed.filter((c) => c.t >= h0 && c.t < h0 + 4 * H);
  return { e, ref, m1: pct(ref, at(1)), m4: pct(ref, at(4)), m24: pct(ref, at(24)), m72: pct(ref, at(72)), up: pct(ref, hi), dn: pct(ref, lo), complete24, before, ev, l1: L(1), p4, p24, eMin, eMax, cl, hasLed: !!(before || ev) };
});

const out = [];
out.push('# Event watch, automatic record');
out.push('');
out.push(`Built ${new Date(now).toISOString().slice(0, 16)}Z by \`node scripts/event-record.js\` (no AI, no network). BTC library ends ${iso(lastBar)} UTC, ledger export ends ${iso(ledLast)} UTC (hour ${iso(ledLast)}).`);
out.push('Our book is SHORT only: BTC down = good for us. "Worst in event hour + 1 h" = the lower of the two hourly snapshots (end of event hour, end of next hour) minus the snapshot before the event hour. Events less than 24 h apart overlap, so read their +24 h columns together, not one by one. Equity includes closed trades; unrealized does not.');
out.push('');
out.push('## Past events (BTC from the candle library, our book from the ledger export)');
out.push('');
out.push('| Event (UTC) | Type | BTC at hour open | +1h | +4h | +24h | +72h | 24h high / low | Equity before | Worst in event hour + 1 h | Equity 4h / 24h later (vs before) | Equity low / high in 24h | Closed in event hour + 4 h |');
out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const { e } = r;
  const precNote = /date only|hour not known|hour unknown/i.test(e.time_precision) ? ' *(hour unknown)*' : '';
  const cl = r.cl.length ? r.cl.map((c) => `${c.w} ${c.s} ${c.usd >= 0 ? '+' : ''}${c.usd}${c.r ? ' (' + c.r + 'R)' : ''}`).join('; ') : 'none';
  const eq = (x) => (x ? x.e : null);
  out.push(`| ${iso(e.t)} ${e.tag}${precNote} | ${e.type}${e.direction ? ', ' + e.direction : ''} | ${r.ref ? Math.round(r.ref) : 'n/a'} | ${f1(r.m1)} | ${f1(r.m4)} | ${f1(r.m24)} | ${f1(r.m72)} | ${f1(r.up)} / ${f1(r.dn)}${r.complete24 ? '' : ' (so far)'} | ${r.hasLed ? n1(eq(r.before)) : 'no ledger data'} | ${r.hasLed ? dl(eq(r.before), r.ev && r.l1 ? Math.min(r.ev.e, r.l1.e) : eq(r.ev)) : '-'} | ${r.hasLed ? dl(eq(r.before), eq(r.p4)) + ' / ' + dl(eq(r.before), eq(r.p24)) : '-'} | ${r.eMin == null ? '-' : n1(r.eMin) + ' / ' + n1(r.eMax)} | ${cl} |`);
}
out.push('');
out.push('How to read: a row with "pending" means the +N h hour has not started yet in the data; run the script again later. "no ledger data" means the event is before the export starts. Direction in the CSV is still set by hand once the +24 h read is in.');
out.push('');
out.push('## Upcoming events (next ' + days + ' days, from owner-tags.csv)');
out.push('');
out.push('| When (UTC) | In | Event | Type | Record after |');
out.push('|---|---|---|---|---|');
for (const e of upcoming) {
  const hrs = (e.t - now) / H;
  const inTxt = hrs < 48 ? hrs.toFixed(1) + ' h' : (hrs / 24).toFixed(1) + ' d';
  out.push(`| ${iso(e.t)} | ${inTxt} | ${e.tag} | ${e.type} | ${iso(e.t + 25 * H)} (+24 h read) |`);
}
if (!upcoming.length) out.push('| none in range | | | | |');
out.push('');
const needs24 = rows.filter((r) => !r.complete24).map((r) => r.e.tag);
if (needs24.length) out.push(`Events still waiting for the +24 h read: ${needs24.join('; ')}.`);
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'event-watch-auto.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
