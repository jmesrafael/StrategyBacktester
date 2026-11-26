// report.js - results.json -> RESULTS.md + report.html. Run after run.js.
'use strict';
const fs = require('fs');
const R = require('./results.json'), L = R.lineups, B = L.base;
const pc = (v) => Math.round(100 * v) + '%', sg = (v) => (v >= 0 ? '+' : '') + Math.round(v), f1 = (v) => v.toFixed(1);
const php = (v) => '₱' + (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : Math.round(v).toLocaleString('en-US'));
const KEYS = ['base', '+DOT', '+LINK', '+ONE', '+XTZ', '+DOT+LINK', '+ONE+XTZ', '+4', 'live6', 'live6+DOT+LINK'];
// stability rule (owner, Nov 12 2026): an added coin must not make losing months or the fall (trade by trade) worse
const rule = (k) => { if (k === 'base') return '-'; const x = L[k].r, ref = k.startsWith('live6+') ? L.live6.r : B.r; return x.losing <= ref.losing + 0.005 && x.dd <= ref.dd * 1.02 ? 'PASS' : 'FAIL'; };
const T = {};
T.main = { head: ['Lineup', 'Total R', 'Worst fall (R)', 'R ÷ fall', 'Losing months', 'Worst month (R)', 'Stability rule', '₱1,000 same total risk: end (fall)', '₱1,000 at the same 40% worst fall', 'Since 2024, same total risk: end (fall)'],
  rows: KEYS.map((k) => { const x = L[k]; return [x.name, sg(x.r.R), f1(x.r.dd), f1(x.r.rdd), pc(x.r.losing), f1(x.r.worstMonth), rule(k), `${php(x.scaled.end)} (${pc(x.scaled.mdd)})`, php(x.f40.end), `${php(x.late.end)} (${pc(x.late.mdd)})`]; }) };
T.same = { head: ['Lineup', 'Same risk per trade (2.5% each, more coins = more risk): end', 'Worst fall'], rows: KEYS.map((k) => [L[k].name, php(L[k].same.end), pc(L[k].same.mdd)]) };
T.coins = { head: ['Coin', 'Total R', 'R 2020-2023', 'R 2024-Nov 2026', 'Monthly link with your 5 (1.00 = same)', 'Your 5\'s losing months it made money in', 'MEXC volume / day'],
  rows: R.meta.cand.map((c) => { const v = R.coins[c], l = R.meta.liq[c]; return [c, sg(v.R), sg(v.early), sg(v.late), v.corrBase.toFixed(2), v.helpsInBadMonths, l >= 1e6 ? '$' + Math.round(l / 1e6) + 'M' : '$' + Math.round(l / 1e3) + 'k']; }) };
const YRS = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
T.years = { head: ['Lineup', ...YRS], rows: KEYS.map((k) => [L[k].name, ...YRS.map((y) => sg(L[k].r.yr[y] || 0))]) };

const VERD = [
  ['DOT', 'NOT WORTH IT', `Fails the stability rule (losing months ${pc(L['+DOT'].r.losing)} vs ${pc(B.r.losing)}, fall ${f1(L['+DOT'].r.dd)}R vs ${f1(B.r.dd)}R). At the same total risk ${php(L['+DOT'].scaled.end)} vs ${php(B.scaled.end)}; since 2024 ${php(L['+DOT'].late.end)} vs ${php(B.late.end)}. Moves most like your 5 (link ${R.coins.DOT.corrBase.toFixed(2)}), made money in only ${R.coins.DOT.helpsInBadMonths} of their losing months.`],
  ['LINK', 'NOT WORTH IT (closest)', `Best of the four: at the same total risk the fall is a bit lower (${pc(L['+LINK'].scaled.mdd)} vs ${pc(B.scaled.mdd)}) and it helps in ${R.coins.LINK.helpsInBadMonths} of your losing months, but it ends lower (${php(L['+LINK'].scaled.end)} vs ${php(B.scaled.end)}), ties at the same 40% fall (${php(L['+LINK'].f40.end)} vs ${php(B.f40.end)}), loses since 2024 (${php(L['+LINK'].late.end)} vs ${php(B.late.end)}) and fails the rule on fall (${f1(L['+LINK'].r.dd)}R vs ${f1(B.r.dd)}R).`],
  ['ONE', 'NOT WORTH IT', `Best since 2024 (${php(L['+ONE'].late.end)} vs ${php(B.late.end)}) and slightly better R ÷ fall, but fails the rule (losing months ${pc(L['+ONE'].r.losing)}, fall ${f1(L['+ONE'].r.dd)}R), ends lower at the same total risk (${php(L['+ONE'].scaled.end)}) and much lower at the same 40% fall (${php(L['+ONE'].f40.end)}).`],
  ['XTZ', 'NOT WORTH IT', `Weakest: fails the rule, worst month ${f1(L['+XTZ'].r.worstMonth)}R vs ${f1(B.r.worstMonth)}R, ${php(L['+XTZ'].scaled.end)} at the same total risk, and only about US$${Math.round(R.meta.liq.XTZ / 1e3)}k traded a day on MEXC.`],
  ['All four together', 'NOT WORTH IT', `Fall more than doubles (${f1(L['+4'].r.dd)}R vs ${f1(B.r.dd)}R); same total risk ${php(L['+4'].scaled.end)}, same 40% fall ${php(L['+4'].f40.end)} vs ${php(B.f40.end)}.`],
  ['ARB (already live)', 'KEEP (narrow)', `Fall unchanged (${f1(L['+ARB'].r.dd)}R) but losing months up 2 points (${pc(L['+ARB'].r.losing)} vs ${pc(B.r.losing)}), so it narrowly fails the rule. Best R ÷ fall (${f1(L['+ARB'].r.rdd)}), best at the same 40% fall (${php(L['+ARB'].f40.end)}) and since 2024 (${php(L['+ARB'].late.end)} vs ${php(B.late.end)}), and it moves least like your 5 (link ${R.coins.ARB.corrBase.toFixed(2)}). Its full-period "same total risk" number is low only because ARB did not exist before 2023 while the other 5 ran at 5/6 risk.`],
];
T.verdict = { head: ['Coin', 'Worth adding?', 'Why'], rows: VERD };
const CAVEATS = [
  'BB 1H WIDE (Bollinger 80, 2.6 sigma, SMA800 trend, middle-band stop, 192-candle exit), Binance candles + funding, fee 0.05% + slippage 0.02% per side, Jan 1 2020 to Nov 24 2026, open trades valued hourly, MEXC minimum orders.',
  '"Same total risk" = risk per trade x 5 / number of coins, so a 7-coin lineup risks the same in total as your 5. "Same risk per trade" lets total risk grow with every coin: it always ends higher and always falls further, so it is shown only for reference.',
  'ONE (listed Mar 2021) and ARB (Mar 2023) did not exist for the whole period; the "same total risk" scaling still cut the other coins\' risk before they listed, which lowers those two lineups\' full-period numbers. For them the "Since 2024" column is the fair one. DOT, LINK and XTZ traded the whole period.',
  'Stability rule (your rule, Nov 12 2026): a coin joins only if the bot\'s losing months and its worst fall (trade by trade) do not get worse.',
  'The four candidates were found by looking at these same years (coin-fit-nov27), so even the results above flatter them.',
];
const strip = (s) => s;
const mdT = (x) => ['| ' + x.head.join(' | ') + ' |', '|' + '---|'.repeat(x.head.length), ...x.rows.map((r) => '| ' + r.join(' | ') + ' |'), ''].join('\n');
fs.writeFileSync(__dirname + '/RESULTS.md', ['# BB 1H WIDE: add DOT, LINK, ONE, XTZ to GALA SOL ADA NEAR ZEC? (Nov 27, 2026)', '', '## Verdict', '', mdT(T.verdict), '## All lineups', '', mdT(T.main), '## The candidate coins', '', mdT(T.coins), '## R per year', '', mdT(T.years), '## Same risk per trade (reference only)', '', mdT(T.same), '## Read before trusting', '', ...CAVEATS.map((c) => '- ' + c), '', 'Scripts: `run.js` (numbers, `results.json`), `report.js` (this file and `report.html`).', ''].join('\n'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const tbl = (x) => `<div class="scroll"><table><thead><tr>${x.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.rows.map((r) => `<tr>${r.map((c) => `<td class="${c === 'PASS' || c === 'KEEP' ? 'ok' : c === 'FAIL' || /^NOT/.test(c) ? 'bad' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
fs.writeFileSync(__dirname + '/report.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WIDE Coin Check</title><style>
:root{--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e1e0d9;--ok:#1f7a45;--bad:#c23b3a}
@media (prefers-color-scheme:dark){:root{--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;--ok:#4cc27e;--bad:#ef7676}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1100px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin:30px 0 8px}p,li{color:var(--ink2)}.scroll{overflow-x:auto;border:1px solid var(--grid);border-radius:10px;background:var(--surface);margin:8px 0}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:6px 10px;border-bottom:1px solid var(--grid);text-align:right;vertical-align:top}th:first-child,td:first-child{text-align:left}
th{color:var(--ink2);font-weight:600}tr:last-child td{border-bottom:0}td.ok{color:var(--ok);font-weight:700}td.bad{color:var(--bad);font-weight:700}td:last-child{white-space:normal}
</style></head><body><main><h1>BB 1H WIDE: add DOT, LINK, ONE, XTZ?</h1><p>Base lineup: GALA, SOL, ADA, NEAR, ZEC. ARB (live today) shown for comparison.</p>
<h2>Verdict</h2>${tbl(T.verdict)}<h2>All lineups</h2>${tbl(T.main)}<h2>The candidate coins</h2>${tbl(T.coins)}<h2>R per year</h2>${tbl(T.years)}<h2>Same risk per trade (reference only)</h2>${tbl(T.same)}
<h2>Read before trusting</h2><ul>${CAVEATS.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></main></body></html>`);
console.log(mdT(T.verdict)); console.log(mdT(T.main)); console.log(mdT(T.coins));
