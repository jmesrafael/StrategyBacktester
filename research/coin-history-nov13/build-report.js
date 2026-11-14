// build-report.js — writes the coin history study (history.json) as a ledger report: A4 pages, same look as the other ledger reports.
//   node history.js && node build-report.js  -> ../../../🔴LEDGER/reports/coin-history-2020.html + entry in reports/index.json
'use strict';
const fs = require('fs'), path = require('path');
const LEDGER = path.join(__dirname, '..', '..', '..', '🔴LEDGER', 'reports');
const H = JSON.parse(fs.readFileSync(path.join(__dirname, 'history.json'), 'utf8'));
const CSS = fs.readFileSync(path.join(LEDGER, 'live-pair-vs-three-bot.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1]; // shared look of the ledger reports
const DATE = 'Nov 13, 2026', TITLE = 'Our Coins Since 2020', SLUG = 'coin-history-2020';
const COL = { SOL: '#7c3aed', ZEC: '#c2410c', NEAR: '#0f766e', ADA: '#1d4ed8', GALA: '#db2777', ARB: '#0891b2', ETH: '#334155', SUI: '#65a30d' };
const BOTDESC = { 'BB-CORE': 'Bollinger close-through + SMA200, stop at the middle band, 48-candle time exit', 'I-CORE': 'Ichimoku cloud break + SMA200, 2 ATR stop, 7 ATR trailing stop', 'T-CORE': 'BB-CORE entry, 2 ATR stop, 14 ATR trailing stop (rides long trends)' };
const YRS = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const f = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
const pc = (v, d = 0) => (v * 100).toFixed(d) + '%';
const cls = (v) => (v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'flat');
const tdv = (v, d = 1, x = '') => `<td class="${cls(v)}${x}">${f(v, d)}</td>`;
let page = 0;
const foot = () => `<div class="foot"><span>Lucid'io · ${TITLE} · ${DATE}</span><span>A test on past prices, not a promise · page @@PAGE@@</span></div>`;
const heat = (v, max) => { if (!v) return '#f8fafc'; const a = Math.min(1, Math.sqrt(Math.abs(v) / max)); return v > 0 ? `rgba(21,128,61,${(0.12 + a * 0.78).toFixed(2)})` : `rgba(220,38,38,${(0.12 + a * 0.7).toFixed(2)})`; };
const ink = (v, max) => (Math.sqrt(Math.abs(v) / max) > 0.55 ? '#fff' : '#0f172a');
const yearsUp = (s) => Object.values(s.years).filter((y) => y.R > 0).length;

// ---- per coin verdict, judged against its own bot (owner's rule: stability over luck)
function verdict(s, bot) {
  const lost = Object.entries(s.years).filter(([, v]) => v.R < 0).map(([y]) => y);
  const luck = s.top5Share != null && s.top5Share > 1; // the 5 best trades made more than the whole total
  const pfBar = bot === 'BB-CORE' ? 1.6 : 2.1;
  let label, tone;
  if (s.R > 0 && lost.length <= 1 && s.pf >= pfBar && s.last12.R > 0) { label = 'Strong'; tone = 'ok'; }
  else if (s.R > 0 && lost.length <= 1 && s.last12.R >= 0) { label = 'Solid'; tone = 'ok'; }
  else if (s.R > 0 && s.last12.R >= 0) { label = 'Mixed'; tone = 'mid'; }
  else { label = 'Watch'; tone = 'bad'; }
  return { label, tone, lost, luck };
}
const chip = (v) => `<span class="vchip ${v.tone}">${v.label}</span>`;

// ---- monthly helpers
const ymLabel = (k) => MON[+k.slice(5) - 1] + ' ' + k.slice(0, 4);
function monthStats(s) {
  const m = Object.entries(s.months), vals = m.map(([, v]) => v[0]);
  const best = m.reduce((a, b) => (b[1][0] > a[1][0] ? b : a)), worst = m.reduce((a, b) => (b[1][0] < a[1][0] ? b : a));
  const sorted = [...vals].sort((a, b) => a - b);
  return { n: m.length, up: m.filter(([, v]) => v[0] > 0).length, down: m.filter(([, v]) => v[0] < 0).length, idle: m.filter(([, v]) => !v[1]).length, best, worst, med: sorted[sorted.length >> 1] };
}

// ---- cumulative R chart, one line per coin + the lineup (thick)
function chart(bot) {
  const b = H.bots[bot], coins = Object.keys(b.coins), keys = Object.keys(b.lineup.months);
  const series = coins.map((c) => { let s = 0; return keys.map((k) => (b.coins[c].months[k] ? (s += b.coins[c].months[k][0]) : s)); });
  let s = 0; const tot = keys.map((k) => (s += b.lineup.months[k][0]));
  const w = 760, h = 250, l = 46, r = 104, t = 12, bt = 26, max = Math.ceil(Math.max(...tot) / 100) * 100, min = Math.floor(Math.min(0, ...series.flat()) / 50) * 50;
  const X = (i) => l + (i / (keys.length - 1)) * (w - l - r), Y = (v) => t + (1 - (v - min) / (max - min)) * (h - t - bt);
  const line = (p, c, sw) => `<polyline fill="none" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round" points="${p.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/>`;
  const step = max > 600 ? 200 : 100; let g = '';
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? '#94a3b8' : '#e2e8f0'}"/><text class="ax" x="${l - 6}" y="${Y(v) + 3}" text-anchor="end">${v}R</text>`;
  keys.forEach((k, i) => { if (k.endsWith('-01')) g += `<text class="ax" x="${X(i)}" y="${h - 8}" text-anchor="middle">${k.slice(0, 4)}</text><line x1="${X(i)}" x2="${X(i)}" y1="${h - bt}" y2="${h - bt + 4}" stroke="#94a3b8"/>`; });
  const ends = coins.map((c, i) => ({ c, v: series[i].at(-1), y: Y(series[i].at(-1)) })).sort((a, b) => a.y - b.y); // end labels, nudged apart
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11;
  const lab = ends.map((e) => `<text class="tiny" x="${w - r + 6}" y="${e.y + 3}" style="fill:${COL[e.c]};font-weight:700">${e.c} ${f(e.v, 0)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${bot} cumulative R by coin, 2020 to 2026">${g}${series.map((p, i) => line(p, COL[coins[i]], 1.6)).join('')}${line(tot, '#0f172a', 2.8)}<text class="lbl" x="${w - r + 6}" y="${Math.min(Y(tot.at(-1)), ends[0].y - 12) + 4}">All ${f(tot.at(-1), 0)}R</text>${lab}</svg>`;
}

// ---- big monthly calendar (lineup), numbers in cells
function calendar(s, max) {
  const rows = YRS.map((y) => { let tot = 0, any = false; const cells = MON.map((_, i) => { const k = `${y}-${String(i + 1).padStart(2, '0')}`, v = s.months[k];
      if (!v) return '<td class="na"></td>'; any = true; tot += v[0];
      return `<td style="background:${heat(v[0], max)};color:${ink(v[0], max)}" title="${ymLabel(k)}: ${f(v[0])}R, ${v[1]} trades, ${v[2]} won">${v[1] ? f(v[0], 0) : '·'}</td>`; }).join('');
    const yv = s.years[y]; return any ? `<tr><td class="yr">${y}</td>${cells}<td class="tot ${cls(tot)}">${f(tot, 0)}</td><td class="tot">${yv ? pc(yv.wr) : '–'}</td></tr>` : ''; }).join('');
  return `<table class="cal"><tr><th></th>${MON.map((m) => `<th>${m}</th>`).join('')}<th>Year</th><th>Win %</th></tr>${rows}</table>`;
}
// ---- small monthly calendar per coin
function mini(c, s, max) {
  const rows = YRS.filter((y) => MON.some((_, i) => s.months[`${y}-${String(i + 1).padStart(2, '0')}`])).map((y) => {
    const cells = MON.map((_, i) => { const k = `${y}-${String(i + 1).padStart(2, '0')}`, v = s.months[k]; if (!v) return '<td class="na"></td>';
      return `<td style="background:${heat(v[0], max)};color:${ink(v[0], max)}" title="${c} ${ymLabel(k)}: ${f(v[0])}R, ${v[1]} trades">${v[1] ? Math.round(v[0]) : ''}</td>`; }).join('');
    const yv = s.years[y] || { R: 0 }; return `<tr><td class="yr">${y.slice(2)}</td>${cells}<td class="tot ${cls(yv.R)}">${f(yv.R, 0)}</td></tr>`; }).join('');
  const ms = monthStats(s);
  return `<div class="mini"><div class="mh"><span><span class="dot" style="background:${COL[c]}"></span><b>${c}</b></span><span class="flat">${ms.up} up · ${ms.down} down · ${ms.idle} no trade</span></div>
    <table class="cal sm"><tr><th></th>${MON.map((m) => `<th>${m[0]}</th>`).join('')}<th>Yr</th></tr>${rows}</table>
    <div class="mf">Best ${ymLabel(ms.best[0])} ${f(ms.best[1][0], 0)}R · worst ${ymLabel(ms.worst[0])} ${f(ms.worst[1][0], 0)}R</div></div>`;
}

// ---- per bot pages: summary, coin table, months
const botPages = [], verdicts = {};
for (const [bot, b] of Object.entries(H.bots)) {
  const L = b.lineup, coins = Object.keys(b.coins), V = (verdicts[bot] = Object.fromEntries(coins.map((c) => [c, verdict(b.coins[c], bot)])));
  const byR = [...coins].sort((x, y) => b.coins[y].R - b.coins[x].R), byAvg = [...coins].sort((x, y) => b.coins[y].avgR - b.coins[x].avgR);
  const steady = [...coins].sort((x, y) => b.coins[x].dd / Math.max(1, b.coins[x].R) - b.coins[y].dd / Math.max(1, b.coins[y].R))[0];
  const yearRows = coins.map((c) => { const s = b.coins[c]; return `<tr><td><span class="dot" style="background:${COL[c]}"></span>${c}</td>${YRS.map((y) => (s.years[y] ? tdv(s.years[y].R, 1) : '<td class="flat">·</td>')).join('')}${tdv(s.R, 1, ' strong')}</tr>`; }).join('');
  const yearTot = `<tr class="tot"><td>All coins</td>${YRS.map((y) => tdv(L.years[y].R, 1)).join('')}${tdv(L.R, 1)}</tr>`;
  const yearN = `<tr class="sm"><td>Trades · win %</td>${YRS.map((y) => `<td class="flat">${L.years[y].n} · ${pc(L.years[y].wr)}</td>`).join('')}<td class="flat">${L.n} · ${pc(L.wr)}</td></tr>`;
  const yearDD = `<tr class="sm"><td>Worst drop in year</td>${YRS.map((y) => `<td class="flat">${L.years[y].dd.toFixed(0)}R</td>`).join('')}<td class="flat">${L.dd.toFixed(0)}R</td></tr>`;
  const statRows = byR.map((c, i) => { const s = b.coins[c];
    return `<tr><td><span class="dot" style="background:${COL[c]}"></span>${c} <span class="flat sm">from ${s.since.slice(0, 7)}</span></td><td>${s.n}</td><td>${pc(s.wr)}</td><td>${f(s.avgWin, 2)} / ${f(s.avgLoss, 2)}</td><td>${s.pf.toFixed(2)}</td>${tdv(s.avgR, 2)}${tdv(s.R, 0, i === 0 ? ' best' : '')}<td>${s.dd.toFixed(0)}R</td><td>${s.lossStreak}</td><td>${yearsUp(s)}/${Object.keys(s.years).length}</td><td>${s.losingMonths}/${s.nMonths - s.flatMonths}</td><td>${s.top5Share == null ? '–' : pc(s.top5Share)}</td>${tdv(s.last12.R, 0)}<td>${chip(V[c])}</td></tr>`; }).join('');
  const totRow = `<tr class="tot"><td>Whole lineup</td><td>${L.n}</td><td>${pc(L.wr)}</td><td>${f(L.avgWin, 2)} / ${f(L.avgLoss, 2)}</td><td>${L.pf.toFixed(2)}</td>${tdv(L.avgR, 2)}${tdv(L.R, 0)}<td>${L.dd.toFixed(0)}R</td><td>${L.lossStreak}</td><td>${yearsUp(L)}/7</td><td>${L.losingMonths}/${L.nMonths}</td><td>${pc(L.top5Share)}</td>${tdv(L.last12.R, 0)}<td></td></tr>`;
  const ms = monthStats(L), lo = b.coins[byR.at(-1)];
  botPages.push(`<section class="page">
  <div class="bothead"><div><div class="tag2">${bot}</div><h2>${coins.join(' · ')}</h2><p class="sub" style="margin:0">${BOTDESC[bot]}. Jan 2020 → Nov 11, 2026.</p></div>
  <div class="bigR"><div class="v ${cls(L.R)}">${f(L.R, 0)}R</div><div class="k">${L.n} trades · win ${pc(L.wr)}</div></div></div>
  <div class="cmps four">
    <div class="cmp"><div class="k">Years won</div><div class="v">${yearsUp(L)} of 7</div></div>
    <div class="cmp"><div class="k">Months up / down</div><div class="v">${ms.up} / ${ms.down}</div></div>
    <div class="cmp"><div class="k">Last 12 months</div><div class="v ${cls(L.last12.R)}">${f(L.last12.R, 0)}R</div></div>
    <div class="cmp"><div class="k">2026 so far</div><div class="v ${cls(L.ytd.R)}">${f(L.ytd.R, 0)}R</div></div>
  </div>
  <h3>Profit by year (R)</h3>
  <div class="wrap"><table class="score"><tr><th>Coin</th>${YRS.map((y) => `<th>${y}${y === '2026' ? '*' : ''}</th>`).join('')}<th>Total</th></tr>${yearRows}${yearTot}${yearN}${yearDD}</table></div>
  <p class="sub sm" style="margin-top:4px">* 2026 runs to Nov 11. A dot = the coin was not trading yet (SOL from Sep 2020, NEAR Nov 2020, GALA Oct 2021, ARB Apr 2023, SUI Jun 2023, each after 34 days of warm-up).</p>
  <h3>Cumulative profit by coin</h3>
  ${chart(bot)}
  <div class="note good"><b>Most profitable:</b> ${byR[0]} (${f(b.coins[byR[0]].R, 0)}R). <b>Least:</b> ${byR.at(-1)} (${f(lo.R, 0)}R${lo.since > '2021' ? ', trading only since ' + lo.since.slice(0, 4) : ''}). <b>Best profit per trade:</b> ${byAvg[0]} (${f(b.coins[byAvg[0]].avgR, 2)}R a trade). <b>Smallest drop for its profit:</b> ${steady}.</div>
  ${foot()}
</section>
<section class="page">
  <h2>${bot}: every coin, side by side</h2>
  <p class="sub">Sorted by total profit. Win % = trades closed in profit. Avg win / loss in R. PF = profit factor (all wins ÷ all losses; above 1 makes money). Worst drop = deepest fall from a peak, trade by trade. Streak = most losing trades in a row. Losing months counts only months with trades. Top 5 = what the 5 best trades made as a share of the total (above 100% = without them the coin lost money).</p>
  <div class="wrap"><table class="score"><tr><th>Coin</th><th>Trades</th><th>Win %</th><th>Avg win / loss</th><th>PF</th><th>R a trade</th><th>Total R</th><th>Worst drop</th><th>Streak</th><th>Years +</th><th>Losing months</th><th>Top 5</th><th>Last 12 mo</th><th>Verdict</th></tr>${statRows}${totRow}</table></div>
  <h3>Long vs short</h3>
  <div class="wrap"><table class="score"><tr><th>Coin</th><th>Long trades</th><th>Long win %</th><th>Long R</th><th>Short trades</th><th>Short win %</th><th>Short R</th><th>Avg hold</th><th>Best trade</th><th>Worst trade</th></tr>
  ${coins.map((c) => { const s = b.coins[c]; return `<tr><td><span class="dot" style="background:${COL[c]}"></span>${c}</td><td>${s.long.n}</td><td>${pc(s.long.wr)}</td>${tdv(s.long.R, 0)}<td>${s.short.n}</td><td>${pc(s.short.wr)}</td>${tdv(s.short.R, 0)}<td>${(s.holdH / 24).toFixed(1)} d</td><td class="pos">${f(s.best.R)} <span class="flat sm">${s.best.at}</span></td><td class="neg">${f(s.worst.R)} <span class="flat sm">${s.worst.at}</span></td></tr>`; }).join('')}
  <tr class="tot"><td>Lineup</td><td>${L.long.n}</td><td>${pc(L.long.wr)}</td>${tdv(L.long.R, 0)}<td>${L.short.n}</td><td>${pc(L.short.wr)}</td>${tdv(L.short.R, 0)}<td>${(L.holdH / 24).toFixed(1)} d</td><td></td><td></td></tr></table></div>
  <h3>Verdict per coin on ${bot}</h3>
  <ul class="tight">${byR.map((c) => { const s = b.coins[c], v = V[c];
    const bits = [`${f(s.R, 0)}R from ${s.n} trades, ${pc(s.wr)} won`, v.lost.length ? `lost ${v.lost.join(' and ')}` : 'no losing year', `last 12 months ${f(s.last12.R, 0)}R`];
    if (v.luck) bits.push(`the 5 best trades made ${pc(s.top5Share)} of the total, so it depends on rare big wins`);
    return `<li>${chip(v)} <b>${c}</b>: ${bits.join('; ')}.</li>`; }).join('')}</ul>
  ${foot()}
</section>
<section class="page">
  <h2>${bot}: month by month, whole lineup</h2>
  <p class="sub">Profit in R per calendar month, all ${coins.length} coins together. Green = profit, red = loss, darker = bigger. Win % = share of that year's trades that closed in profit.</p>
  ${calendar(L, Math.max(...Object.values(L.months).map((v) => Math.abs(v[0]))) * 0.8)}
  <div class="cmps four" style="margin-top:12px">
    <div class="cmp"><div class="k">Winning months</div><div class="v">${pc(ms.up / ms.n)}</div></div>
    <div class="cmp"><div class="k">Typical (median) month</div><div class="v ${cls(ms.med)}">${f(ms.med, 1)}R</div></div>
    <div class="cmp"><div class="k">Best month</div><div class="v pos">${f(ms.best[1][0], 0)}R</div><div class="flat sm">${ymLabel(ms.best[0])}</div></div>
    <div class="cmp"><div class="k">Worst month</div><div class="v neg">${f(ms.worst[1][0], 0)}R</div><div class="flat sm">${ymLabel(ms.worst[0])}</div></div>
  </div>
  <h3>Each coin, month by month</h3>
  <div class="minis">${coins.map((c) => mini(c, b.coins[c], 18)).join('')}</div>
  ${foot()}
</section>`);
}

// ---- cross-bot coin matrix
const allCoins = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB'], BOTS = Object.keys(H.bots), Lb = (bot) => H.bots[bot].lineup, C = (bot, c) => H.bots[bot].coins[c];
const cell = (bot, c, fn) => (C(bot, c) ? fn(C(bot, c), verdicts[bot][c]) : '<td class="flat">not traded</td>');
const matrix = allCoins.map((c) => `<tr><td><span class="dot" style="background:${COL[c]}"></span><b>${c}</b></td>${BOTS.map((bot) => cell(bot, c, (s, v) => `<td>${f(s.R, 0)}R · ${pc(s.wr)} won · ${yearsUp(s)}/${Object.keys(s.years).length} yrs ${chip(v)}</td>`)).join('')}</tr>`).join('');
const matrix12 = allCoins.map((c) => `<tr><td><span class="dot" style="background:${COL[c]}"></span><b>${c}</b></td>${BOTS.map((bot) => cell(bot, c, (s) => `<td class="${cls(s.last12.R)}">${f(s.last12.R, 0)}R <span class="flat sm">(${s.last12.n} tr, ${pc(s.last12.wr)})</span></td>`)).join('')}${BOTS.map((bot) => cell(bot, c, (s) => `<td class="${cls(s.ytd.R)}">${f(s.ytd.R, 0)}R</td>`)).join('')}</tr>`).join('');
const notUp = (bot) => { const m = monthStats(Lb(bot)); return pc(1 - m.up / m.n); };

const p1 = `<section class="page">
  <div class="cover-band">
    <div class="tag">Coin history · TRI-CORE bots · Jan 2020 → Nov 2026 · 4-hour</div>
    <h1>${TITLE}</h1>
    <p class="sub">Every coin the three bots trade live today, run through each bot's exact live rules on every 4-hour candle since January 2020: year by year, month by month, win rates, drops, and a verdict on each coin and on whether the bots still work now.</p>
    <div class="trio">${BOTS.map((bot) => `<div class="team"><div class="nm">${bot}</div><div class="bots">${f(Lb(bot).R, 0)}R</div><div class="split">${Lb(bot).n} trades · ${pc(Lb(bot).wr)} won · ${yearsUp(Lb(bot))}/7 years up</div><div class="split">${Object.keys(H.bots[bot].coins).join(' · ')}</div></div>`).join('')}</div>
  </div>
  <h2>The verdict</h2>
  <p><b>Yes, all three bots are working now, on the same pattern as their whole history.</b> All three are up in 2026 so far (BB-CORE ${f(Lb('BB-CORE').ytd.R, 0)}R, I-CORE ${f(Lb('I-CORE').ytd.R, 0)}R, T-CORE ${f(Lb('T-CORE').ytd.R, 0)}R) and over the last 12 months. BB-CORE and I-CORE won all 7 years; T-CORE won 6 (it lost ${f(Lb('T-CORE').years['2023'].R, 0)}R in 2023, a year without long trends). Every coin on every bot made money over its full history.</p>
  <div class="cmps">
    ${BOTS.map((bot) => { const L = Lb(bot), ms = monthStats(L); return `<div class="cmp"><div class="k">${bot}</div><div class="row"><div><span class="v">${pc(L.wr)}</span> <span class="flat sm">trades won</span></div><div><span class="v">${pc(ms.up / ms.n)}</span> <span class="flat sm">months up</span></div><div><span class="v">${L.dd.toFixed(0)}R</span> <span class="flat sm">worst drop</span></div></div></div>`; }).join('')}
  </div>
  <h3>Most and least profitable coin, per bot</h3>
  <div class="wrap"><table class="score"><tr><th>Bot</th><th>Most profitable</th><th>Steadiest</th><th>Least profitable</th><th>Weakest right now (last 12 mo)</th></tr>
  <tr><td><b>BB-CORE</b></td><td class="pos">GALA ${f(C('BB-CORE', 'GALA').R, 0)}R, no losing year</td><td>ADA, all 7 years up</td><td class="neg">ARB ${f(C('BB-CORE', 'ARB').R, 0)}R, lost 2023 and 2024</td><td>SOL ${f(C('BB-CORE', 'SOL').last12.R, 0)}R, ADA ${f(C('BB-CORE', 'ADA').last12.R, 0)}R</td></tr>
  <tr><td><b>I-CORE</b></td><td class="pos">ZEC ${f(C('I-CORE', 'ZEC').R, 0)}R, but ${f(C('I-CORE', 'ZEC').years['2025'].R, 0)}R of it in 2025</td><td>ADA ${f(C('I-CORE', 'ADA').R, 0)}R, drop only ${C('I-CORE', 'ADA').dd.toFixed(0)}R</td><td class="neg">NEAR ${f(C('I-CORE', 'NEAR').R, 0)}R, 3 losing years</td><td>ADA ${f(C('I-CORE', 'ADA').last12.R, 1)}R (flat)</td></tr>
  <tr><td><b>T-CORE</b></td><td class="pos">ZEC ${f(C('T-CORE', 'ZEC').R, 0)}R, but ${f(C('T-CORE', 'ZEC').years['2025'].R, 0)}R of it in 2025</td><td>ETH ${f(C('T-CORE', 'ETH').R, 0)}R, all 7 years up</td><td class="neg">SUI ${f(C('T-CORE', 'SUI').R, 0)}R (since mid-2023)</td><td class="neg">ADA ${f(C('T-CORE', 'ADA').last12.R, 0)}R</td></tr></table></div>
  <div class="note"><b>How to read R.</b> R is one unit of risk: what a trade loses if it hits its stop. Dollars = R × what each trade risks. At $5 a trade, +100R = +$500. The bots trade several coins at once, so totals add up across coins. Fees (0.05% a side), slippage (0.02% a fill) and real funding are already taken off.</div>
  ${foot()}
</section>`;

const pRank = `<section class="page">
  <h2>All coins across all three bots</h2>
  <p class="sub">Total profit since 2020 · share of trades won · years up · verdict. Each coin is compared with its own bot: <span class="vchip ok">Strong</span> at most one losing year, high profit factor, up in the last 12 months; <span class="vchip ok">Solid</span> at most one losing year; <span class="vchip mid">Mixed</span> profitable overall but lost 2 or more years; <span class="vchip bad">Watch</span> losing in the last 12 months.</p>
  <div class="wrap"><table class="score"><tr><th>Coin</th>${BOTS.map((b) => `<th>${b}</th>`).join('')}</tr>${matrix}</table></div>
  <h3>Right now: last 12 months and 2026 so far</h3>
  <div class="wrap"><table class="score"><tr><th rowspan="2">Coin</th><th colspan="3" style="text-align:center">Last 12 months (Nov 2025 → Nov 2026)</th><th colspan="3" style="text-align:center">2026 so far</th></tr><tr>${BOTS.map((b) => `<th>${b}</th>`).join('')}${BOTS.map((b) => `<th>${b}</th>`).join('')}</tr>${matrix12}
  <tr class="tot"><td>Lineup</td>${BOTS.map((b) => tdv(Lb(b).last12.R, 0)).join('')}${BOTS.map((b) => tdv(Lb(b).ytd.R, 0)).join('')}</tr></table></div>
  <h3>What the coins have in common</h3>
  <ul class="tight">
    <li><b>Win rates are low on purpose.</b> BB-CORE wins about 1 trade in 3, I-CORE 1 in 3, T-CORE about 1 in 5. They make money because wins are much bigger than losses. Long losing runs are normal: up to ${Lb('BB-CORE').lossStreak} losses in a row on BB-CORE, ${Lb('I-CORE').lossStreak} on I-CORE and ${Lb('T-CORE').lossStreak} on T-CORE happened in the past.</li>
    <li><b>ZEC is the biggest earner on I-CORE and T-CORE, mostly from one year.</b> Its 2025 rally gave I-CORE ${f(C('I-CORE', 'ZEC').years['2025'].R, 0)}R and T-CORE ${f(C('T-CORE', 'ZEC').years['2025'].R, 0)}R. ZEC lost money in 2023 on all three bots.</li>
    <li><b>ADA is the most reliable old coin</b> (all 7 years up on BB-CORE, 6 on I-CORE) but has gone quiet lately: ${f(C('BB-CORE', 'ADA').last12.R, 0)}R, ${f(C('I-CORE', 'ADA').last12.R, 0)}R and ${f(C('T-CORE', 'ADA').last12.R, 0)}R over the last 12 months on BB-CORE, I-CORE and T-CORE.</li>
    <li><b>NEAR and ARB are hot right now</b> (strong 2026 on every bot) after weak years: NEAR lost 2020 and 2025 on I-CORE and T-CORE (and 2023 on I-CORE); ARB lost 2023 on both bots it trades on.</li>
    <li><b>GALA is BB-CORE's best coin</b> by total and by profit per trade, every year up. On I-CORE and T-CORE it lost 2025.</li>
    <li><b>ETH is T-CORE's steadiest coin</b>: up all 7 years, a worst drop of only ${C('T-CORE', 'ETH').dd.toFixed(0)}R on ${f(C('T-CORE', 'ETH').R, 0)}R profit, and its 5 best trades are only ${pc(C('T-CORE', 'ETH').top5Share)} of its total (every other T-CORE coin is near or above 100%).</li>
  </ul>
  ${foot()}
</section>`;

const pCaveats = `<section class="page">
  <h2>How realistic are these numbers?</h2>
  <p class="sub">What the test includes, what it leaves out, and what to expect live.</p>
  <div class="card"><ul class="tight">
    <li><b>Same rules as the VPS bots.</b> The research engine was checked against the bots' own core files trade by trade (16 of 18 bot/coin pairs identical; 3 trades out of ~6,000 differ on a rounding tie). ${BOTS.map((b) => `<b>${b}:</b> ${BOTDESC[b]}`).join('. ')}.</li>
    <li><b>Costs included:</b> 0.05% fee per side, 0.02% slippage per fill, real Binance funding payments from each coin's futures listing.</li>
    <li><b>Prices:</b> Binance spot 4-hour candles (MEXC futures history is too short and too thin before 2023). MEXC prices track Binance closely, but a live fill can be a little worse than a test fill on a fast candle.</li>
    <li><b>Window:</b> trades closed from Jan 1, 2020 to Nov 11, 2026. Each coin counts only from when it had 200 candles of history (the SMA200 filter needs them).</li>
  </ul></div>
  <div class="note warn"><b>Expect live results to be lower than this.</b> The bot settings were chosen by looking at this same history, so the test has seen the answers. Earlier research (ZEC replacement, Nov 11) found that how a coin ranked in 2019–2022 barely predicted how it ranked in 2023–2026 (rank correlation 0.17). Treat the totals as the upper end, and the year-by-year pattern (most years up, some flat, long losing runs) as what to plan around.</div>
  <h3>What this means for running the bots</h3>
  <ul class="tight">
    <li><b>Judge each bot over a year, not a month.</b> Even in this test ${notUp('BB-CORE')} of BB-CORE's months, ${notUp('I-CORE')} of I-CORE's and ${notUp('T-CORE')} of T-CORE's were not up.</li>
    <li><b>T-CORE is the most profitable and the bumpiest.</b> Worst drop ${Lb('T-CORE').dd.toFixed(0)}R vs ${Lb('BB-CORE').dd.toFixed(0)}R for BB-CORE and ${Lb('I-CORE').dd.toFixed(0)}R for I-CORE. Almost all its profit comes from a few long trends (2021, 2024, 2025); in a year without them (2023) it goes sideways.</li>
    <li><b>No coin needs removing on this data.</b> Every coin on every bot made money over its full history. The weakest spots are ARB on BB-CORE (thin profit, two losing years), NEAR on I-CORE (three losing years) and SUI on T-CORE (short history). ADA has gone flat lately but has the longest good record.</li>
    <li><b>Most of the I-CORE and T-CORE gain in the last 12 months is ZEC</b> (${f(C('I-CORE', 'ZEC').last12.R, 0)}R and ${f(C('T-CORE', 'ZEC').last12.R, 0)}R). Without ZEC their last 12 months would be ${f(Lb('I-CORE').last12.R - C('I-CORE', 'ZEC').last12.R, 0)}R and ${f(Lb('T-CORE').last12.R - C('T-CORE', 'ZEC').last12.R, 0)}R: still up, but far smaller.</li>
  </ul>
  <p class="sub" style="margin-top:14px">Source: StrategyBacktester/research/coin-history-nov13 (history.js → history.json, build-report.js). Every number here comes from those files.</p>
  ${foot()}
</section>`;

const EXTRA = `
.trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
.trio .bots { font-size: 22px; }
.cmps.four { grid-template-columns: repeat(4, 1fr); }
.cmp .v.pos { color: #15803d; } .cmp .v.neg { color: #dc2626; }
.bothead { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 4px; }
.tag2 { font-size: 10.5px; letter-spacing: 2px; text-transform: uppercase; color: #0f766e; font-weight: 700; }
.bigR { text-align: right; } .bigR .v { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; } .bigR .k { font-size: 10.5px; color: #64748b; }
.sm { font-size: 9.5px; } tr.sm td { font-size: 9.5px; padding: 2.5px 6px; }
td.strong { font-weight: 700; }
.vchip { display: inline-block; font-size: 9px; font-weight: 700; padding: 1px 7px; border-radius: 10px; letter-spacing: .3px; white-space: nowrap; }
.vchip.ok { background: #ccfbf1; color: #0f766e; } .vchip.mid { background: #fef3c7; color: #b45309; } .vchip.bad { background: #fee2e2; color: #b91c1c; }
.minis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
.mini .mh { display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 2px; }
.mini .mf { font-size: 9px; color: #64748b; margin-top: 2px; }
.cal.sm td { font-size: 8px; padding: 2.5px 0; } .cal.sm th { font-size: 7.5px; } .cal.sm td.yr { font-size: 8.5px; } .cal.sm td.tot { font-size: 8px; }
@media screen and (max-width: 760px) { .trio, .minis { grid-template-columns: 1fr; } .cmps.four { grid-template-columns: 1fr 1fr; } .bothead { flex-direction: column; align-items: flex-start; } .bigR { text-align: left; } }
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${TITLE} · Lucid'io</title><style>${CSS}${EXTRA}</style></head><body>
${p1}
${pRank}
${botPages.join('\n')}
${pCaveats}
</body></html>`;
fs.writeFileSync(path.join(LEDGER, SLUG + '.html'), html.replace(/@@PAGE@@/g, () => ++page)); // numbered in reading order
const idx = JSON.parse(fs.readFileSync(path.join(LEDGER, 'index.json'), 'utf8')).filter((r) => r.slug !== SLUG);
idx.unshift({ slug: SLUG, title: TITLE + ': Every Live Coin on All Three Bots', summary: 'Each coin the bots trade live today (SOL, ZEC, NEAR, ADA, GALA, ARB, ETH, SUI) run through BB-CORE, I-CORE and T-CORE\'s exact rules from Jan 2020 to Nov 2026: profit by year and by month, win rates, average win and loss, worst drops, losing streaks, long vs short, the most and least profitable coin per bot, the last 12 months, and a verdict on each coin and on whether the bots still work now. A test on past prices, not a promise.', updated: DATE, kind: 'Data report', file: SLUG + '.html', pdf: SLUG + '.pdf' });
fs.writeFileSync(path.join(LEDGER, 'index.json'), JSON.stringify(idx, null, 1) + '\n');
console.log('wrote', SLUG + '.html', (html.length / 1024).toFixed(0) + ' KB,', page, 'pages');
