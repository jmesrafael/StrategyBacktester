// late-entry.js — what does it cost the BB Breakout (4h, 1:4) if the bot enters LATE?
//
// For every SOL / ZEC trade of the frozen engine (🔴BB-Core/lucidyo-core.js, Binance 4h data) we download the 1-minute candles
// of the entry candle and re-run the trade with the fill at  open of minute d  (d = 0, 1, 2, 5, 10, 15, 30, 60, 120).
// Stop (middle band) and target (signal close ± 4 × dist) are the same prices as the backtest; only the fill moves.
// Sizing is fixed-$ risk on the ACTUAL fill (what the live bot does), so R = result / risk on that fill.
//   - minute 0..d-1 already touched the stop or target  ->  policy SKIP (trade not taken) and policy CHASE (still enter if the
//     price at minute d is between stop and target)
//   - exits inside the entry candle are checked on 1m bars (stop first in a minute that hits both), after it on 4h bars,
//     time exit at the open after 48 candles — same rules and costs as the engine. Funding is left out (same for every delay).
//
//   node research/bollinger/late-entry.js [SOL,ZEC]      1m cache: research/bollinger/cache-1m/  (not committed)
'use strict';
const fs = require('fs'), path = require('path');
const CORE = path.join(__dirname, '..', '..', '\u{1F534}BB-Core');
const { backtest, DEFAULTS } = require(path.join(CORE, 'lucidyo-core.js'));

const coins = (process.argv[2] || 'SOL,ZEC').split(',');
const DELAYS = [0, 1, 2, 5, 10, 15, 30, 60, 120];
const C = DEFAULTS.cost, IV = 14400;
const CACHE = path.join(__dirname, 'cache-1m');
fs.mkdirSync(CACHE, { recursive: true });

async function get1m(coin, t) { // 240 one-minute bars of the 4h candle starting at t (sec)
  const f = path.join(CACHE, `${coin}-${t}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let k = 0; k < 5; k++) {
    try {
      const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${coin}USDT&interval=1m&startTime=${t * 1000}&limit=240`);
      if (r.status === 429 || r.status === 418) { await new Promise((s) => setTimeout(s, 30000)); continue; }
      const j = await r.json();
      const m = j.map((x) => ({ time: x[0] / 1000, open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
      fs.writeFileSync(f, JSON.stringify(m));
      await new Promise((s) => setTimeout(s, 60));
      return m;
    } catch (e) { await new Promise((s) => setTimeout(s, 2000)); }
  }
  throw new Error(`1m fetch failed ${coin} ${t}`);
}

const hitStop = (d, stop, b) => (d === 1 ? b.low <= stop : b.high >= stop);
const hitTp = (d, tp, b) => (d === 1 ? b.high >= tp * (1 + C.tpBuf) : b.low <= tp * (1 - C.tpBuf));
const R = (d, entry, dist, px, fee) => (d * (px - entry) / entry - C.entryFee - fee) / dist;

// simulate one trade entered at minute `del` of the entry candle; returns { R, why } or { skip }
function sim(t, M, B, del, chase) {
  const d = t.dir, stop = t.stop, tp = t.tp;
  if (M.length < del + 1) return { skip: 'nodata' };
  const touched = M.slice(0, del).some((b) => hitStop(d, stop, b) || hitTp(d, tp, b));
  const raw = M[del].open;
  if (touched && !chase) return { skip: 'touched' };
  if (d === 1 ? !(raw > stop && raw < tp) : !(raw < stop && raw > tp)) return { skip: 'outside' };
  const entry = raw * (1 + d * C.slip), dist = Math.abs(entry - stop) / entry;
  if (!(d === 1 ? stop < entry : stop > entry)) return { skip: 'outside' };
  const ex = (px, fee, why) => ({ R: R(d, entry, dist, px, fee), why, drift: d * (raw - M[0].open) / M[0].open / (Math.abs(M[0].open - stop) / M[0].open) });
  for (let k = del; k < M.length; k++) { // rest of the entry candle, minute by minute (the fill minute itself included)
    const b = M[k], o = k === del ? raw : b.open;
    if (hitStop(d, stop, b)) return ex((d === 1 ? Math.min(stop, o) : Math.max(stop, o)) * (1 - d * C.slip), C.stopFee, 'stop');
    if (hitTp(d, tp, b)) return ex((d === 1 ? Math.max(tp, o) : Math.min(tp, o)) * (1 - d * C.tpSlip), C.tpFee, 'target');
  }
  for (let i = t.i0 + 1; i < B.length; i++) { // then 4h candles, exactly like the engine
    const c = B[i];
    if (i - t.i0 > DEFAULTS.maxBars) return ex(c.open * (1 - d * C.slip), C.timeFee, 'time');
    if (hitStop(d, stop, c)) return ex((d === 1 ? Math.min(stop, c.open) : Math.max(stop, c.open)) * (1 - d * C.slip), C.stopFee, 'stop');
    if (hitTp(d, tp, c)) return ex((d === 1 ? Math.max(tp, c.open) : Math.min(tp, c.open)) * (1 - d * C.tpSlip), C.tpFee, 'target');
  }
  return { skip: 'end' };
}

const maxDD = (rs) => { let e = 0, p = 0, dd = 0; for (const r of rs) { e += r; p = Math.max(p, e); dd = Math.max(dd, p - e); } return dd; };
const f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
const f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);

(async () => {
  const out = [];
  const log = (s = '') => { console.log(s); out.push(s); };
  log('# BB Breakout — what a LATE entry costs (SOL, ZEC)');
  log('');
  log(`Engine: 🔴BB-Core/lucidyo-core.js defaults (4h, BB 20/2, SMA200, 1:4, 48-bar time exit), Binance USDT-M data, real fees + 0.02% slippage, funding left out. Run ${new Date().toISOString().slice(0, 10)}.`);
  log('Each trade is replayed on 1-minute candles of its entry candle with the fill moved to minute d. Stop and target prices are unchanged; size is fixed-$ risk on the actual fill.');
  log('**SKIP** = do not enter if stop or target was already touched before the fill.  **CHASE** = enter anyway if the price is still between stop and target.');
  const pooled = {};
  for (const coin of coins) {
    const B = JSON.parse(fs.readFileSync(path.join(CORE, 'data', coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
    const trades = backtest(B).trades.filter((t) => t.why !== 'end');
    process.stderr.write(`${coin}: ${trades.length} trades, fetching 1m...\n`);
    const Ms = [];
    for (let k = 0; k < trades.length; k++) { Ms.push(await get1m(coin, B[trades[k].i0].time)); if (k % 50 === 0) process.stderr.write(`  ${k}/${trades.length}\n`); }
    const engR = trades.reduce((a, t) => a + t.R, 0); // engine R without funding: recompute with funding stripped
    const engNoFund = trades.reduce((a, t) => a + t.R - t.fundR, 0);
    log('');
    log(`## ${coin} — ${trades.length} trades ${new Date(trades[0].t * 1000).toISOString().slice(0, 7)} → ${new Date(trades.at(-1).t * 1000).toISOString().slice(0, 7)}`);
    log('');
    log(`4h engine (no funding): total ${f2(engNoFund)}R, avg ${f3(engNoFund / trades.length)}R. The d=0 row below re-checks the entry candle on 1m bars, so it can differ slightly (the engine assumes stop-first when a 4h candle touches both).`);
    for (const chase of [false, true]) {
      log('');
      log(`### ${chase ? 'CHASE' : 'SKIP'} policy`);
      log('');
      log('| Late by | Trades taken | Skipped | Total R | Avg R | vs on-time | Win% | Target hits | Max DD (R) | Avg price drift at fill |');
      log('|---|---|---|---|---|---|---|---|---|---|');
      let base = null;
      for (const del of DELAYS) {
        const res = trades.map((t, k) => sim(t, Ms[k], B, del, chase));
        const ok = res.filter((r) => !r.skip), rs = ok.map((r) => r.R), tot = rs.reduce((a, b) => a + b, 0);
        if (base == null) base = tot;
        const key = `${chase ? 'C' : 'S'}${del}`;
        (pooled[key] = pooled[key] || []).push(...res.map((r, k) => ({ t: trades[k].t, r })));
        log(`| ${del === 0 ? 'on time' : del + ' min'} | ${ok.length} | ${res.length - ok.length} | ${f2(tot)} | ${f3(tot / ok.length)} | ${del === 0 ? '—' : f2(tot - base) + 'R (' + (((tot - base) / Math.abs(base)) * 100).toFixed(0) + '%)'} | ${((ok.filter((r) => r.R > 0).length / ok.length) * 100).toFixed(0)}% | ${ok.filter((r) => r.why === 'target').length} | ${maxDD(rs).toFixed(1)} | ${f3(ok.reduce((a, r) => a + r.drift, 0) / ok.length)}R |`);
      }
    }
  }
  if (coins.length > 1) {
    log('');
    log(`## ${coins.join(' + ')} together (trades in time order)`);
    for (const pol of ['S', 'C']) {
      log('');
      log(`### ${pol === 'S' ? 'SKIP' : 'CHASE'} policy`);
      log('');
      log('| Late by | Trades | Total R | Avg R | vs on-time | Per-trade change (±2 SE) | Max DD (R) | $ at $1 risk |');
      log('|---|---|---|---|---|---|---|---|');
      let base = null;
      for (const del of DELAYS) {
        const ok = pooled[pol + del].filter((x) => !x.r.skip).sort((a, b) => a.t - b.t), rs = ok.map((x) => x.r.R), tot = rs.reduce((a, b) => a + b, 0);
        if (base == null) base = tot;
        const P0 = pooled[pol + 0], dif = pooled[pol + del].map((x, k) => (x.r.skip || P0[k].r.skip ? null : x.r.R - P0[k].r.R)).filter((v) => v != null);
        const mu = dif.reduce((a, b) => a + b, 0) / dif.length, se = Math.sqrt(dif.reduce((a, b) => a + (b - mu) ** 2, 0) / (dif.length - 1) / dif.length);
        log(`| ${del === 0 ? 'on time' : del + ' min'} | ${ok.length} | ${f2(tot)} | ${f3(tot / ok.length)} | ${del === 0 ? '—' : f2(tot - base) + 'R (' + (((tot - base) / Math.abs(base)) * 100).toFixed(0) + '%)'} | ${del === 0 ? '—' : f3(mu) + ' ± ' + (2 * se).toFixed(3) + 'R' + (Math.abs(mu) > 2 * se ? ' **real**' : ' noise')} | ${maxDD(rs).toFixed(1)} | ${(tot >= 0 ? '+$' : '−$') + Math.abs(tot).toFixed(0)} |`);
      }
    }
  }
  fs.writeFileSync(path.join(__dirname, 'results-late-entry.md'), out.join('\n') + '\n');
  process.stderr.write('wrote research/bollinger/results-late-entry.md\n');
})();
