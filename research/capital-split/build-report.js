// build-report.js — writes 🔴LEDGER/reports/capital-split.html from study.json (same page style as backtest-data.html).
//   node study.js && node build-report.js
'use strict';
const fs = require('fs'), path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'study.json'), 'utf8'));
const OUT = path.join(__dirname, '..', '..', '..', '🔴LEDGER', 'reports', 'capital-split.html');
const M = D.methods, O = M.own;
const MINUS = '−', pc = (v, d = 0) => (v > 0.00001 ? '+' : v < -0.00001 ? MINUS : '') + Math.abs(v * 100).toFixed(d) + '%';
const pcu = (v, d = 0) => Math.abs(v * 100).toFixed(d) + '%';
const fall = (v) => MINUS + (v * 100).toFixed(1) + '%';
const cls = (v) => (v > 0.00001 ? 'pos' : v < -0.00001 ? 'neg' : 'flat');
const peso = (v) => '₱' + Math.round(v).toLocaleString('en-US');
const ck = '<span class="best">✓</span> ';
const COL = { own: '#64748b', reb2: '#0891b2', reb3: '#1d4ed8', sharedCap: '#dc2626', sharedTop: '#7c3aed', sharedReb3: '#15803d' };
const SHORT = { own: 'Own account (today)', reb2: 'Rebalance every 2 mo', reb3: 'Rebalance every 3 mo', sharedCap: 'Shared, no transfers', sharedTop: 'Shared + instant top-ups', sharedReb3: 'Shared + rebalance 3 mo' };
const ORDER = ['own', 'reb2', 'reb3', 'sharedCap', 'sharedTop', 'sharedReb3'];
const BOTC = ['#1d4ed8', '#f59e0b', '#15803d'];

// ---------- best-value check marks: dir 1 = higher is better, -1 = lower is better
function marks(ids, val, dir) { const v = ids.map(val), b = dir > 0 ? Math.max(...v) : Math.min(...v); return (id) => (Math.abs(val(id) - b) < 1e-9 ? ck : ''); }

// ---------- charts
const W = 680;
function lineChart({ series, labels, h = 250, log = false, yfmt, title, ymin, ymax, band, step }) {
  const L = 52, R = 12, T = 14, B = 26, iw = W - L - R, ih = h - T - B, n = labels.length;
  const all = series.flatMap((s) => s.v);
  let lo = ymin ?? Math.min(...all), hi = ymax ?? Math.max(...all);
  const f = log ? Math.log10 : (x) => x;
  const flo = f(lo), fhi = f(hi), x = (i) => L + (i / (n - 1)) * iw, y = (v) => T + ih - ((f(v) - flo) / (fhi - flo)) * ih;
  let g = `<svg viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="${title || ''}">`;
  // grid
  const ticks = [];
  if (log) { for (let e = Math.floor(flo); e <= Math.ceil(fhi); e++) for (const m of [1, 3]) { const v = m * 10 ** e; if (v >= lo && v <= hi) ticks.push(v); } }
  else { const st = step || (hi - lo) / 4; for (let v = lo; v <= hi + 1e-9; v += st) ticks.push(v); }
  for (const t of ticks) g += `<line x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="#e2e8f0"/><text class="ax" x="${L - 6}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end">${yfmt(t)}</text>`;
  labels.forEach((l, i) => { if (l.endsWith('-01')) g += `<line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${T}" y2="${T + ih}" stroke="#f1f5f9"/><text class="ax" x="${x(i).toFixed(1)}" y="${h - 8}" text-anchor="middle">${l.slice(0, 4)}</text>`; });
  if (band) g += band(x, y, T, ih);
  for (const s of series) {
    const d = s.v.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Math.max(lo, Math.min(hi, v))).toFixed(1)}`).join('');
    g += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.w || 2}" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
  }
  return g + '</svg>';
}
function legend(items) { return `<div class="legend">${items.map(([c, t, dash]) => `<span><span class="sw" style="background:${dash ? 'repeating-linear-gradient(90deg,' + c + ' 0 5px,transparent 5px 8px)' : c}"></span>${t}</span>`).join('')}</div>`; }
function barChart({ groups, series, h = 220, yfmt, zero = 0, ymin, ymax, ref }) {
  const L = 44, R = 10, T = 14, B = 40, iw = W - L - R, ih = h - T - B;
  const all = groups.flatMap((g) => series.map((s) => g.v[s.id]));
  const lo = ymin ?? Math.min(zero, ...all), hi = ymax ?? Math.max(zero, ...all);
  const y = (v) => T + ih - ((v - lo) / (hi - lo)) * ih, gw = iw / groups.length, bw = Math.min(22, (gw - 16) / series.length);
  let g = `<svg viewBox="0 0 ${W} ${h}" width="100%">`;
  for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) * i) / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e2e8f0"/><text class="ax" x="${L - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${yfmt(v)}</text>`; }
  if (ref != null) g += `<line x1="${L}" x2="${W - R}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}" stroke="#0f172a" stroke-dasharray="4 3"/><text class="tiny" x="${W - R}" y="${(y(ref) - 4).toFixed(1)}" text-anchor="end">today = ${yfmt(ref)}</text>`;
  g += `<line x1="${L}" x2="${W - R}" y1="${y(zero).toFixed(1)}" y2="${y(zero).toFixed(1)}" stroke="#94a3b8"/>`;
  groups.forEach((gr, gi) => {
    const x0 = L + gi * gw + (gw - bw * series.length) / 2;
    series.forEach((s, si) => { const v = gr.v[s.id], x = x0 + si * bw, y0 = y(Math.max(zero, v)), y1 = y(Math.min(zero, v));
      g += `<rect x="${(x + 1).toFixed(1)}" y="${y0.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(0.5, y1 - y0).toFixed(1)}" rx="2" fill="${s.c}"/>`;
      g += `<text class="tiny" x="${(x + bw / 2).toFixed(1)}" y="${(v >= zero ? y0 - 3 : y1 + 9).toFixed(1)}" text-anchor="middle" style="font-size:8px">${yfmt(v)}</text>`; });
    g += `<text class="ax b" x="${(L + gi * gw + gw / 2).toFixed(1)}" y="${h - 22}" text-anchor="middle">${gr.label}</text>`;
    if (gr.sub) g += `<text class="ax" x="${(L + gi * gw + gw / 2).toFixed(1)}" y="${h - 9}" text-anchor="middle">${gr.sub}</text>`;
  });
  return g + '</svg>';
}
function stackChart(shares, labels, h = 190, title) {
  const L = 40, R = 12, T = 12, B = 24, iw = W - L - R, ih = h - T - B, n = shares.length, x = (i) => L + (i / (n - 1)) * iw, y = (v) => T + ih - v * ih;
  let g = `<svg viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="${title}">`;
  const cum = shares.map((s) => [0, s[0], s[0] + s[1], 1]);
  for (let k = 0; k < 3; k++) {
    const top = cum.map((c, i) => `${x(i).toFixed(1)},${y(c[k + 1]).toFixed(1)}`), bot = cum.map((c, i) => `${x(i).toFixed(1)},${y(c[k]).toFixed(1)}`).reverse();
    g += `<polygon points="${top.concat(bot).join(' ')}" fill="${BOTC[k]}" opacity=".85"/>`;
  }
  for (const v of [0, 0.25, 0.5, 0.75, 1]) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#fff" stroke-opacity=".5"/><text class="ax" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v * 100}%</text>`;
  labels.forEach((l, i) => { if (l.endsWith('-01')) g += `<text class="ax" x="${x(i).toFixed(1)}" y="${h - 7}" text-anchor="middle">${l.slice(0, 4)}</text>`; });
  g += `<line x1="${L}" x2="${W - R}" y1="${y(0.5)}" y2="${y(0.5)}" stroke="#0f172a" stroke-dasharray="4 3"/><line x1="${L}" x2="${W - R}" y1="${y(0.75)}" y2="${y(0.75)}" stroke="#0f172a" stroke-dasharray="4 3"/>`;
  return g + '</svg>';
}
const uw = (vals) => { let pk = 1000; return vals.map((v) => { pk = Math.max(pk, v); return -(1 - v / pk); }); };

// ---------- numbers used in the text
const F = (id) => M[id].full, rel = (id) => F(id).final / F('own').final - 1;
const ownEnd = F('own').shares[F('own').shares.length - 1], ownMinT = Math.min(...F('own').shares.map((s) => s[2]));
const ownMinTAt = D.monthLabels[F('own').shares.findIndex((s) => s[2] === ownMinT)];
const pick = 'sharedReb3';
const labels = D.monthLabels;

// ---------- pages
const foot = (n) => `<div class="foot"><span>Lucid'io · research study · Nov 19, 2026 · backtest, not a promise of future results</span><span>${n} / 5</span></div>`;

const p1 = `<div class="page">
<div class="cover-band"><div class="tag">Research study · three bots · Jan 2020 to Nov 2026</div>
<h1>How the Three Bots Should Size Their Trades</h1>
<p class="sub">Today each bot risks 2.5% of its own sub-account. Would it be better if each bot read all three sub-accounts as one total? Checked on ${D.trades.toLocaleString()} backtest trades (rules v3, live coins), with the bots' real margin limits.</p></div>
<div class="kpis">
<div class="kpi"><div class="k">Best practical option</div><div class="v" style="font-size:17px;line-height:1.25">Shared sizing + rebalance every 3 months</div></div>
<div class="kpi"><div class="k">Deepest fall</div><div class="v"><span class="neg">${fall(F('own').dd)}</span> → <span class="pos">${fall(F(pick).dd)}</span></div><div class="k">today → best</div></div>
<div class="kpi"><div class="k">Histories with a 60%+ fall</div><div class="v"><span class="neg">${pcu(O.boot.dd60)}</span> → <span class="pos">${pcu(M[pick].boot.dd60, 1)}</span></div><div class="k">of 1,000 reshuffles</div></div>
<div class="kpi"><div class="k">More money (full history)</div><div class="v pos">${pc(rel(pick))}</div><div class="k">vs today, same trades</div></div>
</div>
<h3>The three ways to size a trade</h3>
<div class="steps">
<div class="step"><div class="n">1</div><b>Own account (today)</b><p>Each bot risks 2.5% of <b>its own</b> sub-account. A winning bot grows its share, a losing bot shrinks. The 50/25/25 split drifts.</p></div>
<div class="step"><div class="n">2</div><b>Rebalance</b><p>Same as today, but every few months free cash is moved between the sub-accounts to put them back to 50/25/25.</p></div>
<div class="step"><div class="n">3</div><b>Shared sizing</b><p>Each bot reads <b>all three</b> balances as one total and risks 2.5% × total × its weight. <b>The accounts stay separate</b>, so two bots can still hold the same coin at the same time.</p></div>
</div>
<div class="note"><b>What shared sizing is, in one line:</b> it is like rebalancing before every single trade, without moving money. Only the number the bot sizes from is shared. The cash still sits in each bot's own sub-account, and each trade's margin must fit there.</div>
<h3>Scorecard <span class="pill">✓ = best in the column</span></h3>
${(() => { const ids = ORDER, mk = [
    marks(ids, (i) => F(i).final, 1), marks(ids, (i) => -F(i).dd, 1), marks(ids, (i) => M[i].roll12.beats, 1), marks(ids, (i) => M[i].roll24.beats, 1), marks(ids, (i) => M[i].boot.med, 1), marks(ids, (i) => -M[i].boot.dd60, 1)];
  return `<table><tr><th>Method</th><th>Money vs today</th><th>Deepest fall</th><th>Beats today, 1-yr starts</th><th>Beats today, 2-yr starts</th><th>Reshuffles: median vs today</th><th>Histories with 60%+ fall</th></tr>` +
  ids.map((i) => `<tr${i === pick ? ' class="pickrow"' : ''}><td><span class="sw" style="background:${COL[i]}"></span>${SHORT[i]}${i === pick ? ' <span class="pill pickpill">pick</span>' : ''}</td><td class="${cls(rel(i))}">${mk[0](i)}${i === 'own' ? '–' : pc(rel(i))}</td><td>${mk[1](i)}${fall(F(i).dd)}</td><td>${i === 'own' ? '–' : mk[2](i) + pcu(M[i].roll12.beats)}</td><td>${i === 'own' ? '–' : mk[3](i) + pcu(M[i].roll24.beats)}</td><td class="${cls(M[i].boot.med)}">${i === 'own' ? '–' : mk[4](i) + pc(M[i].boot.med)}</td><td>${mk[5](i)}${pcu(M[i].boot.dd60, 1)}</td></tr>`).join('') + '</table>'; })()}
<p class="sub" style="margin-top:8px">"Beats today" = the share of start months (or reshuffled histories) where the method ended with more money than the own-account way on the same trades. Above 50% means it wins more often than it loses.</p>
<div class="note">Instant top-ups collect the most ✓, but they need automatic transfers between MEXC sub-accounts whenever a trade does not fit. <b>The pick</b> gets nearly the same result (same smallest fall, ✓ on 2-year starts) with only a manual move every 3 months. Shared sizing with no transfers looks fine on falls but skips trades and loses money (red row).</div>
${foot(1)}</div>`;

const shownG = ['own', 'reb3', 'sharedReb3', 'sharedTop'];
const p2 = `<div class="page">
<h2>₱1,000 from Jan 2020: how far ahead of today</h2>
<p class="sub">Each line = that method's money divided by the own-account way's money on the same date. Above 0% = ahead of today. Same trades, 2.5% risk, 20% fee every 2 months.</p>
<div class="card">${lineChart({ series: shownG.map((i) => ({ v: F(i).monthly.map((v, k) => v / F('own').monthly[k] - 1), c: COL[i], dash: i === 'sharedTop', w: i === pick ? 2.6 : 1.8 })), labels, h: 240, yfmt: (v) => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(Math.round(v * 100)) + '%', ymin: -0.4, ymax: 0.6, step: 0.2, title: 'vs today' })}
${legend(shownG.map((i) => [COL[i], SHORT[i] + ': ends at ' + peso(F(i).final), i === 'sharedTop']))}
<p class="sub" style="margin:6px 0 0">The amounts are this large because 2.5% risk compounds for 7 years with no cap (the live bots lower risk above $500); compare the lines, not the size.</p></div>
<h3>How far it fell from its last high (month ends)</h3>
<div class="card">${lineChart({ series: ['own', 'reb3', 'sharedReb3'].map((i) => ({ v: uw(F(i).monthly), c: COL[i], w: i === pick ? 2.4 : 1.6 })), labels, h: 170, yfmt: (v) => Math.round(v * 100) + '%', ymin: -0.6, ymax: 0, step: 0.2, title: 'drawdown' })}
${legend(['own', 'reb3', 'sharedReb3'].map((i) => [COL[i], SHORT[i] + ': deepest ' + fall(F(i).dd)]))}</div>
<h3>Year by year (after the fee)</h3>
${(() => { const ys = Object.keys(F('own').years); const ids = ['own', 'reb3', 'sharedReb3', 'sharedTop'];
  return `<table><tr><th>Year</th>${ids.map((i) => `<th>${SHORT[i]}</th>`).join('')}</tr>` + ys.map((y) => { const mk = marks(ids, (i) => F(i).years[y], 1);
    return `<tr><td>${y}${y === '2026' ? ' (to Nov 12)' : ''}</td>${ids.map((i) => `<td class="${cls(F(i).years[y])}">${mk(i)}${pc(F(i).years[y])}</td>`).join('')}</tr>`; }).join('') + '</table>'; })()}
<div class="note">The lines run close together until 2023. The gap opens in <b>2024</b>, when T-CORE made +${D.bots[2].yearR[2024]}R. With the own-account way, T-CORE had shrunk to ${pcu(ownMinT)} of the money by ${ownMinTAt} after a weak 2022-23, so that run barely moved the total.</div>
${foot(2)}</div>`;

const p3 = `<div class="page">
<h2>Why sharing the sizing helps</h2>
<p class="sub">The bots take turns being the best one. When each bot only grows its own account, the money piles into whichever bot had the last good run.</p>
<h3>Own account (today): who holds the money</h3>
<div class="card">${stackChart(F('own').shares, labels, 180, 'own account split')}
${legend([[BOTC[0], 'BB-CORE (target 50%)'], [BOTC[1], 'I-CORE (25%)'], [BOTC[2], 'T-CORE (25%)']])}
<p class="sub" style="margin:6px 0 0">Dashed lines = the 50/25/25 target. At the end of the backtest the split is ${ownEnd.map((v) => Math.round(v * 100)).join('/')}.</p></div>
<h3>Shared sizing + rebalance every 3 months: who holds the money</h3>
<div class="card">${stackChart(F(pick).shares, labels, 150, 'shared split')}
<p class="sub" style="margin:6px 0 0">The cash is pulled back to 50/25/25 every 3 months, so every trade is sized from the whole pool.</p></div>
<div class="two">
<div><h3>Each bot, R per year</h3>
<table><tr><th>Year</th>${D.bots.map((b) => `<th>${b.name}</th>`).join('')}</tr>${Object.keys(D.bots[0].yearR).map((y) => { const mk = marks([0, 1, 2], (k) => D.bots[k].yearR[y], 1); return `<tr><td>${y}</td>${D.bots.map((b, k) => `<td>${mk(k)}${b.yearR[y]}</td>`).join('')}</tr>`; }).join('')}</table></div>
<div><h3>How much the bots move together</h3>
<table><tr><th></th>${D.bots.map((b) => `<th>${b.name}</th>`).join('')}</tr>${D.bots.map((b) => `<tr><td>${b.name}</td>${b.corr.map((c, j) => `<td class="${j === D.bots.indexOf(b) ? 'flat' : Math.abs(c) < 0.3 ? 'pos' : 'neg'}">${c.toFixed(2)}</td>`).join('')}</tr>`).join('')}</table>
<p class="sub" style="margin-top:6px">Monthly R, 1.00 = always together, 0 = unrelated. <span class="pos">Green</span> = good for spreading risk. BB-CORE is unrelated to the other two, so its good months often land on their bad ones.</p>
<table style="margin-top:6px"><tr><th>Bot</th><th>Avg R / month</th><th>Swing</th><th>Losing months</th></tr>${D.bots.map((b) => `<tr><td>${b.name}</td><td>${b.avgR.toFixed(1)}</td><td>${b.sd.toFixed(1)}</td><td>${b.lossMonths}/${labels.length}</td></tr>`).join('')}</table></div>
</div>
${foot(3)}</div>`;

const testIds = ['reb3', 'sharedCap', 'sharedTop', 'sharedReb3'];
const p4 = `<div class="page">
<h2>Four tests, so luck does not decide</h2>
<p class="sub">One history can flatter any method. Each method was run on: the full history, each half on its own, every possible start month (held 1 and 2 years), and 1,000 reshuffled 7-year histories built from random 6-month blocks of the real trades.</p>
<h3>How often it beats today (above 50% = wins more often than it loses)</h3>
<div class="card">${barChart({ groups: [{ label: '1-year starts', sub: M.own.roll12.n + ' starts', v: Object.fromEntries(testIds.map((i) => [i, M[i].roll12.beats])) }, { label: '2-year starts', sub: M.own.roll24.n + ' starts', v: Object.fromEntries(testIds.map((i) => [i, M[i].roll24.beats])) }, { label: 'Reshuffles', sub: '1,000 histories', v: Object.fromEntries(testIds.map((i) => [i, M[i].boot.beats])) }],
  series: testIds.map((i) => ({ id: i, c: COL[i] })), yfmt: (v) => Math.round(v * 100) + '%', ymin: 0, ymax: 0.8, ref: 0.5, h: 210 })}
${legend(testIds.map((i) => [COL[i], SHORT[i]]))}</div>
<h3>How deep the bad falls get (1,000 reshuffles)</h3>
<div class="card">${barChart({ groups: [{ label: 'Typical deepest fall', sub: 'median', v: Object.fromEntries(['own', ...testIds].map((i) => [i, M[i].boot.ddMed])) }, { label: 'Bad-luck deepest fall', sub: '1 in 10 histories', v: Object.fromEntries(['own', ...testIds].map((i) => [i, M[i].boot.ddP90])) }, { label: 'Histories with a 60%+ fall', sub: 'share of 1,000', v: Object.fromEntries(['own', ...testIds].map((i) => [i, M[i].boot.dd60])) }],
  series: ['own', ...testIds].map((i) => ({ id: i, c: COL[i] })), yfmt: (v) => Math.round(v * 100) + '%', ymin: 0, ymax: 0.8, h: 210 })}
${legend(['own', ...testIds].map((i) => [COL[i], SHORT[i]]))}</div>
<h3>All tests, money vs today <span class="pill">✓ = best in the column</span></h3>
${(() => { const ids = ['reb2', 'reb3', 'sharedCap', 'sharedTop', 'sharedReb3'];
  const cols = [['Full history', (i) => rel(i)], ['2020-22 only', (i) => M[i].halves.h1.final / O.halves.h1.final - 1], ['2023-26 only', (i) => M[i].halves.h2.final / O.halves.h2.final - 1], ['1-yr starts, median', (i) => M[i].roll12.med], ['2-yr starts, median', (i) => M[i].roll24.med], ['Reshuffles, median', (i) => M[i].boot.med], ['Reshuffles, bad luck (1 in 10)', (i) => M[i].boot.p10]];
  const mk = cols.map(([, f]) => marks(ids, f, 1));
  return `<table><tr><th>Method</th>${cols.map(([h]) => `<th>${h}</th>`).join('')}</tr>` + ids.map((i) => `<tr${i === pick ? ' class="pickrow"' : ''}><td><span class="sw" style="background:${COL[i]}"></span>${SHORT[i]}</td>${cols.map(([, f], c) => `<td class="${cls(f(i))}">${mk[c](i)}${pc(f(i))}</td>`).join('')}</tr>`).join('') + '</table>'; })()}
<p class="sub" style="margin-top:6px">Every method loses to today in 2020-22 alone and wins in 2023-26. The money gain depends on which bot runs hot and when, so it is small and uncertain. The smaller falls show up in every test.</p>
${foot(4)}</div>`;

const p5 = `<div class="page">
<h2>What is best after all</h2>
<div class="note" style="border-left-color:#15803d;background:#f0fdf4;font-size:12.5px"><b>Pick: shared sizing + rebalance every 3 months.</b> Each bot sizes from the total of all three sub-accounts × its weight (50/25/25), and every 3 months free cash is moved back to 50/25/25. The accounts stay separate, so the same coin can still be open on two bots.</div>
<table class="txt"><tr><th>Rank</th><th>Option</th><th>Why</th><th>What it needs</th></tr>
<tr class="pickrow"><td>1 ✓</td><td><b>Shared sizing + rebalance every 3 months</b></td><td>Smallest fall (${fall(F(pick).dd)}), beats today in ${pcu(M[pick].roll12.beats)} of 1-year and ${pcu(M[pick].roll24.beats)} of 2-year starts, ${pc(rel(pick))} money. Margin almost never short (${F(pick).shrunk} trades made smaller in 7 years, none skipped).</td><td>Bot change: read all three balances. Transfers stay a manual job every 3 months (${F(pick).transfers} in 7 years).</td></tr>
<tr><td>2</td><td>Shared sizing + instant top-ups</td><td>Slightly better reshuffles (median ${pc(M.sharedTop.boot.med)}), same smallest fall.</td><td>Bot change + automatic transfers between MEXC sub-accounts whenever a trade does not fit (${F('sharedTop').topups} times in 7 years). More moving parts for a small extra.</td></tr>
<tr><td>3</td><td>Rebalance every 3 months (no code)</td><td>Same money in the full history (${pc(rel('reb3'))}) and fall ${fall(F('reb3').dd)}, but it wins only ${pcu(M.reb3.roll12.beats)} of 1-year and ${pcu(M.reb3.roll24.beats)} of 2-year starts.</td><td>Nothing but the transfers. <b>Good first step while the code change is built.</b></td></tr>
<tr><td>4</td><td>Own account (today)</td><td>Deepest falls (${fall(F('own').dd)}); ${pcu(O.boot.dd60)} of reshuffled histories fall 60%+.</td><td>Nothing.</td></tr>
<tr><td>✗</td><td>Shared sizing with no transfers</td><td><span class="neg">Do not do this.</span> The small accounts run out of margin: ${F('sharedCap').skipped} trades skipped and ${F('sharedCap').shrunk} made smaller. Median ${pc(M.sharedCap.boot.med)} vs today in reshuffles.</td><td>—</td></tr>
</table>
<h3>Why the pick, in plain words</h3>
<ul>
<li><b>Yes, shared sizing is better than each bot using only its own account</b>, but only when the cash follows the sizing. Without transfers, a bot that sizes from the big total but holds little cash cannot open its trades.</li>
<li><b>The sure gain is smaller falls.</b> In bad-luck histories, a 60%+ fall goes from ${pcu(O.boot.dd60)} of histories to ${pcu(M[pick].boot.dd60, 1)}. That holds in every test.</li>
<li><b>The extra money is real but small and uncertain.</b> Medians are ${pc(M[pick].roll12.med, 1)} (1 year) to ${pc(M[pick].boot.med)} (7-year reshuffles), and 2020-22 alone was ${pc(M[pick].halves.h1.final / O.halves.h1.final - 1)}.</li>
<li><b>Shared sizing beats plain rebalancing in short windows</b> (${pcu(M[pick].roll24.beats)} vs ${pcu(M.reb3.roll24.beats)} of 2-year starts), because every trade is sized right between rebalances, not only right after one.</li>
<li><b>Keep 50/25/25.</b> The weights were not changed in this study.</li>
</ul>
<h3>Suggested order</h3>
<div class="steps">
<div class="step"><div class="n">1</div><b>Now</b><p>Rebalance the three sub-accounts to 50/25/25 every 3 months, free cash only (not money held as margin in open trades).</p></div>
<div class="step"><div class="n">2</div><b>Next</b><p>Change each bot to size from the total of all three balances × its weight. Paper-test it first.</p></div>
<div class="step"><div class="n">3</div><b>Keep</b><p>Rebalance every 3 months so the cash matches the sizing. No instant transfers needed.</p></div>
</div>
<h3>How this was tested</h3>
<ul class="sub" style="font-size:11px;color:#334155">
<li>${D.trades.toLocaleString()} trades: ${D.perBot.map((b) => `${b.name} ${b.n.toLocaleString()} (${b.R}R)`).join(', ')}. Rules v3, each bot on its live coins, Binance 4h, Jan 2020 to Nov 12 2026, fees, slippage and funding included.</li>
<li>2.5% risk per trade, 20% fee on new profit every 2 months, money counted when a trade closes. Margin as the live bots size it: isolated, leverage set so liquidation is about 2× the stop, max 20×. A trade that does not fit the account's free cash is made smaller; with no free cash it is skipped.</li>
<li>Rebalancing moves free cash only, never margin locked in open trades. MEXC sub-account transfers are free.</li>
<li>Not modelled: the bots' lower risk above $500 and $1,000, minimum contract sizes. Hindsight applies: the rules and coins were picked on this same history.</li>
<li>Run: <code>node research/capital-split/study.js</code> then <code>node build-report.js</code> (StrategyBacktester).</li>
</ul>
${foot(5)}</div>`;

const css = fs.readFileSync(path.join(__dirname, '..', '..', '..', '🔴LEDGER', 'reports', 'backtest-data.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1].replace(/^.*\.dlbtn.*$/gm, '').replace(/\}\s*\}(?=\s*@media screen and \(max-width)/, '}');   // drop the download button and the stray brace it leaves (it would kill the phone rules)
const extra = `
.best{display:inline-block;background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:4px;padding:0 4px;font-weight:700;font-size:10px;line-height:1.4;margin-right:2px}
table.txt th,table.txt td{text-align:left !important}
table:not(.cal) tr.pickrow td{background:#f0fdf4 !important;font-weight:600}
.pickpill{background:#15803d;color:#fff}
.kpi .v .pos,.kpi .v .neg{font-size:inherit}
code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:10.5px}
@media screen and (max-width:760px){table{font-size:10px}th,td{padding:4px 4px}.kpi .v{font-size:18px}.page>table,.page .card,.page>div>table{display:block;overflow-x:auto}}
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>How the Three Bots Should Size Their Trades · Lucid'io</title><style>${css}${extra}</style></head><body>
${p1}${p2}${p3}${p4}${p5}
</body></html>`;
fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1024).toFixed(0) + ' KB');
