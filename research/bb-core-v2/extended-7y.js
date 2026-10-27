// extended-7y.js — ADA and ZEC over ~7 years: Binance SPOT 4h candles before the perpetual contract existed + the perp candles after it.
// Fetches (public, no key) once into data-ext/<COIN>-spot.json, then compares bb-core vs v2-A (maxBars 96) with the same engine and costs.
// Limits, stated plainly: before the perp listing there is NO funding data (treated as 0; historically ~4% of profit) and spot prices differ slightly
// from perp prices. SOL / NEAR / GALA cannot be extended: those coins only started trading in Aug 2020 / Oct 2020 / Sep 2021.
//   node extended-7y.js [--from 2019-10-01] [--bars 96]
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, summarize, scaleCost, DEFAULTS } = require('./v2-core.js');
const { loadCoin } = require('./load.js');
const args = process.argv.slice(2), opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const FROM = Date.parse(opt('from', '2019-09-01') + 'T00:00:00Z') / 1000, BARS = +opt('bars', 96), RISK = 5, IV = DEFAULTS.interval;
const EXT = path.join(__dirname, 'data-ext'); fs.mkdirSync(EXT, { recursive: true });
const cost = scaleCost(DEFAULTS.cost, 1);
const R = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), $ = (v) => (v < 0 ? '−$' : '+$') + Math.abs(Math.round(v * RISK)).toLocaleString('en-US');
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

async function spot(coin, until) {
  const f = path.join(EXT, `${coin}-spot.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const out = []; let t = FROM;
  while (t < until) {
    const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${coin}USDT&interval=4h&startTime=${t * 1000}&limit=1000`);
    if (!r.ok) throw new Error(`${coin}: HTTP ${r.status}`);
    const rows = await r.json(); if (!rows.length) break;
    for (const k of rows) { const ts = Math.floor(k[0] / 1000); if (ts < until) out.push([ts, +k[1], +k[2], +k[3], +k[4], +k[5]]); }
    t = Math.floor(rows[rows.length - 1][0] / 1000) + IV;
  }
  fs.writeFileSync(f, JSON.stringify(out)); return out;
}

(async () => {
  console.log(`# ~7 years: bb-core vs v2-A (maxBars ${BARS}) — spot candles before the perp listing + perp candles after, $${RISK} per trade\n`);
  const res = {};
  for (const coin of ['ADA', 'ZEC']) {
    const perp = loadCoin(coin), t0 = perp.B[0].time, pre = (await spot(coin, t0)).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
    const B = [...pre, ...perp.B];
    let holes = 0; for (let i = 1; i < B.length; i++) if (B[i].time - B[i - 1].time !== IV) holes++;
    console.log(`${coin}: ${iso(B[0].time)} → ${iso(B[B.length - 1].time)}  (${pre.length} spot candles + ${perp.B.length} perp candles, ${holes} hole(s) in the series, joined at ${iso(t0)})`);
    res[coin] = { base: backtest(B, { cost }, perp.funding).trades, v2: backtest(B, { cost, maxBars: BARS }, perp.funding).trades, years: ((B[B.length - 1].time - B[0].time) / 31557600).toFixed(1) };
  }
  console.log('\n| coin | | trades | total R | total $ | win rate | avg R | max drawdown | profitable years |'); console.log('|---|---|---|---|---|---|---|---|---|');
  const tot = { base: [], v2: [] };
  for (const [coin, r] of Object.entries(res)) for (const [tag, t] of [['bb-core', r.base], ['**v2-A**', r.v2]]) {
    tot[tag === 'bb-core' ? 'base' : 'v2'].push(...t); const s = summarize(t), ys = Object.values(s.years);
    console.log(`| ${tag === 'bb-core' ? coin + ' (' + r.years + 'y)' : ''} | ${tag} | ${s.n} | **${R(s.R)}R** | **${$(s.R)}** | ${(s.win * 100).toFixed(1)}% | ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R | ${s.dd.toFixed(1)}R | ${ys.filter((v) => v > 0).length}/${ys.length} |`);
  }
  for (const [tag, t] of [['bb-core', tot.base], ['**v2-A**', tot.v2]]) { const s = summarize(t); console.log(`| ${tag === 'bb-core' ? 'ADA+ZEC' : ''} | ${tag} | ${s.n} | **${R(s.R)}R** | **${$(s.R)}** | ${(s.win * 100).toFixed(1)}% | ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R | ${s.dd.toFixed(1)}R | |`); }
  const ys = [...new Set([...tot.base, ...tot.v2].map((x) => new Date(x.tExit * 1000).getUTCFullYear()))].sort();
  console.log('\n## Return per year, R (bb-core → v2-A)\n'); console.log('| coin | ' + ys.join(' | ') + ' | total |'); console.log('|---|' + ys.map(() => '---').join('|') + '|---|');
  for (const [coin, r] of [...Object.entries(res), ['ADA+ZEC', { base: tot.base, v2: tot.v2 }]]) {
    const a = summarize(r.base).years, b = summarize(r.v2).years;
    console.log(`| ${coin} | ` + ys.map((y) => `${R(a[y] || 0)} → ${R(b[y] || 0)}`).join(' | ') + ` | **${R(summarize(r.base).R)} → ${R(summarize(r.v2).R)}** |`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
