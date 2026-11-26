// report.js - results.json -> RESULTS.md (every table) + report.html (verdict, charts, tables). Run after study.js.
// Built from ../four-bot-nov26/report.js. The verdict lines live in verdict.json (written by hand after reading the numbers).
'use strict';
const fs = require('fs');
const R = require('./results.json');
const V = fs.existsSync(__dirname + '/verdict.json') ? require('./verdict.json') : { verdict: [], caveats: [] };
const ALL = R.meta.strats, NAME = Object.fromEntries(ALL.map((s) => [s.id, s.name]));
const BBS = ['bb', 'bbold', 'bb1h', 'wide'], S = ALL.filter((s) => BBS.includes(s.id));
const pc = (v, d = 0) => (100 * v).toFixed(d) + '%', spc = (v) => (v >= 0 ? '+' : '') + Math.round(100 * v).toLocaleString('en-US') + '%';
const n0 = (v) => Math.round(v).toLocaleString('en-US'), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), sg = (v) => (v >= 0 ? '+' : '') + Math.round(v);
const A = (id, set = 'own') => R.solo[id][set].all, M = (id, k = 'own') => R.money[id][k];
const PKEYS = Object.keys(R.port);
const SHORT = { today: 'Today (v4 50 / I 25 / T 25)', 'sw-1h': '1H instead of v4', 'sw-wide': 'WIDE instead of v4', 'sw-old': 'Old 4H instead of v4', 'add-1h': 'v4 + 1H + I + T (25 each)', 'add-wide': 'v4 + WIDE + I + T (25 each)', 'add-both': 'v4 + 1H + WIDE + I + T (20 each)', bbthird: 'BB half split v4/1H/WIDE, I 25, T 25' };
const BAR = { today: 'Today', 'sw-1h': '1H instead of v4', 'sw-wide': 'WIDE instead of v4', 'sw-old': 'Old 4H instead', 'add-1h': '+ 1H (25 each)', 'add-wide': '+ WIDE (25 each)', 'add-both': '+ 1H + WIDE (20 each)', bbthird: 'BB split 3 ways' };

// ---------- scorecard: rank 1 (best) to 4 ----------
const rdd = (o) => (o.mdd ? o.R / o.mdd : 0);
const MEASURES = [
  ['Profit factor', (i) => A(i).pf, 1, f2],
  ['Win rate', (i) => A(i).win, 1, pc],
  ['R earned per R of worst fall', (i) => rdd(A(i)), 1, f1],
  ['Account worst fall (alone, live sizing)', (i) => M(i).real.dd, -1, pc],
  ['Growth per year ÷ worst fall', (i) => M(i).real.calmar, 1, f1],
  ['Sharpe', (i) => M(i).real.sharpe, 1, f2],
  ['Sortino', (i) => M(i).real.sortino, 1, f2],
  ['Losing months', (i) => M(i).real.losingMonths, -1, pc],
  ['Worst month', (i) => M(i).real.worstMonth, 1, pc],
  ['Worst 12-month run', (i) => M(i).w.worstRet, 1, spc],
  ['12-month return at the same typical fall', (i) => M(i).typical.medRet, 1, spc],
  ['Growth per year at the same worst fall (40%)', (i) => M(i).matched.cagr, 1, pc],
  ['Profit kept at double costs', (i) => R.solo[i].own.two.R / A(i).R, 1, pc],
  ['12 main coins: R per R of fall', (i) => rdd(R.solo[i].main.all), 1, f1],
  ['12 hold-out coins: R per R of fall', (i) => rdd(R.solo[i].hold.all), 1, f1],
  ['12 hold-out coins: positive years', (i) => R.solo[i].hold.all.posYears, 1, (v) => v + '/7'],
  ['Since 2024: R per R of fall', (i) => rdd(R.solo[i].own.oos), 1, f1],
];
const ranks = Object.fromEntries(S.map((s) => [s.id, []]));
for (const [, fn, dir] of MEASURES) { const v = S.map((s) => [s.id, fn(s.id)]); for (const [id, x] of v) ranks[id].push(1 + v.filter(([, y]) => (y - x) * dir > 1e-9).length); }
const avgRank = Object.fromEntries(S.map((s) => [s.id, ranks[s.id].reduce((a, b) => a + b, 0) / MEASURES.length]));
const wins = Object.fromEntries(S.map((s) => [s.id, ranks[s.id].filter((r) => r === 1).length]));
const ORDER = S.map((s) => s.id).sort((a, b) => avgRank[a] - avgRank[b]);

const T = {};
T.score = { head: ['Measure', ...ORDER.map((i) => NAME[i])], rows: [...MEASURES.map(([n, fn, , fm], k) => [n, ...ORDER.map((i) => ({ v: fm(fn(i)), best: ranks[i][k] === 1 }))]), ['Average rank (1 = best)', ...ORDER.map((i) => f1(avgRank[i]))], ['Measures won', ...ORDER.map((i) => String(wins[i]))]] };
const full = (set) => ({
  head: ['Measure', ...ORDER.map((i) => NAME[i])],
  rows: [
    ['Timeframe', ...ORDER.map((i) => S.find((s) => s.id === i).tf)],
    ['Status', ...ORDER.map((i) => S.find((s) => s.id === i).status)],
    ['Coins', ...ORDER.map((i) => String(R.solo[i][set].coins))],
    ...[['Trades', (a) => n0(a.n)], ['Trades per month', (a) => f1(a.perMonth)], ['Win rate', (a) => pc(a.win)], ['Average R per trade', (a) => f2(a.avg)],
      ['Average win ÷ average loss', (a) => f2(a.payoff)], ['Profit factor', (a) => f2(a.pf)], ['Total R', (a) => sg(a.R)], ['Worst fall, closed trades (R)', (a) => f1(a.dd)],
      ['Worst fall, open trades counted (R)', (a) => f1(a.mdd)], ['R ÷ worst fall (open)', (a) => f1(rdd(a))], ['Longest losing streak', (a) => String(a.ls)],
      ['Longest time under old high (days)', (a) => n0(a.underDays)], ['Losing months', (a) => pc(a.losingMonths)], ['Worst month (R)', (a) => sg(a.worstMonth)],
      ['Best month (R)', (a) => sg(a.bestMonth)], ['Positive years', (a) => `${a.posYears}/${a.nYears}`], ['Total R without best 10 trades', (a) => sg(a.ex10)],
      ['Longs / shorts (R)', (a) => `${sg(a.longs)} / ${sg(a.shorts)}`], ['Average hold (days)', (a) => f1(a.hold / 24)]].map(([n, fn]) => [n, ...ORDER.map((i) => fn(A(i, set)))]),
    ['Total R at double costs', ...ORDER.map((i) => sg(R.solo[i][set].two.R))],
    ['Total R since 2024', ...ORDER.map((i) => sg(R.solo[i][set].oos.R))],
    ['Worst fall since 2024, open (R)', ...ORDER.map((i) => f1(R.solo[i][set].oos.mdd))],
  ],
});
T.own = full('own'); T.main = full('main'); T.hold = full('hold');
T.money = {
  head: ['Money account (US$750 start, one bot alone)', ...ORDER.map((i) => NAME[i])],
  rows: [['Growth per year (backtest, not a forecast)', (m) => pc(m.real.cagr)], ['Worst fall, open trades counted', (m) => pc(m.real.dd)], ['Growth per year ÷ worst fall', (m) => f1(m.real.calmar)],
    ['Sharpe (daily, yearly)', (m) => f2(m.real.sharpe)], ['Sortino (daily, yearly)', (m) => f2(m.real.sortino)], ['Ulcer index (lower = calmer)', (m) => f2(m.real.ulcer)],
    ['Profit factor (money)', (m) => f2(m.real.pf)], ['Losing months', (m) => pc(m.real.losingMonths)], ['Worst month', (m) => pc(m.real.worstMonth)], ['Longest time under old high (days)', (m) => n0(m.real.underDays)],
    ['Orders too small / no margin', (m) => String(m.real.skipped)], ['12-month runs: middle return', (m) => spc(m.w.medRet)], ['12-month runs: bad case (1 in 10)', (m) => spc(m.w.p10Ret)],
    ['12-month runs: worst', (m) => spc(m.w.worstRet)], ['12-month runs ending in profit', (m) => pc(m.w.profitable)], ['12-month runs: middle worst fall', (m) => pc(m.w.medDD)],
    ['12-month runs: deepest fall', (m) => pc(m.w.worstDD)], ['12-month runs that fell over 40%', (m) => pc(m.w.dd40)], ['Same typical fall (30%): middle 12-month return', (m) => spc(m.typical.medRet)],
    ['Same typical fall: bad case (1 in 10)', (m) => spc(m.typical.p10Ret)], ['Same worst fall (40%): growth per year', (m) => pc(m.matched.cagr)], ['Growth per year at double costs', (m) => pc(m.two.cagr)]].map(([n, fn]) => [n, ...ORDER.map((i) => fn(M(i)))]),
};
const yearTable = (set) => ({ head: ['Strategy', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], rows: ORDER.map((i) => [NAME[i], ...Object.values(A(i, set).years).map(sg)]) });
T.yearOwn = yearTable('own'); T.yearMain = yearTable('main'); T.yearHold = yearTable('hold');
T.yearMoney = { head: ['Strategy', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], rows: ORDER.map((i) => [NAME[i], ...Object.values(M(i).real.years).map((y) => `${spc(y.ret)} / ${pc(y.dd)}`)]) };
const CI = [...ORDER, 'ic', 'tc'];
T.corr = { head: ['', ...CI.map((i) => NAME[i])], rows: CI.map((a) => [NAME[a], ...CI.map((b) => f2(R.corr[a][b]))]) };
T.rel = { head: ['Strategy', 'Monthly link with today\'s 3-bot mix', 'Trades taken while a live bot already holds the same coin and side', 'Losing months of the mix where this one made money', 'Its total R in those months'],
  rows: ORDER.map((i) => { const v = R.versusLive[i]; return [NAME[i], f2(v.corr), pc(v.sameTrade), `${v.helped} of ${v.badMonths}`, sg(v.badSum)]; }) };
const P = (k) => R.port[k];
T.port = {
  head: ['Measure', ...PKEYS.map((k) => SHORT[k])],
  rows: [['Growth per year (backtest)', (p) => pc(p.real.cagr)], ['Worst fall, open trades counted', (p) => pc(p.real.dd)], ['Growth per year ÷ worst fall', (p) => f1(p.real.calmar)], ['Sharpe', (p) => f2(p.real.sharpe)],
    ['Sortino', (p) => f2(p.real.sortino)], ['Ulcer index (lower = calmer)', (p) => f2(p.real.ulcer)], ['Profit factor (money)', (p) => f2(p.real.pf)], ['Win rate', (p) => pc(p.real.win)], ['Trades', (p) => n0(p.real.taken)],
    ['Losing months', (p) => pc(p.real.losingMonths)], ['Worst month', (p) => pc(p.real.worstMonth)], ['Longest time under old high (days)', (p) => n0(p.real.underDays)],
    ['12-month runs: middle return', (p) => spc(p.w.medRet)], ['12-month runs: bad case (1 in 10)', (p) => spc(p.w.p10Ret)], ['12-month runs: worst', (p) => spc(p.w.worstRet)], ['12-month runs ending in profit', (p) => pc(p.w.profitable)],
    ['12-month runs: middle worst fall', (p) => pc(p.w.medDD)], ['12-month runs: deepest fall', (p) => pc(p.w.worstDD)], ['12-month runs that fell over 40%', (p) => pc(p.w.dd40)],
    ['Runs that earned more than today', (p, k) => (k === 'today' ? '-' : pc(p.w.beatRet))], ['Runs that fell less than today', (p, k) => (k === 'today' ? '-' : pc(p.w.beatDD))],
    ['Runs starting 2024 or later: middle return / fall', (p) => `${spc(p.w24.medRet)} / ${pc(p.w24.medDD)}`], ['Since 2024: growth per year / worst fall', (p) => `${pc(p.since24.cagr)} / ${pc(p.since24.dd)}`],
    ['Double costs: growth per year / worst fall', (p) => `${pc(p.two.cagr)} / ${pc(p.two.dd)}`], ['SAME RISK (typical fall): middle 12-month return', (p) => spc(p.typical.medRet)],
    ['SAME RISK (typical fall): bad case (1 in 10)', (p) => spc(p.typical.p10Ret)], ['SAME RISK (single worst fall): growth per year', (p) => pc(p.matched.cagr)],
    ['Reshuffled 2-year paths: earned more than today', (p, k) => (k === 'today' ? '-' : pc(R.reshuffle[k].beatRet))], ['Reshuffled 2-year paths: fell less than today', (p, k) => (k === 'today' ? '-' : pc(R.reshuffle[k].beatDD))],
  ].map(([n, fn]) => [n, ...PKEYS.map((k) => fn(P(k), k))]),
};
T.yearPort = { head: ['Mix', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], rows: PKEYS.map((k) => [SHORT[k], ...Object.values(P(k).real.years).map((y) => `${spc(y.ret)} / ${pc(y.dd)}`)]) };
const starts = [...new Set(R.sizes.map((x) => x.start))];
T.sizes = { head: ['Starting money', ...PKEYS.map((k) => SHORT[k])], rows: starts.map((st) => ['US$' + n0(st), ...PKEYS.map((k) => { const x = R.sizes.find((s) => s.start === st && s.key === k); return `${pc(x.skipped, 1)} skipped, fall ${pc(x.medDD)}`; })]) };
T.checks = { head: ['Number already in the repo', 'Published', 'Re-run here'], rows: R.checks.map((c) => [c.name, sg(c.published), sg(c.full)]) };

const HOW = `Same basis for all: entries from Jan 1 2020, exits to Nov 24 2026, open trades valued every hour, Binance candles + real funding, fee 0.05% + slippage 0.02% per side. All four BB versions trade ${R.meta.live6.join(', ')}; I-CORE ${R.meta.run.ic.length} coins, T-CORE ${R.meta.run.tc.length}. Money tests use live sizing (2.5% risk, 2% from $500 base, 1.5% from $1,000), shared sizing across sub-accounts, quarterly rebalance, MEXC minimum orders, start US$${R.meta.capital}.`;
const TERMS = 'R = profit or loss in units of the amount risked (+2R = made twice what was risked). Profit factor = money won ÷ money lost. Worst fall = biggest drop from a high point, open trades counted. Same typical fall / same worst fall = risk per trade turned up or down until each one falls the same, then compare what it earns.';

// ---------- markdown ----------
const strip = (s) => s.replace(/<\/?b>/g, '**');
const cell = (c) => (typeof c === 'object' ? (c.best ? `**${c.v}**` : c.v) : c);
const mdT = (x) => ['| ' + x.head.join(' | ') + ' |', '|' + '---|'.repeat(x.head.length), ...x.rows.map((r) => '| ' + r.map(cell).join(' | ') + ' |'), ''].join('\n');
const SECTIONS = [
  ['Scorecard (bold = best on that line)', T.score], ['All measures, 6 live coins', T.own], ['Money account, one BB version alone', T.money],
  ['R per year, 6 live coins', T.yearOwn], ['Money per year: return / worst fall inside the year', T.yearMoney],
  ['12 main coins', T.main], ['R per year, 12 main coins', T.yearMain], ['12 hold-out coins (never used to pick the BB rules)', T.hold], ['R per year, 12 hold-out coins', T.yearHold],
  ['Do they move together? (monthly R, 1.00 = identical)', T.corr], ['Against today\'s 3-bot mix', T.rel],
  ['Mixes with I-CORE and T-CORE', T.port], ['Mixes per year: return / worst fall', T.yearPort], ['Can a small account still place the orders? (12-month runs from 2024)', T.sizes], ['Check against published numbers', T.checks],
];
fs.writeFileSync(__dirname + '/RESULTS.md', ['# BB-CORE 4H vs 1H: every version side by side, and with I-CORE + T-CORE (Nov 26, 2026)', '', HOW, '', TERMS, '', '## Verdict', '', ...V.verdict.map((v) => '- ' + strip(v)), '',
  ...SECTIONS.flatMap(([h, x]) => ['## ' + h, '', mdT(x)]), '## Read before trusting', '', ...V.caveats.map((c) => '- ' + c), '', 'Scripts: `study.js` (numbers, `results.json`), `report.js` (this file and `report.html`), verdict text in `verdict.json`.', ''].join('\n'));

// ---------- html ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const tbl = (x, cls = '') => `<div class="scroll"><table class="${cls}"><thead><tr>${x.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.rows.map((r) => `<tr>${r.map((c) => (typeof c === 'object' ? `<td${c.best ? ' class="best"' : ''}>${esc(c.v)}${c.best ? ' ★' : ''}</td>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
function bars(title, note, rows) {
  const W = 460, L = 160, RH = 26, max = Math.max(...rows.map((r) => r.v)), sc = (v) => (Math.max(0, v) / max) * (W - L - 66);
  return `<figure><figcaption><b>${esc(title)}</b><span>${esc(note)}</span></figcaption><svg viewBox="0 0 ${W} ${rows.length * RH + 4}" role="img" aria-label="${esc(title)}">${rows.map((r, i) => { const y = i * RH + 4, w = Math.max(5, sc(r.v));
    return `<g class="row" data-tip="${esc(r.label + ': ' + r.text)}"><rect class="hit" x="0" y="${y - 3}" width="${W}" height="${RH}"/><text x="${L - 8}" y="${y + 13}" text-anchor="end">${esc(r.label)}</text><path class="${r.cls}" d="M${L} ${y}h${w - 4}a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h${-(w - 4)}z"/><text class="val" x="${L + w + 6}" y="${y + 13}">${esc(r.text)}</text></g>`; }).join('')}<line class="axis" x1="${L}" x2="${L}" y1="0" y2="${rows.length * RH + 2}"/></svg></figure>`;
}
const soloBars = (title, note, fn, fm) => bars(title, note, S.map((s) => ({ label: s.name, v: fn(s.id), text: fm(fn(s.id)), cls: s.id === 'bb' ? 'c1' : 'c2' })).sort((a, b) => b.v - a.v));
const portBars = (title, note, fn, fm) => bars(title, note, PKEYS.map((k) => ({ label: BAR[k], v: fn(P(k)), text: fm(fn(P(k))), cls: k === 'today' ? 'c1' : 'cm' })));
const det = (h, body) => `<details><summary>${esc(h)}</summary>${body}</details>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BB-CORE 4H vs 1H</title><style>
:root{--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e1e0d9;--axis:#c3c2b7;--c1:#2a78d6;--c2:#eb6834;--cm:#a5a49c}
@media (prefers-color-scheme:dark){:root{--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;--axis:#383835;--c1:#3987e5;--c2:#d95926;--cm:#6b6a64}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1080px;margin:0 auto;padding:24px 16px 60px}h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin:34px 0 8px}p,li{color:var(--ink2)}li b{color:var(--ink)}
.verdict{background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:6px 18px}
.scroll{overflow-x:auto;border:1px solid var(--grid);border-radius:10px;background:var(--surface);margin:8px 0}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:6px 10px;border-bottom:1px solid var(--grid);text-align:right;vertical-align:top}
th:first-child,td:first-child{text-align:left;position:sticky;left:0;background:var(--surface);min-width:150px}th{color:var(--ink2);font-weight:600}tr:last-child td{border-bottom:0}
td.best{font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:14px}figure{margin:0;background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:12px}
figcaption span{display:block;color:var(--ink2);font-size:12px;margin-bottom:8px}svg{width:100%;height:auto;display:block}svg text{fill:var(--ink2);font-size:12px}svg text.val{fill:var(--ink)}
.c1{fill:var(--c1)}.c2{fill:var(--c2)}.cm{fill:var(--cm)}.axis{stroke:var(--axis)}.hit{fill:transparent}.row:hover .hit{fill:var(--grid);opacity:.5}
.key{display:flex;gap:16px;font-size:13px;color:var(--ink2);margin:6px 0}.key i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px}
details{margin:10px 0}summary{cursor:pointer;font-weight:600}#tip{position:fixed;pointer-events:none;background:var(--ink);color:var(--page);padding:5px 9px;border-radius:6px;font-size:12px;display:none}
</style></head><body><main>
<h1>BB-CORE 4H vs 1H</h1><p>${esc(HOW)}</p><p>${esc(TERMS)}</p>
<h2>Verdict</h2><div class="verdict"><ul>${V.verdict.map((v) => `<li>${v}</li>`).join('')}</ul></div>
<h2>Scorecard, best to worst (left to right)</h2><p>★ = best on that line. The average rank counts every line equally.</p>${tbl(T.score)}
<div class="key"><span><i style="background:var(--c1)"></i>Live v4</span><span><i style="background:var(--c2)"></i>Other versions</span></div><div class="grid">
${soloBars('Same typical fall: return in a middle year', 'Risk set so each one\'s typical 12-month fall is 30%.', (i) => M(i).typical.medRet, spc)}
${soloBars('Same worst fall (40%): growth per year', 'Risk set so each one\'s single worst fall is 40%.', (i) => M(i).matched.cagr, pc)}
${soloBars('Account worst fall at live sizing (shorter is better)', 'Run alone, 2020 to Nov 2026.', (i) => M(i).real.dd, pc)}
${soloBars('12 hold-out coins: R per R of fall', 'Coins never used to pick the BB rules.', (i) => rdd(R.solo[i].hold.all), f1)}</div>
${det('All measures, 6 live coins', tbl(T.own))}${det('Money account measures', tbl(T.money))}${det('12 main coins', tbl(T.main))}${det('12 hold-out coins', tbl(T.hold))}
<h2>Year by year</h2><p>Total R, 6 live coins</p>${tbl(T.yearOwn)}<p>Total R, 12 hold-out coins</p>${tbl(T.yearHold)}${det('Total R, 12 main coins', tbl(T.yearMain))}${det('Money: return / worst fall inside each year', tbl(T.yearMoney))}
<h2>Do they move together?</h2>${tbl(T.corr)}${tbl(T.rel)}
<h2>Mixed with I-CORE and T-CORE</h2><p>Blue = what runs today. Every BB version trades the same 6 coins, so two BB bots often hold the same trade at once.</p><div class="grid">
${portBars('Same typical fall: return in a middle year', 'Typical 12-month fall matched to today.', (p) => p.typical.medRet, spc)}
${portBars('Same worst fall: growth per year', 'Single worst fall matched to today.', (p) => p.matched.cagr, pc)}
${portBars('Worst fall at live sizing (shorter is better)', '2020 to Nov 2026.', (p) => p.real.dd, pc)}
${portBars('Growth per year at live sizing', 'Backtest scale. More growth can simply mean more risk.', (p) => p.real.cagr, pc)}</div>
${tbl(T.port)}${det('Per year: return / worst fall', tbl(T.yearPort))}${det('Small accounts: skipped orders', tbl(T.sizes))}
<h2>Read before trusting</h2><ul>${V.caveats.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>${det('Check: numbers already in the repo, re-run here', tbl(T.checks))}
</main><div id="tip"></div><script>const tip=document.getElementById('tip');document.querySelectorAll('[data-tip]').forEach(e=>{e.addEventListener('mousemove',v=>{tip.textContent=e.dataset.tip;tip.style.display='block';tip.style.left=Math.min(v.clientX+12,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=(v.clientY+14)+'px'});e.addEventListener('mouseleave',()=>tip.style.display='none')});</script></body></html>`;
fs.writeFileSync(__dirname + '/report.html', html);
for (const x of [T.score, T.own, T.money, T.yearOwn, T.yearHold, T.hold, T.corr, T.rel, T.port, T.yearPort, T.checks]) console.log(mdT(x));
