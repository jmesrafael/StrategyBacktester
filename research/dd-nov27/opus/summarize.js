'use strict';
const L = (n) => require('./out-' + n + '.json'), B = L('BASE'), p = (v) => (100 * v).toFixed(1), u = (v) => Math.round(v).toLocaleString('en-US');
const bpos = B.w.filter((x) => x.ret > 0).length;
for (const n of ['BASE', 'S8', 'S8_tib', 'S8_coinrev', 'S8_nopend', 'COMBO']) {
  const r = L(n), r1 = r.dd <= B.dd - 0.01 && r.end >= 0.85 * B.end, r2 = r.f24.dd < B.f24.dd && r.f24.cagr >= 0.85 * B.f24.cagr, r3 = r.x2.end > 600 && r.x2.dd < B.x2.dd;
  const sm = r.w.filter((x, i) => x.dd < B.w[i].dd).length, pos = r.w.filter((x) => x.ret > 0).length, r4 = sm > r.w.length / 2 && pos >= bpos;
  const medRet = [...r.w.map((x, i) => x.ret / B.w[i].ret)].sort((a, b) => a - b)[35];
  console.log(`| ${n} | ${u(r.end)} (${p(r.end / B.end)}%) | ${p(r.dd)} | ${p(r.f24.cagr)}/${p(r.f24.dd)} (${p(r.f24.cagr / B.f24.cagr)}%) | ${u(r.x2.end)}/${p(r.x2.dd)} | ${sm}/71, pos ${pos} | med12m ret vs base ${p(medRet)}% | ${[r1, r2, r3, r4].map((x) => (x ? 'y' : 'n')).join('')} | reduced ${r.halved}/${r.n}`);
}
