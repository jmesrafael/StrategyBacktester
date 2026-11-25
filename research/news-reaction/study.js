// News reaction study. Rules are fixed in PLAN.md. Reads only; writes RESULTS.md and results.json beside this file.
//   node --max-old-space-size=8192 study.js
'use strict';
const fs = require('fs'), path = require('path');
const LEDGER = path.resolve(__dirname, '../../../ledger');
const C = require('../../candles/candles.js');
const E = require(path.join(LEDGER, 'lib/macro-events.js'));
const R = require(path.join(LEDGER, 'lib/macro-reaction.js'));
const H = require(path.join(LEDGER, 'lib/macro-history.json'));

const HOUR = 3600, DAY = 86400, MIN = 60, OOS = Date.UTC(2024, 0, 1) / 1000;
const COST = 0.0014, COST2 = 0.0028;
const COINS = ['BTC', 'ETH', 'SOL'];
const bars = Object.fromEntries(COINS.map((c) => [c, C.load(c, '1m')]));
const funding = Object.fromEntries(COINS.map((c) => [c, C.funding(c)]));
const btcHourly = C.load('BTC', '1h');

const lower = (rows, t) => { let lo = 0, hi = rows.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m][0] < t) lo = m + 1; else hi = m; } return lo; };
// open of the 1m bar starting at t (at most 3 minutes late)
const openAt = (c, t) => { const b = bars[c][lower(bars[c], t)]; return b && b[0] - t <= 180 ? b[1] : null; };
// close of the last bar finished by t (at most 3 minutes old)
const closeAt = (c, t) => { const b = bars[c][lower(bars[c], t) - 1]; return b && t - (b[0] + MIN) <= 180 ? b[4] : null; };
const fundingPaid = (c, a, b) => { const f = funding[c]; let s = 0; for (let i = lower(f, a + 1); i < f.length && f[i][0] <= b; i++) s += f[i][1]; return s; };

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const median = (a) => R.median(a);
const tstat = (a) => { if (a.length < 3) return null; const m = mean(a), v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); return v > 0 ? m / Math.sqrt(v / a.length) : null; };
const f = (v, d = 2) => (v == null || !Number.isFinite(v) ? '–' : (v > 0 ? '+' : '') + v.toFixed(d));
const n2 = (v, d = 2) => (v == null || !Number.isFinite(v) ? '–' : v.toFixed(d));
const pct = (v) => (v == null ? '–' : Math.round(v * 100) + '%');

// ---------- the moments: one per release minute (most important family), and normal days ----------
const byMinute = new Map();
for (const r of H.records) {
  const cur = byMinute.get(r.at), key = (x) => `${E.FAMILIES[x.family].tier}|${x.id}`;
  if (!cur || key(r) < key(cur)) byMinute.set(r.at, r);
}
const events = [...byMinute.values()].sort((a, b) => a.at - b.at).map((r) => ({ t: r.at / 1000, family: r.family, lean: r.lean, rec: r }));
const busy = new Set(H.records.map((r) => new Date(r.at).toISOString().slice(0, 10)));
const nthSunday = (y, m, n) => { const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((7 - first) % 7) + (n - 1) * 7); };
const normal = [];
for (let t = Math.floor(H.from / 1000 / DAY) * DAY; t < H.to / 1000; t += DAY) {
  const d = new Date(t * 1000), dow = d.getUTCDay(); if (dow === 0 || dow === 6 || busy.has(d.toISOString().slice(0, 10))) continue;
  const summer = t * 1000 >= nthSunday(d.getUTCFullYear(), 2, 2) && t * 1000 < nthSunday(d.getUTCFullYear(), 10, 1);
  normal.push({ t: t + (summer ? 12.5 : 13.5) * HOUR });
}
// is the BTC 15-minute move "not neutral" (Event History's own rule)
function bigFirst(t) {
  const o = openAt('BTC', t), c = closeAt('BTC', t + 15 * MIN); if (!o || !c) return null;
  const a = lower(btcHourly, t - R.LOOKBACK_MS / 1000 - HOUR), b = lower(btcHourly, t);
  const typ = R.typicalMoves(btcHourly.slice(a, b).map((x) => [x[0] * 1000, x[1], x[2], x[3], x[4]]), t * 1000); if (!typ) return null;
  return R.classify((c / o - 1) * 100, typ.m15, 0.3).cls !== 'neutral';
}
for (const x of [...events, ...normal]) x.big = bigFirst(x.t);

// sanity: the same 15-minute move as the stored record
let checked = 0, differ = 0;
for (const e of events) { const o = openAt('BTC', e.t), c = closeAt('BTC', e.t + 900), s = e.rec.reaction.btc.at.m15; if (o && c && s) { checked++; if (Math.abs((c / o - 1) * 100 - s.pct) > 0.011) differ++; } }

// ---------- Q1 speed ----------
const SPEED = [1, 5, 15, 60, 180];
function speed(list, coin) {
  const out = {};
  for (const k of SPEED) {
    const ratio = [], same = [];
    for (const x of list) {
      const o = openAt(coin, x.t), a = closeAt(coin, x.t + k * MIN), z = closeAt(coin, x.t + 6 * HOUR); if (!o || !a || !z) continue;
      const m = a / o - 1, m6 = z / o - 1; if (!m6) continue;
      ratio.push(Math.abs(m / m6)); same.push(Math.sign(m) === Math.sign(m6) ? 1 : 0);
    }
    out[k] = { n: ratio.length, ratio: median(ratio), same: mean(same) };
  }
  return out;
}

// ---------- trading rules ----------
function trade(coin, side, entryT, exitT, t) {
  const a = openAt(coin, entryT), b = closeAt(coin, exitT); if (!a || !b || !side) return null;
  const gross = side * (b / a - 1) - side * fundingPaid(coin, entryT, exitT);
  return { t, side, net: (gross - COST) * 100, net2: (gross - COST2) * 100, gross: gross * 100 };
}
const firstSide = (coin, t, minutes) => { const o = openAt(coin, t), c = closeAt(coin, t + minutes * MIN); return o && c ? Math.sign(c / o - 1) : 0; };
const RULES = [];
for (const h of [1, 3, 6]) {
  for (const [dir, k] of [['follow', 1], ['fade', -1]]) {
    RULES.push({ id: `R1 ${dir} first 15m, exit ${h}h`, base: `R1 ${dir}`, h, run: (c, x) => trade(c, k * firstSide(c, x.t, 15), x.t + 900, x.t + h * HOUR, x.t) });
    RULES.push({ id: `R2 ${dir} BIG first 15m, exit ${h}h`, base: `R2 ${dir}`, h, run: (c, x) => (x.big ? trade(c, k * firstSide(c, x.t, 15), x.t + 900, x.t + h * HOUR, x.t) : null) });
  }
  RULES.push({ id: `R3 trade the surprise at 15m, exit ${h}h`, base: 'R3 surprise', h, surprise: true, run: (c, x) => { const s = x.lean === 'good' ? 1 : x.lean === 'bad' ? -1 : 0; return s ? trade(c, s, x.t + 900, x.t + h * HOUR, x.t) : null; } });
}
for (const h of [24, 72]) for (const [name, only] of [['all', 0], ['after UP moves (long)', 1], ['after DOWN moves (short)', -1]]) {
  RULES.push({ id: `Drift ${name}: enter 6h, exit ${h}h`, base: `Drift ${name}`, h, run: (c, x) => { const s = firstSide(c, x.t, 360); return only && s !== only ? null : trade(c, s, x.t + 6 * HOUR, x.t + h * HOUR, x.t); } });
}

function measure(list, rule, coin) {
  const t = list.map((x) => rule.run(coin, x)).filter(Boolean);
  const is = t.filter((x) => x.t < OOS), oos = t.filter((x) => x.t >= OOS), nets = t.map((x) => x.net);
  const ex10 = [...nets].sort((a, b) => b - a).slice(10);
  return { n: t.length, nIS: is.length, nOOS: oos.length, avg: mean(nets), is: mean(is.map((x) => x.net)), oos: mean(oos.map((x) => x.net)), avg2: mean(t.map((x) => x.net2)), ex10: mean(ex10), t: tstat(nets), win: t.length ? t.filter((x) => x.net > 0).length / t.length : null, gross: mean(t.map((x) => x.gross)), longShare: t.length ? t.filter((x) => x.side > 0).length / t.length : null };
}
// control for the surprise rule: the same long/short mix, blind, on normal days
function blind(rule, share) {
  const side = (s) => mean(normal.map((x) => trade('BTC', s, x.t + 900, x.t + rule.h * HOUR, x.t)).filter(Boolean).map((v) => v.net));
  return share * side(1) + (1 - share) * side(-1);
}
const results = RULES.map((rule) => {
  const m = Object.fromEntries(COINS.map((c) => [c, measure(events, rule, c)]));
  const control = rule.surprise ? blind(rule, m.BTC.longShare) : measure(normal, rule, 'BTC').avg;
  const b = m.BTC, other = (c) => m[c].is > 0 && m[c].oos > 0;
  const checks = { trades: b.nIS >= 30 && b.nOOS >= 30, bothPeriods: b.is > 0 && b.oos > 0, costs2: b.avg2 > 0, ex10: b.ex10 > 0, otherCoins: other('ETH') && other('SOL'), beatsNormal: b.avg > control, t: b.t >= 2 };
  return { id: rule.id, m, control, checks, pass: Object.values(checks).every(Boolean) };
});

// per family (exploratory)
const famCells = [];
for (const fam of Object.keys(E.FAMILIES)) {
  const list = events.filter((x) => x.family === fam);
  for (const rule of RULES.filter((r) => /^(R1|R3)/.test(r.id))) {
    const m = Object.fromEntries(COINS.map((c) => [c, measure(list, rule, c)])), b = m.BTC;
    if (b.nIS < 15 || b.nOOS < 15) continue;
    const pass = b.is > 0 && b.oos > 0 && b.avg2 > 0 && b.ex10 > 0 && ['ETH', 'SOL'].every((c) => m[c].is > 0 && m[c].oos > 0);
    famCells.push({ family: fam, rule: rule.id, ...b, eth: m.ETH.avg, sol: m.SOL.avg, pass });
  }
}

// ---------- Q4 surprise size ----------
const past = new Map();   // indicator -> earlier signed differences
const zBy = new Map();
for (const r of [...H.records].sort((a, b) => a.at - b.at)) {
  const zs = [];
  for (const i of r.indicators) {
    const def = E.BY_TITLE.get(i.name); if (!def || !def.ind || !def.ind.lead) continue;
    const a = E.num(i.actual), fc = E.num(i.forecast); if (a == null || fc == null) continue;
    const d = (a - fc) * def.ind.sign, h = past.get(i.name) || [];
    if (h.length >= 8) { const rms = Math.sqrt(mean(h.map((v) => v * v))); if (rms > 0) zs.push(Math.abs(d) < 1e-9 ? 0 : d / rms); }
    h.push(d); past.set(i.name, h);
  }
  if (zs.length) zBy.set(r.id, mean(zs));
}
const HOR = [['15m', 900], ['1h', HOUR], ['6h', 6 * HOUR], ['24h', 24 * HOUR]];
const scored = events.filter((x) => zBy.has(x.rec.id)).map((x) => {
  const o = openAt('BTC', x.t), mv = {};
  for (const [k, s] of HOR) { const c = closeAt('BTC', x.t + s); mv[k] = o && c ? (c / o - 1) * 100 : null; }
  return { t: x.t, family: x.family, z: zBy.get(x.rec.id), mv };
});
const ranks = (a) => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), out = []; for (let i = 0; i < idx.length;) { let j = i; while (j < idx.length && idx[j][0] === idx[i][0]) j++; for (let k = i; k < j; k++) out[idx[k][1]] = (i + j - 1) / 2; i = j; } return out; };
const spearman = (xs, ys) => { if (xs.length < 10) return null; const a = ranks(xs), b = ranks(ys), ma = mean(a), mb = mean(b); let s = 0, va = 0, vb = 0; for (let i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return va && vb ? s / Math.sqrt(va * vb) : null; };
const corr = (list, k) => { const l = list.filter((x) => x.mv[k] != null); return { n: l.length, rho: spearman(l.map((x) => x.z), l.map((x) => x.mv[k])) }; };
const GROUPS = [['Big bad (<= -1)', (z) => z <= -1], ['Small bad', (z) => z > -1 && z < 0], ['In line', (z) => z === 0], ['Small good', (z) => z > 0 && z < 1], ['Big good (>= 1)', (z) => z >= 1]];

// ---------- write ----------
const out = [];
const table = (head, rows) => { out.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`), ''); };
out.push('# News reaction study: raw results', '', `Run ${new Date().toISOString().slice(0, 10)}. Rules: PLAN.md. ${events.length} release minutes, ${normal.length} normal days, ${new Date(H.from).toISOString().slice(0, 10)} to ${new Date(H.to).toISOString().slice(0, 10)}. All trade results are % per trade after 0.14% costs and funding.`, `Check against the stored history: ${checked} 15-minute BTC moves recomputed, ${differ} differ.`, '');

out.push('## 1. Speed (move at each time against the move at 6 h)', '');
for (const coin of COINS) {
  const sets = [['All releases', events], ...['fomc', 'cpi', 'nfp'].map((k) => [E.FAMILIES[k].short, events.filter((x) => x.family === k)]), ['Normal days', normal]];
  out.push(`### ${coin}`, '', 'Cell = median size against the 6 h move / share already on the 6 h side.', '');
  table(['Group', ...SPEED.map((k) => (k < 60 ? `${k}m` : `${k / 60}h`))], sets.map(([name, l]) => { const s = speed(l, coin); return [`${name} (n=${s[15].n})`, ...SPEED.map((k) => `${n2(s[k].ratio)} / ${pct(s[k].same)}`)]; }));
}

out.push('## 2 and 3. Trading rules (BTC; ETH and SOL beside)', '');
table(['Rule', 'Trades', 'Win', 'Avg', 'to 2023', '2024 on', '2x cost', 'No top 10', 't', 'Normal days', 'ETH', 'SOL', 'Result'], results.map((r) => { const b = r.m.BTC; return [r.id, b.n, pct(b.win), f(b.avg, 3), f(b.is, 3), f(b.oos, 3), f(b.avg2, 3), f(b.ex10, 3), n2(b.t), f(r.control, 3), f(r.m.ETH.avg, 3), f(r.m.SOL.avg, 3), r.pass ? 'PASS' : 'fail: ' + Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')]; }));
out.push(`Passing the full pass mark: ${results.filter((r) => r.pass).length} of ${results.length}.`, '');
out.push('Average BTC result before costs (shows whether any edge exists before fees):', '');
table(['Rule', 'Before costs %'], results.map((r) => [r.id, f(r.m.BTC.gross, 3)]));

out.push('## Per family (exploratory, at least 15 trades in each period)', '', `Cells tried: ${famCells.length}. Passing points 2 to 5: ${famCells.filter((c) => c.pass).length}.`, '');
table(['Family', 'Rule', 'Trades', 'Avg', 'to 2023', '2024 on', 't', 'ETH', 'SOL', 'Result'], famCells.filter((c) => c.pass || Math.abs(c.t) >= 2).sort((a, b) => b.t - a.t).map((c) => [E.FAMILIES[c.family].short, c.rule, c.n, f(c.avg, 3), f(c.is, 3), f(c.oos, 3), n2(c.t), f(c.eth, 3), f(c.sol, 3), c.pass ? 'pass' : 'fail']));
out.push('(Only cells that pass or have |t| >= 2 are listed; all cells are in results.json.)', '');

out.push('## 4. Surprise size against the BTC move', '', `${scored.length} releases have a surprise score.`, '');
for (const [name, list] of [['All releases', scored], ['Top tier (FOMC, CPI, NFP, PCE)', scored.filter((x) => E.FAMILIES[x.family].tier === 1)]]) {
  out.push(`### ${name}`, '', 'Average BTC move % / share up.', '');
  table(['Surprise group', 'n', ...HOR.map((h) => h[0])], GROUPS.map(([g, test]) => { const l = list.filter((x) => test(x.z)); return [g, l.length, ...HOR.map(([k]) => { const v = l.map((x) => x.mv[k]).filter((y) => y != null); return `${f(mean(v))} / ${pct(v.length ? v.filter((y) => y > 0).length / v.length : null)}`; })]; }));
}
out.push('### Rank correlation: better surprise with higher BTC price (positive = as expected)', '', '`*` = unlikely to be chance on its own (rho x sqrt(n-1) >= 2).', '');
const corrRows = [];
const corrData = [];
for (const [name, list] of [['All', scored], ['Top tier', scored.filter((x) => E.FAMILIES[x.family].tier === 1)], ...Object.keys(E.FAMILIES).map((k) => [E.FAMILIES[k].short, scored.filter((x) => x.family === k)])]) {
  if (list.length < 30) continue;
  const cell = (l, k) => { const c = corr(l, k); corrData.push({ name, k, ...c }); return c.rho == null ? '–' : `${f(c.rho)}${Math.abs(c.rho) * Math.sqrt(c.n - 1) >= 2 ? '*' : ''}`; };
  corrRows.push([`${name} (n=${list.length})`, ...HOR.map(([k]) => `${cell(list.filter((x) => x.t < OOS), k)} / ${cell(list.filter((x) => x.t >= OOS), k)}`)]);
}
table(['Group', ...HOR.map((h) => `${h[0]}: to 2023 / 2024 on`)], corrRows);

fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), out.join('\n'));
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ results, famCells, corr: corrData }, null, 1));
console.log(out.join('\n'));
