// bb-deep-risk.js — worst rolling windows + reshuffled drawdowns for the bb-deep.js trade lists (prints only)
const fs = require('fs'), src = fs.readFileSync(__dirname + '/bb-deep.js', 'utf8');
// reuse bb-deep's bot without re-printing: evaluate up to the report section
const head = src.slice(0, src.indexOf('// 0. no-look-ahead checks'));
const m = {}; new Function('require', '__dirname', 'm', head + '\nm.bot = bot; m.REAL = REAL;')(require, __dirname, m);
let seed = 99; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (const set of [['SOL'], ['ZEC'], ['BTC'], ['SOL', 'ZEC', 'BTC']]) {
  const tr = set.flatMap((s) => m.bot(s, m.REAL)).sort((a, b) => a.x - b.x), R = tr.map((t) => t.R);
  const win = (k) => { let w = Infinity; for (let i = 0; i + k <= R.length; i++) { let s = 0; for (let j = i; j < i + k; j++) s += R[j]; w = Math.min(w, s); } return w; };
  const dd = (a) => { let c = 0, p = 0, d = 0; for (const x of a) { c += x; p = Math.max(p, c); d = Math.max(d, p - c); } return d; };
  const sims = []; for (let k = 0; k < 2000; k++) { const a = R.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } sims.push(dd(a)); }
  sims.sort((a, b) => a - b);
  console.log(set.join('+'), 'n', R.length, 'worst30', win(30).toFixed(1), 'worst50', win(50).toFixed(1), 'histDD', dd(R).toFixed(1), 'MC DD median', sims[1000].toFixed(1), 'p95', sims[1900].toFixed(1), 'p99', sims[1980].toFixed(1));
}
