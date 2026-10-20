// tune2h.js — fine-tune BB Breakout on the 2h chart for SOL / DOGE / ZEC, reported per coin.
// Protocol: TRAIN = trades entered 2021-01 → 2023-12 (tuning only), TEST = 2024-01 → 2026-10-20 (run once, never used to choose).
// Fees as on the user's MEXC account: SOL 0.05% per side, DOGE / ZEC 0%; 0.02% slippage per side on all. Binance 2h candles.
// Choice = plateau, not the single best cell: each setting's score is averaged with its immediate neighbours on every axis.
// Score per coin = train total R / (train max drawdown + 5); a setting's score = the WORST of the three coins (all must work).
// usage: node tune2h.js -> results-tune2h.md
const L = require('./lib.js'), F = require('./fam.js'), fs = require('fs');
const COINS = ['SOL', 'DOGE', 'ZEC'], FEE = { SOL: 0.0005, DOGE: 0, ZEC: 0, SNDK: 0.0004 }, SLIP = 0.0002, TF = 120;
const TR = [L.ts(2021), L.ts(2024)], TE = [L.ts(2024), L.ts(2100)], YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const AX = { n: [14, 20, 30, 40], k: [1.5, 2, 2.5, 3], trendN: [0, 100, 200, 400], tp: [2, 3, 4, 5], maxBars: [24, 48, 96, 0], stop: ['mid', 1.5, 2.5] };
const KEYS = Object.keys(AX);
const BASELINE = { n: 20, k: 2, trendN: 200, tp: 3, maxBars: 48, stop: 'mid' };
const run = (c, cfg, tf = TF) => { L.COST.comm = FEE[c]; L.COST.slip = SLIP; try { return F.sq(c, { tf, look: 100, pct: 1, recent: 10, trailATR: 0, beR: 0, ...cfg }); } finally { L.COST.comm = 0.0004; L.COST.slip = 0.0002; } };
const ddOf = (tr) => { let e = 0, pk = 0, dd = 0; for (const t of tr) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); } return dd; };
const sc = (tr) => L.sum(tr.map((t) => t.R)) / (ddOf(tr) + 5);
// ---- grid ----
const grid = []; const idx = new Map();
const rec = (i, cur) => { if (i === KEYS.length) { idx.set(KEYS.map((k) => cur[k]).join('|'), grid.length); grid.push({ cfg: { ...cur } }); return; } for (const v of AX[KEYS[i]]) rec(i + 1, { ...cur, [KEYS[i]]: v }); };
rec(0, {});
const t0 = Date.now();
for (const g of grid) {
  g.coin = {};
  for (const c of COINS) { const tr = run(c, g.cfg); g.coin[c] = { train: L.slice(tr, ...TR), test: L.slice(tr, ...TE), all: tr }; g.coin[c].s = sc(g.coin[c].train); }
  g.s = Math.min(...COINS.map((c) => g.coin[c].s));
}
// neighbour-smoothed score (plateau)
const neigh = (g, key) => { const out = [g]; for (const k of KEYS) { const vals = AX[k], j = vals.indexOf(g.cfg[k]); for (const d of [-1, 1]) { const v = vals[j + d]; if (v === undefined) continue; const h = grid[idx.get(KEYS.map((kk) => (kk === k ? v : g.cfg[kk])).join('|'))]; out.push(h); } } return out; };
for (const g of grid) { const ns = neigh(g); g.smooth = ns.reduce((a, h) => a + h.s, 0) / ns.length; for (const c of COINS) g.coin[c].smooth = ns.reduce((a, h) => a + h.coin[c].s, 0) / ns.length; }
const shared = grid.slice().sort((a, b) => b.smooth - a.smooth)[0];
const perCoin = Object.fromEntries(COINS.map((c) => [c, grid.slice().sort((a, b) => b.coin[c].smooth - a.coin[c].smooth)[0]]));
const base = grid[idx.get(KEYS.map((k) => BASELINE[k]).join('|'))];
// ---- report ----
const out = []; const P = (...a) => { for (const s of (a.length ? a : [''])) { out.push(s); console.log(s); } };
const f0 = (v) => (v >= 0 ? '+$' : '−$') + Math.abs(v).toFixed(2), cfgTxt = (c) => `BB ${c.n}/${c.k}, trend ${c.trendN || 'off'}, target ${c.tp}R, exit ${c.maxBars || 'none'}, stop ${c.stop === 'mid' ? 'middle band' : c.stop + '×ATR'}`;
const st = (tr) => { const s = L.stats(tr); return { n: s.n, usd: s.sum, avg: s.avg, dd: ddOf(tr), win: s.win, pf: s.pf }; };
P('# BB Breakout — fine-tuned for the 2h chart, per coin\n');
P(`MEXC fees (SOL 0.05%, DOGE / ZEC 0%) + 0.02% slippage per side, Binance 2h candles, $1 risk per trade (so $ = R). **TRAIN** 2021–2023 was used to choose; **TEST** 2024 → Oct 20 2026 was not. ${grid.length} settings tried (${((Date.now() - t0) / 1000).toFixed(0)} s). Funding not included.\n`);
P(`- **Baseline** (the 4h settings as-is): ${cfgTxt(BASELINE)}`);
P(`- **Tuned, one setting for all three coins** (best plateau where the WORST coin is still good): ${cfgTxt(shared.cfg)}`);
for (const c of COINS) P(`- **Tuned for ${c} only**: ${cfgTxt(perCoin[c].cfg)}`);
for (const c of COINS) {
  P(`\n## ${c}\n`);
  P('| Version | Train trades | Train $ | Train max DD | **Test trades** | **Test $** | **Test max DD** | Test avg R | Test win % |'); P('|---|---|---|---|---|---|---|---|---|');
  const h4 = run(c, BASELINE, 240), h4g = { coin: { [c]: { train: L.slice(h4, ...TR), test: L.slice(h4, ...TE), all: h4 } } };
  for (const [name, g] of [['2h baseline (4h settings on 2h)', base], ['2h tuned — shared setting', shared], [`2h tuned for ${c} only`, perCoin[c]], ['**4h as you have it now** (reference)', h4g]]) {
    const a = st(g.coin[c].train), b = st(g.coin[c].test);
    P(`| ${name} | ${a.n} | ${f0(a.usd)} | −$${a.dd.toFixed(2)} | ${b.n} | **${f0(b.usd)}** | **−$${b.dd.toFixed(2)}** | ${L.f2(b.avg)} | ${(b.win * 100).toFixed(0)}% |`);
  }
  P('', `**${c} year by year** ($1 risk; max drawdown inside the year in brackets)`, '', '| Year | 2h baseline | 2h tuned — shared | 2h tuned for ' + c + ' | 4h now |', '|---|---|---|---|---|');
  for (const y of YEARS) P(`| ${y}${y >= 2024 ? ' (test)' : ' (train)'} | ${[base, shared, perCoin[c], h4g].map((g) => { const t = L.slice(g.coin[c].all, L.ts(y), L.ts(y + 1)); return `${f0(L.sum(t.map((x) => x.R)))} (−$${ddOf(t).toFixed(1)})`; }).join(' | ')} |`);
}
// robustness of the shared choice: how its neighbours do on TEST
const ns = neigh(shared);
P('\n## Is the shared setting a plateau? Its neighbours (one step on any axis) on the TEST years\n');
P('| Coin | Neighbours positive on test | Median neighbour test $ | Shared setting test $ |'); P('|---|---|---|---|');
for (const c of COINS) { const v = ns.slice(1).map((h) => L.sum(h.coin[c].test.map((t) => t.R))).sort((a, b) => a - b); P(`| ${c} | ${v.filter((x) => x > 0).length} of ${v.length} | ${f0(v[Math.floor(v.length / 2)])} | ${f0(L.sum(shared.coin[c].test.map((t) => t.R)))} |`); }
P('\n## How many of all ' + grid.length + ' settings were profitable on TEST, per coin\n');
for (const c of COINS) { const v = grid.map((g) => L.sum(g.coin[c].test.map((t) => t.R))).sort((a, b) => a - b); P(`- ${c}: ${v.filter((x) => x > 0).length} of ${v.length} profitable on test; median ${f0(v[Math.floor(v.length / 2)])}`); }
P('', '## SNDK (SanDisk stock perpetual) — not used for tuning', '',
  'Binance SNDKUSDT 15m data only exists from 2026-04-07, so after the indicator warm-up there are about 5–6 months of trades. MEXC fees for SNDKSTOCK_USDT: 0.04% taker / 0.01% maker (0.04% used on both sides) + 0.02% slippage. **Far too little history to judge** — read this as a first look only. Note: the underlying stock only trades in US market hours, so the perpetual can gap at the US open and drift on weekends.', '',
  '| Version | Trades | $ ($1 risk) | Max DD | Avg R | Win % | First trade |', '|---|---|---|---|---|---|---|');
for (const [name, cfg, tf] of [['2h baseline (4h settings on 2h)', BASELINE, 120], ['2h tuned — shared setting', shared.cfg, 120], ['4h as you have it now', BASELINE, 240]]) {
  const t = run('SNDK', cfg, tf), s2 = st(t);
  P(`| ${name} | ${s2.n} | **${f0(s2.usd)}** | −$${s2.dd.toFixed(2)} | ${L.f2(s2.avg)} | ${(s2.win * 100).toFixed(0)}% | ${t.length ? new Date(t[0].t * 1000).toISOString().slice(0, 10) : '—'} |`);
}
{ // SNDK month by month for each version ($1 risk; trades in brackets)
  const vers = [['2h baseline', BASELINE, 120], ['2h tuned — shared', shared.cfg, 120], ['4h now', BASELINE, 240]];
  const per = vers.map(([, cfg, tf]) => { const m = {}; for (const x of run('SNDK', cfg, tf)) { const k = new Date(x.t * 1000).toISOString().slice(0, 7); (m[k] = m[k] || { R: 0, n: 0 }).R += x.R; m[k].n++; } return m; });
  const months = [...new Set(per.flatMap((m) => Object.keys(m)))].sort();
  P('', '**SNDK month by month** ($1 risk; trades in brackets)', '', '| Month | ' + vers.map((v) => v[0]).join(' | ') + ' |', '|---|' + vers.map(() => '---').join('|') + '|');
  for (const k of months) P(`| ${k} | ${per.map((m) => (m[k] ? `${f0(m[k].R)} (${m[k].n})` : '·')).join(' | ')} |`);
}
fs.writeFileSync(__dirname + '/results-tune2h.md', out.join('\n') + '\n');
