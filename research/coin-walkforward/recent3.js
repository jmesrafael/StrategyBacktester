// recent3.js — every coin on the three bots for 2024, 2025 and 2026 (to Nov 11): yearly R, win rate, max drawdown, positive months,
// losing streak, and a monthly R grid. Bots = live rules (../strat-hunt-nov6), real fees, slippage, funding, 4h.
// TRI mix = 0.5 x BB-CORE + 0.25 x I-CORE + 0.25 x T-CORE (R at each bot's own 1% risk). Liquid = MEXC futures >= $1M/day.
// Coins need history from before Nov 2023 (full 2024 after the 200-SMA warm-up). Note: picking on recent years = hindsight.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), Z = path.join(__dirname, '../zec-replacement'), Z2 = path.join(__dirname, '../zec-replacement-2');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, WT = { 'BB-CORE': .5, 'I-CORE': .25, 'T-CORE': .25 };
const CUR = ['SOL', 'NEAR', 'ADA', 'GALA', 'ETH'];
const vol = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(Z2, 'ticker.json'), 'utf8')).data.map(t => [t.symbol, +t.amount24]));
const T0 = Date.UTC(2024, 0, 1) / 1000, END = Date.UTC(2026, 10, 12) / 1000, YEARS = [2024, 2025, 2026];
const MONTHS = []; for (let y = 2024; y <= 2026; y++) for (let m = 0; m < 12; m++) if (Date.UTC(y, m, 1) / 1000 < END) MONTHS.push(y * 12 + m);
const mk = t => { const d = new Date(t * 1e3); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const by = id => S.find(s => s.id === id);
function stats(tr) {
  const s = [...tr].sort((a, b) => a.x - b.x); let e = 0, pk = 0, dd = 0, ls = 0, cur = 0;
  for (const t of s) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); cur = t.R <= 0 ? cur + 1 : 0; ls = Math.max(ls, cur); }
  const M = Object.fromEntries(MONTHS.map(k => [k, 0])); for (const t of s) { const k = mk(t.x); if (k in M) M[k] += t.R; }
  const mv = MONTHS.map(k => M[k]), w = s.filter(t => t.R > 0);
  const gw = w.reduce((a, t) => a + t.R, 0), gl = -s.filter(t => t.R <= 0).reduce((a, t) => a + t.R, 0);
  return { n: s.length, R: e, win: s.length ? w.length / s.length : 0, dd, streak: ls, pf: gl ? gw / gl : 0, posM: mv.filter(v => v > 0).length, M: mv,
    years: YEARS.map(y => s.filter(t => new Date(t.x * 1e3).getUTCFullYear() === y).reduce((a, t) => a + t.R, 0)) };
}
const names = [...new Set([...fs.readdirSync(path.join(Z, 'data4h')), ...fs.readdirSync(path.join(Z, 'data4h-10y'))].map(f => f.replace('.json', '')))];
const rows = [];
for (const c of names) {
  const f10 = path.join(Z, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  if (B.length < 600 || B[0].time > Date.UTC(2023, 10, 1) / 1000) continue;
  const fp = path.join(Z, 'funding', c + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  const r = { coin: c, mexcM: (vol[c + '_USDT'] || 0) / 1e6, bots: {} }, triTr = [];
  for (const [bot, p] of Object.entries(BOTS)) {
    const tr = run(B, x.atr14, built[p], exitOf(p, x), F.length ? F : null, 14400, COST).trades.filter(t => t.tExit > T0 && t.tExit <= END).map(t => ({ x: t.tExit, R: t.R }));
    r.bots[bot] = stats(tr); tr.forEach(t => triTr.push({ x: t.x, R: t.R * WT[bot] }));
  }
  r.tri = stats(triTr); rows.push(r);
}
const f = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);
const all3 = r => r.tri.years.every(v => v > 0), liquid = r => r.mexcM >= 1, cur = c => CUR.includes(c) ? '*' : '';
rows.sort((a, b) => b.tri.R - a.tri.R);
const pick = rows.filter(r => (all3(r) && liquid(r)) || CUR.includes(r.coin));
console.log(`${rows.length} coins with full 2024-2026 history. TRI mix positive in all 3 years: ${rows.filter(all3).length}; of those liquid on MEXC (>= $1M/day): ${rows.filter(r => all3(r) && liquid(r)).length}. * = a bot already trades it.`);
console.log('Thin on MEXC (< $1M/day) but positive all 3 years: ' + rows.filter(r => all3(r) && !liquid(r)).map(r => `${r.coin} $${r.mexcM.toFixed(1)}M`).join(', '));
console.log('\n=== TRI mix (0.5 BB + 0.25 I + 0.25 T), Jan 2024 - Nov 11 2026 ===');
console.log('coin     MEXC$M |  2024   2025   2026  total | max DD | +months | worst month | best month');
for (const r of pick) { const t = r.tri; console.log(`${(r.coin + cur(r.coin)).padEnd(8)} ${r.mexcM.toFixed(0).padStart(6)} | ${t.years.map(v => f(v).padStart(6)).join(' ')} ${f(t.R).padStart(6)} | ${t.dd.toFixed(1).padStart(5)}R | ${String(t.posM).padStart(2)}/${MONTHS.length} | ${f(Math.min(...t.M)).padStart(6)} | ${f(Math.max(...t.M)).padStart(6)}`); }
console.log('\n=== Per bot, 2024 - Nov 2026: trades, win rate, PF, total R, max DD, losing streak, +months ===');
console.log('coin     | BB-CORE                              | I-CORE                               | T-CORE');
for (const r of pick) console.log(`${(r.coin + cur(r.coin)).padEnd(8)} | ` + Object.keys(BOTS).map(b => { const s = r.bots[b]; return `${String(s.n).padStart(3)}t ${(s.win * 100).toFixed(0).padStart(2)}% PF${s.pf.toFixed(2)} ${f(s.R).padStart(6)}R DD${s.dd.toFixed(0).padStart(3)} L${String(s.streak).padStart(2)} ${String(s.posM).padStart(2)}m`; }).join(' | '));
console.log('\n=== Monthly R, TRI mix ===');
const head = 'coin  year    Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec |  year';
console.log(head);
for (const r of pick) { for (const y of YEARS) { let line = `${(r.coin + cur(r.coin)).padEnd(5)} ${y} `; for (let m = 0; m < 12; m++) { const i = MONTHS.indexOf(y * 12 + m); line += (i >= 0 ? f(r.tri.M[i]) : '').padStart(6); } console.log(line + ' | ' + f(r.tri.years[YEARS.indexOf(y)]).padStart(6)); } }
fs.writeFileSync(path.join(__dirname, 'recent3.json'), JSON.stringify(rows.map(r => ({ coin: r.coin, mexcM: r.mexcM, tri: r.tri, bots: r.bots }))));
