// baseline.js — run the REAL bb-core and i-core algorithms on the same 4h BTC/ETH/SOL/ADA data; same account maths as my strategies.
const fs = require('fs'); const BB = require('../../../bb-core/lucidio-core.js'); const IC = require('../../js/icore-core.js');
const COINS = ['BTC', 'ETH', 'SOL', 'ADA'], SPLIT = Date.UTC(2023, 0, 1) / 1000;
// account: pooled trades by exit time, risk fraction of CURRENT equity per trade (closed-trade equity), per-trade R includes costs
function account(trades, rf = 0.025, lo = 0, hi = 1e12) {
  const tt = trades.filter(t => t.tExit >= lo && t.tExit < hi).sort((a, b) => a.tExit - b.tExit); let eq = 1, pk = 1, mdd = 0, w = 0, gp = 0, gl = 0, R = 0;
  const yr = {}; for (const t of tt) { const y = new Date(t.tExit * 1000).getUTCFullYear(); yr[y] = yr[y] || [1, 1]; const e0 = eq; eq *= 1 + rf * t.R; pk = Math.max(pk, eq); mdd = Math.min(mdd, eq / pk - 1); R += t.R; if (t.R > 0) { w++; gp += t.R; } else gl -= t.R; yr[y][1] = eq; }
  const years = (tt.length ? (tt[tt.length - 1].tExit - tt[0].tExit) / 31557600 : 0);
  return { n: tt.length, ret: eq - 1, cagr: years > .2 ? Math.pow(eq, 1 / years) - 1 : null, mdd, expR: tt.length ? R / tt.length : 0, totR: R, win: tt.length ? w / tt.length : 0, pf: gl ? gp / gl : 99, ccalmar: mdd ? (years > .2 ? Math.pow(eq, 1 / years) - 1 : 0) / -mdd : 0 };
}
module.exports = { account };
if (require.main === module) {
  const out = {};
  for (const [nm, core] of [['bb-core', BB], ['i-core', IC]]) {
    let all = [];
    for (const c of COINS) { const B = JSON.parse(fs.readFileSync(`data4h/${c}.json`)).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
      const r = core.backtest(B, nm === 'bb-core' ? {} : {}); const tr = r.trades.map(t => ({ ...t, tExit: t.tExit, coin: c })); all.push(...tr);
      const a = account(tr); console.log(nm, c, a.n, 'expR', a.expR.toFixed(2), 'totR', a.totR.toFixed(0)); }
    out[nm] = { full: account(all), train: account(all, .025, 0, SPLIT), test: account(all, .025, SPLIT), r1: account(all, .01), r05: account(all, .005) };
    console.log(nm, JSON.stringify(out[nm], (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
  }
  fs.writeFileSync('baseline.json', JSON.stringify(out));
}
