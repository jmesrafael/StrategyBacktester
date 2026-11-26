// audit.js — truncation (look-ahead) audit for strategies on the 1h hunt harness.
// For each strategy and coin: build on the full ctx, then on lib.truncated(ctx, cut) for random cuts, and compare
// L, S, xL, xS, stopL, stopS at bars cut-5..cut-1. Any difference means the strategy reads data past the bar it is decided on.
// Usage:  node audit.js --selftest
//         node audit.js <module.js> [exportName]   (module in this folder, export default name AUDIT)
'use strict';
const path = require('path');
const lib = require('./lib.js');
const I = require('../strat-hunt-nov6/ind.js');

const KEYS = ['L', 'S', 'xL', 'xS', 'stopL', 'stopS'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// both NaN, exactly equal, or within 1e-9 relative (absolute below 1)
function eq(a, b) {
  if (a !== a && b !== b) return true;
  if (a === b) return true;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
}

function valueAt(res, key, i) {
  const arr = res && res[key];
  if (!arr) return NaN;
  const v = arr[i];
  return v === undefined ? NaN : v;
}

function audit(strategies, opts = {}) {
  const coins = opts.coins || ['SOL', 'BTC', 'ADA'];
  const cuts = opts.cuts || 8;
  const rnd = mulberry32(opts.seed || 20261126);
  const perStrategy = [];

  for (const s of strategies) {
    let checks = 0, mismatches = 0;
    const samples = [];
    for (const sym of coins) {
      const full = lib.coin(sym);          // full-data ctx (its own memo)
      const fr = s.build(full);
      const span = full.n - 100 - 5000;
      for (let k = 0; k < cuts; k++) {
        const cut = 5000 + Math.floor(rnd() * span);
        const tr = s.build(lib.truncated(full, cut)); // fresh memo: nothing reused from the full ctx
        for (let i = cut - 5; i < cut; i++) {
          for (const key of KEYS) {
            if (!((tr && tr[key]) || (fr && fr[key]))) continue;
            checks++;
            const a = valueAt(tr, key, i), b = valueAt(fr, key, i);
            if (!eq(a, b)) {
              mismatches++;
              if (samples.length < 10) samples.push({ coin: sym, cut, bar: i, key, trunc: a, full: b });
            }
          }
        }
      }
    }
    const ok = checks > 0 && mismatches === 0;
    console.log(`${s.id}  checks=${checks} mismatches=${mismatches}  -> ${ok ? 'NO LOOK-AHEAD' : 'LOOK-AHEAD FOUND'}`);
    for (const m of samples) {
      console.log(`    MISMATCH ${s.id} coin=${m.coin} cut=${m.cut} bar=${m.bar} key=${m.key} truncated=${m.trunc} full=${m.full}`);
    }
    perStrategy.push({ id: s.id, checks, mismatches, ok, samples });
  }
  return { ok: perStrategy.every((p) => p.ok), perStrategy };
}

function selftest() {
  const honest = {
    id: 'honest-close-cross-sma50',
    build(ctx) {
      const sma = ctx.m('sma50', () => I.sma(ctx.C, 50));
      const n = ctx.n, L = new Float64Array(n), S = new Float64Array(n);
      for (let i = 0; i < n; i++) L[i] = I.crossUp(ctx.C, sma, i) ? 1 : 0;
      return { L, S };
    },
  };
  const cheater = {
    id: 'cheat-next-close',
    build(ctx) {
      const n = ctx.n, L = new Float64Array(n), S = new Float64Array(n);
      for (let i = 0; i < n; i++) L[i] = ctx.C[i + 1] > ctx.C[i] ? 1 : 0; // reads the next bar
      return { L, S };
    },
  };
  const res = audit([honest, cheater]);
  const [h, c] = res.perStrategy;
  const pass = h.ok && c.mismatches > 0;
  console.log(`SELFTEST ${pass ? 'PASS' : 'FAIL'}: honest ${h.ok ? 'passed' : 'failed'}, cheater ${c.mismatches > 0 ? 'failed (caught)' : 'passed (NOT caught)'}`);
  return pass;
}

module.exports = { audit, eq };

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node audit.js --selftest | node audit.js <module.js> [exportName]');
    process.exitCode = 2;
  } else if (arg === '--selftest') {
    process.exitCode = selftest() ? 0 : 1;
  } else {
    const mod = require(path.resolve(__dirname, arg));
    const name = process.argv[3] || 'AUDIT';
    const strategies = mod[name] || (Array.isArray(mod) ? mod : undefined);
    if (!Array.isArray(strategies)) {
      console.error(`export "${name}" of ${arg} is not an array of strategies`);
      process.exitCode = 2;
    } else {
      const res = audit(strategies);
      console.log(res.ok ? 'ALL NO LOOK-AHEAD' : 'LOOK-AHEAD FOUND in at least one strategy');
      process.exitCode = res.ok ? 0 : 1;
    }
  }
}
