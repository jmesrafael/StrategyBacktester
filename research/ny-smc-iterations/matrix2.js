// matrix2.js — v3/v4/v5b on coins never used in tuning (BTC, DOGE, ZEC), each year separately.
const E = require('./ie.js');
const S2 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5 };
const V = [['v3', '+ fixed 3R target', { ...S2, tpMode: 'R', tpR: 3 }],
  ['v4', '+ CHoCH candle >= 1 ATR', { ...S2, tpMode: 'R', tpR: 3, minDispATR: 1 }],
  ['v5b', 'v4 + FVG >= 0.2 ATR', { ...S2, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2 }]];
const Ys = ['Y1', 'Y2', 'Y3'], s = (x) => (x >= 0 ? '+' : '') + x.toFixed(1);
const coins = ['BTC', 'DOGE', 'ZEC'];
for (const c of coins) { const r = E.load(c); console.error(c, r.length, new Date(r[0][0] * 1000).toISOString().slice(0, 10), new Date(r[r.length - 1][0] * 1000).toISOString().slice(0, 10)); }
const out = ['| Version | Coin | Y1 (Oct23–Oct24) | Y2 (Oct24–Oct25) | Y3 (Oct25–Oct26) | Years positive | All 3 coins positive (Y1 Y2 Y3) |', '|---|---|---|---|---|---|---|'];
const tot = {};
for (const [id, d, c] of V) {
  const res = coins.map((k) => E.runSym(k, c));
  const all = Ys.map((y) => res.every((r) => r.by[y].sumR > 0));
  res.forEach((r, i) => {
    const pos = Ys.filter((y) => r.by[y].sumR > 0).length;
    out.push(`| ${i === 0 ? '**' + id + '** ' + d : ''} | ${coins[i]} | ` + Ys.map((y) => `${s(r.by[y].sumR)}R · PF ${r.by[y].pf.toFixed(2)} · n=${r.by[y].n}`).join(' | ') + ` | ${pos}/3 | ` +
      (i === 0 ? all.map((b) => (b ? '✅' : '❌')).join(' ') + ` (${all.filter(Boolean).length}/3)` : '') + ' |');
  });
  const T = res.flatMap((r) => r.trades).sort((a, b) => a.t - b.t), A = E.stats(T);
  tot[id] = { n: A.n, pf: A.pfR, sumR: A.sumR, avgR: A.avgR, ddR: A.ddR, byYear: Ys.map((y) => E.stats(T.filter((t) => t.t >= E.Y[y][0] && t.t < E.Y[y][1])).sumR) };
}
console.log(out.join('\n'));
console.log('\nPOOLED BTC+DOGE+ZEC');
for (const [id, t] of Object.entries(tot)) console.log(id, `n=${t.n} PF=${t.pf.toFixed(2)} sumR=${t.sumR.toFixed(1)} avgR=${t.avgR.toFixed(3)} ddR=${t.ddR.toFixed(1)} byYear=${t.byYear.map(s).join(' / ')}`);
