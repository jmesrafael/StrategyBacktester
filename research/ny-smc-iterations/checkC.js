// checkC.js — Validation Check C: intrabar-ordering audit of frozen v7. See "Check C" in the pre-registered rules.
// usage: node checkC.js   → results/validation_C.md, results/validation_C.json
const fs = require('fs'), path = require('path'), crypto = require('crypto'), E = require('./ie.js'), X = require('./execC.js'), T = require('./trades-windows.js');
const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'ie.js'))).digest('hex');
if (!sha.startsWith('6539c98f')) throw new Error('ie.js changed since the v7 freeze');
const C = T.C, TICK = { SOL: 0.001, ETH: 0.01 };
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const YR = { A2: [D0('2021-10-18'), D0('2022-10-18')], A1: [D0('2022-10-18'), D0('2023-10-18')], Y1: E.Y.Y1, Y2: E.Y.Y2, Y3: E.Y.Y3 };
const usd = (x) => (x < 0 ? '−$' : '+$') + Math.abs(x).toFixed(0);
const inY = (t, y) => t.t >= YR[y][0] && t.t < YR[y][1];
const sum = (a) => a.reduce((x, t) => x + t.R * 10, 0);
const out = ['# Validation Check C — intrabar-ordering audit for v7', '',
  `Run ${new Date().toISOString().slice(0, 16)}Z · v7 frozen (ie.js sha256 ${sha.slice(0, 8)}…) · Bybit perp, trades re-checked on 15m (current / pessimistic) and on 1-minute candles · $10 per R.`, '',
  'Modes: **current** = the engine behind every earlier number; **pessimistic** = worst-case ordering when one 15m candle touches an adverse and a favourable level, plus one extra tick on breakeven and tightened-stop exits ' +
  `(tick: SOL ${TICK.SOL}, ETH ${TICK.ETH}); **1m replay** = same trades, entries unchanged, exits re-simulated minute by minute; a 1m candle that still holds both levels falls back to the pessimistic rule.`, ''];
const res = {};
for (const sym of ['SOL', 'ETH']) {
  const { D, trades: base } = T.build(sym), setups = E.setupsFor(D, C);
  // (1) harness regression: execC 'current' must equal ie.js
  const cur = X.execute(D, C, setups, 'current', TICK[sym]);
  const same = cur.length === base.length && cur.every((t, i) => t.fillIdx === base[i].fillIdx && t.exitIdx === base[i].exitIdx && t.reason === base[i].reason && Math.abs(t.R - base[i].R) < 1e-9);
  // (2) pessimistic full re-simulation (15m)
  const pess = X.execute(D, C, setups, 'pessimistic', TICK[sym]);
  // (3) 1m replay of the baseline trades
  const m1 = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, `data/m1-${sym.toLowerCase()}.json`), 'utf8')).map((r) => [r[0], r]));
  let nullReplay = 0;
  const rep = base.map((t) => { const r = X.replay1m(D, C, t, m1, TICK[sym]); if (!r || r.missingAt) { nullReplay++; return { ...t, fallback: true, amb1m: 0 }; } return { ...t, R: r.R, reason: r.reason, amb1m: r.amb1m, exitTime: r.exitTime }; });
  // (4) exposure
  const am = base.map((t) => X.audit(D, C, t));
  res[sym] = { base, cur, pess, rep, am, same, nullReplay };
}
out.push('## 0. Harness check', '');
for (const sym of ['SOL', 'ETH']) out.push(`- ${sym}: the execution-mode simulator in 'current' mode reproduces ie.js trade-for-trade (${res[sym].base.length} trades: entry and exit candle, reason, R): **${res[sym].same ? 'yes' : 'NO — STOP'}**; ` +
  `1m replay could not be completed for ${res[sym].nullReplay} trades (these fall back to their 15m result).`);
out.push('', '## 1. Exposure — trades with at least one ambiguous 15m candle', '',
  'Ambiguous = one candle touched both an adverse and a favourable level, so the order is a guess: stop & target in the same candle ("stop+TP"), stop & the breakeven trigger ("stop+trigger"), or the breakeven trigger & the breakeven level (price reached +1R and came back to entry inside one candle: "trigger+BE level").', '',
  '| Coin | Year | Trades | Ambiguous trades | Share | stop+TP | stop+trigger | trigger+BE level |', '|---|---|---|---|---|---|---|---|');
const expo = {};
for (const sym of ['SOL', 'ETH']) {
  const { base, am } = res[sym];
  for (const y of ['A2', 'A1', 'Y1', 'Y2', 'Y3']) {
    const idx = base.map((t, i) => (inY(t, y) ? i : -1)).filter((i) => i >= 0);
    const amb = idx.filter((i) => am[i].stopTp + am[i].stopTrig + am[i].trigBe > 0);
    const sp = idx.filter((i) => am[i].stopTp).length, st = idx.filter((i) => am[i].stopTrig).length, tb = idx.filter((i) => am[i].trigBe).length;
    expo[`${sym}/${y}`] = { n: idx.length, amb: amb.length, sp, st, tb };
    out.push(`| ${sym} | ${y} | ${idx.length}${idx.length < 15 ? ' (insufficient sample)' : ''} | ${amb.length} | ${(amb.length / idx.length * 100).toFixed(0)}% | ${sp} | ${st} | ${tb} |`);
  }
  const all = base.length, a = am.filter((x) => x.stopTp + x.stopTrig + x.trigBe > 0).length;
  out.push(`| **${sym}** | **all** | **${all}** | **${a}** | **${(a / all * 100).toFixed(0)}%** | ${am.filter((x) => x.stopTp).length} | ${am.filter((x) => x.stopTrig).length} | ${am.filter((x) => x.trigBe).length} |`);
}
out.push('', '## 2. Profit under the three modes', '', '| Coin | Period | Trades (cur / pess / 1m) | **Current** | **Pessimistic** | Pess ÷ current | **1m replay** | 1m vs current |', '|---|---|---|---|---|---|---|---|');
const perY = {};
const PER = [['A2', ['A2']], ['A1', ['A1']], ['A pooled (A2+A1)', ['A2', 'A1']], ['Y1', ['Y1']], ['Y2', ['Y2']], ['Y3', ['Y3']], ['Oct23–Oct26 pooled', ['Y1', 'Y2', 'Y3']]];
for (const sym of ['SOL', 'ETH']) {
  const { base, pess, rep } = res[sym];
  for (const [lab, ys] of PER) {
    const f = (t) => ys.some((y) => inY(t, y));
    const b = base.filter(f), p = pess.filter(f), r = rep.filter(f), sb = sum(b), sp = sum(p), sr = sum(r);
    perY[`${sym}/${lab}`] = { n: [b.length, p.length, r.length], cur: sb, pess: sp, m1: sr };
    out.push(`| ${sym} | ${lab} | ${b.length} / ${p.length} / ${r.length} | ${usd(sb)} | ${usd(sp)} | ${sb > 0 ? (sp / sb * 100).toFixed(0) + '%' : '—'} | ${usd(sr)} | ${sb ? ((sr / sb - 1) * 100).toFixed(1) + '%' : '—'} |`);
  }
}
out.push('', '## 3. What actually changes', '');
for (const sym of ['SOL', 'ETH']) {
  const { base, pess, rep } = res[sym];
  const pm = new Map(pess.map((t) => [t.fillIdx, t]));
  const inPess = base.filter((t) => pm.has(t.fillIdx)), flipped = inPess.filter((t) => pm.get(t.fillIdx).reason !== t.reason);
  const dropped = base.filter((t) => !pm.has(t.fillIdx)).length, added = pess.filter((t) => !base.some((b) => b.fillIdx === t.fillIdx)).length;
  const ok = rep.map((t, i) => [t, base[i]]).filter(([t]) => !t.fallback);
  const flip1 = ok.filter(([t, b]) => t.reason !== b.reason).length, dR = ok.map(([t, b]) => Math.abs(t.R - b.R)).sort((a, b) => a - b);
  out.push(`- ${sym} pessimistic: ${flipped.length} of ${inPess.length} matching trades change exit type; trades dropped from the sequence ${dropped}, added ${added}. ` +
    `${sym} 1m replay: ${flip1} of ${ok.length} trades change exit type; median |ΔR| ${dR[dR.length >> 1].toFixed(3)}, 90th percentile ${dR[Math.floor(dR.length * 0.9)].toFixed(2)}; trades that still had an ambiguous 1m candle: ${ok.filter(([t]) => t.amb1m).length}.`);
}
out.push('', '## 4. Verdict (pre-registered)', '', 'PASS per coin if: pessimistic profit ≥ 60% of current (Oct23–Oct26 pooled) **and** every coin-year Y1–Y3 stays ≥ $0 under pessimistic, **and** 1m replay within ±20% of current profit.', '',
  '| Coin | Pessimistic ≥ 60% of current | Y1 / Y2 / Y3 pessimistic ≥ $0 | 1m replay within ±20% | **Check C** |', '|---|---|---|---|---|');
const verdict = {};
for (const sym of ['SOL', 'ETH']) {
  const P = perY[`${sym}/Oct23–Oct26 pooled`], ratio = P.pess / P.cur, yrs = ['Y1', 'Y2', 'Y3'].map((y) => perY[`${sym}/${y}`].pess), dev = P.m1 / P.cur - 1;
  const c1 = ratio >= 0.6, c2 = yrs.every((v) => v >= 0), c3 = Math.abs(dev) <= 0.2;
  verdict[sym] = c1 && c2 && c3 ? 'PASS' : 'FAIL';
  out.push(`| ${sym} | ${c1 ? '✅' : '❌'} ${usd(P.pess)} / ${usd(P.cur)} = ${(ratio * 100).toFixed(0)}% | ${c2 ? '✅' : '❌'} ${yrs.map(usd).join(' / ')} | ${c3 ? '✅' : '❌'} ${usd(P.m1)} (${(dev * 100).toFixed(1)}%) | **${verdict[sym]}** |`);
}
fs.writeFileSync(path.join(__dirname, 'results/validation_C.md'), out.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'results/validation_C.json'), JSON.stringify({ verdict, expo, perY }, null, 1));
console.log(out.join('\n'));
