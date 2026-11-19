// analyze.js — Nov 19, 2026: WHY the three live bots lose in streaks and WHERE they make their money.
// Trades: ../tweak-lab-nov13/lab.js tradesOf() with today's live rules (rules v3, same `ch` as live-parity.js), each bot on its LIVE coins,
// Binance 4h, Jan 2020 -> Nov 12 2026, fees + slippage + funding inside R. TRI-CORE = 0.5 BB-CORE + 0.25 I-CORE + 0.25 T-CORE (in R).
// For every trade we stamp (a) what the market looked like AT ENTRY (known then) and (b) what the market DID during the next 7 days
// (hindsight: explains, cannot be traded). Then: losing streaks, drawdowns, best trades, and R by market type.
//   node analyze.js   -> results.json + RESULTS.md
'use strict';
const fs = require('fs'), path = require('path');
const LAB = require(path.join(__dirname, '..', 'tweak-lab-nov13', 'lab.js'));
const I = require(path.join(__dirname, '..', 'strat-hunt-nov6', 'ind.js'));
const { load, tradesOf, LINEUP } = LAB;
const CH = { 'BB-CORE': { bb: { sigma: 1.8 }, maxBars: 42, cooldown: 3 }, 'I-CORE': { kInit: 1.75, beR: 4, beLock: 1 }, 'T-CORE': { bb: { len: 30 }, staleBars: 48, staleR: 1 } };
const W = { 'BB-CORE': 0.5, 'I-CORE': 0.25, 'T-CORE': 0.25 };
const WK = 42; // 42 x 4h = 7 days
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const sum = (a) => a.reduce((s, v) => s + v, 0), avg = (a) => (a.length ? sum(a) / a.length : NaN), med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2), pc = (v) => (100 * v).toFixed(0) + '%';

// ---- per-coin features
const FX = {};
function feats(c) {
  if (FX[c]) return FX[c];
  const x = load(c), n = x.n, er = I.efficiency(x.C, WK), adx = I.adx(x.H, x.L, x.C, 14).adx, idx = new Map();
  x.B.forEach((b, i) => idx.set(b.time, i));
  const atrp = Float64Array.from(x.atr, (a, i) => a / x.C[i]);
  return (FX[c] = { x, n, er, adx, idx, atrp });
}
// forward 7 days after bar i (hindsight): efficiency, net move in ATR (signed), range in ATR
function fwd(F, i, d) {
  const { x } = F, j = Math.min(F.n - 1, i + WK); if (j <= i + 5) return null;
  let p = 0, hi = -Infinity, lo = Infinity; for (let k = i + 1; k <= j; k++) { p += Math.abs(x.C[k] - x.C[k - 1]); hi = Math.max(hi, x.H[k]); lo = Math.min(lo, x.L[k]); }
  const a = x.atr[i], net = x.C[j] - x.C[i];
  return { er: p > 0 ? Math.abs(net) / p : 0, move: (d * net) / a, range: (hi - lo) / a };
}
// market-wide 7-day state at a time: BTC ER and 7d change, average ER of the 8 bot coins
const MKT_COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'];
function mktAt(t, ahead) { // ahead=false: the 7 days before t; true: the 7 days after t
  const out = { er: [], chg: null, btcEr: null };
  for (const c of ['BTC', ...MKT_COINS]) {
    const F = feats(c), i0 = F.idx.get(t - (t % 14400)); if (i0 == null) continue;
    const a = ahead ? i0 : i0 - WK, b = ahead ? i0 + WK : i0; if (a < 1 || b >= F.n) continue;
    let p = 0; for (let k = a + 1; k <= b; k++) p += Math.abs(F.x.C[k] - F.x.C[k - 1]);
    const e = p > 0 ? Math.abs(F.x.C[b] - F.x.C[a]) / p : 0;
    if (c === 'BTC') { out.btcEr = e; out.chg = F.x.C[b] / F.x.C[a] - 1; } else out.er.push(e);
  }
  out.er = avg(out.er); return out;
}

// ---- trades
const ALL = [];
for (const bot of Object.keys(CH)) for (const c of LINEUP[bot]) {
  const F = feats(c), btc = feats('BTC');
  for (const t of tradesOf(bot, c, CH[bot])) {
    const i = F.idx.get(t.t0), s = i - 1; // s = signal candle (entry fills at the next open)
    const bi = btc.idx.get(t.t0), bReg = bi != null && LAB && btc.x.sma200[bi - 1] ? (btc.x.C[bi - 1] > btc.x.sma200[bi - 1] ? 1 : -1) : 0;
    const atrRank = (() => { let k = 0, m = 0; for (let j = Math.max(1, s - 540); j < s; j++) if (I.ok(F.atrp[j])) { m++; if (F.atrp[j] < F.atrp[s]) k++; } return m ? k / m : NaN; })();
    ALL.push({ bot, ...t, w: W[bot] * t.R,
      e: { er: F.er[s], adx: F.adx[s], btcWith: bReg === t.d ? 1 : bReg === -t.d ? -1 : 0, atrRank, stretch: Math.abs(F.x.C[s] - F.x.sma200[s]) / F.x.atr[s] },
      f: fwd(F, i, t.d), m: mktAt(t.t0, true), mb: mktAt(t.t0, false) });
  }
}
ALL.sort((a, b) => a.t1 - b.t1);
const BOTS = Object.keys(CH);
const out = { generated: new Date().toISOString(), trades: ALL.length };
const md = [];
const P = (s = '') => md.push(s);
const table = (head, rows) => { P('| ' + head.join(' | ') + ' |'); P('|' + head.map(() => '---').join('|') + '|'); for (const r of rows) P('| ' + r.join(' | ') + ' |'); P(); };

P('# Why we lose in streaks, and where we make the money');
P(`Generated ${out.generated.slice(0, 16)} UTC by \`node analyze.js\`. Live rules (v3) on each bot's live coins, Binance 4h, Jan 2020 to Nov 12 2026, costs and funding in R.`);
P('TRI-CORE R = 0.5 x BB-CORE + 0.25 x I-CORE + 0.25 x T-CORE. "Next 7 days" columns are hindsight: they explain a result, they cannot be traded.');
P();

// ---- 1. base
P('## 1. The base numbers');
const base = BOTS.map((b) => { const T = ALL.filter((t) => t.bot === b), R = T.map((t) => t.R); let e = 0, pk = 0, dd = 0, ls = 0, cur = 0; for (const r of R) { e += r; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); cur = r <= 0 ? cur + 1 : 0; ls = Math.max(ls, cur); }
  const top = [...R].sort((a, b) => b - a), n10 = Math.ceil(R.length * 0.1);
  return [b, T.length, pc(R.filter((r) => r > 0).length / R.length), f1(e), f2(e / R.length), dd.toFixed(1), ls, f1(sum(top.slice(0, n10))), f1(e - sum(top.slice(0, n10)))]; });
table(['Bot', 'Trades', 'Win', 'Total R', 'Avg R', 'Max DD R', 'Longest losing', 'Best 10% of trades', 'Other 90%'], base);
out.base = base;

// ---- 2. exit reasons
P('## 2. How trades end');
const ex = []; for (const b of BOTS) { const T = ALL.filter((t) => t.bot === b), g = {}; for (const t of T) (g[t.why] ??= []).push(t.R);
  for (const [k, v] of Object.entries(g)) ex.push([b, k, v.length, pc(v.length / T.length), f2(avg(v)), f1(sum(v))]); }
table(['Bot', 'Exit', 'Trades', 'Share', 'Avg R', 'Total R'], ex);

// ---- 3. what the market did after entry (hindsight) — the core answer
P('## 3. What the market did in the 7 days after entry (hindsight)');
P('Coin path over the next 42 candles: **with us** = moved 3+ ATR our way, **against** = 3+ ATR the other way, **sideways** = net move under 3 ATR. Efficiency = net move / total distance travelled (0 = pure chop, 1 = straight line).');
const lab = (t) => (!t.f ? null : t.f.move >= 3 ? 'with us' : t.f.move <= -3 ? 'against' : 'sideways');
const reg = []; out.fwd = {};
for (const b of BOTS) { const T = ALL.filter((t) => t.bot === b && t.f), tot = sum(T.map((t) => t.R));
  for (const k of ['with us', 'sideways', 'against']) { const S = T.filter((t) => lab(t) === k), R = S.map((t) => t.R);
    reg.push([b, k, S.length, pc(S.length / T.length), pc(R.filter((r) => r > 0).length / (R.length || 1)), f2(avg(R)), f1(sum(R)), pc(sum(R) / tot), med(S.map((t) => t.f.er)).toFixed(2)]);
    out.fwd[b + '|' + k] = { n: S.length, R: sum(R) }; } }
table(['Bot', 'Next 7 days', 'Trades', 'Share', 'Win', 'Avg R', 'Total R', 'Share of profit', 'Median efficiency'], reg);
// efficiency buckets
P('Same trades by how choppy the next 7 days were (coin efficiency):');
const eb = [[0, 0.1, 'under 0.10 (chop)'], [0.1, 0.2, '0.10-0.20'], [0.2, 0.35, '0.20-0.35'], [0.35, 0.5, '0.35-0.50'], [0.5, 2, '0.50+ (clean trend)']];
const ebr = []; for (const b of BOTS) for (const [lo, hi, nm] of eb) { const S = ALL.filter((t) => t.bot === b && t.f && t.f.er >= lo && t.f.er < hi), R = S.map((t) => t.R); ebr.push([b, nm, S.length, pc(R.filter((r) => r > 0).length / (R.length || 1)), f2(avg(R)), f1(sum(R))]); }
table(['Bot', 'Efficiency next 7 days', 'Trades', 'Win', 'Avg R', 'Total R'], ebr);

// ---- 4. losing streaks (per bot)
P('## 4. The longest losing streaks, one by one');
P('Streak = losing trades in a row by exit time. Market columns cover the streak window: BTC change, BTC efficiency and the 8 coins\' average efficiency over the whole window (all-time median of 7-day efficiency is given below for comparison).');
const medEr = { btc: med(ALL.map((t) => t.m.btcEr).filter(I.ok)), alt: med(ALL.map((t) => t.m.er).filter(I.ok)) };
P(`All-time median 7-day efficiency: BTC ${medEr.btc.toFixed(2)}, coins ${medEr.alt.toFixed(2)}.`); P();
function windowMkt(t0, t1) { // BTC change + efficiency over [t0,t1], and avg coin efficiency
  const e = [], F = feats('BTC'), a = F.idx.get(t0 - (t0 % 14400)), b = F.idx.get(t1 - (t1 % 14400)) ?? F.n - 1; let res = { chg: NaN, btcEr: NaN, er: NaN, rangePct: NaN };
  if (a == null) return res;
  const erOf = (G, i, j) => { let p = 0; for (let k = i + 1; k <= j; k++) p += Math.abs(G.x.C[k] - G.x.C[k - 1]); return p > 0 ? Math.abs(G.x.C[j] - G.x.C[i]) / p : 0; };
  // efficiency measured in 7-day pieces (a long window always looks choppy), then averaged
  const pieces = (G, i, j) => { const v = []; for (let k = i; k + WK <= j || v.length === 0; k += WK) v.push(erOf(G, k, Math.min(j, k + WK))); return avg(v); };
  let hi = -Infinity, lo = Infinity; for (let k = a; k <= b; k++) { hi = Math.max(hi, F.x.H[k]); lo = Math.min(lo, F.x.L[k]); }
  res = { chg: F.x.C[b] / F.x.C[a] - 1, btcEr: pieces(F, a, b), rangePct: hi / lo - 1 };
  for (const c of MKT_COINS) { const G = feats(c), i = G.idx.get(t0 - (t0 % 14400)), j = G.idx.get(t1 - (t1 % 14400)) ?? G.n - 1; if (i != null && j > i) e.push(pieces(G, i, j)); }
  res.er = avg(e); return res;
}
function streaks(T, min) { const S = []; let cur = []; for (const t of T) { if (t.R <= 0) cur.push(t); else { if (cur.length >= min) S.push(cur); cur = []; } } if (cur.length >= min) S.push(cur); return S; }
out.streaks = {};
const causeOf = (S, m) => {
  const side = avg(S.map((t) => t.d)), longs = S.filter((t) => t.d === 1).length, shorts = S.length - longs;
  const fwdSide = S.filter((t) => t.f && Math.abs(t.f.move) < 3).length / S.length, against = S.filter((t) => t.f && t.f.move <= -3).length / S.length;
  const parts = [];
  if (m.er < medEr.alt * 0.9 && fwdSide >= 0.5) parts.push('sideways chop');
  else if (fwdSide >= 0.6) parts.push('no follow-through (sideways)');
  if (against >= 0.35) parts.push('reversals against us');
  if (Math.abs(m.chg) < 0.08 && m.rangePct > 0.15) parts.push('BTC range-bound');
  if (shorts > longs * 2 && m.chg > 0.05) parts.push('shorting into a bounce');
  if (longs > shorts * 2 && m.chg < -0.05) parts.push('buying into a drop');
  return parts.join(' + ') || 'mixed';
};
for (const b of BOTS) {
  const T = ALL.filter((t) => t.bot === b), S = streaks(T, 1).sort((x, y) => y.length - x.length || sum(x.map((t) => t.R)) - sum(y.map((t) => t.R))).slice(0, 8);
  const rows = S.map((s) => { const m = windowMkt(s[0].t0, s[s.length - 1].t1), coins = [...new Set(s.map((t) => t.c))].join(' '), L = s.filter((t) => t.d === 1).length;
    const side7 = s.filter((t) => t.f && Math.abs(t.f.move) < 3).length, stop = s.filter((t) => t.why === 'stop').length;
    const r = { from: day(s[0].t0), to: day(s[s.length - 1].t1), n: s.length, R: sum(s.map((t) => t.R)), coins, longs: L, shorts: s.length - L, btcChg: m.chg, btcEr: m.btcEr, er: m.er, range: m.rangePct, sideways: side7 / s.length, stops: stop / s.length, cause: causeOf(s, m) };
    (out.streaks[b] ??= []).push(r);
    return [`${r.from} to ${r.to}`, r.n, f1(r.R), coins, `${r.longs}L/${r.shorts}S`, pc(r.btcChg), r.btcEr.toFixed(2), r.er.toFixed(2), pc(r.sideways), pc(r.stops), r.cause]; });
  P(`### ${b}`);
  table(['Window', 'Losses', 'R', 'Coins', 'Side', 'BTC change', 'BTC eff.', 'Coin eff.', 'Went sideways next 7d', 'Hit the stop', 'Likely cause'], rows);
}

// ---- 5. TRI-CORE drawdowns
P('## 5. TRI-CORE\'s 8 deepest drawdowns (closed trades, weighted R)');
const days = new Map(); for (const t of ALL) { const k = day(t.t1); days.set(k, (days.get(k) || 0) + t.w); }
const dk = [...days.keys()].sort(); let e = 0, pk = 0, pkD = dk[0]; const eq = dk.map((k) => { e += days.get(k); if (e > pk) { pk = e; pkD = k; } return { k, e, pk, pkD }; });
const dds = []; { let i = 0; while (i < eq.length) { if (eq[i].e >= eq[i].pk) { i++; continue; } let j = i, lowI = i; while (j < eq.length && eq[j].e < eq[i].pk) { if (eq[j].e < eq[lowI].e) lowI = j; j++; } dds.push({ peak: eq[i].pkD, low: eq[lowI].k, rec: j < eq.length ? eq[j].k : 'not yet', depth: eq[i].pk - eq[lowI].e }); i = j; } }
dds.sort((a, b) => b.depth - a.depth);
const ddRows = dds.slice(0, 8).map((d) => { const t0 = Date.parse(d.peak) / 1000, t1 = Date.parse(d.low) / 1000 + 86400, T = ALL.filter((t) => t.t1 > t0 && t.t1 <= t1), m = windowMkt(t0, t1);
  const by = BOTS.map((b) => f1(sum(T.filter((t) => t.bot === b).map((t) => t.R)))).join(' / '), wc = {}; for (const t of T) wc[t.c] = (wc[t.c] || 0) + t.w;
  const worst = Object.entries(wc).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([c, v]) => `${c} ${f1(v)}`).join(', ');
  const r = { ...d, trades: T.length, win: T.filter((t) => t.R > 0).length / (T.length || 1), btcChg: m.chg, btcEr: m.btcEr, er: m.er, sideways: T.filter((t) => t.f && Math.abs(t.f.move) < 3).length / (T.length || 1), cause: causeOf(T.length ? T : [{ d: 1, f: null, R: 0 }], m) };
  (out.dd ??= []).push(r);
  return [`${d.peak} to ${d.low}`, d.rec, f1(-d.depth), T.length, pc(r.win), by, worst, pc(m.chg), m.btcEr.toFixed(2), m.er.toFixed(2), pc(r.sideways), r.cause]; });
table(['Peak to low', 'Recovered', 'Depth R', 'Trades', 'Win', 'R by bot (BB/I/T)', 'Worst coins', 'BTC change', 'BTC eff.', 'Coin eff.', 'Went sideways', 'Likely cause'], ddRows);

// ---- 6. where the money comes from
P('## 6. Where the money comes from');
const top = [...ALL].sort((a, b) => b.R - a.R), nTop = Math.ceil(ALL.length * 0.05), T5 = top.slice(0, nTop);
P(`Best 5% of trades (${nTop} of ${ALL.length}, all bots): ${f1(sum(T5.map((t) => t.w)))} weighted R of TRI-CORE's ${f1(sum(ALL.map((t) => t.w)))} total.`);
P(`They had a median next-7-day efficiency of ${med(T5.filter((t) => t.f).map((t) => t.f.er)).toFixed(2)} (all trades: ${med(ALL.filter((t) => t.f).map((t) => t.f.er)).toFixed(2)}), ${pc(T5.filter((t) => t.e.btcWith === 1).length / nTop)} were on BTC's side of its SMA200 (all trades: ${pc(ALL.filter((t) => t.e.btcWith === 1).length / ALL.length)}), and held a median ${med(T5.map((t) => t.bars / 6)).toFixed(1)} days (all: ${med(ALL.map((t) => t.bars / 6)).toFixed(1)}).`);
P();
const gb = (key, T = ALL) => { const g = {}; for (const t of T) { const k = key(t); (g[k] ??= []).push(t); } return g; };
const sideRows = []; for (const b of BOTS) for (const d of [1, -1]) for (const w of [1, -1]) { const S = ALL.filter((t) => t.bot === b && t.d === d && t.e.btcWith === w), R = S.map((t) => t.R); sideRows.push([b, d === 1 ? 'long' : 'short', w === 1 ? 'with BTC trend' : 'against BTC trend', S.length, pc(R.filter((r) => r > 0).length / (R.length || 1)), f2(avg(R)), f1(sum(R))]); }
P('### By side and BTC\'s trend at entry (BTC above/below its 4h SMA200)'); table(['Bot', 'Side', 'BTC', 'Trades', 'Win', 'Avg R', 'Total R'], sideRows);
P('### By coin (weighted TRI-CORE R)');
const cr = Object.entries(gb((t) => t.c)).map(([c, T]) => [c, T.length, f1(sum(T.map((t) => t.w))), ...BOTS.map((b) => f1(sum(T.filter((t) => t.bot === b).map((t) => t.R)))), f1(sum(T.filter((t) => t.R > 0).sort((a, b) => b.R - a.R).slice(0, 5).map((t) => t.w)))]).sort((a, b) => parseFloat(b[2]) - parseFloat(a[2]));
table(['Coin', 'Trades', 'TRI-CORE R', 'BB-CORE R', 'I-CORE R', 'T-CORE R', 'of which best 5 trades'], cr);
P('### By year (weighted TRI-CORE R)');
const yr = Object.entries(gb((t) => day(t.t1).slice(0, 4))).sort().map(([y, T]) => { const m = T.map((t) => t.m.er).filter(I.ok); return [y, T.length, f1(sum(T.map((t) => t.w))), ...BOTS.map((b) => f1(sum(T.filter((t) => t.bot === b).map((t) => t.R)))), avg(m).toFixed(2)]; });
table(['Year', 'Trades', 'TRI-CORE R', 'BB-CORE', 'I-CORE', 'T-CORE', 'Avg coin efficiency'], yr);

// ---- 7. months by market type
P('## 7. Months sorted by how trendy the market was');
P('Each month gets the average 7-day efficiency of the 8 coins (measured in weekly pieces). Months are then cut into 5 equal groups.');
const months = {}; { const F = feats('BTC'); for (let i = WK; i < F.n; i += WK) { const t = F.x.B[i].time, k = day(t).slice(0, 7); if (k < '2020-01') continue; const v = []; for (const c of MKT_COINS) { const G = feats(c), j = G.idx.get(t); if (j != null && j >= WK && I.ok(G.er[j])) v.push(G.er[j]); } if (v.length) (months[k] ??= []).push(avg(v)); } }
const mk = Object.keys(months).filter((k) => k <= '2026-10').map((k) => ({ k, er: avg(months[k]), R: sum(ALL.filter((t) => day(t.t1).slice(0, 7) === k).map((t) => t.w)), by: BOTS.map((b) => sum(ALL.filter((t) => t.bot === b && day(t.t1).slice(0, 7) === k).map((t) => t.R))) })).sort((a, b) => a.er - b.er);
const q = 5, qr = []; for (let g = 0; g < q; g++) { const S = mk.slice(Math.floor((g * mk.length) / q), Math.floor(((g + 1) * mk.length) / q));
  qr.push([['1 choppiest', '2', '3', '4', '5 trendiest'][g], S.length, `${S[0].er.toFixed(2)}-${S[S.length - 1].er.toFixed(2)}`, f1(avg(S.map((m) => m.R))), pc(S.filter((m) => m.R < 0).length / S.length), ...BOTS.map((_, b) => f1(avg(S.map((m) => m.by[b])))), S.slice(0, 3).map((m) => m.k).join(' ')]); }
table(['Group', 'Months', 'Efficiency', 'TRI-CORE R / month', 'Losing months', 'BB-CORE R/m', 'I-CORE R/m', 'T-CORE R/m', 'Examples'], qr);
const corr = (a, b) => { const ma = avg(a), mb = avg(b); return sum(a.map((v, i) => (v - ma) * (b[i] - mb))) / Math.sqrt(sum(a.map((v) => (v - ma) ** 2)) * sum(b.map((v) => (v - mb) ** 2))); };
P(`Correlation, month efficiency vs TRI-CORE month R: ${corr(mk.map((m) => m.er), mk.map((m) => m.R)).toFixed(2)}.`); P();
out.months = mk;

// ---- 8. can we see it coming? (entry-time only)
P('## 8. Could we see the chop coming at entry? (known at entry only)');
P('Coin efficiency over the 7 days BEFORE the signal, and ADX(14), cut into 4 equal groups per bot. (A regime gate was already tested and rejected on Nov 16: see TESTED-STRATEGIES.md, "Regime label as a signal". This table is context.)');
const er4 = []; for (const b of BOTS) for (const [nm, key] of [['efficiency before', (t) => t.e.er], ['ADX', (t) => t.e.adx]]) { const T = ALL.filter((t) => t.bot === b && I.ok(key(t))).sort((x, y) => key(x) - key(y));
  for (let g = 0; g < 4; g++) { const S = T.slice(Math.floor((g * T.length) / 4), Math.floor(((g + 1) * T.length) / 4)), R = S.map((t) => t.R);
    er4.push([b, nm, `Q${g + 1} (${key(S[0]).toFixed(2)}-${key(S[S.length - 1]).toFixed(2)})`, S.length, pc(R.filter((r) => r > 0).length / R.length), f2(avg(R)), f1(sum(R)), pc(S.filter((t) => t.f && Math.abs(t.f.move) < 3).length / S.length)]); } }
table(['Bot', 'Measure', 'Group', 'Trades', 'Win', 'Avg R', 'Total R', 'Then went sideways'], er4);

P('### Does it hold in both halves? (Q1 = quietest week before entry, Q4 = most already-trending; same cut points as above)');
const SPL = Date.UTC(2023, 0, 1) / 1000, hr = [];
for (const b of BOTS) for (const [nm, key] of [['efficiency before', (t) => t.e.er], ['ADX', (t) => t.e.adx]]) { const T = ALL.filter((t) => t.bot === b && I.ok(key(t))).sort((x, y) => key(x) - key(y)), cut = [1, 2, 3].map((g) => key(T[Math.floor((g * T.length) / 4)]));
  const qOf = (t) => cut.filter((c) => key(t) >= c).length;
  for (const [hn, f] of [['2020-22', (t) => t.t1 <= SPL], ['2023-26', (t) => t.t1 > SPL]]) hr.push([b, nm, hn, ...[0, 1, 2, 3].map((g) => { const R = T.filter((t) => f(t) && qOf(t) === g).map((t) => t.R); return `${f2(avg(R))} (${R.length})`; })]); }
table(['Bot', 'Measure', 'Half', 'Q1 avg R (n)', 'Q2', 'Q3', 'Q4'], hr);

fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), md.join('\n'));
console.log(md.join('\n'));
