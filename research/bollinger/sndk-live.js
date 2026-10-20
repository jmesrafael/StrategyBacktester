// sndk-live.js — SNDK (SanDisk perpetual) with the BB Breakout strategy on 2h and 4h, run like live:
//   • the app's own engine (js/strategy.js simulate + strategies/bb-breakout-strategy.js), one candle at a time, next-open fills;
//   • TRUNCATION test: the engine run on candles up to a random cut only must give the same orders as the full run (no look-ahead / repaint);
//   • an independent closed-candle replay (the 🎯 indicator's engine, js/bbx.js) must give the same trades;
//   • on Binance SNDKUSDT candles AND MEXC SNDKSTOCK_USDT candles (where you would trade). MEXC fees 0.04% taker (used both sides) + 0.02% slippage.
// usage: node sndk-live.js -> results-sndk-live.md
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js');
const APP = path.resolve(__dirname, '../..');
const ctx = { console, Math, Date, Intl, Map, Set, JSON, Number, String, Array, Object, Infinity, Proxy, isFinite, parseFloat, window: {}, localStorage: { getItem: () => null, setItem() {} }, CFG: {}, document: {} };
ctx.window.__STRATEGIES = {}; vm.createContext(ctx);
for (const f of ['js/indicators.js', 'strategies/registry.js', 'strategies/bb-breakout-strategy.js', 'js/bbx.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8') + (f.endsWith('bbx.js') ? '\n;this.BBX = BBXIndicator;' : ''), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/strategy.js'), 'utf8') + '\n;this.SM = StrategyMode;', ctx);
const strat = ctx.window.__STRATEGIES.bbbreakout, prm = Object.fromEntries(Object.entries(strat.params).map(([k, d]) => [k, d.default]));
const CFG = { fillMode: 'nextOpen', ambiguous: 'sl', commissionPct: 0.04, slippagePct: 0.02, startBalance: 10000, sizePct: 100, sizing: 'risk', riskPct: 1, maxSizePct: 100000, session: { enabled: false } };
const sim = (B) => ctx.SM.simulate(strat, prm, B, CFG, null);
const iso = (t) => new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16);
const f2 = (v) => (v >= 0 ? '+$' : '−$') + Math.abs(v).toFixed(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mexcBars(minutes) { // MEXC SNDKSTOCK_USDT 1h candles -> 2h / 4h (UTC buckets, whole buckets only)
  const file = path.join(__dirname, 'datatf', 'mexc-sndk-1h.json');
  let rows;
  if (fs.existsSync(file)) rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  else {
    const m = new Map(); let end = Math.floor(Date.now() / 1000);
    for (let p = 0; p < 10; p++) {
      const j = await (await fetch(`https://contract.mexc.com/api/v1/contract/kline/SNDKSTOCK_USDT?interval=Min60&start=${end - 1999 * 3600}&end=${end}`)).json();
      const d = j && j.data; if (!d || !d.time || !d.time.length) break;
      for (let i = 0; i < d.time.length; i++) m.set(d.time[i], [d.time[i], +d.open[i], +d.high[i], +d.low[i], +d.close[i], +d.vol[i]]);
      end = d.time[0] - 1; await sleep(200);
    }
    rows = [...m.values()].sort((a, b) => a[0] - b[0]);
    if (rows.length && rows[rows.length - 1][0] + 3600 > Date.now() / 1000) rows.pop();
    fs.writeFileSync(file, JSON.stringify(rows));
  }
  const sec = minutes * 60, per = minutes / 60, out = []; let cur = null, cnt = 0;
  for (const r of rows) { const b = Math.floor(r[0] / sec) * sec;
    if (!cur || cur.time !== b) { if (cur && cnt === per) out.push(cur); cur = { time: b, open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }; cnt = 1; }
    else { cur.high = Math.max(cur.high, r[2]); cur.low = Math.min(cur.low, r[3]); cur.close = r[4]; cur.volume += r[5]; cnt++; } }
  if (cur && cnt === per) out.push(cur);
  return { bars: out, first: rows.length ? rows[0][0] : null };
}

(async () => {
  const out = []; const P = (...a) => { for (const s of (a.length ? a : [''])) { out.push(s); console.log(s); } };
  P('# SNDK — BB Breakout run like live (2h and 4h)\n');
  P('The app\'s own strategy engine, one candle at a time (decide on the close, fill at the next open, stop / target touched inside a candle, stop first if both). MEXC SNDK fees 0.04% (both sides) + 0.02% slippage. $1 risk per trade.\n');
  const sets = [];
  for (const [tf, tn] of [[120, '2h'], [240, '4h']]) sets.push([`Binance ${tn}`, L.bars('SNDK', tf), tn]);
  for (const [tf, tn] of [[120, '2h'], [240, '4h']]) { const m = await mexcBars(tf); sets.push([`MEXC ${tn}`, m.bars, tn]); }
  P('## 1. Live-equivalence checks\n', '| Data | Candles | From | Truncation test (cuts / orders / mismatches) | Independent replay = engine? |', '|---|---|---|---|---|');
  const results = [];
  for (const [name, B] of sets) {
    const full = sim(B), sig = full.signals;
    let seed = 7, cuts = 0, orders = 0, bad = 0;
    for (let r = 0; r < 150; r++) { seed = (seed * 16807) % 2147483647; const k = 230 + Math.floor((seed / 2147483647) * (B.length - 235)); if (k >= B.length) continue;
      const part = sim(B.slice(0, k + 1)).signals.filter((s) => s.reason !== 'Session end'), ref = sig.filter((s) => s.index <= k);
      cuts++; orders += ref.length; if (part.length !== ref.length || part.some((s, j) => s.index !== ref[j].index || s.type !== ref[j].type || Math.abs(s.price - ref[j].price) > 1e-9)) bad++; }
    const open = sig.length && sig[sig.length - 1].reason === 'Session end' ? full.trades[full.trades.length - 1] : null;
    const closed = open ? full.trades.slice(0, -1) : full.trades, scan = ctx.BBX.scan(B, ctx.BBX.getDefaults());
    const same = scan.trades.length === closed.length && scan.trades.every((t, i) => t.i0 === closed[i].entryIndex && t.i1 === closed[i].exitIndex) && (!open === !scan.open);
    P(`| ${name} | ${B.length} | ${iso(B[0].time).slice(0, 10)} | ${cuts} / ${orders} / **${bad}** | ${same ? 'yes, trade for trade' : '**NO**'} |`);
    let bal = 10000; const tr = full.trades.map((t, i) => { const R = t.usd / (bal * 0.01); bal += t.usd; return { ...t, R, open: open && i === full.trades.length - 1, why: (sig.filter((s) => s.index === t.exitIndex && s.type === 'close').pop() || {}).reason }; });
    results.push({ name, B, tr });
  }
  P('', '## 2. Results\n', '| Data | Trades | Total ($1 risk) | Max drawdown | Win % | Avg R | Best / worst trade | Open now |', '|---|---|---|---|---|---|---|---|');
  for (const { name, tr } of results) {
    const done = tr.filter((t) => !t.open); let e = 0, pk = 0, dd = 0; for (const t of done) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); }
    const o = tr.find((t) => t.open);
    P(`| ${name} | ${done.length} | **${f2(L.sum(done.map((t) => t.R)))}** | −$${dd.toFixed(2)} | ${(done.filter((t) => t.R > 0).length / done.length * 100).toFixed(0)}% | ${(L.sum(done.map((t) => t.R)) / done.length >= 0 ? '+' : '−') + Math.abs(L.sum(done.map((t) => t.R)) / done.length).toFixed(2)}R | ${f2(Math.max(...done.map((t) => t.R)))} / ${f2(Math.min(...done.map((t) => t.R)))} | ${o ? `${o.side} since ${iso(results[0].B[0].time) && iso(results.find((r) => r.name === name).B[o.entryIndex].time)}, ${f2(o.R)} so far` : 'flat'} |`);
  }
  P('', '## 3. Month by month ($1 risk; trades in brackets)\n');
  const months = [...new Set(results.flatMap(({ B, tr }) => tr.filter((t) => !t.open).map((t) => iso(B[t.entryIndex].time).slice(0, 7))))].sort();
  P('| Month | ' + results.map((r) => r.name).join(' | ') + ' |', '|---|' + results.map(() => '---').join('|') + '|');
  for (const m of months) P(`| ${m} | ${results.map(({ B, tr }) => { const t = tr.filter((x) => !x.open && iso(B[x.entryIndex].time).startsWith(m)); return t.length ? `${f2(L.sum(t.map((x) => x.R)))} (${t.length})` : '·'; }).join(' | ')} |`);
  for (const { name, B, tr } of results.filter((r) => r.name.startsWith('MEXC'))) {
    P('', `## Every trade — ${name}\n`, '| # | Entry (UTC) | Side | Entry price | Exit (UTC) | Exit price | Result | Exit reason |', '|---|---|---|---|---|---|---|---|');
    tr.forEach((t, i) => P(`| ${i + 1} | ${iso(B[t.entryIndex].time)} | ${t.side} | ${t.entry.toFixed(2)} | ${t.open ? '— open —' : iso(B[t.exitIndex].time)} | ${t.open ? '' : t.exit.toFixed(2)} | ${f2(t.R)}${t.open ? ' (so far)' : ''} | ${t.open ? 'still open' : t.why} |`));
  }
  fs.writeFileSync(__dirname + '/results-sndk-live.md', out.join('\n') + '\n');
})();
