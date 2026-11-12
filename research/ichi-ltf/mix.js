// mix.js — mix & match the building blocks, tune on IN-SAMPLE only, judge out of sample.
// Objective (IS = trades closed before 2024): how much a candidate improves the TRI-CORE account when it takes a 20% sleeve,
// measured TRADE BY TRADE (not month-end): score = (return / max drawdown) of 80% TRI + 20% candidate minus TRI alone.
// Gate: the candidate must be positive at 2x costs on all 14 coins pooled (IS).
// Then: OOS score of the IS top picks, the rank correlation IS vs OOS over all candidates, and a top-5 ensemble sleeve.
const fs = require('fs'), path = require('path');
const LIB = require(path.join(__dirname, '../../candles/candles.js'));
const { build, backtest, COST } = require('./strat.js');
const BT = JSON.parse(fs.readFileSync(path.join(__dirname, '../zec-replacement-2/trades-fill.json')));
const ALL = LIB.coins(), BOT = ['SOL', 'NEAR', 'ADA', 'GALA'];
const T0 = Date.UTC(2020, 9, 20) / 1000, Y24 = Date.UTC(2024, 0, 1) / 1000, T1 = Date.UTC(2026, 10, 11) / 1000;
const clip = (tr, a, b) => tr.filter(t => t.tExit >= a && t.tExit < b);
const W = (tr, w) => tr.map(t => ({ tExit: t.tExit, R: t.R * w }));
const TRI = [...W(BOT.flatMap(c => BT[c + '|BB-CORE']), .5), ...W(BOT.flatMap(c => BT[c + '|I-CORE']), .25), ...W([...BOT, 'ETH'].flatMap(c => BT[c + '|T-CORE']), .25)];
function curve(tr) { const s = [...tr].sort((a, b) => a.tExit - b.tExit); let e = 0, p = 0, d = 0; for (const t of s) { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); } return { tot: e, dd: d, rdd: d > 0 ? e / d : 0 }; }
const mixScore = (cand, a, b, w = .2) => { const base = curve(clip(TRI, a, b)), m = curve([...W(clip(TRI, a, b), 1 - w), ...W(clip(cand, a, b), w)]); return { gain: m.rdd - base.rdd, mix: m, base }; };
const avg = a => a.length ? a.reduce((x, t) => x + t.R, 0) / a.length : 0;
const mk = t => { const d = new Date(t * 1e3); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }, m0 = mk(T0), NM = mk(T1 - 1) - m0 + 1;
const monthly = tr => { const M = new Array(NM).fill(0); tr.forEach(t => { const k = mk(t.tExit) - m0; if (k >= 0 && k < NM) M[k] += t.R; }); return M; };
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let s = 0, a = 0, b = 0; for (let i = 0; i < n; i++) { s += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2; } return a && b ? s / Math.sqrt(a * b) : 0; };
const MTRI = monthly(TRI);

const data = {}; for (const c of ALL) data[c] = build(c);
const cands = [];
for (const entry of ['E1', 'E2', 'E3', 'E4', 'E5']) for (const htf of ['ichi4', 'd1', 'both', 'none']) for (const exit of ['T2', 'T3', 'KJ', 'TM24', 'P7', 'P14']) {
  const cfg = { entry, htf, exit }, name = `${entry}/${htf}/${exit}`;
  const all = ALL.flatMap(c => backtest(c, cfg, { data: data[c] }));
  const x2 = ALL.flatMap(c => backtest(c, cfg, { data: data[c], cost: { fee: COST.fee * 2, slip: COST.slip * 2 } }));
  const bot = clip(all.filter(t => BOT.includes(t.coin)), T0, T1);
  const is = mixScore(bot, T0, Y24), oos = mixScore(bot, Y24, T1);
  cands.push({ name, cfg, bot, isAvg: avg(all.filter(t => t.tExit < Y24)), oosAvg: avg(all.filter(t => t.tExit >= Y24)), x2IS: avg(x2.filter(t => t.tExit < Y24)), x2OOS: avg(x2.filter(t => t.tExit >= Y24)),
    isGain: is.gain, oosGain: oos.gain, corr: corr(monthly(bot), MTRI), nBot: bot.length });
}
console.error('built', cands.length);
const gated = cands.filter(c => c.x2IS > 0 && c.nBot >= 100);
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); idx.forEach(([, i], k) => r[i] = k); return r; };
const rho = (() => { const a = rank(gated.map(c => c.isGain)), b = rank(gated.map(c => c.oosGain)); return corr(a, b); })();
gated.sort((a, b) => b.isGain - a.isGain);
const base = { is: mixScore([], T0, Y24).base, oos: mixScore([], Y24, T1).base };
console.log(`TRI-CORE alone: IS return/DD ${base.is.rdd.toFixed(2)} (${base.is.tot.toFixed(0)}R / ${base.is.dd.toFixed(1)}R) | OOS ${base.oos.rdd.toFixed(2)} (${base.oos.tot.toFixed(0)}R / ${base.oos.dd.toFixed(1)}R)`);
console.log(`${cands.length} candidates, ${gated.length} pass the IS 2x-cost gate. Rank correlation of IS gain vs OOS gain: ${rho.toFixed(2)} (1 = IS predicts OOS, 0 = noise)`);
console.log(`candidates that improve the account IS: ${gated.filter(c => c.isGain > 0).length}; OOS: ${gated.filter(c => c.oosGain > 0).length}; both: ${gated.filter(c => c.isGain > 0 && c.oosGain > 0).length}`);
console.log('\nTOP 15 by IS gain           IS gain  OOS gain | 14-coin avgR IS / OOS | 2x OOS | corr TRI | bot trades');
for (const c of gated.slice(0, 15)) console.log(`${c.name.padEnd(26)} ${c.isGain.toFixed(2).padStart(7)} ${c.oosGain.toFixed(2).padStart(8)} | ${c.isAvg.toFixed(2).padStart(5)} / ${c.oosAvg.toFixed(2).padStart(5)} | ${c.x2OOS.toFixed(2).padStart(5)} | ${c.corr.toFixed(2).padStart(5)} | ${c.nBot}`);
// ensemble of the IS top 5: each gets 1/5 of the 20% sleeve
const top5 = gated.slice(0, 5), ens = top5.flatMap(c => W(c.bot, 1 / 5));
const eIS = mixScore(ens, T0, Y24), eO = mixScore(ens, Y24, T1);
console.log(`\nENSEMBLE of IS top 5 as a 20% sleeve: IS gain ${eIS.gain.toFixed(2)} (mix ${eIS.mix.tot.toFixed(0)}R / DD ${eIS.mix.dd.toFixed(1)}R) | OOS gain ${eO.gain.toFixed(2)} (mix ${eO.mix.tot.toFixed(0)}R / DD ${eO.mix.dd.toFixed(1)}R vs TRI ${eO.base.tot.toFixed(0)}R / ${eO.base.dd.toFixed(1)}R) | corr TRI ${corr(monthly(ens), MTRI).toFixed(2)}`);
// best possible in hindsight (for honesty: what the OOS-best would have been)
const hind = [...gated].sort((a, b) => b.oosGain - a.oosGain)[0];
console.log(`hindsight-best OOS (not selectable): ${hind.name} OOS gain ${hind.oosGain.toFixed(2)}, its IS gain ${hind.isGain.toFixed(2)} (IS rank ${gated.indexOf(hind) + 1}/${gated.length})`);
fs.writeFileSync(path.join(__dirname, 'mix.json'), JSON.stringify({ rho, base, cands: cands.map(({ bot, ...c }) => c), top5: top5.map(c => c.name) }));
