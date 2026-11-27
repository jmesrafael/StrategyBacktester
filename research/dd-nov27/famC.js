// famC.js - FAMILY C: streak / day limits. Grid pre-listed BEFORE running (14 settings + baseline). No parameter changes after seeing results.
//  S{n}x{f}  : size x f after n consecutive losing (pnl<=0) closed trades portfolio-wide, until a win.
//  P{X}/{h}  : no new entries for h hours once equity is X% below its max over the previous 24h; restored afterwards.
//  C1 = S3x0.5 + P8/24 ; C2 = S2x0.5 + P5/24
'use strict';
const fs = require('fs');
const X = require('./causalC');
const GRID = [];
for (const f of [0.5, 0.25]) for (const n of [2, 3, 4]) GRID.push({ name: `S${n}x${f}`, n, f });
for (const x of [5, 8, 10]) for (const h of [24, 48]) GRID.push({ name: `P${x}/${h}`, x, h });
GRID.push({ name: 'C1 S3x0.5+P8/24', n: 3, f: 0.5, x: 8, h: 24 }, { name: 'C2 S2x0.5+P5/24', n: 2, f: 0.5, x: 5, h: 24 });
const mkSize = (g) => {
  let idx = 0, pauseUntil = -1;
  return (c) => {
    if (g.x) {
      const cv = c.curve;
      for (; idx < cv.length; idx += 2) { // each new hourly mark vs max of the previous 24 marks
        const v = cv[idx + 1]; let mx = v;
        for (let k = Math.max(0, idx - 46); k < idx; k += 2) if (cv[k + 1] > mx) mx = cv[k + 1];
        if (mx > 0 && 1 - v / mx >= g.x / 100) pauseUntil = Math.max(pauseUntil, cv[idx] + g.h * 3600);
      }
      if (c.t < pauseUntil) return 0;
    }
    if (g.n) {
      let k = 0; const T = c.trades;
      for (let i = T.length - 1; i >= 0 && T[i].pnl <= 0 && k < g.n; i--) k++;
      if (k >= g.n) return g.f;
    }
    return 1;
  };
};
const LIVE = { mode: 'live', start: 600, cap: 500 };
const go = (g, from, to, extra = {}) => X.run({ ...LIVE, ...(g.base ? {} : { sizeFn: mkSize(g) }), ...(from ? { from } : {}), ...(to ? { to } : {}), ...extra });
const ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000;
const wins = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= X.END) wins.push([ts(y, m), ts(y + 1, m)]);
function evalG(g) {
  const r = go(g), s = X.stats(r), f = X.stats(go(g, X.CUT)), d = X.stats(go(g, null, null, { cost: 2 }));
  const w = wins.map(([a, b]) => X.stats(go(g, a, b)));
  return { g, r, s, f, d, w };
}
const B = evalG({ name: 'BASELINE', base: true });
const p = (v) => (100 * v).toFixed(1), u = (v) => Math.round(v).toLocaleString('en-US');
const out = {}; const rows = [];
console.log(`baseline end ${u(B.s.end)} dd ${p(B.s.dd)} trades ${B.r.trades.length}`);
const slim = (r) => r.trades.map((t) => ({ bot: t.bot, R: t.R, t: t.t, tExit: t.tExit, mult: t.mult, w: t.w }));
out.BASELINE = slim(B.r);
for (const g of GRID) {
  const e = evalG(g);
  const r1 = e.s.dd <= B.s.dd - 0.01 && e.s.end >= 0.85 * B.s.end;
  const r2 = e.f.dd < B.f.dd && e.f.cagr >= 0.85 * B.f.cagr;
  const r3 = e.d.end > 600 && e.d.dd < B.d.dd;
  const sm = e.w.filter((x, i) => x.dd < B.w[i].dd).length, pos = e.w.filter((x) => x.ret > 0).length, bpos = B.w.filter((x) => x.ret > 0).length;
  const r4 = sm > wins.length / 2 && pos >= bpos;
  const row = { name: g.name, end: e.s.end, dd: e.s.dd, trades: e.r.trades.length, f_end: e.f.end, f_cagr: e.f.cagr, f_dd: e.f.dd, d_end: e.d.end, d_dd: e.d.dd, sm, pos, r1, r2, r3, r4 };
  rows.push(row); console.log(JSON.stringify(row));
  out[g.name] = slim(e.r);
}
fs.writeFileSync(__dirname + '/famC-trades.json', JSON.stringify(out));
const bw = { end: B.s.end, dd: B.s.dd, f_end: B.f.end, f_cagr: B.f.cagr, f_dd: B.f.dd, d_end: B.d.end, d_dd: B.d.dd, pos: B.w.filter((x) => x.ret > 0).length, trades: B.r.trades.length };
let md = `# Family C results (streak / day limits)\n\nBaseline (causalC, no change): end US$${u(bw.end)}, worst fall ${p(bw.dd)}%, ${bw.trades} trades; fresh-2024 end ${u(bw.f_end)} growth/yr ${p(bw.f_cagr)}% fall ${p(bw.f_dd)}%; double-cost end ${u(bw.d_end)} fall ${p(bw.d_dd)}%; 12-month starts profitable ${bw.pos}/${wins.length}.\n\nRules: 1 = fall at least 1pt smaller and end >=85% of baseline; 2 = fresh-2024 fall smaller and growth/yr >=85%; 3 = double cost ends >600 and fall smaller; 4 = smaller fall in >half of ${wins.length} 12-month starts and profitable windows >= baseline. Rule 5 (shuffle) NOT run here.\n\n| setting | end US$ | fall % | trades | fresh24 end | fresh24 g/yr % | fresh24 fall % | 2xcost end | 2xcost fall % | 12m smaller fall | 12m profitable | R1 | R2 | R3 | R4 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
const yn = (b) => (b ? 'pass' : 'fail');
for (const r of rows) md += `| ${r.name} | ${u(r.end)} | ${p(r.dd)} | ${r.trades} | ${u(r.f_end)} | ${p(r.f_cagr)} | ${p(r.f_dd)} | ${u(r.d_end)} | ${p(r.d_dd)} | ${r.sm}/${wins.length} | ${r.pos}/${wins.length} | ${yn(r.r1)} | ${yn(r.r2)} | ${yn(r.r3)} | ${yn(r.r4)} |\n`;
fs.writeFileSync(__dirname + '/famC-results.md', md);
