const T = require('./trades-windows.js');
const s0 = Date.parse('2021-10-18') / 1000, e0 = Date.parse('2026-10-18') / 1000, tr = [];
for (const s of ['SOL', 'ETH']) for (const t of T.build(s).trades) if (t.t >= s0 && t.t < e0) tr.push({ sym: s, m: new Date(t.t * 1000).toISOString().slice(0, 7), p: t.R });
const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(2);
let out = '';
for (const sym of ['SOL', 'ETH', 'BOTH']) {
  out += `\n### ${sym}\n| Year | ${M.join(' | ')} | **Year total** | Net |\n|---|${M.map(() => '---').join('|')}|---|---|\n`;
  let all = 0;
  for (let y = 2021; y <= 2026; y++) {
    let tot = 0, win = 0, cnt = 0;
    const cells = M.map((_, i) => { const k = `${y}-${String(i + 1).padStart(2, '0')}`; const x = tr.filter((t) => t.m === k && (sym === 'BOTH' || t.sym === sym));
      if (!x.length) return '·'; const v = x.reduce((a, t) => a + t.p, 0); tot += v; cnt++; if (v > 0) win++; return f(v); });
    all += tot; out += `| ${y} | ${cells.join(' | ')} | **${f(tot)}** | ${tot > 0 ? '✅' : '❌'} (${win}/${cnt} mo +) |\n`;
  }
  out += `| **All** | | | | | | | | | | | | | **${f(all)}** | |\n`;
}
console.log(out);
