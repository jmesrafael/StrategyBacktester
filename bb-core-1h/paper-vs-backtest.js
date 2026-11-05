// paper-vs-backtest.js — does the paper bot do what the backtest says on the same MEXC candles? Read-only.  node paper-vs-backtest.js
// Compares each entry since the paper run started. Paper fills at the price when it wakes and the backtest at the candle open, so R differs slightly even when entries match.
// Expect a few "backtest only / paper only" right after the start: the backtest may already hold a trade the paper bot (which started flat) does not.
'use strict';
const fs = require('fs'), path = require('path'); const mexc = require('./mexc.js'); const { backtest } = require('./lucidio-core.js');
const STATE = process.env.LUCIDIO_STATE_DIR || path.join(__dirname, 'state'), IV = 3600, d = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
(async () => {
  const s = JSON.parse(fs.readFileSync(path.join(STATE, 'state.json'), 'utf8')), start = Math.floor(Date.parse(s.startedAt) / 1000);
  console.log(`Paper run since ${d(start)} UTC · balance $${(+s.balance).toFixed(2)} · total ${(+s.totalR || 0).toFixed(2)}R\n`);
  let M = 0, PO = 0, BO = 0, pR = 0, bR = 0;
  for (const coin of Object.keys(s.coins)) {
    const st = s.coins[coin], now = Math.floor(Date.now() / 1000), B = new Map();
    for (let a = start - 1100 * IV; a < now; a += 1900 * IV) for (const c of await mexc.client.klines(`${coin}_USDT`, 'Min60', a, Math.min(now, a + 1900 * IV))) B.set(c.time, c);
    const arr = [...B.values()].sort((x, y) => x.time - y.time); arr.pop();                     // drop the forming candle
    const r = backtest(arr), bt = r.trades.filter((t) => t.t >= start), openT = r.open ? arr[r.open.i0].time : null;
    const paper = st.trades || [], pSet = new Set(paper.map((t) => t.t)); if (st.pos) pSet.add(st.pos.t0);
    const bSet = new Set(bt.map((t) => t.t)); if (openT && openT >= start) bSet.add(openT);
    const m = [...pSet].filter((t) => bSet.has(t)), po = [...pSet].filter((t) => !bSet.has(t)), bo = [...bSet].filter((t) => !pSet.has(t));
    for (const t of paper) { const b = bt.find((x) => x.t === t.t); if (b) { pR += t.R; bR += b.R; } }
    M += m.length; PO += po.length; BO += bo.length;
    console.log(`${coin.padEnd(5)} matched ${m.length} · paper only ${po.length}${po.length ? ' (' + po.map(d).join(', ') + ')' : ''} · backtest only ${bo.length}${bo.length ? ' (' + bo.map(d).join(', ') + ')' : ''}`);
  }
  console.log(`\nTOTAL matched ${M} · paper only ${PO} · backtest only ${BO}\nClosed matched trades: paper ${pR.toFixed(2)}R vs backtest ${bR.toFixed(2)}R (before funding, which paper does not charge)`);
})().catch((e) => { console.error('failed: ' + e.message); process.exit(1); });
