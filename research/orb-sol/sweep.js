// Grid sweep. Selection uses IN-SAMPLE only (Oct 2020 - Dec 2023); 2024+ is held out.
const fs = require('fs'), { run } = require('./engine');
const tfArg = +(process.argv[2] || 60), coin = (process.argv[3] || 'SOL').toUpperCase();
const FS = [[], ['vwap'], ['rvol'], ['narrow'], ['pd'], ['ema'], ['vwap', 'rvol'], ['vwap', 'rvol', 'narrow'], ['vwap', 'rvol', 'pd'], ['vwap', 'rvol', 'ema']];
const rows = []; const t0 = Date.now();
for (const session of ['utc0', 'ldn', 'ny'])
  for (const orBars of tfArg === 60 ? [1, 2, 4] : [1, 2])
    for (const stop of ['mid', 'opp', 'bar'])
      for (const target of [1, 1.5, 2, 3, 0])
        for (const entry of ['close', 'retest'])
          for (const dir of ['both', 'long'])
            for (const filters of FS) {
              const cfg = { coin, tf: tfArg, session, orBars, stop, target, entry, dir, filters };
              const r = run(cfg);
              rows.push({ cfg, all: r.all, is: r.is, oos: r.oos, years: r.years, ret: r.retPct, maxDD: r.maxDD, maxDDR: r.maxDDR, perMonth: r.perMonth });
            }
fs.writeFileSync(coin === 'SOL' ? `sweep-${tfArg}.json` : `sweep-${coin}-${tfArg}.json`, JSON.stringify(rows));
console.log(coin, tfArg, rows.length, 'configs', ((Date.now() - t0) / 1000).toFixed(0) + 's');
