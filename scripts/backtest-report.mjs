// backtest-report.mjs — writes ledger/reports/backtest-data.html ("What ₱1,000 could have become") from the pool simulation in backtest-report-data.mjs.
//   node scripts/backtest-report.mjs
// The page names no bot: it speaks of "two trading systems". The CSS is taken from the existing page so the look stays the same.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build, RISK, FIRST, END, at } from './backtest-report-data.mjs';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(app, '..', '🔴LEDGER', 'reports', 'backtest-data.html');
const old = readFileSync(OUT, 'utf8');
let css = old.slice(old.indexOf('<style>') + 7, old.indexOf('</style>'));
css = css.replace(/\n \.dlbtn \{[\s\S]*?\n\}\n@media print \{ \.dlbtn/, '\n@media print { .dlbtn');   // drop the stray, unbalanced block of the old file; re-added below
css += `
.dlbtn { position: fixed; top: 16px; right: 16px; z-index: 10; background: #1d4ed8; color: #fff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 9px 16px; border-radius: 8px; box-shadow: 0 4px 14px rgba(15,23,42,.25); }
.dlbtn:hover { background: #1e40af; }
@media print { .dlbtn { display: none; } }
@media screen and (max-width: 760px) { .dlbtn { top: 10px; right: 10px; padding: 7px 12px; font-size: 12px; } }
`;

const D = build(), { months, years, all, nofee, uw, fresh, riskRows, stat } = D;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MIN = '−';
const n0 = (v) => Math.round(v).toLocaleString('en-US');
const peso = (v) => '₱' + n0(v);
const spos = (v) => (v < 0 ? MIN : '+') + '₱' + n0(Math.abs(v));
const pct = (v, d = 1) => (v < 0 ? MIN : '+') + Math.abs(v * 100).toFixed(d) + '%';
const pct0 = (v) => (v < 0 ? MIN : '+') + n0(Math.abs(v * 100)) + '%';
const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat');
const dateL = (t) => { const d = new Date(t * 1000); return `${d.getUTCDate()} ${MONL[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const monL = (t) => { const d = new Date(t * 1000); return `${MONL[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const f1 = (v) => v.toFixed(1);

const final = all.pts.at(-1)[1], finalNo = nofee.pts.at(-1)[1], fees = all.fees.reduce((q, x) => q + x[1], 0);
const spanYears = (END - FIRST) / (365.25 * 86400), cagr = Math.pow(final / 1000, 1 / spanYears) - 1;
const greenM = months.filter((m) => m.ret > 0).length, nM = months.length;
const yearsUp = years.filter((y) => y.ret > 0).length;
const worstM = months.reduce((a, m) => (m.ret < a.ret ? m : a)), bestM = months.reduce((a, m) => (m.ret > a.ret ? m : a));
const winPct = Math.round(100 * stat.wins / stat.n);
const endL = dateL(END - 1), startL = monL(FIRST), lastDay = new Date((END - 1) * 1000).getUTCDate();
const yearsTxt = `${spanYears.toFixed(1)} years`;
const risk25 = riskRows[0], risk1 = riskRows[1], risk05 = riskRows[2];
const mName = (m) => `${MONL[m.m]} ${m.y}`;

// ---------- svg helpers ----------
const axis = (x1, x2, y, label, strong) => `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="${strong ? '#64748b' : '#e2e8f0'}"/><text x="${x1 - 8}" y="${y + 4}" text-anchor="end" class="ax">${label}</text>`;
function growthChart() {
  const W = 680, x0 = 84, x1 = 664, yTop = 15, yBot = 213, n = months.length + (months[0].m + 12 * (months[0].y - 2020));
  const kOf = (m) => (m.y - 2020) * 12 + m.m;                        // month index since Jan 2020
  const K = kOf(months.at(-1)) + 1;
  const lo = 3, hi = Math.log10(finalNo) + 0.12;
  const X = (k) => x0 + (k / K) * (x1 - x0), Y = (v) => yBot - ((Math.log10(Math.max(v, 1000)) - lo) / (hi - lo)) * (yBot - yTop);
  let g = '';
  for (let p = lo; p <= Math.floor(hi); p++) g += axis(x0, x1, Y(Math.pow(10, p)), peso(Math.pow(10, p)));
  for (let y = 2020; y <= 2026; y++) g += `<text x="${f1(X((y - 2020) * 12))}" y="242" text-anchor="start" class="ax">${y}</text>`;
  const series = (ms, dash, col) => { let d = `M${f1(X(kOf(ms[0])))},${f1(Y(ms[0].start))}`; for (const m of ms) d += ` L${f1(X(kOf(m) + 1))},${f1(Y(m.end))}`; return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${dash ? 1.6 : 2.2}"${dash ? ' stroke-dasharray="5 4"' : ''}/>`; };
  g += series(D.monthsNoFee, true, '#94a3b8') + series(months, false, '#1d4ed8');
  let dots = '';
  for (const y of years) { const m = months.filter((q) => q.y === y.y).at(-1), k = kOf(m) + 1; dots += `<circle cx="${f1(X(k))}" cy="${f1(Y(m.end))}" r="3.2" fill="#1d4ed8"/><text x="${f1(Math.min(X(k) - 4, 662))}" y="${f1(Y(m.end) - 8)}" text-anchor="end" class="tiny">${peso(m.end)}</text>`; }
  return `<div class="card"><svg viewBox="0 0 ${W} 250" width="100%">${g}${dots}</svg><div class="legend"><span><span class="sw" style="background:#1d4ed8"></span>After the 20% fee</span><span><span class="sw" style="background:#94a3b8"></span>Before the fee</span></div></div>`;
}
function yearBars() {
  const max = Math.max(...years.map((y) => y.ret));
  return `<div class="card">` + years.map((y) => { const w = Math.max(1.5, Math.sqrt(Math.max(y.ret, 0) / max) * 100);
    return `<div style="display:grid;grid-template-columns:62px 1fr 190px;gap:8px;align-items:center;margin:5px 0;font-size:11.5px"><b>${y.y}${y.first ? '*' : ''}${y.partial ? '**' : ''}</b><div style="background:#f1f5f9;border-radius:4px;height:16px"><div style="width:${f1(w)}%;height:16px;border-radius:4px;background:${y.ret >= 0 ? '#15803d' : '#dc2626'}"></div></div><div style="text-align:right"><b class="${cls(y.ret)}">${pct0(y.ret)}</b> <span style="color:#64748b">${peso(y.start)} → ${peso(y.end)}</span></div></div>`; }).join('') + `</div>`;
}
function monthBars(ms, y) {
  const W = 680, x0 = 44, x1 = 672, mid = 57, H = 40, step = (x1 - x0) / 12, bw = step * 0.64;
  const mx = Math.max(10, ...ms.map((m) => Math.abs(m.ret) * 100)), top = Math.ceil(mx / 10) * 10, S = H / top;
  let g = axis(x0, x1, mid + H, MIN + top + '%') + axis(x0, x1, mid, '0%', true) + axis(x0, x1, mid - H, '+' + top + '%');
  for (let m = 0; m < 12; m++) { const cx = x0 + step * (m + 0.5), r = ms.find((q) => q.m === m);
    g += `<text x="${f1(cx)}" y="114" text-anchor="middle" class="ax">${MON[m]}</text>`;
    if (!r) { g += `<text x="${f1(cx)}" y="61" text-anchor="middle" class="ax">–</text>`; continue; }
    const v = r.ret * 100, h = Math.max(1, Math.abs(v) * S);
    g += `<rect x="${f1(cx - bw / 2)}" y="${f1(v >= 0 ? mid - h : mid)}" width="${f1(bw)}" height="${f1(h)}" rx="2.5" fill="${v >= 0 ? '#15803d' : '#dc2626'}"/><text x="${f1(cx)}" y="${f1(v >= 0 ? mid - h - 4 : mid + h + 11)}" text-anchor="middle" class="tiny">${pct(r.ret)}</text>`; }
  return `<svg viewBox="0 0 ${W} 120" width="100%">${g}</svg>`;
}
const calCell = (v) => { if (v == null) return `<td style="background:#f1f5f9;color:#cbd5e1">–</td>`; const a = Math.min(0.9, 0.12 + Math.abs(v) * 1.2);
  return `<td style="background:rgba(${v >= 0 ? '21,128,61' : '220,38,38'},${a.toFixed(2)});color:${Math.abs(v) > 0.3 ? '#fff' : v >= 0 ? '#14532d' : '#7f1d1d'}">${pct0(v)}</td>`; };

// ---------- pages ----------
const pages = [];
const page = (html) => pages.push(html);
const foot = (i) => `<div class="foot"><span>Past-price test, after the 20% fee. Not live trading. Past performance does not guarantee future results.</span><span>Page ${i + 1} of ${pages.length}</span></div>`;
const kpi = (v, k, c = '') => `<div class="kpi"><div class="v ${c}">${v}</div><div class="k">${k}</div></div>`;

// 1 cover
page(`<div class="cover-band">
  <div class="tag">Past-price test · Investor report</div>
  <h1>What ₱1,000 could have become</h1>
  <p class="sub" style="font-size:14px;margin:0">Two automated trading systems, run together as one pool and tested on real market data from ${startL} to ${endL}, about ${yearsTxt}. Every peso figure is after the 20% fee, as a Filipino investor starting with ₱1,000 would have kept it.</p>
</div>
<div class="kpis">${kpi('₱1,000', 'Starting balance')}${kpi(peso(final), 'Final balance, after the 20% fee', 'pos')}${kpi('×' + n0(final / 1000), 'Growth of the starting balance', 'pos')}${kpi(`${yearsUp} / ${years.length}`, 'Profitable years')}</div>
<div class="kpis" style="margin-top:0">${kpi(pct0(cagr), 'Average per year (compounded)')}${kpi(`${greenM} / ${nM}`, 'Profitable months')}${kpi(MIN + (uw.dd * 100).toFixed(1) + '%', 'Worst drop from a high', 'neg')}${kpi(n0(stat.n), 'Trades taken')}</div>
<h2>How it works, in plain words</h2>
<p class="sub">The pool runs two systems, each a set of fixed rules run by a computer. They watch liquid markets around the clock and only act when their conditions are met. No guessing and no emotions. Half of the money is with each system.</p>
<div class="steps">
  <div class="step"><div class="n">1</div><b>You join the pool</b><p>Your ₱1,000 buys a slice of one shared trading pool. When the pool grows or shrinks, your slice moves by the same percent as everyone else's.</p></div>
  <div class="step"><div class="n">2</div><b>The loss is limited before every trade</b><p>Every trade has an exit point for a loss, set before the trade is opened. Each trade puts <b>2.5% of its system's money</b> at risk.</p></div>
  <div class="step"><div class="n">3</div><b>The 20% fee on new profit only</b><p>Every two months, <b>20% of new profit</b> above your best level so far is the fee. A loss means no fee, and a fee is never charged twice on the same profit.</p></div>
</div>
<h3>What to expect</h3>
<ul style="margin:4px 0 0;padding-left:18px">
  <li><b>Most trades are small losses.</b> Only about ${winPct}% of trades win. Money is made because the wins are much bigger than the losses.</li>
  <li><b>Some months are red, sometimes several in a row.</b> That is normal for this kind of system. Page 9 shows the bad stretches.</li>
  <li><b>The swings are big.</b> With 2.5% put at risk per trade, an investor's balance once fell <b>${MIN}${(uw.dd * 100).toFixed(0)}%</b> from its high before recovering, and the worst single month lost ${(Math.abs(worstM.ret) * 100).toFixed(0)}%.</li>
  <li><b>It does best when markets move strongly</b> (big rallies or big sell-offs) and slowly gives back a little when prices drift sideways.</li>
  <li><b>All trading costs are included:</b> exchange fees, slippage (getting a slightly worse price than planned), funding charges and other costs. The 20% fee is on top and already taken out of every peso figure here.</li>
</ul>
<div class="note"><b>How the compounding works.</b> We start with ₱1,000 on 1 January 2020 (the first trade came in ${startL}). Each system keeps its own balance, and <b>every trade puts 2.5% of that balance at risk</b>, measured when the trade opens. Wins make the next trade a little bigger and losses make it smaller, so profit is <b>re-invested trade by trade</b>. The 20% fee is taken every two months (end of February, April, June, August, October and December) from profit above your best level so far. The last, partial month is settled on the last day of data.</div>`);

// 2 growth
page(`<h2>Growth of ₱1,000</h2>
<p class="sub">Balance at the end of every month, after the 20% fee (solid) and before it (dashed). The dots show the balance at the end of each year. The scale grows evenly in percentage terms, so the same percentage gain looks the same size in 2021 as in 2025.</p>
${growthChart()}
<h2 style="margin-top:14px">Return each year</h2>
<p class="sub">Each bar is that year's gain as a percentage of the balance it started with, after the fee. (Bar lengths are scaled so small years stay visible.)</p>
${yearBars()}
<h3>Year-by-year summary (compounded, after the 20% fee)</h3>
<table><tr><th>Year</th><th>Start</th><th>Fee paid</th><th>Profit</th><th>Return</th><th>End balance</th><th>Trades</th><th>Green / red months</th></tr>
${years.map((y) => `<tr><td><b>${y.y}</b>${y.first ? ' from Mar' : ''}</td><td>${peso(y.start)}</td><td>${peso(y.fee)}</td><td class="${cls(y.profit)}">${spos(y.profit)}</td><td class="${cls(y.ret)}">${pct(y.ret)}</td><td>${peso(y.end)}</td><td>${y.n}</td><td>${y.green} / ${y.red}</td></tr>`).join('')}
<tr class="tot"><td>Total</td><td>₱1,000</td><td>${peso(fees)}</td><td class="pos">${spos(final - 1000)}</td><td class="pos">${pct0(final / 1000 - 1)}</td><td>${peso(final)}</td><td>${n0(stat.n)}</td><td>${greenM} / ${nM - greenM}</td></tr></table>
<p class="sub" style="margin-top:8px;font-size:11px">* 2020 starts in ${startL} (first trade). ** 2026 runs to ${endL}. Before the fee the same ₱1,000 would have reached ${peso(finalNo)}; the difference is the ${peso(fees)} of fees, which also stops that money from compounding.</p>`);

// 3 lower risk
page(`<h2>What if each trade risked less?</h2>
<p class="sub">The exact same trades, with a smaller part of each system's money put at risk per trade. The only thing that changes is the risk size. All figures are <b>after the 20% fee</b>, starting from ₱1,000.</p>
<div class="two" style="margin-top:10px;grid-template-columns:repeat(3,1fr)">
${riskRows.map((r, i) => `<div class="card" style="${i === 0 ? 'border-color:#1d4ed8' : ''};margin-bottom:0"><b style="font-size:12px">${(r.risk * 100).toFixed(r.risk < 0.01 ? 1 : (r.risk === 0.025 ? 1 : 0))}% per trade${i === 0 ? ' · used in this report' : ''}</b><div class="big" style="font-size:22px;font-weight:700;margin:6px 0">${peso(r.final)}</div><div style="font-size:11px;color:#475569;line-height:1.7">Biggest drop from a high: <b class="neg">${MIN}${(r.dd * 100).toFixed(1)}%</b><br>Worst single month: <b class="neg">${pct0(r.worstMonth)}</b><br>Profitable months: <b>${r.green} / ${r.months}</b><br>Profitable years: <b>${r.yearsUp} / ${years.length}</b></div></div>`).join('')}
</div>
<div class="note"><b>Bigger numbers, bigger drops.</b> Risking 2.5% per trade grew ₱1,000 to ${peso(risk25.final)}, against ${peso(risk1.final)} at 1% and ${peso(risk05.final)} at 0.5%. The price is the ride: the deepest fall goes from ${MIN}${(risk05.dd * 100).toFixed(0)}% (0.5%) to ${MIN}${(risk1.dd * 100).toFixed(0)}% (1%) and ${MIN}${(risk25.dd * 100).toFixed(0)}% (2.5%). The rest of this report uses 2.5%, the setting the pool actually trades with.</div>
<div class="note warn"><b>The 2.5% rows are the extreme case.</b> A drop of about ${(risk25.dd * 100).toFixed(0)}% means an investor who had ₱100,000 could have seen about ₱${n0(risk25.dd * 100000)} disappear from the top before the balance recovered. Anyone who cannot sit through that should not look at the biggest number on this page.</div>`);

// 4 calendar
const calRows = (arr, fmt, tot) => { let h = '<tr><th></th>' + MON.map((m) => `<th>${m}</th>`).join('') + '<th>Year</th></tr>';
  for (const y of years) { h += `<tr><td class="yr">${y.y}</td>`; for (let m = 0; m < 12; m++) { const r = months.find((q) => q.y === y.y && q.m === m); h += r ? fmt(r) : `<td style="background:#f1f5f9;color:#cbd5e1">–</td>`; } h += tot(y) + '</tr>'; }
  return h; };
const rank = [...months].sort((a, b) => b.ret - a.ret);
page(`<h2>Monthly calendar</h2>
<p class="sub">Every month at a glance. Green = your balance grew that month, red = it shrank. Numbers are the % change of your balance <b>after the 20% fee</b>.</p>
<table class="cal">${calRows(months, (r) => calCell(r.ret), (y) => `<td class="tot ${cls(y.ret)}">${pct0(y.ret)}</td>`)}</table>
<div class="legend"><span><span class="sw" style="background:rgba(21,128,61,.5)"></span>Month that grew</span><span><span class="sw" style="background:rgba(220,38,38,.5)"></span>Month that shrank</span><span><span class="sw" style="background:#f1f5f9"></span>Not in test period</span></div>
<h2 style="margin-top:16px">Monthly profit in pesos</h2>
<p class="sub">The same months, as the peso profit or loss on the balance you had at that time, after the fee. Fees are taken in the even months (Feb, Apr, Jun, Aug, Oct, Dec) when your balance is above its best level. These grow with the balance, so late months look large in pesos.</p>
<table class="cal">${calRows(months, (r) => `<td style="background:${r.profit >= 0 ? 'rgba(21,128,61,.12)' : 'rgba(220,38,38,.12)'};color:${r.profit >= 0 ? '#15803d' : '#b91c1c'};font-size:8px">${r.profit >= 0 ? '+' : MIN}${n0(Math.abs(r.profit))}</td>`, (y) => `<td class="tot ${cls(y.profit)}" style="font-size:8px">${y.profit >= 0 ? '+' : MIN}${n0(Math.abs(y.profit))}</td>`)}</table>
<div class="two" style="margin-top:12px">
<div class="card" style="margin-bottom:0"><b style="font-size:12px">5 best months</b><table style="margin-top:4px">${rank.slice(0, 5).map((m) => `<tr><td>${mName(m)}</td><td class="pos">${pct0(m.ret)}</td><td class="pos">${spos(m.profit)}</td></tr>`).join('')}</table></div>
<div class="card" style="margin-bottom:0"><b style="font-size:12px">5 worst months</b><table style="margin-top:4px">${rank.slice(-5).reverse().map((m) => `<tr><td>${mName(m)}</td><td class="neg">${pct0(m.ret)}</td><td class="neg">${spos(m.profit)}</td></tr>`).join('')}</table></div>
</div>`);

// 5-8 year by year
const yearCard = (y) => { const ms = y.months, risk = y.start * RISK / 2, tag = y.first ? `${MONL[ms[0].m].slice(0, 3)} – Dec` : y.partial ? `Jan – ${MON[ms.at(-1).m]}` : '';
  return `<div class="card yc"><div class="yhead"><div><span class="big">${y.y}</span>${tag ? `<span class="pill">${tag}</span>` : ''}<span class="pill">${y.green} green · ${y.red} red months</span></div>
<div style="font-size:12px">${peso(y.start)} → <b>${peso(y.end)}</b> &nbsp;<b class="${cls(y.ret)}" style="font-size:16px">${pct(y.ret)}</b></div></div>
${monthBars(ms, y.y)}
<table><tr><th>Month</th><th>Trades</th><th>Fee paid</th><th>Profit / loss</th><th>Month return</th><th>Balance at month end</th></tr>
${ms.map((m) => `<tr><td>${MONL[m.m]}${m.partial ? ` (to ${lastDay})` : ''}</td><td>${m.n}</td><td>${m.fee ? peso(m.fee) : '–'}</td><td class="${cls(m.profit)}">${spos(m.profit)}</td><td class="${cls(m.ret)}">${pct(m.ret)}</td><td>${peso(m.end)}</td></tr>`).join('')}
<tr class="tot"><td>${y.y} total</td><td>${y.n}</td><td>${peso(y.fee)}</td><td>${spos(y.profit)}</td><td>${pct(y.ret)}</td><td>${peso(y.end)}</td></tr></table>
<p class="sub" style="margin:4px 0 0;font-size:10.5px">${y.first ? 'The first trade came in March.' : `Each system started the year with ${peso(y.start / 2)}, so one trade put about ${peso(risk)} of it at risk at the start (2.5%), more as the balance grew.`}${y.partial ? ` The test ends on ${endL}.` : y.first ? '' : ` ${peso(y.end)} carries over to ${y.y + 1}.`}</p></div>`; };
const yp = [[0, 1], [2, 3], [4, 5], [6]];
yp.forEach((ix, n) => page((n === 0 ? `<h2>Year by year, month by month</h2><p class="sub">Each year starts from the previous year's final balance (compounding). Bars show the % gain or loss of each month, after the 20% fee. The bar scale changes from year to year.</p>` : '') + ix.map((i) => yearCard(years[i])).join('')));

// 9 hard parts
const uwPts = (() => { const u = uw.u, out = [], K = (END - Date.UTC(2020, 0, 1) / 1000); let bucket = new Map(); for (const [t, d] of u) { const k = Math.floor((t - Date.UTC(2020, 0, 1) / 1000) / (86400 * 3)); bucket.set(k, Math.max(bucket.get(k) || 0, d)); } return [...bucket].sort((a, b) => a[0] - b[0]).map(([k, d]) => [k * 3 * 86400 + Date.UTC(2020, 0, 1) / 1000, d]); })();
const ddChart = (() => { const x0 = 52, x1 = 664, y0 = 10, yb = 128, top = Math.ceil(uw.dd * 10) / 10, T0 = Date.UTC(2020, 0, 1) / 1000, X = (t) => x0 + ((t - T0) / (END - T0)) * (x1 - x0), Y = (d) => y0 + (d / top) * (yb - y0);
  let g = ''; for (let p = 0; p <= Math.round(top * 10); p += top > 0.5 ? 2 : 1) g += axis(x0, x1, Y(p / 10), p ? MIN + p * 10 + '%' : '0%', p === 0);
  for (let y = 2020; y <= 2026; y++) g += `<text x="${f1(X(Date.UTC(y, 0, 1) / 1000))}" y="144" text-anchor="start" class="ax">${y}</text>`;
  const d = `M${f1(X(uwPts[0][0]))},${y0} ` + uwPts.map(([t, v]) => `L${f1(X(t))},${f1(Y(v))}`).join(' ') + ` L${f1(X(uwPts.at(-1)[0]))},${y0} Z`;
  return `<div class="card"><svg viewBox="0 0 680 150" width="100%">${g}<path d="${d}" fill="rgba(220,38,38,.25)" stroke="#dc2626" stroke-width="1.2"/></svg></div>`; })();
const streaks = []; { let cur = []; for (const m of months) { if (m.ret <= 0) cur.push(m); else { if (cur.length >= 2) streaks.push(cur); cur = []; } } if (cur.length >= 2) streaks.push(cur); }
const streakLoss = (s) => s.reduce((q, m) => q * (1 + m.ret), 1) - 1;
let longest = 0, run = 0; for (const m of months) { run = m.ret <= 0 ? run + 1 : 0; longest = Math.max(longest, run); }
const red = nM - greenM;
const peakVal = at(all.pts, uw.ddPeak), troughVal = at(all.pts, uw.ddAt);
const after = years.find((y) => y.y === 2024);
page(`<h2>The hard parts: losses and drawdowns</h2>
<p class="sub">This page shows the bad stretches so you know what to expect. A <b>drawdown</b> is how far your balance fell below its highest point before it recovered. Figures are for your balance after the 20% fee, measured after every closed trade.</p>
<div class="kpis">${kpi(MIN + (uw.dd * 100).toFixed(1) + '%', 'Deepest drawdown', 'neg')}${kpi(pct(worstM.ret), 'Worst single month', 'neg')}${kpi(longest + ' months', 'Longest red streak')}${kpi(stat.maxLoss, 'Most losing trades in a row')}</div>
<h3>How far below its high your balance was, over time</h3>
${ddChart}
<p class="sub">The deepest drop was <b class="neg">${MIN}${(uw.dd * 100).toFixed(1)}%</b>, from the high in ${monL(uw.ddPeak)} to the low in ${monL(uw.ddAt)}. In pesos it went from ${peso(peakVal)} down to ${peso(troughVal)} before the balance recovered and moved higher.</p>
<h3>Losing months in a row</h3>
${streaks.length ? `<table><tr><th>Period</th><th>Red months</th><th>Combined result</th><th>Months in that streak</th></tr>${streaks.sort((a, b) => streakLoss(a) - streakLoss(b)).slice(0, 6).map((s) => `<tr><td>${MON[s[0].m]} ${s[0].y} – ${MON[s.at(-1).m]} ${s.at(-1).y}</td><td>${s.length}</td><td class="neg">${pct(streakLoss(s))}</td><td>${s.map((m) => MON[m.m]).join(', ')}</td></tr>`).join('')}</table>` : '<p class="sub">There were no two red months in a row.</p>'}
<div class="note warn"><b>Be ready for this.</b> In ${red} of ${nM} months (${Math.round(100 * red / nM)}%) your balance went down. There were stretches of ${stat.maxLoss} losing trades in a row. Someone who stops after a few bad months usually misses the big winning months that follow. The future can also bring a drawdown deeper than anything shown here.</div>`);

// 10 patterns
const byCal = MON.map((_, m) => { const a = months.filter((x) => x.m === m); return { m, avg: a.reduce((q, x) => q + x.ret, 0) / a.length, red: a.filter((x) => x.ret <= 0).length, n: a.length }; });
const qs = [0, 1, 2, 3].map((q) => { const a = months.filter((x) => Math.floor(x.m / 3) === q), t = D.all.closed.filter((t) => { const m = new Date(t.tExit * 1000).getUTCMonth(); return Math.floor(m / 3) === q; });
  return { q, n: a.length, red: a.filter((x) => x.ret <= 0).length, avg: a.reduce((s, x) => s + x.ret, 0) / a.length, win: t.filter((x) => x.R > 0).length / t.length }; });
const weakQ = qs.reduce((a, q) => (q.red / q.n > a.red / a.n ? q : a)), fewQ = qs.reduce((a, q) => (q.red / q.n < a.red / a.n ? q : a));
const qLabel = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];
const calBars = (() => { const x0 = 44, x1 = 672, base = 98, H = 78, step = (x1 - x0) / 12, bw = step * 0.64, mx = Math.max(...byCal.map((b) => Math.abs(b.avg))), S = H / mx;
  let g = `<line x1="${x0}" x2="${x1}" y1="${base}" y2="${base}" stroke="#64748b"/><text x="38" y="${base + 4}" text-anchor="end" class="ax">0%</text>`;
  byCal.forEach((b, i) => { const cx = x0 + step * (i + 0.5), h = Math.max(1, Math.abs(b.avg) * S), pos = b.avg >= 0, al = 1 - 0.55 * (b.red / b.n);
    g += `<rect x="${f1(cx - bw / 2)}" y="${f1(pos ? base - h : base)}" width="${f1(bw)}" height="${f1(h)}" rx="2.5" fill="${pos ? '#15803d' : '#dc2626'}" opacity="${al.toFixed(2)}"/><text x="${f1(cx)}" y="${f1(pos ? base - h - 4 : base + h + 11)}" text-anchor="middle" class="tiny">${pct0(b.avg)}</text><text x="${f1(cx)}" y="118" text-anchor="middle" class="ax b">${MON[i]}</text><text x="${f1(cx)}" y="130" text-anchor="middle" class="ax">${b.red}/${b.n} red</text>`; });
  return `<svg viewBox="0 0 680 136" width="100%">${g}</svg>`; })();
const qy = (y, q) => { const a = months.filter((x) => x.y === y && Math.floor(x.m / 3) === q); return a.length ? a.reduce((p, x) => p * (1 + x.ret), 1) - 1 : null; };
page(`<h2>Patterns: which months and quarters are weaker?</h2>
<p class="sub">Extra statistics on all ${nM} months of the test, grouped by calendar month and by quarter. They show when the losing months tend to happen. Results are after the 20% fee.</p>
<h3>Average result per calendar month</h3>
<p class="sub" style="margin-bottom:4px">Bar = the average % change of that month across all years. Below each month = how many times it ended red. Paler bars had more red years. A few huge months pull some averages up a lot, so read them as a guide, not a rule.</p>
<div class="card">${calBars}</div>
<h3>By quarter</h3>
<div class="two" style="grid-template-columns:repeat(4,1fr);gap:8px">${qs.map((q) => `<div class="card" style="margin-bottom:0;padding:9px 10px${q.q === weakQ.q ? ';border-color:#dc2626' : ''}"><b style="font-size:11.5px">Q${q.q + 1} · ${qLabel[q.q]}${q.q === weakQ.q ? ' · weakest' : q.q === fewQ.q ? ' · fewest reds' : ''}</b><div style="font-size:10.5px;color:#475569;line-height:1.7;margin-top:4px">${q.red} / ${q.n} months red<br>Average month <b class="${cls(q.avg)}">${pct(q.avg)}</b><br>Winning trades <b>${Math.round(q.win * 100)}%</b></div></div>`).join('')}</div>
<h3>Each quarter, each year</h3>
<table class="cal"><tr><th></th>${years.map((y) => `<th>${y.y}</th>`).join('')}</tr>${[0, 1, 2, 3].map((q) => `<tr><td class="yr">Q${q + 1}</td>${years.map((y) => calCell(qy(y.y, q))).join('')}</tr>`).join('')}</table>
<p class="sub" style="margin-top:6px;font-size:11px">2020 starts in March, so its Q1 is only March. Q4 2026 only covers 1 October to ${endL}.</p>`);

// 11 method
page(`<h2>How these numbers were made, and what they leave out</h2>
<div class="card"><b style="font-size:13px">Method</b>
<ul style="margin:6px 0 0;padding-left:18px">
<li><b>The trades.</b> The real trading rules of the two systems, unchanged, replayed on stored 4-hour price candles for five liquid markets from 2020 to ${endL}. Exchange fees, slippage and funding charges are already inside every trade's result.</li>
<li><b>The money.</b> The ₱1,000 is split in half between the two systems. Each trade puts 2.5% of its own system's balance at risk when it opens, and the profit or loss is booked when the trade closes. Trades from all markets share the system's balance, and are processed in time order.</li>
<li><b>The fee.</b> 20% of profit above the investor's best level so far, taken at the end of every even month, and on the last day of data for the last partial month. A loss means no fee, and the best level only moves up.</li>
<li><b>Calendar.</b> A month counts the trades that closed in it. Year tables use a calendar year and carry the balance over. Trades still open at the end of the data are not counted.</li>
</ul></div>
<div class="card"><b style="font-size:13px">What it leaves out</b>
<ul style="margin:6px 0 0;padding-left:18px">
<li><b>Hindsight.</b> The markets and the rule settings were chosen on this same history. Treat the figures as an upper bound, not a forecast.</li>
<li><b>No ceiling on trade size.</b> The test lets each trade grow with the balance. In real trading a cap on how much is risked per trade, and the room that the markets have to take larger orders, would slow growth once the balance is large. The big late-year pesos here would not be reached in the same way.</li>
<li><b>Small accounts.</b> Exchanges sell whole contracts. A ₱1,000 slice of the pool is not traded on its own; it buys part of one pool. The pool's early trades would have been lumpier than shown.</li>
<li><b>Trades open together.</b> Several trades can be open at once and are sized from the same balance, so a real run can fall a little further than shown.</li>
<li><b>Late or skipped trades.</b> Trades the live system skips because margin is short, or enters late, are not modelled.</li>
<li><b>Two systems, one story.</b> A few giant winning trades carry a large part of the result. Take them out and the totals look much smaller.</li>
</ul></div>
<h3>The same trades, two ways to read the years</h3>
<div class="two">
<div class="card" style="margin-bottom:0"><b style="font-size:12px">Compounded (left in since 2020)</b>
<table style="margin-top:4px"><tr><th>Year</th><th>Start</th><th>End</th><th>Return</th></tr>${years.map((y) => `<tr><td><b>${y.y}</b></td><td>${peso(y.start)}</td><td>${peso(y.end)}</td><td class="${cls(y.ret)}">${pct0(y.ret)}</td></tr>`).join('')}
<tr class="tot"><td>${years.length} years</td><td>₱1,000</td><td>${peso(final)}</td><td class="pos">${pct0(final / 1000 - 1)}</td></tr></table></div>
<div class="card" style="margin-bottom:0"><b style="font-size:12px">Fresh ₱1,000 each year (not compounded)</b>
<table style="margin-top:4px"><tr><th>Year</th><th>Start</th><th>End</th><th>Return</th></tr>${fresh.map((y) => `<tr><td><b>${y.y}</b></td><td>₱1,000</td><td>${peso(y.end)}</td><td class="${cls(y.end - 1000)}">${pct0(y.end / 1000 - 1)}</td></tr>`).join('')}
<tr class="tot"><td>Average</td><td>₱1,000</td><td>${peso(fresh.reduce((q, y) => q + y.end, 0) / fresh.length)}</td><td class="pos">${pct0(fresh.reduce((q, y) => q + y.end / 1000 - 1, 0) / fresh.length)}</td></tr></table></div>
</div>
<p class="sub" style="margin-top:6px">The right-hand side is the easier one to picture: put ₱1,000 in on January 1, take it out on December 31, and that is what you would have had. The left shows what happens when you leave the profit in year after year. Neither is a promise.</p>
<div class="note warn"><b>This is a test on past prices, not a promise.</b> Real results will differ, and you can lose a large part or all of the money you put in. Only use money you can afford to lose. A ₱10,000 start would show every peso figure ×10, and the percentages stay the same.</div>`);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>What ₱1,000 Could Have Become · Lucid'io</title><style>${css}</style></head><body><a class="dlbtn" href="backtest-data.pdf" download>Download PDF</a>
${pages.map((p, i) => `<div class="page" id="p${i + 1}">\n${p}\n${foot(i)}</div>`).join('\n')}
</body></html>`;
writeFileSync(OUT, html);
console.log(`wrote ${OUT} · ${pages.length} pages · ${(html.length / 1024).toFixed(0)} KB`);
