// engines/validator - the Rule Gatekeeper. One fixed set of checks every new strategy or rule must pass before it
// may be tried on a paper bot. It reads data and writes a verdict. It never changes a bot.
//
// Usage:  node engines/validator/index.js <strategy> [--coins SOL,ZEC,...]
//         node engines/validator/index.js selftest      (the known strategies: bots must pass, rejected ideas must fail)
// A strategy is a factory in engines/backtest/strategies.js: (overrides) -> strategy object with .params.
//
// HARD checks (any failure = REJECTED)           SOFT checks (any failure = WATCH)
//  1 no look-ahead (truncation audit)             8  neighbours (+-20%): at least 75% positive
//  2 >= 150 trades, t-stat >= 2 (higher later) 9  most years positive (at least 60%)
//  3 positive from 2024 on (unseen), >= 40 trades 10 leave-one-coin-out stays positive
//  4 survives 2x costs                            11 no single regime holds more than 70% of the profit
//  5 positive without its 10 best trades          12 walk-forward: picking parameters on the past works on the next year
//  6 not a copy of the live bots (overlap, monthly correlation)
// Every run is appended to the experiment log (dataset "experiments", hash chained) so the number of ideas tried is known.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../../lib/spine'), cfg = require('../../lib/config'), U = require('../../lib/util'), M = require('../../lib/market');
const E = require('../backtest/engine'), S = require('../backtest/strategies');
const { H } = U;
const CUT = Date.UTC(2024, 0, 1) / 1000;
const DEFAULT_COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];

const avg = (a) => (a.length ? U.mean(a) : NaN);
const total = (tr) => U.sum(tr.map((t) => t.R));
function runAll(make, coins, scale, overrides = {}) {
  const out = [];
  for (const coin of coins) { const B = M.candles(coin, '4h'), F = M.has(coin, 'funding') ? M.bars(coin, 'funding') : null;
    for (const t of E.run(B, make(overrides), E.standardCost({ funding: F, scale })).trades) out.push({ ...t, coin }); }
  return out.sort((a, b) => a.tExit - b.tExit || a.t - b.t);
}
const monthKey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
function monthly(tr) { const m = {}; for (const t of tr) m[monthKey(t.tExit)] = (m[monthKey(t.tExit)] || 0) + t.R; return m; }

// ---- individual checks. Each returns { pass, value, detail } ----
function causality(make, coins, seed = 3) {
  const rnd = U.rng(seed); let bad = 0, checked = 0;
  for (const coin of coins) {
    const B = M.candles(coin, '4h'), F = M.has(coin, 'funding') ? M.bars(coin, 'funding') : null, cost = E.standardCost({ funding: F });
    const full = E.run(B, make({}), cost).trades;
    for (let k = 0; k < 4; k++) {
      const cut = Math.floor(B.length * (0.5 + rnd() * 0.45)), end = B[cut - 1].time + 14400, part = E.run(B.slice(0, cut), make({}), cost).trades, ref = full.filter((t) => t.tExit <= end);
      checked++;
      if (part.length !== ref.length || part.some((t, i) => t.t !== ref[i].t || t.tExit !== ref[i].tExit || t.dir !== ref[i].dir)) bad++;
    }
  }
  return { pass: bad === 0, value: bad, detail: `${checked} random cut-offs: ${bad} gave different earlier trades` };
}
function sizeAndSignificance(tr, nTests) {
  const st = E.stats(tr), need = nTests > 1 ? 2 + 0.5 * Math.sqrt(2 * Math.log(nTests)) - 0.5 * Math.sqrt(2 * Math.log(1)) : 2;   // a higher bar when more ideas were tried
  return { pass: st.n >= 150 && st.tStat >= need, value: st.tStat, detail: `${st.n} trades, t-stat ${st.tStat.toFixed(2)} (needs >= ${need.toFixed(2)} after ${nTests} experiment(s) logged; and at least 150 trades)` };
}
function outOfSample(tr) {
  const a = tr.filter((t) => t.t < CUT), b = tr.filter((t) => t.t >= CUT), ia = avg(a.map((t) => t.R)), ib = avg(b.map((t) => t.R));
  return { pass: b.length >= 40 && ib > 0, value: ib, detail: `before 2024: ${a.length} trades, ${U.signed(ia, 3)}R each; from 2024: ${b.length} trades, ${U.signed(ib, 3)}R each (${ia > 0 ? Math.round(ib / ia * 100) + '% of the earlier result' : 'n/a'})`, deg: ia > 0 ? ib / ia : null };
}
function costs2x(make, coins, base) { const x = runAll(make, coins, 2), st = E.stats(x); return { pass: st.avgR > 0, value: st.avgR, detail: `at 2x costs: ${U.signed(st.avgR, 3)}R per trade (at 1x: ${U.signed(E.stats(base).avgR, 3)}R)` }; }
function concentration(tr) {
  const top = [...tr].sort((a, b) => b.R - a.R).slice(0, 10), rest = total(tr) - total(top), share = total(tr) > 0 ? total(top) / total(tr) : null;
  return { pass: rest > 0, value: rest, detail: `total ${total(tr).toFixed(1)}R; without the 10 best trades ${rest.toFixed(1)}R (the 10 best are ${share == null ? 'n/a' : Math.round(share * 100) + '%'} of the total)` };
}
function overlapWithBots(tr, exclude) {
  let ref; try { ref = spine.load('derived/reference-trades', 'trades.csv').filter((t) => t.version === 'v3' && t.cost === 'standard' && t.bot !== exclude); } catch (e) { return { pass: true, skipped: true, value: null, detail: 'reference backtests not built: overlap not checked' }; }
  const by = new Map(); for (const t of ref) { const k = t.coin + t.dir; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
  let same = 0; for (const t of tr) if ((by.get(t.coin + t.dir) || []).some((b) => b.t <= t.t && b.t_exit > t.t)) same++;
  const share = tr.length ? same / tr.length : 0, W = { bbcore: 0.5, icore: 0.25, tcore: 0.25 }, tri = {};
  for (const t of ref) if (W[t.bot]) { const k = monthKey(t.t_exit); tri[k] = (tri[k] || 0) + W[t.bot] * t.r; }
  const mc = monthly(tr), ks = Object.keys(mc).filter((k) => k in tri).sort(), c = U.corr(ks.map((k) => mc[k]), ks.map((k) => tri[k]));
  return { pass: share < 0.7 && !(c != null && c > 0.85), value: share, corr: c, detail: `${Math.round(share * 100)}% of its trades start while a live-bot rule already holds the same coin and side; monthly correlation with TRI-CORE ${c == null ? 'n/a' : c.toFixed(2)} (${ks.length} months). Fails at 70% overlap or 0.85 correlation` };
}
function neighbours(make, coins, params) {
  const rows = [];
  for (const [k, v] of Object.entries(params)) { if (typeof v !== 'number' || v === 0) continue;
    for (const f of [0.8, 1.2]) { const nv = Number.isInteger(v) ? Math.max(1, Math.round(v * f)) : +(v * f).toFixed(6); if (nv === v) continue;
      const tr = runAll(make, coins, 1, { [k]: nv }), st = E.stats(tr), oos = avg(tr.filter((t) => t.t >= CUT).map((t) => t.R)); rows.push({ param: k, value: nv, n: st.n, avg_r: st.avgR, oos: oos }); } }
  const good = rows.filter((r) => r.avg_r > 0 && r.oos > 0).length;
  return { pass: rows.length > 0 && good / rows.length >= 0.75, value: rows.length ? good / rows.length : null, detail: `${good} of ${rows.length} neighbouring settings are positive overall and from 2024`, rows };
}
function perYear(tr) {
  const y = {}; for (const t of tr) { const k = new Date(t.tExit * 1000).getUTCFullYear(); y[k] = (y[k] || 0) + t.R; }
  const ks = Object.keys(y), pos = ks.filter((k) => y[k] > 0).length;
  return { pass: ks.length > 0 && pos / ks.length >= 0.6, value: pos / ks.length, detail: `${pos} of ${ks.length} years positive: ${ks.map((k) => k + ' ' + U.signed(y[k], 0)).join(', ')}` };
}
function leaveOneCoinOut(tr, coins) {
  const rows = coins.map((c) => ({ c, r: total(tr.filter((t) => t.coin !== c)) }));
  return { pass: rows.every((x) => x.r > 0), value: Math.min(...rows.map((x) => x.r)), detail: 'without ' + rows.map((x) => `${x.c} ${U.signed(x.r, 0)}R`).join(', ') };
}
function regimeShare(tr) {
  let Rg; try { Rg = require('../regime'); } catch (e) { return { pass: true, skipped: true, value: null, detail: 'regime engine not available' }; }
  const S0 = {}, by = {};
  for (const t of tr) { if (!S0[t.coin]) S0[t.coin] = Rg.series(M.bars(t.coin, '1h')); const g = Rg.coinRegimeAt(S0[t.coin], t.sigT + 4 * H); const s = g ? g.state : 'unknown'; by[s] = (by[s] || 0) + t.R; }
  const tot = total(tr), pos = Object.entries(by).filter(([, v]) => v > 0), best = pos.sort((a, b) => b[1] - a[1])[0];
  const share = tot > 0 && best ? best[1] / tot : null;
  return { pass: share == null || share <= 0.7, value: share, detail: `R by regime at the signal: ${Object.entries(by).map(([k, v]) => k + ' ' + U.signed(v, 0)).join(', ')}${share != null ? `; the largest state holds ${Math.round(share * 100)}% of the total` : ''}` };
}
// walk-forward: each year from 2022, choose the best of the grid (+-20% neighbours and the default) on all earlier years, then record that choice's result in the year.
function walkForward(make, coins, params) {
  const grid = [{}]; for (const [k, v] of Object.entries(params)) { if (typeof v !== 'number' || v === 0) continue; for (const f of [0.8, 1.2]) { const nv = Number.isInteger(v) ? Math.max(1, Math.round(v * f)) : +(v * f).toFixed(6); if (nv !== v) grid.push({ [k]: nv }); } }
  const runs = grid.map((o) => runAll(make, coins, 1, o)), yr = (t) => new Date(t.tExit * 1000).getUTCFullYear(), years = [...new Set(runs[0].map(yr))].filter((y) => y >= 2022).sort(), rows = [];
  for (const y of years) { const score = runs.map((r) => total(r.filter((t) => yr(t) < y))), pick = score.indexOf(Math.max(...score)); rows.push({ year: y, picked: JSON.stringify(grid[pick]), chosen_r: total(runs[pick].filter((t) => yr(t) === y)), default_r: total(runs[0].filter((t) => yr(t) === y)) }); }
  const sum = (k) => U.sum(rows.map((r) => r[k]));
  return { pass: rows.length > 0 && sum('chosen_r') > 0 && sum('chosen_r') >= 0.5 * sum('default_r'), value: sum('chosen_r'), detail: `years ${years.join(', ')}: parameters picked on the past gave ${U.signed(sum('chosen_r'), 1)}R in the next year, the unchanged default ${U.signed(sum('default_r'), 1)}R`, rows };
}

function experimentCount() { try { return spine.load('experiments', 'log.jsonl').length; } catch (e) { return 0; } }
const LOG = { name: 'string', at: 'int', coins: 'string', verdict: 'string', hard_failed: 'string?', trades: 'int', avg_r: 'number', params_hash: 'string', seq: 'int', prev_hash: 'string', row_hash: 'string' };
function logExperiment(row) {
  const f = path.join(spine.dir('experiments'), 'log.jsonl'), ex = fs.existsSync(f) ? U.parseJsonl(fs.readFileSync(f, 'utf8')) : [];
  if (spine.chainVerify(ex) != null) throw new Error('experiment log was altered: restore it from backup before running more experiments');
  const all = spine.chainAppend(ex, [row], LOG);
  return spine.write('experiments', { generator: 'engines/validator', checks: [{ name: 'log intact (hash chain)', ok: true, detail: `${all.length} experiments` }], notes: ['every validator run is appended here, so the number of ideas tried is known'], files: { 'log.jsonl': { rows: all, schema: LOG } } });
}

function validate(name, opts = {}) {
  const make = opts.make || ((o) => S.MAKE[name] ? S.bot(name, 'v3', o) : S[name](o)), coins = opts.coins || DEFAULT_COINS, probe = make({}), nTests = (opts.nTests != null ? opts.nTests : experimentCount()) + 1;
  const base = runAll(make, coins, 1), checks = [];
  const add = (id, hard, title, r) => checks.push({ id, hard, title, ...r });
  add(1, true, 'No look-ahead (truncation audit)', causality(make, coins));
  add(2, true, 'Enough trades and significant', sizeAndSignificance(base, nTests));
  const oos = outOfSample(base); add(3, true, 'Positive on data from 2024 on', oos);
  add(4, true, 'Survives 2x costs', costs2x(make, coins, base));
  add(5, true, 'Positive without its 10 best trades', concentration(base));
  add(6, true, 'Not a copy of the live bots', opts.skipOverlap ? { pass: true, skipped: true, detail: 'skipped for a live bot itself' } : overlapWithBots(base, opts.exclude));
  add(8, false, 'Neighbouring settings (+-20%) mostly positive', neighbours(make, coins, probe.params || {}));
  add(9, false, 'Most years positive', perYear(base));
  add(10, false, 'Leave-one-coin-out stays positive', leaveOneCoinOut(base, coins));
  add(11, false, 'No single regime holds most of the profit', regimeShare(base));
  add(12, false, 'Walk-forward parameter choice works', walkForward(make, coins, probe.params || {}));
  const hardFail = checks.filter((c) => c.hard && !c.pass), softFail = checks.filter((c) => !c.hard && !c.pass), st = E.stats(base);
  const verdict = hardFail.length ? 'REJECTED' : softFail.length ? 'WATCH' : 'PASSES';
  return { name, coins, verdict, hardFail, softFail, checks, stats: st, nTests, oos, trades: base };
}

function writeReport(v) {
  const dir = path.join(cfg.reportsDir, 'validation'); U.mkdirp(dir);
  const L = [`# Validation: ${v.name}`, '', `Coins ${v.coins.join(' ')}. 4h Binance candles, standard costs, real funding. Run ${new Date().toISOString().slice(0, 16)} UTC. Experiments logged before this one: ${v.nTests - 1}.`, '',
    `## Verdict: ${v.verdict}`, '', v.verdict === 'REJECTED' ? `Failed hard check(s): ${v.hardFail.map((c) => c.id + ' ' + c.title).join('; ')}. Record this in research/TESTED-STRATEGIES.md as rejected.` : v.verdict === 'WATCH' ? `All hard checks passed. Soft check(s) failed: ${v.softFail.map((c) => c.id + ' ' + c.title).join('; ')}. Allowed on a paper bot only, with these in mind.` : 'All checks passed. May be tried on a paper bot. Live use needs its own risk review.', '',
    `${v.stats.n} trades, ${U.signed(v.stats.totalR, 1)}R total, ${U.signed(v.stats.avgR, 3)}R per trade, win rate ${Math.round(v.stats.winRate * 100)}%, worst drop ${v.stats.maxDD.toFixed(1)}R, longest losing run ${v.stats.maxLossStreak}.`, '',
    U.mdTable(v.checks, [['#', (c) => c.id], ['Type', (c) => (c.hard ? 'hard' : 'soft')], ['Check', (c) => c.title], ['Result', (c) => (c.skipped ? 'skipped' : c.pass ? 'pass' : 'FAIL')], ['Detail', (c) => c.detail]]), '',
    '## Limits', '', '- A pass is not a promise. It means the idea survived these tests on past data.', '- Soft checks use few samples for some strategies; read the detail column.', '- The experiment count raises the bar for the t-statistic as more ideas are tried.'];
  fs.writeFileSync(path.join(dir, v.name + '.md'), L.join('\n') + '\n'); return path.join(dir, v.name + '.md');
}
function runOne(name, opts = {}) {
  const v = validate(name, opts), f = writeReport(v);
  if (!opts.noLog) logExperiment({ name, at: Math.floor(Date.now() / 1000), coins: v.coins.join(' '), verdict: v.verdict, hard_failed: v.hardFail.map((c) => c.id).join(',') || null, trades: v.stats.n, avg_r: U.round(v.stats.avgR, 4), params_hash: U.sha256(U.canonical((opts.make ? opts.make({}) : (S.MAKE[name] ? S.bot(name) : S[name]({}))).params)).slice(0, 16) });
  return { ...v, report: f };
}
// the known strategies: each live bot is a strategy that passed review, bbFade and rsi2 are recorded as rejected in the registry
function selftest() {
  const expect = { bbcore: ['PASSES', 'WATCH'], icore: ['PASSES', 'WATCH'], tcore: ['PASSES', 'WATCH'], bbFade: ['REJECTED'], rsi2: ['REJECTED'] }, rows = [];
  for (const [name, ok] of Object.entries(expect)) { const v = runOne(name, { exclude: S.MAKE[name] ? name : undefined, skipOverlap: !!S.MAKE[name], noLog: true }); rows.push({ name, verdict: v.verdict, expected: ok.join(' or '), match: ok.includes(v.verdict), failed: v.hardFail.concat(v.softFail).map((c) => c.id).join(',') }); }
  return rows;
}
module.exports = { validate, runOne, selftest, causality, sizeAndSignificance, outOfSample, concentration, perYear, leaveOneCoinOut, walkForward, neighbours, overlapWithBots, runAll, logExperiment };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === 'selftest') { const rows = selftest(); for (const r of rows) console.log(r.name.padEnd(8), r.verdict.padEnd(9), 'expected', r.expected.padEnd(18), r.match ? 'MATCH' : 'MISMATCH', r.failed ? '(failed: ' + r.failed + ')' : ''); process.exit(rows.every((r) => r.match) ? 0 : 1); }
  else if (a[0]) { const ci = a.indexOf('--coins'); const r = runOne(a[0], { coins: ci > 0 ? a[ci + 1].split(',') : undefined }); console.log(`${a[0]}: ${r.verdict}  -> ${path.relative(process.cwd(), r.report)}`); }
  else console.log('usage: node engines/validator/index.js <strategy|selftest> [--coins SOL,ZEC]');
}
