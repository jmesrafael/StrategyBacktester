// report.js — full breakdown: bb-core vs Ichimoku (2 ATR stop / 7 ATR trail / +SMA200) on SOL ZEC NEAR ADA GALA.
// Everything: overall stats, per year, per month (R and account %), exit reasons, long/short, per coin. Account = $1,000, 2.5% of current equity per trade, compounded.
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const bb = require('../bb-core-v2/v2-core.js');
const { loadCoin } = require('../bb-core-v2/load.js');
const C = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], Y = [2020, 2021, 2022, 2023, 2024, 2025, 2026], MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], S = 1000, RP = 0.025;
const g = {}; const get = (c) => g[c] || (g[c] = (() => { const B = E.load(c); return { B, X: E.base(B) }; })());
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f0 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0), pc = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%';
const ym = (t) => { const d = new Date(t.tExit * 1000); return [d.getUTCFullYear(), d.getUTCMonth()]; };

const SETS = {
  'bb-core (live bot rules)': C.flatMap((c) => { const d = loadCoin(c); return bb.backtest(d.B, {}, d.funding).trades.map((t) => ({ ...t, coin: c, why: ({ tp: 'target', sl: 'stop', stop: 'stop', time: 'time' })[t.why] || t.why })); }),
  'Ichimoku 2/7 + SMA200': C.flatMap((c) => E.run(get(c).B, get(c).X, 'ichimoku', { full: false }, { coin: c, kInit: 2, kTrail: 7, trend: true, exitOpp: false })),
};

function account(T) {
  const tr = [...T].sort((a, b) => a.t - b.t), d = [];
  for (const x of tr) { const eq = S + d.filter((o) => o.te <= x.t).reduce((a, o) => a + o.p, 0); d.push({ te: x.tExit, p: x.R * RP * eq }); }
  d.sort((a, b) => a.te - b.te);
  const mEnd = {}; let eq = S, pk = S, dd = 0; const yDD = {};
  for (const o of d) { eq += o.p; pk = Math.max(pk, eq); dd = Math.max(dd, (pk - eq) / pk); const dt = new Date(o.te * 1000), k = dt.getUTCFullYear() * 12 + dt.getUTCMonth(); mEnd[k] = eq; }
  // monthly % return (months with no trade exit = 0%)
  const mret = {}; let prev = S; for (let k = 2020 * 12; k <= 2026 * 12 + 9; k++) { if (mEnd[k] !== undefined) { mret[k] = mEnd[k] / prev - 1; prev = mEnd[k]; } else mret[k] = 0; }
  return { eq, dd, mret };
}
const streak = (T) => { let m = 0, s = 0; for (const t of [...T].sort((a, b) => a.tExit - b.tExit)) { s = t.R <= 0 ? s + 1 : 0; m = Math.max(m, s); } return m; };
const winStreak = (T) => { let m = 0, s = 0; for (const t of [...T].sort((a, b) => a.tExit - b.tExit)) { s = t.R > 0 ? s + 1 : 0; m = Math.max(m, s); } return m; };

let out = `# Ichimoku 2/7 vs bb-core — full breakdown (SOL · ZEC · NEAR · ADA · GALA, Binance 4h, 2020 → Oct 2026)\n\n`;
out += `- Account figures: $${S} start, **${RP * 100}% of current equity risked per trade**, compounded, coins may be open together; equity counts closed trades only. R = one unit of risk.\n- Monthly figures are by the month a trade CLOSED. Costs: 0.07%/side (fee+slippage) + funding; bb-core uses its real funding files, Ichimoku a flat 0.005%/4h bar.\n- The live bot only started Oct 23, 2026 (its journal is on the VPS, not on this PC), so there are no real live trades to compare yet; "bb-core" below is the bot's own engine (which the bot log says reproduces the live bot trade-for-trade).\n\n`;

const acc = {};
// ---------- overall ----------
out += '## 1. Overall statistics\n\n| | ' + Object.keys(SETS).join(' | ') + ' |\n|---|' + Object.keys(SETS).map(() => '---').join('|') + '|\n';
const stats = {};
for (const [n, T] of Object.entries(SETS)) {
  const w = T.filter((t) => t.R > 0), l = T.filter((t) => t.R <= 0), gp = w.reduce((a, t) => a + t.R, 0), gl = -l.reduce((a, t) => a + t.R, 0), a = account(T); acc[n] = a;
  const months = Object.values(a.mret).filter((_, i) => true), mpos = months.filter((v) => v > 0).length, mneg = months.filter((v) => v < 0).length;
  const why = {}; for (const t of T) why[t.why] = (why[t.why] || 0) + 1;
  const lg = T.filter((t) => t.dir === 1), sh = T.filter((t) => t.dir === -1);
  stats[n] = [
    ['Trades', T.length], ['Winning trades', w.length], ['Losing trades (R ≤ 0)', l.length], ['Win rate', (100 * w.length / T.length).toFixed(1) + '%'],
    ['Total R', f1(T.reduce((a, t) => a + t.R, 0))], ['Average R per trade', f1(T.reduce((a, t) => a + t.R, 0) / T.length).replace('+', '+') ],
    ['Average winner', f1(gp / w.length) + 'R'], ['Average loser', f1(-gl / l.length) + 'R'], ['Profit factor (gross win ÷ gross loss)', (gp / gl).toFixed(2)],
    ['Best trade', f1(Math.max(...T.map((t) => t.R))) + 'R'], ['Worst trade', f1(Math.min(...T.map((t) => t.R))) + 'R'],
    ['Longest losing streak (trades)', streak(T)], ['Longest winning streak (trades)', winStreak(T)],
    ['Max drawdown (R, closed trades)', E.maxDD(T).toFixed(1) + 'R'], ['Max drawdown (% of equity @2.5%)', '−' + (a.dd * 100).toFixed(0) + '%'],
    ['Average bars held (4h)', (T.reduce((x, t) => x + t.bars, 0) / T.length).toFixed(1) + ' (~' + (T.reduce((x, t) => x + t.bars, 0) / T.length / 6).toFixed(1) + ' days)'],
    ['Exits', Object.entries(why).map(([k, v]) => `${k} ${v} (${(100 * v / T.length).toFixed(0)}%)`).join(', ')],
    ['Longs: trades / win% / R', `${lg.length} / ${(100 * lg.filter((t) => t.R > 0).length / lg.length).toFixed(0)}% / ${f0(lg.reduce((x, t) => x + t.R, 0))}`], ['Shorts: trades / win% / R', `${sh.length} / ${(100 * sh.filter((t) => t.R > 0).length / sh.length).toFixed(0)}% / ${f0(sh.reduce((x, t) => x + t.R, 0))}`],
    ['Months with a gain / loss / flat (of 82)', `${mpos} / ${mneg} / ${months.length - mpos - mneg}`],
    ['Best / worst month (account %)', `${pc(Math.max(...months))} / ${pc(Math.min(...months))}`], ['End equity from $1,000', '$' + Math.round(a.eq).toLocaleString('en-US')],
  ];
}
const names = Object.keys(SETS);
for (let i = 0; i < stats[names[0]].length; i++) out += `| ${stats[names[0]][i][0]} | ${names.map((n) => stats[n][i][1]).join(' | ')} |\n`;

// ---------- per year ----------
for (const [n, T] of Object.entries(SETS)) {
  out += `\n## 2. ${n} — per year\n\n| year | trades | wins | losses | win% | total R | best trade | worst trade | max DD in year (R) | account return | months + / − | best month | worst month |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const a = acc[n];
  for (const y of Y) {
    const t = T.filter((x) => new Date(x.tExit * 1000).getUTCFullYear() === y); if (!t.length) continue;
    const mr = []; for (let m = 0; m < 12; m++) { const k = y * 12 + m; if (a.mret[k] !== undefined && (y < 2026 || m <= 9) && !(y === 2020 && m < 1)) mr.push(a.mret[k]); }
    const yret = mr.reduce((p, v) => p * (1 + v), 1) - 1;
    out += `| ${y} | ${t.length} | ${t.filter((x) => x.R > 0).length} | ${t.filter((x) => x.R <= 0).length} | ${(100 * t.filter((x) => x.R > 0).length / t.length).toFixed(0)}% | ${f1(t.reduce((s, x) => s + x.R, 0))} | ${f1(Math.max(...t.map((x) => x.R)))} | ${f1(Math.min(...t.map((x) => x.R)))} | ${E.maxDD(t).toFixed(1)} | ${pc(yret)} | ${mr.filter((v) => v > 0).length} / ${mr.filter((v) => v < 0).length} | ${pc(Math.max(...mr))} | ${pc(Math.min(...mr))} |\n`;
  }
}

// ---------- per month ----------
for (const [n, T] of Object.entries(SETS)) {
  out += `\n## 3. ${n} — result of every month (R = sum of trades closed that month; trades in brackets)\n\n| year | ${MN.join(' | ')} | year R |\n|---|${MN.map(() => '---').join('|')}|---|\n`;
  for (const y of Y) {
    const cells = MN.map((_, m) => { const t = T.filter((x) => { const [yy, mm] = ym(x); return yy === y && mm === m; }); return t.length ? `${f1(t.reduce((s, x) => s + x.R, 0))} (${t.length})` : '·'; });
    out += `| ${y} | ${cells.join(' | ')} | ${f1(T.filter((x) => ym(x)[0] === y).reduce((s, x) => s + x.R, 0))} |\n`;
  }
  out += `\n**${n} — account return per month (2.5% risk, compounded)**\n\n| year | ${MN.join(' | ')} |\n|---|${MN.map(() => '---').join('|')}|\n`;
  for (const y of Y) out += `| ${y} | ${MN.map((_, m) => { const k = y * 12 + m; return acc[n].mret[k] === undefined || (y === 2026 && m > 9) ? '' : acc[n].mret[k] === 0 ? '·' : pc(acc[n].mret[k]); }).join(' | ')} |\n`;
}

// ---------- per coin ----------
out += `\n## 4. Per coin\n\n| strategy | coin | trades | win% | wins / losses | total R | avg R | max DD (R) | longest losing streak | years + |\n|---|---|---|---|---|---|---|---|---|---|\n`;
for (const [n, T] of Object.entries(SETS)) for (const c of C) {
  const t = T.filter((x) => x.coin === c), y = E.yearly(t), w = t.filter((x) => x.R > 0).length;
  out += `| ${n} | ${c} | ${t.length} | ${(100 * w / t.length).toFixed(0)}% | ${w} / ${t.length - w} | ${f0(t.reduce((s, x) => s + x.R, 0))} | ${f1(t.reduce((s, x) => s + x.R, 0) / t.length)} | ${E.maxDD(t).toFixed(1)} | ${streak(t)} | ${Y.filter((v) => (y[v] || 0) > 0).length}/7 |\n`;
}
fs.writeFileSync(path.join(__dirname, 'RESULTS-detail.md'), out); console.log(out);
