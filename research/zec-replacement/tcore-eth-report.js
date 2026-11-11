// tcore-eth-report.js — ETH on T-CORE in detail: every year and month, the TRADING_MATH.txt checks, ETH against the five coins T-CORE traded
// (SOL, ZEC, NEAR, ADA, GALA) and the T-CORE portfolio with ZEC vs with ETH. Writes the ledger report and its index entry.
//   node tcore-eth-report.js  -> ../../../🔴LEDGER/reports/tcore-eth.html, ../../../🔴LEDGER/reports/index.json, tcore-eth.json
// Trades: trades.json (screen.js; T-CORE = bb-core entry, 2 ATR stop, 14 ATR trail; real fees, slippage and funding; trades from 2019-11-11),
// results10.json (run10.js) for ETH's 2017-2019 years. Same engine as the bot (parity.js: identical trade for trade on T-CORE).
'use strict';
const fs = require('fs'), path = require('path');
const LEDGER = path.join(__dirname, '..', '..', '..', '🔴LEDGER', 'reports');
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'trades.json'), 'utf8'));
const R10 = JSON.parse(fs.readFileSync(path.join(__dirname, 'results10.json'), 'utf8'));
const BTC = JSON.parse(fs.readFileSync(path.join(__dirname, 'data4h', 'BTC.json'), 'utf8'));
const CSS = fs.readFileSync(path.join(LEDGER, 'live-pair-vs-three-bot.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const BOT = 'T-CORE', COINS = ['ETH', 'SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'];
const DATE = 'Nov 12, 2026', TITLE = 'ETH on T-CORE';
const YR = 365.25 * 86400, SPLIT = Date.UTC(2023, 0, 1) / 1000, C0 = Date.UTC(2022, 0, 1) / 1000, C1 = Date.UTC(2026, 10, 1) / 1000, P0 = Date.UTC(2021, 9, 18) / 1000;

// ---- helpers
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const corr = (x, y) => { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return a / Math.sqrt(b * c); };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
let seed = 20261112; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const maxDD = (rs) => { let e = 0, p = 0, d = 0; for (const r of rs) { e += r; p = Math.max(p, e); d = Math.max(d, p - e); } return d; };
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const trades = (c) => T[c][BOT].map((t) => ({ t: t[0], x: t[1], R: t[2], dir: t[3] })).sort((a, b) => a.x - b.x);
const monthKeys = (from, to) => { const k = []; for (let d = new Date(from * 1000); d.getTime() / 1000 < to; d.setUTCMonth(d.getUTCMonth() + 1)) k.push(d.toISOString().slice(0, 7)); return k; };
const monthly = (tr, keys) => { const m = Object.fromEntries(keys.map((k) => [k, 0])); for (const t of tr) if (m[ym(t.x)] !== undefined) m[ym(t.x)] += t.R; return keys.map((k) => m[k]); };
const btcUp = (() => { const m = new Map(); let s = 0; for (let i = 0; i < BTC.length; i++) { s += BTC[i][4]; if (i >= 200) s -= BTC[i - 200][4]; if (i >= 199) m.set(BTC[i][0], BTC[i][4] > s / 200); } return (t) => m.get(Math.floor(t / 14400) * 14400 - 14400); })();
function stats(tr) {
  const R = tr.map((t) => t.R), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0), tot = R.reduce((a, b) => a + b, 0);
  let run = 0, streak = 0; for (const r of R) { if (r <= 0) { run++; streak = Math.max(streak, run); } else run = 0; }
  return { n: R.length, win: w.length / R.length, pf: w.reduce((a, b) => a + b, 0) / -l.reduce((a, b) => a + b, 0), exp: tot / R.length, total: tot, dd: maxDD(R), avgWin: mean(w), avgLoss: -mean(l), streak, best: Math.max(...R) };
}
function monthStats(mv) {
  let run = 0, mr = 0; for (const v of mv) { if (v < 0) { run++; mr = Math.max(mr, run); } else run = 0; }
  let w12 = Infinity, neg = 0, n = 0; for (let i = 0; i + 12 <= mv.length; i++) { const s = mv.slice(i, i + 12).reduce((a, b) => a + b, 0); w12 = Math.min(w12, s); n++; if (s < 0) neg++; }
  let e = 0, pk = 0, u = 0, mu = 0; for (const v of mv) { e += v; if (e >= pk) { pk = e; u = 0; } else { u++; mu = Math.max(mu, u); } }
  const m = mean(mv), s = sd(mv), down = Math.sqrt(mean(mv.map((v) => Math.min(0, v) ** 2)));
  return { months: mv.length, losing: mv.filter((v) => v < 0).length, flat: mv.filter((v) => v === 0).length, run: mr, worst: Math.min(...mv), best: Math.max(...mv), w12, neg12: neg / n, under: mu, perMonth: m, median: median(mv), sharpe: (m / s) * Math.sqrt(12), sortino: (m / down) * Math.sqrt(12), var95: -pct(mv, 0.05), cvar95: -mean(mv.filter((v) => v <= pct(mv, 0.05))) };
}

// ---- 1. ETH: years and months (2020 -> Nov 2026), plus 2017-2019 from the 10-year run
const eth = trades('ETH'), firstYear = 2020;
const allKeys = monthKeys(Date.UTC(2019, 10, 1) / 1000, Date.UTC(2026, 10, 12) / 1000), ethMv = monthly(eth, allKeys);
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const yearRows = YEARS.map((y) => { const tr = eth.filter((t) => new Date(t.x * 1000).getUTCFullYear() === y || (y === 2020 && new Date(t.x * 1000).getUTCFullYear() === 2019)); const keys = allKeys.filter((k) => +k.slice(0, 4) === y || (y === 2020 && k.startsWith('2019'))); const mv = monthly(tr, keys); return { y, ...stats(tr), months: keys.length, losingM: mv.filter((v) => v < 0).length, bestM: Math.max(...mv), worstM: Math.min(...mv) }; });
const ten = R10.coins.ETH.bots['T-CORE'].years; // 2017.. from the Poloniex + Binance 10-year series

// ---- 2. trading math (ETH, every T-CORE trade since Nov 2019)
const R = eth.map((t) => t.R), st = stats(eth), mvAll = monthly(eth, monthKeys(Date.UTC(2020, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000));
const sorted = [...R].sort((a, b) => b - a), cond = (f) => { const r = eth.filter(f).map((t) => t.R); return { n: r.length, mean: mean(r), win: r.filter((x) => x > 0).length / r.length }; };
const ms = monthStats(mvAll);
const dds = [], yrs = []; for (let k = 0; k < 10000; k++) { const s = [...R]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } dds.push(maxDD(s)); let y = 0; for (let m = 0; m < 12; m++) y += mvAll[Math.floor(rnd() * mvAll.length)]; yrs.push(y); }
const math = {
  n: st.n, mean: mean(R), median: median(R), win: st.win, avgWin: st.avgWin, avgLoss: st.avgLoss, ev: st.win * st.avgWin - (1 - st.win) * st.avgLoss, sd: sd(R),
  skew: R.reduce((a, v) => a + ((v - mean(R)) / sd(R)) ** 3, 0) / R.length, top10: sorted.slice(0, 10).reduce((a, b) => a + b, 0) / st.total, withoutTop10: st.total - sorted.slice(0, 10).reduce((a, b) => a + b, 0),
  tStat: mean(R) / (sd(R) / Math.sqrt(R.length)), inS: cond((t) => t.x <= SPLIT), outS: cond((t) => t.x > SPLIT), up: cond((t) => btcUp(t.t) === true), down: cond((t) => btcUp(t.t) === false),
  longs: cond((t) => t.dir === 1), shorts: cond((t) => t.dir === -1), lag1: corr(R.slice(1), R.slice(0, -1)), lagM: corr(mvAll.slice(1), mvAll.slice(0, -1)),
  ...ms, dd: st.dd, streak: st.streak, mcDD: { p50: median(dds), p95: pct(dds, 0.95), p99: pct(dds, 0.99) }, mcLoseYear: yrs.filter((v) => v < 0).length / yrs.length, mcYear5: pct(yrs, 0.05),
};

// ---- 3. ETH vs the five coins on T-CORE, same window (Jan 2022 -> Oct 2026, 58 months: every coin complete)
const cKeys = monthKeys(C0, C1);
const cmp = Object.fromEntries(COINS.map((c) => { const tr = trades(c).filter((t) => t.x > C0 && t.x <= C1), s = stats(tr), m = monthStats(monthly(tr, cKeys)), r = tr.map((t) => t.R);
  const years = {}; for (const t of tr) { const y = new Date(t.x * 1000).getUTCFullYear(); years[y] = (years[y] || 0) + t.R; }
  const rec = monthly(tr.filter((t) => t.x > Date.UTC(2025, 0, 1) / 1000), monthKeys(Date.UTC(2025, 0, 1) / 1000, C1));
  return [c, { ...s, ...m, t: mean(r) / (sd(r) / Math.sqrt(r.length)), yearsPos: Object.values(years).filter((v) => v > 0).length, yearsN: Object.keys(years).length, worstYear: Math.min(...Object.values(years)), recent: mean(rec), recentLosing: rec.filter((v) => v < 0).length / rec.length }]; }));

// ---- 4. the T-CORE portfolio: SOL+NEAR+ADA+GALA + ZEC (before) vs + ETH (now), from Oct 2021 (when all coins trade)
const pKeys = monthKeys(P0, Date.UTC(2026, 10, 1) / 1000);
function port(fifth) {
  const set = [...KEEP, fifth], X = set.map((c) => monthly(trades(c).filter((t) => t.x > P0), pKeys)), mv = pKeys.map((_, i) => X.reduce((s, x) => s + x[i], 0));
  const allR = set.flatMap((c) => trades(c).filter((t) => t.x > P0)).sort((a, b) => a.x - b.x).map((t) => t.R);
  const Cov = set.map((_, i) => set.map((_, j) => { const a = X[i], b = X[j], ma = mean(a), mb = mean(b); return a.reduce((s, v, k) => s + (v - ma) * (b[k] - mb), 0) / (a.length - 1); })), vp = Cov.flat().reduce((a, b) => a + b, 0);
  const m = monthStats(mv);
  return { set, total: allR.reduce((a, b) => a + b, 0), dd: maxDD(allR), ...m, corr5: mean(KEEP.map((_, i) => corr(X[4], X[i]))), share5: Cov[4].reduce((a, b) => a + b, 0) / vp };
}
const pz = port('ZEC'), pe = port('ETH'), pk = (() => { const X = KEEP.map((c) => monthly(trades(c).filter((t) => t.x > P0), pKeys)), mv = pKeys.map((_, i) => X.reduce((s, x) => s + x[i], 0)); const allR = KEEP.flatMap((c) => trades(c).filter((t) => t.x > P0)).sort((a, b) => a.x - b.x).map((t) => t.R); return { total: allR.reduce((a, b) => a + b, 0), dd: maxDD(allR), ...monthStats(mv) }; })();
fs.writeFileSync(path.join(__dirname, 'tcore-eth.json'), JSON.stringify({ yearRows, ten, math, cmp, portfolio: { keepers: pk, withZEC: pz, withETH: pe } }, null, 1));

// ================= HTML =================
const f = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d), n = (v, d = 1) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d), pc = (v, d = 0) => (v * 100).toFixed(d) + '%';
const cls = (v) => (v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'flat');
let page = 0; const foot = () => `<div class="foot"><span>Lucid'io · ${TITLE} · ${DATE}</span><span>A test on past prices, not a promise · page ${++page}</span></div>`;
const heat = (v) => { if (v === 0) return '#f8fafc'; const a = Math.min(1, Math.abs(v) / 12); return v > 0 ? `rgba(15,118,110,${0.12 + 0.6 * a})` : `rgba(220,38,38,${0.12 + 0.6 * a})`; };
const ink = (v) => (Math.abs(v) / 12 > 0.6 ? '#fff' : '#0f172a');
const EC = '#0f766e', ZC = '#c2410c';

// equity curve chart (ETH T-CORE cumulative R, monthly)
function curveSvg() {
  let c = 0; const pts = mvAll.map((v) => (c += v)), w = 760, h = 230, l = 44, r = 78, t = 12, b = 26, max = Math.ceil(Math.max(...pts) / 50) * 50, min = Math.min(0, ...pts);
  const X = (i) => l + (i / (pts.length - 1)) * (w - l - r), Y = (v) => t + (1 - (v - min) / (max - min)) * (h - t - b);
  let g = ''; for (let v = 0; v <= max; v += 50) g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e2e8f0"/><text class="ax" x="${l - 6}" y="${Y(v) + 3}" text-anchor="end">${v}R</text>`;
  for (let i = 0; i < pts.length; i += 12) g += `<text class="ax" x="${X(i)}" y="${h - 8}" text-anchor="middle">${2020 + i / 12}</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="ETH on T-CORE, cumulative R by month">${g}<polyline fill="none" stroke="${EC}" stroke-width="2.4" points="${pts.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/><text class="lbl" x="${w - r + 6}" y="${Y(pts[pts.length - 1]) + 4}" fill="${EC}">${f(pts[pts.length - 1], 0)}R</text></svg>`;
}

// page 1: answer
const card = (k, v, sub) => `<div class="cmp"><div class="k">${k}</div><div class="row"><div><span class="v up">${v}</span></div><div style="font-size:10.5px;color:#64748b">${sub}</div></div></div>`;
const c = cmp;
const rankOf = (key, hi) => { const v = COINS.map((x) => c[x][key]).sort((a, b) => (hi ? b - a : a - b)); return v.indexOf(c.ETH[key]) + 1; };
const p1 = `<section class="page">
  <div class="cover-band">
    <div class="tag">Coin review · T-CORE · 4-hour · 2017 → Nov 2026</div>
    <h1>${TITLE}</h1>
    <p class="sub">T-CORE (bb-core entry, 2 ATR stop, 14 ATR trail) started trading ETH live on 12 Nov 2026, in place of ZEC, which is being delisted. This report shows how ETH has done on T-CORE every year and every month, runs it through the trading-math checks, compares it with the five coins T-CORE traded, and gives a verdict. BB-CORE and I-CORE do not trade ETH: on those two bots it ranks last of six coins.</p>
    <div class="vs">
      <div class="team"><div class="nm" style="color:#fdba74">Before</div><div class="bots">SOL · ZEC · NEAR · ADA · GALA</div><div class="split">T-CORE until 12 Nov 2026</div></div>
      <div class="x">→</div>
      <div class="team"><div class="nm" style="color:#5eead4">Now (live)</div><div class="bots">SOL · NEAR · ADA · GALA · ETH</div><div class="split">ZEC only finishes its open trade</div></div>
    </div>
  </div>
  <h2>The answer: ETH is T-CORE's steadiest coin</h2>
  <p>On T-CORE, ETH made money in <b>every calendar year we have data for: 2017 to 2026</b> (7 of 7 on the main 2020–2026 data, 10 of 10 on the 10-year series). On the same 2022–2026 window it has the <b>fewest losing months, the shallowest drawdown and no losing year</b> of the six coins. It is not the biggest earner: ZEC and SOL made more R a month, with far bigger swings. Two honest caveats are on page 4: its profit comes from about 10 big trends, and the drawdown it actually had (${st.dd.toFixed(1)}R) was a lucky order of trades; plan for ${math.mcDD.p50.toFixed(0)}–${math.mcDD.p95.toFixed(0)}R.</p>
  <div class="cmps">
    ${card('Total since Nov 2019', f(st.total, 0) + 'R', `${st.n} trades · ${f(st.exp, 2)}R a trade`)}
    ${card('Years positive (2020–26)', `${yearRows.filter((r) => r.total > 0).length} / ${yearRows.length}`, 'the only coin with no losing year')}
    ${card('Max drawdown', n(-st.dd) + 'R', 'shallowest of the six coins')}
    ${card('Losing months', `${ms.losing} / ${ms.months}`, pc(ms.losing / ms.months) + ' of months (flat months count as flat)')}
    ${card('Profit factor', st.pf.toFixed(2), 'R won ÷ R lost')}
    ${card('Edge certainty (t-stat)', math.tStat.toFixed(2), 'above 2 = unlikely to be luck')}
  </div>
  <h3>ETH on T-CORE, cumulative R by month (Jan 2020 → Oct 2026)</h3>
  ${curveSvg()}
  <p class="sub">R = one unit of risk per trade. T-CORE risks 2.5% of its balance per trade, so 1R ≈ $2.50 on today's ~$100 account. Fees, slippage and funding included. Live sizing check on 12 Nov 2026: a signal would size to 3 ETH contracts, real risk $2.18 for a $2.51 target.</p>
  ${foot()}
</section>`;

// page 2: year by year + 10-year
const yTable = `<table class="score"><tr><th>Year</th><th>Trades</th><th>Win rate</th><th>Profit factor</th><th>R per trade</th><th>Total R</th><th>Max drawdown</th><th>Losing months</th><th>Best month</th><th>Worst month</th><th>Biggest trade</th></tr>
${yearRows.map((r) => `<tr><td>${r.y}${r.y === 2020 ? '*' : ''}${r.y === 2026 ? ' (to 11 Nov)' : ''}</td><td>${r.n}</td><td>${pc(r.win)}</td><td>${r.pf.toFixed(2)}</td><td class="${cls(r.exp)}">${f(r.exp, 2)}</td><td class="${cls(r.total)}"><b>${f(r.total)}</b></td><td>${r.dd.toFixed(1)}</td><td>${r.losingM}/${r.months}</td><td class="pos">${f(r.bestM)}</td><td class="${cls(r.worstM)}">${f(r.worstM)}</td><td>${f(r.best)}</td></tr>`).join('')}
<tr class="tot"><td>All</td><td>${st.n}</td><td>${pc(st.win)}</td><td>${st.pf.toFixed(2)}</td><td class="pos">${f(st.exp, 2)}</td><td class="pos">${f(st.total)}</td><td>${st.dd.toFixed(1)}</td><td>${ms.losing}/${ms.months}</td><td class="pos">${f(ms.best)}</td><td class="neg">${f(ms.worst)}</td><td>${f(st.best)}</td></tr></table>`;
const p2 = `<section class="page">
  <h2>Every year</h2>
  <p class="sub">Trades counted when they close. * 2020 includes the last weeks of 2019 (trading starts 11 Nov 2019). Max drawdown inside the year, trade by trade.</p>
  <div class="wrap">${yTable}</div>
  <h3>Before 2020 (10-year series: Poloniex 2016-17 joined to Binance)</h3>
  <table class="score"><tr><th>Year</th>${['2017', '2018', '2019'].map((y) => `<th>${y}</th>`).join('')}</tr><tr><td>T-CORE on ETH, total R</td>${['2017', '2018', '2019'].map((y) => `<td class="${cls(ten[y] || 0)}">${f(ten[y] || 0)}</td>`).join('')}</tr></table>
  <p class="sub">The 10-year run (Dec 2016 → Nov 2026) has T-CORE positive on ETH in ${Object.values(ten).filter((v) => v > 0).length} of ${Object.keys(ten).length} years. <b>Ignore the size of 2017:</b> ETH went from about $8 to $1,400 that year on thin Poloniex markets, and a 14 ATR trail with a 2 ATR stop turns a 100× trend into hundreds of R. It shows the rules ride a real trend; it is not a return to expect. 2018–2019 are also thin-market years and count for less.</p>
  <div class="note"><b>Reading the years.</b> The pattern is the same every year: about a quarter of the trades win, losers are small (−1R), and a few long trends pay for everything. The weakest year on the 7-year data was 2023 (${f(yearRows.find((r) => r.y === 2023).total)}R), when ETH chopped sideways; it still finished positive. The best years (2021, 2025) each came from one or two big trends.</div>
  ${foot()}
</section>`;

// page 3: monthly grid
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const gridYears = [2019, ...YEARS];
const grid = `<table class="score" style="table-layout:fixed"><tr><th style="width:44px">Year</th>${MN.map((m) => `<th>${m}</th>`).join('')}<th>Year R</th></tr>${gridYears.map((y) => {
  const cells = MN.map((_, i) => { const k = `${y}-${String(i + 1).padStart(2, '0')}`, idx = allKeys.indexOf(k); if (idx < 0 || k > '2026-11') return '<td class="na" style="background:#fff">·</td>'; const v = ethMv[idx]; return `<td style="background:${heat(v)};color:${ink(v)};text-align:center">${v === 0 ? '0' : f(v)}</td>`; }).join('');
  const tot = allKeys.filter((k) => +k.slice(0, 4) === y).reduce((s, k) => s + ethMv[allKeys.indexOf(k)], 0);
  return `<tr><td>${y}</td>${cells}<td class="${cls(tot)}"><b>${f(tot)}</b></td></tr>`; }).join('')}</table>`;
const p3 = `<section class="page">
  <h2>Every month</h2>
  <p class="sub">R closed in each month. Green = profit, red = loss, the darker the bigger (full colour at 12R). 0 = no trade closed that month. Nov 2026 runs to 11 Nov.</p>
  <div class="wrap">${grid}</div>
  <h3>What the months show</h3>
  <ul class="tight">
    <li><b>${ms.losing} of ${ms.months} months lost money</b> (${pc(ms.losing / ms.months)}), ${ms.flat} were flat, the rest made money. The longest run of losing months was <b>${ms.run}</b>.</li>
    <li>The typical (median) month made ${f(ms.median, 2)}R; the average month ${f(ms.perMonth, 2)}R. The gap is the trend system at work: most months are small, a few are large.</li>
    <li>Best month ${f(ms.best)}R, worst month ${f(ms.worst)}R. The worst 12 months in a row: ${f(ms.w12)}R; ${pc(ms.neg12)} of all 12-month periods ended negative.</li>
    <li>The longest time below a previous high was ${ms.under} months.</li>
  </ul>
  ${foot()}
</section>`;

// page 4: trading math
const row = (sec, label, v, note) => `<tr><td>${sec}</td><td style="text-align:left">${label}</td><td><b>${v}</b></td><td style="text-align:left">${note}</td></tr>`;
const p4 = `<section class="page">
  <h2>The trading-math checks</h2>
  <p class="sub">Each line is a measure from the trading-math notes (section number in front). Every T-CORE trade on ETH since Nov 2019; months Jan 2020 → Oct 2026.</p>
  <div class="wrap"><table class="score"><tr><th>§</th><th>Measure</th><th>ETH on T-CORE</th><th style="text-align:left">What it means</th></tr>
  ${row('1.1', 'Sample size', `${math.n} trades, ${ms.months} months`, 'enough for the averages below to mean something (the t-stat confirms it)')}
  ${row('1.2', 'Mean / median R per trade', `${f(math.mean, 2)} / ${f(math.median, 2)}`, 'the typical trade ends about break-even (the trail often exits near the entry); the average is carried by a few big winners')}
  ${row('1.2', 'Win rate, average win / loss', `${pc(math.win)}, ${f(math.avgWin, 2)} / ${n(math.avgLoss, 2)}`, `one win pays for about ${(math.avgWin / math.avgLoss).toFixed(1)} losses`)}
  ${row('1.2', 'Expected value', `${f(math.ev, 2)}R a trade`, 'win% × average win − loss% × average loss')}
  ${row('1.3', 'Std dev of R / skew', `${math.sd.toFixed(2)} / ${f(math.skew, 1)}`, 'results are lumpy with a long right tail, as expected for a 14 ATR trail')}
  ${row('1.3', 'Top 10 trades', `${pc(math.top10)} of all profit`, `without its 10 best trades ETH on T-CORE is ${f(math.withoutTop10)}R: the whole profit comes from catching about 10 big trends in 7 years. Missing one (a skipped signal, a bot outage) costs a lot`)}
  ${row('1.6', 't-stat of the mean', math.tStat.toFixed(2), 'above 2: the edge is unlikely to be luck')}
  ${row('1.1', 'In-sample (to 2022) → out-of-sample (2023 on)', `${f(math.inS.mean, 2)} → ${f(math.outS.mean, 2)} R a trade`, 'weaker after 2023 but clearly positive: no sign the edge has gone')}
  ${row('1.7', 'R a trade when BTC trends up / down', `${f(math.up.mean, 2)} / ${f(math.down.mean, 2)}`, 'works in both market directions')}
  ${row('1.7', 'Longs / shorts', `${f(math.longs.mean, 2)} (${math.longs.n}) / ${f(math.shorts.mean, 2)} (${math.shorts.n})`, 'R a trade (number of trades)')}
  ${row('3.2', 'Lag-1 autocorrelation: trades / months', `${f(math.lag1, 2)} / ${f(math.lagM, 2)}`, 'close to 0: wins do not come in one cluster')}
  ${row('4.2', 'Sharpe / Sortino (monthly, annualised)', `${math.sharpe.toFixed(2)} / ${math.sortino.toFixed(2)}`, 'return per unit of volatility / of downside only')}
  ${row('4.3', 'Max drawdown (trade by trade)', `${math.dd.toFixed(1)}R`, `longest losing streak ${math.streak} trades`)}
  ${row('4.1', 'VaR 95% one month / CVaR', `${math.var95.toFixed(1)}R / ${math.cvar95.toFixed(1)}R`, '1 month in 20 loses more than the VaR; the worst 5% of months lose the CVaR on average')}
  ${row('4.4', 'Monte Carlo max drawdown: median / 95% / 99%', `${math.mcDD.p50.toFixed(1)} / ${math.mcDD.p95.toFixed(1)} / ${math.mcDD.p99.toFixed(1)}R`, `10,000 reshuffles of the same trades: the ${math.dd.toFixed(1)}R that actually happened was a lucky order. With these trades in a typical order the worst drop is about ${math.mcDD.p50.toFixed(0)}R, in a bad case ${math.mcDD.p95.toFixed(0)}R`)}
  ${row('4.4', 'Chance of a losing 12 months / bad-case year', `${pc(math.mcLoseYear, 1)} / ${f(math.mcYear5)}R`, `10,000 years built from random months: more pessimistic than history, where ${pc(math.neg12)} of 12-month periods ended negative`)}
  </table></div>
  ${foot()}
</section>`;

// page 5: comparison with the five coins
const CM = [
  ['Losing months', 'losing', false, (v, m) => `${v}/${m.months}`], ['Longest run of losing months', 'run', false, String], ['12-month periods ending negative', 'neg12', false, (v) => pc(v)],
  ['Worst 12 months (R)', 'w12', true, (v) => f(v)], ['Max drawdown (R)', 'dd', false, (v) => v.toFixed(1)], ['Longest time below a previous high (months)', 'under', false, String],
  ['Years positive', 'yearsPos', true, (v, m) => `${v}/${m.yearsN}`], ['Worst year (R)', 'worstYear', true, (v) => f(v)], ['Win rate', 'win', true, (v) => pc(v)],
  ['Profit factor', 'pf', true, (v) => v.toFixed(2)], ['R per trade', 'exp', true, (v) => f(v, 2)], ['R per month', 'perMonth', true, (v) => f(v, 2)],
  ['Sharpe (monthly, annualised)', 'sharpe', true, (v) => v.toFixed(2)], ['t-stat of the mean', 't', true, (v) => v.toFixed(2)],
  ['R per month, 2025–26', 'recent', true, (v) => f(v, 2)], ['Losing months, 2025–26', 'recentLosing', false, (v) => pc(v)],
];
const cmpTable = `<table class="score"><tr><th>T-CORE, Jan 2022 → Oct 2026</th>${COINS.map((x) => `<th>${x}</th>`).join('')}<th>ETH rank</th></tr>${CM.map(([label, key, hi, fmt]) => {
  const vals = COINS.map((x) => c[x][key]), best = hi ? Math.max(...vals) : Math.min(...vals), rk = rankOf(key, hi);
  return `<tr${''}><td>${label}</td>${COINS.map((x) => `<td${c[x][key] === best ? ' class="best"' : ''}>${fmt(c[x][key], c[x])}</td>`).join('')}<td>${rk}/6</td></tr>`; }).join('')}</table>`;
const firsts = CM.filter(([, key, hi]) => rankOf(key, hi) === 1).length;
const p5 = `<section class="page">
  <h2>ETH against the five coins T-CORE traded</h2>
  <p class="sub">Same 58 months for every coin (Jan 2022 → Oct 2026; GALA's data starts Sep 2021). Underlined = best in the row. A month with no closed trade counts as flat.</p>
  <div class="wrap">${cmpTable}</div>
  <div class="note good"><b>ETH is first on ${firsts} of ${CM.length} measures</b> and the only coin with no losing year (the Monte Carlo caveat on page 4 applies to every coin's drawdown, not just ETH's). It wins every measure of steadiness (losing months, losing runs, bad 12-month periods, drawdown, time below a high, worst year) and is mid-table on raw profit: ZEC and SOL made more R a month, with drawdowns 2–3 times deeper. Starting in 2020 or 2021 instead (fewer coins have complete data) gives the same picture: ETH first on 10 of 15 measures.</div>
  ${foot()}
</section>`;

// page 6: portfolio + verdict
const prow = (label, a, b, d, fmt, hi) => { const best = hi ? Math.max(a, b, d) : Math.min(a, b, d); return `<tr><td>${label}</td>${[a, b, d].map((v) => `<td${v === best ? ' class="best"' : ''}>${fmt(v)}</td>`).join('')}</tr>`; };
const p6 = `<section class="page">
  <h2>T-CORE as a whole: with ZEC vs with ETH</h2>
  <p class="sub">T-CORE on SOL + NEAR + ADA + GALA plus the fifth coin, Oct 2021 → Oct 2026 (61 months, when every coin trades). R, trade by trade for drawdown, by month for the rest.</p>
  <div class="wrap"><table class="score"><tr><th>T-CORE</th><th>4 coins only</th><th>+ ZEC (before)</th><th>+ ETH (now)</th></tr>
  ${prow('Total R', pk.total, pz.total, pe.total, (v) => f(v, 0), true)}
  ${prow('Max drawdown (R)', pk.dd, pz.dd, pe.dd, (v) => v.toFixed(1), false)}
  ${prow('Return ÷ drawdown', pk.total / pk.dd, pz.total / pz.dd, pe.total / pe.dd, (v) => v.toFixed(1), true)}
  ${prow('Losing months', pk.losing / pk.months, pz.losing / pz.months, pe.losing / pe.months, (v) => pc(v), false)}
  ${prow('Worst 12 months (R)', pk.w12, pz.w12, pe.w12, (v) => f(v), true)}
  ${prow('Sharpe (monthly, annualised)', pk.sharpe, pz.sharpe, pe.sharpe, (v) => v.toFixed(2), true)}
  ${prow('Worst month (R)', pk.worst, pz.worst, pe.worst, (v) => f(v), true)}
  </table></div>
  <p>With ZEC, T-CORE made more (${f(pz.total, 0)}R vs ${f(pe.total, 0)}R) and had the better return ÷ drawdown (${(pz.total / pz.dd).toFixed(1)} vs ${(pe.total / pe.dd).toFixed(1)}): most of that came from ZEC's 2025 rally, and ZEC carried ${pc(pz.share5)} of T-CORE's risk on its own. ETH carries ${pc(pe.share5)}, its results move with the other four coins at a correlation of ${pe.corr5.toFixed(2)} (ZEC ${pz.corr5.toFixed(2)}), and T-CORE with ETH has the best Sharpe of the three set-ups. ZEC is leaving either way: against the four coins alone, adding ETH adds ${f(pe.total - pk.total, 0)}R for ${(pe.dd - pk.dd).toFixed(1)}R more drawdown.</p>
  <h2>Verdict</h2>
  <div class="note good"><b>ETH on T-CORE: a good long-term fit, and the right replacement for ZEC.</b> It has been positive every year we have data for, has the shallowest drawdown and the fewest losing months of the six coins, works whether BTC is rising or falling, and its edge is statistically solid (t-stat ${math.tStat.toFixed(2)}). It will not repeat ZEC's 2025 windfall: expect T-CORE to earn somewhat less than it did with ZEC, with smaller swings.</div>
  <h3>What to watch</h3>
  <ul class="tight">
    <li><b>Long losing runs are normal:</b> about ${pc(math.win)} of trades win; up to ${math.streak} losers in a row happened. Judge ETH on months and years, not on single trades.</li>
    <li><b>Drawdown to expect:</b> plan for about ${math.mcDD.p50.toFixed(0)}R, ${math.mcDD.p95.toFixed(0)}R in a bad case (1 in 20). The ${math.dd.toFixed(1)}R in the backtest was a lucky order of trades. A drop past ~${Math.ceil(math.mcDD.p99)}R would be outside the tested range and worth a review.</li>
    <li><b>Everything rides on the big trends:</b> without its 10 best trades ETH on T-CORE is about ${f(math.withoutTop10, 0)}R. The bot must stay up and take every signal.</li>
    <li><b>Contract size:</b> 1 MEXC contract = 0.01 ETH (≈ $20). At today's ~$100 balance a normal stop sizes to 2–3 contracts, so the real risk can be up to ~15% under target. A stop wider than about 12% skips the trade rather than oversizing it.</li>
    <li><b>Not on BB-CORE or I-CORE:</b> ETH ranks last of six coins on both (deep drawdowns, 3–4 years below a high). Keep it on T-CORE only.</li>
  </ul>
  <div class="note">In-sample backtest on Binance spot prices with real fees and funding (MEXC charges ETH a lower 0.02% taker fee than the 0.05% modelled). Scripts: StrategyBacktester/research/zec-replacement (tcore-eth-report.js, eth-vs-coins.js, parity.js).</div>
  ${foot()}
</section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="robots" content="noindex, nofollow, noarchive">
<title>${TITLE} · Lucid'io</title>
<style>${CSS}</style></head><body>
${p1}
${p2}
${p3}
${p4}
${p5}
${p6}
</body></html>`;
fs.writeFileSync(path.join(LEDGER, 'tcore-eth.html'), html);
const idxPath = path.join(LEDGER, 'index.json'), idx = JSON.parse(fs.readFileSync(idxPath, 'utf8')).filter((r) => r.slug !== 'tcore-eth');
idx.unshift({ slug: 'tcore-eth', title: 'ETH on T-CORE', kind: 'Data report', updated: DATE, file: '/reports/tcore-eth.html',
  summary: `T-CORE started trading ETH live on 12 Nov 2026 in place of ZEC (being delisted). Every year and month of ETH on T-CORE since 2019, the trading-math checks and a comparison with SOL, ZEC, NEAR, ADA and GALA. ETH made ${f(st.total, 0)}R in ${st.n} trades (${f(st.exp, 2)}R a trade, profit factor ${st.pf.toFixed(2)}), was positive every year 2020–2026 and lost money in ${ms.losing} of ${ms.months} months. On the same 2022–2026 window it is T-CORE's steadiest coin (first on ${firsts} of ${CM.length} measures, shallowest drawdown, no losing year) but not its biggest earner. BB-CORE and I-CORE do not trade ETH. A test on past prices, not a promise.` });
fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2) + '\n');
console.log('wrote', path.join(LEDGER, 'tcore-eth.html'), (html.length / 1024).toFixed(0) + ' KB · ETH first on', firsts, 'of', CM.length, '· years', yearRows.map((r) => r.y + ' ' + r.total.toFixed(1)).join(' | '), '· 10y', JSON.stringify(ten));
