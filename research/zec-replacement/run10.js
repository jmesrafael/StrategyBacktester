// run10.js — 10-year run of the three live bots (same engine and costs as screen.js) on every coin with data from 2016,
// plus the bots' current five coins (SOL, ZEC, NEAR, ADA, GALA) on all the history they have.
//   node run10.js   -> results10.json (+ console)
// Window: trades entered from 2016-12-02 (ZEC's first date after the 205-candle warmup), so ~9.95 years for every 10-year coin.
// Data: data4h-10y/ (Poloniex 2016 -> Binance spot, fetch10.js) where it exists, else data4h/ (Binance spot). Funding: real Binance funding, zero before it.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6');
const { run, stats, COST } = require(path.join(H, 'engine.js'));
const { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));

const START = Date.UTC(2016, 11, 2) / 1000, IV = 14400, NOW = Date.now() / 1000;
const TEN = ['BTC', 'ETH', 'XRP', 'LTC', 'DASH', 'XMR', 'ETC', 'XLM', 'ZEC'], CURRENT = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const BOTS = { 'BB-CORE': ['BBX', 0.5], 'I-CORE': ['P7', 0.25], 'T-CORE': ['P14', 0.25] };
const YEARS = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const REGIMES = [['2017 bubble', '2016-12-02', '2018-01-01'], ['2018 bear', '2018-01-01', '2019-01-01'], ['2019 chop', '2019-01-01', '2020-01-01'], ['2020-21 bull', '2020-01-01', '2022-01-01'], ['2022 bear', '2022-01-01', '2023-01-01'], ['2023-24 recovery', '2023-01-01', '2025-01-01'], ['2025-26 late cycle', '2025-01-01', '2027-01-01']];
const ts = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
const U = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, 'universe.json'), 'utf8')).coins.map((c) => [c.coin, c]));
const LIQ = { ...Object.fromEntries(Object.entries(U).map(([k, v]) => [k, v.mexcUsd24h])), XMR: 3.6e6, SOL: null, NEAR: null, GALA: null };

function load(coin) {
  const f10 = path.join(__dirname, 'data4h-10y', coin + '.json'), f = fs.existsSync(f10) ? f10 : path.join(__dirname, 'data4h', coin + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(__dirname, 'funding', coin + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  return { B, funding: F.length ? F : null };
}
const by = (id) => S.find((s) => s.id === id);
function curve(tr) {
  tr = [...tr].sort((a, b) => a.tExit - b.tExit); let eq = 0, pk = 0, dd = 0, st = 0, ws = 0;
  for (const t of tr) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (t.R < 0) { st++; ws = Math.max(ws, st); } else st = 0; }
  const y = {}; for (const t of tr) { let k = new Date(t.tExit * 1000).getUTCFullYear(); if (k === 2016) k = 2017; y[k] = (y[k] || 0) + t.R; }
  return { total: eq, dd, years: y, streak: ws };
}

const out = { built: new Date().toISOString(), start: '2016-12-02', coins: {} };
for (const coin of [...new Set([...TEN, ...CURRENT])]) {
  const { B, funding } = load(coin), c = makeCtx(B, '4h');
  const from = Math.max(START, B[Math.min(205, B.length - 1)].time), span = (NOW - from) / (365.25 * 86400);
  const bbc = by('bb-core').build(c), built = { BBX: bbc, P7: by('i-core').build(c), P14: { ...bbc, stopL: null, stopS: null } };
  const r = { first: new Date(B[0].time * 1000).toISOString().slice(0, 10), scoredFrom: new Date(from * 1000).toISOString().slice(0, 10), span, tenYear: TEN.includes(coin), current: CURRENT.includes(coin), mexcUsd: LIQ[coin] ?? null, bots: {}, cost2: 0 };
  const tri = [];
  for (const [bot, [p, w]] of Object.entries(BOTS)) {
    const tr = run(B, c.atr14, built[p], exitOf(p, c), funding, IV, COST).trades.filter((t) => t.t >= from);
    const s = stats(tr), cv = curve(tr);
    r.bots[bot] = { n: s.n, avgR: s.exp, total: s.total, perYear: s.total / span, dd: s.dd, pf: s.pf, years: cv.years, yrsPos: Object.values(cv.years).filter((v) => v > 0).length, yrsN: Object.keys(cv.years).length, streak: cv.streak };
    for (const t of tr) tri.push({ tExit: t.tExit, R: t.R * w });
    r.cost2 += run(B, c.atr14, built[p], exitOf(p, c), funding, IV, { fee: COST.fee * 2, slip: COST.slip * 2 }).trades.filter((t) => t.t >= from).reduce((x, t) => x + t.R * w, 0);
  }
  const cv = curve(tri), yv = Object.entries(cv.years);
  const best = yv.sort((a, b) => b[1] - a[1])[0];
  r.tri = { total: cv.total, perYear: cv.total / span, dd: cv.dd, rdd: cv.total / cv.dd, years: cv.years, yrsPos: yv.filter(([, v]) => v > 0).length, yrsN: yv.length, worstYear: Math.min(...yv.map(([, v]) => v)), best, exBestPerYear: (cv.total - best[1]) / (span - 1),
    regimes: REGIMES.map(([n, a, b]) => ts(b) <= from ? null : tri.filter((t) => t.tExit > ts(a) && t.tExit <= ts(b)).reduce((x, t) => x + t.R, 0)),
    since2021: (() => { const x = tri.filter((t) => t.tExit > ts('2021-10-18')); let e = 0, p = 0, d = 0; for (const t of x.sort((a, b) => a.tExit - b.tExit)) { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); } return { total: e, dd: d }; })() };
  out.coins[coin] = r;
}
fs.writeFileSync(path.join(__dirname, 'results10.json'), JSON.stringify(out));

const f = (v, d = 1) => (v == null ? '   .' : (v >= 0 ? '+' : '') + v.toFixed(d));
const rows = Object.entries(out.coins).sort((a, b) => b[1].tri.rdd - a[1].tri.rdd);
console.log('A) TRI-CORE (50/25/25) — ranked by return / max drawdown');
console.log('coin  span  from        total  R/yr  DD    ret/DD  yrs+   no-best-yr R/yr  worst yr  2x-cost  MEXC$/d  BB avgR  IC avgR  TC avgR');
for (const [c, r] of rows) console.log(`${c.padEnd(5)} ${r.span.toFixed(1).padStart(4)}  ${r.scoredFrom}  ${f(r.tri.total).padStart(6)} ${f(r.tri.perYear).padStart(5)} ${r.tri.dd.toFixed(1).padStart(5)}  ${r.tri.rdd.toFixed(2).padStart(5)}  ${r.tri.yrsPos}/${r.tri.yrsN}   ${f(r.tri.exBestPerYear).padStart(6)} (no ${r.tri.best[0]})  ${f(r.tri.worstYear).padStart(6)}  ${f(r.cost2).padStart(6)}  ${r.mexcUsd == null ? '   (cur)' : ('$' + (r.mexcUsd / 1e6).toFixed(1) + 'M').padStart(8)}  ${f(r.bots['BB-CORE'].avgR, 2)}    ${f(r.bots['I-CORE'].avgR, 2)}    ${f(r.bots['T-CORE'].avgR, 2)}`);
console.log('\nB) TRI-CORE R by year');
console.log('coin  ' + YEARS.map((y) => y.padStart(6)).join(''));
for (const [c, r] of rows) console.log(c.padEnd(5) + ' ' + YEARS.map((y) => (r.tri.years[y] == null ? '     .' : f(r.tri.years[y]).padStart(6))).join(''));
console.log('\nC) by regime (TRI-CORE R): ' + REGIMES.map((x) => x[0]).join(' | '));
for (const [c, r] of rows) console.log(c.padEnd(5) + ' ' + r.tri.regimes.map((v) => f(v).padStart(7)).join(''));
console.log('\nD) each bot on its own — R per year / max DD / years positive');
for (const [c, r] of rows) console.log(c.padEnd(5) + ' ' + Object.entries(r.bots).map(([b, v]) => `${b} ${f(v.perYear).padStart(5)}/yr DD ${v.dd.toFixed(0).padStart(3)} ${v.yrsPos}/${v.yrsN}`).join('   '));
console.log('\nE) same window for everyone (since 2021-10-18, when GALA starts): TRI-CORE total / DD');
for (const [c, r] of [...rows].sort((a, b) => b[1].tri.since2021.total / b[1].tri.since2021.dd - a[1].tri.since2021.total / a[1].tri.since2021.dd)) console.log(`${c.padEnd(5)} ${f(r.tri.since2021.total).padStart(6)}  DD ${r.tri.since2021.dd.toFixed(1).padStart(5)}  ret/DD ${(r.tri.since2021.total / r.tri.since2021.dd).toFixed(2)}`);
