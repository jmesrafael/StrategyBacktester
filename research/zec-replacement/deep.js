// deep.js — follow-up on the coins that passed screen.js: robustness, diversification and the portfolio swap (ZEC out, candidate in).
//   node deep.js   -> deep.json (+ console)
'use strict';
const fs = require('fs'), path = require('path');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'results.json'), 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'trades.json'), 'utf8'));
const W = { 'BB-CORE': 0.5, 'I-CORE': 0.25, 'T-CORE': 0.25 };
const KEEP = ['SOL', 'NEAR', 'ADA', 'GALA']; // the bots' coins that stay
const CAND = Object.entries(R.coins).filter(([c, r]) => r.passed && !KEEP.includes(c) && c !== 'ZEC').map(([c]) => c);
const SHOW = [...CAND, 'ZEC', 'VET']; // VET: passes everything except liquidity, shown for reference
const SPLIT = Date.UTC(2023, 0, 1) / 1000;

const tri = (coin, from = 0) => Object.entries(W).flatMap(([b, w]) => T[coin][b].filter((t) => t[1] > from).map((t) => ({ tExit: t[1], R: t[2] * w })));
const month = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; };
function monthly(tr) { const m = {}; for (const t of tr) m[month(t.tExit)] = (m[month(t.tExit)] || 0) + t.R; return m; }
function corr(a, b) {
  const ks = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => +k >= 202110), x = ks.map((k) => a[k] || 0), y = ks.map((k) => b[k] || 0);
  const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
  let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sx * sy);
}
function curve(tr) { // total, max DD, ret/DD, share of positive months, worst month, worst 12 months
  tr = [...tr].sort((a, b) => a.tExit - b.tExit); let eq = 0, pk = 0, dd = 0; for (const t of tr) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const m = monthly(tr), mv = Object.values(m), keys = Object.keys(m).sort();
  let worst12 = Infinity; for (let i = 0; i + 11 < keys.length; i++) worst12 = Math.min(worst12, keys.slice(i, i + 12).reduce((s, k) => s + m[k], 0));
  return { total: eq, dd, rdd: dd ? eq / dd : 0, posMonths: mv.filter((v) => v > 0).length / mv.length, worstMonth: Math.min(...mv), worst12 };
}

const out = { candidates: CAND, coins: {}, portfolio: {} };
// keepers' combined monthly series (TRI-weighted), for correlation and the swap test
const keepTr = KEEP.flatMap((c) => tri(c));
const keepM = monthly(keepTr);
const GALA_START = Math.min(...T.GALA['BB-CORE'].map((t) => t[0])); // portfolio test starts when every keeper trades
console.log('portfolio window from', new Date(GALA_START * 1000).toISOString().slice(0, 10));

for (const c of SHOW) {
  const r = R.coins[c], tr = tri(c), years = r.tri.years, best = Object.entries(years).sort((a, b) => b[1] - a[1])[0];
  const exBest = r.tri.total - best[1];
  // per-bot pre/post 2023 avgR
  const pp = Object.fromEntries(Object.keys(W).map((b) => { const x = T[c][b]; const pre = x.filter((t) => t[1] <= SPLIT), post = x.filter((t) => t[1] > SPLIT);
    return [b, { pre: pre.reduce((s, t) => s + t[2], 0) / Math.max(1, pre.length), post: post.reduce((s, t) => s + t[2], 0) / Math.max(1, post.length), nPost: post.length }]; }));
  const last12 = tr.filter((t) => t.tExit > Date.now() / 1000 - 365 * 86400).reduce((s, t) => s + t.R, 0);
  const port = curve([...keepTr.filter((t) => t.tExit > GALA_START), ...tri(c, GALA_START)]);
  out.coins[c] = { years, best, exBest, exBestPerYear: exBest / (r.tri.yrsN - 1), top10share: r.bots['BB-CORE'].top10share, prepost: pp, last12, corrKeepers: corr(monthly(tr), keepM), curve: curve(tr), port };
}
out.portfolio.keepersOnly = curve(keepTr.filter((t) => t.tExit > GALA_START));
fs.writeFileSync(path.join(__dirname, 'deep.json'), JSON.stringify(out, null, 1));

const f = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);
console.log('\nA) TRI-CORE weighted R by year (50/25/25), 2019 tail folded into 2020');
console.log('coin   ' + ['2020', '2021', '2022', '2023', '2024', '2025', '2026'].map((y) => y.padStart(7)).join('') + '   total  best-year-removed  per-yr  last12m');
for (const c of SHOW) { const d = out.coins[c]; console.log(c.padEnd(6) + ['2020', '2021', '2022', '2023', '2024', '2025', '2026'].map((y) => f(d.years[y] || 0).padStart(7)).join('') + `  ${f(R.coins[c].tri.total).padStart(6)}   ${f(d.exBest).padStart(6)} (no ${d.best[0]})  ${f(d.exBestPerYear).padStart(6)}  ${f(d.last12).padStart(6)}`); }
console.log('\nB) per bot avgR before / after 2023 (walk-forward view), trades after 2023');
for (const c of SHOW) { const p = out.coins[c].prepost; console.log(c.padEnd(6) + Object.entries(p).map(([b, v]) => `${b} ${f(v.pre, 2)}/${f(v.post, 2)} (${v.nPost})`).join('   ')); }
console.log('\nC) diversification + portfolio swap (SOL+NEAR+ADA+GALA + coin, TRI-weighted R, from ' + new Date(GALA_START * 1000).toISOString().slice(0, 10) + ')');
const k = out.portfolio.keepersOnly; console.log(`keepers only            total ${f(k.total).padStart(6)}  DD ${k.dd.toFixed(1).padStart(5)}  ret/DD ${k.rdd.toFixed(2)}  months+ ${(k.posMonths * 100).toFixed(0)}%  worst month ${f(k.worstMonth)}  worst 12m ${f(k.worst12)}`);
for (const c of SHOW) { const d = out.coins[c], p = d.port; console.log(`+ ${c.padEnd(5)} corr ${d.corrKeepers.toFixed(2).padStart(5)}   total ${f(p.total).padStart(6)}  DD ${p.dd.toFixed(1).padStart(5)}  ret/DD ${p.rdd.toFixed(2)}  months+ ${(p.posMonths * 100).toFixed(0)}%  worst month ${f(p.worstMonth)}  worst 12m ${f(p.worst12)}  | BB top-10 trades = ${(d.top10share * 100).toFixed(0)}% of BB profit`); }
