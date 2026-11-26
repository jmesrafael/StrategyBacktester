// report.js - results.json -> RESULTS.md + report.html. Run after run.js.
'use strict';
const fs = require('fs');
const R = require('./results.json'), A = R.mix.tri, B = R.mix.four, PHP = R.meta.php, YRS = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const pc = (v) => Math.round(100 * v) + '%', spc = (v) => (v >= 0 ? '+' : '') + Math.round(100 * v).toLocaleString('en-US') + '%', sg = (v) => (v >= 0 ? '+' : '') + Math.round(v).toLocaleString('en-US'), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
const php = (v) => '₱' + (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? Math.round(v / 1e3).toLocaleString('en-US') + 'k' : Math.round(v).toLocaleString('en-US'));
const better = (a, b, hi = true) => (Math.abs(a - b) < 1e-9 ? ['', ''] : (a > b) === hi ? ['win', ''] : ['', 'win']);
const row = (label, a, b, fm, hi = true) => { const w = better(a, b, hi); return [label, { v: fm(a), c: w[0] }, { v: fm(b), c: w[1] }, diff(a, b, fm, hi)]; };
const diff = (a, b, fm, hi) => { if (Math.abs(a - b) < 1e-9) return 'same'; return ((b > a) === hi ? '4 bots better' : 'TRI-CORE better'); };
const T = {};
const H2 = ['', 'TRI-CORE today', '4 bots (+ WIDE)', 'Which is better'];
T.summary = { head: H2, rows: [
  ['Bots and shares', 'BB 50% · I 25% · T 25%', 'BB 25% · I 25% · T 25% · WIDE 25%', ''],
  row('₱1,000 on Jan 1 2020 → Nov 24 2026', A.real.end * PHP, B.real.end * PHP, php),
  row('Growth per year', A.real.cagr, B.real.cagr, pc),
  row('Worst fall (open trades counted, hourly)', A.real.dd, B.real.dd, (v) => (100 * v).toFixed(1) + '%', false),
  row('Total R of the whole account (each trade × its bot\'s share)', A.pr.R, B.pr.R, sg),
  row('Worst fall in R, open trades counted', A.pr.mdd, B.pr.mdd, f1, false),
  row('Worst fall in R, closed trades', A.pr.dd, B.pr.dd, f1, false),
  row('R earned per R of worst fall', A.pr.R / A.pr.mdd, B.pr.R / B.pr.mdd, f1),
  ['Trades', A.pr.n.toLocaleString('en-US'), B.pr.n.toLocaleString('en-US'), '–'],
  row('Win rate', A.real.win, B.real.win, pc),
  row('Profit factor (money)', A.real.pf, B.real.pf, f2),
  row('Sharpe', A.real.sharpe, B.real.sharpe, f2),
  row('Losing months', A.real.losingMonths, B.real.losingMonths, pc, false),
  row('Worst month', A.real.worstMonth, B.real.worstMonth, pc),
  row('Longest time below an old high (days)', A.real.underDays, B.real.underDays, (v) => String(Math.round(v)), false),
  row('Orders skipped (too small for MEXC)', A.real.skipped, B.real.skipped, String, false),
  row('Any 12 months: middle return', A.w12.medRet, B.w12.medRet, spc),
  row('Any 12 months: worst return', A.w12.worstRet, B.w12.worstRet, spc),
  row('Any 12 months: deepest fall', A.w12.worstDD, B.w12.worstDD, pc, false),
  row('12-month stretches that fell over 50%', A.w12.dd50, B.w12.dd50, pc, false),
  row('Same worst fall (40%) for both: growth per year', A.matched.cagr, B.matched.cagr, pc),
] };
T.ends = { head: ['Year end', 'TRI-CORE today', '4 bots (+ WIDE)', 'Difference'], rows: YRS.map((y) => [y === '2026' ? 'Nov 24 2026' : 'Dec 31 ' + y, php(A.ends[y]), php(B.ends[y]), (B.ends[y] >= A.ends[y] ? '+' : '') + Math.round(100 * (B.ends[y] / A.ends[y] - 1)) + '%']) };
T.years = { head: ['Year', 'TRI-CORE: return', 'TRI-CORE: worst fall', '4 bots: return', '4 bots: worst fall', 'Better year'],
  rows: [...YRS.map((y) => { const a = A.real.years[y], b = B.real.years[y]; return [y, spc(a.ret), pc(a.dd), spc(b.ret), pc(b.dd), b.ret > a.ret ? '4 bots' : 'TRI-CORE']; }),
    ['Years won', '', '', '', '', `TRI-CORE ${YRS.filter((y) => A.real.years[y].ret >= B.real.years[y].ret).length} · 4 bots ${YRS.filter((y) => B.real.years[y].ret > A.real.years[y].ret).length}`]] };
const tot = (m) => YRS.reduce((p, y) => p + (m.pr.years[y] || 0), 0);
T.rYears = { head: ['Year', 'TRI-CORE: R', '4 bots: R'], rows: [...YRS.map((y) => [y, sg(A.pr.years[y]), sg(B.pr.years[y])]), ['Total', sg(tot(A)), sg(tot(B))]] };
const bot = (id) => R.bots[id];
const IDS = ['bb', 'ic', 'tc', 'wide'];
T.bots = { head: ['Bot', 'Coins', 'Total R', ...YRS, 'Worst fall (R)', 'Trades', 'Win rate', 'Share in TRI-CORE', 'Share in 4 bots'],
  rows: [...IDS.map((id) => { const b = bot(id); return [b.name, b.coins.join(' '), sg(b.R), ...YRS.map((y) => sg(b.years[y])), f1(b.mdd), b.n.toLocaleString('en-US'), pc(b.win), id === 'bb' ? '50%' : id === 'wide' ? '–' : '25%', '25%']; }),
    ['All bots added up (TRI-CORE)', '', sg(['bb', 'ic', 'tc'].reduce((p, i) => p + bot(i).R, 0)), ...YRS.map((y) => sg(['bb', 'ic', 'tc'].reduce((p, i) => p + bot(i).years[y], 0))), '', ['bb', 'ic', 'tc'].reduce((p, i) => p + bot(i).n, 0).toLocaleString('en-US'), '', '', ''],
    ['All bots added up (4 bots)', '', sg(IDS.reduce((p, i) => p + bot(i).R, 0)), ...YRS.map((y) => sg(IDS.reduce((p, i) => p + bot(i).years[y], 0))), '', IDS.reduce((p, i) => p + bot(i).n, 0).toLocaleString('en-US'), '', '', '']] };
T.check = { head: ['Check', 'TRI-CORE today', '4 bots (+ WIDE)'], rows: [
  ['US$750 start (as in four-bot-nov26): growth per year / worst fall', `${pc(A.big.cagr)} / ${pc(A.big.dd)}`, `${pc(B.big.cagr)} / ${pc(B.big.dd)}`],
  ['₱1,000 without MEXC minimum orders: end / worst fall', `${php(A.free.end * PHP)} / ${pc(A.free.dd)}`, `${php(B.free.end * PHP)} / ${pc(B.free.dd)}`]] };

const VERDICT = [
  `<b>TRI-CORE ends higher:</b> ₱1,000 → ${php(A.real.end * PHP)} vs ${php(B.real.end * PHP)} with 4 bots (${Math.round(100 * (1 - B.real.end / A.real.end))}% less), and it won ${YRS.filter((y) => A.real.years[y].ret >= B.real.years[y].ret).length} of 7 years.`,
  `<b>The worst fall is the same:</b> ${(100 * A.real.dd).toFixed(1)}% vs ${(100 * B.real.dd).toFixed(1)}%; in R ${f1(A.pr.mdd)} vs ${f1(B.pr.mdd)}. 4 bots is a little calmer along the way: losing months ${pc(B.real.losingMonths)} vs ${pc(A.real.losingMonths)}, deepest 12-month fall ${pc(B.w12.worstDD)} vs ${pc(A.w12.worstDD)}, and 12-month stretches that fell over 50%: ${pc(B.w12.dd50)} vs ${pc(A.w12.dd50)}.`,
  `<b>Total R:</b> the whole account earns ${sg(A.pr.R)}R with TRI-CORE and ${sg(B.pr.R)}R with 4 bots. Added up bot by bot, 4 bots trade more (${IDS.reduce((p, i) => p + bot(i).n, 0).toLocaleString('en-US')} vs ${['bb', 'ic', 'tc'].reduce((p, i) => p + bot(i).n, 0).toLocaleString('en-US')} trades), but each bot gets a smaller share, so the account total is lower.`,
  `<b>Set to the same 40% worst fall, they tie:</b> ${pc(A.matched.cagr)} vs ${pc(B.matched.cagr)} a year. WIDE mostly replaces half of BB-CORE with a near copy (their months move together, link 0.84), so it adds trades, not protection.`,
  `<b>Verdict: not worth adding the 4th bot now.</b> Same worst fall, ${Math.round(100 * (1 - B.real.end / A.real.end))}% less money, a slightly smoother ride, more trades to manage and a 4th MEXC sub-account. The gain is too small to act on. Keep TRI-CORE and let WIDE run on paper until the late-February 2027 review.`,
];
const CAVEATS = [
  'Live rules (BB-CORE v4 at 1.05x, I-CORE v3, T-CORE v3) and BB 1H WIDE 2.6σ; Binance candles + funding, fee 0.05% + slippage 0.02% per side; entries from Jan 1 2020, exits to Nov 24 2026, open trades valued every hour.',
  'One account with a sub-account per bot, sizing from the total times each bot\'s share, rebalanced every quarter, MEXC minimum orders (₱1,000 = US$16.67 at ₱60). Risk per trade 2.5%, 2% from a US$500 bot base, 1.5% from US$1,000.',
  'The money amounts are backtest compounding with perfect fills at any size. They are far above what to expect live. Use them only to compare the two lineups.',
  'The 71 twelve-month stretches overlap (about 7 separate years), so differences of a few percent are noise. The live rules were chosen in November 2026 on this same history.',
];
const strip = (s) => s.replace(/<\/?b>/g, '**');
const cell = (c) => (typeof c === 'object' ? c.v : c);
const mdT = (x) => ['| ' + x.head.join(' | ') + ' |', '|' + '---|'.repeat(x.head.length), ...x.rows.map((r) => '| ' + r.map(cell).join(' | ') + ' |'), ''].join('\n');
const SEC = [['Side by side, Jan 1 2020 to Nov 24 2026', T.summary], ['₱1,000 compounding: balance at each year end', T.ends], ['Each year on its own: return and worst fall', T.years], ['Total R of the whole account per year', T.rYears], ['Each bot, own coins', T.bots], ['Checks', T.check]];
fs.writeFileSync(__dirname + '/RESULTS.md', ['# TRI-CORE vs 4 bots (+ BB 1H WIDE): ₱1,000 from Jan 2020 (Nov 27, 2026)', '', 'Coins: BB-CORE and WIDE = GALA SOL ADA NEAR ZEC ARB; I-CORE = GALA SOL ADA NEAR ZEC ETH; T-CORE = GALA SOL ADA NEAR ZEC ETH SUI ARB.', '', '## Verdict', '', ...VERDICT.map((v) => '- ' + strip(v)), '', ...SEC.flatMap(([h, x]) => ['## ' + h, '', mdT(x)]), '## Read before trusting', '', ...CAVEATS.map((c) => '- ' + c), '', 'Scripts: `run.js` (numbers, `results.json`), `report.js` (this file and `report.html`).', ''].join('\n'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const tbl = (x) => `<div class="scroll"><table><thead><tr>${x.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.rows.map((r) => `<tr class="${/added up|^Total|Years won/.test(r[0]) ? 'tot' : ''}">${r.map((c) => (typeof c === 'object' ? `<td class="${c.c}">${esc(c.v)}${c.c ? ' ✓' : ''}</td>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
// year-end balance chart (log scale), two lines
const pts = (m) => YRS.map((y, i) => [i, Math.log10(m.ends[y])]);
const W = 640, Hh = 260, L = 64, Rr = 110, Tt = 14, Bb = 30, lo = 3, hi = 8, X = (i) => L + (i * (W - L - Rr)) / 6, Y = (v) => Tt + ((hi - v) * (Hh - Tt - Bb)) / (hi - lo);
const line = (m, cls) => `<path class="${cls}" fill="none" stroke-width="2" d="${pts(m).map(([i, v], j) => (j ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('')}"/>` + pts(m).map(([i, v]) => `<circle class="${cls}f" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4"><title>${YRS[i]}: ${php(10 ** v)}</title></circle>`).join('');
const chart = `<figure><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="₱1,000 balance at each year end, both lineups">${[3, 4, 5, 6, 7, 8].map((v) => `<line class="grid" x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${php(10 ** v)}</text>`).join('')}${YRS.map((y, i) => `<text x="${X(i)}" y="${Hh - 10}" text-anchor="middle">${y === '2026' ? 'Nov 26' : y}</text>`).join('')}${line(A, 'a')}${line(B, 'b')}<text class="lbl" x="${X(6) + 8}" y="${Y(Math.log10(A.ends['2026'])) - 4}">TRI-CORE ${php(A.ends['2026'])}</text><text class="lbl" x="${X(6) + 8}" y="${Y(Math.log10(B.ends['2026'])) + 14}">4 bots ${php(B.ends['2026'])}</text></svg><figcaption>₱1,000 on Jan 1 2020, balance at each year end (each grid line = 10x).</figcaption></figure>`;
fs.writeFileSync(__dirname + '/report.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TRI-CORE vs 4 Bots</title><style>
:root{--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e1e0d9;--a:#2a78d6;--b:#eb6834;--win:#1f7a45}
@media (prefers-color-scheme:dark){:root{--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;--a:#3987e5;--b:#d95926;--win:#4cc27e}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1000px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin:30px 0 8px}p,li{color:var(--ink2)}li b{color:var(--ink)}.verdict{background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:6px 18px}
.scroll{overflow-x:auto;border:1px solid var(--grid);border-radius:10px;background:var(--surface);margin:8px 0}table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
th,td{padding:6px 10px;border-bottom:1px solid var(--grid);text-align:right;vertical-align:top}th:first-child,td:first-child{text-align:left}th{color:var(--ink2);font-weight:600}tr:last-child td{border-bottom:0}
td.win{color:var(--win);font-weight:700}tr.tot td{font-weight:700;background:color-mix(in srgb,var(--grid) 40%,var(--surface))}
figure{margin:8px 0;background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:12px}figcaption{color:var(--ink2);font-size:12px}svg{width:100%;height:auto}svg text{fill:var(--ink2);font-size:11px}svg text.lbl{fill:var(--ink);font-size:12px}
.grid{stroke:var(--grid)}.a{stroke:var(--a)}.b{stroke:var(--b)}.af{fill:var(--a);stroke:var(--surface);stroke-width:2}.bf{fill:var(--b);stroke:var(--surface);stroke-width:2}
.key{display:flex;gap:16px;font-size:13px;color:var(--ink2)}.key i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px}
</style></head><body><main><h1>TRI-CORE vs 4 bots (+ BB 1H WIDE)</h1><p>₱1,000 from Jan 1 2020 to Nov 24 2026. Coins: BB-CORE and WIDE = GALA SOL ADA NEAR ZEC ARB; I-CORE = GALA SOL ADA NEAR ZEC ETH; T-CORE = GALA SOL ADA NEAR ZEC ETH SUI ARB. ✓ = better on that line.</p>
<h2>Verdict</h2><div class="verdict"><ul>${VERDICT.map((v) => `<li>${v}</li>`).join('')}</ul></div>
<h2>₱1,000 compounding</h2><div class="key"><span><i style="background:var(--a)"></i>TRI-CORE today</span><span><i style="background:var(--b)"></i>4 bots (+ WIDE)</span></div>${chart}
${SEC.map(([h, x]) => `<h2>${esc(h)}</h2>${tbl(x)}`).join('')}
<h2>Read before trusting</h2><ul>${CAVEATS.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></main></body></html>`);
for (const [h, x] of SEC) console.log('## ' + h + '\n' + mdT(x)); console.log(VERDICT.map(strip).join('\n'));
