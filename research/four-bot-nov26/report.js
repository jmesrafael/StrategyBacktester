// report.js - results.json -> RESULTS.md (every table) + report.html (verdict, charts, tables). Run after study.js.
'use strict';
const fs = require('fs');
const R = require('./results.json');
const S = R.meta.strats, NAME = Object.fromEntries(S.map((s) => [s.id, s.name])), isLive = (id) => ['bb', 'ic', 'tc'].includes(id);
const pc = (v, d = 0) => (100 * v).toFixed(d) + '%', spc = (v) => (v >= 0 ? '+' : '') + Math.round(100 * v) + '%';
const n0 = (v) => Math.round(v).toLocaleString('en-US'), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), sg = (v) => (v >= 0 ? '+' : '') + Math.round(v);
const A = (id, set = 'own') => R.solo[id][set].all, M = (id, k = 'own') => R.money[id][k];
const PKEYS = ['today', 'eq3', 'add-wide', 'add-bb1h', 'add-ichi', 'add-vol'];
const SHORT = { today: 'Today 50/25/25', eq3: 'Equal 3 (33 each)', 'add-wide': '+ BB-1H-WIDE (25 each)', 'add-bb1h': '+ BB-CORE 1h (25 each)', 'add-ichi': '+ ICHI-X4 (25 each)', 'add-vol': '+ VOL-MOM-2H (25 each)' };

// ---------- scorecard: rank 1 (best) to 7 on each measure, then the average ----------
const rdd = (o) => (o.mdd ? o.R / o.mdd : 0);
const MEASURES = [
  ['Profit factor', (i) => A(i).pf, 1, f2],
  ['R earned per R of worst fall', (i) => rdd(A(i)), 1, f1],
  ['Account worst fall', (i) => M(i).real.dd, -1, pc],
  ['Growth per year ÷ worst fall', (i) => M(i).real.calmar, 1, f1],
  ['Sharpe', (i) => M(i).real.sharpe, 1, f2],
  ['Sortino', (i) => M(i).real.sortino, 1, f2],
  ['Losing months', (i) => M(i).real.losingMonths, -1, pc],
  ['Worst month', (i) => M(i).real.worstMonth, 1, pc],
  ['Worst 12-month run', (i) => M(i).w.worstRet, 1, spc],
  ['12-month return at the same risk', (i) => M(i).typical.medRet, 1, spc],
  ['Profit kept at double costs', (i) => R.solo[i].own.two.R / A(i).R, 1, pc],
  ['12 hold-out coins: R per R of fall', (i) => rdd(R.solo[i].hold.all), 1, f1],
  ['Since 2024: R per R of fall', (i) => rdd(R.solo[i].own.oos), 1, f1],
];
const ranks = Object.fromEntries(S.map((s) => [s.id, []]));
for (const [, fn, dir] of MEASURES) {
  const v = S.map((s) => [s.id, fn(s.id)]);
  for (const [id, x] of v) ranks[id].push(1 + v.filter(([, y]) => (y - x) * dir > 1e-9).length);
}
const avgRank = Object.fromEntries(S.map((s) => [s.id, ranks[s.id].reduce((a, b) => a + b, 0) / MEASURES.length]));
const wins = Object.fromEntries(S.map((s) => [s.id, ranks[s.id].filter((r) => r === 1).length]));
const ORDER = S.map((s) => s.id).sort((a, b) => avgRank[a] - avgRank[b]);

// ---------- tables (shared by both outputs) ----------
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
T.own = full('own'); T.live6 = full('live6'); T.main = full('main'); T.hold = full('hold');
T.money = {
  head: ['Money account (US$750 start, one bot alone)', ...ORDER.map((i) => NAME[i])],
  rows: [['Growth per year (backtest, not a forecast)', (m) => pc(m.real.cagr)], ['Worst fall, open trades counted', (m) => pc(m.real.dd)], ['Growth per year ÷ worst fall', (m) => f1(m.real.calmar)],
    ['Sharpe (daily, yearly)', (m) => f2(m.real.sharpe)], ['Sortino (daily, yearly)', (m) => f2(m.real.sortino)], ['Ulcer index (lower = calmer)', (m) => f2(m.real.ulcer)],
    ['Profit factor (money)', (m) => f2(m.real.pf)], ['Losing months', (m) => pc(m.real.losingMonths)], ['Worst month', (m) => pc(m.real.worstMonth)], ['Longest time under old high (days)', (m) => n0(m.real.underDays)],
    ['Orders too small / no margin', (m) => String(m.real.skipped)], ['12-month runs: middle return', (m) => spc(m.w.medRet)], ['12-month runs: bad case (1 in 10)', (m) => spc(m.w.p10Ret)],
    ['12-month runs: worst', (m) => spc(m.w.worstRet)], ['12-month runs ending in profit', (m) => pc(m.w.profitable)], ['12-month runs: middle worst fall', (m) => pc(m.w.medDD)],
    ['12-month runs: deepest fall', (m) => pc(m.w.worstDD)], ['12-month runs that fell over 40%', (m) => pc(m.w.dd40)], ['Same risk (typical fall 30%): middle 12-month return', (m) => spc(m.typical.medRet)],
    ['Same risk: bad case (1 in 10)', (m) => spc(m.typical.p10Ret)], ['Growth per year at double costs', (m) => pc(m.two.cagr)]].map(([n, fn]) => [n, ...ORDER.map((i) => fn(M(i)))]),
};
const yearTable = (set) => ({ head: ['Strategy', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], rows: ORDER.map((i) => [NAME[i], ...Object.values(A(i, set).years).map(sg)]) });
T.yearOwn = yearTable('own'); T.yearHold = yearTable('hold');
T.yearMoney = { head: ['Strategy', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], rows: ORDER.map((i) => [NAME[i], ...Object.values(M(i).real.years).map((y) => `${spc(y.ret)} / ${pc(y.dd)}`)]) };
T.rel = { head: ['Strategy', 'Monthly link with today\'s 3-bot mix', 'Trades taken while another live bot already holds the same coin and side', 'Losing months of the mix where this one made money', 'Its total R in those months'],
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
    ['Reshuffled 2-year paths: earned more than today', (p, k) => (k === 'today' ? '-' : pc(R.reshuffle[k].beatRet))], ['Reshuffled 2-year paths: fell less than today (month-end values)', (p, k) => (k === 'today' ? '-' : pc(R.reshuffle[k].beatDD))],
  ].map(([n, fn]) => [n, ...PKEYS.map((k) => fn(P(k), k))]),
};
T.yearPort = { head: ['Mix', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], rows: PKEYS.map((k) => [SHORT[k], ...Object.values(P(k).real.years).map((y) => `${spc(y.ret)} / ${pc(y.dd)}`)]) };
const swaps = Object.keys(R.port).filter((k) => k.startsWith('swap'));
T.swaps = { head: ['Swap (3 bots, 33 each)', 'Growth per year', 'Worst fall', 'Losing months', 'Worst month', 'Same risk (typical): 12-month return', 'Same risk (worst fall): growth per year'],
  rows: [['Today 50/25/25', P('today')], ...swaps.map((k) => [P(k).name.replace(' (33 each)', ''), P(k)])].map(([n, p]) => [n, pc(p.real.cagr), pc(p.real.dd), pc(p.real.losingMonths), pc(p.real.worstMonth), spc(p.typical.medRet), pc(p.matched.cagr)]) };
const starts = [...new Set(R.sizes.map((x) => x.start))];
T.sizes = { head: ['Starting money', ...PKEYS.map((k) => SHORT[k])], rows: starts.map((st) => ['US$' + n0(st), ...PKEYS.map((k) => { const x = R.sizes.find((s) => s.start === st && s.key === k); return `${pc(x.skipped, 1)} skipped, fall ${pc(x.medDD)}`; })]) };
T.checks = { head: ['Number already in the repo', 'Published', 'Re-run here'], rows: R.checks.map((c) => [c.name, sg(c.published), sg(c.full)]) };
const corrIds = ORDER;
T.corr = { head: ['', ...corrIds.map((i) => NAME[i])], rows: corrIds.map((a) => [NAME[a], ...corrIds.map((b) => f2(R.corr[a][b]))]) };

// ---------- text ----------
const t = P('today').typical.medRet;
const VERDICT = [
  `<b>Best single strategy: a near tie.</b> ${NAME[ORDER[0]]} (average rank ${f1(avgRank[ORDER[0]])}) and ${NAME[ORDER[1]]} (${f1(avgRank[ORDER[1]])}), then ${NAME[ORDER[2]]} (${f1(avgRank[ORDER[2]])}). Live BB-CORE and BB-1H-WIDE are near twins: profit factor ${f2(A('bb').pf)} vs ${f2(A('wide').pf)}, R per R of fall ${f1(rdd(A('bb')))} vs ${f1(rdd(A('wide')))}, and at the same risk ${spc(M('bb').typical.medRet)} vs ${spc(M('wide').typical.medRet)} in a middle year.`,
  `<b>Adding a 4th bot at 25% each: no clear gain.</b> At the same typical fall, a middle 12 months gives ${spc(t)} today, ${spc(P('add-wide').typical.medRet)} with BB-1H-WIDE, ${spc(P('add-bb1h').typical.medRet)} with BB-CORE 1h, ${spc(P('add-ichi').typical.medRet)} with ICHI-X4 and ${spc(P('add-vol').typical.medRet)} with VOL-MOM-2H. Matched on the single worst fall instead, today is ahead of all four.`,
  `<b>Equal split of the current 3 is slightly worse than 50/25/25:</b> deepest 12-month fall ${pc(P('eq3').w.worstDD)} vs ${pc(P('today').w.worstDD)}; it fell less than today in only ${pc(P('eq3').w.beatDD)} of 12-month runs.`,
  `<b>Suggestion:</b> keep the 3 bots at 50/25/25. Paper-test ICHI-X4 (the new one that moves least like what you run) and BB-1H-WIDE, and decide with the BB-CORE v4 review around late February 2027. Do not add VOL-MOM-2H.`,
];
const PICK = {
  head: ['If you care most about', 'Winner', 'Number', 'The catch'],
  rows: [
    ['Win rate', 'ICHI-X4', pc(A('ichi').win), `Smallest edge: ${f2(A('ichi').avg)}R per trade, profit factor ${f2(A('ichi').pf)}`],
    ['Profit factor', 'T-CORE', f2(A('tc').pf), `Deepest-falling account after VOL-MOM/at ${pc(M('tc').real.dd)}`],
    ['Smallest account fall (alone)', 'BB-1H-WIDE', pc(M('wide').real.dd), `Earns less per year than BB-CORE (${pc(M('wide').real.cagr)} vs ${pc(M('bb').real.cagr)}, backtest)`],
    ['Most growth (alone, full risk)', 'BB-CORE 1h', pc(M('bb1h').real.cagr) + ' a year', `Falls ${pc(M('bb1h').real.dd)}; the extra comes with extra risk`],
    ['Most total R', 'T-CORE', sg(A('tc').R), `Gives back a lot while trades are open (${f1(A('tc').mdd)}R)`],
    ['Different from what you run', 'ICHI-X4', `link ${f2(R.versusLive.ichi.corr)}`, `Positive in ${R.versusLive.ichi.helped} of ${R.versusLive.ichi.badMonths} losing months of the mix`],
  ],
};
PICK.rows[1][3] = `Account falls ${pc(M('tc').real.dd)} when run alone`;
const CAVEATS = [
  'Growth percentages are what the backtest compounds to with perfect fills at any size. They are far above what to expect live. Use them only to compare one line with another.',
  `On the 12 hold-out coins (not used to tune), every strategy is much weaker (profit factor about ${f2(Math.min(...ORDER.map((i) => R.solo[i].hold.all.pf)))} to ${f2(Math.max(...ORDER.map((i) => R.solo[i].hold.all.pf)))} instead of ${f2(Math.min(...ORDER.map((i) => A(i).pf)))} to ${f2(Math.max(...ORDER.map((i) => A(i).pf)))}). Expect something closer to that.`,
  'None of the 7 has a clean out-of-sample test. The live rules (v3, v4) were chosen in November 2026 on this history; the new ones were picked on 12 main coins and filtered with the 12 hold-out coins.',
  `The ${R.meta.windows} twelve-month runs overlap (about 7 separate years), so gaps of a few percent are noise.`,
  'Binance candles and funding, fee 0.05% + slippage 0.02% per side. MEXC fills and funding differ. Trades still open on Nov 24 2026 are not counted.',
  'The Nov 26 hunt files compare against the old BB-CORE rules (2.0 bands, 48 candles). Here BB-CORE uses the live v4 rules, so its numbers differ from those files.',
  'Not tested: a 4th bot on other coins than the 6 below, other weights than the ones shown, exchange limits of a 4th sub-account.',
];
const HOW = `Same basis for all: entries from Jan 1 2020, exits to Nov 24 2026, open trades valued every hour. Live bots run their own coins (BB-CORE ${R.meta.run.bb.length}, I-CORE ${R.meta.run.ic.length}, T-CORE ${R.meta.run.tc.length}); each new strategy runs ${R.meta.live6.join(', ')}. Money tests use live sizing (2.5% risk, 2% from $500 base, 1.5% from $1,000), shared sizing across sub-accounts, quarterly rebalance, MEXC minimum orders, start US$${R.meta.capital}.`;
const TERMS = 'R = profit or loss counted in units of the amount risked on a trade (+2R = made twice what was risked). Profit factor = money won ÷ money lost. Worst fall = biggest drop from a high point. Sharpe / Sortino = return compared with how bumpy it was (Sortino counts only the downward bumps); higher is better.';

// ---------- markdown ----------
const strip = (s) => s.replace(/<\/?b>/g, '**');
const cell = (c) => (typeof c === 'object' ? (c.best ? `**${c.v}**` : c.v) : c);
const mdT = (x) => ['| ' + x.head.join(' | ') + ' |', '|' + '---|'.repeat(x.head.length), ...x.rows.map((r) => '| ' + r.map(cell).join(' | ') + ' |'), ''].join('\n');
const SECTIONS = [
  ['Pick by what matters to you', PICK], ['Scorecard (bold = best on that line)', T.score], ['All measures, each strategy on the coins it would run', T.own], ['All measures, all seven on the same 6 coins', T.live6],
  ['Money account, one strategy alone', T.money], ['R per year (own coins)', T.yearOwn], ['Money per year: return / worst fall inside the year', T.yearMoney],
  ['12 hold-out coins (not used to tune)', T.hold], ['R per year on the 12 hold-out coins', T.yearHold], ['12 main coins', T.main],
  ['Do they move together? (monthly R, 1.00 = identical)', T.corr], ['Against today\'s mix', T.rel], ['Portfolios: add a 4th bot', T.port], ['Portfolios per year: return / worst fall', T.yearPort],
  ['Swaps: a new strategy replaces one live bot (12 tries picked after the fact, treat as ideas only)', T.swaps], ['Can a small account still place the orders? (12-month runs from 2024)', T.sizes], ['Check against published numbers', T.checks],
];
fs.writeFileSync(__dirname + '/RESULTS.md', ['# 3 live bots vs 4 new strategies, and a 4th bot at 25% each (Nov 26, 2026)', '', HOW, '', TERMS, '', '## Verdict', '', ...VERDICT.map((v) => '- ' + strip(v)), '',
  ...SECTIONS.flatMap(([h, x]) => ['## ' + h, '', mdT(x)]), '## Read before trusting', '', ...CAVEATS.map((c) => '- ' + c), '', 'Scripts: `study.js` (numbers, `results.json`), `report.js` (this file and `report.html`).', ''].join('\n'));

// ---------- html ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const tbl = (x, cls = '') => `<div class="scroll"><table class="${cls}"><thead><tr>${x.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.rows.map((r) => `<tr>${r.map((c) => (typeof c === 'object' ? `<td${c.best ? ' class="best"' : ''}>${esc(c.v)}${c.best ? ' ★' : ''}</td>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
// horizontal bars: rows [{label, v, text, cls}]
function bars(title, note, rows) {
  const W = 460, L = 150, RH = 26, max = Math.max(...rows.map((r) => r.v)), sc = (v) => (Math.max(0, v) / max) * (W - L - 62);
  return `<figure><figcaption><b>${esc(title)}</b><span>${esc(note)}</span></figcaption><svg viewBox="0 0 ${W} ${rows.length * RH + 4}" role="img" aria-label="${esc(title)}">${rows.map((r, i) => { const y = i * RH + 4, w = Math.max(5, sc(r.v));
    return `<g class="row" data-tip="${esc(r.label + ': ' + r.text)}"><rect class="hit" x="0" y="${y - 3}" width="${W}" height="${RH}"/><text x="${L - 8}" y="${y + 13}" text-anchor="end">${esc(r.label)}</text><path class="${r.cls}" d="M${L} ${y}h${w - 4}a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h${-(w - 4)}z"/><text class="val" x="${L + w + 6}" y="${y + 13}">${esc(r.text)}</text></g>`; }).join('')}<line class="axis" x1="${L}" x2="${L}" y1="0" y2="${rows.length * RH + 2}"/></svg></figure>`;
}
const soloBars = (title, note, fn, fm) => bars(title, note, [...S].map((s) => ({ label: s.name, v: fn(s.id), text: fm(fn(s.id)), cls: isLive(s.id) ? 'c1' : 'c2' })).sort((a, b) => b.v - a.v));
const portBars = (title, note, fn, fm, low) => bars(title, note, PKEYS.map((k) => ({ label: SHORT[k].replace(' (25 each)', '').replace(' (33 each)', ''), v: fn(P(k)), text: fm(fn(P(k))), cls: k === 'today' ? 'c1' : 'cm' })));
const corrHtml = `<div class="scroll"><table class="heat"><thead><tr>${T.corr.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${corrIds.map((a) => `<tr><td>${NAME[a]}</td>${corrIds.map((b) => { const v = R.corr[a][b]; return `<td style="background:color-mix(in srgb, var(${v >= 0 ? '--hot' : '--c1'}) ${Math.round(Math.abs(v) * 45)}%, var(--surface))">${f2(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
const det = (h, body) => `<details><summary>${esc(h)}</summary>${body}</details>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Four Bot Comparison</title><style>
:root{--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e1e0d9;--axis:#c3c2b7;--c1:#2a78d6;--c2:#eb6834;--cm:#a5a49c;--hot:#e34948}
@media (prefers-color-scheme:dark){:root{--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;--axis:#383835;--c1:#3987e5;--c2:#d95926;--cm:#6b6a64;--hot:#e66767}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1080px;margin:0 auto;padding:24px 16px 60px}h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin:34px 0 8px}p,li{color:var(--ink2)}li b{color:var(--ink)}
.verdict{background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:6px 18px}
.scroll{overflow-x:auto;border:1px solid var(--grid);border-radius:10px;background:var(--surface);margin:8px 0}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:6px 10px;border-bottom:1px solid var(--grid);text-align:right;vertical-align:top}
th:first-child,td:first-child{text-align:left;position:sticky;left:0;background:var(--surface);min-width:150px}th{color:var(--ink2);font-weight:600}tr:last-child td{border-bottom:0}
td.best{font-weight:700}table.text td,table.text th{text-align:left}.heat td:first-child{background:var(--surface)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:14px}figure{margin:0;background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:12px}
figcaption span{display:block;color:var(--ink2);font-size:12px;margin-bottom:8px}svg{width:100%;height:auto;display:block}svg text{fill:var(--ink2);font-size:12px}svg text.val{fill:var(--ink)}
.c1{fill:var(--c1)}.c2{fill:var(--c2)}.cm{fill:var(--cm)}.axis{stroke:var(--axis)}.hit{fill:transparent}.row:hover .hit{fill:var(--grid);opacity:.5}
.key{display:flex;gap:16px;font-size:13px;color:var(--ink2);margin:6px 0}.key i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px}
details{margin:10px 0}summary{cursor:pointer;font-weight:600}#tip{position:fixed;pointer-events:none;background:var(--ink);color:var(--page);padding:5px 9px;border-radius:6px;font-size:12px;display:none}
</style></head><body><main>
<h1>3 live bots vs 4 new strategies</h1><p>${esc(HOW)}</p>
<h2>Verdict</h2><div class="verdict"><ul>${VERDICT.map((v) => `<li>${v}</li>`).join('')}</ul></div>
<h2>Pick by what matters to you</h2>${tbl(PICK, 'text')}
<h2>Scorecard, best to worst (left to right)</h2><p>★ = best on that line. The average rank counts every measure equally. ${esc(TERMS)}</p>${tbl(T.score)}
<h2>One strategy at a time</h2><div class="key"><span><i style="background:var(--c1)"></i>Live bot</span><span><i style="background:var(--c2)"></i>New strategy</span></div><div class="grid">
${soloBars('Same risk: return in a middle year', 'Risk set so the typical worst fall is 30% for each. Backtest scale, compare only.', (i) => M(i).typical.medRet, spc)}
${soloBars('Account worst fall (shorter is better)', 'Run alone at live sizing, 2020 to Nov 2026.', (i) => M(i).real.dd, pc)}
${soloBars('R earned per R of worst fall, own coins', 'Open trades counted.', (i) => rdd(A(i)), f1)}
${soloBars('Same measure on 12 hold-out coins', 'Not used to tune (the new ones were screened on them once). All drop a lot.', (i) => rdd(R.solo[i].hold.all), f1)}</div>
${det('All measures, each on the coins it would run', tbl(T.own))}${det('All measures, all seven on the same 6 coins', tbl(T.live6))}${det('Money account measures', tbl(T.money))}
${det('12 hold-out coins', tbl(T.hold))}${det('12 main coins', tbl(T.main))}
<h2>Year by year</h2><p>Total R, own coins</p>${tbl(T.yearOwn)}<p>Total R, 12 hold-out coins</p>${tbl(T.yearHold)}${det('Money: return / worst fall inside each year', tbl(T.yearMoney))}
<h2>Do they move together?</h2><p>Monthly results, 1.00 = identical. BB-CORE and both 1h Bollinger versions are one family, so adding one mostly splits BB-CORE in two.</p>${corrHtml}${tbl(T.rel)}
<h2>Adding a 4th bot</h2><p>An equal split cuts BB-CORE from 50% to 25%, so its risk per trade halves. Blue = what runs today.</p><div class="grid">
${portBars('Same risk: return in a middle year', 'Typical 12-month worst fall matched to today.', (p) => p.typical.medRet, spc)}
${portBars('Worst fall at live sizing (shorter is better)', '2020 to Nov 2026.', (p) => p.real.dd, pc)}
${portBars('Losing months (shorter is better)', '2020 to Nov 2026.', (p) => p.real.losingMonths, pc)}
${portBars('Growth per year at live sizing', 'Backtest scale. More growth here can simply mean more risk.', (p) => p.real.cagr, pc)}</div>
${tbl(T.port)}${det('Per year: return / worst fall', tbl(T.yearPort))}${det('Swaps: new strategy replaces one live bot (12 tries picked after the fact, ideas only)', tbl(T.swaps))}${det('Small accounts: skipped orders', tbl(T.sizes))}
<h2>Read before trusting</h2><ul>${CAVEATS.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>${det('Check: numbers already in the repo, re-run here', tbl(T.checks))}
</main><div id="tip"></div><script>const tip=document.getElementById('tip');document.querySelectorAll('[data-tip]').forEach(e=>{e.addEventListener('mousemove',v=>{tip.textContent=e.dataset.tip;tip.style.display='block';tip.style.left=Math.min(v.clientX+12,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=(v.clientY+14)+'px'});e.addEventListener('mouseleave',()=>tip.style.display='none')});</script></body></html>`;
fs.writeFileSync(__dirname + '/report.html', html);
console.log(VERDICT.map(strip).join('\n')); console.log(mdT(T.score)); console.log(mdT(PICK)); console.log(mdT(T.swaps));
