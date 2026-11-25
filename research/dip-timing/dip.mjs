const D = await import('file:///D:/testing/Strat/StrategyBacktester/scripts/backtest-report-data-v2.mjs');
const { build, at, END } = D;
const pts = build().nofee.pts, DAY = 86400, s = pts[0][0];
const days = []; let pk = 0, i = 0;
for (let t = s; t <= END; t += DAY) { while (i < pts.length && pts[i][0] <= t) { pk = Math.max(pk, pts[i][1]); i++; } const v = at(pts, t); days.push({ t, v, dd: 1 - v / pk }); }
const B = [['Near high (0-5% down)', 0, .05], ['5-15% down', .05, .15], ['15-30% down', .15, .30], ['Over 30% down', .30, 1.01]];
const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; };
const periods = [['ALL', 0, 9e9], ['2020-2022', 0, Date.UTC(2023,0,1)/1000], ['2023-2026', Date.UTC(2023,0,1)/1000, 9e9]];
for (const [pn, a, b] of periods) { console.log('\n== ' + pn);
  for (const h of [30, 90, 180]) { console.log(`-- next ${h} days`);
    for (const [n, lo, hi] of [...B, ['Any day', -1, 2]]) {
      const idx = days.map((d, k) => k).filter((k) => k + h < days.length && days[k].t >= a && days[k].t < b && days[k].dd >= lo && days[k].dd < hi);
      const r = idx.map((k) => days[k + h].v / days[k].v - 1);
      const worst = idx.map((k) => { let m = 0; for (let j = k; j <= k + h; j++) m = Math.min(m, days[j].v / days[k].v - 1); return m; });
      let ep = 0, last = -1e9; for (const k of idx) { if (k - last > h) { ep++; last = k; } }
      console.log(`${n.padEnd(22)} days ${String(idx.length).padStart(5)} indep~${String(ep).padStart(3)}  up ${(100 * r.filter((x) => x > 0).length / r.length).toFixed(0)}%  median ${(100 * med(r)).toFixed(0)}%  median further drop ${(100 * med(worst)).toFixed(0)}%`);
    } } }
console.log('\ncurrent dd', days.at(-1).dd, 'end', new Date(END*1000).toISOString());
