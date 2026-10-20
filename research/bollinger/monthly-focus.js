// monthly-focus.js — SOL / ZEC / DOGE on 4h: FVG Pullback (3 entry modes) and BB Breakout, frozen settings, $5 risk per trade.
// usage: node monthly-focus.js   -> results-monthly-focus-5usd.md
const L = require('./lib.js'), { fvgpb } = require('./fvg.js'), F = require('./fam.js'), fs = require('fs');
const COINS = ['SOL', 'ZEC', 'DOGE'], RISK = 5, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FVG = { minGap: 0.5, disp: 0, depth: 0, stop: 'origin', tp: 3, expire: 20, trend: 'htf', maxHold: 0, tf: 240 };
const BB = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const SYS = { 'FVG direct (market)': (s) => fvgpb(s, { ...FVG, direct: true }), 'FVG pullback (limit)': (s) => fvgpb(s, FVG),
  'FVG pullback + confirmation': (s) => fvgpb(s, { ...FVG, confirm: true }), 'BB Breakout': (s) => F.sq(s, BB) };
const mk = (t) => new Date(t * 1000).toISOString().slice(0, 7), f = (v) => v == null ? '·' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
const out = [`# SOL / ZEC / DOGE on 4h — monthly P&L at $${RISK} risk per trade\n`, 'Frozen settings, 0.04% commission + 0.02% slippage, flat $5 per trade (no compounding). 2023-01 → 2026-10 is held out. · = no trades.\n'];
const months = (Date.UTC(2026, 9, 20) - Date.UTC(2023, 0, 1)) / (30.44 * 86400000);
out.push('## Held-out summary (2023-01 → 2026-10)\n', '| System | SOL | ZEC | DOGE | All three | Per month (all three) | Trades | Max DD (all three) |', '|---|---|---|---|---|---|---|---|');
const all = {};
for (const [name, fn] of Object.entries(SYS)) {
  const per = COINS.map((s) => L.slice(fn(s), L.ts(2023), L.ts(2100))); all[name] = COINS.map((s) => fn(s));
  const pool = per.flat().sort((a, b) => a.t - b.t), st = L.stats(pool);
  out.push(`| ${name} | ${per.map((t) => '$' + f(L.sum(t.map((x) => x.R)) * RISK).replace('+', '+')).join(' | ')} | **$${f(L.sum(pool.map((x) => x.R)) * RISK)}** | $${f(L.sum(pool.map((x) => x.R)) * RISK / months)} | ${pool.length} | $${(st.dd * RISK).toFixed(0)} |`);
}
for (const [name, perCoin] of Object.entries(all)) {
  for (const [label, trs] of [['SOL + ZEC + DOGE', perCoin.flat()], ...COINS.map((s, i) => [s, perCoin[i]])]) {
    const m = {}; for (const t of trs) m[mk(t.t)] = (m[mk(t.t)] || 0) + t.R * RISK;
    out.push('', `## ${name} — ${label}\n`, `| Year | ${MON.join(' | ')} | **Year** | Trades |`, `|---|${MON.map(() => '---').join('|')}|---|---|`);
    for (let y = 2021; y <= 2026; y++) {
      let yt = 0; const cells = MON.map((_, i) => { const v = m[`${y}-${String(i + 1).padStart(2, '0')}`]; if (v != null) yt += v; return f(v); });
      const n = L.slice(trs, L.ts(y), L.ts(y + 1)).length; if (n) out.push(`| ${y}${y < 2023 ? ' (train)' : ''} | ${cells.join(' | ')} | **${f(yt)}** | ${n} |`);
    }
  }
}
fs.writeFileSync(__dirname + '/results-monthly-focus-5usd.md', out.join('\n') + '\n');
console.log(out.slice(0, 9).join('\n'));
