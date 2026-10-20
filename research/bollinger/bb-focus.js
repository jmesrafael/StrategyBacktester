// bb-focus.js — BB Breakout (4h) on SOL / DOGE / ZEC with REAL funding included, year by year and coin by coin, plus a robustness grid:
// does "positive every year" survive when the settings are nudged? $5 risk per trade. usage: node bb-focus.js -> results-bb-focus.md
const L = require('./lib.js'), F = require('./fam.js'), fs = require('fs'), path = require('path');
const COINS = ['SOL', 'DOGE', 'ZEC'], RISK = 5, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const BASE = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const FUND = Object.fromEntries(COINS.map((s) => [s, JSON.parse(fs.readFileSync(path.join(__dirname, 'datafund', s + '.json'), 'utf8'))]));
// first funding event index with time > t (binary search)
const upper = (a, t) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m][0] <= t) lo = m + 1; else hi = m; } return lo; };
// trades with funding: a long pays (and a short receives) the rate at each funding event between entry and exit; cost in R = dir * sum(rate) / stop distance
function trades(sym, cfg, funding = true, mult = 1) {
  const B = L.bars(sym, 240), fd = FUND[sym];
  L.COST.comm = 0.0004 * mult; L.COST.slip = 0.0002 * mult;
  const tr = F.sq(sym, cfg); L.COST.comm = 0.0004; L.COST.slip = 0.0002;
  return tr.map((t) => {
    const te = B[t.i0].time, tx = B[t.i1].time + 14400 / 2; // exit somewhere inside its bar
    let fr = 0; if (funding) for (let j = upper(fd, te); j < fd.length && fd[j][0] <= tx; j++) fr += fd[j][1];
    return { sym, t: t.t, x: B[t.i1].time + 14400, R: t.R - t.dir * fr / t.dist, fundR: -t.dir * fr / t.dist, dir: t.dir };
  });
}
const f0 = (v) => (v >= 0 ? '+' : '−') + '$' + Math.abs(v).toFixed(0), f2 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
const yr = (tr, y, coin) => { const t = tr.filter((x) => x.x >= L.ts(y) && x.x < L.ts(y + 1) && (!coin || x.sym === coin)); return { n: t.length, usd: L.sum(t.map((x) => x.R)) * RISK, fund: L.sum(t.map((x) => x.fundR)) * RISK }; };
const out = ['# BB Breakout 4h on SOL / DOGE / ZEC — with real funding, year by year\n',
  'Frozen settings (4h, Bollinger 20/2, close beyond a band in the direction of the 200 SMA, stop at the middle band, 3R target, exit after 48 bars). $5 risk per trade, 0.04% commission + 0.02% slippage, **plus actual Binance funding** for every funding event a trade was open through. Trades counted in the year they close. 2026 is to Oct 20.\n'];

const base = COINS.flatMap((s) => trades(s, BASE, true)), nofund = COINS.flatMap((s) => trades(s, BASE, false));
out.push('## All three coins, with and without funding\n', '| Year | Without funding | Funding paid/received | **With funding** | Trades | Positive? |', '|---|---|---|---|---|---|');
let posY = 0;
for (const y of YEARS) { const a = yr(base, y), b = yr(nofund, y); if (a.usd > 0) posY++; out.push(`| ${y}${y === 2020 ? ' (partial)' : y === 2026 ? ' (to Oct)' : ''} | ${f0(b.usd)} | ${f0(a.fund)} | **${f0(a.usd)}** | ${a.n} | ${a.usd > 0 ? 'yes' : '**NO**'} |`); }
out.push(`| **Total** | ${f0(L.sum(nofund.map((x) => x.R)) * RISK)} | ${f0(L.sum(base.map((x) => x.fundR)) * RISK)} | **${f0(L.sum(base.map((x) => x.R)) * RISK)}** | ${base.length} | ${posY} of ${YEARS.length} years |`);

out.push('', '## Each coin separately, with funding (profit; trades)\n', '| Year | SOL | DOGE | ZEC |', '|---|---|---|---|');
const cy = { SOL: 0, DOGE: 0, ZEC: 0 }, cn = { SOL: 0, DOGE: 0, ZEC: 0 };
for (const y of YEARS) out.push(`| ${y} | ${COINS.map((c) => { const r = yr(base, y, c); if (!r.n) return '·'; cn[c]++; if (r.usd > 0) cy[c]++; return `${f0(r.usd)} (${r.n})`; }).join(' | ')} |`);
out.push(`| **Total** | ${COINS.map((c) => `**${f0(L.sum(base.filter((x) => x.sym === c).map((x) => x.R)) * RISK)}**`).join(' | ')} |`, `| Years positive | ${COINS.map((c) => `${cy[c]} of ${cn[c]}`).join(' | ')} |`);
out.push('', 'Funding paid per coin over the whole history ($5 risk): ' + COINS.map((c) => `${c} ${f0(L.sum(base.filter((x) => x.sym === c).map((x) => x.fundR)) * RISK)}`).join(', ') + '. Average funding is small because trades are short and funding can be received on the short side.\n');

out.push('## Stress: costs ×2 / ×3 on top of funding (all three coins)\n', '| Case | ' + YEARS.join(' | ') + ' | Total | Years positive |', '|---|' + YEARS.map(() => '---').join('|') + '|---|---|');
for (const [label, m] of [['Base costs + funding', 1], ['Costs ×2 + funding', 2], ['Costs ×3 + funding', 3]]) {
  const tr = COINS.flatMap((s) => trades(s, BASE, true, m)), ys = YEARS.map((y) => yr(tr, y).usd);
  out.push(`| ${label} | ${ys.map(f0).join(' | ')} | ${f0(L.sum(ys))} | ${ys.filter((v) => v > 0).length} of ${ys.length} |`);
}

// robustness grid: does "positive every year" hold for nearby settings?
const rows = [];
for (const n of [14, 20, 30]) for (const k of [1.5, 2, 2.5]) for (const trendN of [100, 200, 300]) for (const tp of [2, 3, 4]) for (const maxBars of [24, 48, 0]) {
  const cfg = { ...BASE, n, k, trendN, tp, maxBars }, tr = COINS.flatMap((s) => trades(s, cfg, true)), ys = YEARS.map((y) => yr(tr, y).usd);
  rows.push({ cfg, ys, total: L.sum(ys), pos: ys.filter((v) => v > 0).length, trades: tr.length });
}
const all7 = rows.filter((r) => r.pos === 7), ge6 = rows.filter((r) => r.pos >= 6);
out.push('', '## Robustness: nudge every setting (243 variants, funding included)\n', 'Grid: Bollinger length 14/20/30 × σ 1.5/2/2.5 × trend SMA 100/200/300 × target 2/3/4R × time exit 24/48/none. Pooled SOL + DOGE + ZEC.\n',
  `- Profitable in total: **${rows.filter((r) => r.total > 0).length} of ${rows.length}**`, `- Positive in all 7 years: **${all7.length} of ${rows.length}** (${(all7.length / rows.length * 100).toFixed(0)}%)`, `- Positive in at least 6 of 7 years: **${ge6.length} of ${rows.length}** (${(ge6.length / rows.length * 100).toFixed(0)}%)`,
  `- The frozen setting: ${rows.find((r) => JSON.stringify([r.cfg.n, r.cfg.k, r.cfg.trendN, r.cfg.tp, r.cfg.maxBars]) === '[20,2,200,3,48]').pos} of 7 years positive, ${f0(rows.find((r) => JSON.stringify([r.cfg.n, r.cfg.k, r.cfg.trendN, r.cfg.tp, r.cfg.maxBars]) === '[20,2,200,3,48]').total)} total`,
  `- Median total across variants: ${f0(rows.map((r) => r.total).sort((a, b) => a - b)[Math.floor(rows.length / 2)])}; worst variant: ${f0(Math.min(...rows.map((r) => r.total)))}; best: ${f0(Math.max(...rows.map((r) => r.total)))}`);
out.push('', 'Years-positive histogram: ' + [7, 6, 5, 4, 3, 2, 1, 0].map((p) => `${p}/7: ${rows.filter((r) => r.pos === p).length}`).join(' · '));
const byParam = (key, vals) => vals.map((v) => { const g = rows.filter((r) => r.cfg[key] === v); return `${key}=${v}: ${g.filter((r) => r.pos === 7).length}/${g.length} all-years-positive, median ${f0(g.map((r) => r.total).sort((a, b) => a - b)[Math.floor(g.length / 2)])}`; });
out.push('', '| Setting | Variants positive in all 7 years / median total |', '|---|---|');
for (const [key, vals] of [['n', [14, 20, 30]], ['k', [1.5, 2, 2.5]], ['trendN', [100, 200, 300]], ['tp', [2, 3, 4]], ['maxBars', [24, 48, 0]]]) for (const line of byParam(key, vals)) out.push(`| ${line.split(': ')[0]} | ${line.split(': ')[1]} |`);
out.push('', '### Variants that failed at least one year (worst 8 by years positive)\n', '| Setting (n, σ, trend, target, time exit) | ' + YEARS.join(' | ') + ' | Total |', '|---|' + YEARS.map(() => '---').join('|') + '|---|');
for (const r of rows.sort((a, b) => a.pos - b.pos || a.total - b.total).slice(0, 8)) out.push(`| ${r.cfg.n}, ${r.cfg.k}, ${r.cfg.trendN}, ${r.cfg.tp}R, ${r.cfg.maxBars || 'none'} | ${r.ys.map(f0).join(' | ')} | ${f0(r.total)} |`);
fs.writeFileSync(__dirname + '/results-bb-focus.md', out.join('\n') + '\n');
console.log(out.join('\n'));
