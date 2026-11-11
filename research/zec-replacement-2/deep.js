// deep.js — finalists for the 5th BB-CORE / I-CORE coin, the same way eth-yearly/compare.js judged ETH:
// year by year since 2020, losing months + streaks + rolling windows on Jan 2021 → Oct 2026, and the bot's 4-coin portfolio with each.
//   node deep.js   -> DEEP.md + deep.json
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6'), Z = path.join(__dirname, '..', 'zec-replacement');
const { run, COST } = require(path.join(H, 'engine.js'));
const { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const IV = 14400, A = 2021 * 12, E = 2026 * 12 + 9; // window Jan 2021 → Oct 2026 (month index y*12+m)
const KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'];
const FIN = { 'BB-CORE': ['BTC', 'SUI', 'XLM', 'BNB', 'XRP', 'DOT', 'AVAX', 'ONE', 'ETH'], 'I-CORE': ['PEPE', 'FET', 'BNB', 'XRP', 'BTC', 'ONE', 'DASH', 'ETH'] };
const PROF = { 'BB-CORE': 'BBX', 'I-CORE': 'P7' };
const by = (id) => S.find((s) => s.id === id);

function trades(coin, bot) {
  const f10 = path.join(Z, 'data4h-10y', coin + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', coin + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(Z, 'funding', coin + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null;
  const ctx = makeCtx(B, '4h'), st = by(bot === 'BB-CORE' ? 'bb-core' : 'i-core').build(ctx);
  return { first: B[205].time, tr: run(B, ctx.atr14, st, exitOf(PROF[bot], ctx), F && F.length ? F : null, IV, COST).trades };
}
const mi = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
function months(tr, a) { const M = new Array(E - a + 1).fill(0); for (const t of tr) { const k = mi(t.tExit) - a; if (k >= 0 && k < M.length) M[k] += t.R; } return M; }
function judge(M) {
  const n = M.length, roll = (w) => { const s = []; for (let i = 0; i + w <= n; i++) s.push(M.slice(i, i + w).reduce((a, b) => a + b, 0)); return s; };
  let st = 0, mx = 0, eq = 0, pk = 0, dd = 0, un = 0, mu = 0;
  for (const v of M) { st = v < 0 ? st + 1 : 0; mx = Math.max(mx, st); eq += v; if (eq >= pk) { pk = eq; un = 0; } else mu = Math.max(mu, ++un); dd = Math.max(dd, pk - eq); }
  const r12 = roll(12), r6 = roll(6);
  return { n, lose: M.filter((v) => v < 0).length / n, streak: mx, worstM: Math.min(...M), r6neg: r6.filter((v) => v < 0).length / r6.length, r12neg: r12.filter((v) => v < 0).length / r12.length,
    worst12: Math.min(...r12), total: eq, dd, rdd: dd ? eq / dd : 0, under: mu, recentPM: M.slice(2024 * 12 - A).reduce((a, b) => a + b, 0) / M.slice(2024 * 12 - A).length };
}
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy); };

const f1 = (x) => (x > 0 ? '+' : '') + x.toFixed(1), pc = (x) => Math.round(x * 100) + '%';
const out = {}; let md = `# 5th coin for BB-CORE and I-CORE — finalists, judged like ETH (Nov 12, 2026)\n\nWindow for months/rolling/portfolio: **Jan 2021 → Oct 2026 (70 months)**; coins listed later (SUI Jun 2023, PEPE Jun 2023) start at their first month, marked *. ` +
  `Same engine and costs as the bots. Portfolio = SOL+NEAR+ADA+GALA on that bot + the coin (1R each). Year R by exit date; 2026 to Nov 11.\n`;
for (const bot of Object.keys(FIN)) {
  const keepTr = KEEP.flatMap((c) => trades(c, bot).tr), keepM = months(keepTr, A), K = judge(keepM);
  out[bot] = { keepers: K, coins: {} };
  const yrs = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
  let t1 = `| coin | ${yrs.join(' | ')} | losing yrs |\n|---|${yrs.map(() => '---').join('|')}|---|\n`;
  let t2 = `| coin | losing months | longest losing run | worst month | 6-mo windows < 0 | 12-mo windows < 0 | worst 12 mo | months below a high | R/month 2024+ | corr keepers |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  let t3 = `| 4 keepers + | total R | max DD | ret/DD | losing months | 12-mo windows < 0 | worst 12 mo | months below a high |\n|---|---|---|---|---|---|---|---|\n` +
    `| (keepers alone) | ${f1(K.total)} | ${K.dd.toFixed(1)} | ${K.rdd.toFixed(2)} | ${pc(K.lose)} | ${pc(K.r12neg)} | ${f1(K.worst12)} | ${K.under} |\n`;
  for (const c of FIN[bot]) {
    const { tr, first } = trades(c, bot), a = Math.max(A, mi(first) + 1), star = a > A ? '*' : '';
    const Y = {}; for (const t of tr) { const y = new Date(t.tExit * 1000).getUTCFullYear(); Y[y] = (Y[y] || 0) + t.R; }
    const ly = yrs.filter((y) => Y[y] != null && Y[y] < 0).length, have = yrs.filter((y) => Y[y] != null).length;
    t1 += `| ${c}${star} | ${yrs.map((y) => (Y[y] == null ? '–' : Y[y] < 0 ? `**${f1(Y[y])}**` : f1(Y[y]))).join(' | ')} | ${ly}/${have} |\n`;
    const M = months(tr, a), J = judge(M), cr = corr(M, keepM.slice(a - A));
    t2 += `| ${c}${star} | ${pc(J.lose)} | ${J.streak} | ${f1(J.worstM)} | ${pc(J.r6neg)} | ${pc(J.r12neg)} | ${f1(J.worst12)} | ${J.under} | ${f1(J.recentPM)} | ${cr.toFixed(2)} |\n`;
    const P = judge(keepM.slice(a - A).map((v, i) => v + M[i])), Kc = a > A ? judge(keepM.slice(a - A)) : K;
    t3 += `| ${c}${star} | ${f1(P.total)} | ${P.dd.toFixed(1)} | **${P.rdd.toFixed(2)}**${star ? ` (keepers ${Kc.rdd.toFixed(2)})` : ''} | ${pc(P.lose)} | ${pc(P.r12neg)} | ${f1(P.worst12)} | ${P.under} |\n`;
    out[bot].coins[c] = { years: Y, coin: J, portfolio: P, keepersSameWindow: Kc, corr: cr };
  }
  md += `\n## ${bot}\n\n### Year by year (R)\n\n${t1}\n### Losing months and consistency (the coin alone)\n\n${t2}\n### Portfolio: the bot's 4 coins + this coin\n\n${t3}`;
}
fs.writeFileSync(path.join(__dirname, 'DEEP.md'), md);
fs.writeFileSync(path.join(__dirname, 'deep.json'), JSON.stringify(out, null, 1));
console.log(md);
