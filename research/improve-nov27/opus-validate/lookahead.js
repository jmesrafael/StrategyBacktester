// lookahead.js - no-repaint / no-look-ahead proof.
// For random cut-off moments, the data after the cut is (a) removed or (b) replaced by random junk. Everything an engine
// produced up to the cut (signals, orders, sizes, fills, exits, equity) must be identical to the run on the real data.
//   Part A: my causal engine (in process), 3 set-ups x NCUT cuts x 2 modes.
//   Part B: the research engines (replace-nov25/sim.js signals, trades, account; improve-nov27/engine.js account), in child processes.
// node lookahead.js [NCUT_A] [NCUT_B] > lookahead.out
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const X = require('./causal');
const NA = +process.argv[2] || 40, NB = +process.argv[3] || 12;
const TMP = process.env.LA_TMP || path.join(__dirname, '.la-tmp');
fs.mkdirSync(TMP, { recursive: true });
const rnd = X.rng(20261127);
const cuts = (n) => Array.from({ length: n }, () => Math.round(Date.UTC(2020, 5, 1) / 1000 + rnd() * (Date.UTC(2026, 10, 23) / 1000 - Date.UTC(2020, 5, 1) / 1000)) + (rnd() < 0.5 ? 0 : 0));
const res = { A: { checks: 0, mismatches: 0, runs: 0, examples: [] }, B: {} };

// ---------------- Part A ----------------
const SETUPS = { 'TRI live PHP1000': { mode: 'live' }, 'rule x1.11 live PHP1000': { mode: 'live', rule: X.RULE, K: 1.11 }, 'rule x1.00 flat': { mode: 'flat', rule: X.RULE, start: 1000 } };
for (const [name, o] of Object.entries(SETUPS)) {
  const fullLog = []; const full = X.run({ ...o, log: fullLog });
  const fullCurve = full.curve;
  for (const c of cuts(NA)) for (const mode of ['truncate', 'corrupt']) {
    const lg = []; const r = X.run({ ...o, log: lg, marketOpt: { cut: c, mode, seed: c % 9973 } });
    const a = fullLog.filter((s) => +s.slice(0, s.indexOf(' ')) <= c), b = lg.filter((s) => +s.slice(0, s.indexOf(' ')) <= c);
    let mm = a.length === b.length ? 0 : 1; const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) { mm++; if (res.A.examples.length < 5) res.A.examples.push({ name, c, mode, full: a[i], cut: b[i] }); }
    let cm = 0, cn = 0; for (let k = 0; k < fullCurve.length; k += 2) { if (fullCurve[k] > c) break; cn++; if (fullCurve[k + 1] !== r.curve[k + 1]) cm++; }
    res.A.checks += n + cn; res.A.mismatches += mm + cm; res.A.runs++;
  }
  console.log('A', name, 'events in full run', fullLog.length, 'checks so far', res.A.checks, 'mismatches', res.A.mismatches);
}

// ---------------- Part B ----------------
const child = (cut, mode, seed) => { const f = path.join(TMP, `la-${cut}-${mode}.json`); cp.execFileSync(process.execPath, ['--max-old-space-size=8192', path.join(__dirname, 'la-child.js'), String(cut), mode, String(seed), f], { stdio: 'inherit' }); const j = JSON.parse(fs.readFileSync(f)); fs.unlinkSync(f); return j; };
const ref = child('none', 'truncate', 1);
const H = 3600, T0 = X.T0;
const B = (k) => (res.B[k] = res.B[k] || { checks: 0, mismatches: 0, examples: [] });
for (const c of cuts(NB)) for (const mode of ['truncate', 'corrupt']) {
  const d = child(c, mode, c % 7919);
  // signals: every signal on a candle that closed by the cut
  for (const k of Object.keys(ref.signals)) {
    const a = ref.signals[k].filter((s) => s[0] <= c), b = d.signals[k].filter((s) => s[0] <= c), q = B('sim.js signals');
    const n = Math.max(a.length, b.length); q.checks += n;
    for (let i = 0; i < n; i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { q.mismatches++; if (q.examples.length < 3) q.examples.push({ k, c, mode, a: a[i], b: b[i] }); }
  }
  // trades closed by the cut
  for (const k of Object.keys(ref.trades)) {
    const a = ref.trades[k].filter((t) => t[1] <= c), b = d.trades[k].filter((t) => t[1] <= c), q = B('sim.js coinTrades (closed by the cut)');
    const n = Math.max(a.length, b.length); q.checks += n;
    for (let i = 0; i < n; i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { q.mismatches++; if (q.examples.length < 3) q.examples.push({ k, c, mode, a: a[i], b: b[i] }); }
  }
  { const q = B('sim.js account equity'), a = ref.simCurve.filter((p) => p[0] <= c), b = d.simCurve.filter((p) => p[0] <= c), n = Math.max(a.length, b.length); q.checks += n;
    for (let i = 0; i < n; i++) if (!b[i] || a[i][1] !== b[i][1]) { q.mismatches++; if (q.examples.length < 3) q.examples.push({ c, mode, t: a[i] && a[i][0], a: a[i] && a[i][1], b: b[i] && b[i][1] }); } }
  for (const n of ['tri', 'rule']) {
    const q = B(`improve-nov27 engine.js live account equity (${n})`), a = ref.impCurve[n], b = d.impCurve[n];
    let first = null, cnt = 0;
    for (let k = 0; k < a.length; k++) { const known = T0 + (k + 1) * H; if (known > c) break; cnt++; if (a[k] !== b[k]) { q.mismatches++; if (first === null) first = known; } }
    q.checks += cnt;
    if (first !== null) { q.firstDiffHoursBeforeCut = (q.firstDiffHoursBeforeCut || []).concat(Math.round((c - first) / H)); if (q.examples.length < 3) q.examples.push({ c, mode, firstDiff: new Date(first * 1e3).toISOString() }); }
  }
  console.log('B cut', new Date(c * 1e3).toISOString(), mode, JSON.stringify(Object.fromEntries(Object.entries(res.B).map(([k, v]) => [k, v.mismatches]))));
}
fs.writeFileSync(path.join(__dirname, 'lookahead.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
