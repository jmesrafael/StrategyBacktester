// ema-scan.js — run the frozen EMA 20/100 strategy (textbook settings, nothing tuned) on every coin we have 4h data for, and rank by consistency.
//   node ema-scan.js            reads ../bollinger/data4h/*.json (Binance USDT-M 4h) + BTC from ../bb-core/data-other-coins, READ-ONLY
// Costs = the research costs (taker entry/exit, 0.02% slippage); funding added where we have it. Screen only: coins picked after seeing results are in-sample.
'use strict';
const fs = require('fs'), path = require('path');
const { runStrat } = require('./contenders.js'); const { DEFAULTS, summarize, scaleCost } = require('./v2-core.js');
const D4 = path.join(__dirname, '..', 'bollinger', 'data4h'), FUND = path.join(__dirname, '..', 'bollinger', 'datafund'), BTC = path.join(__dirname, '..', 'bb-core', 'data-other-coins', 'BTC.json');
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const SPLIT = Date.UTC(2023, 0, 1) / 1000, END = Date.UTC(2026, 8, 25) / 1000;
const MAIN = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const SET_ASIDE = {   // from research/bb-core/docs/COIN-REGISTRY-bb-breakout.md (sections C, D, E): not compatible with bb-core
  'too illiquid': 'GRT ZIL VET RUNE ENJ MANA 1INCH ALGO EGLD DYDX AXS ZRX CHZ'.split(' '),
  'faded after 2023': 'ETH XRP DOGE'.split(' '),
  'middling': 'OP 1000SHIB WIF ICP WLD ARB SEI HBAR UNI 1000PEPE AAVE TIA FET HYPE TRX BNB TAO NEO YFI XTZ'.split(' '),
  'lost / flat': 'ATOM APT ONDO FIL LTC BCH ETC XMR DASH CRV SUSHI SNX COMP BAT IOTA KAVA BAND EOS THETA'.split(' '),
};
const tag = {}; for (const [k, v] of Object.entries(SET_ASIDE)) for (const c of v) tag[c] = k;

const coins = fs.readdirSync(D4).filter((f) => f.endsWith('.json') && !f.startsWith('MEXC_')).map((f) => f.slice(0, -5));
if (!coins.includes('BTC')) coins.push('BTC');
function evalCoin(c, k = 1) {
  const rows = c === 'BTC' && !fs.existsSync(path.join(D4, 'BTC.json')) ? rd(BTC) : rd(path.join(D4, c + '.json'));
  if (!rows || rows.length < 1200) return null;
  const B = rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fund = rd(path.join(FUND, c + '.json')), t = runStrat(B, 'ema20/100', scaleCost(DEFAULTS.cost, k), fund).trades;
  if (t.length < 20) return null;
  const s = summarize(t), ys = s.years, yv = Object.values(ys), tail = B.slice(-540), vol = tail.reduce((a, b) => a + b.close * b.volume, 0) / 90;
  const e = (u) => (u.length ? u.reduce((a, x) => a + x.R, 0) / u.length : NaN);
  return { c, n: s.n, E: s.avgR, R: s.R, dd: s.dd, rdd: s.R / s.dd, win: s.win, ys, yp: yv.filter((v) => v > 0).length, yn: yv.length, worst: Math.min(...yv), vol, from: new Date(B[0].time * 1000).getUTCFullYear(), alive: B[B.length - 1].time > END,
    eTr: e(t.filter((x) => x.t < SPLIT)), eTe: e(t.filter((x) => x.t >= SPLIT)), nTe: t.filter((x) => x.t >= SPLIT).length, fund: !!fund,
    trainYp: Object.entries(ys).filter(([y]) => +y < 2023).map(([, v]) => v) };
}
const f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1), f2 = (v) => (Number.isNaN(v) ? '–' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2)), M = (v) => (v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : (v / 1e6).toFixed(0) + 'M');
const R = coins.map((c) => evalCoin(c)).filter(Boolean), alive = R.filter((r) => r.alive);
const YRS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const row = (r) => `| ${r.c}${tag[r.c] ? ' *' : ''} | ${r.from} | ${r.n} | ${(r.win * 100).toFixed(0)}% | ${f2(r.E)} | ${YRS.map((y) => (r.ys[y] == null ? '–' : r.ys[y] < 0 ? `**${f1(r.ys[y])}**` : f1(r.ys[y]))).join(' | ')} | **${f1(r.R)}** | ${r.dd.toFixed(1)} | ${r.rdd.toFixed(1)} | ${r.yp}/${r.yn} | $${M(r.vol)} |`;
const head = `| coin | from | trades | win% | E | ${YRS.join(' | ')} | total R | DD | R÷DD | yrs+ | $/day |\n|---|---|---|---|---|${YRS.map(() => '---').join('|')}|---|---|---|---|---|`;
console.log(`# EMA 20/100 on every coin we have data for (${R.length} coins with enough history, ${alive.length} still trading)\n`);
console.log('Frozen textbook rules (EMA 20/100 cross, stop 2×ATR(14), exit on cross-back), Binance USDT-M 4h, fees + slippage, funding where available. R per calendar year by exit date. **Bold** = losing year. $/day = average dollar volume over the last 90 days (liquidity: under ~$30M/day, backtest fills are not believable). * = a coin we set aside for bb-core.\n');
console.log(`## 1. The five coins we trade now (same scan)\n\n${head}`); for (const c of MAIN) { const r = R.find((x) => x.c === c); if (r) console.log(row(r)); }
const full = alive.filter((r) => r.yp === r.yn && r.yn >= 5);
console.log(`\n## 2. Every year positive (5+ calendar years of trades): ${full.length} coins of ${alive.length}\n\n${head}`);
for (const r of [...full].sort((a, b) => b.R - a.R)) console.log(row(r));
const strict = full.filter((r) => r.vol >= 30e6);
console.log(`\nAfter the liquidity rule (≥ $30M/day): **${strict.length}** coins: ${strict.map((r) => r.c).join(', ')}`);
console.log(`\n## 3. Close calls: one losing year only, liquid, 5+ years (ranked by total R)\n\n${head}`);
for (const r of alive.filter((r) => r.yn - r.yp === 1 && r.yn >= 5 && r.vol >= 30e6 && r.R > 0).sort((a, b) => b.R - a.R).slice(0, 15)) console.log(row(r));
const FULLY = [2021, 2022, 2023, 2024, 2025], okFull = (r) => FULLY.every((y) => r.ys[y] != null && r.ys[y] > 0), liquid = (r) => r.vol >= 30e6;
const rel = alive.filter(okFull), relLiq = rel.filter(liquid);
console.log(`\n## 3b. Fairer test: positive in every FULL year 2021–2025 (2020 and 2026 are partial years with a handful of trades): ${rel.length} coins; ${relLiq.length} liquid (≥ $30M/day)\n\n${head}`);
for (const r of [...rel].sort((a, b) => (liquid(b) - liquid(a)) || b.R - a.R)) console.log(row(r));
console.log(`\nSame, plus 2026 so far not negative and 2020 not negative: ${rel.filter((r) => (r.ys[2026] == null || r.ys[2026] >= 0) && (r.ys[2020] == null || r.ys[2020] >= 0)).map((r) => r.c + (liquid(r) ? '' : ' (illiquid)')).join(', ') || 'none'}`);
const missed = alive.filter((r) => FULLY.every((y) => r.ys[y] != null) && FULLY.filter((y) => r.ys[y] > 0).length === 4 && liquid(r) && r.R > 0).sort((a, b) => b.R - a.R).slice(0, 12);
console.log(`\nLiquid coins with 4 of the 5 full years positive (next best): ${missed.map((r) => `${r.c} ${f1(r.R)}R (E ${f2(r.E)}, weak year ${f1(Math.min(...FULLY.map((y) => r.ys[y])))})`).join(' · ')}`);
console.log(`\n## 4. Coins we set aside for bb-core — how does EMA 20/100 do on them?\n`);
console.log('| group | coins scanned | all years positive | positive total | avg E | best |\n|---|---|---|---|---|---|');
for (const g of Object.keys(SET_ASIDE)) { const a = alive.filter((r) => tag[r.c] === g); if (!a.length) continue; console.log(`| ${g} | ${a.length} | ${a.filter((r) => r.yp === r.yn).length} | ${a.filter((r) => r.R > 0).length} | ${f2(a.reduce((s, r) => s + r.E, 0) / a.length)} | ${[...a].sort((x, y) => y.R - x.R).slice(0, 3).map((r) => r.c + ' ' + f1(r.R)).join(', ')} |`); }
console.log(`\n${head}`); for (const r of alive.filter((r) => tag[r.c] && r.yp === r.yn && r.yn >= 4).sort((a, b) => b.R - a.R)) console.log(row(r));
// out-of-sample test of the selection itself
const allp = alive.filter((r) => r.trainYp.length >= 2), trainPass = allp.filter((r) => r.trainYp.every((v) => v > 0));
const avgTe = (a) => { const s = a.filter((r) => r.nTe >= 5); return s.reduce((x, r) => x + r.eTe, 0) / s.length; };
console.log(`\n## 5. Does "every year positive" predict the future? (select on 2020–22 only, judge on 2023+)\n`);
console.log(`Coins positive in every one of their 2020–22 years: ${trainPass.length} of ${allp.length}. Their 2023+ expectancy: **${f2(avgTe(trainPass))}R** per trade; positive in 2023+: ${trainPass.filter((r) => r.eTe > 0).length}/${trainPass.length}. All other coins: ${f2(avgTe(allp.filter((r) => !trainPass.includes(r))))}R; positive: ${allp.filter((r) => !trainPass.includes(r) && r.eTe > 0).length}/${allp.length - trainPass.length}. All coins: ${f2(avgTe(allp))}R.`);
console.log(`Overall: ${alive.filter((r) => r.R > 0).length}/${alive.length} coins have positive total R; ${alive.filter((r) => r.eTe > 0).length}/${alive.length} have positive 2023+ expectancy. Median coin E ${f2(alive.map((r) => r.E).sort((a, b) => a - b)[Math.floor(alive.length / 2)])}.`);
console.log(`\n## 6. Finalists (every year positive, liquid ≥ $30M/day, 5+ years) — stress test\n\n| coin | E | E 2020–22 | E 2023+ | 2023+ trades | total R | total R at 2× costs | 2× costs yrs+ | funding in run |\n|---|---|---|---|---|---|---|---|---|`);
for (const r of [...strict].sort((a, b) => b.R - a.R)) { const x = evalCoin(r.c, 2); console.log(`| ${r.c} | ${f2(r.E)} | ${f2(r.eTr)} | ${f2(r.eTe)} | ${r.nTe} | ${f1(r.R)} | ${f1(x.R)} | ${x.yp}/${x.yn} | ${r.fund ? 'yes' : 'no'} |`); }
console.log(`\n## 7. Best liquid coins by total R and by return-per-drawdown (all years, regardless of losing years)\n\n${head}`);
for (const r of alive.filter((r) => r.vol >= 30e6 && r.yn >= 5).sort((a, b) => b.rdd - a.rdd).slice(0, 12)) console.log(row(r));
console.log(`\nLiquid coins with 5+ years: ${alive.filter((r) => r.vol >= 30e6 && r.yn >= 5).length}; of them positive total R: ${alive.filter((r) => r.vol >= 30e6 && r.yn >= 5 && r.R > 0).length}; positive in 2023+: ${alive.filter((r) => r.vol >= 30e6 && r.yn >= 5 && r.eTe > 0).length}; losing years on average: ${(alive.filter((r) => r.vol >= 30e6 && r.yn >= 5).reduce((s, r) => s + (r.yn - r.yp), 0) / alive.filter((r) => r.vol >= 30e6 && r.yn >= 5).length).toFixed(1)} of ~7.`);
