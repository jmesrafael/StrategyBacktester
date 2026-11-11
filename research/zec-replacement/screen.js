// screen.js — ZEC replacement screen: the three live TRI-CORE bots, unchanged, on every coin with 7+ years of Binance spot 4h history.
//   node screen.js            -> results.json (+ console table)
// Engine and rules: ../strat-hunt-nov6 (engine.js, strategies.js), validated against the real cores by validate.js there.
//   BB-CORE = bb-core|BBX (Bollinger 20,2 close-through + SMA200, stop = middle band, 48-candle time exit, no target)
//   I-CORE  = i-core|P7   (Ichimoku cloud break + SMA200, 2 ATR stop, 7 ATR trail)
//   T-CORE  = bb-trail|P14 (bb-core entry, 2 ATR stop, 14 ATR trail)
// Costs: 0.05% taker per side + 0.02% slippage per fill + real Binance funding (from each coin's futures listing; zero before it).
// Window: every coin is scored on the SAME 7 years, trades entered from 2019-11-11 on (earlier candles only warm up the indicators).
// Gates (fixed before results were seen): see GATES below.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6');
const { run, stats, COST } = require(path.join(H, 'engine.js'));
const { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));

const START = Date.UTC(2019, 10, 11) / 1000, SPLIT = Date.UTC(2023, 0, 1) / 1000, IV = 14400;
const BOTS = { 'BB-CORE': ['bb-core', 'BBX', 0.5], 'I-CORE': ['i-core', 'P7', 0.25], 'T-CORE': ['bb-trail', 'P14', 0.25] }; // weight = TRI-CORE capital split 50/25/25
const REGIMES = [['2019-11 to 2020-12 (covid crash + start of bull)', '2019-11-11', '2021-01-01'], ['2021 (bull top)', '2021-01-01', '2022-01-01'], ['2022 (bear)', '2022-01-01', '2023-01-01'], ['2023-24 (recovery)', '2023-01-01', '2025-01-01'], ['2025-26 (late cycle)', '2025-01-01', '2027-01-01']];
const ts = (d) => Date.parse(d + 'T00:00:00Z') / 1000;

const U = JSON.parse(fs.readFileSync(path.join(__dirname, 'universe.json'), 'utf8')).coins;
const liq = Object.fromEntries(U.map((c) => [c.coin, c]));
const coins = fs.readdirSync(path.join(__dirname, 'data4h')).map((f) => f.replace('.json', '')).sort();

function load(coin) {
  const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'data4h', coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(__dirname, 'funding', coin + '.json');
  const F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  return { B, funding: F.length ? F : null };
}
const by = (id) => S.find((s) => s.id === id);

// 12-month rolling windows (stepped monthly): share that end positive — a stability measure that does not depend on calendar-year edges
function rolling12(tr) {
  let pos = 0, n = 0;
  for (let y = 2019, m = 11; ; ) {
    const a = Date.UTC(y, m, 11) / 1000, b = Date.UTC(y + 1, m, 11) / 1000;
    if (b > Date.now() / 1000) break;
    const s = tr.filter((t) => t.tExit > a && t.tExit <= b).reduce((x, t) => x + t.R, 0);
    n++; if (s > 0) pos++;
    m++; if (m === 12) { m = 0; y++; }
  }
  return n ? pos / n : 0;
}
function summarize(tr) {
  const s = stats(tr), yrs = {};
  for (const t of tr) { let y = new Date(t.tExit * 1000).getUTCFullYear(); if (y === 2019) y = 2020; yrs[y] = (yrs[y] || 0) + t.R; } // Nov-Dec 2019 folded into 2020
  const yv = Object.entries(yrs).sort();
  const reg = REGIMES.map(([name, a, b]) => tr.filter((t) => t.tExit > ts(a) && t.tExit <= ts(b)).reduce((x, t) => x + t.R, 0));
  let streak = 0, worst = 0; for (const t of [...tr].sort((a, b) => a.tExit - b.tExit)) { if (t.R < 0) { streak++; worst = Math.max(worst, streak); } else streak = 0; }
  return {
    n: s.n, total: s.total, avgR: s.exp, pf: s.pf, win: s.win, dd: s.dd, rdd: s.rdd, years: Object.fromEntries(yv),
    yrsPos: yv.filter(([, v]) => v > 0).length, yrsN: yv.length, worstYear: Math.min(...yv.map(([, v]) => v)),
    regimes: reg, regimesPos: reg.filter((v) => v > 0).length, roll12: rolling12(tr), lossStreak: worst,
    pre: tr.filter((t) => t.tExit <= SPLIT).reduce((x, t) => x + t.R, 0) / Math.max(1, tr.filter((t) => t.tExit <= SPLIT).length),
    post: tr.filter((t) => t.tExit > SPLIT).reduce((x, t) => x + t.R, 0) / Math.max(1, tr.filter((t) => t.tExit > SPLIT).length),
    top10share: s.total > 0 ? [...tr].sort((a, b) => b.R - a.R).slice(0, 10).reduce((x, t) => x + t.R, 0) / s.total : null,
  };
}

const out = { built: new Date().toISOString(), window: '2019-11-11 to last closed 4h candle', bots: BOTS, regimes: REGIMES.map((r) => r[0]), coins: {} };
const tradesOut = {};
for (const coin of coins) {
  const { B, funding } = load(coin), c = makeCtx(B, '4h');
  const covered = B[0].time <= START - 205 * IV; // enough candles before the window to warm up SMA200
  const res = { first: new Date(B[0].time * 1000).toISOString().slice(0, 10), full7y: covered, liq: liq[coin] || null, fundingFrom: funding ? new Date(funding[0][0] * 1000).toISOString().slice(0, 10) : null, bots: {}, cost2: {}, monthly: {} };
  tradesOut[coin] = {};
  // strategies.js 'bb-trail' rebuilds the Bollinger bands on every candle (~50 s a coin); its entries are bb-core's, so reuse those
  // without the band stop (exactly what run.js does for non-BB exit profiles)
  const bbc = by('bb-core').build(c);
  const built = { 'bb-core': bbc, 'i-core': by('i-core').build(c), 'bb-trail': { ...bbc, stopL: null, stopS: null } };
  for (const [bot, [id, prof]] of Object.entries(BOTS)) {
    for (const k of [1, 2]) {
      const cost = { fee: COST.fee * k, slip: COST.slip * k };
      const tr = run(B, c.atr14, built[id], exitOf(prof, c), funding, IV, cost).trades.filter((t) => t.t >= START);
      if (k === 1) {
        res.bots[bot] = summarize(tr);
        tradesOut[coin][bot] = tr.map((t) => [t.t, t.tExit, +t.R.toFixed(4), t.dir]);
        const mo = {}; for (const t of tr) { const d = new Date(t.tExit * 1000), key = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); mo[key] = (mo[key] || 0) + t.R; }
        res.monthly[bot] = mo;
      } else res.cost2[bot] = { total: stats(tr).total, avgR: stats(tr).exp, yrsPos: summarize(tr).yrsPos };
    }
  }
  // TRI-CORE weighted view of this coin (50/25/25 of the risk budget): R-weighted trade list
  const w = [];
  for (const [bot, [, , wt]] of Object.entries(BOTS)) for (const t of tradesOut[coin][bot]) w.push({ t: t[0], tExit: t[1], R: t[2] * wt, bars: 0 });
  res.tri = summarize(w);
  res.tri.cost2 = Object.entries(BOTS).reduce((x, [bot, [, , wt]]) => x + res.cost2[bot].total * wt, 0);
  out.coins[coin] = res;
  process.stdout.write(coin + ' ');
}
console.log();

// ---- gates (decided before looking at the numbers)
const GATES = {
  'history: 7 full years in the window': (r) => r.full7y,
  'BB-CORE positive, avg >= +0.10R': (r) => r.bots['BB-CORE'].avgR >= 0.10,
  'all three bots positive overall': (r) => Object.values(r.bots).every((b) => b.total > 0),
  'TRI-CORE weighted: >= 6 of 7 years positive': (r) => r.tri.yrsPos >= r.tri.yrsN - 1,
  'TRI-CORE weighted: positive before AND after 2023': (r) => r.tri.pre > 0 && r.tri.post > 0,
  'TRI-CORE weighted: >= 4 of 5 market regimes positive': (r) => r.tri.regimesPos >= 4,
  'survives double costs (TRI-CORE weighted total > 0)': (r) => r.tri.cost2 > 0,
  'tradable: MEXC futures >= $5M/day or Binance futures >= $30M/day': (r) => r.liq && ((r.liq.mexcUsd24h || 0) >= 5e6 || (r.liq.binanceFutUsd24h || 0) >= 30e6),
};
for (const [coin, r] of Object.entries(out.coins)) { r.gates = Object.fromEntries(Object.entries(GATES).map(([g, f]) => [g, !!f(r)])); r.passed = Object.values(r.gates).every(Boolean); r.failed = Object.entries(r.gates).filter(([, v]) => !v).map(([g]) => g); }
out.gates = Object.keys(GATES);
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out));
fs.writeFileSync(path.join(__dirname, 'trades.json'), JSON.stringify(tradesOut));

const f = (v, d = 2) => (v >= 0 ? '+' : '') + v.toFixed(d);
const rows = Object.entries(out.coins).sort((a, b) => b[1].tri.rdd - a[1].tri.rdd);
console.log('coin   7y  BB avgR/yrs   IC avgR   TC avgR   TRI tot  TRI DD  ret/DD  yrs  reg  roll12  pre/post        2xcost  PASS  failed');
for (const [coin, r] of rows) {
  const b = r.bots;
  console.log(`${coin.padEnd(6)} ${r.full7y ? 'Y' : 'n'}  ${f(b['BB-CORE'].avgR)} ${b['BB-CORE'].yrsPos}/${b['BB-CORE'].yrsN}   ${f(b['I-CORE'].avgR)}     ${f(b['T-CORE'].avgR)}     ${f(r.tri.total, 1).padStart(6)}  ${r.tri.dd.toFixed(1).padStart(5)}  ${r.tri.rdd.toFixed(2).padStart(5)}  ${r.tri.yrsPos}/${r.tri.yrsN}  ${r.tri.regimesPos}/5  ${(r.tri.roll12 * 100).toFixed(0).padStart(3)}%   ${f(r.tri.pre)}/${f(r.tri.post)}   ${f(r.tri.cost2, 1).padStart(6)}  ${r.passed ? 'YES' : ' - '}  ${r.failed.map((g) => g.split(':')[0].split(' ')[0]).join(',')}`);
}
