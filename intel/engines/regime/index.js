// engines/regime - market regime detection, regime changes, volatility clustering, and the test of whether
// the regime label actually explains bot results on data it was not fitted on.
//
// The label definitions are the recorder's (lucidio-recorder/regime.js), re-implemented here so this engine has no
// dependency outside intel. test/regime-parity.test.js proves the two give identical output on real candles.
//   trending_up / trending_down : efficiency ratio over 48h >= 0.30 (the price is going somewhere); side = close vs its 800-hour average
//   volatile                    : not trending, Bollinger band width in the widest fifth of the last 90 days
//   quiet                       : band width in the narrowest fifth
//   ranging                     : everything else
// Market state (as the recorder): at least half the coins trending -> trending_up/down, at least half ranging or quiet -> choppy, else mixed.
//
// Outputs: dataset "derived/regime" (history.csv every 4h per coin, market.csv, transitions.json, volatility.json,
// validation.csv, verdict.json) and reports/regime.md.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../../lib/spine'), cfg = require('../../lib/config'), U = require('../../lib/util'), M = require('../../lib/market');
const { H } = U;
const BB_LEN = 80, BB_MULT = 2, TREND_LEN = 800, ATR_LEN = 14, ER_LEN = 48, PCT_WINDOW = 24 * 90, ER_TREND = 0.30, WIDE = 80, NARROW = 20, MIN_CANDLES = TREND_LEN + 5;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const r = (v, d = 3) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(d));

// prepare a coin once: closes, and the band width at every index (so a regime at any hour is cheap)
function series(rows) {
  const closes = rows.map((c) => c[4]), width = new Array(rows.length).fill(null), mid = new Array(rows.length).fill(null), s = new Array(rows.length).fill(null);
  for (let e = BB_LEN - 1; e < rows.length; e++) { const w = closes.slice(e - BB_LEN + 1, e + 1), m = mean(w), d = sd(w); mid[e] = m; s[e] = d; width[e] = m > 0 ? ((2 * BB_MULT * d) / m) * 100 : null; }
  return { rows, closes, width, mid, s, index: new Map(rows.map((c, i) => [c[0], i])) };
}
// the regime of a coin using bars 0..i only (bar i is the last CLOSED bar). null when there is not enough history.
function regimeAt(S, i) {
  const n = i + 1; if (n < MIN_CANDLES) return null;
  const { rows, closes } = S, close = closes[i], trs = [];
  for (let k = n - ATR_LEN; k < n; k++) { const h = rows[k][2], l = rows[k][3], pc = rows[k - 1][4]; trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))); }
  const rets = (k) => { const out = []; for (let j = n - k; j < n; j++) out.push(Math.log(closes[j] / closes[j - 1])); return out; };
  const rv24 = sd(rets(24)) * Math.sqrt(24) * 100, rv7d = sd(rets(168)) * Math.sqrt(24) * 100;
  const sma = mean(closes.slice(n - TREND_LEN, n)), trendPct = ((close - sma) / sma) * 100;
  let pathLen = 0; for (let j = n - ER_LEN + 1; j < n; j++) pathLen += Math.abs(closes[j] - closes[j - 1]);
  const er = pathLen > 0 ? Math.abs(closes[n - 1] - closes[n - ER_LEN]) / pathLen : 0;
  const bw = S.width[i], bbPos = S.s[i] > 0 ? (close - S.mid[i]) / (BB_MULT * S.s[i]) : 0;
  let cnt = 0, below = 0; for (let e = Math.max(BB_LEN - 1, n - 1 - PCT_WINDOW); e < n; e += 6) { cnt++; if (S.width[e] != null && S.width[e] <= bw) below++; }
  const pct = cnt ? (below / cnt) * 100 : null;
  const state = er >= ER_TREND ? (close >= sma ? 'trending_up' : 'trending_down') : pct >= WIDE ? 'volatile' : pct <= NARROW ? 'quiet' : 'ranging';
  return { state, atr_pct: r((mean(trs) / close) * 100), rv24: r(rv24), rv7d: r(rv7d), trend_pct: r(trendPct, 2), er48: r(er), bbw: r(bw, 2), bbw_pctile: r(pct, 1), bb_pos: r(bbPos, 2) };
}
// index of the last bar closed at or before T (null if that bar is missing)
const idxAt = (S, T) => { const i = S.index.get(Math.floor(T / H) * H - H); return i == null ? null : i; };
const coinRegimeAt = (S, T) => { const i = idxAt(S, T); return i == null ? null : regimeAt(S, i); };
function marketAt(SS, T) {          // SS = { coin: series }
  const st = {}, ok = [];
  for (const [c, S] of Object.entries(SS)) { const g = coinRegimeAt(S, T); if (g) { st[c] = g; ok.push(c); } }
  if (!ok.length) return null;
  const rs = ok.map((c) => { const S = SS[c], i = idxAt(S, T), out = []; for (let j = i - 167; j <= i; j++) out.push(Math.log(S.closes[j] / S.closes[j - 1])); return out; });
  const cs = []; for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) { const v = U.corr(rs[a], rs[b]); if (v != null) cs.push(v); }
  const states = ok.map((c) => st[c].state), cnt = (f) => states.filter(f).length, up = cnt((s) => s === 'trending_up'), down = cnt((s) => s === 'trending_down'), trending = up + down, choppy = cnt((s) => s === 'ranging' || s === 'quiet');
  const half = Math.ceil(ok.length / 2);
  return { n: ok.length, trending_n: trending, up_n: up, down_n: down, breadth_up_pct: r((ok.filter((c) => st[c].trend_pct > 0).length / ok.length) * 100, 0), avg_corr_7d: r(cs.length ? mean(cs) : null, 2),
    market_state: trending >= half ? (up >= down ? 'trending_up' : 'trending_down') : choppy >= half ? 'choppy' : 'mixed' };
}

// ---------- validation: does the label at the signal explain the trade's result on unseen data? ----------
const CUT = Date.UTC(2024, 0, 1) / 1000;
// spread = avg R of trades in the states that were best before 2024 minus avg R in the states that were worst, measured from 2024 on.
// p = share of 2,000 random relabelings of the later trades that give a spread at least as large (fixed seed).
function validate(trades, label, seed = 5) {
  const pre = trades.filter((t) => t.t < CUT && t[label]), post = trades.filter((t) => t.t >= CUT && t[label]), states = [...new Set(pre.map((t) => t[label]))];
  const avg = (list, s) => { const v = list.filter((t) => t[label] === s).map((t) => t.r); return v.length ? mean(v) : null; };
  const rows = states.map((s) => ({ state: s, n_pre: pre.filter((t) => t[label] === s).length, avg_pre: avg(pre, s), n_post: post.filter((t) => t[label] === s).length, avg_post: avg(post, s) })).filter((x) => x.n_pre >= 20).sort((a, b) => b.avg_pre - a.avg_pre);
  if (rows.length < 3 || post.length < 60) return { rows, verdict: 'not enough data', spread: null, p: null };
  const k = Math.max(1, Math.floor(rows.length / 2)), best = new Set(rows.slice(0, k).map((x) => x.state)), worst = new Set(rows.slice(-k).map((x) => x.state));
  const spreadOf = (labels) => { const a = [], b = []; post.forEach((t, i) => { if (best.has(labels[i])) a.push(t.r); else if (worst.has(labels[i])) b.push(t.r); }); return a.length && b.length ? mean(a) - mean(b) : null; };
  const labels = post.map((t) => t[label]), spread = spreadOf(labels), rnd = U.rng(seed); let ge = 0, tot = 0;
  for (let it = 0; it < 2000; it++) { const sh = labels.slice(); for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; } const v = spreadOf(sh); if (v != null) { tot++; if (v >= spread) ge++; } }
  const p = tot ? ge / tot : null, preSpread = mean(rows.slice(0, k).map((x) => x.avg_pre)) - mean(rows.slice(-k).map((x) => x.avg_pre));
  return { rows, best: [...best], worst: [...worst], pre_spread: r(preSpread), spread: r(spread), p: r(p), verdict: spread != null && spread > 0 && p < 0.05 ? 'validated' : 'not validated' };
}

const HIST = { t: 'int', coin: 'string', state: 'string', er48: 'number?', bbw_pctile: 'number?', trend_pct: 'number?', rv7d: 'number?' };
const MKT = { t: 'int', market_state: 'string', n: 'int', trending_n: 'int', up_n: 'int', down_n: 'int', breadth_up_pct: 'number?', avg_corr_7d: 'number?' };
const VAL = { bot: 'string', label: 'string', state: 'string', n_before_2024: 'int', avg_r_before_2024: 'number?', n_from_2024: 'int', avg_r_from_2024: 'number?' };

function build(opts = {}) {
  const asOf = opts.asOf || M.lastClose('BTC'), coins = [...new Set(['BTC'].concat(...Object.values(cfg.bots).map((b) => b.coins)))].filter((c) => M.has(c, '1h'));
  const SS = Object.fromEntries(coins.map((c) => [c, series(M.bars(c, '1h', { to: asOf }))])), core = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'].filter((c) => SS[c]);
  const coreSS = Object.fromEntries(core.map((c) => [c, SS[c]]));
  // history every 4h
  const start = Date.UTC(2020, 5, 1) / 1000, hist = [], mkt = [];
  for (let T = start; T <= asOf; T += 4 * H) {
    for (const c of coins) { const g = coinRegimeAt(SS[c], T); if (g) hist.push({ t: T, coin: c, state: g.state, er48: g.er48, bbw_pctile: g.bbw_pctile, trend_pct: g.trend_pct, rv7d: g.rv7d }); }
    const m = marketAt(coreSS, T); if (m && m.n >= 3) mkt.push({ t: T, ...m });
  }
  // regime changes: time share, average length of a stay, what follows what, and the current stay
  const trans = { states: {}, matrix: {}, current: {}, changes_7d: [] };
  for (const c of coins) {
    const h = hist.filter((x) => x.coin === c); let runStart = 0;
    for (let i = 1; i <= h.length; i++) if (i === h.length || h[i].state !== h[i - 1].state) {
      const s = h[i - 1].state, len = (i - runStart) * 4; (trans.states[s] = trans.states[s] || { hours: 0, stays: 0 }); trans.states[s].hours += len; trans.states[s].stays++;
      if (i < h.length) { (trans.matrix[s] = trans.matrix[s] || {}); trans.matrix[s][h[i].state] = (trans.matrix[s][h[i].state] || 0) + 1; if (h[i].t > asOf - 7 * 86400) trans.changes_7d.push({ coin: c, t: h[i].t, from: s, to: h[i].state }); }
      else trans.current[c] = { state: s, hours_in_state: len, since: h[runStart].t };
      runStart = i;
    }
  }
  const totH = U.sum(Object.values(trans.states).map((x) => x.hours));
  for (const s of Object.keys(trans.states)) { trans.states[s].share = r(trans.states[s].hours / totH); trans.states[s].avg_stay_hours = r(trans.states[s].hours / trans.states[s].stays, 1); }
  trans.market_now = mkt.length ? mkt[mkt.length - 1] : null;
  // volatility clustering on BTC: does a volatile hour or day tend to be followed by another?
  const b = SS.BTC.closes, ar = []; for (let i = 1; i < b.length; i++) ar.push(Math.abs(Math.log(b[i] / b[i - 1])));
  const ac = (lag) => r(U.corr(ar.slice(0, ar.length - lag), ar.slice(lag)), 3), day = []; for (let i = 24; i + 24 <= ar.length; i += 24) day.push([U.sum(ar.slice(i - 24, i)), U.sum(ar.slice(i, i + 24))]);
  const q20 = U.quantile(day.map((d) => d[0]), 0.2), q80 = U.quantile(day.map((d) => d[0]), 0.8), calm = day.filter((d) => d[0] <= q20).map((d) => d[1]), wild = day.filter((d) => d[0] >= q80).map((d) => d[1]);
  const vol = { coin: 'BTC', autocorr_abs_return: { lag_1h: ac(1), lag_24h: ac(24), lag_168h: ac(168) }, next_day_move_after_calm_day: r(mean(calm) * 100, 2), next_day_move_after_wild_day: r(mean(wild) * 100, 2), ratio: r(mean(wild) / mean(calm), 2),
    note: 'next_day_move = sum of absolute hourly moves over the following 24h, in percent. calm / wild = the quietest / most active fifth of days.' };
  // validation against the reference backtests (current rules, standard costs): label at the signal candle's close
  const val = [], verdicts = [];
  let ref = []; try { ref = spine.load('derived/reference-trades', 'trades.csv').filter((t) => t.version === 'v3' && t.cost === 'standard'); } catch (e) { verdicts.push({ bot: 'all', label: '-', verdict: 'blocked: reference backtests not built (' + e.code + ')' }); }
  const mcache = new Map(), mAt = (T) => { if (!mcache.has(T)) { const m = marketAt(coreSS, T); mcache.set(T, m ? m.market_state : null); } return mcache.get(T); };
  for (const bot of [...new Set(ref.map((t) => t.bot))]) {
    const tr = ref.filter((t) => t.bot === bot && SS[t.coin]).map((t) => { const T = t.sig_t + 4 * H, g = coinRegimeAt(SS[t.coin], T); return { ...t, coin_state: g ? g.state : null, market_state: mAt(T) }; });
    for (const label of ['coin_state', 'market_state']) { const v = validate(tr, label);
      for (const x of v.rows) val.push({ bot, label, state: x.state, n_before_2024: x.n_pre, avg_r_before_2024: r(x.avg_pre), n_from_2024: x.n_post, avg_r_from_2024: r(x.avg_post) });
      verdicts.push({ bot, label, verdict: v.verdict, best_before_2024: (v.best || []).join(', '), worst_before_2024: (v.worst || []).join(', '), spread_before_2024: v.pre_spread == null ? null : v.pre_spread, spread_from_2024: v.spread, p_value: v.p }); }
  }
  return { asOf, coins, hist, mkt, trans, vol, val, verdicts };
}

function run(opts = {}) {
  const g = build(opts), validated = g.verdicts.filter((v) => v.verdict === 'validated');
  const m = spine.write('derived/regime', { generator: 'engines/regime', inputs: [spine.ref('market')].concat(spine.exists('derived/reference-trades') ? [spine.ref('derived/reference-trades')] : []),
    checks: [{ name: 'regime history built', ok: g.hist.length > 0, detail: `${g.hist.length} coin rows, ${g.mkt.length} market rows, ${g.coins.length} coins` }],
    notes: [`validation: ${validated.length} of ${g.verdicts.length} bot x label tests passed on data from 2024 on`, validated.length ? 'a passed test is evidence, not a rule: see reports/regime.md' : 'the regime label is context only: it must not be used as a trading filter'],
    files: { 'history.csv': { rows: g.hist, schema: HIST }, 'market.csv': { rows: g.mkt, schema: MKT }, 'transitions.json': { json: g.trans }, 'volatility.json': { json: g.vol }, 'validation.csv': { rows: g.val, schema: VAL },
      'verdict.json': { json: { as_of: g.asOf, validated_as_signal: validated.length > 0 && validated.length === g.verdicts.length, tests: g.verdicts } } } });
  const L = ['# Market regime', '', `As of ${U.iso(g.asOf)} UTC.`, '', '## Now', '',
    g.trans.market_now ? `Market (5 core coins): **${g.trans.market_now.market_state}**, ${g.trans.market_now.trending_n} of ${g.trans.market_now.n} trending (${g.trans.market_now.up_n} up, ${g.trans.market_now.down_n} down), average 7-day correlation ${g.trans.market_now.avg_corr_7d}.` : 'No market reading.', '',
    U.mdTable(Object.entries(g.trans.current), [['Coin', (x) => x[0]], ['State', (x) => x[1].state], ['In this state for', (x) => x[1].hours_in_state + 'h'], ['Since (UTC)', (x) => U.iso(x[1].since)]]), '',
    '## Changes in the last 7 days', '', g.trans.changes_7d.length ? U.mdTable(g.trans.changes_7d.sort((a, b) => a.t - b.t), [['Time (UTC)', (x) => U.iso(x.t)], ['Coin', (x) => x.coin], ['From', (x) => x.from], ['To', (x) => x.to]]) : 'None.', '',
    '## How long each state lasts (all coins, since mid-2020)', '', U.mdTable(Object.entries(g.trans.states), [['State', (x) => x[0]], ['Share of time', (x) => Math.round(x[1].share * 100) + '%'], ['Average stay', (x) => x[1].avg_stay_hours + 'h'], ['Stays', (x) => x[1].stays],
      ['Most often followed by', (x) => { const mx = g.trans.matrix[x[0]] || {}, tot = U.sum(Object.values(mx)); return Object.entries(mx).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s, n]) => `${s} ${Math.round(n / tot * 100)}%`).join(', '); }]]), '',
    '## Volatility clustering (BTC)', '', `After one of the most active fifth of days, the next day's total movement averages ${g.vol.next_day_move_after_wild_day}%; after one of the calmest fifth, ${g.vol.next_day_move_after_calm_day}% (${g.vol.ratio}x). Active days follow active days.`,
    `Correlation of the size of hourly moves with itself: 1 hour later ${g.vol.autocorr_abs_return.lag_1h}, 24 hours later ${g.vol.autocorr_abs_return.lag_24h}, 7 days later ${g.vol.autocorr_abs_return.lag_168h}. This describes the size of moves, not their direction.`, '',
    '## Does the regime label explain bot results on unseen data?', '', 'Each reference-backtest trade is labelled with the regime at its signal. States are ranked on trades before 2024. The test then asks whether the better-ranked states also did better from 2024 on.', '',
    U.mdTable(g.verdicts, [['Bot', (x) => x.bot], ['Label', (x) => x.label], ['Best before 2024', (x) => x.best_before_2024], ['Worst before 2024', (x) => x.worst_before_2024], ['Gap before 2024 (R)', (x) => U.signed(x.spread_before_2024)], ['Gap from 2024 (R)', (x) => U.signed(x.spread_from_2024)], ['Chance value', (x) => x.p_value], ['Verdict', (x) => x.verdict]]), '',
    '"Chance value" is how often shuffled labels give a gap at least as large. Below 0.05 with a positive gap counts as validated.', '',
    U.mdTable(g.val, [['Bot', (x) => x.bot], ['Label', (x) => x.label], ['State', (x) => x.state], ['Trades before 2024', (x) => x.n_before_2024], ['Avg R before 2024', (x) => U.signed(x.avg_r_before_2024)], ['Trades from 2024', (x) => x.n_from_2024], ['Avg R from 2024', (x) => U.signed(x.avg_r_from_2024)]]), '',
    '## Limits', '', '- The label thresholds were chosen by hand for the recorder and are not tuned here.', '- A "not validated" verdict means the label is context for reading the journal, not a filter for trades.', '- Six bot x label tests are run, so one could pass by chance.'];
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'regime.md'), L.join('\n') + '\n');
  return m;
}
module.exports = { series, regimeAt, coinRegimeAt, marketAt, validate, build, run, MIN_CANDLES };
if (require.main === module) { const m = run(); console.log('regime:', m.status, '|', m.notes[0], '-> reports/regime.md'); }
