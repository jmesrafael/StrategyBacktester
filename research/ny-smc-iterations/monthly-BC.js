// monthly-BC.js — month-by-month view of Check B (v7 vs random-entry control) and Check C (current / pessimistic / 1m replay).
// Same engine, seeds and data as checkB.js / checkC.js (primary control, Oct23–Oct26). $ at $10 per R.
// usage: node monthly-BC.js   → results/monthly-B.md, results/monthly-C.md, results/monthly-BC.json
const fs = require('fs'), path = require('path'), crypto = require('crypto'), E = require('./ie.js'), X = require('./execC.js'), T = require('./trades-windows.js');
const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'ie.js'))).digest('hex');
if (!sha.startsWith('6539c98f')) throw new Error('ie.js changed since the v7 freeze');
const C = T.C, SEEDS = 1000, POOL = 8, TICK = { SOL: 0.001, ETH: 0.01 };
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const START = D0('2023-10-18'), END = D0('2026-10-18');
const YEARS = [E.Y.Y1, E.Y.Y2, E.Y.Y3];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mkey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const KEYS = []; for (let k = mkey(START); k <= mkey(END - 1); k++) KEYS.push(k);
const lab = (k, i) => `${MON[k % 12]} ${Math.floor(k / 12)}` + (i === 0 ? ' (from 18th)' : i === KEYS.length - 1 ? ' (to 17th)' : '');
const usd = (x) => (Math.abs(x) < 0.5 ? '$0' : (x < 0 ? '−$' : '+$') + Math.abs(x).toFixed(0));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const byMonth = (trades) => { const m = new Map(KEYS.map((k) => [k, 0])); for (const t of trades) if (t.t >= START && t.t < END) m.set(mkey(t.t), m.get(mkey(t.t)) + t.R * 10); return m; };
const arr = (m) => KEYS.map((k) => m.get(k));
const sumArr = (a) => a.reduce((x, y) => x + y, 0);

const R = { SOL: {}, ETH: {} };
for (const sym of ['SOL', 'ETH']) {
  const { D, trades: base } = T.build(sym), setups = E.setupsFor(D, C), { B, N, atr } = D;
  const pess = X.execute(D, C, setups, 'pessimistic', TICK[sym]);
  const m1 = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, `data/m1-${sym.toLowerCase()}.json`), 'utf8')).map((r) => [r[0], r]));
  const rep = base.map((t) => { const r = X.replay1m(D, C, t, m1, TICK[sym]); return r && !r.missingAt ? { ...t, R: r.R } : t; });
  R[sym].cur = arr(byMonth(base)); R[sym].pess = arr(byMonth(pess)); R[sym].m1 = arr(byMonth(rep));
  // ---- Check B primary control, identical sampling to checkB.js ----
  const sessions = D.A.ny.map((t) => ({ start: t + C.sessOffsetH * 3600, open: t, end: t + (C.sessOffsetH + C.sessionHours) * 3600 }));
  const cand = []; let si = 0;
  for (let i = 20; i < N - 20; i++) {
    const t = B[i].time; while (si < sessions.length && sessions[si].end <= t) si++;
    const s = sessions[si]; if (!s || t < s.start || t >= s.start + 3 * 3600) continue;
    if (t >= s.open && t < s.open + 3600) continue;
    cand.push([i, s]);
  }
  const lo = YEARS[0][0], hi = YEARS[2][1], pv7 = base.filter((t) => t.t >= lo && t.t < hi);
  const nPer = YEARS.map((y) => pv7.filter((t) => t.t >= y[0] && t.t < y[1]).length);
  const pairs = pv7.map((t) => { const s = t.s, a = atr[s.fvgIdx], dir = s.long ? 1 : -1; return { off: dir * (B[s.fvgIdx].close - s.entry) / a, stop: s.risk / a }; });
  const candBy = YEARS.map((y) => cand.filter(([i]) => B[i].time >= y[0] && B[i].time < y[1]));
  const per = KEYS.map(() => new Float64Array(SEEDS)); let tot = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rnd = mulberry32(seed * 7919 + (sym === 'ETH' ? 101 : 0));
    const setups2 = [];
    YEARS.forEach((y, yi) => {
      const want = Math.min(nPer[yi] * POOL, candBy[yi].length), used = new Set();
      while (used.size < want) used.add(Math.floor(rnd() * candBy[yi].length));
      for (const k of used) {
        const [i, s] = candBy[yi][k], g = pairs[Math.floor(rnd() * pairs.length)], long = rnd() < 0.5, dir = long ? 1 : -1, a = atr[i];
        const entry = B[i].close - dir * g.off * a, risk = g.stop * a, stop = entry - dir * risk;
        setups2.push({ long, chochIdx: i, fvgIdx: i, legXi: i, entry, stop, tp: entry + dir * C.tpR * risk, risk, sessStart: s.start, sessEnd: s.end, f: {} });
      }
    });
    setups2.sort((x, y) => x.fvgIdx - y.fvgIdx);
    const tr = E.execute(D, C, setups2);
    YEARS.forEach((y, yi) => {
      const ex = tr.filter((t) => t.t >= y[0] && t.t < y[1]);
      for (let i = ex.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ex[i], ex[j]] = [ex[j], ex[i]]; }
      for (const t of ex.slice(0, nPer[yi])) { per[KEYS.indexOf(mkey(t.t))][seed - 1] += t.R * 10; tot += t.R * 10; }
    });
  }
  R[sym].rand = per; R[sym].randTotalMean = tot / SEEDS;
}
const both = (a, b) => a.map((v, i) => v + b[i]);
const randBoth = KEYS.map((_, i) => Float64Array.from(R.SOL.rand[i], (v, s) => v + R.ETH.rand[i][s]));

// ------------- Table B -------------
const B_ = ['# Check B month by month — v7 vs the random-entry control', '',
  '$10 risk per trade, fees and slippage included, Bybit perp 15m, 18 Oct 2023 → 17 Oct 2026. **Random** = the average of 1,000 random-entry runs (same exits, costs, window, trade counts and stop/limit distances as v7; only the entry timing and direction are random). ' +
  '5th–95th = the range that 90% of random runs fall in for that month (both coins). "v7 vs random" says where v7 sits: ▲ above the random 95th percentile, ▼ below the 5th, · inside the range.', '',
  '| Month | v7 SOL | v7 ETH | **v7 both** | Random SOL | Random ETH | **Random both** | Random both 5th – 95th | v7 vs random |', '|---|---|---|---|---|---|---|---|---|'];
const v7b = both(R.SOL.cur, R.ETH.cur); let aboveCnt = 0, belowCnt = 0, beatMean = 0, rs = 0, rsAll = [];
const rbMean = randBoth.map((a) => sumArr(a) / SEEDS);
KEYS.forEach((k, i) => {
  const rb = randBoth[i], p5 = q(rb, 0.05), p95 = q(rb, 0.95), flag = v7b[i] > p95 + 0.5 ? '▲' : v7b[i] < p5 - 0.5 ? '▼' : '·';
  if (flag === '▲') aboveCnt++; if (flag === '▼') belowCnt++; if (v7b[i] > rbMean[i] + 0.5) beatMean++;
  B_.push(`| ${lab(k, i)} | ${usd(R.SOL.cur[i])} | ${usd(R.ETH.cur[i])} | **${usd(v7b[i])}** | ${usd(sumArr(R.SOL.rand[i]) / SEEDS)} | ${usd(sumArr(R.ETH.rand[i]) / SEEDS)} | **${usd(rbMean[i])}** | ${usd(p5)} … ${usd(p95)} | ${flag} |`);
});
B_.push(`| **Total** | **${usd(sumArr(R.SOL.cur))}** | **${usd(sumArr(R.ETH.cur))}** | **${usd(sumArr(v7b))}** | **${usd(R.SOL.randTotalMean)}** | **${usd(R.ETH.randTotalMean)}** | **${usd(sumArr(rbMean))}** | | |`, '');
// monthly distribution summaries
const randMonthAll = []; for (let s = 0; s < SEEDS; s++) randMonthAll.push(KEYS.map((_, i) => randBoth[i][s]));
const stat = (a) => ({ avg: sumArr(a) / a.length, pos: a.filter((v) => v > 0.5).length, neg: a.filter((v) => v < -0.5).length, flat: a.filter((v) => Math.abs(v) <= 0.5).length, best: Math.max(...a), worst: Math.min(...a) });
const sv = stat(v7b), sr = randMonthAll.map(stat);
const avgOf = (f) => sr.reduce((x, s) => x + f(s), 0) / sr.length;
B_.push('## Summary — B', '', '| | v7 (both coins) | Random entries (typical run) |', '|---|---|---|',
  `| Profit over 37 months | **${usd(sumArr(v7b))}** | ${usd(sumArr(rbMean))} on average (90% of runs between ${usd(q(randMonthAll.map(sumArr), 0.05))} and ${usd(q(randMonthAll.map(sumArr), 0.95))}) |`,
  `| Average per month | ${usd(sv.avg)} | ${usd(avgOf((s) => s.avg))} |`,
  `| Profitable months | ${sv.pos} of 37 | ${avgOf((s) => s.pos).toFixed(1)} of 37 |`,
  `| Losing months | ${sv.neg} | ${avgOf((s) => s.neg).toFixed(1)} |`,
  `| Months with no trade or ~$0 | ${sv.flat} | ${avgOf((s) => s.flat).toFixed(1)} |`,
  `| Best month | ${usd(sv.best)} | ${usd(avgOf((s) => s.best))} (average of each run's best) |`,
  `| Worst month | ${usd(sv.worst)} | ${usd(avgOf((s) => s.worst))} (average of each run's worst) |`,
  `| Months v7 beat the random average | ${beatMean} of 37 | |`,
  `| Months v7 was above the random 95th percentile | ${aboveCnt} of 37 (chance alone would give ~2) | |`,
  `| Months v7 was below the random 5th percentile | ${belowCnt} of 37 (chance alone would give ~2) | |`, '');
fs.writeFileSync(path.join(__dirname, 'results/monthly-B.md'), B_.join('\n') + '\n');

// ------------- Table C -------------
const C_ = ['# Check C month by month — three ways of ordering events inside a candle', '',
  '$10 risk per trade, fees and slippage included, Bybit perp, 18 Oct 2023 → 17 Oct 2026. **Current** = the engine behind every earlier number. **Pessimistic** = worst case whenever one 15m candle holds both a good and a bad level, plus one extra tick on breakeven/tightened stops. ' +
  '**1m replay** = the same trades re-run minute by minute (the closest thing to what really happened). The three differ only where a trade had an ambiguous candle, so most months are identical.', '',
  '| Month | SOL cur | SOL pess | SOL 1m | ETH cur | ETH pess | ETH 1m | **Both cur** | **Both pess** | **Both 1m** |', '|---|---|---|---|---|---|---|---|---|---|'];
const bc = both(R.SOL.cur, R.ETH.cur), bp = both(R.SOL.pess, R.ETH.pess), b1 = both(R.SOL.m1, R.ETH.m1);
KEYS.forEach((k, i) => C_.push(`| ${lab(k, i)} | ${usd(R.SOL.cur[i])} | ${usd(R.SOL.pess[i])} | ${usd(R.SOL.m1[i])} | ${usd(R.ETH.cur[i])} | ${usd(R.ETH.pess[i])} | ${usd(R.ETH.m1[i])} | **${usd(bc[i])}** | **${usd(bp[i])}** | **${usd(b1[i])}** |`));
const T3 = [R.SOL.cur, R.SOL.pess, R.SOL.m1, R.ETH.cur, R.ETH.pess, R.ETH.m1, bc, bp, b1];
C_.push(`| **Total** | ${T3.map((a, i) => (i >= 6 ? '**' : '') + usd(sumArr(a)) + (i >= 6 ? '**' : '')).join(' | ')} |`, '');
const diffMonths = KEYS.filter((_, i) => Math.abs(bp[i] - bc[i]) > 0.5 || Math.abs(b1[i] - bc[i]) > 0.5).length;
const dd = (a) => { let c = 0, pk = 0, m = 0; for (const v of a) { c += v; pk = Math.max(pk, c); m = Math.max(m, pk - c); } return m; };
const sc = stat(bc), sp = stat(bp), s1 = stat(b1);
C_.push('## Summary — C (both coins)', '', '| | Current | Pessimistic | 1m replay |', '|---|---|---|---|',
  `| Profit over 37 months | **${usd(sumArr(bc))}** | **${usd(sumArr(bp))}** | **${usd(sumArr(b1))}** |`,
  `| Average per month | ${usd(sc.avg)} | ${usd(sp.avg)} | ${usd(s1.avg)} |`,
  `| Profitable months | ${sc.pos} of 37 | ${sp.pos} of 37 | ${s1.pos} of 37 |`,
  `| Losing months | ${sc.neg} | ${sp.neg} | ${s1.neg} |`,
  `| Best / worst month | ${usd(sc.best)} / ${usd(sc.worst)} | ${usd(sp.best)} / ${usd(sp.worst)} | ${usd(s1.best)} / ${usd(s1.worst)} |`,
  `| Max drawdown of the monthly curve | −$${dd(bc).toFixed(0)} | −$${dd(bp).toFixed(0)} | −$${dd(b1).toFixed(0)} |`,
  `| Months that differ from "current" | — | ${KEYS.filter((_, i) => Math.abs(bp[i] - bc[i]) > 0.5).length} | ${KEYS.filter((_, i) => Math.abs(b1[i] - bc[i]) > 0.5).length} |`, '');
fs.writeFileSync(path.join(__dirname, 'results/monthly-C.md'), C_.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'results/monthly-BC.json'), JSON.stringify({ keys: KEYS, v7: { SOL: R.SOL.cur, ETH: R.ETH.cur }, randMean: rbMean, pess: { SOL: R.SOL.pess, ETH: R.ETH.pess }, m1: { SOL: R.SOL.m1, ETH: R.ETH.m1 } }));
console.log(B_.join('\n')); console.log('\n\n'); console.log(C_.join('\n'));
