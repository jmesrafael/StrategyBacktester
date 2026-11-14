// history.js — Nov 13, 2026: each bot's LIVE rules on its LIVE coins, Jan 1 2020 -> Nov 11 2026 (last candle on file).
// Per bot x coin: every trade, year by year, month by month, win rate, payoff, drawdown, streaks. Plus each bot's whole lineup.
// Engine + data = ../zec-replacement (Binance spot 4h, real fees/slippage/funding), engine validated against the live bot cores.
//   node history.js  -> history.json
'use strict';
const fs = require('fs'), path = require('path');
const Z = path.join(__dirname, '..', 'zec-replacement'), H = path.join(__dirname, '..', 'strat-hunt-nov6');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const LINEUP = { 'BB-CORE': ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'], 'I-CORE': ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], 'T-CORE': ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'] };
const START = Date.UTC(2020, 0, 1) / 1000, END = Date.UTC(2026, 10, 12) / 1000, L12 = Date.UTC(2025, 10, 12) / 1000;
const load = (c) => { const f10 = path.join(Z, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })); const fp = path.join(Z, 'funding', c + '.json');
  return { B, F: fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null }; };
const by = (id) => S.find((s) => s.id === id);
const T = {};
for (const c of [...new Set(Object.values(LINEUP).flat())]) {
  const { B, F } = load(c), x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), f = F && F.length ? F : null;
  const go = (strat, ex) => run(B, x.atr14, strat, ex, f, 14400, COST).trades.filter((t) => t.tExit > START && t.tExit <= END)
    .map((t) => ({ c, d: t.dir > 0 || t.dir === 'long' ? 'L' : 'S', t0: t.t, t1: t.tExit, R: +t.R.toFixed(3), why: t.why, h: t.bars * 4 }));
  T[c] = { 'BB-CORE': go(bbc, exitOf('BBX', x)), 'I-CORE': go(by('i-core').build(x), exitOf('P7', x)), 'T-CORE': go({ ...bbc, stopL: null, stopS: null }, exitOf('P14', x)), first: B[0].time };
}
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7), yr = (t) => +ym(t).slice(0, 4);
function stats(tr, from) {
  tr = [...tr].sort((a, b) => a.t1 - b.t1);
  const R = tr.map((t) => t.R), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0), sum = (a) => a.reduce((s, v) => s + v, 0);
  let e = 0, p = 0, dd = 0, ls = 0, cur = 0; for (const r of R) { e += r; p = Math.max(p, e); dd = Math.max(dd, p - e); cur = r <= 0 ? cur + 1 : 0; ls = Math.max(ls, cur); }
  const months = {}; for (let d = new Date(Math.max(from, START) * 1000); d.getTime() / 1000 < END; d.setUTCMonth(d.getUTCMonth() + 1, 1)) months[d.toISOString().slice(0, 7)] = { R: 0, n: 0, w: 0 };
  const years = {};
  for (const t of tr) { const m = months[ym(t.t1)]; if (m) { m.R += t.R; m.n++; if (t.R > 0) m.w++; } const y = (years[yr(t.t1)] ||= { R: 0, n: 0, w: 0, dd: 0, _e: 0, _p: 0 }); y.R += t.R; y.n++; if (t.R > 0) y.w++; y._e += t.R; y._p = Math.max(y._p, y._e); y.dd = Math.max(y.dd, y._p - y._e); }
  for (const y of Object.values(years)) { delete y._e; delete y._p; }
  const mv = Object.values(months).filter((m, i, a) => true), act = mv; // calendar months the coin was tradable
  const r1 = (v) => +v.toFixed(2);
  const sides = (s) => { const x = tr.filter((t) => t.d === s); return { n: x.length, R: r1(sum(x.map((t) => t.R))), wr: x.length ? x.filter((t) => t.R > 0).length / x.length : 0 }; };
  const last12 = tr.filter((t) => t.t1 > L12), ytd = tr.filter((t) => yr(t.t1) === 2026);
  const best = tr.reduce((a, b) => (b.R > a.R ? b : a), tr[0]), worst = tr.reduce((a, b) => (b.R < a.R ? b : a), tr[0]);
  const top5 = [...R].sort((a, b) => b - a).slice(0, 5);
  return { n: tr.length, wins: w.length, wr: w.length / tr.length, R: r1(e), avgR: e / tr.length, avgWin: sum(w) / w.length, avgLoss: l.length ? sum(l) / l.length : 0,
    pf: l.length ? sum(w) / -sum(l) : 99, dd: r1(dd), lossStreak: ls, holdH: sum(tr.map((t) => t.h)) / tr.length,
    best: best && { R: best.R, c: best.c, at: ym(best.t1) }, worst: worst && { R: worst.R, c: worst.c, at: ym(worst.t1) }, top5Share: e > 0 ? sum(top5) / e : null,
    losingMonths: act.filter((m) => m.R < 0).length, flatMonths: act.filter((m) => m.n === 0).length, nMonths: act.length,
    last12: { n: last12.length, R: r1(sum(last12.map((t) => t.R))), wr: last12.length ? last12.filter((t) => t.R > 0).length / last12.length : 0 },
    ytd: { n: ytd.length, R: r1(sum(ytd.map((t) => t.R))), wr: ytd.length ? ytd.filter((t) => t.R > 0).length / ytd.length : 0 },
    long: sides('L'), short: sides('S'), why: tr.reduce((o, t) => ((o[t.why] = (o[t.why] || 0) + 1), o), {}),
    years: Object.fromEntries(Object.entries(years).map(([k, v]) => [k, { R: r1(v.R), n: v.n, wr: v.n ? v.w / v.n : 0, dd: r1(v.dd) }])),
    months: Object.fromEntries(Object.entries(months).map(([k, v]) => [k, [r1(v.R), v.n, v.w]])) };
}
const out = { generated: '2026-11-13', window: ['2020-01-01', '2026-11-11'], lineup: LINEUP, bots: {} };
for (const [bot, coins] of Object.entries(LINEUP)) {
  out.bots[bot] = { lineup: stats(coins.flatMap((c) => T[c][bot]), START), coins: {}, trades: coins.flatMap((c) => T[c][bot]).sort((a, b) => a.t0 - b.t0) };
  for (const c of coins) out.bots[bot].coins[c] = { since: new Date(Math.max(T[c].first + 205 * 14400, START) * 1000).toISOString().slice(0, 10), ...stats(T[c][bot], Math.max(T[c].first + 205 * 14400, START)) };
}
fs.writeFileSync(path.join(__dirname, 'history.json'), JSON.stringify(out));
const pc = (v) => (v * 100).toFixed(0) + '%', f = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
for (const [bot, b] of Object.entries(out.bots)) {
  const L = b.lineup; console.log(`\n=== ${bot} lineup: ${L.n} trades, win ${pc(L.wr)}, ${f(L.R)}R, PF ${L.pf.toFixed(2)}, DD ${L.dd}R, losing months ${L.losingMonths}/${L.nMonths}, last12 ${f(L.last12.R)}R, 2026 ${f(L.ytd.R)}R`);
  console.log('    years: ' + Object.entries(L.years).map(([y, v]) => `${y} ${f(v.R)} (${v.n}, ${pc(v.wr)})`).join(' | '));
  for (const [c, s] of Object.entries(b.coins)) console.log(`  ${c.padEnd(5)} since ${s.since} n${String(s.n).padStart(4)} win ${pc(s.wr).padStart(4)} ${f(s.R).padStart(7)}R avg ${f(s.avgR)} PF ${s.pf.toFixed(2)} DD ${String(s.dd).padStart(5)} lose-mo ${s.losingMonths}/${s.nMonths} top5 ${s.top5Share ? pc(s.top5Share) : '-'} L12 ${f(s.last12.R)} (${pc(s.last12.wr)}) YTD ${f(s.ytd.R)} | ${Object.entries(s.years).map(([y, v]) => y.slice(2) + ':' + f(v.R)).join(' ')}`);
}
