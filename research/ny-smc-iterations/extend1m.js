// extend1m.js — the 1m replay can run longer than the 15m trade did (e.g. no follow-through tightening in 1m).
// Download more 1m candles, from the first missing minute onward, until every v7 trade has finished in the replay.
const fs = require('fs'), T = require('./trades-windows.js'), X = require('./execC.js');
const SYM = { SOL: 'SOLUSDT', ETH: 'ETHUSDT' }, TICK = { SOL: 0.001, ETH: 0.01 };
const get = async (url) => { for (let i = 0; i < 6; i++) { try { const j = await (await fetch(url)).json(); if (j.retCode === 0) return j.result.list; } catch {} await new Promise((r) => setTimeout(r, 800 * (i + 1))); } throw new Error('fetch failed'); };
(async () => {
  for (const s of ['SOL', 'ETH']) {
    const { D, trades } = T.build(s), f = `data/m1-${s.toLowerCase()}.json`;
    const m1 = new Map(JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => [r[0], r]));
    let added = 0;
    for (const t of trades) {
      for (let guard = 0; guard < 40; guard++) {
        const r = X.replay1m(D, T.C, t, m1, TICK[s]);
        if (!r || !r.missingAt) break;
        const a = r.missingAt;
        const list = await get(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${SYM[s]}&interval=1&start=${a * 1000}&end=${(a + 1000 * 60 - 1) * 1000}&limit=1000`);
        for (const k of list) { const tt = +k[0] / 1000; if (!m1.has(tt)) { m1.set(tt, [tt, +k[1], +k[2], +k[3], +k[4]]); added++; } }
        await new Promise((r2) => setTimeout(r2, 50));
      }
    }
    fs.writeFileSync(f, JSON.stringify([...m1.values()].sort((x, y) => x[0] - y[0])));
    const left = trades.filter((t) => { const r = X.replay1m(D, T.C, t, m1, TICK[s]); return !r || r.missingAt; }).length;
    console.log(s, 'added', added, 'minutes; trades still incomplete:', left);
  }
})();
