// report.js - results.json -> RESULTS.md + report.html. Run after run.js.
'use strict';
const fs = require('fs');
const R = require('./results.json');
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], P = R.meta.pickable, IDS = ['wide', 'bb1h', 'bb4', 'ic', 'tc'];
const pc = (v) => Math.round(100 * v) + '%', sg = (v) => (v >= 0 ? '+' : '') + Math.round(v), f1 = (v) => v.toFixed(1);
const php = (v) => '₱' + (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : Math.round(v).toLocaleString('en-US'));
const liqT = (c) => { const v = R.meta.liq[c] || 0; return v >= 1e9 ? '$' + (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? '$' + Math.round(v / 1e6) + 'M' : '$' + Math.round(v / 1e3) + 'k'; };
const T = {};
for (const id of IDS) {
  const x = R.strats[id], live = R.meta.live[id];
  const rows = P.map((c) => [c, x.coins[c]]).sort((a, b) => b[1].pos / b[1].years.length - a[1].pos / a[1].years.length || b[1].R / (b[1].dd || 1) - a[1].R / (a[1].dd || 1));
  T['coins-' + id] = { head: ['Coin', ...YEARS.map(String), 'Positive years', 'Total R', 'Worst fall (R)', 'R ÷ fall', 'Trades', 'MEXC volume / day'],
    rows: rows.map(([c, v]) => [{ v: c + (live.includes(c) ? ' ●' : ''), live: live.includes(c) }, ...YEARS.map((y) => (v.years.includes(y) ? sg(v.yr[y]) : '–')), `${v.pos}/${v.years.length}`, sg(v.R), f1(v.dd), f1(v.R / (v.dd || 1)), String(v.trades), liqT(c)]) };
  T['wf-' + id] = { head: ['Year judged', 'Coins to choose from', 'Positive every earlier year', '→ positive this year', 'Others → positive this year', 'Picked (best ' + x.N + ' of those)', 'Picked: average R per coin', 'Average coin: R', 'Live coins: R'],
    rows: x.wf.map((w) => [String(w.Y), String(w.nPool), String(w.passed.n), pc(w.passed.pos), pc(w.failed.pos), w.top.coins.join(' '), f1(w.top.avg), f1(w.all.avg), f1(w.live.avg)]) };
}
const agg = (id, k) => { const w = R.strats[id].wf; return w.reduce((p, x) => p + x[k].pos * x[k].n, 0) / w.reduce((p, x) => p + x[k].n, 0); };
const NAME = Object.fromEntries(IDS.map((i) => [i, R.strats[i].name]));
T.prob = { head: ['Strategy', 'Coin positive every year so far → positive next year', 'Any other coin → positive next year', 'Gap'], rows: IDS.map((i) => [NAME[i], pc(agg(i, 'passed')), pc(agg(i, 'failed')), sg(100 * (agg(i, 'passed') - agg(i, 'failed'))) + ' points']) };
T.best = { head: ['Strategy', 'Live coins', 'Tradable coins positive in every year (5+ years of history), best first', '3-year coins positive every year (2024-26)'],
  rows: IDS.map((i) => [NAME[i], R.meta.live[i].join(' '), R.strats[i].hind.join(' ') || '–', P.filter((c) => R.strats[i].coins[c].years.length === 3 && R.strats[i].coins[c].pos === 3).join(' ') || '–']) };
T.money = { head: ['Strategy', 'Live coins', 'Picked each Jan 1 (earlier years only)', 'Random coins: middle (1 in 10 to 9 in 10)', 'Hindsight: best coins positive all years', 'Picked beat this share of random sets'],
  rows: IDS.map((i) => { const m = R.strats[i].money; return [NAME[i], `${php(m.live.end)} (fall ${pc(m.live.mdd)})`, `${php(m.wf.end)} (fall ${pc(m.wf.mdd)})`, `${php(m.rand.medEnd)} (${php(m.rand.p10)} to ${php(m.rand.p90)}), fall ${pc(m.rand.medDD)}`, `${php(m.hind.end)} (fall ${pc(m.hind.mdd)})`, pc(m.rand.wfRank)]; }) };
T.split = { head: ['Strategy', 'Best ' + '6/8 picked on 2020-2023 (each year positive)', 'Their R 2024 / 2025 / 2026', 'Picked: average R per coin 2024-26', 'Average coin', 'Live coins'],
  rows: IDS.map((i) => { const s = R.strats[i].split; return [NAME[i], s.top.map((r) => r.c).join(' '), s.top.map((r) => `${r.c} ${r.afterYears.map(sg).join('/')}`).join(', '), f1(s.avgAfterTop), f1(s.avgAfterAll), f1(s.avgAfterLive)]; }) };

const W = R.strats.wide;
const VERDICT = [
  `<b>Your live coins are already the best WIDE coins.</b> Of ${P.length} coins MEXC trades enough, ${W.hindCount} were positive in every year with WIDE: ${W.hind.join(', ')}. The top 5 (GALA, SOL, ADA, NEAR, ZEC) are already live; the 6th live coin, ARB, is positive all 3 years it has existed (+3 / +12 / +31R).`,
  `<b>Swapping coins in by hindsight does not help.</b> The 6 best "positive every year" coins (live 5 + DOT instead of ARB) turn ₱1,000 on Jan 1 2022 into ${php(W.money.hind.end)} (fall ${pc(W.money.hind.mdd)}), the live 6 into ${php(W.money.live.end)} (fall ${pc(W.money.live.mdd)}).`,
  `<b>"Positive every year so far" does carry forward for the BB family, but only partly.</b> For WIDE, such a coin was positive the next year ${pc(agg('wide', 'passed'))} of the time, other coins ${pc(agg('wide', 'failed'))}. BB 1H ${pc(agg('bb1h', 'passed'))} vs ${pc(agg('bb1h', 'failed'))}, BB 4H v4 ${pc(agg('bb4', 'passed'))} vs ${pc(agg('bb4', 'failed'))}; for I-CORE it barely works (${pc(agg('ic', 'passed'))} vs ${pc(agg('ic', 'failed'))}). So roughly 1 in 5 "every year positive" coins still loses the next year.`,
  `<b>Picking coins that way each year, honestly (only earlier years), lost to the live coins badly:</b> WIDE ₱1,000 from 2022 → ${php(W.money.wf.end)} with a ${pc(W.money.wf.mdd)} fall, vs ${php(W.money.live.end)} on the live coins. It still beat ${pc(W.money.rand.wfRank)} of random coin sets. The picks of 2023 (ETC, DOGE, FIL, BTC...) and coins like FIL later turned negative.`,
  `<b>Why the live coins look so good:</b> they beat every one of 200 random coin sets for every strategy. Part of that is real fit, part is that they were chosen (Oct-Nov 2026) after seeing these same years. Expect future coins, including today's, to do closer to the "average coin" column.`,
  `<b>Suggestion:</b> keep the live 6 on WIDE (and on BB). Do not add or remove coins on this evidence. If a coin is ever added, the candidates for WIDE are LINK (7/7, R ÷ fall 4.7) and DOT (6/6, 4.8), both with good volume; each still needs the stability rule check (adding must not make the bot's losing months or fall worse).`,
];
const CAVEATS = [
  'R per coin uses the bots\' own engines, Binance candles + funding, fee 0.05% + slippage 0.02% per side, entries from Jan 1 2020, exits to Nov 24 2026. A year counts for a coin only if it was listed by Feb 15 of that year.',
  `Only coins with a MEXC contract and at least US$500k traded a day (MEXC snapshot Nov 12 2026) can be picked; live coins always. That leaves ${P.length} of ${R.meta.coins}. Today's volume is itself hindsight for earlier years.`,
  'The money test starts Jan 1 2022 (picks need 2 earlier years), live sizing (2.5% / 2% / 1.5%), MEXC minimum orders, open trades valued hourly. Amounts are backtest compounding: compare lines, do not expect them.',
  'Five test years is a small sample; one bad pick year (2023) drives much of the gap.',
];

// ---------- markdown ----------
const strip = (s) => s.replace(/<\/?b>/g, '**');
const cell = (c) => (typeof c === 'object' ? c.v : c);
const mdT = (x) => ['| ' + x.head.join(' | ') + ' |', '|' + '---|'.repeat(x.head.length), ...x.rows.map((r) => '| ' + r.map(cell).join(' | ') + ' |'), ''].join('\n');
const md = ['# Which coins suit each strategy (Nov 27, 2026)', '', 'R = profit or loss in units of the amount risked. ● = coin the bot trades live. Coins sorted by share of positive years, then R ÷ worst fall.', '', '## Verdict', '', ...VERDICT.map((v) => '- ' + strip(v)), '',
  '## Does "positive every year so far" predict next year? (2022-2026, picks use earlier years only)', '', mdT(T.prob), '## Coins positive every year (hindsight)', '', mdT(T.best),
  '## PHP 1,000 from Jan 1 2022', '', mdT(T.money), '## One split: pick on 2020-2023, judge 2024 - Nov 2026', '', mdT(T.split),
  ...IDS.flatMap((i) => [`## ${NAME[i]}: R per coin per year`, '', mdT(T['coins-' + i]), `## ${NAME[i]}: picking coins each year`, '', mdT(T['wf-' + i])]),
  '## Read before trusting', '', ...CAVEATS.map((c) => '- ' + c), '', 'Scripts: `run.js` (numbers, `results.json`), `report.js` (this file and `report.html`).', ''];
fs.writeFileSync(__dirname + '/RESULTS.md', md.join('\n'));

// ---------- html ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const heat = (s) => { const v = parseFloat(s); if (isNaN(v) || !/^[+-]\d/.test(s)) return ''; const a = Math.min(45, Math.round(Math.abs(v) * 1.6)); return ` style="background:color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${a}%, var(--surface))"`; };
const tbl = (x, hm) => `<div class="scroll"><table><thead><tr>${x.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.rows.map((r) => `<tr>${r.map((c, j) => typeof c === 'object' ? `<td class="${c.live ? 'live' : ''}">${esc(c.v)}</td>` : `<td${hm && j >= 1 && j <= 7 ? heat(c) : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const det = (h, b, open) => `<details${open ? ' open' : ''}><summary>${esc(h)}</summary>${b}</details>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coin Fit Study</title><style>
:root{--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e1e0d9;--up:#2a9d5c;--down:#e34948;--c1:#2a78d6}
@media (prefers-color-scheme:dark){:root{--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;--up:#3fb871;--down:#e66767;--c1:#3987e5}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 60px}h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin:34px 0 8px}p,li{color:var(--ink2)}li b{color:var(--ink)}
.verdict{background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:6px 18px}
.scroll{overflow-x:auto;border:1px solid var(--grid);border-radius:10px;background:var(--surface);margin:8px 0}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:5px 9px;border-bottom:1px solid var(--grid);text-align:right;vertical-align:top;white-space:nowrap}
th:first-child,td:first-child{text-align:left;position:sticky;left:0;background:var(--surface)}th{color:var(--ink2);font-weight:600;white-space:normal}tr:last-child td{border-bottom:0}
td.live{font-weight:700;color:var(--c1)}details{margin:10px 0}summary{cursor:pointer;font-weight:600}
</style></head><body><main>
<h1>Which coins suit each strategy</h1><p>All 90 coins in the candle library, 5 strategies, 2020 to Nov 24 2026. Green = positive year, red = losing year, stronger = bigger. Blue coin with ● = traded live.</p>
<h2>Verdict</h2><div class="verdict"><ul>${VERDICT.map((v) => `<li>${v}</li>`).join('')}</ul></div>
<h2>BB 1H WIDE: R per coin per year</h2>${tbl(T['coins-wide'], true)}${det('WIDE: picking coins each year with earlier years only', tbl(T['wf-wide']))}
<h2>Does "positive every year so far" predict next year?</h2>${tbl(T.prob)}
<h2>₱1,000 from Jan 1 2022, by coin choice</h2>${tbl(T.money)}
<h2>Coins positive every year (hindsight)</h2>${tbl(T.best)}${det('One split: pick on 2020-2023, judge 2024 - Nov 2026', tbl(T.split))}
<h2>The other strategies</h2>${IDS.slice(1).map((i) => det(NAME[i] + ': R per coin per year', tbl(T['coins-' + i], true)) + det(NAME[i] + ': picking coins each year', tbl(T['wf-' + i]))).join('')}
<h2>Read before trusting</h2><ul>${CAVEATS.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
</main></body></html>`;
fs.writeFileSync(__dirname + '/report.html', html);
console.log(mdT(T.prob)); console.log(mdT(T.money)); console.log(mdT(T.best)); console.log(VERDICT.map(strip).join('\n'));
