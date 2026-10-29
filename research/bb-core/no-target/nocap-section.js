// nocap-section.js: the "no cap, flat 2.5%" sections of the three-strategy admin report (called by build-report.js).
//   - a fresh P10,000 each 1 January, 2.5% of the current balance on every trade, NO per-trade cap, compounding on every trade
//   - month by month grids, calendar-month averages, the best months, and results split by how big the market moved that month
// Basis (stated on the page): profit is booked when a trade CLOSES; a trade already open on 1 January is sized on the P10,000.
'use strict';
module.exports = function build(ctx) {
  const { T, D, KEYS, NAME, five, Y, START, RISK, ys, run, L, f, R, P, pc, peso, tbl, kpi, foot } = ctx;
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const flat = (bal) => bal * RISK;
  const sp = (v, d = 0) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d) + '%';
  const spc = (v, d = 0) => `<span class="${v > 0 ? 'pos' : v < 0 ? 'neg' : 'mut'}">${sp(v, d)}</span>`;

  // ---- one fresh account per calendar year; trades are booked in the month they close ---------------------------------
  function yearAcct(trades, y) {
    const a = ys(y), b = ys(y + 1), mine = trades.filter((t) => t.tExit >= a && t.tExit < b), ev = [], risk = new Map();
    mine.forEach((t, k) => { if (t.t >= a) ev.push([t.t, 1, k]); else risk.set(k, flat(START)); ev.push([t.tExit, 0, k]); });
    ev.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    let bal = START, pk = START, dd = 0, wins = 0;
    const start = Array(12).fill(null), pnl = Array(12).fill(0), tr = Array(12).fill(0), wn = Array(12).fill(0);
    for (const [t, typ, k] of ev) {
      if (typ === 1) { risk.set(k, flat(bal)); continue; }
      const m = new Date(t * 1000).getUTCMonth(); if (start[m] === null) start[m] = bal;
      const p = mine[k].R * risk.get(k); bal += p; pnl[m] += p; tr[m]++; if (mine[k].R > 0) { wn[m]++; wins++; }
      pk = Math.max(pk, bal); dd = Math.max(dd, 1 - bal / pk);
    }
    const mret = start.map((s, m) => (s === null ? null : pnl[m] / s));
    const have = mret.map((v, m) => [v, m]).filter(([v]) => v !== null).sort((p, q) => q[0] - p[0]);
    return { y, end: bal, profit: bal - START, ret: bal / START - 1, n: mine.length, win: mine.length ? wins / mine.length : 0, dd, mret, tr, wn, best: have[0] || null, worst: have[have.length - 1] || null };
  }
  const NC = {}, CONT = {};
  for (const k of KEYS) { NC[k] = Y.map((y) => yearAcct(T[k], y)); CONT[k] = run([T[k]], flat); }

  // ---- market move per month: average over the coins of (highest 4h close / lowest 4h close - 1) --------------------------
  const MOVE = {};
  for (const c of five) {
    const by = {};
    for (const b of D[c].B) { const d = new Date(b.time * 1000), key = d.getUTCFullYear() * 12 + d.getUTCMonth(); (by[key] = by[key] || []).push(b.close); }
    for (const [key, cl] of Object.entries(by)) if (cl.length >= 100) (MOVE[key] = MOVE[key] || []).push(Math.max(...cl) / Math.min(...cl) - 1);
  }
  for (const key of Object.keys(MOVE)) MOVE[key] = mean(MOVE[key]);

  // ---- every month of every strategy (from its first closed trade to its last) --------------------------------------------
  const MONTHS = {}, CALR = {};
  for (const k of KEYS) {
    const ex = T[k].map((t) => t.tExit), first = new Date(Math.min(...ex) * 1000), last = new Date(Math.max(...ex) * 1000);
    const k0 = first.getUTCFullYear() * 12 + first.getUTCMonth(), k1 = last.getUTCFullYear() * 12 + last.getUTCMonth();
    MONTHS[k] = [];
    Y.forEach((y, yi) => { for (let m = 0; m < 12; m++) { const key = y * 12 + m; if (key < k0 || key > k1) continue; const a = NC[k][yi]; MONTHS[k].push({ y, m, key, ret: a.mret[m] === null ? 0 : a.mret[m], n: a.tr[m], w: a.wn[m], move: MOVE[key] === undefined ? null : MOVE[key] }); } });
    CALR[k] = MN.map((_, m) => mean(T[k].filter((t) => new Date(t.tExit * 1000).getUTCMonth() === m).map((t) => t.R)));
  }
  const CAL = {};
  for (const k of KEYS) CAL[k] = MN.map((_, m) => {
    const ms = MONTHS[k].filter((x) => x.m === m), n = ms.reduce((a, x) => a + x.n, 0), w = ms.reduce((a, x) => a + x.w, 0), mv = ms.filter((x) => x.move !== null).map((x) => x.move);
    return { avg: mean(ms.map((x) => x.ret)), pos: ms.filter((x) => x.ret > 0).length / ms.length, yrs: ms.length, trades: mean(ms.map((x) => x.n)), win: n ? w / n : 0, avgR: CALR[k][m], move: mean(mv) };
  });
  const topN = (k, key, n = 5) => [...MONTHS[k]].sort((a, b) => b[key] - a[key]).slice(0, n);

  // ---- market-move thirds --------------------------------------------------------------------------------------------------
  const moves = [...new Set(KEYS.flatMap((k) => MONTHS[k].filter((x) => x.move !== null).map((x) => x.key)))].map((key) => MOVE[key]).sort((a, b) => a - b);
  const t1 = moves[Math.floor(moves.length / 3)], t2 = moves[Math.floor((2 * moves.length) / 3)];
  const bucketOf = (mv) => (mv < t1 ? 0 : mv < t2 ? 1 : 2);
  const BUCK = {}, CORR = {};
  for (const k of KEYS) {
    const ms = MONTHS[k].filter((x) => x.move !== null);
    BUCK[k] = [0, 1, 2].map((b) => { const xs = ms.filter((x) => bucketOf(x.move) === b), n = xs.reduce((a, x) => a + x.n, 0), w = xs.reduce((a, x) => a + x.w, 0); return { months: xs.length, avg: mean(xs.map((x) => x.ret)), pos: xs.length ? xs.filter((x) => x.ret > 0).length / xs.length : 0, trades: mean(xs.map((x) => x.n)), win: n ? w / n : 0 }; });
    const a = ms.map((x) => x.move), b = ms.map((x) => x.ret), ma = mean(a), mb = mean(b);
    let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < a.length; i++) { sxy += (a[i] - ma) * (b[i] - mb); sxx += (a[i] - ma) ** 2; syy += (b[i] - mb) ** 2; }
    CORR[k] = sxy / Math.sqrt(sxx * syy);
  }
  const bestCal = (k) => CAL[k].map((c, m) => [m, c.avg]).sort((a, b) => b[1] - a[1]);
  const top3 = (k) => bestCal(k).slice(0, 3).map(([m]) => m);
  const common = top3('nt').filter((m) => KEYS.every((k) => top3(k).includes(m)));           // months in the top three of all three strategies

  // ---- html ----------------------------------------------------------------------------------------------------------------
  const heat = (v) => { if (v === null) return '<td class="mut">–</td>'; const a = Math.min(0.55, Math.abs(v) / 0.5), c = v >= 0 ? `22,163,74,${a.toFixed(2)}` : `220,38,38,${a.toFixed(2)}`; return `<td style="background:rgba(${c});text-align:right">${sp(v)}</td>`; };
  const pages = [];
  const yearTbl = (k) => `<h3 style="margin:14px 0 4px">${NAME[k]}</h3>` + tbl(['Year', 'Starts', 'Ends', 'Profit', 'Return', 'Trades closed', 'Win rate', 'Deepest drop', 'Best month', 'Worst month'],
    NC[k].map((a) => [String(a.y) + (a.y === 2020 ? ' (part)' : a.y === 2026 ? ' (to Oct)' : ''), peso(START), `<b>${peso(a.end)}</b>`, P(a.profit), spc(a.ret), a.n, pc(a.win), `−${pc(a.dd)}`, a.best ? `${MN[a.best[1]]} ${spc(a.best[0])}` : '–', a.worst ? `${MN[a.worst[1]]} ${spc(a.worst[0])}` : '–']));
  const sumRet = (k) => NC[k].reduce((s, a) => s + a.profit, 0);
  pages.push(`<div class="page" id="p3b"><h2>3. No cap: ₱10,000 in each year at 2.5% on every trade</h2><p class="sub">Each year starts again with ₱10,000 on 1 January. Every trade risks 2.5% of the current balance, <b>no per-trade cap</b>, compounding on every trade. Profit is booked when a trade closes; a trade already open on 1 January is sized on the ₱10,000.</p>
${KEYS.map(yearTbl).join('')}
<h3 style="margin:16px 0 4px">One account that is never restarted (₱10,000 on 1 Jan 2020, no cap)</h3>
${tbl(['', ...Y.map(String), 'Deepest drop'], KEYS.flatMap((k) => [[`${NAME[k]}<br><span class="mut">balance at year end</span>`, ...Y.map((y) => peso(CONT[k].yEnd[y])), `<b>−${pc(CONT[k].dd)}</b>`], [`<span class="mut">that year's return</span>`, ...Y.map((y, i) => spc(CONT[k].yEnd[y] / (i ? CONT[k].yEnd[Y[i - 1]] : START) - 1)), '']]))}
<div class="note"><b>Read the two views together.</b> The fresh-year tables show what ₱10,000 does in one calendar year, so they are comparable year to year. The never-restarted account shows the effect of compounding for seven years; its late balances are theoretical because a no-cap trade needs a position of about 0.4 times the balance, which the coins stop filling at the test's prices long before these amounts. Sum of the seven fresh years: ${KEYS.map((k) => `${NAME[k]} ${peso(sumRet(k))}`).join(', ')}.</div>${foot()}</div>`);

  // ---- compounding modes: the same trades and the same 2.5%, sized on a different balance --------------------------------------
  // 'trade' = 2.5% of the balance at each entry; 'month' = 2.5% of the balance on the 1st of the month of entry; 'year' = 2.5% of the balance on 1 Jan;
  // 'fixed' = 2.5% of the first P10,000 (P250) on every trade, never compounded. No cap in any of them. Profit booked when a trade closes.
  function sim(trades, mode, a = -Infinity, b = Infinity) {
    const mine = trades.filter((t) => t.tExit >= a && t.tExit < b), ev = [], risk = new Map();
    mine.forEach((t, k) => { if (t.t >= a) ev.push([t.t, 1, k]); else risk.set(k, START * RISK); ev.push([t.tExit, 0, k]); });
    ev.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    let bal = START, pk = START, dd = 0, base = START, lastKey = null; const yEnd = {};
    for (const [t, typ, k] of ev) {
      const d = new Date(t * 1000), key = mode === 'month' ? d.getUTCFullYear() * 12 + d.getUTCMonth() : mode === 'year' ? d.getUTCFullYear() : 0;
      if (key !== lastKey) { base = bal; lastKey = key; }
      if (typ === 1) { risk.set(k, mode === 'trade' ? bal * RISK : mode === 'fixed' ? START * RISK : base * RISK); continue; }
      bal += mine[k].R * risk.get(k); pk = Math.max(pk, bal); dd = Math.max(dd, 1 - bal / pk); yEnd[d.getUTCFullYear()] = bal;
    }
    return { end: bal, profit: bal - START, dd, yEnd };
  }
  const MODES = [['trade', 'Every trade'], ['month', 'Every month'], ['year', 'Every year'], ['fixed', 'Never (₱250 a trade)']];
  const FRESH = {}, CONTM = {};
  for (const k of KEYS) { FRESH[k] = {}; CONTM[k] = {}; for (const [m] of MODES) { FRESH[k][m] = Y.map((y) => sim(T[k], m, ys(y), ys(y + 1))); CONTM[k][m] = sim(T[k], m); } }
  for (const k of KEYS) Y.forEach((y, i) => { if (Math.abs(FRESH[k].trade[i].profit - NC[k][i].profit) > 1e-6) throw new Error('compounding check failed: ' + k + ' ' + y); });   // same engine as section 3
  const sumF = (k, m) => FRESH[k][m].reduce((s, r) => s + r.profit, 0);
  const freshRows = (k) => ['trade', 'month', 'fixed'].map((m) => [MODES.find((x) => x[0] === m)[1], ...FRESH[k][m].map((r) => P(r.profit)), `<b>${P(sumF(k, m))}</b>`, P(sumF(k, m) - FRESH[k][m][1].profit)]);
  pages.push(`<div class="page" id="p3x"><h2>4. Compounding: every trade, every month, every year</h2><p class="sub">The same trades and the same 2.5%, sized on a different balance. <b>Every trade</b>: 2.5% of the balance at the moment of entry. <b>Every month</b>: 2.5% of the balance on the 1st of the month the trade is entered (the same peso risk for all that month's trades). <b>Every year</b>: 2.5% of the balance on 1 January. <b>Never</b>: always 2.5% of the first ₱10,000, which is ₱250 a trade. No cap in any of them.</p>
<h3 style="margin:10px 0 4px">A. A fresh ₱10,000 every 1 January: profit made in that year</h3>
${KEYS.map((k) => `<h3 style="margin:10px 0 3px;font-size:13px">${NAME[k]}</h3>` + tbl(['', ...Y.map(String), 'Sum', 'Sum without 2021'], freshRows(k))).join('')}
<p class="sub" style="margin-top:6px">Inside a fresh year "every year" is the same as "never": the year starts at ₱10,000.</p>
<h3 style="margin:14px 0 4px">B. One account that is never restarted: ₱10,000 on 1 January 2020 (balance at each year end)</h3>
${tbl(['', 'Compounds', ...Y.map(String), 'Deepest drop'], KEYS.flatMap((k) => MODES.map(([m, label], i) => [i ? '' : `<b>${NAME[k]}</b>`, label, ...Y.map((y) => peso(CONTM[k][m].yEnd[y])), `−${pc(CONTM[k][m].dd)}`])))}
<div class="note"><b>What compounding does.</b> For BB-Core with no target the ₱10,000 ends at ${peso(CONTM.nt.trade.end)} compounding every trade, ${peso(CONTM.nt.month.end)} every month, ${peso(CONTM.nt.year.end)} every year, and ${peso(CONTM.nt.fixed.end)} if you never compound (₱250 a trade, a straight line). Compounding is what turns a good strategy into a large number, and it also makes the late balances unrealistic (a position about 0.4 times the balance). <b>The order is not clean:</b> in this one history, compounding every month ended ${KEYS.every((k) => CONTM[k].month.end > CONTM[k].trade.end) ? 'above compounding every trade for all three strategies' : 'above compounding every trade for some of the strategies'} (BB-Core with no target ${peso(CONTM.nt.month.end)} against ${peso(CONTM.nt.trade.end)}; I-Core ${peso(CONTM.ic.month.end)} against ${peso(CONTM.ic.trade.end)}), because which balance the big winners happen to be sized on matters more than how often you update it. <b>The drop does change with the style:</b> compounding every trade or every month gives about the same deepest drop (${pc(CONTM.nt.trade.dd)} and ${pc(CONTM.nt.month.dd)} for BB-Core with no target), compounding only once a year gives ${pc(CONTM.nt.year.dd)} and ${pc(CONTM.ic.year.dd)} for I-Core, because after a bad stretch the peso risk is still sized on the January balance, now a bigger share of what is left. Never compounding is a straight line with a drop of only ${pc(CONTM.nt.fixed.dd)}.</div>${foot()}</div>`);

  // ---- win rate and expectancy ------------------------------------------------------------------------------------------------
  const yLabel = (y) => String(y) + (y === 2020 ? ' (part)' : y === 2026 ? ' (to Oct)' : '');
  const weTbl = (k) => `<h3 style="margin:10px 0 3px;font-size:13px">${NAME[k]}</h3>` + tbl(['Year', 'Trades closed', 'Win rate', 'Expectancy<br><span class="mut">average R per trade</span>', 'Average win', 'Average loss', 'Profit factor', '₱ per trade<br><span class="mut">at ₱250 risk</span>'],
    [...Y.map((y) => { const s = L.S(T[k].filter((t) => L.yr(t) === y)); return [yLabel(y), s.n, pc(s.win, 1), R(s.exp), R(s.aw), R(s.al), s.pf.toFixed(2), P(s.exp * START * RISK)]; }),
      (() => { const s = L.S(T[k]); return ['<b>All years</b>', `<b>${s.n}</b>`, `<b>${pc(s.win, 1)}</b>`, `<b>${R(s.exp)}</b>`, R(s.aw), R(s.al), s.pf.toFixed(2), `<b>${P(s.exp * START * RISK)}</b>`]; })()]);
  const monS = (k, m) => L.S(T[k].filter((t) => new Date(t.tExit * 1000).getUTCMonth() === m));
  const wr = (k) => { const v = Y.slice(1).map((y) => L.S(T[k].filter((t) => L.yr(t) === y)).win); return [Math.min(...v), Math.max(...v)]; };
  const ex = (k) => { const v = Y.slice(1).map((y) => L.S(T[k].filter((t) => L.yr(t) === y)).exp); return [Math.min(...v), Math.max(...v)]; };
  pages.push(`<div class="page" id="p3y"><h2>5. Win rate and expectancy</h2><p class="sub"><b>Expectancy</b> is the average result of one trade in R (1R = the amount risked), after fees, slippage and funding: it is what a trade is worth on average, and it does not depend on compounding. "₱ per trade" is that average at ₱250 risked per trade (2.5% of ₱10,000). Trades are counted in the year they closed.</p>
${KEYS.map(weTbl).join('')}
<h3 style="margin:14px 0 4px">By calendar month (all years together)</h3>
${tbl(['', ...KEYS.flatMap((k) => [`${NAME[k]}<br><span class="mut">trades</span>`, '<span class="mut">win rate</span>', '<span class="mut">expectancy</span>'])], MN.map((mn, m) => [mn, ...KEYS.flatMap((k) => { const s = monS(k, m); return [s.n, pc(s.win), R(s.exp)]; })]))}
<div class="note"><b>The pattern.</b> The win rate stays in a narrow band from year to year (${KEYS.map((k) => `${NAME[k]} ${pc(wr(k)[0])} to ${pc(wr(k)[1])}`).join('; ')}, full years only) while the expectancy swings much more (${KEYS.map((k) => `${NAME[k]} ${f(ex(k)[0], 2)}R to ${f(ex(k)[1], 2)}R`).join('; ')}). That is the signature of these strategies: most trades lose a little, and the average is carried by the winners, which are bigger in strong years. ${KEYS.every((k) => Y.every((y) => L.S(T[k].filter((t) => L.yr(t) === y)).exp > 0)) ? 'Every year, including the part years, was positive for all three.' : 'Not every year was positive for every strategy: see the tables.'}</div>${foot()}</div>`);

  const gridTbl = (k) => `<h3 style="margin:12px 0 4px">${NAME[k]}</h3><table><thead><tr><th>Year</th>${MN.map((m) => `<th>${m}</th>`).join('')}<th>Year</th></tr></thead><tbody>${NC[k].map((a) => `<tr><td>${a.y}</td>${a.mret.map((v, m) => heat(v !== null ? v : MONTHS[k].some((x) => x.key === a.y * 12 + m) ? 0 : null)).join('')}<td style="text-align:right"><b>${sp(a.ret)}</b></td></tr>`).join('')}</tbody></table>`;
  pages.push(`<div class="page" id="p3c"><h2>6. Month by month</h2><p class="sub">Percent change of the fresh ₱10,000 account in each month, no cap, 2.5% per trade. Green = the account grew, red = it fell, "–" = no data yet (before the first trade) or a month after the data ends. A month with no closed trade shows +0%.</p>
${KEYS.map(gridTbl).join('')}
<div class="note">Profit is booked in the month a trade closes. October 2026 is a part month. These grids are not smoothed: you can see how lumpy the results are, especially for I-Core, where a handful of months carry the year.</div>${foot()}</div>`);

  const calRows = (key, fmt) => MN.map((m, i) => [m, ...KEYS.map((k) => fmt(CAL[k][i]))]);
  const hdr3 = (what) => ['', ...KEYS.map((k) => `${NAME[k]}<br><span class="mut">${what}</span>`)];
  const bestName = (k) => { const b = bestCal(k); return `${MN[b[0][0]]} (${sp(b[0][1])}) and ${MN[b[1][0]]} (${sp(b[1][1])})`; };
  const worstName = (k) => { const b = bestCal(k).reverse(); return `${MN[b[0][0]]} (${sp(b[0][1])})`; };
  pages.push(`<div class="page" id="p3d"><h2>7. Which months are best?</h2><p class="sub">The same fresh-year accounts, grouped by calendar month (all Januaries together, and so on). Each calendar month has only 6 to 7 data points per strategy.</p>
${tbl(['', ...KEYS.flatMap((k) => [`${NAME[k]}<br><span class="mut">average return</span>`, `<span class="mut">years it made money</span>`, `<span class="mut">trades a month</span>`, `<span class="mut">win rate</span>`])],
    MN.map((m, i) => [m, ...KEYS.flatMap((k) => [spc(CAL[k][i].avg), pc(CAL[k][i].pos), CAL[k][i].trades.toFixed(1), pc(CAL[k][i].win)])]))}
<div class="note"><b>The honest reading.</b> By average return the best calendar months are: ${KEYS.map((k) => `${NAME[k]}: ${bestName(k)}`).join('; ')}. The weakest: ${KEYS.map((k) => `${NAME[k]}: ${worstName(k)}`).join('; ')}. ${common.length ? `${common.map((m) => MN[m]).join(' and ')} ${common.length > 1 ? 'are' : 'is'} in the top three for all three strategies, but ` : 'No month is in the top three for all three strategies, and '}with only seven years a few big rallies decide a month's average, so treat it as <b>a pattern to watch, not a rule</b>. The more useful question is how big the market moves, below.</div>${foot()}</div>`);

  const topTbl = (key, title) => `<h3 style="margin:12px 0 4px">${title}</h3>` + tbl(['', 'Month', 'Return', 'Trades closed', 'Winners', 'Win rate', 'How far the coins moved that month'], KEYS.flatMap((k) => topN(k, key).map((x, i) => [i ? '' : `<b>${NAME[k]}</b>`, `${MN[x.m]} ${x.y}`, spc(x.ret), x.n, x.w, x.n ? pc(x.w / x.n) : '–', x.move === null ? '–' : pc(x.move)])));
  pages.push(`<div class="page" id="p3e"><h2>8. The best individual months</h2><p class="sub">The five best months of each strategy, by return and by number of winning trades. "How far the coins moved" = the average, over the five coins, of the highest close in the month divided by the lowest close, minus 1.</p>
${topTbl('ret', 'Best five months by return')}${topTbl('w', 'Best five months by number of winning trades')}
<h2 style="margin-top:18px">Does a big market move help?</h2><p class="sub">All months sorted by how far the coins moved, split into three equal groups: quieter (under ${pc(t1)}), middle (${pc(t1)} to ${pc(t2)}), bigger (over ${pc(t2)}).</p>
${tbl(['', ...KEYS.map((k) => NAME[k])], [0, 1, 2].flatMap((b) => [[`<b>${['Quieter', 'Middle', 'Bigger'][b]} third</b><br><span class="mut">average monthly return</span>`, ...KEYS.map((k) => spc(BUCK[k][b].avg))], [`<span class="mut">months in profit</span>`, ...KEYS.map((k) => pc(BUCK[k][b].pos))], [`<span class="mut">trades a month · win rate</span>`, ...KEYS.map((k) => `${BUCK[k][b].trades.toFixed(1)} · ${pc(BUCK[k][b].win)}`)]]), ['Correlation: monthly return vs market move', ...KEYS.map((k) => CORR[k].toFixed(2))])}
<div class="note"><b>This is the link to the original idea.</b> In the bigger-move third the average month is ${KEYS.map((k) => `${NAME[k]} ${sp(BUCK[k][2].avg)}`).join(', ')}, against ${KEYS.map((k) => `${sp(BUCK[k][0].avg)}`).join(', ')} in the quieter third. BB-Core earns its money in big-move months and gives a little back in quiet ones (correlation between a month's move and its return: ${CORR.fx.toFixed(2)} for the fixed target, ${CORR.nt.toFixed(2)} with no target). I-Core's link is weak (${CORR.ic.toFixed(2)}): it earns on trends that run for months, so the size of a single month's move says little about it.</div>${foot()}</div>`);

  // ---- text copy ---------------------------------------------------------------------------------------------------------
  const text = ['\nNO CAP, FLAT 2.5%, fresh P10,000 each year (profit booked at close)'];
  for (const k of KEYS) { text.push(NAME[k]); for (const a of NC[k]) text.push(`  ${a.y}: end ${peso(a.end)} profit ${peso(a.profit)} (${sp(a.ret)}) trades ${a.n} win ${pc(a.win)} drop ${pc(a.dd)} best ${a.best ? MN[a.best[1]] + ' ' + sp(a.best[0]) : '-'} worst ${a.worst ? MN[a.worst[1]] + ' ' + sp(a.worst[0]) : '-'}`); }
  text.push('\nCALENDAR MONTH AVERAGE RETURN'); for (const k of KEYS) text.push(`${NAME[k].padEnd(22)} ${CAL[k].map((c, i) => MN[i] + ' ' + sp(c.avg)).join(' | ')}`);
  text.push('\nMARKET-MOVE THIRDS (avg monthly return)'); for (const k of KEYS) text.push(`${NAME[k].padEnd(22)} quiet ${sp(BUCK[k][0].avg)} | middle ${sp(BUCK[k][1].avg)} | big ${sp(BUCK[k][2].avg)} | corr ${CORR[k].toFixed(2)}`);
  text.push('\nCOMPOUNDING (no cap, 2.5%): fresh P10,000 each year, profit per year | continuous account end balance');
  for (const k of KEYS) for (const [m, label] of MODES) text.push(`${NAME[k].padEnd(22)} ${label.padEnd(22)} ${m === 'year' ? '(same as never inside a fresh year)'.padEnd(95) : Y.map((y, i) => peso(FRESH[k][m][i].profit)).join(' | ').padEnd(95)} | to Oct 2026 ${peso(CONTM[k][m].end)} drop ${pc(CONTM[k][m].dd)}`);
  text.push('\nWIN RATE AND EXPECTANCY BY YEAR (closing basis)');
  for (const k of KEYS) { text.push(NAME[k]); for (const y of Y) { const s = L.S(T[k].filter((t) => L.yr(t) === y)); text.push(`  ${y}: trades ${s.n} win ${pc(s.win, 1)} exp ${f(s.exp, 3)}R avgWin ${f(s.aw)}R avgLoss ${f(s.al)}R PF ${s.pf.toFixed(2)} per trade at P250 ${peso(s.exp * START * RISK)}`); } }
  return { pages, text, NC, CAL, BUCK, CORR };
};
