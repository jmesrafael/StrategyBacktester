// News-layer backtest for TRI-CORE: replays each bot's saved backtest trades (research/strat-hunt-nov6)
// through news-gate variants and measures what the gate removes.
//   node research/news-lab/backtest.js            -> results.json + REPORT.md
// Caveat (stated in the report): skipping a trade here does not let the bot take a different trade instead,
// which a real bot might do. The paper bots measure that part going forward.
'use strict';
const fs = require('fs'), path = require('path');
const { gate, DEFAULTS } = require('../../news-gate/news-gate');
const HUNT = path.join(__dirname, '..', 'strat-hunt-nov6');
const D = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', f), 'utf8'));
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const SPLIT = Date.UTC(2024, 0, 1) / 1000; // in-sample < 2024 <= out-of-sample

const BOTS = {
  'BB-CORE': { key: 'bb-core|BBX|4h', file: 'trades-hybrid.json' },
  'I-CORE': { key: 'i-core|P7|4h', file: 'trades.json' },
  'T-CORE': { key: 'bb-trail|P14|4h', file: 'trades-hybrid.json' },
};

// ---------- inputs
const events = D('ff-usd-high.json').events.map((e) => ({ name: e.name, t: e.t }));
const fngRows = D('fng.json').data.map((r) => [+r.timestamp, +r.value]).sort((a, b) => a[0] - b[0]);
const fngAt = (t) => { let lo = 0, hi = fngRows.length - 1, ans = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (fngRows[m][0] <= t) { ans = fngRows[m][1]; lo = m + 1; } else hi = m - 1; } return ans; };
// DeFiLlama dates are the hack's day (00:00 UTC); treat it as public at the end of that day (no look-ahead).
const hacks = D('hacks.json').map((h) => ({ t: h.date + 86400, amount: h.amount || 0, chains: h.chain || [], name: h.name })).sort((a, b) => a.t - b.t);
const btc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'indicator-top10', 'data4h', 'BTC.json'), 'utf8')).map((r) => ({ t: r[0], c: r[4] }));
function btcChange24h(t) { // last BTC 4h candle fully closed by t, vs 6 candles earlier
  let lo = 0, hi = btc.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (btc[m].t + 14400 <= t) { k = m; lo = m + 1; } else hi = m - 1; }
  return k >= 6 ? (btc[k].c / btc[k - 6].c - 1) * 100 : null;
}

// ---------- variants
const off = { blackout: { ...DEFAULTS.blackout, on: false }, fng: { ...DEFAULTS.fng, on: false }, crash: { ...DEFAULTS.crash, on: false }, hack: { ...DEFAULTS.hack, on: false } };
const V = (name, patch) => ({ name, cfg: { ...off, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, { ...DEFAULTS[k], ...v, on: true }])) } });
const CHOSEN = { name: 'CHOSEN: blackout 8h before + coin-chain hack', cfg: DEFAULTS };
const VARIANTS = [
  CHOSEN,
  V('blackout ±4h', { blackout: { preH: 4, postH: 4 } }),
  V('blackout ±2h', { blackout: { preH: 2, postH: 2 } }),
  V('blackout 8h before', { blackout: { preH: 8, postH: 0 } }),
  V('blackout 8h after', { blackout: { preH: 0, postH: 8 } }),
  V('F&G contrarian 20/80', { fng: { mode: 'contrarian', lo: 20, hi: 80 } }),
  V('F&G contrarian 25/75', { fng: { mode: 'contrarian', lo: 25, hi: 75 } }),
  V('F&G with-trend 20/80', { fng: { mode: 'trend', lo: 20, hi: 80 } }),
  V('BTC crash guard 5%', { crash: { pct: 5 } }),
  V('BTC crash guard 8%', { crash: { pct: 8 } }),
  V('BTC 5% move: half size', { crash: { pct: 5, action: 'half' } }),
  V('hack guard (coin + $100M market)', { hack: { marketMinUsd: 1e8 } }),
  V('hack guard: coin chain only', { hack: { marketMinUsd: 1e15 } }),
  V('hack guard: $100M market only', { hack: { coinMinUsd: 1e15, marketMinUsd: 1e8 } }),
  V('blackout ±4h + hack', { blackout: { preH: 4, postH: 4 }, hack: { marketMinUsd: 1e8 } }),
  V('blackout ±4h + hack + crash 5%', { blackout: { preH: 4, postH: 4 }, hack: { marketMinUsd: 1e8 }, crash: { pct: 5 } }),
  V('all four (contrarian F&G)', { blackout: { preH: 4, postH: 4 }, hack: { marketMinUsd: 1e8 }, crash: { pct: 5 }, fng: {} }),
];

// ---------- metrics
function stats(trades) { // trades: [{ R, tExit }]
  const s = trades.slice().sort((a, b) => a.tExit - b.tExit);
  let eq = 0, peak = 0, dd = 0, wins = 0, sum = 0;
  for (const t of s) { eq += t.R; sum += t.R; if (t.R > 0) wins++; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); }
  return { n: s.length, R: +sum.toFixed(1), avgR: s.length ? +(sum / s.length).toFixed(3) : 0, win: s.length ? +(wins / s.length * 100).toFixed(1) : 0, ddR: +dd.toFixed(1) };
}
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }
function permP(all, keptSum, removeN, iters = 3000) { // share of random same-size skips that keep at least as much R
  if (!removeN) return null;
  const r = rng(42), R = all.map((t) => t.R), total = R.reduce((a, b) => a + b, 0);
  let ge = 0;
  for (let k = 0; k < iters; k++) {
    let removed = 0; const idx = new Set();
    while (idx.size < removeN) idx.add(Math.floor(r() * R.length));
    for (const i of idx) removed += R[i];
    if (total - removed >= keptSum) ge++;
  }
  return +(ge / iters).toFixed(3);
}

const results = { generated: new Date().toISOString(), split: '2024-01-01', events: events.length, chosen: { name: CHOSEN.name, cfg: DEFAULTS }, bots: {} };
for (const [bot, { key, file }] of Object.entries(BOTS)) {
  const raw = JSON.parse(fs.readFileSync(path.join(HUNT, file), 'utf8'))[key];
  const trades = raw.map(([ci, t, tExit, R, bars, dir]) => ({ coin: COINS[ci], t, tExit, R, bars, dir }));
  const base = { all: stats(trades), is: stats(trades.filter((x) => x.t < SPLIT)), oos: stats(trades.filter((x) => x.t >= SPLIT)) };
  const rows = [];
  for (const v of VARIANTS) {
    const kept = [], skipped = [], reasons = {};
    for (const tr of trades) {
      const g = gate({ t: tr.t, coin: tr.coin, dir: tr.dir, events, fngAt, btcChange24h: btcChange24h(tr.t), hacks }, v.cfg);
      if (!g.allow) { skipped.push(tr); const k = g.reasons[0].split(':')[0]; reasons[k] = (reasons[k] || 0) + 1; }
      else kept.push(g.size === 1 ? tr : { ...tr, R: tr.R * g.size });
    }
    const all = stats(kept), is = stats(kept.filter((x) => x.t < SPLIT)), oos = stats(kept.filter((x) => x.t >= SPLIT));
    const sk = stats(skipped);
    rows.push({
      variant: v.name, all, is, oos, skipped: sk, reasons,
      dR: +(all.R - base.all.R).toFixed(1), dIS: +(is.R - base.is.R).toFixed(1), dOOS: +(oos.R - base.oos.R).toFixed(1), dDD: +(all.ddR - base.all.ddR).toFixed(1),
      p: permP(trades, all.R, skipped.length),
      // "helps" = better R per trade AND not worse drawdown, in BOTH halves
      helps: is.avgR > base.is.avgR && oos.avgR > base.oos.avgR && all.ddR >= base.all.ddR,
    });
  }
  results.bots[bot] = { key, base, rows };
}
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 1));

// ---------- report
const f = (x) => (x > 0 ? '+' : '') + x;
let md = `# News-layer backtest — TRI-CORE (BB-CORE, I-CORE, T-CORE)\n\nGenerated ${results.generated.slice(0, 16)} UTC. Trades: saved backtests in research/strat-hunt-nov6 (Oct 2020 → Nov 2026). ` +
  `Events: ${events.length} USD high-impact releases (ForexFactory). Fear & Greed: alternative.me. Hacks: DeFiLlama. In-sample < 2024 ≤ out-of-sample.\n\n` +
  `**p** = share of 3,000 random skips of the same number of trades that kept at least as much total R (low p = the rule removes worse-than-random trades). ` +
  `**helps** = higher R per trade in both halves and no deeper drawdown.\n\nCaveat: a skipped trade is just removed; a real bot might take a different trade instead. The news paper bots measure that.\n`;
for (const [bot, b] of Object.entries(results.bots)) {
  md += `\n## ${bot} (${b.key})\n\nBaseline: ${b.base.all.n} trades, ${b.base.all.R}R, ${b.base.all.avgR}R/trade, win ${b.base.all.win}%, max DD ${b.base.all.ddR}R · before 2024 ${b.base.is.R}R · 2024+ ${b.base.oos.R}R\n\n`;
  md += `| variant | skipped | skipped R | R/trade kept | ΔR total | ΔR <2024 | ΔR 2024+ | ΔDD | p | helps |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of b.rows) md += `| ${r.variant} | ${r.skipped.n} | ${f(r.skipped.R)} | ${r.all.avgR} | ${f(r.dR)} | ${f(r.dIS)} | ${f(r.dOOS)} | ${f(r.dDD)} | ${r.p ?? '–'} | ${r.helps ? '✅' : ''} |\n`;
}
fs.writeFileSync(path.join(__dirname, 'REPORT.md'), md);
console.log(md);
