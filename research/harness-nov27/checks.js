// checks.js: standard test checklist (TESTED-STRATEGIES.md) in one call. Reuses hunt-4h/1h lib + audit. No new deps.
'use strict';
const LIBS = { '4h': '../hunt-4h-nov26', '1h': '../hunt-1h-nov26' };
const load = (tf) => { const d = LIBS[tf]; if (!d) throw new Error('tf must be 4h or 1h'); return { lib: require(d + '/lib.js'), aud: require(d + '/audit.js') }; };
const mkey = (sec) => { const d = new Date(sec * 1000); return d.getUTCFullYear() * 100 + d.getUTCMonth(); };
const monthly = (T) => { const m = {}; for (const t of T) m[mkey(t.tExit)] = (m[mkey(t.tExit)] || 0) + t.R; return m; };

// Pearson on monthly R (by exit month) over months where both have trades.
function monthlyCorrelation(A, B) {
  const a = monthly(A), b = monthly(B), ks = Object.keys(a).filter((k) => k in b);
  if (ks.length < 3) return NaN;
  const x = ks.map((k) => a[k]), y = ks.map((k) => b[k]), mean = (v) => v.reduce((s, z) => s + z, 0) / v.length;
  const mx = mean(x), my = mean(y);
  const num = x.reduce((s, z, i) => s + (z - mx) * (y[i] - my), 0);
  return num / Math.sqrt(x.reduce((s, z) => s + (z - mx) ** 2, 0) * y.reduce((s, z) => s + (z - my) ** 2, 0));
}
// Share of A's trades with a same-coin, same-side trade of B open at A's entry (B.t <= A.t < B.tExit).
function tradeOverlap(A, B) {
  const idx = {};
  for (const t of B) (idx[t.coin + '|' + t.dir] = idx[t.coin + '|' + t.dir] || []).push(t);
  const hit = A.filter((a) => (idx[a.coin + '|' + a.dir] || []).some((b) => b.t <= a.t && a.t < b.tExit)).length;
  return A.length ? hit / A.length : NaN;
}

// o: { strat(ctx), exFn (engine exit obj or fn(ctx)), coins, tf '4h'|'1h', auditId, auditCoins, auditCuts, skipAudit }
function checkStrategy(o) {
  const { lib, aud } = load(o.tf || '4h');
  const coins = o.coins || lib.MAIN, Y = lib.YEARS;
  const r1 = lib.evaluate(o.strat, o.exFn, coins, 1, true), r2 = lib.evaluate(o.strat, o.exFn, coins, 2, false);
  const T = r1.trades, n = T.length, sorted = T.map((t) => t.R).sort((a, b) => b - a);
  const top = Math.max(1, Math.ceil(n * 0.1)), topSum = sorted.slice(0, top).reduce((s, v) => s + v, 0);
  const sumY = (f) => Y.filter(f).reduce((s, y) => s + r1.years[y], 0);
  const loco = {};
  for (const c of coins) { const r = r1.perCoin[c].R; loco[c] = { R: r, n: r1.perCoin[c].n, without: r1.total - r }; }
  const out = {
    tf: o.tf || '4h', coins, n,
    x1: { total: r1.total, dd: r1.dd, exp: r1.exp, pf: r1.pf, ex10: r1.ex10, years: r1.years, posYears: r1.posYears },
    x2: { total: r2.total, dd: r2.dd, exp: r2.exp, ex10: r2.ex10, years: r2.years, posYears: r2.posYears },
    topDecileShare: r1.total > 0 ? topSum / r1.total : NaN, topDecileN: top,
    IS: sumY((y) => y <= 2023), OOS: sumY((y) => y >= 2024),
    perCoin: r1.perCoin, loco, coinsPos: r1.coinsPos, worstLoco: Math.min(...Object.values(loco).map((v) => v.without)),
    trades: T,
  };
  if (!o.skipAudit) {
    const a = aud.audit([{ id: o.auditId || 'cand', build: o.strat }], { coins: o.auditCoins || ['SOL', 'BTC', 'ADA'], cuts: o.auditCuts || 8 });
    out.audit = { ok: a.ok, checks: a.perStrategy[0].checks, mismatches: a.perStrategy[0].mismatches };
  }
  out.text = render(out, Y);
  return out;
}

function render(o, Y) {
  const f = (v, d = 0) => (v === undefined || v !== v ? 'n/a' : v.toFixed(d)), L = [];
  L.push(`tf=${o.tf} coins=${o.coins.length} trades=${o.n}`);
  L.push('           ' + Y.map((y) => String(y).padStart(5)).join('') + '  total   DD  ex10  yrs+');
  for (const [k, r] of [['1x cost', o.x1], ['2x cost', o.x2]])
    L.push(`${k.padEnd(10)} ` + Y.map((y) => f(r.years[y]).padStart(5)).join('') + `  ${f(r.total).padStart(5)} ${f(r.dd).padStart(4)} ${f(r.ex10).padStart(5)}  ${r.posYears}/${Y.length}`);
  L.push(`exp/trade 1x ${f(o.x1.exp, 3)}  PF ${f(o.x1.pf, 2)}  top-10% trades (${o.topDecileN}) = ${f(100 * o.topDecileShare)}% of profit`);
  L.push(`IS<=2023 ${f(o.IS)}R   OOS>=2024 ${f(o.OOS)}R   coins positive ${o.coinsPos}/${o.coins.length}   worst leave-one-coin-out total ${f(o.worstLoco)}R`);
  L.push('per coin (R / total without it): ' + o.coins.map((c) => `${c} ${f(o.loco[c].R)}/${f(o.loco[c].without)}`).join('  '));
  if (o.audit) L.push(`truncation audit: ${o.audit.ok ? 'OK' : 'LOOK-AHEAD'} (${o.audit.checks} checks, ${o.audit.mismatches} mismatches)`);
  return L.join('\n');
}

module.exports = { checkStrategy, monthlyCorrelation, tradeOverlap, monthly };
