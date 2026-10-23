// deploy/paper-report.js - turns state/runs.jsonl into the paper-mode PASS/FAIL table of DEPLOY.md (the machine-checkable rows).
//   node deploy/paper-report.js [--days 14]        (on the VPS: sudo -u lucidio node /opt/lucidio/deploy/paper-report.js)
// Read-only. Exit code 1 if any row FAILS. Needs >= 14 days / 80 runs to count as a verdict; fewer = "too early" (still printed).
'use strict';
const fs = require('fs'), path = require('path');
const STATE_DIR = process.env.LUCIDIO_STATE_DIR || path.join(__dirname, '..', 'state'), IV = 14400;
const di = process.argv.indexOf('--days'), DAYS = di > 0 ? Number(process.argv[di + 1]) : 14;

let runs = [];
try { runs = fs.readFileSync(path.join(STATE_DIR, 'runs.jsonl'), 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch {}
if (!runs.length) { console.log(`no runs recorded in ${STATE_DIR}/runs.jsonl yet`); process.exit(1); }
const since = Date.now() - DAYS * 86400000, R = runs.filter((r) => Date.parse(r.ts) >= since);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };

// first run per (coin, candle): the real wake-up of that candle (later runs are retries)
const first = {};
for (const r of R) for (const [coin, c] of Object.entries(r.coins || {})) if (c.lastClosed != null && c.lagSec != null) { const k = coin + ':' + c.lastClosed; if (!first[k]) first[k] = { coin, t: c.lastClosed, lag: c.lagSec }; }
const obs = Object.values(first), lags = obs.map((o) => o.lag);
let missing = 0; const byCoin = {};
for (const o of obs) (byCoin[o.coin] = byCoin[o.coin] || []).push(o.t);
for (const ts of Object.values(byCoin)) { ts.sort((a, b) => a - b); missing += Math.max(0, (ts[ts.length - 1] - ts[0]) / IV + 1 - ts.length); }
const errRuns = R.filter((r) => (r.errors || []).length).length, staleRuns = R.filter((r) => (r.stale || []).length).length;
const drift = R.map((r) => Math.abs(r.clockDriftMs)).filter(Number.isFinite), dur = R.map((r) => r.durationMs).filter(Number.isFinite);
const spanDays = (Date.parse(R[R.length - 1].ts) - Date.parse(R[0].ts)) / 86400000;
const slow10 = lags.filter((x) => x > 10).length;

const rows = [];
const row = (id, what, pass, detail) => rows.push({ id, what, pass, detail });
row('P1', 'no 4h candle without a run', missing === 0, `${missing} missing of ${obs.length} candle observations`);
row('P2', 'wake lag <= 10 s (at most 1% above)', slow10 <= Math.max(1, Math.floor(obs.length * 0.01)), `${slow10}/${obs.length} above 10 s, median ${pct(lags, 0.5)} s, p95 ${pct(lags, 0.95)} s`);
row('P3', 'wake lag never > 120 s (the entry window is 900 s)', lags.every((x) => x <= 120), `max ${Math.max(0, ...lags)} s, ${lags.filter((x) => x > 900).length} run(s) beyond the 900 s entry window`);
row('P4', 'no run with errors, no stale candle', errRuns === 0 && staleRuns === 0, `${errRuns} run(s) with errors, ${staleRuns} with a missing candle, of ${R.length}`);
row('P5', 'VPS clock vs MEXC: p95 <= 500 ms, max <= 2000 ms', pct(drift, 0.95) <= 500 && Math.max(0, ...drift) <= 2000, `p95 ${pct(drift, 0.95)} ms, max ${Math.max(0, ...drift)} ms (a long ping widens this estimate)`);
row('P6', 'run duration p95 <= 15 s', pct(dur, 0.95) <= 15000, `p95 ${pct(dur, 0.95)} ms, max ${Math.max(0, ...dur)} ms`);

console.log(`Lucid'io paper report - last ${DAYS} days: ${R.length} runs over ${spanDays.toFixed(1)} days (${STATE_DIR})\n`);
for (const x of rows) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.id}  ${x.what.padEnd(52)} ${x.detail}`);
const early = spanDays < DAYS - 1 || R.length < 80;
console.log(`\n${early ? `TOO EARLY for a verdict: ${spanDays.toFixed(1)} days / ${R.length} runs (need ${DAYS} days and >= 80 runs). ` : ''}${rows.every((x) => x.pass) ? 'All automatic rows pass.' : 'At least one row FAILS.'} The manual rows (alerts, restart, reboot, memory) are in DEPLOY.md.`);
process.exitCode = rows.every((x) => x.pass) ? 0 : 1;
