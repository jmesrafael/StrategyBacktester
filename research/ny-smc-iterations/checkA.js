// checkA.js — Validation Check A: frozen v7 on pre-Oct-2023 SOL / ETH history (never used for tuning).
// v7 is NOT modified: ie.js + the frozen V7 config, headline costs. $ = R × $10 (fixed $10 risk).
// usage: node checkA.js   → results/validation_A.md
const fs = require('fs'), path = require('path'), E = require('./ie.js');
const DATA = path.resolve(__dirname, '../sol-ny-smc/data');
const V7 = { sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5, tpMode: 'R', tpR: 3, minDispATR: 1, minFvgATR: 0.2,
  chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5, maxStopATR: 4, maxFillBars: 8 };
const C = { ...E.BASE, ...V7 };
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const PERIODS = [
  ['A3p', 'Mar21–Oct21 (ETH only, partial: info only, not in verdict)', D0('2021-03-15'), D0('2021-10-18'), false],
  ['A2', 'Oct21–Oct22', D0('2021-10-18'), D0('2022-10-18'), true],
  ['A1', 'Oct22–Oct23', D0('2022-10-18'), D0('2023-10-18'), true],
  ['IS', 'Oct23–Oct26 (in-sample, reference)', D0('2023-10-18'), D0('2026-10-18'), false],
];
const SERIES = {
  SOL: ['data/sol15-pre.json', DATA + '/sol15-oos.json', DATA + '/sol15.json'],
  ETH: ['data/eth15-pre.json', DATA + '/eth15-all.json'],
};
const usd = (r) => (r < 0 ? '−$' : '+$') + Math.abs(r * 10).toFixed(0);
const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' });
const et = (t) => etFmt.format(new Date(t * 1000)).replace(/^24/, '00');
const out = ['# Validation Check A — v7 on pre-Oct-2023 history', '',
  `Run ${new Date().toISOString().slice(0, 16)}Z. v7 frozen (ie.js + V7 config), headline costs (maker 0.02%, taker 0.055% + 0.02% slippage on stop exits). ` +
  '$ = R × $10. Bybit linear perpetuals, 15m. Each coin is run as ONE continuous series (pre-2023 + in-sample) and trades are assigned to a period by fill time.', ''];

// ---------- 1. session / DST verification ----------
out.push('## 1. Session window in America/New_York (DST check)', '');
const dst = [];
for (const sym of ['SOL', 'ETH']) {
  const raw = SERIES[sym].flatMap((f) => JSON.parse(fs.readFileSync(path.resolve(__dirname, f), 'utf8')));
  const D = E.analyze(sym + '-full', raw, C.swingLen);
  const ny = D.A.ny;
  let ok = 0, bad = [];
  for (const t of ny) { const s = et(t + C.sessOffsetH * 3600), o = et(t), e = et(t + (C.sessOffsetH + C.sessionHours) * 3600);
    if (s === '08:30' && o === '09:30' && e === '16:00') ok++; else bad.push(new Date(t * 1000).toISOString()); }
  dst.push({ sym, n: ny.length, ok, bad, D, raw });
  out.push(`- ${sym}: ${ny.length} daily NY lines from ${new Date(ny[0] * 1000).toISOString().slice(0, 10)} to ${new Date(ny[ny.length - 1] * 1000).toISOString().slice(0, 10)}; ` +
    `session start = 08:30 ET, NY line = 09:30 ET, order expiry = 16:00 ET on **${ok} / ${ny.length}** days` + (bad.length ? ` — MISMATCH on ${bad.slice(0, 5).join(', ')}` : ''));
}
// known dates around DST changes
const known = ['2021-03-12', '2021-03-15', '2021-11-05', '2021-11-08', '2022-03-11', '2022-03-14', '2022-11-04', '2022-11-07', '2023-03-10', '2023-03-13'];
out.push('', '| Date (weekday) | NY line UTC | NY line ET | Window start ET | Window end ET | US DST |', '|---|---|---|---|---|---|');
for (const d of known) {
  const t = dst[1].D.A.ny.find((x) => new Date(x * 1000).toISOString().slice(0, 10) === d);
  if (t == null) { out.push(`| ${d} | (before data) | | | | |`); continue; }
  out.push(`| ${d} (${new Date(t * 1000).toUTCString().slice(0, 3)}) | ${new Date(t * 1000).toISOString().slice(11, 16)} | ${et(t)} | ${et(t - 3600)} | ${et(t + 2 * 3600)} | ${new Date(t * 1000).toISOString().slice(11, 13) === '13' ? 'yes (EDT)' : 'no (EST)'} |`);
}
out.push('', 'Window = CHoCH accepted 08:30–09:30 and 10:30–11:30 ET (09:30–10:30 skipped); pending orders expire 16:00 ET.', '');

// ---------- 2. run v7 ----------
const cls = (t) => t.reason === 'TP' ? 'hit' : t.reason === 'BE' ? 'be' : t.reason === 'SL' ? (t.R > -0.8 ? 'tight' : 'stop') : 'other';
const res = {};
for (const { sym, D } of dst) {
  const T = E.execute(D, C, E.setupsFor(D, C));
  // every trade's CHoCH must be inside the ET window (independent check of the session logic)
  const B = D.B, badWin = T.filter((t) => { const h = et(B[t.s.chochIdx].time); return !((h >= '08:30' && h < '09:30') || (h >= '10:30' && h < '11:30')); });
  res[sym] = { T, badWin: badWin.length };
}
out.push('## 2. Results per coin-year', '',
  'hit = 3R target · stop = full stop (≈ −1R) · tight = tightened stop after no follow-through (≈ −0.5R) · BE = breakeven exit (≈ 0R). ' +
  'Max DD = largest peak-to-trough fall of cumulative $ within the period. Cells under 15 trades = insufficient sample.', '',
  '| Coin | Period | Trades | hit / stop / tight / BE | Profit $ | Profit R | PF | Max DD $ | Note |', '|---|---|---|---|---|---|---|---|---|');
const verdict = {};
for (const sym of ['SOL', 'ETH']) {
  const pooled = [];
  const years = [];
  for (const [id, label, a, b, inVerdict] of PERIODS) {
    const T = res[sym].T.filter((t) => t.t >= a && t.t < b);
    const first = dst.find((x) => x.sym === sym).raw[0][0];
    if (first > a + 3 * 86400) { out.push(`| ${sym} | ${id} ${label} | — | — | — | — | — | — | no data (history starts ${new Date(first * 1000).toISOString().slice(0, 10)}) |`); continue; }
    const s = E.stats(T), k = { hit: 0, stop: 0, tight: 0, be: 0, other: 0 }; T.forEach((t) => k[cls(t)]++);
    const note = (T.length < 15 ? '**insufficient sample** ' : '') + (inVerdict ? '' : '(not in verdict)');
    out.push(`| ${sym} | ${id} ${label} | ${s.n} | ${k.hit} / ${k.stop} / ${k.tight} / ${k.be}${k.other ? ` (+${k.other} open at end)` : ''} | ${usd(s.sumR)} | ${s.sumR >= 0 ? '+' : ''}${s.sumR.toFixed(1)}R | ${s.pfR.toFixed(2)} | −$${(s.ddR * 10).toFixed(0)} | ${note} |`);
    if (inVerdict) { pooled.push(...T); years.push({ id, R: s.sumR, n: s.n }); }
  }
  const P = E.stats(pooled.sort((x, y) => x.t - y.t));
  const worst = years.reduce((m, y) => Math.min(m, y.R), Infinity);
  const crit = { net: P.sumR > 0, pf: P.pfR >= 1.2, n: P.n >= 40, worst: worst * 10 >= -60 };
  verdict[sym] = { P, years, crit, v: !crit.n ? 'INCONCLUSIVE' : crit.net && crit.pf && crit.worst ? 'PASS' : 'FAIL' };
  out.push(`| **${sym}** | **pooled A1+A2** | **${P.n}** | | **${usd(P.sumR)}** | **${P.sumR >= 0 ? '+' : ''}${P.sumR.toFixed(1)}R** | **${P.pfR.toFixed(2)}** | −$${(P.ddR * 10).toFixed(0)} | |`);
}
out.push('', '## 3. Verdict (pre-registered criteria, pooled A1 + A2)', '',
  '| Coin | Net > $0 | PF ≥ 1.2 | ≥ 40 trades | No year < −$60 | **Check A** |', '|---|---|---|---|---|---|');
for (const sym of ['SOL', 'ETH']) { const { P, crit, years, v } = verdict[sym]; const y = (b) => (b ? '✅' : '❌');
  out.push(`| ${sym} | ${y(crit.net)} ${usd(P.sumR)} | ${y(crit.pf)} ${P.pfR.toFixed(2)} | ${y(crit.n)} ${P.n} | ${y(crit.worst)} worst ${years.map((x) => `${x.id} ${usd(x.R)}`).join(', ')} | **${v}** |`); }
out.push('', '## 4. Integrity checks', '');
for (const sym of ['SOL', 'ETH']) {
  const IS = res[sym].T.filter((t) => t.t >= PERIODS[3][2] && t.t < PERIODS[3][3]);
  out.push(`- ${sym}: trades whose CHoCH is outside 08:30–09:30 / 10:30–11:30 ET: **${res[sym].badWin}** of ${res[sym].T.length}. ` +
    `In-sample reference from this continuous run: ${IS.length} trades, ${E.stats(IS).sumR.toFixed(2)}R (frozen headline: ${sym === 'SOL' ? '79 trades, 36.71R' : '75 trades, 50.85R'}).`);
}
fs.writeFileSync(path.join(__dirname, 'results/validation_A.md'), out.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'results/validation_A.json'), JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) =>
  [k, v.T.map((t) => ({ t: t.t, long: t.long, R: t.R, reason: t.reason, cls: cls(t), stopPct: t.stopPct }))])), null, 0));
console.log(out.join('\n'));
