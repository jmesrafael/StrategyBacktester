// stability.js — the owner's rule (Nov 12, 2026): a coin joins a bot only if, ON THAT BOT, it wins 6-7 of the 7 years 2020-2026, has few losing
// months, shallow drawdowns, loses small and wins big. "Stability over luck." The bar per measure = the MEDIAN of the bot's four kept coins
// (SOL, NEAR, ADA, GALA) on the same measure, so a new coin must be at least as steady as a typical coin the bot already trades.
// Then a portfolio check: adding the coin must not make the bot's losing months or its drawdown (trade by trade) worse by more than a hair.
//   node stability.js  -> stability.json (+ console)
// Engine = the bots' own rules (parity.js), real fees, slippage, funding. Coins: every coin with 4h data starting before Nov 2020 and MEXC >= $1M/day.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'];
const Y0 = Date.UTC(2020, 0, 1) / 1000, END = Date.UTC(2026, 10, 1) / 1000, P0 = Date.UTC(2021, 0, 1) / 1000;
const liq = {}; for (const f of ['universe.json', 'top100.json']) for (const c of JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')).coins) if (c.mexcUsd24h != null) liq[c.coin] = Math.max(liq[c.coin] || 0, c.mexcUsd24h);
liq.XMR = liq.XMR || 3.6e6;
const files = [...new Set([...fs.readdirSync(path.join(__dirname, 'data4h')), ...fs.readdirSync(path.join(__dirname, 'data4h-10y'))])].map((f) => f.replace('.json', ''));
const load = (c) => { const f10 = path.join(__dirname, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(__dirname, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })); const fp = path.join(__dirname, 'funding', c + '.json');
  return { B, F: fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null }; };
const by = (id) => S.find((s) => s.id === id);
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function tradesFor(c) {
  const { B, F } = load(c), x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  return Object.fromEntries(Object.entries(BOTS).map(([b, p]) => [b, run(B, x.atr14, built[p], exitOf(p, x), F && F.length ? F : null, 14400, COST).trades.map((t) => ({ x: t.tExit, R: t.R }))]));
}
function measure(tr, from) {
  tr = tr.filter((t) => t.x > from && t.x <= END).sort((a, b) => a.x - b.x);
  const keys = []; for (let d = new Date(from * 1000); d.getTime() / 1000 < END; d.setUTCMonth(d.getUTCMonth() + 1)) keys.push(d.toISOString().slice(0, 7));
  const m = Object.fromEntries(keys.map((k) => [k, 0])); for (const t of tr) { const k = new Date(t.x * 1000).toISOString().slice(0, 7); if (k in m) m[k] += t.R; }
  const mv = keys.map((k) => m[k]), R = tr.map((t) => t.R), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0);
  let e = 0, p = 0, dd = 0; for (const r of R) { e += r; p = Math.max(p, e); dd = Math.max(dd, p - e); }
  let neg = 0, n12 = 0, w12 = Infinity; for (let i = 0; i + 12 <= mv.length; i++) { const s = mv.slice(i, i + 12).reduce((a, b) => a + b, 0); n12++; if (s < 0) neg++; w12 = Math.min(w12, s); }
  const yrs = {}; for (const t of tr) { const y = new Date(t.x * 1000).getUTCFullYear(); yrs[y] = (yrs[y] || 0) + t.R; }
  const yv = Object.entries(yrs).sort();
  return { n: R.length, total: e, perYear: e / ((END - from) / (365.25 * 86400)), losingM: mv.filter((v) => v < 0).length / mv.length, dd, neg12: neg / n12, w12,
    payoff: (w.reduce((a, b) => a + b, 0) / w.length) / (-l.reduce((a, b) => a + b, 0) / l.length), pf: w.reduce((a, b) => a + b, 0) / -l.reduce((a, b) => a + b, 0),
    years: Object.fromEntries(yv), yearsWon: yv.filter(([, v]) => v > 0).length, yearsN: yv.length, worstYear: Math.min(...yv.map(([, v]) => v)) };
}
function portfolio(trs, from) { // the bot's coins together: losing months and trade-by-trade drawdown
  const all = trs.flat().filter((t) => t.x > from && t.x <= END).sort((a, b) => a.x - b.x); return measure(all, from); }

// ---- run
const coins = files.filter((c) => { try { const B = JSON.parse(fs.readFileSync(path.join(__dirname, fs.existsSync(path.join(__dirname, 'data4h-10y', c + '.json')) ? 'data4h-10y' : 'data4h', c + '.json'), 'utf8')); return B[0][0] < Date.UTC(2020, 9, 1) / 1000 - 205 * 14400 || KEEP.includes(c); } catch (e) { return false; } })
  .filter((c) => KEEP.includes(c) || (liq[c] || 0) >= 1e6);
const T = {}; for (const c of coins) T[c] = tradesFor(c);
const out = {};
for (const bot of Object.keys(BOTS)) {
  const M = Object.fromEntries(coins.map((c) => [c, measure(T[c][bot], Y0)]));
  // the bar: median of the four kept coins (GALA and NEAR/SOL start late 2020-21: their measures cover what they have)
  const bar = { losingM: median(KEEP.map((k) => M[k].losingM)), dd: median(KEEP.map((k) => M[k].dd)), neg12: median(KEEP.map((k) => M[k].neg12)), payoff: median(KEEP.map((k) => M[k].payoff)), pf: median(KEEP.map((k) => M[k].pf)), worstYear: median(KEEP.map((k) => M[k].worstYear)) };
  const base = portfolio(KEEP.map((k) => T[k][bot]), P0);
  const rows = [];
  for (const c of coins) {
    if (KEEP.includes(c)) continue;
    const m = M[c];
    const tests = {
      'won 6-7 of 7 years': m.yearsN >= 7 && m.yearsWon >= 6,
      'losing months <= keepers': m.losingM <= bar.losingM + 1e-9,
      'drawdown <= keepers': m.dd <= bar.dd + 1e-9,
      'bad 12-month windows <= keepers': m.neg12 <= bar.neg12 + 1e-9,
      'loses small, wins big (payoff >= keepers)': m.payoff >= bar.payoff - 1e-9,
      'worst year >= keepers': m.worstYear >= bar.worstYear - 1e-9,
    };
    const passed = Object.values(tests).every(Boolean);
    const withC = portfolio([...KEEP.map((k) => T[k][bot]), T[c][bot]], P0);
    const portOk = withC.losingM <= base.losingM + 0.005 && withC.dd <= base.dd * 1.10; // the bot as a whole: no more losing months, drawdown at most 10% deeper
    rows.push({ coin: c, mexcUsd: liq[c] || null, ...m, tests, failed: Object.entries(tests).filter(([, v]) => !v).map(([k]) => k), passed, portfolio: { losingM: withC.losingM, dd: withC.dd, total: withC.total, base }, portOk, add: passed && portOk });
  }
  rows.sort((a, b) => a.failed.length - b.failed.length || a.losingM - b.losingM);
  out[bot] = { bar, keepers: Object.fromEntries(KEEP.map((k) => [k, M[k]])), base, rows };
  const pc = (v) => (v * 100).toFixed(0) + '%', f = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
  console.log(`\n=== ${bot} — the bar (median of SOL, NEAR, ADA, GALA): losing months <= ${pc(bar.losingM)}, drawdown <= ${bar.dd.toFixed(1)}R, bad 12-mo windows <= ${pc(bar.neg12)}, payoff (avg win / avg loss) >= ${bar.payoff.toFixed(2)}, worst year >= ${f(bar.worstYear)}R; plus 6-7 of 7 years won`);
  console.log(`    keepers: ${KEEP.map((k) => `${k} lose-mo ${pc(M[k].losingM)} DD ${M[k].dd.toFixed(1)} payoff ${M[k].payoff.toFixed(2)} yrs ${M[k].yearsWon}/${M[k].yearsN}`).join(' | ')}`);
  console.log(`    bot today (4 coins, 2021->): losing months ${pc(base.losingM)}, drawdown ${base.dd.toFixed(1)}R, ${f(base.total)}R`);
  console.log('    coin   MEXC$/d  yrs won  lose-mo  DD     bad12  payoff  worst-yr  PF    | with coin: lose-mo  DD    total  | verdict');
  for (const r of rows.slice(0, 14)) console.log(`    ${r.coin.padEnd(6)} ${('$' + ((r.mexcUsd || 0) / 1e6).toFixed(1) + 'M').padStart(7)}  ${r.yearsWon}/${r.yearsN}      ${pc(r.losingM).padStart(4)}   ${r.dd.toFixed(1).padStart(5)}  ${pc(r.neg12).padStart(4)}   ${r.payoff.toFixed(2)}    ${f(r.worstYear).padStart(6)}   ${r.pf.toFixed(2)}  |  ${pc(r.portfolio.losingM).padStart(4)}   ${r.portfolio.dd.toFixed(1).padStart(5)}  ${f(r.portfolio.total).padStart(6)} | ${r.add ? 'ADD' : r.passed ? 'passes the coin test, but hurts the bot' : 'no: ' + r.failed.map((x) => x.split(' ')[0] + (x.includes('years') ? '-years' : '')).join(', ')}`);
}
fs.writeFileSync(path.join(__dirname, 'stability.json'), JSON.stringify(out, null, 1));
