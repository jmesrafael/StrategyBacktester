// analyze.js — robustness of the finalists vs the two live bots. node analyze.js "key1,key2,..." [tf]
//   keys look like  bb-trail|P7|4h . Reads trades.json + trades-hybrid.json (whatever exists).
'use strict';
const fs = require('fs');
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
let T = {}; for (const f of ['trades.json', 'trades-hybrid.json']) if (fs.existsSync(f)) Object.assign(T, JSON.parse(fs.readFileSync(f, 'utf8')));
const keys = (process.argv[2] || '').split(',').filter(Boolean);
const sum = (a) => a.reduce((x, y) => x + y, 0), f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
const yr = (t) => new Date(t[2] * 1000).getUTCFullYear();
function maxDD(tr) { const s = [...tr].sort((a, b) => a[2] - b[2]); let e = 0, p = 0, d = 0; for (const t of s) { e += t[3]; p = Math.max(p, e); d = Math.max(d, p - e); } return d; }
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
function boot(R, B = 2000) { const n = R.length, m = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += R[Math.floor(rnd() * n)]; m.push(s / n); } m.sort((a, b) => a - b); return [m[Math.floor(B * 0.025)], m[Math.floor(B * 0.975)]]; }
console.log('| variant | trades | total R | exp R (95% CI) | before 2023 | 2023+ | LONG R | SHORT R | SHORT R in 2022 | total w/o best 10 trades | best 10 = % of total | worst coin R | per coin ' + COINS.join('/') + ' |');
console.log('|' + '---|'.repeat(13));
for (const k of keys) {
  const tr = T[k]; if (!tr) { console.log('| ' + k + ' | (missing) |'); continue; }
  const R = tr.map((t) => t[3]), tot = sum(R), srt = [...R].sort((a, b) => b - a), best10 = sum(srt.slice(0, 10));
  const [lo, hi] = boot(R), perCoin = COINS.map((_, ci) => sum(tr.filter((t) => t[0] === ci).map((t) => t[3])));
  const pre = sum(tr.filter((t) => yr(t) < 2023).map((t) => t[3])), post = tot - pre;
  const L = sum(tr.filter((t) => t[5] === 1).map((t) => t[3])), Sh = tot - L, s22 = sum(tr.filter((t) => t[5] === -1 && yr(t) === 2022).map((t) => t[3]));
  console.log(`| ${k} | ${tr.length} | ${f1(tot)} | ${(tot / tr.length).toFixed(2)} (${lo.toFixed(2)} to ${hi.toFixed(2)}) | ${f1(pre)} | ${f1(post)} | ${f1(L)} | ${f1(Sh)} | ${f1(s22)} | ${f1(tot - best10)} | ${(best10 / tot * 100).toFixed(0)}% | ${f1(Math.min(...perCoin))} | ${perCoin.map(f1).join(' / ')} |`);
}
