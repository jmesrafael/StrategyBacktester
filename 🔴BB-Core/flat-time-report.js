// flat-time-report.js: how often is the account FLAT (no open position)? Read-only: it runs the bot's own backtest (lucidio-core.js, unchanged) and
// measures the gaps between trades. The ledger can only Update Pool (and accept joiners) while the account is flat, so this says how long the manager waits.
//   node flat-time-report.js [SOL,ZEC] [2025-01-10T02:00:00Z] [--json out.json]
// "Flat" is measured on the trade timeline: a position is open from the entry time to the exit time of its trade.
// Per coin = that coin has no open position. Both = neither coin has one (this is what Update Pool needs: the bot can hold two coins at once).
'use strict';
const fs = require('fs'), path = require('path');
const { backtest } = require('./lucidio-core.js');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--')), jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const [coinArg = 'SOL,ZEC', startArg = '2025-01-10T02:00:00Z'] = args;
const START = Date.parse(startArg) / 1000, IV = 14400, DATA = path.join(__dirname, 'data');
function loadFunding(coin) {
  const read = (c) => { const f = path.join(DATA, 'funding', c + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const own = read(coin);
  if (!coin.startsWith('MEXC_')) return own;
  const bin = read(coin.slice(5));
  if (!own || !own.length) return bin;
  return bin ? [...bin.filter((x) => x[0] < own[0][0]), ...own] : own;
}
const trades = [], bounds = {};
let W1 = 0;
for (const coin of coinArg.split(',')) {
  const B = JSON.parse(fs.readFileSync(path.join(DATA, coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const r = backtest(B, {}, loadFunding(coin));
  for (const t of r.trades) if (t.t >= START) trades.push({ coin, t: t.t, e: t.tExit, R: t.R });
  if (r.open && r.open.t >= START) trades.push({ coin, t: r.open.t, e: B[B.length - 1].time + IV, open: true });   // still open at the end of the data
  W1 = Math.max(W1, B[B.length - 1].time + IV);
  bounds[coin] = [B[0].time, B[B.length - 1].time + IV];
}
const W0 = START;
const merge = (iv) => { const s = iv.map((x) => [Math.max(x[0], W0), Math.min(x[1], W1)]).filter((x) => x[1] > x[0]).sort((a, b) => a[0] - b[0]), out = []; for (const x of s) { const l = out[out.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else out.push([...x]); } return out; };
const H = 3600, D = 86400;
const fmt = (s) => (s == null ? '-' : s >= 2 * D ? (s / D).toFixed(1) + ' d' : s >= H ? (s / H).toFixed(1) + ' h' : Math.round(s / 60) + ' min');
const pct = (a, b) => (100 * a / b).toFixed(1) + '%';
const q = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

function analyse(label, busyRaw) {
  const busy = merge(busyRaw), span = W1 - W0;
  const busyTime = busy.reduce((a, x) => a + (x[1] - x[0]), 0);
  // flat gaps between busy stretches (including before the first and after the last)
  const gaps = []; let cur = W0;
  for (const x of busy) { if (x[0] > cur) gaps.push([cur, x[0]]); cur = x[1]; }
  if (cur < W1) gaps.push([cur, W1]);
  const gapLen = gaps.map((g) => g[1] - g[0]), stretch = busy.map((x) => x[1] - x[0]);
  // a manager who wants to act at a random moment: wait = 0 if flat, else the time until the current stretch ends. Integrated exactly:
  // inside a busy stretch of length L the wait falls from L to 0, so it contributes L^2/2 to the integral of the wait over time
  const integral = stretch.reduce((a, L) => a + L * L / 2, 0), meanWait = integral / span;
  const sortedS = [...stretch].sort((a, b) => a - b);
  // percentiles of the wait over random moments: P(wait > w) = (sum over stretches of max(0, L - w)) / span
  const waitPct = (p) => { let lo = 0, hi = Math.max(0, ...stretch); for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2, tail = stretch.reduce((a, L) => a + Math.max(0, L - mid), 0) / span; if (tail > 1 - p) lo = mid; else hi = mid; } return hi; };
  // weeks: how many 7-day windows contain a flat gap of at least 4 h / 24 h (a window to act in)
  const weeks = []; for (let t = W0; t + 7 * D <= W1; t += 7 * D) {
    let best = 0; for (const g of gaps) { const a = Math.max(g[0], t), b = Math.min(g[1], t + 7 * D); if (b > a) best = Math.max(best, b - a); } weeks.push(best);
  }
  return { label, flat_pct: +(100 * (1 - busyTime / span)).toFixed(1), positions_stretches: busy.length,
    longest_open_stretch_s: Math.max(0, ...stretch), median_open_stretch_s: q(stretch, 0.5), flat_gaps: gaps.length, median_flat_gap_s: q(gapLen, 0.5), longest_flat_gap_s: Math.max(0, ...gapLen),
    mean_wait_s: meanWait, wait_p50_s: waitPct(0.5), wait_p90_s: waitPct(0.9), wait_p99_s: waitPct(0.99), worst_wait_s: Math.max(0, ...stretch),
    weeks: weeks.length, weeks_with_4h_flat_pct: +(100 * weeks.filter((x) => x >= 4 * H).length / (weeks.length || 1)).toFixed(0), weeks_with_24h_flat_pct: +(100 * weeks.filter((x) => x >= D).length / (weeks.length || 1)).toFixed(0),
    median_longest_flat_in_week_s: q(weeks, 0.5) };
}
// If the manager PAUSES new entries (the existing kill switch, no code change) at a random moment, the wait is only until the positions that are
// open right now close. Sampled hourly. The trades a pause would have skipped are counted too (rough: skipping one changes what the bot sees afterwards).
function drain() {
  const waits = [], skipped = [], skippedR = [];
  for (let t = W0; t < W1; t += H) {
    const open = trades.filter((x) => x.t <= t && x.e > t), w = open.length ? Math.max(...open.map((x) => x.e)) - t : 0;
    waits.push(w); const sk = trades.filter((x) => x.t > t && x.t <= t + w); skipped.push(sk.length); skippedR.push(sk.reduce((a, x) => a + (x.R || 0), 0));
  }
  const nz = waits.filter((x) => x > 0), avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  return { mean_s: avg(waits), p50_s: q(waits, 0.5), p90_s: q(waits, 0.9), p99_s: q(waits, 0.99), worst_s: Math.max(0, ...waits), mean_when_open_s: avg(nz), share_flat_pct: +(100 * (1 - nz.length / waits.length)).toFixed(1),
    skipped_mean: avg(skipped), skipped_mean_when_open: avg(skipped.filter((_, i) => waits[i] > 0)), skipped_R_mean_when_open: avg(skippedR.filter((_, i) => waits[i] > 0)) };
}
const dr = drain();
const out = [];
for (const coin of coinArg.split(',')) out.push(analyse(coin, trades.filter((t) => t.coin === coin).map((t) => [t.t, t.e])));
out.push(analyse('BOTH (no position in any coin)', trades.map((t) => [t.t, t.e])));
const span = W1 - W0;
console.log(`Backtest window: ${new Date(W0 * 1000).toISOString().slice(0, 10)} to ${new Date(W1 * 1000).toISOString().slice(0, 10)} (${(span / D).toFixed(0)} days), ${trades.length} trades (${trades.filter((t) => t.open).length} still open at the end of the data)\n`);
const rows = [
  ['Flat (no open position) % of time', (r) => r.flat_pct + '%'], ['Open stretches', (r) => r.positions_stretches], ['Longest open stretch', (r) => fmt(r.longest_open_stretch_s)],
  ['Median open stretch', (r) => fmt(r.median_open_stretch_s)], ['Flat windows', (r) => r.flat_gaps], ['Median flat window', (r) => fmt(r.median_flat_gap_s)], ['Longest flat window', (r) => fmt(r.longest_flat_gap_s)],
  ['Wait for flat, if you act at a random moment: average', (r) => fmt(r.mean_wait_s)], ['  median (50% of moments wait no longer than)', (r) => fmt(r.wait_p50_s)], ['  90% of moments', (r) => fmt(r.wait_p90_s)],
  ['  99% of moments', (r) => fmt(r.wait_p99_s)], ['  worst case', (r) => fmt(r.worst_wait_s)],
  [`Weeks with a flat window of 4 h or more`, (r) => r.weeks_with_4h_flat_pct + '%'], [`Weeks with a flat window of 24 h or more`, (r) => r.weeks_with_24h_flat_pct + '%'],
];
const w0 = Math.max(...rows.map((r) => r[0].length));
console.log('metric'.padEnd(w0), '|', out.map((o) => o.label.slice(0, 32).padEnd(32)).join(' | '));
for (const [name, f] of rows) console.log(name.padEnd(w0), '|', out.map((o) => String(f(o)).padEnd(32)).join(' | '));
console.log(`
If you PAUSE new entries first (kill switch) and wait only for the open positions to close:`);
console.log(`  wait at a random moment: average ${fmt(dr.mean_s)}, median ${fmt(dr.p50_s)}, 90% ${fmt(dr.p90_s)}, 99% ${fmt(dr.p99_s)}, worst ${fmt(dr.worst_s)}  (already flat ${dr.share_flat_pct}% of the time)`);
console.log(`  when a position is open the pause lasts ${fmt(dr.mean_when_open_s)} on average, and about ${dr.skipped_mean_when_open.toFixed(2)} entries would be missed (their summed backtest result averages ${dr.skipped_R_mean_when_open.toFixed(2)}R, rough)`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ window: [W0, W1], results: out, drain: dr }, null, 1));
