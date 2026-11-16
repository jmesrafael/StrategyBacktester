// engines/correlation - how much the coins move together, and what happens to them after a BTC shock.
//
// Inputs (through the spine): market (candles), events (BTC price shocks).
// Outputs: dataset "derived/correlation" (daily.csv, matrix.json, contagion.csv, leadlag.csv, tail.csv) and reports/correlation.md.
//
// All returns are 1h log returns, close / previous close, lined up by bar open time. A pair-hour with a missing bar is skipped.
// Every window uses only bars that were closed at or before its end time. Nothing looks ahead.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../../lib/spine'), cfg = require('../../lib/config'), U = require('../../lib/util'), M = require('../../lib/market');
const { H, D } = U;

const CUT_2024 = Date.UTC(2024, 0, 1) / 1000;
const DAILY = { day: 'string', t: 'int', n_coins: 'int', avg_pair_corr: 'number', avg_corr_to_btc: 'number?', min_pair_corr: 'number', pctile_1y: 'number?' };
const CONTAGION = { direction: 'string', coin: 'string', window: 'string', n: 'int', btc_median_pct: 'number?', coin_median_pct: 'number?', ratio: 'number?', same_direction_share: 'number?',
  n_before_2024: 'int', ratio_before_2024: 'number?', n_from_2024: 'int', ratio_from_2024: 'number?' };
const LEADLAG = { coin: 'string', lag_h: 'int', corr: 'number?', n: 'int' };
const TAIL = { coin: 'string', n_btc_tail_hours: 'int', p_down_together: 'number?', p_up_together: 'number?', baseline: 'number', n_before_2024: 'int', p_down_before_2024: 'number?', n_from_2024: 'int', p_down_from_2024: 'number?' };

// ---------- pure helpers (series are arrays or Float64Array, NaN = missing) ----------

// Pearson correlation of x and y over indexes lo..hi (inclusive), skipping pairs with a NaN. Returns { corr, n }.
function pairCorr(x, y, lo = 0, hi = x.length - 1) {
  let n = 0, sx = 0, sy = 0;
  for (let i = lo; i <= hi; i++) { const a = x[i], b = y[i]; if (a === a && b === b) { n++; sx += a; sy += b; } }
  if (n < 3) return { corr: null, n };
  const mx = sx / n, my = sy / n; let sxy = 0, sxx = 0, syy = 0;
  for (let i = lo; i <= hi; i++) { const a = x[i], b = y[i]; if (a === a && b === b) { const p = a - mx, q = b - my; sxy += p * q; sxx += p * p; syy += q * q; } }
  return { corr: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null, n };
}
const corrRange = (x, y, lo, hi) => pairCorr(x, y, lo, hi).corr;

// beta of y on x = cov(y, x) / var(x)
function betaRange(y, x, lo = 0, hi = x.length - 1) {
  let n = 0, sx = 0, sy = 0;
  for (let i = lo; i <= hi; i++) { if (x[i] === x[i] && y[i] === y[i]) { n++; sx += x[i]; sy += y[i]; } }
  if (n < 3) return null;
  const mx = sx / n, my = sy / n; let sxy = 0, sxx = 0;
  for (let i = lo; i <= hi; i++) { if (x[i] === x[i] && y[i] === y[i]) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; } }
  return sxx > 0 ? sxy / sxx : null;
}

// correlation between btc[t] and coin[t + k], t and t + k both inside lo..hi. k > 0 means the coin follows BTC.
function lagCorr(btc, coin, k, lo, hi) {
  const a = [], b = [];
  for (let t = lo; t <= hi; t++) { const u = t + k; if (u < lo || u > hi) continue; if (btc[t] === btc[t] && coin[u] === coin[u]) { a.push(btc[t]); b.push(coin[u]); } }
  return { corr: U.corr(a, b), n: a.length };
}

// Tail co-movement. x = BTC returns, y = coin returns. Thresholds come from the common hours (both present).
// p_down = P(y in its worst p | x in its worst p). cutIdx splits the history (index < cutIdx = before).
function tailStats(x, y, cutIdx = Infinity, p = 0.05) {
  const xs = [], ys = [], ix = [];
  for (let i = 0; i < x.length; i++) if (x[i] === x[i] && y[i] === y[i]) { xs.push(x[i]); ys.push(y[i]); ix.push(i); }
  const out = { n: xs.length, nDown: 0, nUp: 0, pDown: null, pUp: null, nBefore: 0, pDownBefore: null, nFrom: 0, pDownFrom: null };
  if (xs.length < 20) return out;
  const q = (arr, pp) => { const s = Float64Array.from(arr).sort(), pos = (s.length - 1) * pp, lo = Math.floor(pos), hi = Math.ceil(pos); return s[lo] + (s[hi] - s[lo]) * (pos - lo); };
  const xLo = q(xs, p), xHi = q(xs, 1 - p), yLo = q(ys, p), yHi = q(ys, 1 - p);
  let dn = 0, dnBoth = 0, up = 0, upBoth = 0, b = 0, bBoth = 0, f = 0, fBoth = 0;
  for (let j = 0; j < xs.length; j++) {
    if (xs[j] <= xLo) { dn++; const both = ys[j] <= yLo; if (both) dnBoth++; if (ix[j] < cutIdx) { b++; if (both) bBoth++; } else { f++; if (both) fBoth++; } }
    if (xs[j] >= xHi) { up++; if (ys[j] >= yHi) upBoth++; }
  }
  Object.assign(out, { nDown: dn, nUp: up, pDown: dn ? dnBoth / dn : null, pUp: up ? upBoth / up : null, nBefore: b, pDownBefore: b ? bBoth / b : null, nFrom: f, pDownFrom: f ? fBoth / f : null });
  return out;
}

// percentile (0-100) of value v among earlier values; ties count half. null if fewer than minN earlier values.
function pctile(v, prev, minN = 90) {
  if (prev.length < minN) return null;
  let lt = 0, eq = 0; for (const p of prev) { if (p < v) lt++; else if (p === v) eq++; }
  return 100 * (lt + eq / 2) / prev.length;
}

// Align raw rows [openTimeSec, o, h, l, c, v] of every coin on one hourly index.
// R[coin][i] = log return of the bar opened at t0 + i*H (closes at t0 + (i+1)*H). C[coin][i] = its close.
function buildMatrix(rowsByCoin) {
  const coins = Object.keys(rowsByCoin).filter((c) => rowsByCoin[c].length);
  let t0 = Infinity, t1 = -Infinity;
  for (const c of coins) { const r = rowsByCoin[c]; t0 = Math.min(t0, r[0][0]); t1 = Math.max(t1, r[r.length - 1][0]); }
  const n = coins.length ? Math.round((t1 - t0) / H) + 1 : 0, R = {}, C = {}, cum = {};
  for (const c of coins) {
    const cl = new Float64Array(n).fill(NaN), rt = new Float64Array(n).fill(NaN);
    for (const r of rowsByCoin[c]) cl[Math.round((r[0] - t0) / H)] = r[4];
    for (let i = 1; i < n; i++) if (cl[i] > 0 && cl[i - 1] > 0) rt[i] = Math.log(cl[i] / cl[i - 1]);
    const cu = new Int32Array(n + 1); for (let i = 0; i < n; i++) cu[i + 1] = cu[i] + (rt[i] === rt[i] ? 1 : 0);
    R[c] = rt; C[c] = cl; cum[c] = cu;
  }
  return { coins, t0, n, R, C, cum };
}
// index of the last bar closed at or before time T (bar open <= T - H)
const endIndex = (mx, T) => Math.min(Math.floor((T - H - mx.t0) / H), mx.n - 1);
const fullWindow = (mx, c, iEnd, W) => iEnd - W + 1 >= 1 && mx.cum[c][iEnd + 1] - mx.cum[c][iEnd + 1 - W] === W;

// correlation, covariance (population) and volatility for the W hours ending at bar index iEnd. Only coins with a full window.
function windowStats(mx, iEnd, W) {
  const coins = mx.coins.filter((c) => fullWindow(mx, c, iEnd, W)), k = coins.length, lo = iEnd - W + 1;
  const mean = coins.map((c) => { let s = 0; for (let i = lo; i <= iEnd; i++) s += mx.R[c][i]; return s / W; });
  const cov = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let a = 0; a < k; a++) for (let b = a; b < k; b++) {
    const x = mx.R[coins[a]], y = mx.R[coins[b]]; let s = 0;
    for (let i = lo; i <= iEnd; i++) s += (x[i] - mean[a]) * (y[i] - mean[b]);
    cov[a][b] = cov[b][a] = s / W;
  }
  const vol = coins.map((_, i) => Math.sqrt(cov[i][i]));
  const corr = cov.map((row, a) => row.map((v, b) => (a === b ? 1 : vol[a] > 0 && vol[b] > 0 ? v / (vol[a] * vol[b]) : null)));
  return { coins, corr, cov, vol };
}
function latestFromRows(rowsByCoin, asOf, W = cfg.exposure.corrWindowHours) {
  const mx = buildMatrix(rowsByCoin);
  return { asOf, window_hours: W, ...windowStats(mx, endIndex(mx, asOf), W) };
}
function usableCoins() { return cfg.marketCoins.filter((c) => M.has(c, '1h')); }
function marketRows(asOf) { const o = {}; for (const c of usableCoins()) o[c] = M.bars(c, '1h').filter((r) => r[0] + H <= asOf); return o; }
// exported for other engines: correlation, covariance and hourly volatility for the window ending at asOf
function latest(asOf = M.lastClose('BTC')) { const r = latestFromRows(marketRows(asOf), asOf); return { coins: r.coins, corr: r.corr, cov: r.cov, vol: r.vol }; }

// ---------- the engine ----------
function build(opts = {}) {
  const asOf = opts.asOf || M.lastClose('BTC'), W = cfg.exposure.corrWindowHours, notes = [];
  const rows = marketRows(asOf), mx = buildMatrix(rows), coins = mx.coins, iAsOf = endIndex(mx, asOf);
  const starts = Object.fromEntries(coins.map((c) => [c, U.day(rows[c][0][0])]));

  // A. daily rolling correlation
  const daily = [], vals = [];
  for (let d = Math.ceil(mx.t0 / D) * D; d <= asOf; d += D) {
    const iEnd = endIndex(mx, d); if (iEnd < W) continue;
    const s = windowStats(mx, iEnd, W); if (s.coins.length < 5) continue;
    const pairs = [], toBtc = [], bi = s.coins.indexOf('BTC');
    for (let a = 0; a < s.coins.length; a++) for (let b = a + 1; b < s.coins.length; b++) { const v = s.corr[a][b]; if (v != null) { pairs.push(v); if (a === bi) toBtc.push(v); } }
    if (!pairs.length) continue;
    const avg = U.mean(pairs);
    daily.push({ day: U.day(d), t: d, n_coins: s.coins.length, avg_pair_corr: U.round(avg, 4), avg_corr_to_btc: bi >= 0 ? U.round(U.mean(toBtc), 4) : null, min_pair_corr: U.round(Math.min(...pairs), 4), pctile_1y: U.round(pctile(avg, vals.slice(-365)), 1) });
    vals.push(avg);
  }

  // B. latest matrix (newest daily sample)
  let matrix = { as_of: null, window_hours: W, coins: [], corr: [], beta_to_btc: {}, vol_1h_pct: {} };
  if (daily.length) {
    const T = daily[daily.length - 1].t, s = windowStats(mx, endIndex(mx, T), W), bi = s.coins.indexOf('BTC');
    matrix = { as_of: U.iso(T) + ' UTC', window_hours: W, coins: s.coins, corr: s.corr.map((r) => r.map((v) => U.round(v, 4))),
      beta_to_btc: Object.fromEntries(s.coins.map((c, i) => [c, bi >= 0 ? U.round(s.cov[i][bi] / s.cov[bi][bi], 4) : null])), vol_1h_pct: Object.fromEntries(s.coins.map((c, i) => [c, U.round(s.vol[i] * 100, 4)])) };
  }

  // C. contagion after BTC shocks
  const contagion = []; let nShocks = 0;
  let events = []; try { events = spine.load('events', 'events.jsonl'); } catch (e) { notes.push('events not available: contagion left empty (' + e.message + ')'); }
  const shocks = events.filter((e) => e.kind === 'price_shock' && e.asset === 'BTC' && e.episode_first === true && e.first_seen_at <= asOf);
  nShocks = shocks.length;
  const price = (c, T) => { const i = (T - H - mx.t0) / H; return Number.isInteger(i) && i >= 0 && i < mx.n && T <= asOf ? mx.C[c][i] : NaN; };
  const WINS = [['shock_hour', 0, H], ['next_1h', 0, H], ['next_4h', 0, 4 * H], ['next_24h', 0, 24 * H]];
  const stat = (list) => { const n = list.length; if (!n) return { n: 0, bmed: null, cmed: null, ratio: null, share: null }; return { n, ...(() => { const bm = U.median(list.map((x) => x.b)), cm = U.median(list.map((x) => x.c)); return { bmed: bm, cmed: cm, ratio: Math.abs(bm) < 0.05 ? null : cm / bm }; })(), share: null }; };
  if (coins.includes('BTC')) for (const dir of ['down', 'up']) for (const coin of coins.filter((c) => c !== 'BTC')) for (const [wn, a, b] of WINS) {
    const list = [];
    for (const e of shocks.filter((x) => x.direction === dir)) {
      const S = Math.floor(e.first_seen_at / H) * H;
      const T1 = wn === 'shock_hour' ? S - H : S, T2 = wn === 'shock_hour' ? S : S + b;
      if (T2 > asOf) continue;
      const b1 = price('BTC', T1), b2 = price('BTC', T2), c1 = price(coin, T1), c2 = price(coin, T2);
      if (!(b1 > 0 && b2 > 0 && c1 > 0 && c2 > 0)) continue;
      list.push({ S, b: (b2 / b1 - 1) * 100, c: (c2 / c1 - 1) * 100 });
    }
    const all = stat(list), bef = stat(list.filter((x) => x.S < CUT_2024)), aft = stat(list.filter((x) => x.S >= CUT_2024));
    const share = list.length ? list.filter((x) => (dir === 'down' ? x.c < 0 : x.c > 0)).length / list.length : null;
    contagion.push({ direction: dir, coin, window: wn, n: all.n, btc_median_pct: U.round(all.bmed, 4), coin_median_pct: U.round(all.cmed, 4), ratio: U.round(all.ratio, 3), same_direction_share: U.round(share, 3),
      n_before_2024: bef.n, ratio_before_2024: U.round(bef.ratio, 3), n_from_2024: aft.n, ratio_from_2024: U.round(aft.ratio, 3) });
  }

  // D. lead-lag over the last 365 days
  const leadlag = [], hi = iAsOf, lo = Math.max(1, hi - 365 * 24 + 1);
  if (coins.includes('BTC')) for (const coin of coins.filter((c) => c !== 'BTC')) for (let k = -3; k <= 3; k++) {
    const r = lagCorr(mx.R.BTC, mx.R[coin], k, lo, hi); leadlag.push({ coin, lag_h: k, corr: U.round(r.corr, 4), n: r.n });
  }

  // E. tail co-movement over the whole common history
  const tail = [], cutIdx = Math.ceil((CUT_2024 - mx.t0) / H);
  if (coins.includes('BTC')) for (const coin of coins.filter((c) => c !== 'BTC')) {
    const r = tailStats(mx.R.BTC.subarray(0, iAsOf + 1), mx.R[coin].subarray(0, iAsOf + 1), cutIdx);
    tail.push({ coin, n_btc_tail_hours: r.nDown, p_down_together: U.round(r.pDown, 4), p_up_together: U.round(r.pUp, 4), baseline: 0.05, n_before_2024: r.nBefore, p_down_before_2024: U.round(r.pDownBefore, 4), n_from_2024: r.nFrom, p_down_from_2024: U.round(r.pDownFrom, 4) });
  }
  const skipped = cfg.marketCoins.filter((c) => !coins.includes(c));
  if (skipped.length) notes.push('coins without clean 1h candles, skipped: ' + skipped.join(', '));
  return { asOf, window: W, coins, starts, daily, matrix, contagion, leadlag, tail, nShocks, notes };
}

function run(opts = {}) {
  const j = build(opts);
  const m = spine.write('derived/correlation', { generator: 'engines/correlation', inputs: [spine.ref('market'), spine.ref('events')],
    checks: [{ name: 'at least 5 coins usable', ok: j.coins.length >= 5, detail: `${j.coins.length} coins: ${j.coins.join(' ')}` },
      { name: 'daily rows built', ok: j.daily.length > 0, detail: `${j.daily.length} days as of ${U.iso(j.asOf)} UTC` }],
    notes: j.notes.concat(['1h log returns, close over previous close; pair-hours with a missing bar are skipped', 'rolling window ' + j.window + ' hours, sampled at 00:00 UTC; correlation is population (divide by n)', 'BTC shocks used: ' + j.nShocks + ' (episode_first only)']),
    files: { 'daily.csv': { rows: j.daily, schema: DAILY }, 'matrix.json': { json: j.matrix }, 'contagion.csv': { rows: j.contagion, schema: CONTAGION }, 'leadlag.csv': { rows: j.leadlag, schema: LEADLAG }, 'tail.csv': { rows: j.tail, schema: TAIL } } });
  if (m.status === 'ok' && !opts.noReport) report(j);
  return m;
}

function report(j) {
  const f = (v, d = 2) => (v == null ? '-' : v.toFixed(d)), pc = (v) => (v == null ? '-' : (v * 100).toFixed(1) + '%');
  const last = j.daily[j.daily.length - 1], L = ['# Correlation, contagion and lead-lag', '', `As of ${U.iso(j.asOf)} UTC. Coins: ${j.coins.join(', ')}. Window: ${j.window} hours (7 days) of 1h returns.`, ''];
  L.push('## Now', '');
  if (last) L.push(`- Average pair correlation on ${last.day}: **${f(last.avg_pair_corr)}** (${last.n_coins} coins).`, `- Average correlation with BTC: ${f(last.avg_corr_to_btc)}. Lowest pair: ${f(last.min_pair_corr)}.`,
    `- Percentile in the last year: ${last.pctile_1y == null ? 'not enough history' : f(last.pctile_1y, 0) + ' (0 = most spread out, 100 = most tied together)'}.`);
  else L.push('- No daily rows yet.');
  L.push('', '## Each coin against BTC (latest sample)', '', `Sample: ${j.matrix.as_of}. Beta = how many percent the coin moves for 1 percent in BTC. Volatility = typical size of one hourly move.`, '');
  const bi = j.matrix.coins.indexOf('BTC');
  L.push(U.mdTable(j.matrix.coins.filter((c) => c !== 'BTC'), [['Coin', (c) => c], ['Corr to BTC', (c) => f(j.matrix.corr[j.matrix.coins.indexOf(c)][bi])], ['Beta to BTC', (c) => f(j.matrix.beta_to_btc[c])], ['Hourly vol %', (c) => f(j.matrix.vol_1h_pct[c], 3)]]));
  L.push('', `## What the coins do after a BTC shock (${j.nShocks} first-of-episode shocks)`, '', 'Ratio = coin median move / BTC median move. Above 1 means the coin moves more than BTC. Same direction = share of shocks where the coin moved the same way. Bot coins are marked with *.', '');
  const bots = new Set(['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA']);
  for (const dir of ['down', 'up']) {
    const rows = j.contagion.filter((r) => r.direction === dir && (r.window === 'shock_hour' || r.window === 'next_24h'));
    L.push(`### BTC shock ${dir}`, '', rows.length ? U.mdTable(rows, [['Coin', (r) => r.coin + (bots.has(r.coin) ? '*' : '')], ['Window', (r) => r.window], ['n', (r) => r.n], ['BTC median %', (r) => f(r.btc_median_pct)], ['Coin median %', (r) => f(r.coin_median_pct)], ['Ratio', (r) => f(r.ratio)], ['Same direction', (r) => pc(r.same_direction_share)],
      ['Ratio before 2024 (n)', (r) => `${f(r.ratio_before_2024)} (${r.n_before_2024})`], ['Ratio from 2024 (n)', (r) => `${f(r.ratio_from_2024)} (${r.n_from_2024})`]]) : 'No data.', '');
  }
  L.push('## Lead-lag (last 365 days)', '', 'Correlation of BTC at hour t with the coin at hour t+k. k above 0 means the coin follows BTC.', '');
  const byCoin = [...new Set(j.leadlag.map((r) => r.coin))].map((coin) => { const g = j.leadlag.filter((r) => r.coin === coin), z = g.find((r) => r.lag_h === 0), o = g.filter((r) => r.lag_h !== 0 && r.corr != null).sort((a, b) => b.corr - a.corr)[0]; return { coin, z, o }; });
  L.push(U.mdTable(byCoin, [['Coin', (r) => r.coin], ['Corr at same hour (k=0)', (r) => f(r.z && r.z.corr, 3)], ['Best other lag k', (r) => (r.o ? r.o.lag_h : '-')], ['Corr at that lag', (r) => f(r.o && r.o.corr, 3)]]), '');
  const lagged = byCoin.filter((r) => r.o && r.o.corr > 0.1);
  L.push(lagged.length ? `Best lag: these coins have a lag other than 0 with correlation above 0.1: ${lagged.map((r) => `${r.coin} (k=${r.o.lag_h}, ${f(r.o.corr, 3)})`).join(', ')}. A delay may exist. Check it before using it.`
    : 'Best lag: no lag other than 0 has a correlation above 0.1. The coins move in the same hour and there is no usable delay.', '');
  L.push('## Tail co-movement (whole history)', '', 'When BTC has one of its worst 5% hours, how often does the coin also have one of its own worst 5% hours? If they were unrelated this would be 5%.', '');
  L.push(U.mdTable(j.tail, [['Coin', (r) => r.coin], ['BTC worst hours', (r) => r.n_btc_tail_hours], ['Worst together', (r) => pc(r.p_down_together)], ['Best together', (r) => pc(r.p_up_together)], ['Baseline', (r) => pc(r.baseline)], ['Worst together before 2024 (n)', (r) => `${pc(r.p_down_before_2024)} (${r.n_before_2024})`], ['Worst together from 2024 (n)', (r) => `${pc(r.p_down_from_2024)} (${r.n_from_2024})`]]));
  L.push('', '## Limits', '', '- Correlation is not causation. It says the coins moved together, not that BTC made them move.', '- Coins listed later have shorter history. First candle: ' + j.coins.map((c) => `${c} ${j.starts[c]}`).join(', ') + '.',
    '- Daily samples use overlapping 7-day windows. Neighbouring days share 6 of 7 days of data, so they are not independent.', '- Over 24 hours the BTC median move is close to zero, so the ratio is often empty or meaningless there. Read the same-direction share instead.', '- Shocks cluster in a few stormy periods. Many shocks are not many independent tests.', '- Prices are Binance perpetual candles. The bots trade on MEXC.');
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'correlation.md'), L.join('\n') + '\n');
}

module.exports = { build, run, report, latest, latestFromRows, buildMatrix, windowStats, pairCorr, corrRange, betaRange, lagCorr, tailStats, pctile, endIndex };
if (require.main === module) {
  const t = Date.now(), m = run(), j = m.status === 'ok' ? spine.load('derived/correlation', 'daily.csv') : [], l = j[j.length - 1];
  console.log(`correlation: ${m.status}, ${j.length} days${l ? `, avg pair corr ${l.avg_pair_corr} (1y pctile ${l.pctile_1y})` : ''}, ${((Date.now() - t) / 1000).toFixed(1)}s -> reports/correlation.md`);
}
