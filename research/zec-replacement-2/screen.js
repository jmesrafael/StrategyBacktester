// screen.js — MEXC tradfi perps (stocks, indices, metals, oil) through the three live bots, same gates and same
// portfolio test as ../zec-replacement/screen100.js (SOL+NEAR+ADA+GALA + candidate vs + ETH, same window).
//   node screen.js [session]   -> results.json + trades.json (+ console)
// Candles: MEXC tradfi perps trade 24/7 but the underlying only moves in market hours; by default closed hours are filled
// with flat candles at the last close (what the bot sees on MEXC: near-flat nights/weekends, the gap lands on the open).
// "session" = exchange-hours candles only (robustness check). Funding: MEXC history where it exists, its mean before that.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6'), Z = path.join(__dirname, '..', 'zec-replacement');
const { run, stats, COST } = require(path.join(H, 'engine.js'));
const { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));

const MODE = process.argv[2] === 'session' ? 'session' : 'fill';
const IV = 14400, NOW = Date.parse('2026-11-11T00:00:00Z') / 1000, YR = 365.25 * 86400, P0 = Date.UTC(2021, 9, 18) / 1000, SPAN_FROM = Date.UTC(2016, 11, 2) / 1000;
const BOTS = { 'BB-CORE': ['BBX', 0.5], 'I-CORE': ['P7', 0.25], 'T-CORE': ['P14', 0.25] };
const KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'], PICK = 'ETH';
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'fetch-meta.json'), 'utf8'));
const vol = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, 'ticker.json'), 'utf8')).data.map((t) => [t.symbol, +t.amount24]));
const by = (id) => S.find((s) => s.id === id);

function fill(rows) { // flat candles for closed 4h slots
  const out = []; for (const r of rows) { const t = Math.floor(r[0] / IV) * IV;
    if (out.length) { const p = out[out.length - 1]; for (let k = p[0] + IV; k < t; k += IV) out.push([k, p[4], p[4], p[4], p[4], 0]); if (t <= p[0]) continue; }
    out.push([t, r[1], r[2], r[3], r[4], r[5]]); }
  return out;
}
function loadTradfi(name) {
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'data4h', name + '.json'), 'utf8'));
  const R = MODE === 'fill' ? fill(rows) : rows;
  const B = R.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  let F = JSON.parse(fs.readFileSync(path.join(__dirname, 'funding', name + '.json'), 'utf8'));
  if (F.length) { const mean = F.reduce((a, r) => a + r[1], 0) / F.length, back = []; for (let t = F[0][0] - 28800; t > B[0].time; t -= 28800) back.push([t, mean]); F = [...back.reverse(), ...F]; }
  return { B, funding: F.length ? F : null };
}
function loadCrypto(coin) {
  const f10 = path.join(Z, 'data4h-10y', coin + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', coin + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(Z, 'funding', coin + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  return { B, funding: F.length ? F : null };
}
const curve = (tr) => { tr = [...tr].sort((a, b) => a.tExit - b.tExit); let e = 0, p = 0, d = 0; for (const t of tr) { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); } return { total: e, dd: d, rdd: d > 0 ? e / d : e > 0 ? 99 : 0 }; };
function roll12(tr, from) { let pos = 0, n = 0; for (let a = from; a + YR <= NOW; a += YR / 12) { const s = tr.filter((t) => t.tExit > a && t.tExit <= a + YR).reduce((x, t) => x + t.R, 0); n++; if (s > 0) pos++; } return n ? pos / n : null; }
function months(tr, from) { // % losing months (months with no closed trade = flat), from the first full month
  const M = {}; for (const t of tr) { const d = new Date(t.tExit * 1000), k = d.getUTCFullYear() * 12 + d.getUTCMonth(); M[k] = (M[k] || 0) + t.R; }
  const d0 = new Date(from * 1000), d1 = new Date(NOW * 1000), a = d0.getUTCFullYear() * 12 + d0.getUTCMonth() + 1, b = d1.getUTCFullYear() * 12 + d1.getUTCMonth() - 1;
  let lose = 0, n = 0; for (let k = a; k <= b; k++) { n++; if ((M[k] || 0) < 0) lose++; } return n ? lose / n : null;
}

const res = {}, triTrades = {}, botTrades = {};
const names = [...KEEP, PICK, ...Object.keys(meta).filter((n) => !meta[n].error)];
for (const c of names) {
  const crypto = KEEP.includes(c) || c === PICK, d = crypto ? loadCrypto(c) : loadTradfi(c);
  const { B, funding } = d; if (B.length < 600) { res[c] = { coin: c, skipped: 'too short: ' + B.length + ' bars' }; continue; }
  const ctx = makeCtx(B, '4h'), from = Math.max(SPAN_FROM, B[205].time), span = (NOW - from) / YR;
  const bbc = by('bb-core').build(ctx), built = { BBX: bbc, P7: by('i-core').build(ctx), P14: { ...bbc, stopL: null, stopS: null } };
  const r = { coin: c, kind: crypto ? 'crypto' : 'tradfi', sym: crypto ? null : meta[c].sym, src: crypto ? 'binance' : meta[c].src, mexcUsd: crypto ? null : vol[meta[c].sym] || 0,
    from: new Date(from * 1000).toISOString().slice(0, 10), span, bots: {}, cost2: 0 };
  const tri = [], mid = from + (NOW - from) / 2;
  for (const [bot, [p, w]] of Object.entries(BOTS)) {
    const tr = run(B, ctx.atr14, built[p], exitOf(p, ctx), funding, IV, COST).trades.filter((t) => t.t >= from), s = stats(tr);
    const yrs = {}; for (const t of tr) { const y = new Date(t.tExit * 1000).getUTCFullYear(); yrs[y] = (yrs[y] || 0) + t.R; }
    r.bots[bot] = { n: s.n, avgR: s.exp, pf: s.pf, win: s.win, total: s.total, perYear: s.total / span, dd: s.dd, loseMonths: months(tr, from), roll12: roll12(tr, from),
      h1: tr.filter((t) => t.tExit <= mid).reduce((x, t) => x + t.R, 0), h2: tr.filter((t) => t.tExit > mid).reduce((x, t) => x + t.R, 0), years: yrs };
    botTrades[c + '|' + bot] = tr.map((t) => ({ t: t.t, tExit: t.tExit, R: t.R, dir: t.dir }));
    for (const t of tr) tri.push({ tExit: t.tExit, R: t.R * w });
    r.cost2 += run(B, ctx.atr14, built[p], exitOf(p, ctx), funding, IV, { fee: COST.fee * 2, slip: COST.slip * 2 }).trades.filter((t) => t.t >= from).reduce((x, t) => x + t.R * w, 0);
  }
  triTrades[c] = tri;
  const cv = curve(tri), yrs = {}; for (const t of tri) { const y = new Date(t.tExit * 1000).getUTCFullYear(); yrs[y] = (yrs[y] || 0) + t.R; }
  r.tri = { ...cv, perYear: cv.total / span, firstHalf: tri.filter((t) => t.tExit <= mid).reduce((x, t) => x + t.R, 0), secondHalf: tri.filter((t) => t.tExit > mid).reduce((x, t) => x + t.R, 0),
    roll12: roll12(tri, from), loseMonths: months(tri, from), years: yrs, last12: tri.filter((t) => t.tExit > NOW - YR).reduce((x, t) => x + t.R, 0) };
  res[c] = r;
}

// monthly correlation of the candidate's TRI-CORE R with the keepers' combined R
function monthlySeries(tr, a, b) { const M = new Map(); for (let k = a; k <= b; k++) M.set(k, 0); for (const t of tr) { const d = new Date(t.tExit * 1000), k = d.getUTCFullYear() * 12 + d.getUTCMonth(); if (M.has(k)) M.set(k, M.get(k) + t.R); } return [...M.values()]; }
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy); };
const keepTr = KEEP.flatMap((c) => triTrades[c]);
for (const r of Object.values(res)) {
  if (r.skipped || KEEP.includes(r.coin)) continue;
  const w0 = Math.max(P0, Date.parse(r.from + 'T00:00:00Z') / 1000);
  const withC = curve([...keepTr, ...triTrades[r.coin]].filter((t) => t.tExit > w0)), withE = curve([...keepTr, ...triTrades[PICK]].filter((t) => t.tExit > w0)), keep = curve(keepTr.filter((t) => t.tExit > w0));
  const d0 = new Date(w0 * 1000), a = d0.getUTCFullYear() * 12 + d0.getUTCMonth() + 1, b = 2026 * 12 + 9;
  r.swap = { from: new Date(w0 * 1000).toISOString().slice(0, 10), years: (NOW - w0) / YR, keepers: keep, withCoin: withC, withETH: withE, dRdd: withC.rdd - withE.rdd, dTotal: withC.total - withE.total,
    corrKeep: corr(monthlySeries(triTrades[r.coin], a, b), monthlySeries(keepTr, a, b)), corrETH: r.coin === PICK ? 1 : corr(monthlySeries(triTrades[r.coin], a, b), monthlySeries(triTrades[PICK], a, b)) };
}
const GATES = {
  '2y': (r) => r.span >= 2, bots: (r) => Object.values(r.bots).every((b) => b.total > 0), halves: (r) => r.tri.firstHalf > 0 && r.tri.secondHalf > 0,
  roll12: (r) => r.tri.roll12 >= 0.75, cost2: (r) => r.cost2 > 0, mexc: (r) => r.kind === 'crypto' || r.mexcUsd >= 5e6,
};
for (const r of Object.values(res)) { if (r.skipped) continue; r.failed = Object.entries(GATES).filter(([, f]) => !f(r)).map(([g]) => g); r.passed = !r.failed.length; }
fs.writeFileSync(path.join(__dirname, `results-${MODE}.json`), JSON.stringify({ built: new Date().toISOString(), mode: MODE, gates: Object.keys(GATES), res }, null, 1));
fs.writeFileSync(path.join(__dirname, `trades-${MODE}.json`), JSON.stringify(botTrades));

const f = (v, d = 1) => (v == null ? '  -' : (v >= 0 ? '+' : '') + v.toFixed(d)), pc = (v) => (v == null ? ' - ' : Math.round(v * 100) + '%');
console.log(`MODE ${MODE}. Sorted by portfolio test (keepers + candidate vs keepers + ETH, same window).`);
console.log('name      yrs  from        R/yr    DD  ret/DD roll12 loseMo  1st/2nd half     2xcost  last12 | avgR BB/IC/TC        PF BB/IC/TC       loseMo BB/IC/TC | MEXC$/d | portfolio ret/DD cand vs ETH (keepers) corrKeep  gates');
const rows = Object.values(res).filter((r) => !r.skipped && !KEEP.includes(r.coin)).sort((a, b) => b.swap.dRdd - a.swap.dRdd);
for (const r of rows) {
  const b = Object.values(r.bots);
  console.log(`${r.coin.padEnd(8)} ${r.span.toFixed(1).padStart(4)}  ${r.from}  ${f(r.tri.perYear).padStart(5)} ${r.tri.dd.toFixed(1).padStart(5)}  ${r.tri.rdd.toFixed(2).padStart(5)}  ${pc(r.tri.roll12).padStart(4)}  ${pc(r.tri.loseMonths).padStart(4)}  ${f(r.tri.firstHalf).padStart(6)}/${f(r.tri.secondHalf).padStart(6)}  ${f(r.cost2).padStart(6)}  ${f(r.tri.last12).padStart(6)} | ${b.map((x) => f(x.avgR, 2)).join('/').padEnd(18)} ${b.map((x) => x.pf.toFixed(2)).join('/').padEnd(16)} ${b.map((x) => pc(x.loseMonths)).join('/').padEnd(13)} | ${r.kind === 'crypto' ? '   -   ' : ('$' + (r.mexcUsd / 1e6).toFixed(0) + 'M').padStart(6)} | ${r.swap.withCoin.rdd.toFixed(2).padStart(5)} vs ${r.swap.withETH.rdd.toFixed(2)} (${r.swap.keepers.rdd.toFixed(2)}) from ${r.swap.from}  ${r.swap.corrKeep.toFixed(2)}  ${r.passed ? 'PASS' : '[' + r.failed.join(',') + ']'}`);
}
for (const r of Object.values(res).filter((r) => r.skipped)) console.log(r.coin, r.skipped);
