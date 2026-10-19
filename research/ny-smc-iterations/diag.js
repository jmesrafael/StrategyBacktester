// diag.js — trade-level candle diagnostics for v3 (v4 / v5b are subsets of it), SOL + ETH.
// For every trade: features at setup time + what price did after the fill.
// usage: node diag.js > results/diag.txt
const fs = require('fs'), E = require('./ie.js');
const S2 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5 };
const V3 = { ...S2, tpMode: 'R', tpR: 3 };
const Y3 = E.Y.Y3[0];

const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' });
const et = (t) => { const p = Object.fromEntries(etFmt.formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value])); return { wd: p.weekday, h: (+p.hour % 24) + +p.minute / 60 }; };

const rows = [];
for (const sym of ['SOL', 'ETH']) {
  const C = { ...E.BASE, ...V3 };
  E.runSym(sym, V3);
  const D = E.analyze(sym, E.RAW[sym], C.swingLen);
  const { B, N, atr } = D;
  const T = E.execute(D, C, E.setupsFor(D, C));
  // overnight range per NY date: 18:00 ET (prev day) → 08:30 ET; London 02:00 → 08:00 ET
  const etH = new Float32Array(N); for (let i = 0; i < N; i++) etH[i] = et(B[i].time).h;
  const atrPct = atr.map((a, i) => (a ? a / B[i].close : null));
  // trailing 30-day median of ATR% for a volatility-regime ratio
  const regime = new Float32Array(N);
  { const W = 96 * 30; for (let i = W; i < N; i += 1) { if (i % 96) { regime[i] = regime[i - 1]; continue; }
    const a = atrPct.slice(i - W, i).filter(Boolean).sort((x, y) => x - y); regime[i] = a[a.length >> 1]; } }
  for (const t of T) {
    const s = t.s, dir = s.long ? 1 : -1, r = t.riskPx, F = t.fillIdx;
    // --- overnight / London range before the CHoCH (same ET morning)
    let onH = -Infinity, onL = Infinity, lnH = -Infinity, lnL = Infinity;
    for (let j = s.legXi - 1; j > 0; j--) {          // only bars BEFORE the leg extreme
      const h = etH[j];
      if (B[s.chochIdx].time - B[j].time > 18 * 3600) break;
      if (h >= 18 || h < 8.5) { onH = Math.max(onH, B[j].high); onL = Math.min(onL, B[j].low); }
      if (h >= 2 && h < 8) { lnH = Math.max(lnH, B[j].high); lnL = Math.min(lnL, B[j].low); }
    }
    const legX = s.long ? Math.min(...B.slice(s.legXi, s.legXi + 1).map((b) => b.low)) : B[s.legXi].high;
    const sweptON = s.long ? legX < onL : legX > onH;
    const sweptLN = s.long ? legX < lnL : legX > lnH;
    // entry location inside the overnight range (0 = at the low, 1 = at the high)
    const onPos = (s.entry - onL) / (onH - onL);
    // --- CHoCH candle anatomy
    const cb = B[s.chochIdx], rng = cb.high - cb.low;
    const body = Math.abs(cb.close - cb.open) / rng;
    const closeLoc = s.long ? (cb.close - cb.low) / rng : (cb.high - cb.close) / rng; // 1 = closed at the extreme
    // --- impulse leg size
    let imp = s.long ? -Infinity : Infinity;
    for (let j = s.legXi; j <= s.fvgIdx; j++) imp = s.long ? Math.max(imp, B[j].high) : Math.min(imp, B[j].low);
    // --- fill candle
    const fb = B[F];
    const fillClose = (dir * (fb.close - t.fillPx)) / r;      // where the fill bar closed vs entry, in R
    // --- path after fill, ignoring breakeven: until the ORIGINAL stop or 192 bars
    const lv = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5], hit = {}, barsTo = {};
    let mfe = 0, mae = 0, stopBar = null, maeBefore1R = 0;
    for (let j = F; j < Math.min(N, F + 192); j++) {
      const b = B[j];
      const adv = (dir * ((s.long ? b.low : b.high) - t.fillPx)) / r;
      if (s.long ? b.low <= t.stop : b.high >= t.stop) { stopBar = j - F; break; }
      mae = Math.min(mae, adv); if (!hit[1]) maeBefore1R = mae;
      if (j === F && t.fillPx !== b.open) continue;            // fill bar's extreme may predate the fill
      const fav = (dir * ((s.long ? b.high : b.low) - t.fillPx)) / r;
      mfe = Math.max(mfe, fav);
      for (const k of lv) if (!hit[k] && fav >= k) { hit[k] = true; barsTo[k] = j - F; }
    }
    const mfe4 = (() => { let m = 0; for (let j = F + 1; j <= F + 4 && j < N; j++) m = Math.max(m, (dir * ((s.long ? B[j].high : B[j].low) - t.fillPx)) / r); return m; })();
    const e = et(B[s.chochIdx].time), ef = et(B[F].time);
    rows.push({
      sym, yr: t.t >= Y3 ? 'Y3' : t.t >= E.Y.Y2[0] ? 'Y2' : 'Y1', train: t.t < Y3, long: s.long, R: t.R, reason: t.reason,
      chochH: e.h, fillH: ef.h, wd: e.wd, barsToFill: F - s.fvgIdx, gapBars: s.fvgIdx - s.chochIdx,
      stopPct: t.stopPct, stopATR: r / atr[s.fvgIdx], dispATR: rng / atr[s.chochIdx], fvgATR: s.fvgATR,
      body, closeLoc, legATR: Math.abs(imp - legX) / atr[s.fvgIdx], fib: s.fibR,
      regime: atrPct[s.fvgIdx] / (regime[s.fvgIdx] || atrPct[s.fvgIdx]),
      sweptON, sweptLN, onPos: s.long ? onPos : 1 - onPos, sd: s.f.sd, pd: s.f.pd,
      fillClose, mfe, mae, maeBefore1R, mfe4, hit, barsTo, stopBar,
      v4: rng >= atr[s.chochIdx], v5b: rng >= atr[s.chochIdx] && s.fvgATR >= 0.2,
    });
  }
}
fs.writeFileSync(__dirname + '/results/diag-trades.json', JSON.stringify(rows));

// ---------- reporting ----------
const P = (x) => (x * 100).toFixed(0).padStart(3) + '%';
const sg = (x, d = 1) => ((x >= 0 ? '+' : '') + x.toFixed(d)).padStart(6);
function line(name, A) {
  const g = (a) => { const n = a.length, sR = a.reduce((x, t) => x + t.R, 0); return { n, sR, avg: n ? sR / n : 0, w: n ? a.filter((t) => t.reason === 'TP').length / n : 0 }; };
  const tr = g(A.filter((t) => t.train)), y3 = g(A.filter((t) => !t.train)), so = g(A.filter((t) => t.sym === 'SOL')), eh = g(A.filter((t) => t.sym === 'ETH'));
  return `${name.padEnd(34)} | train n=${String(tr.n).padStart(3)} TP${P(tr.w)} avg ${sg(tr.avg, 2)} sum ${sg(tr.sR)} | Y3 n=${String(y3.n).padStart(3)} avg ${sg(y3.avg, 2)} sum ${sg(y3.sR)} | SOL ${sg(so.sR)} ETH ${sg(eh.sR)}`;
}
const table = (title, buckets) => { console.log('\n### ' + title); for (const [n, f] of buckets) console.log(line(n, rows.filter(f))); };
const q = (key, cuts) => cuts.map((c, i) => [`${key} ${i ? cuts[i - 1] : '-∞'}..${c}`, (t) => t[key] >= (i ? cuts[i - 1] : -Infinity) && t[key] < c]).concat([[`${key} ≥ ${cuts[cuts.length - 1]}`, (t) => t[key] >= cuts[cuts.length - 1]]]);

console.log('v3 trades, SOL+ETH, 2023-10 → 2026-10. avg/sum = R per trade / total R. TP% = share hitting the 3R target.');
table('All', [['v3 all', () => true], ['v4 subset (CHoCH ≥ 1 ATR)', (t) => t.v4], ['v5b subset', (t) => t.v5b]]);

// ---- path: how far do fills run before the original stop?
console.log('\n### Path after fill (ignoring breakeven): share of trades reaching +kR before the original stop');
for (const grp of [['train', (t) => t.train], ['Y3', (t) => !t.train]]) {
  const A = rows.filter(grp[1]);
  console.log(grp[0].padEnd(6), [0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map((k) => `${k}R:${P(A.filter((t) => t.hit[k]).length / A.length)}`).join('  '));
}
{ // expectancy of pure fixed target T, no breakeven, from the path (ignores fees)
  const A = rows.filter((t) => t.train);
  console.log('train: no-BE fixed target expectancy (gross R/trade):', [1, 1.5, 2, 2.5, 3, 4, 5].map((k) => { const p = A.filter((t) => t.hit[k]).length / A.length; return `${k}R ${sg(p * k - (1 - p), 2)}`; }).join('  '));
}
const med = (a) => { a = a.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
console.log('median bars fill→+1R (trades that got there):', med(rows.map((t) => t.barsTo[1])), ' fill→+3R:', med(rows.map((t) => t.barsTo[3])), ' fill→stop (stopped before 1R):', med(rows.filter((t) => !t.hit[1]).map((t) => t.stopBar)));
console.log('BE exits that later reached +3R before the original stop:', rows.filter((t) => t.reason === 'BE' && t.hit[3]).length, 'of', rows.filter((t) => t.reason === 'BE').length);

table('Early momentum: best excursion in the 4 bars after the fill', q('mfe4', [0.25, 0.5, 1]));
table('Fill candle close vs entry (R; >0 = closed back in trade direction)', q('fillClose', [-0.5, -0.25, 0, 0.25]));
table('Bars from FVG to fill', [['1', (t) => t.barsToFill === 1], ['2-3', (t) => t.barsToFill >= 2 && t.barsToFill <= 3], ['4-8', (t) => t.barsToFill >= 4 && t.barsToFill <= 8], ['9+', (t) => t.barsToFill >= 9]]);
table('CHoCH time (ET)', [['08:30-09:30 pre-open', (t) => t.chochH < 9.5], ['09:30-10:30', (t) => t.chochH >= 9.5 && t.chochH < 10.5], ['10:30-11:30', (t) => t.chochH >= 10.5]]);
table('Fill time (ET)', [['before 09:30', (t) => t.fillH < 9.5], ['09:30-11:30', (t) => t.fillH >= 9.5 && t.fillH < 11.5], ['11:30-16:00', (t) => t.fillH >= 11.5]]);
table('Weekday', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => [d, (t) => t.wd === d]));
table('Direction', [['long', (t) => t.long], ['short', (t) => !t.long]]);
table('CHoCH candle range / ATR', q('dispATR', [0.75, 1, 1.5, 2]));
table('CHoCH candle body / range', q('body', [0.4, 0.6, 0.8]));
table('CHoCH candle close location (1 = at extreme)', q('closeLoc', [0.5, 0.75, 0.9]));
table('FVG height / ATR', q('fvgATR', [0.1, 0.2, 0.4, 0.7]));
table('Bars CHoCH → FVG completes', [['1', (t) => t.gapBars === 1], ['2', (t) => t.gapBars === 2], ['3-5', (t) => t.gapBars >= 3 && t.gapBars <= 5], ['6-10', (t) => t.gapBars >= 6]]);
table('Stop distance %', q('stopPct', [0.005, 0.0075, 0.01, 0.015, 0.02]));
table('Stop distance / ATR', q('stopATR', [1.5, 2.5, 4, 6]));
table('Impulse leg / ATR', q('legATR', [3, 5, 8]));
table('Entry retracement of the impulse (fib)', q('fib', [0.382, 0.5, 0.618, 0.786]));
table('Volatility regime (ATR% vs 30-day median)', q('regime', [0.8, 1, 1.25, 1.6]));
table('Liquidity sweep: leg extreme took the overnight (18:00-08:30) high/low', [['swept overnight', (t) => t.sweptON], ['no sweep', (t) => !t.sweptON]]);
table('Liquidity sweep: leg extreme took the London (02:00-08:00) high/low', [['swept London', (t) => t.sweptLN], ['no sweep', (t) => !t.sweptLN]]);
table('Entry location in overnight range (0 = discount for longs / premium for shorts)', q('onPos', [0, 0.25, 0.5, 0.75, 1]));
table('Toolkit confluence', [['S/D zone', (t) => t.sd], ['PDH/PDL', (t) => t.pd], ['neither', (t) => !t.sd && !t.pd]]);
