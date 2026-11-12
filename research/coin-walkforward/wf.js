// wf.js — walk-forward coin pick: does a coin that improves a bot on Oct 2021-2023 still improve it on 2024-2026?
// Bots = the live rules (../strat-hunt-nov6: BBX = BB-CORE, P7 = I-CORE, P14 = T-CORE), real fees, slippage, funding, 4h.
// Base sets: BB-CORE / I-CORE = SOL NEAR ADA GALA; T-CORE = SOL NEAR ADA GALA ETH (the 6th-coin question was never tested).
// Coin added at the same risk per trade as the others. Metric = trade-by-trade return/max drawdown of the bot's whole coin set.
// Candidates: crypto with 4h data from before 2021 and MEXC futures volume >= $1M/day. IS = Oct 18 2021 - Dec 31 2023, OOS = 2024 - Nov 11 2026.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), Z = path.join(__dirname, '../zec-replacement'), Z2 = path.join(__dirname, '../zec-replacement-2');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'];
const BASE = { 'BB-CORE': KEEP, 'I-CORE': KEEP, 'T-CORE': [...KEEP, 'ETH'] };
const A = Date.UTC(2021, 9, 18) / 1000, M = Date.UTC(2024, 0, 1) / 1000, E = Date.UTC(2026, 10, 11) / 1000;
const vol = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(Z2, 'ticker.json'), 'utf8')).data.map(t => [t.symbol, +t.amount24]));
const by = id => S.find(s => s.id === id);
function load(c) {
  const f10 = path.join(Z, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(Z, 'funding', c + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  return { B, F: F.length ? F : null };
}
const names = [...new Set([...fs.readdirSync(path.join(Z, 'data4h')), ...fs.readdirSync(path.join(Z, 'data4h-10y'))].map(f => f.replace('.json', '')))].filter(n => n !== 'ZEC');
const T = {};
for (const c of names) {
  const { B, F } = load(c); if (B.length < 600 || (!KEEP.includes(c) && c !== 'ETH' && B[205].time > Date.UTC(2021, 3, 1) / 1000)) continue;   // needs full IS history
  if (!KEEP.includes(c) && c !== 'ETH' && !((vol[c + '_USDT'] || 0) >= 1e6)) continue;
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  T[c] = {};
  for (const [bot, p] of Object.entries(BOTS)) {
    T[c][bot] = run(B, x.atr14, built[p], exitOf(p, x), F, 14400, COST).trades.map(t => ({ x: t.tExit, R: t.R }));
    T[c][bot + 'x2'] = run(B, x.atr14, built[p], exitOf(p, x), F, 14400, { fee: COST.fee * 2, slip: COST.slip * 2 }).trades.map(t => ({ x: t.tExit, R: t.R }));
  }
}
const cut = (tr, a, b) => tr.filter(t => t.x > a && t.x <= b);
function curve(tr) { const s = [...tr].sort((p, q) => p.x - q.x); let e = 0, pk = 0, d = 0; for (const t of s) { e += t.R; pk = Math.max(pk, e); d = Math.max(d, pk - e); } return { tot: e, dd: d, rdd: d > 0 ? e / d : 0 }; }
const sum = tr => tr.reduce((a, t) => a + t.R, 0);
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length); idx.forEach(([, i], k) => r[i] = k); return r; };
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let s = 0, a = 0, b = 0; for (let i = 0; i < n; i++) { s += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2; } return s / Math.sqrt(a * b); };
const out = {};
for (const bot of Object.keys(BOTS)) {
  const base = BASE[bot].flatMap(c => T[c][bot]), bI = curve(cut(base, A, M)), bO = curve(cut(base, M, E));
  const rows = [];
  for (const c of Object.keys(T)) {
    if (BASE[bot].includes(c)) continue;
    const tr = T[c][bot], wI = curve([...cut(base, A, M), ...cut(tr, A, M)]), wO = curve([...cut(base, M, E), ...cut(tr, M, E)]);
    rows.push({ coin: c, mexcM: (vol[c + '_USDT'] || 0) / 1e6, isCoin: sum(cut(tr, A, M)), oosCoin: sum(cut(tr, M, E)), isX2: sum(cut(T[c][bot + 'x2'], A, M)), oosX2: sum(cut(T[c][bot + 'x2'], M, E)),
      gI: wI.rdd - bI.rdd, gO: wO.rdd - bO.rdd, ddI: wI.dd - bI.dd, ddO: wO.dd - bO.dd, totI: wI.tot - bI.tot, totO: wO.tot - bO.tot });
  }
  const rho = corr(rank(rows.map(r => r.gI)), rank(rows.map(r => r.gO)));
  const picked = rows.filter(r => r.gI > 0 && r.isCoin > 0 && r.isX2 > 0).sort((p, q) => q.gI - p.gI);
  out[bot] = { base: { is: bI, oos: bO, coins: BASE[bot] }, rho, rows, picked: picked.map(r => r.coin) };
  console.log(`\n## ${bot} on ${BASE[bot].join(' ')} — base return/DD IS ${bI.rdd.toFixed(2)} (${bI.tot.toFixed(0)}R/${bI.dd.toFixed(1)}R), OOS ${bO.rdd.toFixed(2)} (${bO.tot.toFixed(0)}R/${bO.dd.toFixed(1)}R)`);
  console.log(`${rows.length} candidates. Rank corr of IS gain vs OOS gain: ${rho.toFixed(2)}. Improve IS: ${rows.filter(r => r.gI > 0).length}, OOS: ${rows.filter(r => r.gO > 0).length}, both: ${rows.filter(r => r.gI > 0 && r.gO > 0).length}`);
  console.log(`Picked on IS (gain > 0, coin positive IS incl. 2x costs): ${picked.length}  -> still improving OOS: ${picked.filter(r => r.gO > 0).length}`);
  console.log('coin    MEXC$M | IS: gain  +R   +DD  coinR | OOS: gain  +R   +DD  coinR  coinR@2x');
  for (const r of picked.slice(0, 15)) console.log(`${r.coin.padEnd(7)} ${r.mexcM.toFixed(0).padStart(5)} | ${r.gI.toFixed(2).padStart(5)} ${r.totI.toFixed(0).padStart(4)} ${r.ddI.toFixed(1).padStart(5)} ${r.isCoin.toFixed(0).padStart(5)} | ${r.gO.toFixed(2).padStart(5)} ${r.totO.toFixed(0).padStart(4)} ${r.ddO.toFixed(1).padStart(5)} ${r.oosCoin.toFixed(0).padStart(5)} ${r.oosX2.toFixed(0).padStart(6)}`);
}
fs.writeFileSync(path.join(__dirname, 'wf.json'), JSON.stringify(out));
