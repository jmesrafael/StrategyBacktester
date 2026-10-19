// mgmt.js — round 2: management rules on frozen v7 setups, re-executed live-style. Protocol in ITERATION-LOG.md (Round 2).
// usage: node mgmt.js → results/mgmt.md
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const SPLIT = D0('2023-10-18'), END = D0('2026-10-18'), START = { SOL: D0('2020-10-18'), ETH: D0('2019-12-15') };
const J = [['v7', {}], ['J1 50% off at +1R', { partialR: 1, partialFrac: 0.5 }], ['J2 50% off at +1.5R', { partialR: 1.5, partialFrac: 0.5 }],
  ['J3 33% off at +1R', { partialR: 1, partialFrac: 0.33 }], ['J4 flatten at 16:00 ET', { sessExit: true }], ['J5 time stop 8h', { maxHoldBars: 32 }]];
const coin = {}; for (const s of ['SOL', 'ETH']) { const D = E.analyze(s + '-binance', JSON.parse(fs.readFileSync(`data/binance-${s.toLowerCase()}15.json`, 'utf8')), C.swingLen); coin[s] = { D, S: E.setupsFor(D, C) }; }
const cells = [['SOL', false], ['SOL', true], ['ETH', false], ['ETH', true]];
const avg = (a) => a.reduce((x, t) => x + t.R, 0) / a.length, win = (a) => a.filter((t) => t.R > 0.05).length / a.length;
const f2 = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(2);
const runs = J.map(([n, o]) => { const out = []; for (const s of ['SOL', 'ETH']) for (const t of E.execute(coin[s].D, { ...C, ...o }, coin[s].S)) if (t.t >= START[s] && t.t < END) out.push({ sym: s, post: t.t >= SPLIT, R: t.R }); return [n, out]; });
const v7 = runs[0][1];
const L = ['# Round 2 — management rules, live-style re-simulation (SOL + ETH, Binance 15m, $1 risk)', '', 'Cell = average R per trade · share of trades ending positive (trades).', '',
  '| Rule | SOL 19–23 | SOL 23–26 | ETH 19–23 | ETH 23–26 | Cells ≥ v7 | Pooled avg | Positive trades | Total R | Max DD (R) | **Pass** |', '|---|---|---|---|---|---|---|---|---|---|---|'];
for (const [n, tr] of runs) {
  let better = 0;
  const txt = cells.map(([s, p]) => { const a = tr.filter((t) => t.sym === s && t.post === p), b = v7.filter((t) => t.sym === s && t.post === p); if (avg(a) >= avg(b) - 1e-9) better++; return `${f2(avg(a))} · ${(win(a) * 100).toFixed(0)}% (${a.length})`; });
  let c = 0, pk = 0, dd = 0; for (const t of tr) { c += t.R; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); }
  const pass = n !== 'v7' && better >= 3 && avg(tr) >= avg(v7);
  L.push(`| ${n} | ${txt.join(' | ')} | ${n === 'v7' ? '—' : better + '/4'} | ${f2(avg(tr))} | ${(win(tr) * 100).toFixed(0)}% | ${tr.reduce((a, t) => a + t.R, 0).toFixed(1)} | ${dd.toFixed(1)} | ${n === 'v7' ? '—' : pass ? '✅' : '❌'} |`);
}
fs.writeFileSync('results/mgmt.md', L.join('\n') + '\n'); console.log(L.join('\n'));
