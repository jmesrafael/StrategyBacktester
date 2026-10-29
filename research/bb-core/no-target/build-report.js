// build-report.js: writes ledger/reports/bbcore-no-target-three-way.html and its entry in ledger/reports/index.json.
// BB-Core with the fixed target, BB-Core with no target, and I-Core: per trade, per year in pesos, without the best years, unseen coins, pairs, new risk steps.
// Same page style as bbcore-icore-trades-and-profit.html (its <style> block is copied). Rules of the bots are NOT described, only the exit ("no fixed profit target").
//   node build-report.js            (STRAT_ROOT = folder holding the clones; default = this PC). Run it inside the ledger working tree you want the file in.
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib.js');
const five = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], other = ['AVAX', 'BNB', 'DOGE', 'ETH', 'LINK', 'LTC', 'XRP'];
const START = 10000, PHP = 58, RISK = 0.025, CAP = 10 * PHP;           // ₱10,000; ₱58 per dollar; the bots' old $10 cap = ₱580
const Y = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const REP = path.join(L.ROOT, 'ledger', 'reports'), OUTF = 'bbcore-no-target-three-way.html';

// ---- data and trades ------------------------------------------------------------------------------------------------
const D = {};
for (const c of five) D[c] = { B: L.loadC(L.ROOT + `bb-core/data/${c}.json`), F: L.loadF(L.ROOT + `bb-core/data/funding/${c}.json`), I: L.loadC(L.ROOT + `i-core/data/${c}.json`) };
const tag = (c, t) => t.map((x) => ({ ...x, coin: c }));
const T = {
  fx: five.flatMap((c) => tag(c, L.bb.backtest(D[c].B, { targetR: 4 }, D[c].F).trades)),
  nt: five.flatMap((c) => tag(c, L.bb.backtest(D[c].B, { targetR: 0 }, D[c].F).trades)),
  ic: five.flatMap((c) => tag(c, L.ic.backtest(D[c].I).trades)),
};
const NAME = { fx: 'BB-Core, fixed target', nt: 'BB-Core, no target', ic: 'I-Core' };
const KEYS = ['fx', 'nt', 'ic'];

// ---- helpers ---------------------------------------------------------------------------------------------------------
const f = (v, d = 2) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'mut');
const R = (v, d = 2) => `<span class="${cls(v)}">${f(v, d)}R</span>`;
const peso = (v) => { const a = Math.abs(v), s = v < 0 ? '−₱' : '₱'; return a >= 1e6 ? s + (a / 1e6).toFixed(1) + 'M' : s + Math.round(a).toLocaleString('en-US'); };
const P = (v) => `<span class="${cls(v)}">${v < 0 ? '−' : ''}${peso(Math.abs(v)).replace('−', '')}</span>`;
const pc = (v, d = 0) => (v * 100).toFixed(d) + '%';
const ys = (y) => Date.UTC(y, 0, 1) / 1000;
const tier = (usd) => (usd < 500 ? 0.025 : usd < 1000 ? 0.02 : 0.015);
const RULE = {
  capped: (bal) => Math.min(CAP, bal * RISK),                       // what the bots did until now: 2.5% of the balance, never more than ₱580
  steps: (bal, pk) => bal * tier(pk / PHP),                         // new: 2.5% below ₱29k, 2.0% from there, 1.5% from ₱58k, by the highest balance so far, no cap
};
// each list is its own account (start ₱10,000); trades entered in [from, to). Returns combined profit, deepest drop of the combined equity and year-end equity
function run(lists, rule, from = -Infinity, to = Infinity) {
  const bal = lists.map(() => START), peak = lists.map(() => START), ev = [], risk = new Map();
  lists.forEach((tr, j) => tr.forEach((t, k) => { if (t.t >= from && t.t < to) { ev.push([t.t, 1, j, k]); ev.push([t.tExit, 0, j, k]); } }));
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let pk = START * lists.length, dd = 0; const yEnd = {};
  for (const [t, typ, j, k] of ev) {
    const key = j + ':' + k;
    if (typ === 1) risk.set(key, rule(bal[j], peak[j]));
    else {
      bal[j] += lists[j][k].R * risk.get(key); peak[j] = Math.max(peak[j], bal[j]);
      const eq = bal.reduce((a, b) => a + b, 0); pk = Math.max(pk, eq); dd = Math.max(dd, 1 - eq / pk); yEnd[new Date(t * 1000).getUTCFullYear()] = eq;
    }
  }
  const end = bal.reduce((a, b) => a + b, 0);
  return { end, profit: end - START * lists.length, dd, yEnd };
}
const yearly = (lists, rule) => Y.map((y) => run(lists, rule, ys(y), ys(y + 1)));
const sumP = (arr) => arr.reduce((a, r) => a + r.profit, 0);
const top = (tr, n) => { const R_ = tr.map((x) => x.R).sort((a, b) => b - a), tot = R_.reduce((a, b) => a + b, 0); return R_.slice(0, n).reduce((a, b) => a + b, 0) / tot; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// ---- numbers ---------------------------------------------------------------------------------------------------------
const ST = {}; for (const k of KEYS) ST[k] = L.S(T[k]);
const YR = {}; for (const k of KEYS) YR[k] = yearly([T[k]], RULE.capped);
const ROB = {};
for (const k of KEYS) {
  const by = L.byYear(T[k]), yr = Object.entries(by).map(([y, v]) => [+y, v.reduce((a, x) => a + x.R, 0)]).sort((a, b) => b[1] - a[1]);
  const ex = (drop) => T[k].filter((x) => !drop.includes(L.yr(x)));
  const Rs = T[k].map((x) => x.R).sort((a, b) => b - a);
  ROB[k] = { best: yr[0], e1: L.S(ex([yr[0][0]])), e2: L.S(ex([yr[0][0], yr[1][0]])), e10: mean(Rs.slice(10)), top10: top(T[k], 10) };
}
const OT = {};
{
  const C = {}; for (const c of other) C[c] = L.loadC(L.ROOT + `StrategyBacktester/research/big-swings/data/${c}.json`);
  const per = { fx: {}, nt: {}, ic: {} };
  for (const c of other) { per.fx[c] = L.bb.backtest(C[c], { targetR: 4 }).trades; per.nt[c] = L.bb.backtest(C[c], { targetR: 0 }).trades; per.ic[c] = L.ic.backtest(C[c]).trades; }
  for (const k of KEYS) { const all = other.flatMap((c) => per[k][c]); OT[k] = { all: L.S(all), pos: other.filter((c) => L.S(per[k][c]).exp > 0).length, by: Object.fromEntries(other.map((c) => [c, L.S(per[k][c]).exp])), lossYears: Object.values(L.byYear(all)).filter((v) => v.reduce((a, x) => a + x.R, 0) < 0).length, years: Object.keys(L.byYear(all)).length }; }
}
const PAIRS = [['nt', 'ic'], ['fx', 'ic'], ['fx', 'nt']].map(([a, b]) => {
  const yr = Y.map((y) => run([T[a], T[b]], RULE.capped, ys(y), ys(y + 1))), tot = yr.reduce((s, r) => s + r.profit, 0), no21 = tot - yr[1].profit;
  const keys = new Set(T[b].map((t) => t.coin + t.t)), same = T[a].filter((t) => keys.has(t.coin + t.t)).length;
  const mon = {}; for (const t of [...T[a], ...T[b]]) { const d = new Date(t.tExit * 1000), k = d.getUTCFullYear() * 100 + d.getUTCMonth(); mon[k] = (mon[k] || 0) + t.R; }
  const pool = L.S([...T[a], ...T[b]]);
  return { a, b, yr, tot, no21, worst: Math.min(...yr.map((r) => r.profit)), ddMax: Math.max(...yr.map((r) => r.dd)), corr: L.corr(L.monthly(T[a]), L.monthly(T[b])), same: same / T[a].length, worstMonth: Math.min(...Object.values(mon)), exp: pool.exp };
});
const STEP = {}; // new risk rules
for (const k of KEYS) { const whole = run([T[k]], RULE.steps), yr = yearly([T[k]], RULE.steps); STEP[k] = { whole, yr, tot: sumP(yr), no21: sumP(yr) - yr[1].profit, ddYear: Math.max(...yr.map((r) => r.dd)) }; }
const STEPP = [['nt', 'ic'], ['fx', 'ic']].map(([a, b]) => ({ a, b, whole: run([T[a], T[b]], RULE.steps), yr: yearly([T[a], T[b]], RULE.steps) }));
const FLATW = {}; for (const k of KEYS) FLATW[k] = run([T[k]], (bal) => bal * RISK);

// ---- html ------------------------------------------------------------------------------------------------------------
const src = fs.readFileSync(path.join(REP, 'bbcore-icore-trades-and-profit.html'), 'utf8');
const STYLE = src.slice(src.indexOf('<style>'), src.indexOf('</style>') + 8);
const tbl = (head, rows) => `<table><thead><tr>${head.map((h, i) => `<th${i ? '' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const kpi = (v, k, c = '') => `<div class="kpi"><div class="v ${c}">${v}</div><div class="k">${k}</div></div>`;
const NP = 7;
const foot = (n) => `<div class="foot"><span>Past-price test of three strategies on 5 coins. Includes exchange fees, slippage and funding; before the Lucid'io fee. Not live trading. Past performance does not guarantee future results.</span><span>Page ${n} of ${NP}</span></div>`;
const fx = ST.fx, nt = ST.nt, ic = ST.ic;
const sumCap = (k) => sumP(YR[k]);

const pages = [];
pages.push(`<div class="page" id="p1"><div class="cover-band"><div class="tag">Past-price test · BB-Core with a fixed target, BB-Core with no target, I-Core</div><h1>Three strategies compared</h1>
<p class="sub" style="font-size:14px;margin:0">The same five coins (SOL, ZEC, NEAR, ADA, GALA), 2020 to late Oct 2026. BB-Core as it ran until now (every winner closed at a fixed target), BB-Core with no fixed profit target (winners run until the stop or the 8-day limit), and I-Core. Per trade, in pesos per year, without the best years, on coins never used to design the bots, and as pairs.</p></div>
<div class="kpis">${kpi(f(fx.exp, 2) + 'R', 'BB-Core, fixed target: average per trade')}${kpi(f(nt.exp, 2) + 'R', 'BB-Core, no target: average per trade', 'pos')}${kpi(f(ic.exp, 2) + 'R', 'I-Core: average per trade')}${kpi('7 / 7', 'profitable years, all three')}</div>
<div class="kpis" style="margin-top:0">${kpi(peso(sumCap('fx')), 'BB-Core fixed: sum of seven fresh ₱10,000 years')}${kpi(peso(sumCap('nt')), 'BB-Core no target: same', 'pos')}${kpi(peso(sumCap('ic')), 'I-Core: same')}${kpi(peso(PAIRS[0].tot), 'BB-Core no target + I-Core, two ₱10,000 accounts', 'pos')}</div>
<h3>The short answer</h3><ul style="margin:4px 0 0;padding-left:18px">
<li><b>1st: BB-Core with no target.</b> ${f(nt.exp, 2)}R per trade against ${f(fx.exp, 2)}R with the fixed target, the smallest drop of the three (${nt.dd.toFixed(0)}R), and better than the fixed target on all seven coins it was not designed on.</li>
<li><b>2nd: I-Core.</b> The highest average per trade (${f(ic.exp, 2)}R) but ${pc(ROB.ic.top10)} of its profit comes from its ten best trades, and it is the weakest of the three once those are taken out.</li>
<li><b>3rd: BB-Core with the fixed target.</b> The steadiest per trade (its ten best trades are only ${pc(ROB.fx.top10)} of its profit) but the lowest average, and it caps every win at the target.</li>
<li><b>Best pair: BB-Core with no target + I-Core.</b> The two almost never win in the same months (correlation ${PAIRS[0].corr.toFixed(2)}). It earns ${peso(PAIRS[0].tot - PAIRS[1].tot)} more than today's pair across seven fresh years, with the same drop.</li>
<li><b>Status.</b> As of 29 Oct 2026 the no-target version is in the code but <b>not live yet</b>; the live bot still uses the fixed target.</li></ul>
<div class="note"><b>How to read the pesos.</b> Each year starts again with ₱10,000 on 1 January. Every trade risks 2.5% of the current balance, never more than ₱580 (the old $10 cap), compounding on every trade. Section 6 shows the new rule (risk steps down as the account grows, no cap). Trades are counted in the year they closed.</div>${foot(1)}</div>`);

pages.push(`<div class="page" id="p2"><h2>1. Per trade</h2><p class="sub">All five coins together, 1 Jan 2020 to late Oct 2026. Fees, slippage and funding included. R = the amount risked on a trade.</p>
${tbl(['', ...KEYS.map((k) => NAME[k])], [
  ['Trades', ...KEYS.map((k) => ST[k].n)],
  ['Win rate', ...KEYS.map((k) => pc(ST[k].win, 1))],
  ['<b>Average per trade</b>', ...KEYS.map((k) => `<b>${R(ST[k].exp)}</b>`)],
  ['Average winning trade', ...KEYS.map((k) => R(ST[k].aw))],
  ['Average losing trade', ...KEYS.map((k) => R(ST[k].al))],
  ['Profit factor (wins ÷ losses)', ...KEYS.map((k) => ST[k].pf.toFixed(2))],
  ['Total', ...KEYS.map((k) => R(ST[k].net, 0))],
  ['Deepest drop', ...KEYS.map((k) => `−${ST[k].dd.toFixed(0)}R`)],
  ['Best single trade', ...KEYS.map((k) => R(ST[k].best, 1))],
  ['Ten best trades as a share of all profit', ...KEYS.map((k) => pc(ROB[k].top10))],
])}
<div class="note"><b>What the numbers say.</b> Removing the fixed target lifts the average win from ${f(fx.aw, 2)}R to ${f(nt.aw, 2)}R and costs about two points of win rate (${pc(fx.win, 1)} to ${pc(nt.win, 1)}), because some trades that touched the target now come back before the 8-day limit. The price is a lumpier result: the ten best trades are ${pc(ROB.nt.top10)} of its profit, against ${pc(ROB.fx.top10)} with the fixed target. I-Core wins least often (${pc(ic.win, 0)}) but its average win is ${f(ic.aw, 1)}R.</div>${foot(2)}</div>`);

const yrRow = (k) => [NAME[k], ...YR[k].map((r) => `${P(r.profit)}<br><span class="mut">drop ${pc(r.dd)}</span>`), `<b>${P(sumCap(k))}</b>`, P(sumCap(k) - YR[k][1].profit)];
pages.push(`<div class="page" id="p3"><h2>2. ₱10,000 in each year</h2><p class="sub">Profit made in that calendar year from a fresh ₱10,000 on 1 January, 2.5% risk per trade, compounding, capped at ₱580 a trade. "Drop" is the deepest fall from the year's peak.</p>
${tbl(['', ...Y.map(String), 'Sum', 'Sum without 2021'], KEYS.map(yrRow))}
<div class="note"><b>2021 was the best year for all three.</b> Without it the order is the same: BB-Core with no target ${peso(sumCap('nt') - YR.nt[1].profit)}, BB-Core with the fixed target ${peso(sumCap('fx') - YR.fx[1].profit)}, I-Core ${peso(sumCap('ic') - YR.ic[1].profit)}. 2020 and 2026 are part years (2026 ends in late October). The small differences in 2023–2025 are not significant: single years swing by tens of thousands.</div>${foot(3)}</div>`);

const robRow = (label, fn) => [label, ...KEYS.map(fn)];
pages.push(`<div class="page" id="p4"><h2>3. Do they hold up without the best years and trades?</h2><p class="sub">Average per trade after taking out the best of the results. All three stay positive; the order changes when the biggest winners go.</p>
${tbl(['', ...KEYS.map((k) => NAME[k])], [
  robRow('All trades', (k) => R(ST[k].exp)),
  robRow('Without the best year', (k) => `${R(ROB[k].e1.exp)}<br><span class="mut">(${ROB[k].best[0]} removed)</span>`),
  robRow('Without the best two years', (k) => R(ROB[k].e2.exp)),
  robRow('Without the ten best trades', (k) => R(ROB[k].e10)),
])}
<div class="note"><b>The honest reading.</b> Without its ten best trades, BB-Core with no target is at ${f(ROB.nt.e10, 2)}R, about the same as the fixed target (${f(ROB.fx.e10, 2)}R), and I-Core drops to ${f(ROB.ic.e10, 2)}R. So the gain from removing the target comes from the occasional big winner it no longer cuts short. On these five coins it is ahead in fewer than two of every three coin-years, so it is not proven on them alone. Section 4 is the stronger evidence.</div>
<h2 style="margin-top:18px">4. Seven coins never used to design the bots</h2><p class="sub">AVAX, BNB, DOGE, ETH, LINK, LTC, XRP over the same years (no funding data; the same fees and slippage).</p>
${tbl(['', ...KEYS.map((k) => NAME[k])], [
  robRow('<b>Average per trade</b>', (k) => `<b>${R(OT[k].all.exp)}</b>`),
  robRow('Trades', (k) => OT[k].all.n), robRow('Total', (k) => R(OT[k].all.net, 0)), robRow('Deepest drop', (k) => `−${OT[k].all.dd.toFixed(0)}R`),
  robRow('Coins with a positive average', (k) => `${OT[k].pos} of 7`),
  robRow('Losing calendar years', (k) => `${OT[k].lossYears} of ${OT[k].years}`),
  ...other.map((c) => [c, ...KEYS.map((k) => R(OT[k].by[c]))]),
])}${foot(4)}</div>`);

const pairRow = (p) => [`${NAME[p.a]} + ${NAME[p.b]}`, ...p.yr.map((r) => P(r.profit)), `<b>${P(p.tot)}</b>`, P(p.no21)];
pages.push(`<div class="page" id="p5"><h2>5. Two bots together</h2><p class="sub">Two accounts of ₱10,000 each (₱20,000), each with its own risk, each year starting fresh on 1 January. Profit made that year on the ₱20,000.</p>
${tbl(['', ...Y.map(String), 'Sum', 'Sum without 2021'], PAIRS.map(pairRow))}
<div style="height:14px"></div>${tbl(['', ...PAIRS.map((p) => `${NAME[p.a].replace('BB-Core, ', 'BB ')} + ${NAME[p.b].replace('BB-Core, ', 'BB ')}`)], [
  ['Monthly correlation (0 = independent, 1 = same)', ...PAIRS.map((p) => p.corr.toFixed(2))],
  ['Share of trades that are the same coin on the same candle', ...PAIRS.map((p) => pc(p.same))],
  ['Worst month (all trades pooled)', ...PAIRS.map((p) => R(p.worstMonth, 0))],
  ['Worst year', ...PAIRS.map((p) => P(p.worst))],
  ['Deepest drop within a year', ...PAIRS.map((p) => pc(p.ddMax))],
  ['Average per trade, pooled', ...PAIRS.map((p) => R(p.exp))],
])}
<div class="note"><b>Why the BB-Core pair is not the answer.</b> BB-Core with the fixed target + BB-Core with no target earns the most on paper (${peso(PAIRS[2].tot)}), but it is the same signal on the same coins: ${pc(PAIRS[2].same)} of the trades are the same trade, the monthly correlation is ${PAIRS[2].corr.toFixed(2)} and the worst month is ${f(PAIRS[2].worstMonth, 0)}R. It is one bet at double the risk. <b>BB-Core with no target + I-Core</b> are two different strategies that win in different months (correlation ${PAIRS[0].corr.toFixed(2)}), so it is the pair worth running.</div>${foot(5)}</div>`);

const stepRow = (k) => [NAME[k], ...STEP[k].yr.map((r) => `${P(r.profit)}<br><span class="mut">drop ${pc(r.dd)}</span>`), `<b>${P(STEP[k].tot)}</b>`, P(STEP[k].no21)];
pages.push(`<div class="page" id="p6"><h2>6. The new risk rule: steps down as the account grows, no cap</h2><p class="sub">2.5% of the balance per trade below ₱29,000, 2.0% from ₱29,000, 1.5% from ₱58,000, judged by the highest balance reached so far (so it never goes back up during a drop). No per-trade cap. Same fresh ₱10,000 each 1 January.</p>
${tbl(['', ...Y.map(String), 'Sum', 'Sum without 2021'], KEYS.map(stepRow))}
<h3 style="margin-top:16px">One account from 1 Jan 2020 (not restarted)</h3>
${tbl(['', 'End of 2021', 'End of 2023', 'End of 2025', 'Oct 2026', 'Deepest drop'], [
  ...KEYS.map((k) => [NAME[k] + '<br><span class="mut">risk steps</span>', peso(STEP[k].whole.yEnd[2021]), peso(STEP[k].whole.yEnd[2023]), peso(STEP[k].whole.yEnd[2025]), `<b>${peso(STEP[k].whole.end)}</b>`, `−${pc(STEP[k].whole.dd)}`]),
  ...KEYS.map((k) => [NAME[k] + '<br><span class="mut">flat 2.5%, no cap</span>', peso(FLATW[k].yEnd[2021]), peso(FLATW[k].yEnd[2023]), peso(FLATW[k].yEnd[2025]), peso(FLATW[k].end), `<b>−${pc(FLATW[k].dd)}</b>`]),
])}
<div style="height:14px"></div>${tbl(['Two ₱10,000 accounts, risk steps', 'End of 2023', 'End of 2025', 'Oct 2026', 'Deepest drop'], STEPP.map((p) => [`${NAME[p.a]} + ${NAME[p.b]}`, peso(p.whole.yEnd[2023]), peso(p.whole.yEnd[2025]), `<b>${peso(p.whole.end)}</b>`, `−${pc(p.whole.dd)}`]))}
<div class="note"><b>What the steps do.</b> They cut the deepest drop from about half the account (${pc(FLATW.nt.dd)} for BB-Core with no target at a flat 2.5%) to ${pc(STEP.nt.whole.dd)}, and still turn ₱10,000 into ${peso(STEP.nt.whole.end)}. <b>Treat large balances as theoretical:</b> with no cap a 2.5%-risk trade needs a position of about 0.4 times the balance, which on GALA and ZEC stops filling at the test's prices long before these balances are reached. Drops of a third of the account are normal at these risk levels.</div>${foot(6)}</div>`);

pages.push(`<div class="page" id="p7"><h2>7. Method and limits</h2>
<ul style="margin:4px 0 0;padding-left:18px">
<li><b>Same data, same costs.</b> 4-hour candles on the five coins, Binance prices, exchange fees, slippage and real funding for the five coins. The seven other coins have no funding data (applied equally to all three).</li>
<li><b>A test on past prices.</b> The coins and settings were chosen with hindsight; I-Core's settings were tuned on 2020–2022 and judged on 2023–2026. 2021 (a very strong year) carries a lot of the profit in all three. 2020 and 2026 are part years.</li>
<li><b>The no-target version is not live.</b> It exists in the code and passes its tests; the bot on the server still uses the fixed target until the planned upgrade. Its live record starts on the upgrade date and is judged separately.</li>
<li><b>Trades that were open.</b> A trade open at the end of the data is closed at the last price. Trades are counted in the year they closed.</li>
<li><b>Pairs add trades, not risk limits.</b> Up to five trades per bot can be open at once; the "drop" figures are on closed trades.</li>
<li><b>Not included:</b> the Lucid'io performance fee, withdrawals and deposits, taxes, and any trade the exchange could not fill at the test's price (small accounts have contract-size limits).</li>
<li><b>Source.</b> Rebuilt from the engines by <code>research/bb-core/no-target/build-report.js</code>; the full study is in <code>research/bb-core/no-target/RESULTS.md</code>.</li></ul>${foot(7)}</div>`);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="robots" content="noindex, nofollow, noarchive">
<title>Three Strategies Compared: BB-Core Fixed Target, BB-Core No Target, I-Core · Lucid'io</title>
${STYLE}
</head>
<body>${pages.join('\n')}</body></html>
`;
fs.writeFileSync(path.join(REP, OUTF), html);

// registry entry (newest first); replaces an older entry of the same slug
const IDX = path.join(REP, 'index.json'), idx = JSON.parse(fs.readFileSync(IDX, 'utf8')).filter((e) => e.slug !== 'bbcore-no-target-three-way');
idx.unshift({
  slug: 'bbcore-no-target-three-way',
  title: 'Three Strategies Compared: BB-Core Fixed Target, BB-Core No Target, I-Core',
  summary: `Five coins, 2020 to Oct 2026. Per trade, ₱10,000 in each year at 2.5% risk, without the best years and trades, on seven coins never used to design the bots, the three pairs of two bots, and the new risk rule (steps down as the account grows, no cap). BB-Core with no target averages ${f(nt.exp, 2)}R per trade against ${f(fx.exp, 2)}R with the fixed target; I-Core ${f(ic.exp, 2)}R but ${pc(ROB.ic.top10)} of its profit is ten trades. The no-target version is not live yet. A test on past prices, not a promise.`,
  updated: 'Oct 29, 2026', kind: 'Data report', file: '/reports/' + OUTF,
});
fs.writeFileSync(IDX, JSON.stringify(idx, null, 2) + '\n');

// a short text copy of the headline numbers, for the chat and the study folder
const out = [];
out.push('PER TRADE'); for (const k of KEYS) out.push(`${NAME[k].padEnd(22)} n ${ST[k].n} win ${pc(ST[k].win, 1)} exp ${f(ST[k].exp, 3)}R avgWin ${f(ST[k].aw)}R avgLoss ${f(ST[k].al)}R PF ${ST[k].pf.toFixed(2)} net ${f(ST[k].net, 0)}R DD -${ST[k].dd.toFixed(0)}R top10 ${pc(ROB[k].top10)}`);
out.push('\nPESOS PER YEAR (fresh P10,000, 2.5%, cap P580)'); for (const k of KEYS) out.push(`${NAME[k].padEnd(22)} ${YR[k].map((r) => peso(r.profit)).join(' | ')} | sum ${peso(sumCap(k))} | w/o 2021 ${peso(sumCap(k) - YR[k][1].profit)}`);
out.push('\nROBUSTNESS expR'); for (const k of KEYS) out.push(`${NAME[k].padEnd(22)} all ${f(ST[k].exp, 3)} | w/o best year ${f(ROB[k].e1.exp, 3)} (${ROB[k].best[0]}) | w/o best 2 yrs ${f(ROB[k].e2.exp, 3)} | w/o top 10 trades ${f(ROB[k].e10, 3)}`);
out.push('\n7 UNSEEN COINS'); for (const k of KEYS) out.push(`${NAME[k].padEnd(22)} exp ${f(OT[k].all.exp, 3)}R n ${OT[k].all.n} net ${f(OT[k].all.net, 0)}R DD -${OT[k].all.dd.toFixed(0)}R positive coins ${OT[k].pos}/7 losing years ${OT[k].lossYears}/${OT[k].years}`);
out.push('\nPAIRS (two P10,000 accounts, fresh each year)'); for (const p of PAIRS) out.push(`${(NAME[p.a] + ' + ' + NAME[p.b]).padEnd(46)} ${p.yr.map((r) => peso(r.profit)).join(' | ')} | sum ${peso(p.tot)} | w/o 2021 ${peso(p.no21)} | worst yr ${peso(p.worst)} | corr ${p.corr.toFixed(2)} | same trade ${pc(p.same)} | worst month ${f(p.worstMonth, 0)}R`);
out.push('\nNEW RISK STEPS, no cap'); for (const k of KEYS) out.push(`${NAME[k].padEnd(22)} fresh-year ${STEP[k].yr.map((r) => peso(r.profit)).join(' | ')} | sum ${peso(STEP[k].tot)} | one account to Oct 2026 ${peso(STEP[k].whole.end)} drop ${pc(STEP[k].whole.dd)} (flat 2.5% no cap: ${peso(FLATW[k].end)}, drop ${pc(FLATW[k].dd)})`);
for (const p of STEPP) out.push(`${(NAME[p.a] + ' + ' + NAME[p.b]).padEnd(46)} one account pair to Oct 2026 ${peso(p.whole.end)} drop ${pc(p.whole.dd)}`);
fs.writeFileSync(path.join(__dirname, 'out-three-way.txt'), out.join('\n') + '\n');
console.log(out.join('\n'));
console.log('\nwrote', path.join(REP, OUTF), 'and its entry in index.json');
