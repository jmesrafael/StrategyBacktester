// matrix3.js — frozen v4 / v5b / v6 / v7 on coins NOT used for tuning: BTC, DOGE, ZEC, XRP. Each year separately.
const fs = require('fs'), E = require('./ie.js');
const S2 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5 };
const v4 = { ...S2, tpMode: 'R', tpR: 3, minDispATR: 1 }, v5b = { ...v4, minFvgATR: 0.2 };
const REF = { chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };
const V = [['v4', v4], ['v5b', v5b], ['v6', { ...v4, ...REF }], ['v7', { ...v5b, ...REF }]];
const coins = ['BTC', 'DOGE', 'ZEC', 'XRP'], Ys = ['Y1', 'Y2', 'Y3'], sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(1);
const md = ['| Version | Coin | Y1 (Oct23–Oct24) | Y2 (Oct24–Oct25) | Y3 (Oct25–Oct26) | Years positive |', '|---|---|---|---|---|---|'];
const pool = ['| Version | Trades | PF | Total R | Avg R | Max DD (R) | Y1 | Y2 | Y3 | Coin-years positive |', '|---|---|---|---|---|---|---|---|---|---|'];
for (const [id, c] of V) {
  const res = coins.map((k) => E.runSym(k, c));
  let pos = 0;
  res.forEach((r, i) => { const p = Ys.filter((y) => r.by[y].sumR > 0).length; pos += p;
    md.push(`| ${i ? '' : '**' + id + '**'} | ${coins[i]} | ` + Ys.map((y) => `${sg(r.by[y].sumR)}R · PF ${r.by[y].pf.toFixed(2)} · n=${r.by[y].n}`).join(' | ') + ` | ${p}/3 |`); });
  const T = res.flatMap((r) => r.trades).sort((a, b) => a.t - b.t), A = E.stats(T);
  const yr = Ys.map((y) => sg(E.stats(T.filter((t) => t.t >= E.Y[y][0] && t.t < E.Y[y][1])).sumR) + 'R');
  pool.push(`| ${id} | ${A.n} | ${A.pfR.toFixed(2)} | ${sg(A.sumR)} | ${(A.avgR >= 0 ? '+' : '') + A.avgR.toFixed(2)} | ${A.ddR.toFixed(1)} | ${yr.join(' | ')} | ${pos}/12 |`);
}
const txt = ['## Unseen coins, per coin per year', '', ...md, '', '## Pooled BTC + DOGE + ZEC + XRP', '', ...pool].join('\n');
fs.writeFileSync(__dirname + '/results/unseen-coins.md', txt); console.log(txt);
