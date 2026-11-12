// sui-arb.js — SUI and ARB on the three bots from their launch (ARB Mar 23 2023, SUI May 3 2023) to Nov 11 2026, next to the current coins.
// Bots = live rules (../strat-hunt-nov6), real fees, slippage, funding, 4h. Trades start after the 200-SMA warm-up (~34 days).
// TRI mix = 0.5 x BB-CORE + 0.25 x I-CORE + 0.25 x T-CORE. Common window for comparisons = Jun 10 2023 (SUI warm-up done) - Nov 11 2026.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), Z = path.join(__dirname, '../zec-replacement');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, WT = { 'BB-CORE': .5, 'I-CORE': .25, 'T-CORE': .25 };
const BASE = { 'BB-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'I-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'T-CORE': ['SOL', 'NEAR', 'ADA', 'GALA', 'ETH'] };
const COINS = ['SUI', 'ARB', 'SOL', 'NEAR', 'ADA', 'GALA', 'ETH'], NEW = ['SUI', 'ARB'];
const W0 = Date.UTC(2023, 5, 10) / 1000, END = Date.UTC(2026, 10, 12) / 1000, YEARS = [2023, 2024, 2025, 2026];
const by = id => S.find(s => s.id === id);
const T = {};
for (const c of COINS) {
  const f10 = path.join(Z, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(Z, 'funding', c + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  T[c] = { start: B[0].time };
  for (const [bot, p] of Object.entries(BOTS)) T[c][bot] = run(B, x.atr14, built[p], exitOf(p, x), F.length ? F : null, 14400, COST).trades.filter(t => t.tExit <= END).map(t => ({ x: t.tExit, R: t.R }));
  T[c].TRI = Object.keys(BOTS).flatMap(b => T[c][b].map(t => ({ x: t.x, R: t.R * WT[b] })));
}
const yr = t => new Date(t.x * 1e3).getUTCFullYear(), mo = t => { const d = new Date(t.x * 1e3); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
function st(tr, from = 0, to = END) {
  const s = tr.filter(t => t.x > from && t.x <= to).sort((a, b) => a.x - b.x); let e = 0, pk = 0, dd = 0, ls = 0, c = 0;
  for (const t of s) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); c = t.R <= 0 ? c + 1 : 0; ls = Math.max(ls, c); }
  const M = {}; for (const t of s) M[mo(t)] = (M[mo(t)] || 0) + t.R;
  // months counted from the first month with a closed trade to the last month of the window (months with no trade count as not positive)
  const m0 = s.length ? mo(s[0]) : 0, m1 = s.length ? Math.min(mo({ x: to - 1 }), mo({ x: END - 1 })) : -1, nM = s.length ? m1 - m0 + 1 : 0;
  const w = s.filter(t => t.R > 0), gw = w.reduce((a, t) => a + t.R, 0), gl = -s.filter(t => t.R <= 0).reduce((a, t) => a + t.R, 0);
  return { n: s.length, R: e, win: s.length ? w.length / s.length : 0, pf: gl ? gw / gl : 0, dd, streak: ls, posM: Object.values(M).filter(v => v > 0).length, nM, rdd: dd ? e / dd : 0 };
}
const yWin = (tr, y) => st(tr, Date.UTC(y, 0, 1) / 1000, Math.min(END, Date.UTC(y + 1, 0, 1) / 1000));
const f = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = v => (v * 100).toFixed(0) + '%';
const out = [];
const P = s => { console.log(s); out.push(s); };

P('# SUI and ARB on the bots, from launch (Binance perp: ARB 2023-03-23, SUI 2023-05-03) to Nov 11, 2026\n');
P('## 1. Year by year, TRI mix (0.5 BB-CORE + 0.25 I-CORE + 0.25 T-CORE), R');
P('| coin | 2023 (part) | 2024 | 2025 | 2026 (to Nov 11) | total | max DD | positive months |');
P('|---|---|---|---|---|---|---|---|');
for (const c of NEW) { const a = st(T[c].TRI); P(`| ${c} | ${YEARS.map(y => f(yWin(T[c].TRI, y).R)).join(' | ')} | ${f(a.R)} | ${a.dd.toFixed(1)}R | ${a.posM}/${a.nM} |`); }

for (const c of NEW) {
  P(`\n## 2. ${c}, each bot, by year`);
  P('| bot | year | trades | win | PF | R | max DD | losing streak | positive months |');
  P('|---|---|---|---|---|---|---|---|---|');
  for (const b of Object.keys(BOTS)) {
    for (const y of YEARS) { const s = yWin(T[c][b], y); P(`| ${b} | ${y} | ${s.n} | ${pc(s.win)} | ${s.pf.toFixed(2)} | ${f(s.R)} | ${s.dd.toFixed(1)} | ${s.streak} | ${s.posM}/${s.nM} |`); }
    const a = st(T[c][b]); P(`| **${b}** | **all** | **${a.n}** | **${pc(a.win)}** | **${a.pf.toFixed(2)}** | **${f(a.R)}** | **${a.dd.toFixed(1)}** | **${a.streak}** | **${a.posM}/${a.nM}** |`);
  }
}

P('\n## 3. Comparison, all coins, same window (Jun 10 2023 - Nov 11 2026)');
P('| coin | BB-CORE R (win, DD) | I-CORE R (win, DD) | T-CORE R (win, DD) | TRI mix R | TRI max DD | TRI return/DD | TRI positive months |');
P('|---|---|---|---|---|---|---|---|');
for (const c of COINS) { const b = Object.keys(BOTS).map(k => { const s = st(T[c][k], W0); return `${f(s.R)} (${pc(s.win)}, ${s.dd.toFixed(0)})`; }); const t = st(T[c].TRI, W0); P(`| ${c}${NEW.includes(c) ? ' (new)' : ''} | ${b.join(' | ')} | ${f(t.R)} | ${t.dd.toFixed(1)} | ${t.rdd.toFixed(1)} | ${t.posM}/${t.nM} |`); }

P('\n## 4. Positive months per year (TRI mix)');
P('| coin | 2023 (part) | 2024 | 2025 | 2026 | all |');
P('|---|---|---|---|---|---|');
for (const c of COINS) { const a = st(T[c].TRI, W0); P(`| ${c} | ${YEARS.map(y => { const s = yWin(T[c].TRI, y); return `${s.posM}/${s.nM}`; }).join(' | ')} | ${a.posM}/${a.nM} (${pc(a.posM / a.nM)}) |`); }

P('\n## 5. Merged into each bot (same risk per trade for every coin), Jun 10 2023 - Nov 11 2026');
P('| bot | coin set | total R | max DD | return/DD | positive months | SUI share of R | ARB share of R |');
P('|---|---|---|---|---|---|---|---|');
for (const b of Object.keys(BOTS)) for (const extra of [[], ['SUI'], ['ARB'], ['SUI', 'ARB']]) {
  const set = [...BASE[b], ...extra], all = set.flatMap(c => T[c][b]), s = st(all, W0);
  const share = c => extra.includes(c) ? pc(st(T[c][b], W0).R / s.R) : '-';
  P(`| ${b} | ${BASE[b].length} current${extra.length ? ' + ' + extra.join(' + ') : ''} | ${f(s.R)} | ${s.dd.toFixed(1)} | ${s.rdd.toFixed(2)} | ${s.posM}/${s.nM} | ${share('SUI')} | ${share('ARB')} |`);
}
P('\nTRI-CORE account (BB 50 / I 25 / T 25), every bot with the same coin change:');
P('| coin set | total R | max DD | return/DD | positive months | SUI share | ARB share |');
P('|---|---|---|---|---|---|---|');
for (const extra of [[], ['SUI'], ['ARB'], ['SUI', 'ARB']]) {
  const all = Object.keys(BOTS).flatMap(b => [...BASE[b], ...extra].flatMap(c => T[c][b].map(t => ({ x: t.x, R: t.R * WT[b], c })))), s = st(all, W0);
  const share = c => extra.includes(c) ? pc(st(all.filter(t => t.c === c), W0).R / s.R) : '-';
  P(`| current${extra.length ? ' + ' + extra.join(' + ') : ''} | ${f(s.R)} | ${s.dd.toFixed(1)} | ${s.rdd.toFixed(2)} | ${s.posM}/${s.nM} | ${share('SUI')} | ${share('ARB')} |`);
}
{ // per-bot assignment read off section 5 (hindsight): BB-CORE + ARB, I-CORE unchanged, T-CORE + SUI + ARB
  const ADD = { 'BB-CORE': ['ARB'], 'I-CORE': [], 'T-CORE': ['SUI', 'ARB'] };
  const all = Object.keys(BOTS).flatMap(b => [...BASE[b], ...ADD[b]].flatMap(c => T[c][b].map(t => ({ x: t.x, R: t.R * WT[b], c })))), s = st(all, W0);
  const share = c => pc(st(all.filter(t => t.c === c), W0).R / s.R);
  P(`| per bot: BB+ARB, I unchanged, T+SUI+ARB (hindsight) | ${f(s.R)} | ${s.dd.toFixed(1)} | ${s.rdd.toFixed(2)} | ${s.posM}/${s.nM} | ${share('SUI')} | ${share('ARB')} |`);
}
fs.writeFileSync(path.join(__dirname, 'SUI-ARB.md'), out.join('\n') + '\n');
