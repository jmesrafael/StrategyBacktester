// math.js — ZEC vs ETH through the TRADING_MATH.txt checklist (statistics, linear algebra, time series, risk), per coin and as the 5-coin portfolio
// SOL+NEAR+ADA+GALA + ZEC vs + ETH. Trades: trades.json (screen.js: the three live bots, real costs, from 2019-11-11).
//   node math.js  -> math.json (+ console)
'use strict';
const fs = require('fs'), path = require('path');
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'trades.json'), 'utf8'));
const W = { 'BB-CORE': 0.5, 'I-CORE': 0.25, 'T-CORE': 0.25 }, KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'];
const P0 = Date.UTC(2021, 9, 18) / 1000, SPLIT = Date.UTC(2023, 0, 1) / 1000, YR = 365.25 * 86400;
const BTC = JSON.parse(fs.readFileSync(path.join(__dirname, 'data4h', 'BTC.json'), 'utf8'));

// ---- small stats helpers
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const corr = (x, y) => { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return a / Math.sqrt(b * c); };
const skew = (a) => { const m = mean(a), s = sd(a); return a.reduce((t, v) => t + ((v - m) / s) ** 3, 0) / a.length; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); // fixed seed: reproducible Monte Carlo
const maxDD = (rs) => { let e = 0, p = 0, d = 0; for (const r of rs) { e += r; p = Math.max(p, e); d = Math.max(d, p - e); } return d; };

// BTC regime at a time: above / below its 4h SMA200 (trend up / down) — for conditional probability
const btcSma = (() => { const m = new Map(); let s = 0; for (let i = 0; i < BTC.length; i++) { s += BTC[i][4]; if (i >= 200) s -= BTC[i - 200][4]; if (i >= 199) m.set(BTC[i][0], BTC[i][4] > s / 200); } return m; })();
const regimeAt = (t) => { const k = Math.floor(t / 14400) * 14400 - 14400; return btcSma.get(k); };

const coinTrades = (c, from = 0) => Object.entries(W).flatMap(([b, w]) => T[c][b].filter((t) => t[1] > from).map((t) => ({ t: t[0], tExit: t[1], R: t[2], wR: t[2] * w, bot: b, dir: t[3] })));
const monthKey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
function monthly(tr, from) { const m = {}; for (let a = new Date(from * 1000); a < new Date(); a.setUTCMonth(a.getUTCMonth() + 1)) m[a.toISOString().slice(0, 7)] = 0; for (const t of tr) if (t.tExit > from) m[monthKey(t.tExit)] = (m[monthKey(t.tExit)] ?? 0) + t.wR; return m; }

// ---- 1. per coin: sample size, mean/median, EV, dispersion, significance, out-of-sample, conditional, autocorrelation
function coinStats(c) {
  const tr = coinTrades(c), R = tr.map((t) => t.R), wins = R.filter((r) => r > 0), losses = R.filter((r) => r <= 0);
  const per = Object.fromEntries(Object.keys(W).map((b) => { const r = tr.filter((t) => t.bot === b).map((t) => t.R); return [b, { n: r.length, mean: mean(r), median: median(r), sd: sd(r), t: mean(r) / (sd(r) / Math.sqrt(r.length)) }]; }));
  const ordered = [...tr].sort((a, b) => a.tExit - b.tExit).map((t) => t.R);
  const cond = (pred) => { const r = tr.filter(pred).map((t) => t.R); return { n: r.length, mean: r.length ? mean(r) : 0, win: r.length ? r.filter((x) => x > 0).length / r.length : 0 }; };
  const sorted = [...R].sort((a, b) => b - a), total = R.reduce((s, v) => s + v, 0);
  return {
    n: R.length, mean: mean(R), median: median(R), win: wins.length / R.length, avgWin: mean(wins), avgLoss: -mean(losses),
    ev: (wins.length / R.length) * mean(wins) - (losses.length / R.length) * -mean(losses), sd: sd(R), skew: skew(R),
    tStat: mean(R) / (sd(R) / Math.sqrt(R.length)), per,
    inSample: cond((t) => t.tExit <= SPLIT), outSample: cond((t) => t.tExit > SPLIT),
    btcUp: cond((t) => regimeAt(t.t) === true), btcDown: cond((t) => regimeAt(t.t) === false), longs: cond((t) => t.dir === 1), shorts: cond((t) => t.dir === -1),
    lag1: corr(ordered.slice(1), ordered.slice(0, -1)), top10share: sorted.slice(0, 10).reduce((s, v) => s + v, 0) / total, top1pct: sorted.slice(0, Math.ceil(R.length / 100)).reduce((s, v) => s + v, 0) / total,
    yearly: (() => { const y = {}; for (const t of tr) { const k = new Date(t.tExit * 1000).getUTCFullYear(); y[k] = (y[k] || 0) + t.wR; } return y; })(),
  };
}

// ---- 2-4. portfolio: monthly returns, Sharpe, MDD, VaR, correlation matrix, w'Σw risk shares, PCA (effective number of bets), Monte Carlo
function eigSym(A) { // Jacobi eigenvalues of a small symmetric matrix
  const n = A.length, a = A.map((r) => [...r]);
  for (let sweep = 0; sweep < 100; sweep++) { let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2; if (off < 1e-14) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) { if (Math.abs(a[p][q]) < 1e-15) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; } } }
  return a.map((r, i) => r[i]).sort((x, y) => y - x);
}
function portfolio(fifth) {
  const set = [...KEEP, fifth], per = Object.fromEntries(set.map((c) => [c, monthly(coinTrades(c), P0)])), months = Object.keys(per[fifth]).sort();
  const X = set.map((c) => months.map((m) => per[c][m] || 0)), port = months.map((_, i) => X.reduce((s, x) => s + x[i], 0));
  const allTr = set.flatMap((c) => coinTrades(c, P0)).sort((a, b) => a.tExit - b.tExit), wr = allTr.map((t) => t.wR);
  const C = set.map((_, i) => set.map((_, j) => corr(X[i], X[j]))), Cov = set.map((_, i) => set.map((_, j) => { const mi = mean(X[i]), mj = mean(X[j]); return X[i].reduce((s, v, k) => s + (v - mi) * (X[j][k] - mj), 0) / (months.length - 1); }));
  const varP = Cov.flat().reduce((s, v) => s + v, 0), share = set.map((_, i) => Cov[i].reduce((s, v) => s + v, 0) / varP); // w = 1 each: risk contribution of coin i = Σ_j Cov(i,j) / σp²
  const lam = eigSym(C), effBets = lam.reduce((s, v) => s + v, 0) ** 2 / lam.reduce((s, v) => s + v * v, 0);
  // Monte Carlo 1: reshuffle the trade order 10,000x -> max drawdown distribution. Monte Carlo 2: resample 12 months with replacement -> P(losing year)
  const dds = [], yrs = []; for (let k = 0; k < 10000; k++) { const s = [...wr]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } dds.push(maxDD(s)); let y = 0; for (let m = 0; m < 12; m++) y += port[Math.floor(rnd() * port.length)]; yrs.push(y); }
  const mMean = mean(port), mSd = sd(port);
  return { set, months: months.length, total: port.reduce((s, v) => s + v, 0), perYear: port.reduce((s, v) => s + v, 0) / ((Date.now() / 1000 - P0) / YR), mMean, mMedian: median(port), mSd,
    sharpe: (mMean / mSd) * Math.sqrt(12), sortino: (mMean / Math.sqrt(mean(port.map((v) => Math.min(0, v) ** 2)))) * Math.sqrt(12), mdd: maxDD(wr), posMonths: port.filter((v) => v > 0).length / port.length,
    var95: -pct(port, 0.05), var95param: 1.65 * mSd - mMean, cvar95: -mean(port.filter((v) => v <= pct(port, 0.05))), worstMonth: Math.min(...port),
    corr: C, avgCorr: mean(C.flatMap((r, i) => r.filter((_, j) => j > i))), corrFifth: mean(C[4].slice(0, 4)), riskShare: share, eig: lam, effBets,
    mcDD: { median: median(dds), p95: pct(dds, 0.95), p99: pct(dds, 0.99) }, mcLosingYear: yrs.filter((v) => v < 0).length / yrs.length, mcYear5: pct(yrs, 0.05),
    lag1Monthly: corr(port.slice(1), port.slice(0, -1)) };
}

const out = { coins: { ZEC: coinStats('ZEC'), ETH: coinStats('ETH') }, portfolio: { ZEC: portfolio('ZEC'), ETH: portfolio('ETH') } };
fs.writeFileSync(path.join(__dirname, 'math.json'), JSON.stringify(out, null, 1));

const f = (v, d = 2) => (v >= 0 ? '+' : '') + v.toFixed(d), z = out.coins.ZEC, e = out.coins.ETH, pz = out.portfolio.ZEC, pe = out.portfolio.ETH;
const row = (label, a, b, fmt = (v) => f(v)) => console.log(label.padEnd(52) + fmt(a).padStart(12) + fmt(b).padStart(12));
console.log('1) PER COIN — all three bots, every trade from Nov 2019 (R per trade)'.padEnd(52) + 'ZEC'.padStart(12) + 'ETH'.padStart(12));
row('1.1 sample size (trades)', z.n, e.n, (v) => String(v));
row('1.2 mean R per trade', z.mean, e.mean); row('    median R per trade', z.median, e.median);
row('    win rate', z.win, e.win, (v) => (v * 100).toFixed(1) + '%'); row('    average win', z.avgWin, e.avgWin); row('    average loss', z.avgLoss, e.avgLoss);
row('    EV = win% x avg win - loss% x avg loss', z.ev, e.ev);
row('1.3 standard deviation of R', z.sd, e.sd); row('    skew (fat right tail = trend system)', z.skew, e.skew);
row('    top 10 trades = share of all profit', z.top10share, e.top10share, (v) => (v * 100).toFixed(0) + '%'); row('    top 1% of trades = share of profit', z.top1pct, e.top1pct, (v) => (v * 100).toFixed(0) + '%');
row('1.6 t-stat of the mean (CLT; > 2 = unlikely luck)', z.tStat, e.tStat);
for (const b of Object.keys(W)) row(`    ${b}: mean / median / t-stat`, z.per[b].mean, e.per[b].mean, (v) => f(v));
for (const b of Object.keys(W)) row(`    ${b}: t-stat`, z.per[b].t, e.per[b].t);
row('1.1 in-sample (to 2022) mean R', z.inSample.mean, e.inSample.mean); row('    out-of-sample (2023 on) mean R', z.outSample.mean, e.outSample.mean);
row('1.7 P(win | BTC above its SMA200)', z.btcUp.win, e.btcUp.win, (v) => (v * 100).toFixed(1) + '%'); row('    mean R | BTC up-trend', z.btcUp.mean, e.btcUp.mean);
row('    P(win | BTC below its SMA200)', z.btcDown.win, e.btcDown.win, (v) => (v * 100).toFixed(1) + '%'); row('    mean R | BTC down-trend', z.btcDown.mean, e.btcDown.mean);
row('    mean R longs / shorts', z.longs.mean, e.longs.mean); row('    ', z.shorts.mean, e.shorts.mean);
row('3.2 lag-1 autocorrelation of trade R', z.lag1, e.lag1);
console.log('    TRI-CORE R by year  ZEC: ' + Object.entries(z.yearly).map(([y, v]) => y + ' ' + f(v, 0)).join('  '));
console.log('                        ETH: ' + Object.entries(e.yearly).map(([y, v]) => y + ' ' + f(v, 0)).join('  '));
console.log('\n2-4) PORTFOLIO SOL+NEAR+ADA+GALA + 5th coin, monthly TRI-CORE R, Oct 2021 -> Nov 2026'.padEnd(52) + '+ZEC'.padStart(12) + '+ETH'.padStart(12));
row('months', pz.months, pe.months, (v) => String(v)); row('total R', pz.total, pe.total, (v) => f(v, 1)); row('R per year', pz.perYear, pe.perYear, (v) => f(v, 1));
row('mean / median month', pz.mMean, pe.mMean); row('', pz.mMedian, pe.mMedian); row('std dev of a month', pz.mSd, pe.mSd);
row('4.2 Sharpe (annualised, Rf = 0)', pz.sharpe, pe.sharpe); row('    Sortino (downside only)', pz.sortino, pe.sortino);
row('4.3 max drawdown (R)', pz.mdd, pe.mdd, (v) => v.toFixed(1)); row('    positive months', pz.posMonths, pe.posMonths, (v) => (v * 100).toFixed(0) + '%'); row('    worst month', pz.worstMonth, pe.worstMonth, (v) => f(v, 1));
row('4.1 VaR 95% one month (historical)', pz.var95, pe.var95, (v) => v.toFixed(1)); row('    VaR 95% (normal formula 1.65σ - μ)', pz.var95param, pe.var95param, (v) => v.toFixed(1)); row('    CVaR: average of the worst 5% months', pz.cvar95, pe.cvar95, (v) => v.toFixed(1));
row('1.4 avg correlation of the 5 coins (monthly)', pz.avgCorr, pe.avgCorr); row('    5th coin vs the other four', pz.corrFifth, pe.corrFifth);
row("2.3 5th coin's share of portfolio risk (w'Σw)", pz.riskShare[4], pe.riskShare[4], (v) => (v * 100).toFixed(0) + '%');
row('2.4 largest eigenvalue (common factor) of 5', pz.eig[0], pe.eig[0]); row('2.5 PCA effective number of independent bets', pz.effBets, pe.effBets);
row('4.4 Monte Carlo max DD: median', pz.mcDD.median, pe.mcDD.median, (v) => v.toFixed(1)); row('    95th percentile', pz.mcDD.p95, pe.mcDD.p95, (v) => v.toFixed(1)); row('    99th percentile', pz.mcDD.p99, pe.mcDD.p99, (v) => v.toFixed(1));
row('    P(a losing 12 months), bootstrap', pz.mcLosingYear, pe.mcLosingYear, (v) => (v * 100).toFixed(1) + '%'); row('    5th-percentile 12-month R', pz.mcYear5, pe.mcYear5, (v) => f(v, 1));
row('3.2 lag-1 autocorrelation of months', pz.lag1Monthly, pe.lag1Monthly);
console.log('\nrisk shares +ZEC: ' + pz.set.map((c, i) => c + ' ' + (pz.riskShare[i] * 100).toFixed(0) + '%').join('  ') + '\nrisk shares +ETH: ' + pe.set.map((c, i) => c + ' ' + (pe.riskShare[i] * 100).toFixed(0) + '%').join('  '));
