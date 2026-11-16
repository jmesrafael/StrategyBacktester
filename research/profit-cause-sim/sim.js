// Profit-cause simulation (no AI): replays Oct 24 - Nov 15 2026 as if the recorder had been running.
// Inputs: trades.csv (bot_events entries/exits from the dashboard DB), candle library (Binance perps 1h),
// Pulse daily briefs (keyword-scored headlines, first-seen time), events.json (hand tags for dated events).
// Every measure at time T uses only data known at T (closed bars, headlines first seen before T).
const fs = require('fs');
const path = require('path');
const C = require('../../candles/candles.js');

const H = 3600, D = 86400;
const START = Date.UTC(2026, 9, 24) / 1000, END = Date.UTC(2026, 10, 16) / 1000;
const iso = (s, n = 16) => new Date(s * 1000).toISOString().slice(0, n).replace('T', ' ');
const day = s => new Date(s * 1000).toISOString().slice(0, 10);
const f = (x, d = 2) => (x >= 0 ? '+' : '') + x.toFixed(d);
const median = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

// ---------- trades ----------
const trades = fs.readFileSync(path.join(__dirname, 'trades.csv'), 'utf8').trim().split('\n').slice(1).map(l => {
  const [mode, bot, symbol, side, ems, entry, sl, xms, exit, r, reason] = l.split(',');
  return { mode, bot, coin: symbol.replace('_USDT', ''), side, t: ems / 1000, entry: +entry, sl: +sl,
    oneR: Math.abs(entry - sl), xt: xms ? xms / 1000 : null, r: r ? +r : null, reason: reason || 'open' };
});
const live = trades.filter(t => t.mode === 'live');

// ---------- candles ----------
const coins = [...new Set(trades.map(t => t.coin).concat('BTC'))];
const bars = {}, idx = {};
for (const c of coins) {
  bars[c] = C.load(c, '1h', { from: '2026-09-01' });
  idx[c] = new Map(bars[c].map((b, i) => [b[0], i]));
}
const lastClose = bars.BTC[bars.BTC.length - 1][0] + H;           // time the last stored bar closed
// price known at time T = close of the last bar that closed at or before T
const priceAt = (c, T) => { const i = idx[c].get(Math.floor(T / H) * H - H); return i == null ? null : bars[c][i][4]; };
const ret = (c, T, hours) => { const a = priceAt(c, T - hours * H), b = priceAt(c, T); return a && b ? (b / a - 1) * 100 : null; };

// ---------- 1. price-shock detector (BTC 1h): move >= 3x its normal size AND volume >= 2x normal ----------
const B = bars.BTC, shocks = [];
for (let i = 720; i < B.length; i++) {
  const closeT = B[i][0] + H; if (closeT < START - 3 * D) continue;
  const rets = [], vols = [];
  for (let j = i - 720; j < i; j++) { rets.push(Math.log(B[j][4] / B[j][1])); vols.push(B[j][5]); }
  const sd = Math.sqrt(rets.reduce((s, x) => s + x * x, 0) / rets.length);
  const r = Math.log(B[i][4] / B[i][1]), z = r / sd, vr = B[i][5] / median(vols);
  if (Math.abs(z) >= 3 && vr >= 2) shocks.push({ t: closeT, z, vr, pct: (B[i][4] / B[i][1] - 1) * 100 });
}

// ---------- 2. headlines (Pulse briefs, keyword scoring already done by Pulse, no AI) ----------
const briefDir = path.join(__dirname, '../../../crypto-news/data/briefs');
const heads = new Map();
for (const fn of fs.readdirSync(briefDir).filter(x => /^2026/.test(x))) {
  const b = JSON.parse(fs.readFileSync(path.join(briefDir, fn), 'utf8'));
  for (const h of b.highlights.concat(b.pinned || [])) {
    const p = heads.get(h.id);
    heads.set(h.id, { title: h.title, bias: h.bias, strength: h.strength, impact: !!h.impact, count: h.count,
      t: Math.min(h.firstSeen / 1000, p ? p.t : Infinity) });
  }
}
const headlines = [...heads.values()].sort((a, b) => a.t - b.t);
const newsFrom = headlines.length ? headlines[0].t : Infinity;
// mood in the 24h before T: bearish minus bullish, each weighted by strength/100. Market-impact stories only.
const mood = (T, impactOnly = true) => {
  if (T < newsFrom) return null;
  let m = 0;
  for (const h of headlines) if (h.t <= T && h.t > T - D && (!impactOnly || h.impact))
    m += (h.bias === 'LONG' ? 1 : h.bias === 'SHORT' ? -1 : 0) * h.strength / 100;
  return m;
};

// ---------- 3. hand tags (the "one-tap tag"), dated from public reports ----------
const tags = JSON.parse(fs.readFileSync(path.join(__dirname, 'events.json'), 'utf8')).map(e => ({ ...e, t: Date.parse(e.utc) / 1000 }));
const tagsBefore = (T, hours) => tags.filter(e => e.t <= T && e.t > T - hours * H).map(e => e.tag);

// ---------- 4. mark-to-market R for every live trade ----------
const dirOf = t => (t.side === 'SHORT' ? -1 : 1);
const rAt = (t, T) => {                       // R of the trade as known at time T
  if (T < t.t) return 0;
  if (t.xt && T >= t.xt) return t.r;
  const p = priceAt(t.coin, T); return p ? dirOf(t) * (p - t.entry) / t.oneR : 0;
};
for (const t of trades) { t.rNow = rAt(t, lastClose); t.done = t.r != null; }

// ---------- 5. daily journal ----------
const days = [];
for (let d0 = START; d0 < END; d0 += D) {
  const d1 = Math.min(d0 + D, lastClose);
  const pnl = live.reduce((s, t) => s + rAt(t, d1) - rAt(t, d0), 0);
  const realized = live.filter(t => t.xt >= d0 && t.xt < d1).reduce((s, t) => s + t.r, 0);
  const btc = ret('BTC', d1, 24), btc7 = ret('BTC', d1, 168);
  let hi = -Infinity, lo = Infinity; for (const b of B) if (b[0] >= d0 && b[0] < d1) { hi = Math.max(hi, b[2]); lo = Math.min(lo, b[3]); }
  const ranges = []; for (let k = 1; k <= 30; k++) { let h2 = -Infinity, l2 = Infinity; for (const b of B) if (b[0] >= d0 - k * D && b[0] < d0 - (k - 1) * D) { h2 = Math.max(h2, b[2]); l2 = Math.min(l2, b[3]); } ranges.push(h2 / l2 - 1); }
  const sh = shocks.filter(s => s.t > d0 && s.t <= d1);
  const m = mood(d1);
  days.push({ d: day(d0), pnl, realized, entries: live.filter(t => t.t >= d0 && t.t < d1).length,
    open: live.filter(t => t.t < d1 && (!t.xt || t.xt >= d1)).length,
    btc, btc7, phase: btc7 == null ? '?' : btc7 <= -4 ? 'down' : btc7 >= 4 ? 'up' : 'sideways',
    vol: (hi / lo - 1) / median(ranges), shocks: sh, mood: m,
    tags: tags.filter(e => e.t >= d0 && e.t < d1).map(e => e.tag) });
}
// streaks of 3+ days in the same direction
const streaks = []; let cur = null;
for (const x of days) {
  const s = x.pnl > 0.05 ? 'profit' : x.pnl < -0.05 ? 'loss' : 'flat';
  if (cur && cur.s === s) cur.days.push(x); else { if (cur && cur.days.length >= 3 && cur.s !== 'flat') streaks.push(cur); cur = { s, days: [x] }; }
}
if (cur && cur.days.length >= 3 && cur.s !== 'flat') streaks.push(cur);

// ---------- 6. entry clusters: 3+ entries inside 4 hours ----------
const clusters = []; const sorted = [...trades].sort((a, b) => a.t - b.t);
for (let i = 0; i < sorted.length;) {
  let j = i; while (j + 1 < sorted.length && sorted[j + 1].t - sorted[i].t <= 4 * H) j++;
  const g = sorted.slice(i, j + 1); if (g.length >= 3) clusters.push(g); i = j + 1;
}

// ---------- 7. stamp each live entry with what was known at entry ----------
for (const t of live) {
  t.btc24 = ret('BTC', t.t, 24); t.btc72 = ret('BTC', t.t, 72);
  t.shock72 = shocks.filter(s => s.t <= t.t && s.t > t.t - 72 * H);
  t.mood = mood(t.t); t.tags = tagsBefore(t.t, 72);
  const dn = t.shock72.some(s => s.z < 0), up = t.shock72.some(s => s.z > 0);
  t.ctx = dn && !up ? 'after down-shock' : up && !dn ? 'after up-shock' : dn && up ? 'after both' : 'quiet';
}

// ---------- report ----------
const out = [];
const P = s => out.push(s);
P('# Profit-cause simulation, Oct 24 to Nov 15 2026');
P('');
P(`Replay of the recorder idea on real trades. No AI used. Prices: Binance perps 1h, last closed bar ${iso(lastClose)} UTC.`);
P('Open trades are marked at that last price with their first stop as 1R, so their R is an estimate (the bots trade on MEXC).');
P('');
P('## 1. Live result so far');
P('');
P('| Bot | Closed trades | Closed R | Open trades | Open R now | Total R |'); P('|---|---|---|---|---|---|');
for (const b of ['bbcore', 'icore', 'tcore', 'ALL']) {
  const g = live.filter(t => b === 'ALL' || t.bot === b), c = g.filter(t => t.done), o = g.filter(t => !t.done);
  const cr = c.reduce((s, t) => s + t.r, 0), or = o.reduce((s, t) => s + t.rNow, 0);
  P(`| ${b} | ${c.length} (${c.filter(t => t.r > 0).length} won) | ${f(cr)} | ${o.length} | ${f(or)} | ${f(cr + or)} |`);
}
P('');
P('## 2. Price shocks the detector found (BTC, 1h move at least 3x normal with volume at least 2x normal)');
P('');
P('| Time (UTC) | BTC 1h move | Size vs normal | Volume vs normal | Hand tag within 24h before |'); P('|---|---|---|---|---|');
for (const s of shocks.filter(s => s.t >= START)) P(`| ${iso(s.t - H)} | ${f(s.pct)}% | ${Math.abs(s.z).toFixed(1)}x | ${s.vr.toFixed(1)}x | ${tagsBefore(s.t, 24).join('; ') || '-'} |`);
P('');
P('## 3. Hand-tagged events and what BTC did next');
P('');
P('| Event | Time (UTC) | BTC 24h after | BTC 72h after | Shock within 24h |'); P('|---|---|---|---|---|');
for (const e of tags) {
  const a = priceAt('BTC', e.t), r1 = priceAt('BTC', Math.min(e.t + 24 * H, lastClose)), r3 = priceAt('BTC', Math.min(e.t + 72 * H, lastClose));
  P(`| ${e.tag} | ${iso(e.t)} | ${f((r1 / a - 1) * 100)}% | ${f((r3 / a - 1) * 100)}% | ${shocks.some(s => s.t > e.t - 2 * H && s.t <= e.t + 24 * H) ? 'yes' : 'no'} |`);
}
P('');
P('## 4. Daily journal (live bots, mark-to-market)');
P('');
P('| Day | Day R | Open | New | BTC day | BTC 7d | Phase | Range vs normal | Shocks | News mood | Tag |'); P('|---|---|---|---|---|---|---|---|---|---|---|');
for (const x of days) P(`| ${x.d} | ${f(x.pnl)} | ${x.open} | ${x.entries} | ${f(x.btc, 1)}% | ${f(x.btc7, 1)}% | ${x.phase} | ${x.vol.toFixed(1)}x | ${x.shocks.map(s => (s.z < 0 ? 'down' : 'up')).join(',') || '-'} | ${x.mood == null ? 'no data' : f(x.mood, 1)} | ${x.tags.join('; ') || '-'} |`);
P('');
P('## 5. Streaks (3 or more days in a row)');
P('');
P('| Streak | Days | Total R | BTC over streak | Phase | Avg range vs normal | Shock days | Tags |'); P('|---|---|---|---|---|---|---|---|');
for (const s of streaks) {
  const a = s.days, b0 = Date.parse(a[0].d) / 1000, b1 = Math.min(Date.parse(a[a.length - 1].d) / 1000 + D, lastClose);
  P(`| ${s.s} | ${a[0].d} to ${a[a.length - 1].d} (${a.length}) | ${f(a.reduce((q, x) => q + x.pnl, 0))} | ${f((priceAt('BTC', b1) / priceAt('BTC', b0) - 1) * 100, 1)}% | ${[...new Set(a.map(x => x.phase))].join('/')} | ${(a.reduce((q, x) => q + x.vol, 0) / a.length).toFixed(1)}x | ${a.filter(x => x.shocks.length).length} | ${a.flatMap(x => x.tags).join('; ') || '-'} |`);
}
const grp = (label, key) => {
  P(''); P(`| ${label} | Days | Total R | Avg R per day | Profit days |`); P('|---|---|---|---|---|');
  const m = new Map(); for (const x of days) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  for (const [k, a] of m) { const tot = a.reduce((q, x) => q + x.pnl, 0); P(`| ${k} | ${a.length} | ${f(tot)} | ${f(tot / a.length)} | ${a.filter(x => x.pnl > 0.05).length} |`); }
};
P('');
P('## 6. What kind of day made or lost money');
grp('BTC 7-day phase', x => x.phase);
grp('Day range', x => (x.vol >= 1.5 ? 'wide (1.5x+)' : x.vol <= 0.75 ? 'narrow (0.75x or less)' : 'normal'));
grp('Price shock that day', x => (x.shocks.some(s => s.z < 0) ? 'down-shock' : x.shocks.length ? 'up-shock' : 'none'));
grp('Keyword news mood (from Nov 8)', x => (x.mood == null ? 'no data' : x.mood <= -2 ? 'bearish (-2 or lower)' : x.mood >= 2 ? 'bullish' : 'neutral (near 0)'));
P('');
P('## 7. Entry clusters (3 or more entries inside 4 hours, live and paper)');
P('');
P('| First entry (UTC) | Entries | Bots | Coins | Side | BTC 72h before | Shock 72h before | Tags 72h before | Live R (closed + open) | Live won / lost |'); P('|---|---|---|---|---|---|---|---|---|---|');
for (const g of clusters) {
  const T = g[0].t, lv = g.filter(t => t.mode === 'live'), sh = shocks.filter(s => s.t <= T && s.t > T - 72 * H);
  P(`| ${iso(T)} | ${g.length} | ${[...new Set(g.map(t => t.bot))].join(' ')} | ${[...new Set(g.map(t => t.coin))].join(' ')} | ${[...new Set(g.map(t => t.side))].join('/')} | ${f(ret('BTC', T, 72), 1)}% | ${sh.map(s => (s.z < 0 ? 'down' : 'up')).join(',') || '-'} | ${tagsBefore(T, 72).join('; ') || '-'} | ${f(lv.reduce((s, t) => s + t.rNow, 0))} | ${lv.filter(t => t.rNow > 0).length} / ${lv.filter(t => t.rNow <= 0).length} |`);
}
P('');
P('## 8. Every live entry, stamped with what was known at entry');
P('');
P('| Entry (UTC) | Bot | Coin | Side | BTC 24h | BTC 72h | Context | News mood | Tags 72h | Result R | State |'); P('|---|---|---|---|---|---|---|---|---|---|---|');
for (const t of live) P(`| ${iso(t.t)} | ${t.bot} | ${t.coin} | ${t.side} | ${f(t.btc24, 1)}% | ${f(t.btc72, 1)}% | ${t.ctx} | ${t.mood == null ? 'no data' : f(t.mood, 1)} | ${t.tags.join('; ') || '-'} | ${f(t.rNow)} | ${t.done ? t.reason : 'open'} |`);
const grpT = (label, key) => {
  P(''); P(`| ${label} | Entries | Total R | Avg R | Winners |`); P('|---|---|---|---|---|');
  const m = new Map(); for (const t of live) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  for (const [k, a] of m) { const tot = a.reduce((q, t) => q + t.rNow, 0); P(`| ${k} | ${a.length} | ${f(tot)} | ${f(tot / a.length)} | ${a.filter(t => t.rNow > 0).length} |`); }
};
P('');
P('## 9. Entries grouped by what was known at entry');
grpT('Shock in the 72h before entry', t => t.ctx);
grpT('BTC 72h before entry', t => (t.btc72 <= -3 ? 'falling (-3% or more)' : t.btc72 >= 3 ? 'rising (+3% or more)' : 'flat'));
grpT('Hand tag in the 72h before', t => (t.tags.length ? 'tagged event' : 'no tag'));
grpT('Keyword news mood at entry (from Nov 8)', t => (t.mood == null ? 'no data' : t.mood <= -2 ? 'bearish (-2 or lower)' : t.mood >= 2 ? 'bullish' : 'neutral (near 0)'));
P('');
P('## 10. Headlines Pulse saved (keyword-scored, market-impact flag only)');
P('');
P('| First seen (UTC) | Label | Strength | Stories | Headline |'); P('|---|---|---|---|---|');
for (const h of headlines.filter(h => h.impact)) P(`| ${iso(h.t)} | ${h.bias} | ${h.strength} | ${h.count} | ${h.title.replace(/\|/g, '/')} |`);

fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), out.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ lastClose, shocks, days, streaks: streaks.map(s => ({ s: s.s, days: s.days.map(x => x.d) })), live }, null, 1));
console.log(out.join('\n'));
