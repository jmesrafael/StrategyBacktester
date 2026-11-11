// build-ledger-report.js — writes the ZEC replacement study as a ledger report (A4 pages, same look as the other ledger reports)
// from results.json, deep.json, results10.json, results100.json, math.json, trades.json.
//   node build-ledger-report.js  -> ../../../🔴LEDGER/reports/zec-replacement.html and an entry in ../../../🔴LEDGER/reports/index.json
'use strict';
const fs = require('fs'), path = require('path');
const LEDGER = path.join(__dirname, '..', '..', '..', '🔴LEDGER', 'reports');
const J = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const R7 = J('results.json'), D = J('deep.json'), R10 = J('results10.json'), R100 = J('results100.json'), M = J('math.json'), T = J('trades.json');
const CSS = fs.readFileSync(path.join(LEDGER, 'live-pair-vs-three-bot.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1]; // shared look of the ledger reports
const DATE = 'Nov 11, 2026', TITLE = 'Replacing ZEC';
const ZC = '#c2410c', EC = '#0f766e', GREY = '#94a3b8';

const f = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
const n = (v, d = 1) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const pc = (v, d = 0) => (v * 100).toFixed(d) + '%';
const cls = (v) => (v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'flat');
const td = (v, d = 1, best) => `<td class="${best ? 'best ' : ''}${cls(v)}">${f(v, d)}</td>`;
let page = 0;
const foot = () => `<div class="foot"><span>Lucid'io · ${TITLE} · ${DATE}</span><span>A test on past prices, not a promise · page ${++page}</span></div>`;

// ---- chart: cumulative TRI-CORE R of SOL+NEAR+ADA+GALA + ZEC vs + ETH, by month, Oct 2021 on
function chart() {
  const W = { 'BB-CORE': 0.5, 'I-CORE': 0.25, 'T-CORE': 0.25 }, P0 = Date.UTC(2021, 9, 18) / 1000, KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'];
  const series = (fifth) => { const m = {}; for (const c of [...KEEP, fifth]) for (const [b, w] of Object.entries(W)) for (const t of T[c][b]) if (t[1] > P0) { const k = new Date(t[1] * 1000).toISOString().slice(0, 7); m[k] = (m[k] || 0) + t[2] * w; } return m; };
  const a = series('ZEC'), b = series('ETH'), keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  let ca = 0, cb = 0; const pa = [], pb = []; for (const k of keys) { ca += a[k] || 0; cb += b[k] || 0; pa.push(ca); pb.push(cb); }
  const w = 760, h = 290, l = 46, r = 96, t = 14, bt = 30, max = Math.ceil(Math.max(...pa, ...pb) / 100) * 100, min = Math.min(0, ...pa, ...pb);
  const X = (i) => l + (i / (keys.length - 1)) * (w - l - r), Y = (v) => t + (1 - (v - min) / (max - min)) * (h - t - bt);
  const line = (p, c) => `<polyline fill="none" stroke="${c}" stroke-width="2.4" points="${p.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/>`;
  let g = ''; for (let v = 0; v <= max; v += 100) g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e2e8f0"/><text class="ax" x="${l - 6}" y="${Y(v) + 3}" text-anchor="end">${v}R</text>`;
  keys.forEach((k, i) => { if (k.endsWith('-01')) g += `<text class="ax" x="${X(i)}" y="${h - 10}" text-anchor="middle">${k.slice(0, 4)}</text><line x1="${X(i)}" x2="${X(i)}" y1="${h - bt}" y2="${h - bt + 4}" stroke="#94a3b8"/>`; });
  const end = (p, c, lab) => `<text class="lbl" x="${w - r + 6}" y="${Y(p[p.length - 1]) + 4}" fill="${c}">${lab} ${f(p[p.length - 1], 0)}R</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Cumulative R of the five-coin portfolio with ZEC and with ETH">${g}${line(pa, ZC)}${line(pb, EC)}${end(pa, ZC, '+ZEC')}${end(pb, EC, '+ETH')}</svg>`;
}

// ---- page 1: answer
const pz = M.portfolio.ZEC, pe = M.portfolio.ETH, mz = M.coins.ZEC, me = M.coins.ETH;
const card = (k, a, b, better) => `<div class="cmp"><div class="k">${k}</div><div class="row"><div><span class="dot" style="background:${ZC}"></span><span class="v">${a}</span></div><div><span class="dot" style="background:${EC}"></span><span class="v${better ? ' up' : ''}">${b}</span></div></div></div>`;
const p1 = `<section class="page">
  <div class="cover-band">
    <div class="tag">Coin review · TRI-CORE bots · up to 10 years · 4-hour</div>
    <h1>${TITLE}</h1>
    <p class="sub">ZEC is being delisted. Which coin should the three bots (BB-CORE, I-CORE, T-CORE) trade instead, next to SOL, NEAR, ADA and GALA? Tested on 7 years (45 coins), 10 years (all coins with data from 2016) and the top 100 by market cap, with the bots' exact rules and real costs, then judged with the trading-math checks.</p>
    <div class="vs">
      <div class="team"><div class="nm" style="color:#fdba74">Leaving</div><div class="bots">SOL · NEAR · ADA · GALA · ZEC</div><div class="split">the coins traded today</div></div>
      <div class="x">→</div>
      <div class="team"><div class="nm" style="color:#5eead4">Recommended</div><div class="bots">SOL · NEAR · ADA · GALA · ETH</div><div class="split">ETH takes ZEC's place</div></div>
    </div>
  </div>
  <h2>The answer: ETH</h2>
  <p><b>ETH is the best replacement.</b> No coin in the top 100 improves the five-coin portfolio more. It passes every test, it has 10 years of history, the deepest MEXC market ($1.5B a day) and the lowest MEXC fee. <b>Nothing fully replaces ZEC:</b> ZEC's lead comes from one year (2025, +100R). With ETH the portfolio earns about 14% less but is smoother and its risk is spread over all five coins instead of sitting on one.</p>
  <div class="legend"><span><span class="sw" style="background:${ZC}"></span>With ZEC (today)</span><span><span class="sw" style="background:${EC}"></span>With ETH</span><span>Oct 2021 → Nov 2026, the window where all five coins have data</span></div>
  <div class="cmps">
    ${card('Total profit (R)', f(pz.total, 0) + 'R', f(pe.total, 0) + 'R', false)}
    ${card('Sharpe (return ÷ volatility)', pz.sharpe.toFixed(2), pe.sharpe.toFixed(2), true)}
    ${card('Worst drop (R)', n(-pz.mdd), n(-pe.mdd), false)}
    ${card('5th coin\'s share of all risk', pc(pz.riskShare[4]), pc(pe.riskShare[4]), true)}
    ${card('Typical (median) month', f(pz.mMedian, 1) + 'R', f(pe.mMedian, 1) + 'R', true)}
    ${card('Edge certainty (t-stat, > 2 = not luck)', mz.tStat.toFixed(2), me.tStat.toFixed(2), true)}
  </div>
  <h3>Five-coin portfolio, cumulative R</h3>
  ${chart()}
  <p class="sub">R = one unit of risk per trade (the bots risk 2.5% of the balance per trade, so 1R ≈ 2.5% at today's size). TRI-CORE weighting 50/25/25. Real fees, slippage and funding included.</p>
  ${foot()}
</section>`;

// ---- page 2: method + 7-year screen
const c7 = (c) => R7.coins[c], d7 = (c) => D.coins[c];
const show7 = ['ZEC', 'ETH', 'ONE', 'DOGE', 'BTC', 'XRP', 'BNB', 'LINK'];
const rows7 = show7.map((c) => { const r = c7(c), d = d7(c); const hl = c === 'ETH' ? ' class="hl-sug"' : c === 'ZEC' ? ' class="hl-live"' : '';
  return `<tr${hl}><td>${c}${c === 'ZEC' ? ' (leaving)' : ''}</td>${td(r.bots['BB-CORE'].avgR, 2)}${td(r.bots['I-CORE'].avgR, 2)}${td(r.bots['T-CORE'].avgR, 2)}${td(r.tri.total, 0)}<td>${r.tri.dd.toFixed(1)}</td><td>${r.tri.yrsPos}/${r.tri.yrsN}</td>${td(d.exBestPerYear)}<td>${d.corrKeepers.toFixed(2)}</td><td${c === 'ETH' ? ' class="best"' : ''}>${d.port.rdd.toFixed(1)}</td></tr>`; }).join('');
const p2 = `<section class="page">
  <h2>How it was tested</h2>
  <p class="sub">The same three bots that run on the VPS, unchanged, on every candidate coin.</p>
  <div class="card"><ul class="tight">
    <li><b>The engine is the bots' own code.</b> The research engine was run against the bots' core files (the same files the VPS runs, checked byte for byte) on ZEC, ETH, BTC, DOGE, XRP and SOL: <b>16 of 18 bot/coin pairs identical trade for trade</b>; the other 3 trades out of ~6,000 differ only where the price equals the Bollinger middle to the last decimal.</li>
    <li><b>Rules:</b> BB-CORE (Bollinger 20,2 close-through + SMA200, stop at the middle band, 48-candle exit), I-CORE (Ichimoku cloud break + SMA200, 2 ATR stop, 7 ATR trail), T-CORE (BB-CORE entry, 2 ATR stop, 14 ATR trail). TRI-CORE = 50/25/25.</li>
    <li><b>Costs:</b> 0.05% fee per side, 0.02% slippage per fill, real Binance funding. Every coin also re-run at double and triple costs.</li>
    <li><b>Data:</b> Binance spot 4h candles (futures only start in 2019-20); Poloniex for 2016-2019; Binance or MEXC futures for coins without a spot market.</li>
    <li><b>Gates fixed before seeing results:</b> 7 full years, all three bots positive, ≥ 6 of 7 years positive, positive before and after 2023, ≥ 4 of 5 market regimes positive, positive at double costs, enough MEXC volume.</li>
  </ul></div>
  <h3>7-year screen: 45 coins with data from Nov 2019, 7 contenders passed</h3>
  <div class="wrap"><table class="score"><tr><th>Coin</th><th>BB-CORE avg R</th><th>I-CORE avg R</th><th>T-CORE avg R</th><th>Total R</th><th>Worst drop</th><th>Years +</th><th>R/yr without best year</th><th>Correlation with the 4 coins</th><th>Portfolio return ÷ drop</th></tr>${rows7}</table></div>
  <div class="note">Portfolio = SOL + NEAR + ADA + GALA + the coin, Oct 2021 → Nov 2026. Four coins alone: ${f(D.portfolio.keepersOnly.total, 0)}R, return ÷ drop ${D.portfolio.keepersOnly.rdd.toFixed(1)}. ETH is the only contender that adds profit without deepening the worst drop.</div>
  <h3>Does a high backtest rank predict the future?</h3>
  <p>Barely. Ranking the 39 seven-year coins on 2019–2022 and checking 2023–2026 gives a rank correlation of only <b>0.17</b>; ZEC itself was 16th before 2023 and 1st after. So the choice rests on robustness (consistency, drawdown, diversification, liquidity), not on the biggest total.</p>
  <p>Excluded: VET (strong but under $0.5M a day on MEXC), XLM (5 of 7 years), ONE (best recent numbers but price $0.0016, thin market, a 2022 bridge hack: itself a delisting risk).</p>
  ${foot()}
</section>`;

// ---- page 3: 10 years
const show10 = ['BTC', 'ETH', 'XLM', 'ZEC', 'XRP', 'ETC', 'LTC', 'DASH', 'XMR', 'GALA', 'ADA', 'SOL', 'NEAR'];
const YRS = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const rows10 = show10.map((c) => { const r = R10.coins[c]; const hl = c === 'ETH' ? ' class="hl-sug"' : c === 'ZEC' ? ' class="hl-live"' : '';
  return `<tr${hl}><td>${c}${r.current && c !== 'ZEC' ? ' *' : ''}</td><td>${r.span.toFixed(1)}</td>${td(r.tri.total, 0)}${td(r.tri.perYear)}<td>${r.tri.dd.toFixed(1)}</td><td${c === 'BTC' ? ' class="best"' : ''}>${r.tri.rdd.toFixed(1)}</td><td>${r.tri.yrsPos}/${r.tri.yrsN}</td>${YRS.map((y) => (r.tri.years[y] == null ? '<td class="na">·</td>' : `<td class="${cls(r.tri.years[y])}">${f(r.tri.years[y], 0)}</td>`)).join('')}</tr>`; }).join('');
const p3 = `<section class="page">
  <h2>10 years: Dec 2016 → Nov 2026</h2>
  <p class="sub">Only 9 coins have data back to 2016 on any free source. * = coins the bots keep, shown with all the history that exists (SOL, NEAR and GALA started trading in 2020–21, ADA in 2018). Poloniex 2016–2019 joined to Binance; the two sources agree within 0.2–0.5% where they overlap.</p>
  <div class="wrap"><table class="score"><tr><th>Coin</th><th>Years</th><th>Total R</th><th>R a year</th><th>Worst drop</th><th>Return ÷ drop</th><th>Years +</th>${YRS.map((y) => `<th>${y}</th>`).join('')}</tr>${rows10}</table></div>
  <h3>What 10 years add</h3>
  <ul class="tight">
    <li><b>BTC is the best coin on its own:</b> smallest drop, best return ÷ drop, and positive in all 7 market phases (2017 bubble, 2018 bear, 2019, 2020-21 bull, 2022 bear, 2023-24, 2025-26).</li>
    <li><b>ETH has the biggest total</b> and is the only coin where T-CORE made money all 10 years; but half its total is 2017, when markets were thin, so that year counts for less.</li>
    <li><b>As ZEC's replacement, ETH still beats BTC:</b> portfolio return ÷ drop 19.8 vs 17.4, because ETH's bot results move more independently of the other four coins (correlation 0.26 vs 0.42). Taking both (6 coins) scores 19.4: no better than ETH alone.</li>
    <li><b>No coin is positive every year.</b> Only ADA (9 of 9) is, and the bots already trade it.</li>
  </ul>
  ${foot()}
</section>`;

// ---- page 4: top 100
const pass100 = Object.values(R100.coins).filter((r) => r.passed && !['SOL', 'NEAR', 'ADA', 'GALA', 'ZEC'].includes(r.coin)).sort((a, b) => b.swap.dRdd - a.swap.dRdd);
const rows100 = pass100.map((r) => `<tr${r.coin === 'ETH' ? ' class="hl-sug"' : ''}><td>${r.coin} <span class="flat">#${r.rank}</span></td><td>${r.span.toFixed(1)}</td>${td(r.tri.perYear)}<td>${r.tri.dd.toFixed(1)}</td><td>${pc(r.tri.roll12)}</td><td>$${(r.mexcUsd / 1e6).toFixed(r.mexcUsd >= 1e8 ? 0 : 1)}M</td><td>${r.swap.from.slice(0, 7)}</td><td>${r.swap.withCoin.rdd.toFixed(1)}</td><td>${r.swap.withETH.rdd.toFixed(1)}</td>${td(r.swap.dRdd, 1)}</tr>`).join('');
const p4 = `<section class="page">
  <h2>Top 100 by market cap: does anything beat ETH?</h2>
  <p class="sub">CoinGecko top 100 (stablecoins, wrapped and staked copies and tokenized funds removed). 78 trade on MEXC futures and were tested on all their history. Gates: ≥ 2 years, all three bots positive, both halves positive, ≥ 75% of 12-month windows positive, positive at double costs, ≥ $5M a day on MEXC. Then each coin takes ETH's place in the portfolio over the <b>same period</b>.</p>
  <div class="wrap"><table class="score"><tr><th>Coin (rank)</th><th>Years</th><th>R a year</th><th>Worst drop</th><th>12-month windows +</th><th>MEXC a day</th><th>Swap test from</th><th>Portfolio score with coin</th><th>with ETH</th><th>Difference</th></tr>${rows100}</table></div>
  <div class="note good"><b>No coin beats ETH.</b> ARB and ENA only tie it, on 2.5–3.5 years of data against ETH's 10. XRP and DOGE make good money alone but deepen the portfolio's worst drop (to 26.9R and 29.0R, vs 21.4R with ETH).</div>
  <ul class="tight">
    <li><b>Good numbers, too thin on MEXC:</b> VET, SHIB, STX, SEI, FET, RAY, ALGO, STRK, CAKE.</li>
    <li><b>Too new (under 2 years):</b> HYPE (1.4 years, I-CORE loses), PI, PENGU, VVV, AERO, KITE, NIGHT, M.</li>
    <li><b>At least one bot loses:</b> AAVE, TAO, BCH, XMR, APT, JUP, ATOM, ONDO, TIA, WLD, ASTER, WLFI, VIRTUAL, STABLE and most 2025–26 listings.</li>
  </ul>
  ${foot()}
</section>`;

// ---- page 5-6: trading math
const mrow = (label, a, b, fa, better) => `<tr><td>${label}</td><td${better === 'a' ? ' class="best"' : ''}>${fa(a)}</td><td${better === 'b' ? ' class="best"' : ''}>${fa(b)}</td></tr>`;
const fx = (d) => (v) => f(v, d), nx = (d) => (v) => n(v, d), px = (v) => pc(v, 1);
const coinRows = [
  ['1.1 Sample size (trades)', mz.n, me.n, (v) => String(v), ''],
  ['1.2 Mean R per trade', mz.mean, me.mean, fx(2), 'a'], ['1.2 Median R per trade', mz.median, me.median, fx(2), ''],
  ['Win rate', mz.win, me.win, px, ''], ['Average win / average loss (R)', [mz.avgWin, mz.avgLoss], [me.avgWin, me.avgLoss], (v) => f(v[0], 2) + ' / ' + n(v[1], 2), ''],
  ['Expected value (win% × win − loss% × loss)', mz.ev, me.ev, fx(2), 'a'],
  ['1.3 Standard deviation of R', mz.sd, me.sd, nx(2), 'b'], ['Skew (right tail)', mz.skew, me.skew, nx(1), ''],
  ['Top 1% of trades = share of all profit', mz.top1pct, me.top1pct, (v) => pc(v), 'b'],
  ['1.6 t-stat of the mean (> 2 = unlikely luck)', mz.tStat, me.tStat, nx(2), 'b'],
  ['t-stat BB-CORE / I-CORE / T-CORE', [mz.per['BB-CORE'].t, mz.per['I-CORE'].t, mz.per['T-CORE'].t], [me.per['BB-CORE'].t, me.per['I-CORE'].t, me.per['T-CORE'].t], (v) => v.map((x) => x.toFixed(2)).join(' / '), ''],
  ['1.1 In-sample (to 2022) → out-of-sample (2023 on) mean R', [mz.inSample.mean, mz.outSample.mean], [me.inSample.mean, me.outSample.mean], (v) => f(v[0], 2) + ' → ' + f(v[1], 2), ''],
  ['1.7 Mean R when BTC trends up / down', [mz.btcUp.mean, mz.btcDown.mean], [me.btcUp.mean, me.btcDown.mean], (v) => f(v[0], 2) + ' / ' + f(v[1], 2), 'b'],
  ['3.2 Lag-1 autocorrelation of trade R', mz.lag1, me.lag1, fx(2), 'b'],
];
const portRows = [
  ['Total R / R per year', [pz.total, pz.perYear], [pe.total, pe.perYear], (v) => f(v[0], 0) + ' / ' + f(v[1], 1), 'a'],
  ['Median month / std dev of a month', [pz.mMedian, pz.mSd], [pe.mMedian, pe.mSd], (v) => f(v[0], 2) + ' / ' + v[1].toFixed(1), 'b'],
  ['4.2 Sharpe (annualised)', pz.sharpe, pe.sharpe, nx(2), 'b'], ['Sortino (downside only)', pz.sortino, pe.sortino, nx(1), 'a'],
  ['4.3 Max drawdown (R)', pz.mdd, pe.mdd, nx(1), 'a'], ['Positive months / worst month', [pz.posMonths, pz.worstMonth], [pe.posMonths, pe.worstMonth], (v) => pc(v[0]) + ' / ' + f(v[1], 1), 'a'],
  ['4.1 VaR 95%, one month (historical / normal formula)', [pz.var95, pz.var95param], [pe.var95, pe.var95param], (v) => v[0].toFixed(1) + ' / ' + v[1].toFixed(1), ''],
  ['CVaR: average of the worst 5% of months', pz.cvar95, pe.cvar95, nx(1), 'a'],
  ['1.4 5th coin\'s correlation with the other four', pz.corrFifth, pe.corrFifth, fx(2), 'a'],
  ['2.3 5th coin\'s share of portfolio risk (wᵀΣw)', pz.riskShare[4], pe.riskShare[4], (v) => pc(v), 'b'],
  ['2.5 PCA: effective number of independent bets (of 5)', pz.effBets, pe.effBets, nx(2), 'a'],
  ['4.4 Monte Carlo max drawdown: median / 95% / 99%', [pz.mcDD.median, pz.mcDD.p95, pz.mcDD.p99], [pe.mcDD.median, pe.mcDD.p95, pe.mcDD.p99], (v) => v.map((x) => x.toFixed(1)).join(' / '), ''],
  ['4.4 Chance of a losing 12 months / bad-case year (5%)', [pz.mcLosingYear, pz.mcYear5], [pe.mcLosingYear, pe.mcYear5], (v) => pc(v[0], 1) + ' / ' + f(v[1], 1) + 'R', ''],
];
const share = (p) => p.set.map((c, i) => `<span><span class="sw" style="background:${c === 'ZEC' ? ZC : c === 'ETH' ? EC : GREY}"></span>${c} ${pc(p.riskShare[i])}</span>`).join('');
const p5 = `<section class="page">
  <h2>The trading-math checks: ZEC vs ETH</h2>
  <p class="sub">Each line is a measure from the trading-math notes (section number in front). All three bots, every trade since Nov 2019. Underlined = better.</p>
  <div class="wrap"><table class="score"><tr><th>Per coin</th><th>ZEC</th><th>ETH</th></tr>${coinRows.map((r) => mrow(...r)).join('')}</table></div>
  <div class="note"><b>Reading.</b> For both coins the typical trade is a full loss (median −1R): these are trend systems that live on a few big winners. ZEC's average is higher, but <b>81% of its profit comes from 1% of its trades</b> (6 trades), its results swing 2.7× as much, and its edge is the less certain one (t-stat 2.25 against 3.80; on its own, ZEC's I-CORE and T-CORE edges are not significant). ZEC made its money when BTC was falling (+2.02R a trade, +0.03R when BTC was rising); ETH earns in both. ZEC's wins come in one cluster (autocorrelation 0.41), which is the 2025 rally.</div>
  ${foot()}
</section>
<section class="page">
  <h2>The trading-math checks: the five-coin portfolio</h2>
  <p class="sub">SOL + NEAR + ADA + GALA + the 5th coin, monthly TRI-CORE R, Oct 2021 → Nov 2026 (62 months). Monte Carlo: 10,000 reshuffles of the trade order, and 10,000 resampled years.</p>
  <div class="wrap"><table class="score"><tr><th>Portfolio</th><th>+ ZEC</th><th>+ ETH</th></tr>${portRows.map((r) => mrow(...r)).join('')}</table></div>
  <h3>Who carries the risk (2.3, wᵀΣw)</h3>
  <div class="legend"><b style="width:52px">+ ZEC</b>${share(pz)}</div>
  <div class="legend"><b style="width:52px">+ ETH</b>${share(pe)}</div>
  <div class="note good"><b>Verdict.</b> With ZEC the portfolio made more (+490R vs +423R) and had gentler bad months, but <b>more than half of all its risk sat on one coin</b>, whose profit came from a handful of trades in one rally. With ETH it makes about 14% less, is smoother (Sharpe 2.03 vs 1.69, a better typical month, lower volatility) and every coin carries a fair share of the risk. Worst drop, Monte Carlo drawdowns and the chance of a losing year are the same. ZEC is leaving anyway: <b>ETH is the replacement that keeps the portfolio's risk healthy.</b></div>
  ${foot()}
</section>`;

// ---- page 7: risks and next steps
const p7 = `<section class="page">
  <h2>ETH's weaknesses, and what to do next</h2>
  <h3>Weaknesses</h3>
  <ul class="tight">
    <li>BB-CORE alone is weak on ETH since 2023 (+0.18R a trade); most of ETH's recent edge comes from T-CORE.</li>
    <li>ETH lost in 2023 (−8R) and in the 2023-24 phase; ZEC lost there too (−15R).</li>
    <li>ETH falls together with BTC in crashes; its bot results still correlate only 0.18–0.26 with the other four coins.</li>
    <li><b>Contract size:</b> one MEXC ETH contract is 0.01 ETH (about $20.50), twice ZEC's ($9.74). On T-CORE's ~$40 account a wide stop can need less than one contract: check how the bot rounds before switching.</li>
  </ul>
  <h3>Backups</h3>
  <ul class="tight">
    <li><b>BTC</b>: the best 10-year coin on its own; second choice.</li>
    <li><b>ARB, ENA</b>: tie ETH on short histories; watch, do not trade yet.</li>
  </ul>
  <h3>What the data does not prove</h3>
  <ul class="tight">
    <li>Spot prices, not MEXC futures prices; funding is zero before each coin had a futures market. 2016–2019 markets were thin, so those years count for less.</li>
    <li>Choosing the best of many coins flatters the winner: past rank predicted future rank only weakly (0.17).</li>
    <li>MEXC volume is a one-day snapshot (Nov 11, 2026). Results are in R; dollars depend on each bot's size and on contract rounding.</li>
  </ul>
  <div class="note">Scripts and full tables: StrategyBacktester/research/zec-replacement (REPORT.md, parity.js, screen.js, deep.js, walkforward.js, fut.js, run10.js, screen100.js, math.js).</div>
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
${p7}
</body></html>`;
fs.writeFileSync(path.join(LEDGER, 'zec-replacement.html'), html);

const idxPath = path.join(LEDGER, 'index.json'), idx = JSON.parse(fs.readFileSync(idxPath, 'utf8')).filter((r) => r.slug !== 'zec-replacement');
idx.unshift({ slug: 'zec-replacement', title: 'Replacing ZEC: ETH', kind: 'Data report', updated: DATE, file: '/reports/zec-replacement.html',
  summary: `ZEC is being delisted. The three bots (BB-CORE, I-CORE, T-CORE), with their exact live rules and real costs, were tested on 45 coins over 7 years, 9 coins over 10 years and the top 100 by market cap. ETH is the best replacement next to SOL, NEAR, ADA and GALA: no coin improves the portfolio more. Nothing fully replaces ZEC (one year, 2025, made +100R): with ETH the portfolio earns about 14% less (+423R vs +490R since Oct 2021) but is smoother (Sharpe 2.03 vs 1.69) and its risk is spread (the 5th coin carries 13% of the risk instead of ZEC's 56%). Backup: BTC. Check ETH's larger MEXC contract size first. A test on past prices, not a promise.` });
fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2) + '\n');
console.log('wrote', path.join(LEDGER, 'zec-replacement.html'), (html.length / 1024).toFixed(0) + ' KB;', 'index.json:', idx.length, 'reports');
