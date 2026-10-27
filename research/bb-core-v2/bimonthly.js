// bimonthly.js — one continuous compounding account (RISK% of balance per new trade), % result of every 2-month block. node bimonthly.js [--risk 2.5] [--venue mexc]
'use strict';
const { runMerged } = require('./merged.js'); const { DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d), RISK = +opt('risk', 2.5) / 100, V = opt('venue', 'mexc');
const trades = COINS.flatMap((c) => { const D = loadCoin(c, V); return runMerged(D.B, 'two', DEFAULTS.cost, D.funding).trades; });
const ev = []; trades.forEach((t, k) => ev.push({ time: t.t, kind: 1, k }, { time: t.tExit, kind: 0, k })); ev.sort((a, b) => a.time - b.time || a.kind - b.kind);
let bal = 1; const risked = {}, blocks = {}, key = (s) => { const d = new Date(s * 1000); return d.getUTCFullYear() + '-' + Math.floor(d.getUTCMonth() / 2); };
for (const e of ev) { if (e.kind === 1) risked[e.k] = bal * RISK; else { const k = key(e.time), b = (blocks[k] ||= { start: bal, R: 0, n: 0 }); if (b.start === undefined) b.start = bal; const pnl = trades[e.k].R * risked[e.k]; bal += pnl; b.end = bal; b.R += trades[e.k].R; b.n++; } }
// block start = balance at the end of the previous block
const ks = Object.keys(blocks).sort(); let prev = 1; for (const k of ks) { blocks[k].start = prev; prev = blocks[k].end; }
const NAMES = ['Jan–Feb', 'Mar–Apr', 'May–Jun', 'Jul–Aug', 'Sep–Oct', 'Nov–Dec'], pc = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%', yrs = [...new Set(ks.map((k) => k.split('-')[0]))];
console.log(`# Merged strategy, ${RISK * 100}% risk compounding, % result of every 2-month block (${V.toUpperCase()}, trades counted when they close; data to 21 Oct 2026)\n`);
console.log('| year | ' + NAMES.join(' | ') + ' | full year |'); console.log('|---|' + NAMES.map(() => '---').join('|') + '|---|');
const all = [];
for (const y of yrs) { const cells = NAMES.map((_, i) => { const b = blocks[y + '-' + i]; if (!b) return '–'; const p = 100 * (b.end / b.start - 1); all.push([y, i, p, b.R]); return p < 0 ? `**${pc(p)}**` : pc(p); });
  const yk = ks.filter((k) => k.startsWith(y)), p = 100 * (blocks[yk[yk.length - 1]].end / blocks[yk[0]].start - 1); console.log(`| ${y}${y === '2020' ? '*' : ''}${y === '2026' ? '**' : ''} | ${cells.join(' | ')} | **${pc(p)}** |`); }
console.log('\nSame blocks in R (profit in multiples of the amount risked):\n'); console.log('| year | ' + NAMES.join(' | ') + ' |'); console.log('|---|' + NAMES.map(() => '---').join('|') + '|');
for (const y of yrs) console.log(`| ${y} | ${NAMES.map((_, i) => { const b = blocks[y + '-' + i]; return b ? (b.R < 0 ? '−' : '+') + Math.abs(b.R).toFixed(1) : '–'; }).join(' | ')} |`);
const full = all.filter((x) => !(x[0] === '2026' && x[1] === 4)), pos = all.filter((x) => x[2] > 0);
console.log(`\n${all.length} blocks: **${pos.length} up (${(100 * pos.length / all.length).toFixed(0)}%)**, ${all.length - pos.length} down. Median block ${pc(all.map((x) => x[2]).sort((a, b) => a - b)[Math.floor(all.length / 2)])}, average ${pc(all.reduce((a, x) => a + x[2], 0) / all.length)}. Worst ${pc(Math.min(...all.map((x) => x[2])))}, best ${pc(Math.max(...all.map((x) => x[2])))}.`);
console.log('\nBy season (all years):\n\n| block | years up | average | median | worst | best |\n|---|---|---|---|---|---|');
NAMES.forEach((n, i) => { const v = all.filter((x) => x[1] === i).map((x) => x[2]).sort((a, b) => a - b); console.log(`| ${n} | ${v.filter((a) => a > 0).length}/${v.length} | ${pc(v.reduce((a, b) => a + b, 0) / v.length)} | ${pc(v[Math.floor(v.length / 2)])} | ${pc(v[0])} | ${pc(v[v.length - 1])} |`); });
