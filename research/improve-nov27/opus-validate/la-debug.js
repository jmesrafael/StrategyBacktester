// la-debug.js - which improve-nov27 trades change before a cut (corrupt mode)? node la-debug.js <cut> <mode>
'use strict';
const path = require('path'), cp = require('child_process'), fs = require('fs');
const TMP = process.env.LA_TMP; const cut = +process.argv[2], mode = process.argv[3] || 'corrupt';
const run = (c, m) => { const f = path.join(TMP, `dbg-${c}-${m}.json`); cp.execFileSync(process.execPath, ['--max-old-space-size=8192', path.join(__dirname, 'la-child.js'), String(c), m, String(cut % 7919), f]); return JSON.parse(fs.readFileSync(f)); };
const a = run('none', 'truncate'), b = run(cut, mode);
for (const k of Object.keys(a.trades)) {
  const A = a.trades[k].filter((t) => t[0] < cut), B = b.trades[k].filter((t) => t[0] < cut);
  const sa = new Set(A.map((t) => t[0])), sb = new Set(B.map((t) => t[0]));
  const lost = A.filter((t) => !sb.has(t[0])), changed = A.filter((t) => { const u = B.find((x) => x[0] === t[0]); return u && JSON.stringify(u) !== JSON.stringify(t); });
  if (lost.length || changed.length) console.log(k, 'entered before cut but missing in cut run:', lost.map((t) => `${new Date(t[0] * 1e3).toISOString().slice(0, 13)} exit ${new Date(t[1] * 1e3).toISOString().slice(0, 13)} ${t[4]}`), 'changed:', changed.map((t) => `${new Date(t[0] * 1e3).toISOString().slice(0, 13)} exit ${new Date(t[1] * 1e3).toISOString().slice(0, 13)} -> ${new Date(B.find((x) => x[0] === t[0])[1] * 1e3).toISOString().slice(0, 13)}`));
}
const H = 3600, T0 = Date.UTC(2020, 0, 1) / 1000; let first = null;
for (let k = 0; k < a.impCurve.tri.length; k++) { if (T0 + (k + 1) * H > cut) break; if (a.impCurve.tri[k] !== b.impCurve.tri[k]) { first = k; break; } }
console.log('first equity difference', first == null ? 'none' : new Date((T0 + (first + 1) * H) * 1e3).toISOString(), 'cut', new Date(cut * 1e3).toISOString());
