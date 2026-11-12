// recent.js — which coins were profitable on the bots in 2025 and in 2026 (to Nov 11)? Bots = live rules, real costs, 4h.
// Coins: every coin in ../zec-replacement/data4h with history from before Nov 2024 (full 2025 after the 200-SMA warm-up).
// TRI view = 0.5 x BB-CORE + 0.25 x I-CORE + 0.25 x T-CORE (R per trade at each bot's own risk).
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), Z = path.join(__dirname, '../zec-replacement'), Z2 = path.join(__dirname, '../zec-replacement-2');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, CUR = { 'BB-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'I-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'T-CORE': ['SOL', 'NEAR', 'ADA', 'GALA', 'ETH'] };
const vol = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(Z2, 'ticker.json'), 'utf8')).data.map(t => [t.symbol, +t.amount24]));
const Y25 = Date.UTC(2025, 0, 1) / 1000, Y26 = Date.UTC(2026, 0, 1) / 1000, END = Date.UTC(2026, 10, 12) / 1000;
const by = id => S.find(s => s.id === id);
const names = [...new Set([...fs.readdirSync(path.join(Z, 'data4h')), ...fs.readdirSync(path.join(Z, 'data4h-10y'))].map(f => f.replace('.json', '')))];
const rows = [];
for (const c of names) {
  const f10 = path.join(Z, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  if (B.length < 600 || B[0].time > Date.UTC(2024, 10, 1) / 1000) continue;
  const fp = path.join(Z, 'funding', c + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  const r = { coin: c, mexcM: (vol[c + '_USDT'] || 0) / 1e6, from: new Date(B[0].time * 1e3).toISOString().slice(0, 7) };
  for (const [bot, p] of Object.entries(BOTS)) {
    const tr = run(B, x.atr14, built[p], exitOf(p, x), F.length ? F : null, 14400, COST).trades;
    const y = (a, b) => { const t = tr.filter(q => q.tExit >= a && q.tExit < b); return { n: t.length, R: t.reduce((s, q) => s + q.R, 0), win: t.length ? t.filter(q => q.R > 0).length / t.length : 0 }; };
    r[bot] = { y25: y(Y25, Y26), y26: y(Y26, END) };
  }
  r.tri25 = .5 * r['BB-CORE'].y25.R + .25 * r['I-CORE'].y25.R + .25 * r['T-CORE'].y25.R;
  r.tri26 = .5 * r['BB-CORE'].y26.R + .25 * r['I-CORE'].y26.R + .25 * r['T-CORE'].y26.R;
  rows.push(r);
}
const f = v => (v >= 0 ? '+' : '') + v.toFixed(1);
const cur = c => Object.values(CUR).some(a => a.includes(c)) ? '*' : ' ';
rows.sort((a, b) => (b.tri25 + b.tri26) - (a.tri25 + a.tri26));
const both = rows.filter(r => r.tri25 > 0 && r.tri26 > 0);
console.log(`${rows.length} coins. Profitable on the TRI-CORE mix in BOTH 2025 and 2026: ${both.length}. (* = coin a bot already trades)\n`);
console.log('coin    MEXC$M/d from    | TRI 2025  2026 | BB-CORE 2025 (n, win)   2026 (n, win)  | I-CORE 2025   2026 | T-CORE 2025   2026');
const line = r => `${(r.coin + cur(r.coin)).padEnd(8)}${r.mexcM.toFixed(1).padStart(6)} ${r.from} | ${f(r.tri25).padStart(6)} ${f(r.tri26).padStart(6)} | ${f(r['BB-CORE'].y25.R).padStart(6)} (${r['BB-CORE'].y25.n}, ${(r['BB-CORE'].y25.win * 100).toFixed(0)}%) ${f(r['BB-CORE'].y26.R).padStart(7)} (${r['BB-CORE'].y26.n}, ${(r['BB-CORE'].y26.win * 100).toFixed(0)}%) | ${f(r['I-CORE'].y25.R).padStart(6)} ${f(r['I-CORE'].y26.R).padStart(6)} | ${f(r['T-CORE'].y25.R).padStart(6)} ${f(r['T-CORE'].y26.R).padStart(6)}`;
for (const r of rows) if (r.tri25 > 0 && r.tri26 > 0 || cur(r.coin) === '*') console.log(line(r));
console.log('\nPer bot: coins positive in both 2025 and 2026');
for (const bot of Object.keys(BOTS)) { const a = rows.filter(r => r[bot].y25.R > 0 && r[bot].y26.R > 0).sort((p, q) => (q[bot].y25.R + q[bot].y26.R) - (p[bot].y25.R + p[bot].y26.R)); console.log(`${bot} (${a.length}): ` + a.map(r => `${r.coin}${cur(r.coin)} ${f(r[bot].y25.R)}/${f(r[bot].y26.R)}`).join(', ')); }
fs.writeFileSync(path.join(__dirname, 'recent.json'), JSON.stringify(rows));
