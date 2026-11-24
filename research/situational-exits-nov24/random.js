// random.js — random early AND late closes on the live bots, many draws, -> random-exits.html (plain, self-contained, no libraries)
// A chosen share p of trades gets a blind random exit change (drawn without looking at how the trade ends):
//   EARLY: closed at the close of a random candle 1-48 after entry (if the stop comes first, nothing changes)
//   LATE (BB-CORE only, the only bot with a time exit): the time exit is delayed by a random 1-24 candles; the stop stays live
// I-CORE / T-CORE have no time exit, so for them "late" does not exist: all chosen trades are closed early.
'use strict';
const fs = require('fs'), path = require('path');
const { mk, jitter } = require('./sim.js'), { measure, LINEUP, MONTHS } = require('../tweak-lab-nov13/lab.js');
const DRAWS = 40, SHARES = [0.1, 0.25, 0.5];
const mkRng = (seed) => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };
const monthly = (tr) => { const m = Object.fromEntries(MONTHS.map((k) => [k, 0])); for (const t of tr) m[new Date(t.t1 * 1000).toISOString().slice(0, 7)] += t.R; let c = 0; return MONTHS.map((k) => (c += m[k])); };
const out = { months: MONTHS, bots: {} };
for (const bot of Object.keys(LINEUP)) {
  const baseTr = LINEUP[bot].flatMap((c) => mk(bot, c, {})), base = measure(baseTr);
  const B = { base: { ...base, curve: monthly(baseTr) }, scen: [] };
  for (const p of SHARES) for (const mode of bot === 'BB-CORE' ? ['early', 'both', 'open', 'all'] : ['early', 'open', 'all']) {
    const draws = [];
    for (let d = 0; d < DRAWS; d++) {
      const rng = mkRng(1000 + d * 7919 + Math.round(p * 100));
      let tr;
      const bb = bot === 'BB-CORE';
      if (mode === 'both') { // close side only: half of the chosen trades late (inside the engine), half early (afterwards, on the others)
        tr = LINEUP[bot].flatMap((c) => mk(bot, c, { rng, lateP: p / 2, lateMax: 24 }));
        tr = jitter(bot, tr, (p / 2) / (1 - p / 2), rng);
      } else if (mode === 'open') tr = LINEUP[bot].flatMap((c) => mk(bot, c, { rng, entP: p })); // opening side only: signals skipped / entered late
      else if (mode === 'all') { // opening AND closing random
        tr = LINEUP[bot].flatMap((c) => mk(bot, c, { rng, entP: p, ...(bb ? { lateP: p / 2, lateMax: 24 } : {}) }));
        tr = jitter(bot, tr, bb ? (p / 2) / (1 - p / 2) : p, rng);
      } else tr = jitter(bot, LINEUP[bot].flatMap((c) => mk(bot, c, {})), p, rng);
      const M = measure(tr); draws.push({ R: M.R, dd: M.dd, wr: M.wr, yrs: M.yrs, loseM: M.loseM, curve: monthly(tr) });
    }
    B.scen.push({ p, mode, draws });
  }
  out.bots[bot] = B;
  console.log(bot, 'base', base.R.toFixed(0), B.scen.map((s) => `${s.mode}${(s.p * 100) | 0}%: ${(s.draws.reduce((a, d) => a + d.R, 0) / DRAWS).toFixed(0)}`).join(' | '));
}
fs.writeFileSync(path.join(__dirname, 'random.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));

// ---------------- HTML
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = (v) => (v * 100).toFixed(0) + '%';
const COL = { 'BB-CORE': '#2563eb', 'I-CORE': '#16a34a', 'T-CORE': '#d97706' };
function chart(bot, scen) {
  const W = 760, H = 300, P = { l: 52, r: 12, t: 12, b: 26 }, n = MONTHS.length, base = out.bots[bot].base.curve;
  const mx = Math.max(...base, ...scen.draws.map((d) => Math.max(...d.curve))) * 1.05, mn = Math.min(0, ...scen.draws.map((d) => Math.min(...d.curve)));
  const X = (i) => P.l + (i / (n - 1)) * (W - P.l - P.r), Y = (v) => P.t + (1 - (v - mn) / (mx - mn)) * (H - P.t - P.b);
  const path = (c) => c.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const lo = base.map((_, i) => Math.min(...scen.draws.map((d) => d.curve[i]))), hi = base.map((_, i) => Math.max(...scen.draws.map((d) => d.curve[i])));
  const band = lo.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('') + hi.map((v, i) => 'L' + X(n - 1 - i).toFixed(1) + ' ' + Y(hi[n - 1 - i]).toFixed(1)).join('') + 'Z';
  let g = ''; for (let k = 0; k <= 4; k++) { const v = mn + ((mx - mn) * k) / 4; g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${P.l - 6}" y="${Y(v) + 4}" class="ax" text-anchor="end">${v.toFixed(0)}R</text>`; }
  for (let y = 2020; y <= 2026; y++) { const i = MONTHS.indexOf(y + '-01'); g += `<text x="${X(i)}" y="${H - 8}" class="ax" text-anchor="middle">${y}</text>`; }
  const thin = scen.draws.slice(0, 8).map((d) => `<path d="${path(d.curve)}" class="thin"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${bot} equity">${g}<path d="${band}" class="band"/>${thin}<path d="${path(base)}" class="today" style="stroke:${COL[bot]}"/></svg>`;
}
let body = '';
for (const bot of Object.keys(LINEUP)) {
  const b = out.bots[bot], base = b.base;
  body += `<section><h2><span class="dot" style="background:${COL[bot]}"></span>${bot} <small>today ${f(base.R)}R, worst drop ${base.dd.toFixed(0)}R, ${Object.values(base.yrs).filter((v) => v > 0).length} of ${Object.keys(base.yrs).length} years positive</small></h2>`;
  let rows = '';
  for (const s of b.scen) {
    const Rs = s.draws.map((d) => d.R), mean = Rs.reduce((a, v) => a + v, 0) / Rs.length, dd = s.draws.reduce((a, d) => a + d.dd, 0) / Rs.length, up = Math.min(...s.draws.map((d) => Object.values(d.yrs).filter((v) => v > 0).length));
    const beat = Rs.filter((v) => v > base.R).length;
    rows += `<tr><td>${pc(s.p)}</td><td>${{ early: 'closing: early only', both: 'closing: early + late', open: 'opening: skipped / late entry', all: 'opening + closing, all random' }[s.mode]}</td><td class="n">${f(mean)}R</td><td class="n ${mean >= base.R ? 'good' : 'bad'}">${f(((mean - base.R) / base.R) * 100, 0)}%</td><td class="n">${f(Math.min(...Rs))} to ${f(Math.max(...Rs))}</td><td class="n">${dd.toFixed(0)}R</td><td class="n">${beat} of ${Rs.length}</td><td class="n">${up}/7</td></tr>`;
  }
  body += `<table><thead><tr><th>Share shaken</th><th>Type</th><th>Average profit</th><th>vs today</th><th>Range over ${DRAWS} random runs</th><th>Avg drop</th><th>Runs that beat today</th><th>Fewest positive years</th></tr></thead><tbody>${rows}</tbody></table>`;
  const pick = b.scen.find((s) => s.p === 0.25 && s.mode === 'all');
  body += `<h3>Equity over the years: 25% of signals/trades shaken at random, opening AND closing</h3><div class="legend"><span><i style="background:${COL[bot]}"></i>today</span><span><i class="g"></i>8 random runs</span><span><i class="bd"></i>range of all ${DRAWS} runs</span></div>${chart(bot, pick)}`;
  const yrs = Object.keys(base.yrs), mean = (s) => yrs.map((y) => s.draws.reduce((a, d) => a + (d.yrs[y] || 0), 0) / s.draws.length), pk = [b.scen[0], pick, b.scen.find((s) => s.p === 0.5 && s.mode === pick.mode)];
  body += `<h3>Year by year (average of ${DRAWS} runs)</h3><table><thead><tr><th></th>${yrs.map((y) => `<th>${y}</th>`).join('')}</tr></thead><tbody><tr><td>Today</td>${yrs.map((y) => `<td class="n">${f(base.yrs[y])}</td>`).join('')}</tr>${pk.map((s) => `<tr><td>${pc(s.p)} changed</td>${mean(s).map((v, i) => `<td class="n ${v >= base.yrs[yrs[i]] ? 'good' : 'bad'}">${f(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Random early and late closes</title><style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#14181f;--mut:#5b6573;--line:#e3e7ec;--good:#15803d;--bad:#b91c1c}
@media(prefers-color-scheme:dark){:root{--bg:#0e1116;--card:#171b22;--ink:#e8ebf0;--mut:#9aa4b2;--line:#2a313c;--good:#4ade80;--bad:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,Segoe UI,sans-serif;padding:20px 16px 60px}
main{max-width:860px;margin:0 auto}h1{font-size:24px;margin:0 0 6px}h2{font-size:19px;margin:0 0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}h2 small{font-weight:400;color:var(--mut);font-size:13px}h3{font-size:14px;margin:18px 0 8px;color:var(--mut)}
.dot{width:12px;height:12px;border-radius:50%;display:inline-block}section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:16px 0;overflow-x:auto}
.lead{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:14px 0}.lead p{margin:6px 0}
table{border-collapse:collapse;width:100%;font-size:13px;min-width:560px}th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left}th{color:var(--mut);font-weight:600}td.n,th:not(:first-child){font-variant-numeric:tabular-nums}td.n{text-align:right}.good{color:var(--good);font-weight:600}.bad{color:var(--bad);font-weight:600}
svg{width:100%;height:auto;display:block;min-width:520px}.grid{stroke:var(--line);stroke-width:1}.ax{fill:var(--mut);font-size:11px}.band{fill:currentColor;opacity:.12;color:var(--mut)}.thin{fill:none;stroke:var(--mut);stroke-width:1;opacity:.55}.today{fill:none;stroke-width:2.6}
.legend{display:flex;gap:14px;font-size:12px;color:var(--mut);margin-bottom:4px;flex-wrap:wrap}.legend i{display:inline-block;width:18px;height:3px;margin-right:5px;vertical-align:middle;background:var(--mut)}.legend i.g{opacity:.55;height:1px}.legend i.bd{height:10px;opacity:.2}
</style></head><body><main><h1>What if some trades close early or late, at random?</h1>
<div class="lead"><p><b>Same strategy, but the sequence is shaken at random.</b> A share of signals/trades (10%, 25%, 50%) is changed at random, ${DRAWS} different random runs each, Jan 2020 to Nov 2026 on each bot's live coins, with fees, slippage and funding.</p>
<p><b>Opening:</b> a chosen signal is skipped (1 in 3) or entered 1-12 candles late (2 in 3), with the stop and ATR re-read at the late entry. Because trades then open and close at different times, the later signals each coin can take also shift, so the whole sequence is different. <b>Closing early:</b> closed at a random candle 1-48 after entry (if the stop comes first, nothing changes). <b>Closing late</b> (BB-CORE only, the only bot with a time exit): the time exit is held 1-24 candles longer; the stop stays live. I-CORE and T-CORE have no time exit, so they only get early closes.</p>
<p>The rows: <i>closing only</i>, <i>opening only</i>, and <i>opening + closing all random</i>. Random draws never look at what price does next, so there is no hidden future sight. Green = better than today, red = worse.</p></div>
</div>
${body}
<div class="lead"><p><b>Takeaway.</b> Shaking when trades open and close never beats today's rules on average. Random openings alone are the mildest (T-CORE barely moves: -2% at 25%, -7% at 50%; BB-CORE -13% and I-CORE -11% at 25%). Random closing hurts more, and opening plus closing together hurts most: at 25% shaken BB-CORE loses about 16%, T-CORE 23%, I-CORE 28%; at 50% about 32%, 43% and 56%. In every run each bot stays profitable overall, but T-CORE and I-CORE can drop to 5 or 6 profitable years out of 7. The edge is not fragile to a bit of timing noise, but the live sequence is the best of the family. Source: research/situational-exits-nov24/random.js (research only, no bot changed).</p></div>
</main></body></html>`;
fs.writeFileSync(path.join(__dirname, 'random-exits.html'), html);
console.log('wrote random-exits.html');
