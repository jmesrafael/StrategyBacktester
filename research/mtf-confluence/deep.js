// Deep test of the MTF candidates vs the live bots (same 4 coins, same window as ../orb-sol/compare-bots.js).
const fs = require('fs'), path = require('path');
const LIB = require(path.join(__dirname, '../../candles/candles.js'));
const { build, backtest, COST } = require('./mtf.js');
const BT = JSON.parse(fs.readFileSync(path.join(__dirname, '../zec-replacement-2/trades-fill.json')));
const BOT = ['SOL', 'NEAR', 'ADA', 'GALA'], ALL = LIB.coins();
const T0 = Date.UTC(2020, 9, 20) / 1000, T1 = Date.UTC(2026, 10, 11) / 1000;
const CANDS = { 'MTF core P14': { filters: [], exit: 'P14' }, 'MTF adx+vol P14': { filters: ['adx', 'vol'], exit: 'P14' }, 'MTF core P7': { filters: [], exit: 'P7' } };
const data = {}; for (const c of ALL) data[c] = build(c);
const r1 = x => (x >= 0 ? '+' : '') + x.toFixed(1);
const mk = t => { const d = new Date(t * 1e3); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const m0 = mk(T0), NM = mk(T1 - 1) - m0 + 1, years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const monthly = tr => { const M = new Array(NM).fill(0); tr.forEach(t => { const k = mk(t.tExit) - m0; if (k >= 0 && k < NM) M[k] += t.R; }); return M; };
const ddR = tr => { let e = 0, p = 0, d = 0; [...tr].sort((a, b) => a.tExit - b.tExit).forEach(t => { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); }); return d; };
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let s = 0, a = 0, b = 0; for (let i = 0; i < n; i++) { s += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2; } return s / Math.sqrt(a * b); };
const clip = tr => tr.filter(t => t.tExit >= T0 && t.tExit < T1);
const bots = { 'BB-CORE': clip(BOT.flatMap(c => BT[c + '|BB-CORE'].map(t => ({ ...t, coin: c })))), 'I-CORE': clip(BOT.flatMap(c => BT[c + '|I-CORE'].map(t => ({ ...t, coin: c })))), 'T-CORE': clip([...BOT, 'ETH'].flatMap(c => BT[c + '|T-CORE'].map(t => ({ ...t, coin: c })))) };
const res = {};
for (const [nm, cfg] of Object.entries(CANDS)) {
  const bot = clip(BOT.flatMap(c => backtest(c, cfg, { data: data[c] }))), all = clip(ALL.flatMap(c => backtest(c, cfg, { data: data[c] })));
  res[nm] = { bot, all };
  for (const [scope, T] of [['4 bot coins', bot], ['all 14 coins', all]]) {
    const R = T.map(t => t.R), s = R.reduce((a, b) => a + b, 0), srt = [...R].sort((a, b) => b - a), M = monthly(T);
    const gw = R.filter(x => x > 0).reduce((a, b) => a + b, 0), top10p = srt.slice(0, Math.round(R.length * 0.1)).reduce((a, b) => a + b, 0);
    const yr = years.map(y => T.filter(t => new Date(t.tExit * 1e3).getUTCFullYear() === y).reduce((a, t) => a + t.R, 0));
    const L = T.filter(t => t.dir === 1), S = T.filter(t => t.dir === -1);
    console.log(`\n## ${nm} — ${scope}: ${T.length} trades (${(T.length / NM).toFixed(1)}/mo) win ${(R.filter(x => x > 0).length / R.length * 100).toFixed(0)}% avg ${(s / R.length).toFixed(3)}R total ${r1(s)}R maxDD ${ddR(T).toFixed(1)}R +months ${M.filter(v => v > 0).length}/${NM} +years ${yr.filter(v => v > 0).length}/7`);
    console.log(`   years ${years.map((y, i) => String(y).slice(2) + ':' + r1(yr[i])).join(' ')} | long ${L.length} ${(L.reduce((a, t) => a + t.R, 0) / L.length).toFixed(2)}R short ${S.length} ${(S.reduce((a, t) => a + t.R, 0) / (S.length || 1)).toFixed(2)}R`);
    console.log(`   w/o top 10: ${r1(s - srt.slice(0, 10).reduce((a, b) => a + b, 0))}R | w/o top 5%: ${r1(s - srt.slice(0, Math.round(R.length * .05)).reduce((a, b) => a + b, 0))}R | top 10% of trades = ${(top10p / gw * 100).toFixed(0)}% of gross wins | avg hold ${(T.reduce((a, t) => a + t.bars, 0) / T.length / 24).toFixed(1)} days`);
  }
}
// vs bots on the 4 bot coins
console.log('\n=== vs the live bots (4 bot coins; T-CORE also ETH) ===');
const M = Object.fromEntries([...Object.entries(bots), ...Object.entries(res).map(([k, v]) => [k, v.bot])].map(([k, v]) => [k, monthly(v)]));
console.log('YEARLY R      ' + Object.keys(M).map(k => k.padStart(16)).join(''));
for (const y of years) console.log(String(y).padEnd(14) + Object.keys(M).map(k => r1(M[k].reduce((a, v, i) => Math.floor((m0 + i) / 12) === y ? a + v : a, 0)).padStart(16)).join(''));
console.log('TOTAL         ' + Object.keys(M).map(k => r1(M[k].reduce((a, b) => a + b, 0)).padStart(16)).join(''));
const TRI = M['BB-CORE'].map((v, i) => .5 * v + .25 * M['I-CORE'][i] + .25 * M['T-CORE'][i]);
for (const k of Object.keys(res)) {
  const g = M[k], bad = TRI.map((v, i) => [v, g[i]]).filter(x => x[0] < 0);
  // trade overlap with T-CORE / BB-CORE: same coin, same direction, holding periods overlap
  const ov = (A, B) => A.filter(a => B.some(b => b.coin === a.coin && b.dir === a.dir && b.t < a.tExit && b.tExit > a.t)).length / A.length;
  console.log(`\n${k}: monthly corr BB ${corr(g, M['BB-CORE']).toFixed(2)} I ${corr(g, M['I-CORE']).toFixed(2)} T ${corr(g, M['T-CORE']).toFixed(2)} TRI ${corr(g, TRI).toFixed(2)} | in TRI's ${bad.length} losing months: ${r1(bad.reduce((a, x) => a + x[1], 0))}R (${bad.filter(x => x[1] > 0).length} positive) | trades overlapping a same-side T-CORE trade ${(ov(res[k].bot, bots['T-CORE']) * 100).toFixed(0)}%, BB-CORE ${(ov(res[k].bot, bots['BB-CORE']) * 100).toFixed(0)}%, I-CORE ${(ov(res[k].bot, bots['I-CORE']) * 100).toFixed(0)}%`);
  const combo = w => { const P = TRI.map((v, i) => (1 - w) * v + w * g[i]); let e = 0, p = 0, d = 0; P.forEach(v => { e += v; p = Math.max(p, e); d = Math.max(d, p - e); }); return `total ${r1(e)}% month-end DD ${d.toFixed(1)}% ret/DD ${(e / d).toFixed(1)} +months ${P.filter(v => v > 0).length}/${NM}`; };
  console.log(`   account: TRI-CORE alone ${combo(0)} | 80% TRI + 20% ${k} ${combo(.2)} | 75/25 ${combo(.25)}`);
}
fs.writeFileSync(path.join(__dirname, 'deep.json'), JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { bot: v.bot.map(t => ({ coin: t.coin, t: t.t, tExit: t.tExit, dir: t.dir, R: t.R })), monthly: monthly(v.bot) }]))));
