// months.js — BB-1H-WIDE on the live coins: fresh PHP 1,000 every Jan 1, month by month (trades closed, wins, month %, month-end balance),
// plus trades per year for BB-CORE 4h / BB-CORE 1h / BB-1H-WIDE. Same sizing as pesos.js (live risk steps).
// A trade belongs to the year it CLOSES in; a trade opened in December and closed in January is sized at PHP 1,000.
'use strict';
const L = require('./lib.js'), V = require('./fam-vol.js');
const { run } = require('../strat-hunt-nov6/engine.js'), { S, makeCtx, exitOf } = require('../strat-hunt-nov6/strategies.js');
const PHP = 60, TIERS = [[0, 0.025], [500 * PHP, 0.02], [1000 * PHP, 0.015]], START = 1000;
const pct = (pk) => { let p = TIERS[0][1]; for (const [b, r] of TIERS) if (pk >= b) p = r; return p; };
const LIVE = ['SOL', 'NEAR', 'ADA', 'GALA', 'ZEC', 'ARB'], E = { kind: 'M', bars: 192 };
const one = (mult) => L.evaluate(V.strat({ len: 80, mult, trend: 800, minStop: 0.3, filt: null }, E), V.mkEx(E), LIVE, 1, true).trades;
function core4h() { const s = S.find((x) => x.id === 'bb-core'), out = []; for (const cn of LIVE) { const B = L.C.load(cn, '4h').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })); const c = makeCtx(B, '4h'); for (const t of run(B, c.atr14, s.build(c), exitOf('BBX', c), L.C.funding(cn), 14400).trades) if (t.tExit >= 1577836800) out.push(t); } return out; }
const Y = L.YEARS, M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = (t) => { const d = new Date(t * 1000); return [d.getUTCFullYear(), d.getUTCMonth()]; };
const fmtB = (v) => v >= 1e4 ? Math.round(v / 1e3) + 'k' : Math.round(v).toLocaleString('en-US');
let o = '';

// trades per year, three strategies
const sets = [['BB-CORE 4h (live bot)', core4h()], ['BB-CORE 1h (2.0σ)', one(2.0)], ['BB-1H-WIDE (2.6σ)', one(2.6)]];
o += '## Trades per year (live coins, closed trades)\n| Strategy | ' + Y.join(' | ') + ' | Total | Per month | Win rate |\n|' + '---|'.repeat(Y.length + 4) + '\n';
for (const [nm, tr] of sets) { const c = {}; for (const t of tr) c[ym(t.tExit)[0]] = (c[ym(t.tExit)[0]] || 0) + 1; const months = (Date.parse('2026-11-25') - Date.parse('2020-01-01')) / 2.63e9; o += `| ${nm} | ${Y.map((y) => c[y] || 0).join(' | ')} | ${tr.length} | ${(tr.length / months).toFixed(0)} | ${Math.round(100 * tr.filter((t) => t.R > 0).length / tr.length)}% |\n`; }

// month by month, BB-1H-WIDE, fresh 1,000 per year
const MULT = +(process.argv[2] || 2.6), NAME = MULT === 2.6 ? 'BB-1H-WIDE' : 'BB-CORE 1h (' + MULT + 'σ)';
const tr = one(MULT), ev = []; tr.forEach((t, i) => { ev.push([t.t, 0, i]); ev.push([t.tExit, 1, i]); }); ev.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
const acc = {}, get = (y) => acc[y] || (acc[y] = { bal: START, peak: START, dd: 0, m: {} });
const risk = {};
for (const [ts, k, i] of ev) {
  const yE = ym(tr[i].tExit)[0];
  if (k === 0) { const a = get(yE), [y0] = ym(ts); risk[i] = (y0 === yE ? a.bal * pct(a.peak) : START * pct(START)); }
  else { const a = get(yE), [, mo] = ym(ts), r = tr[i].R, pnl = r * risk[i]; const mm = a.m[mo] = a.m[mo] || { n: 0, w: 0, start: a.bal, pnl: 0 }; mm.n++; if (r > 0) mm.w++; mm.pnl += pnl; a.bal += pnl; a.peak = Math.max(a.peak, a.bal); a.dd = Math.max(a.dd, 1 - a.bal / a.peak); mm.end = a.bal; }
}
o += `\n## ${NAME}, live coins: fresh PHP 1,000 every Jan 1, month by month\n`;
for (const y of Y) {
  const a = acc[y]; let bal = START;
  o += `\n### ${y}: PHP 1,000 → ${fmtB(a.bal)} (${a.bal >= START ? '+' : ''}${Math.round(100 * (a.bal / START - 1))}%), worst fall −${Math.round(100 * a.dd)}%, ${Object.values(a.m).reduce((s, m) => s + m.n, 0)} trades\n| Month | Result | Balance | Trades (wins) |\n|---|---|---|---|\n`;
  for (let mo = 0; mo < 12; mo++) { const mm = a.m[mo]; if (y === 2026 && mo > 10) break; if (!mm) { o += `| ${M[mo]} | 0% | ${fmtB(bal)} | 0 |\n`; continue; } bal = mm.end; const p = mm.pnl / mm.start; o += `| ${M[mo]} | ${p >= 0 ? '+' : ''}${(100 * p).toFixed(0)}% | ${fmtB(mm.end)} | ${mm.n} (${mm.w}) |\n`; }
}
// month stats
const all = Y.flatMap((y) => Object.values(acc[y].m).map((m) => m.pnl / m.start));
o += `\nMonths with trades: ${all.length}; positive ${all.filter((v) => v > 0).length}; best +${Math.round(100 * Math.max(...all))}%; worst ${Math.round(100 * Math.min(...all))}%\n`;
require('fs').writeFileSync(MULT === 2.6 ? 'months.md' : 'months-core1h.md', o); console.log(o);
