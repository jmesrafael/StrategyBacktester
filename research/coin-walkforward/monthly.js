// monthly.js — month-by-month and year-by-year R for every coin on every bot, plus the TRI-CORE account configs.
// Same trades as sui-arb.js (live rules from ../strat-hunt-nov6, real fees, slippage, funding, 4h, R at exit time).
// Writes MONTHLY.md and monthly.json.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), Z = path.join(__dirname, '../zec-replacement');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, WT = { 'BB-CORE': .5, 'I-CORE': .25, 'T-CORE': .25 };
const BASE = { 'BB-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'I-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'T-CORE': ['SOL', 'NEAR', 'ADA', 'GALA', 'ETH'] };
const COINS = ['SUI', 'ARB', 'SOL', 'NEAR', 'ADA', 'GALA', 'ETH'];
const W0 = Date.UTC(2023, 5, 10) / 1000, END = Date.UTC(2026, 10, 12) / 1000;
const by = id => S.find(s => s.id === id);
const T = {}, start = {};
for (const c of COINS) {
  const f10 = path.join(Z, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(Z, 'funding', c + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  T[c] = {}; start[c] = B[0].time;
  for (const [bot, p] of Object.entries(BOTS)) T[c][bot] = run(B, x.atr14, built[p], exitOf(p, x), F.length ? F : null, 14400, COST).trades.filter(t => t.tExit <= END).map(t => ({ x: t.tExit, R: t.R }));
  T[c].TRI = Object.keys(BOTS).flatMap(b => T[c][b].map(t => ({ x: t.x, R: t.R * WT[b] })));
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = x => { const d = new Date(x * 1e3); return [d.getUTCFullYear(), d.getUTCMonth()]; };
const f = v => v == null ? '' : (v >= 0 ? '+' : '') + v.toFixed(1);
// grid: {year: [12 monthly sums or null]}; months from the first trade month to Nov 2026 are filled (0 if no trade)
function grid(tr, from = 0) {
  const s = tr.filter(t => t.x > from && t.x <= END); if (!s.length) return {};
  const [y0, m0] = ym(Math.min(...s.map(t => t.x))), [y1, m1] = ym(END - 1), G = {};
  for (let y = y0; y <= y1; y++) G[y] = MON.map((_, m) => (y === y0 && m < m0) || (y === y1 && m > m1) ? null : 0);
  for (const t of s) { const [y, m] = ym(t.x); G[y][m] += t.R; }
  return G;
}
function dd(tr, from = 0) { let e = 0, pk = 0, d = 0; for (const t of tr.filter(t => t.x > from && t.x <= END).sort((a, b) => a.x - b.x)) { e += t.R; pk = Math.max(pk, e); d = Math.max(d, pk - e); } return d; }
const out = [], P = s => out.push(s), J = {};
function table(title, tr, from = 0, key) {
  const G = grid(tr, from), ys = Object.keys(G);
  if (!ys.length) return;
  let tot = 0, pos = 0, n = 0;
  P(`\n### ${title}`);
  P(`| year | ${MON.join(' | ')} | **year** | +months |`);
  P(`|---|${MON.map(() => '---:').join('|')}|---:|---:|`);
  for (const y of ys) {
    const row = G[y], live = row.filter(v => v != null), yt = live.reduce((a, b) => a + b, 0), yp = live.filter(v => v > 0).length;
    tot += yt; pos += yp; n += live.length;
    P(`| ${y} | ${row.map(f).join(' | ')} | **${f(yt)}** | ${yp}/${live.length} |`);
  }
  const colTot = MON.map((_, m) => { const v = ys.map(y => G[y][m]).filter(v => v != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; });
  P(`| **Total** | ${colTot.map(v => v == null ? '' : `**${f(v)}**`).join(' | ')} | **${f(tot)}** | ${pos}/${n} |`);
  P(`Max drawdown ${dd(tr, from).toFixed(1)}R.`);
  if (key) J[key] = { title, grid: G, dd: dd(tr, from), total: tot, pos, n };
}
P('# Monthly and yearly R: every coin on every bot, and the TRI-CORE account configs');
P('\nSame trades as `sui-arb.js` / `SUI-ARB.md`: live bot rules, Binance 4h, real fees, slippage and funding, 1R per trade, R booked in the month the trade closes.');
P('History per coin starts at the oldest 4h data the study has; SUI and ARB start at their Binance launch (ARB 2023-03-23, SUI 2023-05-03) plus the ~34-day 200-SMA warm-up.');
P('Data runs to Nov 11 2026, so **Nov 2026 is a partial month**. TRI mix = 0.5 x BB-CORE + 0.25 x I-CORE + 0.25 x T-CORE.');

// 1. year summary, every coin x bot (full history)
P('\n## 1. Year by year, each coin on each bot (R, full history)');
const allY = [...new Set(COINS.flatMap(c => Object.keys(grid(T[c].TRI))))].sort();
for (const b of [...Object.keys(BOTS), 'TRI']) {
  P(`\n### ${b === 'TRI' ? 'TRI mix (BB 50 / I 25 / T 25)' : b}`);
  P(`| coin | ${allY.join(' | ')} | total | max DD | in the bot now? |`);
  P(`|---|${allY.map(() => '---:').join('|')}|---:|---:|---|`);
  for (const c of COINS) {
    const G = grid(T[c][b]), cell = y => G[y] ? f(G[y].filter(v => v != null).reduce((a, v) => a + v, 0)) : '';
    const tot = Object.values(G).flat().filter(v => v != null).reduce((a, v) => a + v, 0);
    const inBot = b === 'TRI' ? '' : BASE[b].includes(c) ? 'yes' : 'no';
    P(`| ${c} | ${allY.map(cell).join(' | ')} | **${f(tot)}** | ${dd(T[c][b]).toFixed(1)} | ${inBot} |`);
  }
}
// 2. account configs, monthly (common window)
P('\n## 2. TRI-CORE account configs, month by month (Jun 10 2023 - Nov 11 2026, the window of SUI-ARB.md section 5)');
const CFG = {
  'Current': { 'BB-CORE': [], 'I-CORE': [], 'T-CORE': [] },
  'ARB everywhere': { 'BB-CORE': ['ARB'], 'I-CORE': ['ARB'], 'T-CORE': ['ARB'] },
  'SUI everywhere': { 'BB-CORE': ['SUI'], 'I-CORE': ['SUI'], 'T-CORE': ['SUI'] },
  'SUI + ARB everywhere': { 'BB-CORE': ['SUI', 'ARB'], 'I-CORE': ['SUI', 'ARB'], 'T-CORE': ['SUI', 'ARB'] },
  'Selective (BB+ARB, I unchanged, T+SUI+ARB)': { 'BB-CORE': ['ARB'], 'I-CORE': [], 'T-CORE': ['SUI', 'ARB'] },
};
const acct = add => Object.keys(BOTS).flatMap(b => [...BASE[b], ...add[b]].flatMap(c => T[c][b].map(t => ({ x: t.x, R: t.R * WT[b] }))));
for (const [k, add] of Object.entries(CFG)) table(`Account: ${k}`, acct(add), W0, 'acct:' + k);
// difference selective - current, per month
{
  const a = grid(acct(CFG['Selective (BB+ARB, I unchanged, T+SUI+ARB)']), W0), c = grid(acct(CFG.Current), W0);
  P('\n### Selective minus Current (what the added coins changed, per month)');
  P(`| year | ${MON.join(' | ')} | **year** | months better |`);
  P(`|---|${MON.map(() => '---:').join('|')}|---:|---:|`);
  for (const y of Object.keys(c)) {
    const d = c[y].map((v, m) => v == null ? null : (a[y]?.[m] || 0) - v), live = d.filter(v => v != null);
    P(`| ${y} | ${d.map(f).join(' | ')} | **${f(live.reduce((s, v) => s + v, 0))}** | ${live.filter(v => v > 1e-9).length}/${live.length} |`);
  }
}
// 3. bot-level coin sets, monthly (common window)
P('\n## 3. Each bot with its coin set, month by month (Jun 10 2023 - Nov 11 2026)');
for (const b of Object.keys(BOTS)) for (const extra of [[], ['ARB'], ['SUI'], ['SUI', 'ARB']]) {
  table(`${b}: ${BASE[b].length} current${extra.length ? ' + ' + extra.join(' + ') : ''}`, [...BASE[b], ...extra].flatMap(c => T[c][b]), W0, `bot:${b}:${extra.join('+') || 'current'}`);
}
// 4. every coin x bot, monthly (full history)
P('\n## 4. Every coin on every bot, month by month (full history)');
for (const c of COINS) {
  P(`\n## ${c}`);
  for (const b of Object.keys(BOTS)) table(`${c} on ${b}${BASE[b].includes(c) ? '' : ' (not in this bot now)'}`, T[c][b], 0, `${c}:${b}`);
  table(`${c}, TRI mix`, T[c].TRI, 0, `${c}:TRI`);
}
fs.writeFileSync(path.join(__dirname, 'MONTHLY.md'), out.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'monthly.json'), JSON.stringify(J));
console.log(out.slice(0, 45).join('\n'));
