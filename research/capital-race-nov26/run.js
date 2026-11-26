// run.js - Nov 26 2026: every strategy under ONE identical setup, ranked by ending capital. Read-only.
//   node --max-old-space-size=8192 run.js  -> results.json      (then node report.js -> RESULTS.md + report.html)
// Identical for everyone: PHP 1,000 start (PHP 60 per USD), risk 2.5% of the realised balance (2% from a USD 500 peak, 1.5% from USD 1,000),
// per-trade risk x 6 / number of coins (same total risk on every coin set), MEXC contract minimums and margin, Binance candles + real funding,
// fee 0.05% + slippage 0.02% per side, open trades valued every hour, entries from Jan 1 2020, exits to Nov 24 2026. Method = hunt-1h-nov26/metrics.js.
'use strict';
const fs = require('fs');
const S = require('../replace-nov25/sim');
const C = require('../../candles/candles.js');
const L4 = require('../hunt-4h-nov26/lib.js'), F4 = require('../hunt-4h-nov26/fam.js');
const L2 = require('../hunt-intraday-nov26/lib.js'), F2 = require('../hunt-intraday-nov26/fam.js');
const L1 = require('../hunt-1h-nov26/lib.js'), FV = require('../hunt-1h-nov26/fam-vol.js');
const { run } = require('../strat-hunt-nov6/engine.js'), HUNT = require('../strat-hunt-nov6/strategies.js');
const DET = require('../zec-replacement-2/detail.json'), DL = Array.isArray(DET) ? DET : DET.data || Object.values(DET);

const H = 3600, ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, T0 = ts(2020), END = S.END, PHP = 60, START = 1000, FEE = 0.0005;
const TIERS = [[0, 0.025], [500 * PHP, 0.02], [1000 * PHP, 0.015]], pctFor = (pk) => { let p = TIERS[0][1]; for (const [b, r] of TIERS) if (pk >= b) p = r; return p; };
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const LIVE6 = ['SOL', 'NEAR', 'ADA', 'GALA', 'ZEC', 'ARB'];
const UNIVERSES = { live6: LIVE6, main: L1.MAIN, hold: L1.HOLD, all24: [...L1.MAIN, ...L1.HOLD] };

// ---------- the strategies (trades from the engines already in the repo) ----------
const hunt = (lib, strat, ex) => (coins, cost) => lib.evaluate(strat, ex, coins, cost, true).trades.map((t) => ({ ...t, w: 1 }));
const live = (kind, mult) => (coins, cost) => coins.flatMap((c) => S.coinTrades(S.real(c), kind, { mult, cost }).map((t) => ({ ...t, coin: c })));
const oldBB = (coins, cost) => {
  const s = HUNT.S.find((x) => x.id === 'bb-core'), out = [];
  for (const cn of coins) {
    const B = C.load(cn, '4h').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })), c = HUNT.makeCtx(B, '4h');
    for (const t of run(B, c.atr14, s.build(c), HUNT.exitOf('BBX', c), C.funding(cn), 14400, { fee: 0.0005 * cost, slip: 0.0002 * cost }).trades) out.push({ ...t, coin: cn, w: 1 });
  }
  return out;
};
const E192 = { kind: 'M', bars: 192 }, bbp = (mult) => ({ len: 80, mult, trend: 800, minStop: 0.3, filt: null });
const ICHI = { fam: 'ichi', p: { t: 9, k: 26, s: 52, mode: 'cross' }, trend: 0, exit: { k: 2, bars: 12 } };
const STRATS = [
  { id: 'bb1h', name: 'BB-CORE 1H (2.0σ)', group: 'listed', gen: hunt(L1, FV.strat(bbp(2.0), E192), FV.mkEx(E192)) },
  { id: 'bb4', name: 'BB-CORE 4H (live v4)', group: 'listed', gen: live('bbT', 1.05) },
  { id: 'wide', name: 'BB-1H-WIDE (2.6σ)', group: 'listed', gen: hunt(L1, FV.strat(bbp(2.6), E192), FV.mkEx(E192)) },
  { id: 'ichi', name: 'ICHI-X4', group: 'listed', gen: hunt(L4, (x) => F4.build(x, ICHI), F4.exOf(ICHI)) },
  { id: 'vol', name: 'VOL-MOM-2H', group: 'listed', gen: hunt(L2, F2.strat({ fam: 'f2', kv: 2.5, kr: 1.2, trend: 400 }), { kInit: 2, kTrail: 8, maxBars: 0, sigExit: false }) },
  { id: 'bbold', name: 'BB-CORE 4H (old rules)', group: 'reference', gen: oldBB },
  { id: 'ic', name: 'I-CORE (live)', group: 'live', gen: live('ic', 1) },
  { id: 'tc', name: 'T-CORE (live)', group: 'live', gen: live('tc', 1) },
];
const SPEC = {};
for (const c of new Set(Object.values(UNIVERSES).flat())) {
  const d = DL.find((s) => s.symbol === (c === 'FIL' ? 'FILECOIN' : c) + '_USDT');   // MEXC lists FIL as FILECOIN_USDT
  if (!d) throw new Error('no MEXC contract data for ' + c);
  SPEC[c] = { cs: d.contractSize, minVol: d.minVol || 1, mmr: d.maintenanceMarginRate || 0.004 };
}

// ---------- hourly closes + funding ----------
const HC = {};
function hourly(c, n) {
  if (HC[c]) return HC[c];
  const NH = Math.round((Date.UTC(2026, 10, 26) / 1000 - T0) / H), close = new Float64Array(NH).fill(NaN), fund = new Float64Array(NH + 1);
  for (const r of C.load(c, '1h')) { const k = (r[0] - T0) / H; if (k >= 0 && k < NH) close[k] = r[4]; }
  for (let k = 1; k < NH; k++) if (Number.isNaN(close[k])) close[k] = close[k - 1];
  for (const [ft, rate] of C.funding(c)) { const k = Math.ceil((ft - T0) / H); if (k >= 0 && k <= NH) fund[k] += rate; }
  for (let k = 1; k <= NH; k++) fund[k] += fund[k - 1];
  return (HC[c] = { close, fund });
}
function openR(t, k) {
  const h = hourly(t.coin), k0 = (t.t - T0) / H, px = h.close[k];
  if (Number.isNaN(px)) return 0;
  const v = (t.dir * (px - t.entry) / t.entry - 2 * FEE - t.dir * (h.fund[k + 1] - h.fund[k0])) / t.dist;
  return t.why === 'stop' && T0 + (k + 1) * H > t.tExit - (t.iv || H) ? Math.max(v, t.R) : v;
}

// ---------- one PHP account, one strategy ----------
// o: { from, to, scale (risk factor for the coin count), k (extra risk multiplier), mexc, basis: 'realised' | 'equity', flat }
function account(trades, o) {
  const from = o.from ?? T0, to = o.to ?? END, k0 = Math.round((from - T0) / H), k1 = Math.round((to - T0) / H);
  const K = (o.scale ?? 1) * (o.k ?? 1), mexc = o.mexc !== false;
  let i = 0; while (i < trades.length && trades[i].t < from) i++;
  let bal = START, peak = START, margin = 0, equity = START, eqPk = START, mdd = 0, closedPk = START, cdd = 0, at = 0, under = 0, skipped = 0, taken = 0, gw = 0, gl = 0, wins = 0, closed = 0;
  const open = [], curve = new Float64Array(k1 - k0);
  for (let k = k0; k < k1; k++) {
    const t0 = T0 + k * H;
    while (i < trades.length && trades[i].t <= t0) {
      const t = trades[i++]; if (t.tExit > to) continue;
      const base = o.basis === 'equity' ? equity : bal, target = base * (o.flat ? 0.025 : pctFor(peak)) * K * t.w;
      if (!(target > 0)) { skipped++; continue; }
      let risk = target, mg = 0;
      if (mexc) {
        const sp = SPEC[t.coin], one = sp.cs * t.entry, per = one * t.dist;
        let vol = Math.max(sp.minVol, Math.round(target / PHP / per)); while (vol >= sp.minVol && vol * per * PHP > 1.5 * target) vol--;
        if (vol < sp.minVol) { skipped++; continue; }
        risk = vol * per * PHP;
        const lev = Math.max(1, Math.min(20, Math.floor(0.5 / (t.dist + sp.mmr))));
        mg = vol * one * PHP / lev;
        if (!(bal - margin >= mg * 1.1)) { skipped++; continue; }
        margin += mg;
      }
      taken++; open.push({ t, risk, mg });
    }
    let value = 0;
    for (let j = open.length - 1; j >= 0; j--) {
      const p = open[j];
      if (p.t.tExit <= t0 + H) {
        const pl = p.risk * p.t.R; bal += pl; margin -= p.mg; open.splice(j, 1); closed++; if (pl > 0) { wins++; gw += pl; } else gl -= pl;
        peak = Math.max(peak, bal); closedPk = Math.max(closedPk, bal); cdd = Math.max(cdd, 1 - bal / closedPk);
      } else value += p.risk * openR(p.t, k);
    }
    equity = Math.max(0, bal + value); curve[k - k0] = equity;
    if (equity >= eqPk) { eqPk = equity; at = k; } mdd = Math.max(mdd, 1 - equity / eqPk); under = Math.max(under, k - at);
  }
  return { curve, from, end: curve[curve.length - 1], balance: bal, mdd, cdd, underDays: under / 24, taken, skipped, win: closed ? wins / closed : 0, pf: gl ? gw / gl : 0 };
}
const mean = (v) => v.reduce((a, b) => a + b, 0) / (v.length || 1);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function stats(r) {
  const n = r.curve.length, days = [], months = []; let pd = START, pm = START; const rets = [];
  for (let i = 0; i < n; i++) {
    const t = r.from + (i + 1) * H, v = r.curve[i];
    if (t % 86400 === 0 || i === n - 1) { rets.push(pd > 0 ? v / pd - 1 : 0); pd = v; days.push([t, v]); }
    if ((t % 86400 === 0 && new Date(t * 1000).getUTCDate() === 1) || i === n - 1) { months.push(pm > 0 ? v / pm - 1 : 0); pm = v; }
  }
  const m = mean(rets), sd = Math.sqrt(mean(rets.map((v) => (v - m) ** 2))), dn = Math.sqrt(mean(rets.map((v) => Math.min(0, v) ** 2))), yrs = (n * H) / (365.25 * 86400);
  const cagr = r.end > 0 ? (r.end / START) ** (1 / yrs) - 1 : -1;
  return { end: r.end, balance: r.balance, cagr, mdd: r.mdd, cdd: r.cdd, calmar: r.mdd ? cagr / r.mdd : 0, sharpe: sd ? (m / sd) * Math.sqrt(365) : 0, sortino: dn ? (m / dn) * Math.sqrt(365) : 0,
    underDays: r.underDays, losingMonths: months.filter((v) => v < 0).length / months.length, worstMonth: Math.min(...months), taken: r.taken, skipped: r.skipped, win: r.win, pf: r.pf, days };
}
const slim = (s) => { const { days, ...rest } = s; return rest; };
// weekly points for the charts
const weekly = (days) => days.filter((d, i) => i % 7 === 0 || i === days.length - 1).map(([t, v]) => [t, +v.toPrecision(5)]);
// the deepest hourly fall from the high point inside each week, for the charts
function weeklyFalls(r) {
  const out = []; let pk = START, deep = 0;
  for (let i = 0; i < r.curve.length; i++) { pk = Math.max(pk, r.curve[i]); deep = Math.max(deep, 1 - r.curve[i] / pk); if (i % 168 === 167 || i === r.curve.length - 1) { out.push([r.from + (i + 1) * H, +deep.toFixed(4)]); deep = 0; } }
  return out;
}
// risk that gives a chosen worst fall (no order minimums, flat 2.5% so that only the strategy differs)
function sameFall(trades, scale, target) {
  let lo = 0.02, hi = 6, best = null;
  for (let it = 0; it < 24; it++) { const k = (lo + hi) / 2, s = stats(account(trades, { scale, k, mexc: false, flat: true })); if (s.mdd > target) hi = k; else { lo = k; best = { k, mdd: s.mdd, cagr: s.cagr, end: s.end }; } }
  return best;
}

// ======================= run =======================
const inRange = (a) => a.filter((t) => t.t >= T0 && t.tExit <= END).sort((a, b) => a.t - b.t || a.coin.localeCompare(b.coin));
const IV = { bb1h: H, wide: H, vol: 7200, ichi: 14400, bb4: 14400, bbold: 14400, ic: 14400, tc: 14400 };
const gen = (s, coins, cost = 1) => s.gen(coins, cost).map((t) => ({ ...t, iv: IV[s.id] }));
const OUT = { meta: { end: new Date(END * 1000).toISOString(), universes: UNIVERSES, strats: STRATS.map(({ id, name, group }) => ({ id, name, group })), start: START, php: PHP }, checks: [], res: {} };

// 0. reproduce the figures quoted from hunt-1h-nov26/metrics.md (live 6 coins, MEXC minimums, their own end date, no coin-count scaling)
for (const [id, name, end, dd, sharpe] of [['bb1h', 'BB-CORE 1H, 6 coins', 32.76e6, 0.481, 2.09], ['bbold', 'BB-CORE 4H old rules, 6 coins', 5.03e6, 0.434, 1.90], ['wide', 'BB-1H-WIDE, 6 coins', 4.40e6, 0.349, 2.05]]) {
  const all = gen(STRATS.find((s) => s.id === id), LIVE6).filter((t) => t.t >= T0).sort((a, b) => a.t - b.t);
  const s = stats(account(all, { to: Math.max(...all.map((t) => t.tExit)) }));
  OUT.checks.push({ name, quoted: { end, dd, sharpe }, here: { end: s.balance, dd: s.mdd, sharpe: s.sharpe } });
  log('check', name, 'quoted', (end / 1e6).toFixed(2) + 'M', 'here', (s.balance / 1e6).toFixed(2) + 'M', 'dd', (100 * s.mdd).toFixed(1), 'sharpe', s.sharpe.toFixed(2));
}

const STARTS = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= END) STARTS.push([ts(y, m), ts(y + 1, m)]);
for (const [u, coins] of Object.entries(UNIVERSES)) {
  OUT.res[u] = {};
  const scale = 6 / coins.length;
  for (const s of STRATS) {
    const tr = inRange(gen(s, coins)), two = inRange(gen(s, coins, 2));
    const acct = account(tr, { scale }), real = stats(acct);
    const yr = {}; for (const y of YEARS) { const a = stats(account(tr, { scale, from: ts(y), to: Math.min(ts(y + 1), END) })); yr[y] = { end: a.end, mdd: a.mdd }; }
    const w = STARTS.map(([a, b]) => account(tr, { scale, from: a, to: b }));
    const since = (a) => slim(stats(account(tr, { scale, from: a })));
    const R = tr.reduce((a, t) => a + t.w * t.R, 0), wins = tr.filter((t) => t.R > 0).length;
    OUT.res[u][s.id] = {
      real: slim(real), curve: weekly(real.days), falls: weeklyFalls(acct),
      ideal: slim(stats(account(tr, { scale, mexc: false }))),
      equity: slim(stats(account(tr, { scale, basis: 'equity' }))),
      two: slim(stats(account(two, { scale }))),
      fall40: sameFall(tr, scale, 0.4),
      since2024: since(ts(2024)), since2026: since(ts(2026)),
      years: yr,
      w: { med: q(w.map((x) => x.end), 0.5), p10: q(w.map((x) => x.end), 0.1), worst: Math.min(...w.map((x) => x.end)), best: Math.max(...w.map((x) => x.end)), medDD: q(w.map((x) => x.mdd), 0.5), worstDD: Math.max(...w.map((x) => x.mdd)), profitable: w.filter((x) => x.end > START).length / w.length, n: w.length },
      trades: tr.length, R, winR: tr.length ? wins / tr.length : 0,
    };
    log(u, s.name, 'end', Math.round(real.end), 'dd', (100 * real.mdd).toFixed(0), 'skip', real.skipped, '| fall40', Math.round(OUT.res[u][s.id].fall40.end));
  }
}
fs.writeFileSync(__dirname + '/results.json', JSON.stringify(OUT));
log('written results.json');
