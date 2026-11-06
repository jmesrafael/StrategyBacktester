// run.js — all strategies x exit profiles x 5 coins x (4h, 1h). Writes results.json (+ trades.json for follow-up studies).
//   node run.js [costMultiplier]   (default 1 = the bot's real costs; 2 = double fees+slippage)
'use strict';
const fs = require('fs');
const { load, COINS } = require('./data.js'), { run, stats, COST } = require('./engine.js'), { S, makeCtx, exitOf } = require('./strategies.js');
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const K = +(args.find((a) => /^[0-9.]+$/.test(a)) || 1), ONLY = opt('only') ? opt('only').split(',') : null, NAME = opt('out'), cost = { fee: COST.fee * K, slip: COST.slip * K };
const out = {}, tradesOut = {};
for (const tf of ['4h', '1h']) {
  for (const coin of COINS) {
    const { B, iv, funding } = load(coin, tf), c = makeCtx(B, tf);
    for (const s of S) {
      if (ONLY && !ONLY.includes(s.id)) continue;
      const st = s.build(c);
      for (const p of s.exits) {
        const strat = p.startsWith('BB') ? st : { ...st, stopL: null, stopS: null };
        const r = run(B, c.atr14, strat, exitOf(p, c), funding, iv, cost);
        const key = `${s.id}|${p}|${tf}`;
        (out[key] = out[key] || { id: s.id, profile: p, tf, family: s.family, coins: {} }).coins[coin] = { ...stats(r.trades), openNow: r.open ? { dir: r.open.dir } : null };
        (tradesOut[key] = tradesOut[key] || []).push(...r.trades.map((t) => [COINS.indexOf(coin), t.t, t.tExit, +t.R.toFixed(4), t.bars, t.dir]));
      }
    }
    console.log(tf, coin, 'done', B.length, 'bars');
  }
}
for (const key of Object.keys(out)) {
  const all = tradesOut[key].map((a) => ({ tExit: a[2], R: a[3], bars: a[4] }));
  out[key].pooled = stats(all);
}
const tag = NAME ? '-' + NAME : K === 1 ? '' : '-cost' + K;
fs.writeFileSync(`results${tag}.json`, JSON.stringify(out));
fs.writeFileSync(`trades${tag}.json`, JSON.stringify(tradesOut));
console.log('wrote results' + tag + '.json,', Object.keys(out).length, 'variants');
