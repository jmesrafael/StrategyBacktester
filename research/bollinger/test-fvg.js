// test-fvg.js — Pullback FVG, frozen settings, on SOL / ZEC / DOGE across 5m, 15m, 1h, 4h. TRAIN = entries before 2023-01-01, TEST = 2023 on.
// The settings were chosen on BTC / ETH / SOL TRAIN data (explore-fvg*.js) — ZEC and DOGE were never used to pick them — and are frozen here:
//   minGap 0.5 ATR, no displacement filter, limit at the near edge of the gap (depth 0), stop at the impulse origin, target 3R,
//   order cancelled after 20 bars, longs above / shorts below the 4h SMA200.  "Direct" = same rules, market entry at the next open.
// usage: node test-fvg.js          -> results-test-fvg.md
const L = require('./lib.js'), { fvgpb } = require('./fvg.js'), fs = require('fs');
const FOCUS = ['SOL', 'ZEC', 'DOGE'], SPLIT = L.ts(2023), INF = L.ts(2100);
const FROZEN = { minGap: 0.5, disp: 0, depth: 0, stop: 'origin', tp: 3, expire: 20, trend: 'htf', maxHold: 0, fillBuf: 0, direct: false };
const out = []; const P = (s = '') => { out.push(s); console.log(s); };
const row = (name, tr) => { const s = L.stats(tr); return `| ${name} | ${s.n} | ${L.f2(s.sum)} | ${L.f2(s.avg)} | ${s.t.toFixed(2)} | ${s.pf.toFixed(2)} | ${(s.win * 100).toFixed(0)}% | ${s.dd.toFixed(1)} |`; };
const HEAD = '| | Trades | Total R | Avg R | t-stat | PF | Win | Max DD (R) |\n|---|---|---|---|---|---|---|---|';
const have = (sym, tf) => { try { L.bars(sym, tf); return true; } catch (e) { return false; } };
const trades = (sym, tf, mode, extra = {}) => fvgpb(sym, { ...FROZEN, tf, direct: mode === 'direct', confirm: mode === 'confirm', ...extra });
const MODES = ['pullback', 'confirm', 'direct'], LABEL = { pullback: 'Pullback (limit) entry', confirm: 'Pullback + confirmation (market) entry', direct: 'Direct (market) entry' };
const costed = (mult, fn) => { L.COST.comm = 0.0004 * mult; L.COST.slip = 0.0002 * mult; try { return fn(); } finally { L.COST.comm = 0.0004; L.COST.slip = 0.0002; } };

P('# Pullback FVG — frozen settings on SOL / ZEC / DOGE\n');
P('Frozen: FVG ≥ 0.5 ATR, limit at the gap\'s near edge, stop at the impulse origin, 3R target, cancel after 20 bars, 4h SMA200 trend filter. ' +
  '"Direct" = same but a market entry at the next open; "confirmation" = wait for a bar that dips into the gap and closes back with the trend, then a market entry. Costs 0.04% commission + 0.02% slippage per side; limit fills at the touch with no slippage (the app\'s rule). ' +
  'TRAIN = entries before 2023-01-01, TEST = 2023-01-01 on. R = amount risked.\n');
const TFS = [[5, '5m'], [15, '15m'], [60, '1h'], [240, '4h']];
const summary = [];
for (const [tf, tn] of TFS) {
  const coins = FOCUS.filter((s) => have(s, tf));
  if (coins.length < FOCUS.length) P(`> ${tn}: missing data for ${FOCUS.filter((s) => !coins.includes(s)).join(', ')} — skipped those coins.\n`);
  for (const mode of MODES) {
    P(`## ${tn} — ${LABEL[mode]}\n`); P(HEAD);
    let trAll = [], teAll = [];
    for (const s of coins) {
      const t = trades(s, tf, mode), tr = L.slice(t, 0, SPLIT), te = L.slice(t, SPLIT, INF);
      trAll = trAll.concat(tr); teAll = teAll.concat(te); P(row(`${s} train`, tr)); P(row(`${s} **TEST**`, te));
    }
    P(row('All train', trAll)); P(row('**All TEST**', teAll)); P();
    const a = L.stats(trAll), b = L.stats(teAll);
    summary.push({ tn, mode, trn: a.n, tra: a.avg, ten: b.n, tea: b.avg, tes: b.sum, tet: b.t });
  }
}
P('## Summary — average R per trade\n');
P('| Timeframe | Entry | Train trades | Train avg R | Test trades | Test avg R | Test total R | Test t |\n|---|---|---|---|---|---|---|---|');
for (const s of summary) P(`| ${s.tn} | ${s.mode} | ${s.trn} | ${L.f2(s.tra)} | ${s.ten} | ${L.f2(s.tea)} | ${L.f2(s.tes)} | ${s.tet.toFixed(2)} |`);

P('\n## Stress tests on the test years (4h and 1h)\n'); P(HEAD);
for (const [tf, tn] of [[240, '4h'], [60, '1h']]) for (const mode of MODES) {
  const run = (extra, mult = 1) => costed(mult, () => FOCUS.flatMap((s) => L.slice(trades(s, tf, mode, extra), SPLIT, INF)));
  P(row(`${tn} ${mode}`, run({})));
  P(row(`${tn} ${mode} costs ×2`, run({}, 2)));
  P(row(`${tn} ${mode} costs ×3`, run({}, 3)));
  if (mode === 'pullback') { P(row(`${tn} ${mode} needs 0.1 ATR trade-through to fill`, run({ fillBuf: 0.1 }))); P(row(`${tn} ${mode} needs 0.25 ATR trade-through`, run({ fillBuf: 0.25 }))); }
  P(row(`${tn} ${mode} no trend filter`, run({ trend: 0 })));
}

P('\n## Other coins (4h, test years) — BTC and ETH were used to pick the settings; the rest never were\n'); P(HEAD);
const OTHERS = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'AVAX', 'LINK', 'LTC', 'DOT', 'TRX', 'BCH'].filter((s) => have(s, 240));
for (const mode of MODES) {
  let all = []; let pos = 0;
  for (const s of OTHERS) { const te = L.slice(trades(s, 240, mode), SPLIT, INF); all = all.concat(te); if (L.sum(te.map((t) => t.R)) > 0) pos++; }
  P(row(`${OTHERS.length} coins, ${mode}`, all)); P(`| ↳ profitable coins in test | ${pos} of ${OTHERS.length} | | | | | | |`);
}

P('\n## By year, SOL + ZEC + DOGE pooled, 4h\n'); P('| Year | Pullback trades | Pullback R | Confirm trades | Confirm R | Direct trades | Direct R |\n|---|---|---|---|---|---|---|');
for (let y = 2020; y <= 2026; y++) {
  const f = (mode) => { const r = FOCUS.flatMap((s) => L.slice(trades(s, 240, mode), L.ts(y), L.ts(y + 1))); return [r.length, L.sum(r.map((t) => t.R))]; };
  const a = f('pullback'), c = f('confirm'), b = f('direct'); if (a[0] || b[0]) P(`| ${y}${y < 2023 ? ' (train)' : ''} | ${a[0]} | ${L.f2(a[1])} | ${c[0]} | ${L.f2(c[1])} | ${b[0]} | ${L.f2(b[1])} |`);
}
fs.writeFileSync(__dirname + '/results-test-fvg.md', out.join('\n') + '\n');
