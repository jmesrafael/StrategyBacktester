// build-ledger-report.js — writes LEDGER/reports/ichimoku-vs-current-bot.html (+ index.json entry) from the live backtest numbers.
// Same page style as merged-strategies-sol.html (CSS is copied from it). The current bot's rules stay confidential: it is only ever "Lucid'io (current bot)".
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const bb = require('../bb-core-v2/v2-core.js');
const { loadCoin } = require('../bb-core-v2/load.js');
const REP = path.join(__dirname, '..', '..', 'LEDGER', 'reports');
const C = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], Y = [2020, 2021, 2022, 2023, 2024, 2025, 2026], MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], S = 1000, RP = 0.025;
const g = {}; const get = (c) => g[c] || (g[c] = (() => { const B = E.load(c); return { B, X: E.base(B) }; })());
const ICH = { full: false }, EX = { kInit: 2, kTrail: 7, trend: true, exitOpp: false };
const BB = C.flatMap((c) => { const d = loadCoin(c); return bb.backtest(d.B, {}, d.funding).trades.map((t) => ({ ...t, coin: c })); });
const IC = C.flatMap((c) => E.run(get(c).B, get(c).X, 'ichimoku', ICH, { coin: c, ...EX }));
const KEY = { bb: BB, ic: IC };

const sum = (T) => T.reduce((a, t) => a + t.R, 0), yrOf = (t) => new Date(t.tExit * 1000).getUTCFullYear();
const sg = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'mut');
const R = (v, d = 1) => `<span class="${cls(v)}">${sg(v, d)}</span>`;
const P = (v) => `<span class="${cls(v)}">${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%</span>`;
const streak = (T, win) => { let m = 0, s = 0; for (const t of [...T].sort((a, b) => a.tExit - b.tExit)) { s = (win ? t.R > 0 : t.R <= 0) ? s + 1 : 0; m = Math.max(m, s); } return m; };

function account(T) {
  const tr = [...T].sort((a, b) => a.t - b.t), d = [];
  for (const x of tr) { const eq = S + d.filter((o) => o.te <= x.t).reduce((a, o) => a + o.p, 0); d.push({ te: x.tExit, p: x.R * RP * eq }); }
  d.sort((a, b) => a.te - b.te); const mEnd = {}; let eq = S, pk = S, dd = 0;
  for (const o of d) { eq += o.p; pk = Math.max(pk, eq); dd = Math.max(dd, (pk - eq) / pk); const dt = new Date(o.te * 1000); mEnd[dt.getUTCFullYear() * 12 + dt.getUTCMonth()] = eq; }
  const mret = {}; let prev = S; for (let k = 2020 * 12; k <= 2026 * 12 + 9; k++) { if (mEnd[k] !== undefined) { mret[k] = mEnd[k] / prev - 1; prev = mEnd[k]; } else mret[k] = 0; }
  const yret = {}; for (const y of Y) { let p = 1; for (let m = 0; m < 12; m++) if (mret[y * 12 + m] !== undefined && !(y === 2026 && m > 9)) p *= 1 + mret[y * 12 + m]; yret[y] = p - 1; }
  return { eq, dd, mret, yret };
}
const A = { bb: account(BB), ic: account(IC) };
const months = (a) => Object.entries(a.mret).filter(([k]) => +k >= 2020 * 12 + 2 && +k <= 2026 * 12 + 9).map(([, v]) => v);
function stats(T, a) {
  const w = T.filter((t) => t.R > 0), l = T.filter((t) => t.R <= 0), gp = sum(w), gl = -sum(l), mo = months(a);
  const lg = T.filter((t) => t.dir === 1), sh = T.filter((t) => t.dir === -1);
  return { n: T.length, w: w.length, l: l.length, wr: w.length / T.length, R: sum(T), avgW: gp / w.length, avgL: -gl / l.length, pf: gp / gl, ls: streak(T, false), ws: streak(T, true), dd: E.maxDD(T), ddp: a.dd, bars: T.reduce((x, t) => x + t.bars, 0) / T.length,
    longs: sum(lg), shorts: sum(sh), nl: lg.length, ns: sh.length, mp: mo.filter((v) => v > 0).length, mn: mo.filter((v) => v < 0).length, bestM: Math.max(...mo), worstM: Math.min(...mo), eq: a.eq, yp: Y.filter((y) => sum(T.filter((t) => yrOf(t) === y)) > 0).length };
}
const ST = { bb: stats(BB, A.bb), ic: stats(IC, A.ic) };

// ---- SVG charts (classes come from the shared CSS) ----
function lineChart(series, W = 720, H = 250) {
  const x0 = 44, x1 = W - 12, y0 = 14, y1 = H - 24, tMin = Date.UTC(2020, 0, 1) / 1000, tMax = Date.UTC(2026, 10, 1) / 1000;
  const pts = series.map((s) => { let c = 0; return [...s.T].sort((a, b) => a.tExit - b.tExit).map((t) => { c += t.R; return [t.tExit, c]; }); });
  const ymax = Math.ceil(Math.max(...pts.flat().map((p) => p[1])) / 100) * 100, ymin = 0, X = (t) => x0 + (t - tMin) / (tMax - tMin) * (x1 - x0), Yy = (v) => y1 - (v - ymin) / (ymax - ymin) * (y1 - y0);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative R">`;
  for (let v = 0; v <= ymax; v += ymax / 5) svg += `<line x1="${x0}" x2="${x1}" y1="${Yy(v)}" y2="${Yy(v)}" class="grid${v === 0 ? ' zero' : ''}"/><text x="${x0 - 6}" y="${Yy(v) + 3.5}" class="ax" text-anchor="end">${Math.round(v)}</text>`;
  for (const y of Y) svg += `<line x1="${X(Date.UTC(y, 0, 1) / 1000)}" x2="${X(Date.UTC(y, 0, 1) / 1000)}" y1="${y0}" y2="${y1}" class="grid v"/><text x="${X(Date.UTC(y, 6, 1) / 1000)}" y="${H - 6}" class="ax" text-anchor="middle">${y}</text>`;
  series.forEach((s, i) => { const p = pts[i].filter((_, k) => k % 3 === 0 || k === pts[i].length - 1); svg += `<polyline class="ln ${s.cls}" points="${p.map(([t, v]) => `${X(t).toFixed(1)},${Yy(v).toFixed(1)}`).join(' ')}"/>`; });
  return svg + '</svg>';
}
function barChart(vals, W = 720, H = 270) { // vals: [{y, a, b}]
  const x0 = 44, x1 = W - 12, y0 = 14, y1 = H - 24, mx = Math.ceil(Math.max(...vals.flatMap((v) => [v.a, v.b])) / 50) * 50, Yy = (v) => y1 - v / mx * (y1 - y0), bw = (x1 - x0) / vals.length;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="R per year">`;
  for (let v = 0; v <= mx; v += mx / 4) svg += `<line x1="${x0}" x2="${x1}" y1="${Yy(v)}" y2="${Yy(v)}" class="grid${v === 0 ? ' zero' : ''}"/><text x="${x0 - 6}" y="${Yy(v) + 3.5}" class="ax" text-anchor="end">${Math.round(v)}</text>`;
  vals.forEach((v, i) => { const cx = x0 + bw * i + bw / 2, w = bw * 0.32; svg += `<rect x="${cx - w - 1}" y="${Yy(v.a)}" width="${w}" height="${y1 - Yy(v.a)}" class="bbf"/><rect x="${cx + 1}" y="${Yy(v.b)}" width="${w}" height="${y1 - Yy(v.b)}" class="emaf"/><text x="${cx - w / 2 - 1}" y="${Yy(v.a) - 3}" class="vl" text-anchor="middle">${v.a.toFixed(0)}</text><text x="${cx + w / 2 + 1}" y="${Yy(v.b) - 3}" class="vl" text-anchor="middle">${v.b.toFixed(0)}</text><text x="${cx}" y="${H - 6}" class="ax lab" text-anchor="middle">${v.y}</text>`; });
  return svg + '</svg>';
}
const yR = (T, y) => sum(T.filter((t) => yrOf(t) === y));

// ---- tables ----
const kv = (rows) => `<div class="tbl"><table><tr><th></th><th>Lucid’io (current bot)</th><th>Ichimoku trend-follower</th></tr>${rows.map(([k, a, b]) => `<tr><td>${k}</td><td>${a}</td><td>${b}</td></tr>`).join('')}</table></div>`;
function yearTable(T, a) {
  return `<div class="tbl"><table><tr><th>Year</th><th>Trades</th><th>Wins</th><th>Losses</th><th>Win %</th><th>Total R</th><th>Worst drop (R)</th><th>Account</th><th>Months up / down</th><th>Best month</th><th>Worst month</th></tr>` + Y.map((y) => {
    const t = T.filter((x) => yrOf(x) === y), mr = []; for (let m = 0; m < 12; m++) { const k = y * 12 + m; if (a.mret[k] !== undefined && !(y === 2026 && m > 9) && !(y === 2020 && m < 2)) mr.push(a.mret[k]); }
    return `<tr><td>${y}</td><td>${t.length}</td><td>${t.filter((x) => x.R > 0).length}</td><td>${t.filter((x) => x.R <= 0).length}</td><td>${(100 * t.filter((x) => x.R > 0).length / t.length).toFixed(0)}%</td><td>${R(sum(t))}</td><td>${E.maxDD(t).toFixed(1)}</td><td>${P(a.yret[y])}</td><td>${mr.filter((v) => v > 0).length} / ${mr.filter((v) => v < 0).length}</td><td>${P(Math.max(...mr))}</td><td>${P(Math.min(...mr))}</td></tr>`;
  }).join('') + '</table></div>';
}
function monthR(T) {
  return `<div class="tbl"><table><tr><th>Year</th>${MN.map((m) => `<th>${m}</th>`).join('')}<th>Year</th></tr>` + Y.map((y) => `<tr><td>${y}</td>${MN.map((_, m) => { const t = T.filter((x) => { const d = new Date(x.tExit * 1000); return d.getUTCFullYear() === y && d.getUTCMonth() === m; }); return t.length ? `<td>${R(sum(t))}<span class="mut"> (${t.length})</span></td>` : '<td class="mut">·</td>'; }).join('')}<td><b>${R(yR(T, y))}</b></td></tr>`).join('') + '</table></div>';
}
function monthP(a) {
  return `<div class="tbl"><table><tr><th>Year</th>${MN.map((m) => `<th>${m}</th>`).join('')}</tr>` + Y.map((y) => `<tr><td>${y}</td>${MN.map((_, m) => { const k = y * 12 + m, v = a.mret[k]; return v === undefined || (y === 2026 && m > 9) || (y === 2020 && m < 2) ? '<td></td>' : v === 0 ? '<td class="mut">·</td>' : `<td>${P(v)}</td>`; }).join('')}</tr>`).join('') + '</table></div>';
}
function coinTable() {
  return `<div class="tbl"><table><tr><th>Coin</th><th>Strategy</th><th>Trades</th><th>Win %</th><th>Wins / losses</th><th>Total R</th><th>Avg R</th><th>Worst drop (R)</th><th>Longest losing run</th><th>Years up</th></tr>` +
    C.flatMap((c) => [['bb', 'Lucid’io'], ['ic', 'Ichimoku']].map(([k, n], i) => { const t = KEY[k].filter((x) => x.coin === c), w = t.filter((x) => x.R > 0).length, y = E.yearly(t);
      return `<tr${i ? '' : ''}><td>${i ? '' : c}</td><td>${n}</td><td>${t.length}</td><td>${(100 * w / t.length).toFixed(0)}%</td><td>${w} / ${t.length - w}</td><td>${R(sum(t), 0)}</td><td>${R(sum(t) / t.length, 2)}</td><td>${E.maxDD(t).toFixed(1)}</td><td>${streak(t, false)}</td><td>${Y.filter((v) => (y[v] || 0) > 0).length}/7</td></tr>`; })).join('') + '</table></div>';
}
// concentration
const sorted = [...IC].sort((a, b) => b.R - a.R), tot = sum(IC);
const top = sorted.slice(0, 8), d10 = sorted.slice(0, 10).reduce((a, t) => a + t.R, 0);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const noBest = IC.filter((t) => t !== sorted[0]), yNB = E.yearly(noBest);
// neighbours + cost stress (computed live)
const run = (ex, cost) => { const c0 = { ...E.COST }; if (cost) { E.COST.fee *= cost; E.COST.slip *= cost; E.COST.fund *= cost; } const T = C.flatMap((c) => E.run(get(c).B, get(c).X, 'ichimoku', ICH, { coin: c, ...EX, ...ex })); Object.assign(E.COST, c0); return T; };
const yp = (T) => { const y = E.yearly(T); return Y.filter((v) => (y[v] || 0) > 0).length; };
const nb = []; for (const kI of [1.5, 2, 3]) for (const kT of [5, 7, 9]) { const T = run({ kInit: kI, kTrail: kT }); nb.push([kI, kT, sum(T), E.maxDD(T), yp(T)]); }
const c2 = run({}, 2), noSma = run({ trend: false });
const unseen = ['BTC', 'ETH', 'BNB', 'XRP', 'DOGE', 'LINK', 'LTC', 'AVAX'].map((c) => [c, sum(E.run(get(c).B, get(c).X, 'ichimoku', ICH, { coin: c, ...EX }))]);

// ---- assemble page ----
const css = fs.readFileSync(path.join(REP, 'merged-strategies-sol.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];
const head = fs.readFileSync(path.join(REP, 'merged-strategies-sol.html'), 'utf8').match(/<head>[\s\S]*?<style>/)[0].replace(/<title>.*?<\/title>/, '<title>Ichimoku Trend-Follower vs the Current Bot</title>').replace(/<meta name="description"[^>]*>/, '<meta name="description" content="Research: a cloud-breakout trend-follower against the current bot on five coins, 2020-2026: every year, every month, every trade count, stress tests and an independent audit.">');
const kpi = (cl, name, v, s) => `<div class="kpi ${cl}"><div class="n">${name}</div><div class="v ${cls(v)}">${sg(v, 0)}R</div><div class="s">${s}</div></div>`;
const html = `<!doctype html>
<html lang="en">
${head}
${css.replace('</style>', '.ca td, .ca th { font-size: 12px; padding: 5px 6px; }\n</style>')}
</head>
<body>
<div class="wrap">
  <a class="back" href="./">← Reports</a>
  <h1>Ichimoku Trend-Follower vs the Current Bot</h1>
  <div class="meta">Research · SOL · ZEC · NEAR · ADA · GALA · 2020 → 27 Oct 2026 · Binance 4-hour candles</div>
  <p class="lead">Can a trend-following strategy that rides big swings do better than the current bot? This report puts a cloud-breakout trend-follower next to the <b style="color:var(--c-bb)">current bot</b> on the same five coins and the same costs: every year, every month, the number of winning and losing trades, how it holds up under stress, and an independent re-check by a second model (Opus) that rebuilt the test from scratch.</p>

  <div class="card">
    <h2>The answer in one look</h2>
    <div class="kpis">
      ${kpi('bb', 'Lucid’io (current bot)', ST.bb.R, `${ST.bb.n} trades · ${(ST.bb.wr * 100).toFixed(0)}% win<br>${ST.bb.yp} of 7 years up · worst drop ${ST.bb.dd.toFixed(0)}R`)}
      ${kpi('ema', 'Ichimoku trend-follower', ST.ic.R, `${ST.ic.n} trades · ${(ST.ic.wr * 100).toFixed(0)}% win<br>${ST.ic.yp} of 7 years up · worst drop ${ST.ic.dd.toFixed(0)}R`)}
      <div class="kpi two"><div class="n">Months up</div><div class="v">${ST.bb.mp} vs ${ST.ic.mp}</div><div class="s">of ${ST.bb.mp + ST.bb.mn} traded months<br>current bot vs Ichimoku</div></div>
    </div>
    <div class="call warn"><b>Ichimoku made more R (+${ST.ic.R.toFixed(0)} vs +${ST.bb.R.toFixed(0)}), but it is not a better bot.</b> Its profit rests on a handful of giant trends: the 10 best trades are ${(100 * d10 / tot).toFixed(0)}% of all its profit, and without the 20 best trades (of ${ST.ic.n}) almost nothing is left. The current bot earns less but steadily: more winning trades, fewer losing months, no single trade that matters.</div>
    <div class="call"><b>Verdict:</b> run it, if at all, as a separate paper-traded sub-account beside the current bot, never as a replacement. Judge it after 6–12 months, because a few trades can decide the outcome either way.</div>
  </div>

  <div class="card">
    <h2>How these numbers were made</h2>
    <ul>
      <li><b>Current bot:</b> the live Lucid’io rules, unchanged (rules are confidential and not described here). Its engine reproduces the live bot trade for trade.</li>
      <li><b>Ichimoku trend-follower:</b> buys when a 4-hour candle closes above the Ichimoku cloud (sells when it closes below), only in the direction of the 200-candle average. First stop 2× the average candle range (ATR) away; then the stop trails 7× ATR behind the best price and only ever moves in the trade’s favour. No profit target: a winner runs until the trail catches it.</li>
      <li><b>Fair picking:</b> the settings were chosen using 2020–2022 only, then frozen and judged on 2023–2026 and on coins that were never used (BTC, ETH and six more). Many settings were tried, so some luck in the pick is still possible.</li>
      <li><b>Account figures:</b> $1,000 start, <b>2.5% of current equity risked per trade</b>, compounded, up to five coins open together, closed trades only. A trade counts in the month and year it <i>closes</i>. 2020 starts in Feb–Mar, 2026 ends in October.</li>
      <li>Costs: 0.07% per side (fee + slippage) plus funding. Every decision uses only candles that had already closed (checked: cutting off recent data changes no earlier trade).</li>
      <li><b>Live data:</b> the live bot only started trading on 23 Oct 2026, so there are no real live trades to compare yet. “Current bot” here is its own engine on past prices.</li>
    </ul>
  </div>

  <div class="card">
    <h2>1 · Growth over the 7 years</h2>
    <p>Running total of profit in R, trade by trade.</p>
    <div class="legend"><span><i class="bbf"></i>Lucid’io (current bot)</span><span><i class="emaf"></i>Ichimoku trend-follower</span></div>
    ${lineChart([{ T: BB, cls: 'bb' }, { T: IC, cls: 'ema' }])}
    <p class="small">The current bot climbs steadily. Ichimoku is flat or bleeding for long stretches, then jumps (early 2021, late 2023, late 2024, Nov 2025, Sep 2026).</p>
  </div>

  <div class="card">
    <h2>2 · Each year, side by side</h2>
    <div class="legend"><span><i class="bbf"></i>Lucid’io (current bot)</span><span><i class="emaf"></i>Ichimoku trend-follower</span></div>
    ${barChart(Y.map((y) => ({ y, a: yR(BB, y), b: yR(IC, y) })))}
    <p class="small">R earned per year (all five coins). Both are positive in all 7 years. Ichimoku wins 4 of the 7, the current bot wins 2020, 2022 and 2024.</p>
    <div class="tbl"><table><tr><th>Year</th><th>Lucid’io R</th><th>Account</th><th>Ichimoku R</th><th>Account</th></tr>${Y.map((y) => `<tr><td>${y}</td><td>${R(yR(BB, y))}</td><td>${P(A.bb.yret[y])}</td><td>${R(yR(IC, y))}</td><td>${P(A.ic.yret[y])}</td></tr>`).join('')}<tr class="hl"><td>Total</td><td>${R(ST.bb.R)}</td><td>$${Math.round(ST.bb.eq).toLocaleString('en-US')}</td><td>${R(ST.ic.R)}</td><td>$${Math.round(ST.ic.eq).toLocaleString('en-US')}</td></tr></table></div>
    <p class="small">“Account” is the yearly return of a $1,000 account at 2.5% risk; the total row shows the end balance. The dollar figures assume no size limits and perfect fills, so use them to compare, not to forecast.</p>
  </div>

  <div class="card">
    <h2>3 · All the statistics</h2>
    ${kv([
      ['Trades', ST.bb.n, ST.ic.n], ['Winning trades', ST.bb.w, ST.ic.w], ['Losing trades', ST.bb.l, ST.ic.l], ['Win rate', (ST.bb.wr * 100).toFixed(1) + '%', (ST.ic.wr * 100).toFixed(1) + '%'],
      ['Total profit', R(ST.bb.R) + 'R', R(ST.ic.R) + 'R'], ['Average per trade', R(ST.bb.R / ST.bb.n, 2) + 'R', R(ST.ic.R / ST.ic.n, 2) + 'R'],
      ['Average winner / average loser', `${R(ST.bb.avgW)}R / ${R(-ST.bb.avgL)}R`, `${R(ST.ic.avgW)}R / ${R(-ST.ic.avgL)}R`], ['Profit factor (money won ÷ money lost)', ST.bb.pf.toFixed(2), ST.ic.pf.toFixed(2)],
      ['Longest losing run / winning run (trades)', `${ST.bb.ls} / ${ST.bb.ws}`, `${ST.ic.ls} / ${ST.ic.ws}`], ['Worst drop from a peak (R)', ST.bb.dd.toFixed(1) + 'R', ST.ic.dd.toFixed(1) + 'R'],
      ['Worst drop from a peak (% of account)', '−' + (ST.bb.ddp * 100).toFixed(0) + '%', '−' + (ST.ic.ddp * 100).toFixed(0) + '%'], ['Average time in a trade', `${(ST.bb.bars / 6).toFixed(1)} days`, `${(ST.ic.bars / 6).toFixed(1)} days`],
      ['Longs: trades · profit', `${ST.bb.nl} · ${R(ST.bb.longs, 0)}R`, `${ST.ic.nl} · ${R(ST.ic.longs, 0)}R`], ['Shorts: trades · profit', `${ST.bb.ns} · ${R(ST.bb.shorts, 0)}R`, `${ST.ic.ns} · ${R(ST.ic.shorts, 0)}R`],
      ['Months up / down', `${ST.bb.mp} / ${ST.bb.mn}`, `${ST.ic.mp} / ${ST.ic.mn}`], ['Best / worst month (account)', `${P(ST.bb.bestM)} / ${P(ST.bb.worstM)}`, `${P(ST.ic.bestM)} / ${P(ST.ic.worstM)}`], ['Years up', ST.bb.yp + ' of 7', ST.ic.yp + ' of 7'],
    ])}
    <p class="small">R = one unit of risk (what you lose if a trade is stopped out at its first stop). Ichimoku’s long-only character matters: its shorts made only ${R(ST.ic.shorts, 0)}R in total.</p>
  </div>

  <div class="card ca">
    <h2>4 · Lucid’io (current bot) — every year</h2>
    ${yearTable(BB, A.bb)}
    <h2 style="margin-top:18px">Ichimoku trend-follower — every year</h2>
    ${yearTable(IC, A.ic)}
    <p class="small">“Worst drop” is the deepest fall from a peak inside that year, in R. “Months up / down” counts months where the account gained or lost.</p>
  </div>

  <div class="card ca">
    <h2>5 · Every month — profit in R (trades closed that month in brackets)</h2>
    <h3>Lucid’io (current bot)</h3>
    ${monthR(BB)}
    <h3>Ichimoku trend-follower</h3>
    ${monthR(IC)}
    <p class="small">Ichimoku has long runs of small red months and then one or two enormous green ones (Nov 2025: +133R from five trades).</p>
  </div>

  <div class="card ca">
    <h2>6 · Every month — account return at 2.5% risk</h2>
    <h3>Lucid’io (current bot)</h3>
    ${monthP(A.bb)}
    <h3>Ichimoku trend-follower</h3>
    ${monthP(A.ic)}
    <p class="small">Compounded, so a big month after a big month looks huge. Compare the pattern, not the percentages.</p>
  </div>

  <div class="card ca">
    <h2>7 · Coin by coin</h2>
    ${coinTable()}
    <p class="small">The current bot is up in 7 of 7 years on SOL, ZEC, NEAR and ADA (GALA 6 of 6 full years). Ichimoku has its weak coins: NEAR is up in only 4 of 7 years.</p>
  </div>

  <div class="card">
    <h2>8 · The catch: a few trades carry everything</h2>
    <div class="tbl"><table><tr><th>Biggest Ichimoku trades</th><th>Coin</th><th>Opened → closed</th><th>Days held</th><th>Result</th></tr>${top.map((t) => `<tr><td>#${top.indexOf(t) + 1}</td><td>${t.coin}</td><td>${iso(t.t)} → ${iso(t.tExit)}</td><td>${(t.bars / 6).toFixed(0)}</td><td>${R(t.R)}R</td></tr>`).join('')}</table></div>
    <div class="tbl"><table><tr><th>Ichimoku total profit …</th><th>R</th></tr>
      <tr><td>with all ${ST.ic.n} trades</td><td>${R(tot, 0)}</td></tr>
      ${[1, 3, 5, 10, 20].map((k) => `<tr><td>without its ${k} best trade${k > 1 ? 's' : ''}</td><td>${R(tot - sorted.slice(0, k).reduce((a, t) => a + t.R, 0), 0)}</td></tr>`).join('')}</table></div>
    <div class="call warn"><b>${(100 * d10 / tot).toFixed(0)}% of all Ichimoku profit comes from 10 trades out of ${ST.ic.n}.</b> That is how trend-following works: lots of small losses, a few giant wins. It also means the result depends on catching the next huge trend. Without its single best trade (ZEC, Sep–Nov 2025) it is still up in all 7 years, but 2025 shrinks to ${sg(yNB[2025] || 0, 0)}R.</div>
    <p>The current bot has no such trade: its biggest winners are only a few R, and its profit comes from hundreds of ordinary trades. That is the main reason it compounds more smoothly.</p>
  </div>

  <div class="card">
    <h2>9 · Stress tests</h2>
    <div class="tbl"><table><tr><th>Test</th><th>Profit</th><th>Worst drop</th><th>Years up</th></tr>
      <tr class="hl"><td>As tested</td><td>${R(ST.ic.R, 0)}R</td><td>${ST.ic.dd.toFixed(0)}R</td><td>${ST.ic.yp}/7</td></tr>
      <tr><td>All costs doubled</td><td>${R(sum(c2), 0)}R</td><td>${E.maxDD(c2).toFixed(0)}R</td><td>${yp(c2)}/7</td></tr>
      <tr><td>Entry one candle later (independent audit)</td><td>${R(619, 0)}R</td><td>29R</td><td>7/7</td></tr>
      <tr><td>Slippage 10× (0.2% per side) (independent audit)</td><td>${R(610, 0)}R</td><td>33R</td><td>7/7</td></tr>
      <tr><td>Late entry and 10× slippage together (independent audit)</td><td>${R(573, 0)}R</td><td>34R</td><td>7/7</td></tr>
      <tr><td>Without the 200-candle average filter</td><td>${R(sum(noSma), 0)}R</td><td>${E.maxDD(noSma).toFixed(0)}R</td><td>${yp(noSma)}/7</td></tr></table></div>
    <h3>Nearby settings (first stop × trail, in ATR)</h3>
    <div class="tbl"><table><tr><th>First stop</th><th>Trail</th><th>Profit</th><th>Worst drop</th><th>Years up</th></tr>${nb.map(([a, b, r, d, y]) => `<tr${a === 2 && b === 7 ? ' class="hl"' : ''}><td>${a}×</td><td>${b}×</td><td>${R(r, 0)}R</td><td>${d.toFixed(0)}R</td><td>${y}/7</td></tr>`).join('')}</table></div>
    <p class="small">Every nearby setting is profitable. A wider trail earns more but depends even more on rare huge trends; a tighter first stop earns more but needs more leverage.</p>
    <h3>Coins never used for tuning</h3>
    <div class="tbl"><table><tr>${unseen.map(([c]) => `<th>${c}</th>`).join('')}<th>Total</th></tr><tr>${unseen.map(([, r]) => `<td>${R(r, 0)}</td>`).join('')}<td><b>${R(unseen.reduce((a, [, r]) => a + r, 0), 0)}</b></td></tr></table></div>
    <p class="small">Same rules, same settings, in R. ${unseen.filter(([, r]) => r > 0).length} of ${unseen.length} are positive.</p>
  </div>

  <div class="card">
    <h2>10 · Independent re-check (Opus)</h2>
    <p>A second model rebuilt the whole Ichimoku test from a plain-English description, without seeing the original code, then compared with it.</p>
    <ul>
      <li><b>Exact match:</b> same 760 trades, same entry times and directions, same +658R, same yearly numbers on every coin. Largest difference on any trade: 0.00000005R.</li>
      <li><b>No look-ahead:</b> the cloud uses only past candles, entries fill at the next candle’s open, stops are checked inside every candle (a gap through a stop fills at the worse price).</li>
      <li><b>Data:</b> no gaps in any file, no still-forming candle used.</li>
      <li><b>Real funding</b> instead of the flat charge would add about +8R, so the flat charge is slightly pessimistic.</li>
      <li><b>Flagged as the real risks:</b> (1) profit concentrated in a few trades; (2) it is a long-side strategy riding bull trends; (3) the coins and the 2×/7× setting were chosen from many tries, and the 2023–26 window has been looked at in several rounds, so it is no longer truly unseen. One hidden 600-candle time limit in the test code never triggered.</li>
    </ul>
  </div>

  <div class="card">
    <h2>11 · Merge them or keep them apart?</h2>
    <div class="tbl"><table><tr><th>Setup (same total risk)</th><th>End balance from $1,000</th><th>Worst drop</th><th>Years up</th></tr>
      <tr><td>Lucid’io alone</td><td>$9.3M</td><td>−56%</td><td>7/7</td></tr>
      <tr><td>Ichimoku alone</td><td>$2.75M</td><td>−53%</td><td>7/7</td></tr>
      <tr class="hl"><td>Both in one account, 1.25% each</td><td>$8.35M</td><td>−48%</td><td>7/7</td></tr>
      <tr><td>Two separate sub-accounts, 50 / 50, 2.5% each</td><td>$6.0M</td><td>−50%</td><td>7/7</td></tr></table></div>
    <ul>
      <li>The two are barely related (monthly results correlate only 0.15), so together they have a smaller drop than the current bot alone, at the price of a somewhat smaller end balance.</li>
      <li>83% of Ichimoku trades overlap in time with a current-bot trade on the same coin; 86 of those run in <b>opposite directions</b>. In one account these would net off, and a trailing stop could move the stop of the other bot’s trade.</li>
      <li><b>So use a separate sub-account</b> for Ichimoku, with its own balance, stop orders and trade log.</li>
    </ul>
  </div>

  <div class="card">
    <h2>12 · Bottom line</h2>
    <ul>
      <li>Ichimoku earns more R in total, with a similar worst drop and less leverage, and is up in all 7 years. Nothing in the tests (costs, delay, nearby settings, coins it never saw, independent rebuild) broke it.</li>
      <li>It does <b>not</b> beat the current bot on steadiness: lower win rate (${(ST.ic.wr * 100).toFixed(0)}% vs ${(ST.bb.wr * 100).toFixed(0)}%), more losing months (${ST.ic.mn} vs ${ST.bb.mn}), more losing coin-years, and ${(100 * d10 / tot).toFixed(0)}% of profit from 10 trades. A broad search of ${'~3,000'} settings across seven strategy families found nothing that beat the current bot on every measure.</li>
      <li>The bot would need a trailing-stop feature before it could trade this strategy, because it currently places a fixed stop and target only.</li>
      <li><b>Next step:</b> paper-trade it in its own sub-account for 6–12 months and compare with this report.</li>
    </ul>
  </div>

  <p class="disc">Research on past prices, not a promise or advice. Binance USDT-M futures 4-hour candles; the live bot trades on MEXC, whose candles and fills differ somewhat. Costs: 0.07% per side plus funding. Account figures compound closed trades only and assume no size limits. Several strategy settings were tried; the chosen one was picked on 2020–2022 and then frozen, but later rounds looked at 2023–2026 again, so treat it as a candidate, not a proven edge. Generated 27 Oct 2026.</p>
</div>
</body>
</html>`;
fs.writeFileSync(path.join(REP, 'ichimoku-vs-current-bot.html'), html);

// index.json entry (top of list)
const ixf = path.join(REP, 'index.json'), ix = JSON.parse(fs.readFileSync(ixf, 'utf8')).filter((r) => r.slug !== 'ichimoku-vs-current-bot');
ix.unshift({ slug: 'ichimoku-vs-current-bot', title: 'Ichimoku Trend-Follower vs the Current Bot',
  summary: 'Research, five coins, 2020–2026: a cloud-breakout trend-follower against the current bot. Every year and every month, wins and losses, drops, per-coin results, stress tests, an independent re-check, and merge-or-separate-account test. Ichimoku makes more R but depends on a few giant trades.',
  updated: '27 Oct 2026', kind: 'Research', file: 'reports/ichimoku-vs-current-bot.html' });
fs.writeFileSync(ixf, JSON.stringify(ix, null, 2) + '\n');
console.log('written', path.join(REP, 'ichimoku-vs-current-bot.html'), (html.length / 1024).toFixed(0) + ' KB');
