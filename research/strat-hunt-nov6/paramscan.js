// paramscan.js — plateau check for the bb-core-entry family: keep the bot's entry + Bollinger-middle stop, vary the trail and the time cap.
// A real improvement should sit on a plateau (neighbouring settings all similar), not on one lucky cell.
'use strict';
const { load, COINS } = require('./data.js'), { run, stats } = require('./engine.js'), { S, makeCtx } = require('./strategies.js');
const bbc = S.find((s) => s.id === 'bb-core');
const TRAILS = [0, 3, 4, 5, 7, 10, 14], CAPS = [48, 96, 192, 0];
for (const tf of ['4h', '1h']) {
  const data = COINS.map((coin) => { const d = load(coin, tf), c = makeCtx(d.B, tf); return { ...d, c, st: bbc.build(c) }; });
  console.log(`\n### ${tf}: bb-core entry + Bollinger-middle stop; rows = ATR trail (x ${tf === '4h' ? 1 : 2} on 1h), columns = time cap in candles (${tf === '4h' ? '' : 'x4: '}48/96/192/none)`);
  console.log('cell = total R / maxDD R / [2022 R, 2023 R] / shorts R   (5 coins pooled, real costs + funding)');
  for (const kt of TRAILS) {
    const cells = CAPS.map((cap) => {
      if (kt === 0 && cap === 0) return '(no exit)'.padEnd(34);
      const all = []; let sh = 0;
      for (const d of data) { const r = run(d.B, d.c.atr14, d.st, { kInit: 0, kTrail: kt * d.c.sq, maxBars: cap * d.c.k, sigExit: false }, d.funding, d.iv); all.push(...r.trades); sh += r.trades.filter((t) => t.dir === -1).reduce((a, t) => a + t.R, 0); }
      const s = stats(all);
      return `${s.total.toFixed(0)}/${s.dd.toFixed(0)}/[${(s.years[2022] || 0).toFixed(0)},${(s.years[2023] || 0).toFixed(0)}]/${sh.toFixed(0)}`.padEnd(34);
    });
    console.log(`trail ${String(kt).padStart(2)} | ` + cells.join(' | '));
  }
}
