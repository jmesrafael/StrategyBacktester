// screen100.js — top-100 screen with the three live bots (engine = the bots' own cores, parity.js), every coin on all its 4h history (up to 10 years),
// then the deciding test: SOL+NEAR+ADA+GALA + coin vs SOL+NEAR+ADA+GALA + ETH (the current pick) over the SAME period.
//   node screen100.js  -> results100.json (+ console)
// Gates (fixed before results): >= 2 years scored; all three bots positive; both halves of the coin's history positive (TRI-CORE);
// >= 75% of rolling 12-month windows positive; positive at double costs; MEXC futures >= $5M/day.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6');
const { run, stats, COST } = require(path.join(H, 'engine.js'));
const { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));

const IV = 14400, NOW = Date.now() / 1000, YR = 365.25 * 86400, START10 = Date.UTC(2016, 11, 2) / 1000, P0 = Date.UTC(2021, 9, 18) / 1000;
const BOTS = { 'BB-CORE': ['BBX', 0.5], 'I-CORE': ['P7', 0.25], 'T-CORE': ['P14', 0.25] };
const KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'], PICK = 'ETH';
const top = JSON.parse(fs.readFileSync(path.join(__dirname, 'top100.json'), 'utf8')).coins.filter((c) => c.mexc);
const meta = Object.fromEntries(top.map((c) => [c.coin, c]));
const by = (id) => S.find((s) => s.id === id);

function load(coin) {
  const f10 = path.join(__dirname, 'data4h-10y', coin + '.json'), f = fs.existsSync(f10) ? f10 : path.join(__dirname, 'data4h', coin + '.json');
  if (!fs.existsSync(f)) return null;
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(__dirname, 'funding', coin + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  return { B, funding: F.length ? F : null };
}
const curve = (tr) => { tr = [...tr].sort((a, b) => a.tExit - b.tExit); let e = 0, p = 0, d = 0; for (const t of tr) { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); } return { total: e, dd: d, rdd: d > 0 ? e / d : e > 0 ? 99 : 0 }; };
function roll12(tr, from) { let pos = 0, n = 0; for (let a = from; a + YR <= NOW; a += YR / 12) { const s = tr.filter((t) => t.tExit > a && t.tExit <= a + YR).reduce((x, t) => x + t.R, 0); n++; if (s > 0) pos++; } return n ? pos / n : null; }

const coins = {}, triTrades = {};
for (const c of [...new Set([...top.map((x) => x.coin), ...KEEP, PICK])]) {
  const d = load(c); if (!d || d.B.length < 400) continue;
  const { B, funding } = d, ctx = makeCtx(B, '4h');
  const from = Math.max(START10, B[205].time), span = (NOW - from) / YR;
  const bbc = by('bb-core').build(ctx), built = { BBX: bbc, P7: by('i-core').build(ctx), P14: { ...bbc, stopL: null, stopS: null } };
  const r = { coin: c, rank: meta[c] ? meta[c].rank : null, mexcUsd: meta[c] ? meta[c].mexcUsd24h : null, first: new Date(B[0].time * 1000).toISOString().slice(0, 10), from: new Date(from * 1000).toISOString().slice(0, 10), span, bots: {}, cost2: 0 };
  const tri = [];
  for (const [bot, [p, w]] of Object.entries(BOTS)) {
    const tr = run(B, ctx.atr14, built[p], exitOf(p, ctx), funding, IV, COST).trades.filter((t) => t.t >= from), s = stats(tr);
    r.bots[bot] = { n: s.n, avgR: s.exp, total: s.total, perYear: s.total / span, dd: s.dd };
    for (const t of tr) tri.push({ tExit: t.tExit, R: t.R * w });
    r.cost2 += run(B, ctx.atr14, built[p], exitOf(p, ctx), funding, IV, { fee: COST.fee * 2, slip: COST.slip * 2 }).trades.filter((t) => t.t >= from).reduce((x, t) => x + t.R * w, 0);
  }
  triTrades[c] = tri;
  const cv = curve(tri), mid = from + (NOW - from) / 2, yrs = {};
  for (const t of tri) { const y = new Date(t.tExit * 1000).getUTCFullYear(); yrs[y] = (yrs[y] || 0) + t.R; }
  const fullYears = Object.entries(yrs).filter(([y]) => Date.UTC(+y, 0, 1) / 1000 >= from - 30 * 86400 && +y < 2026);
  r.tri = { ...cv, perYear: cv.total / span, firstHalf: tri.filter((t) => t.tExit <= mid).reduce((x, t) => x + t.R, 0), secondHalf: tri.filter((t) => t.tExit > mid).reduce((x, t) => x + t.R, 0),
    roll12: roll12(tri, from), years: yrs, fullYearsPos: fullYears.filter(([, v]) => v > 0).length, fullYearsN: fullYears.length, last12: tri.filter((t) => t.tExit > NOW - YR).reduce((x, t) => x + t.R, 0) };
  coins[c] = r;
}

// the deciding test: same window, keepers + coin vs keepers + ETH
const keepTr = KEEP.flatMap((c) => triTrades[c]);
for (const r of Object.values(coins)) {
  const w0 = Math.max(P0, Date.parse(r.from + 'T00:00:00Z') / 1000);
  const withC = curve([...keepTr, ...triTrades[r.coin]].filter((t) => t.tExit > w0)), withE = curve([...keepTr, ...triTrades[PICK]].filter((t) => t.tExit > w0));
  r.swap = { from: new Date(w0 * 1000).toISOString().slice(0, 10), years: (NOW - w0) / YR, withCoin: withC, withETH: withE, dRdd: withC.rdd - withE.rdd, dTotal: withC.total - withE.total };
}
const GATES = {
  '2y': (r) => r.span >= 2, bots: (r) => Object.values(r.bots).every((b) => b.total > 0), halves: (r) => r.tri.firstHalf > 0 && r.tri.secondHalf > 0,
  roll12: (r) => r.tri.roll12 >= 0.75, cost2: (r) => r.cost2 > 0, mexc: (r) => (r.mexcUsd || 0) >= 5e6,
};
for (const r of Object.values(coins)) { r.failed = Object.entries(GATES).filter(([, f]) => !f(r)).map(([g]) => g); r.passed = !r.failed.length; }
fs.writeFileSync(path.join(__dirname, 'results100.json'), JSON.stringify({ built: new Date().toISOString(), gates: Object.keys(GATES), coins }));

const f = (v, d = 1) => (v == null ? '  -' : (v >= 0 ? '+' : '') + v.toFixed(d));
const list = Object.values(coins).filter((r) => !KEEP.includes(r.coin) && r.coin !== 'ZEC');
const hdr = 'rank coin     yrs  from        R/yr   DD    ret/DD roll12  halves(1st/2nd)   2xcost  last12  BB/IC/TC avgR          MEXC$/d | swap vs ETH (same window): with coin / with ETH ret/DD';
const line = (r) => `${String(r.rank ?? '').padStart(3)}  ${r.coin.padEnd(8)} ${r.span.toFixed(1).padStart(4)}  ${r.from}  ${f(r.tri.perYear).padStart(5)} ${r.tri.dd.toFixed(1).padStart(5)}  ${r.tri.rdd.toFixed(2).padStart(5)}  ${r.tri.roll12 == null ? '  - ' : (r.tri.roll12 * 100).toFixed(0).padStart(3) + '%'}   ${f(r.tri.firstHalf).padStart(6)}/${f(r.tri.secondHalf).padStart(6)}   ${f(r.cost2).padStart(6)}  ${f(r.tri.last12).padStart(6)}  ${Object.values(r.bots).map((b) => f(b.avgR, 2)).join('/')}  ${r.mexcUsd == null ? '      -' : ('$' + (r.mexcUsd / 1e6).toFixed(1) + 'M').padStart(8)} | ${r.swap.withCoin.rdd.toFixed(2).padStart(5)} / ${r.swap.withETH.rdd.toFixed(2).padStart(5)} (${f(r.swap.dRdd, 2)}) from ${r.swap.from}`;
console.log('PASSED all gates, sorted by the swap test (does it beat ETH in the portfolio?)\n' + hdr);
for (const r of list.filter((r) => r.passed).sort((a, b) => b.swap.dRdd - a.swap.dRdd)) console.log(line(r));
console.log('\nFAILED (gate in brackets), sorted by standalone ret/DD');
for (const r of list.filter((r) => !r.passed).sort((a, b) => b.tri.rdd - a.tri.rdd)) console.log(line(r) + '  [' + r.failed.join(',') + ']');
const notRun = top.filter((c) => !coins[c.coin]).map((c) => c.coin); if (notRun.length) console.log('\nno usable data:', notRun.join(' '));
