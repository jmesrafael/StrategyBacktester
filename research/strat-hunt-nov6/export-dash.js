// export-dash.js — turns pesos-out.json (+ pesos-risk.json) into the dashboard's JSON data files.
'use strict';
const fs = require('fs'), path = require('path');
const OUT = process.argv[2]; const o = JSON.parse(fs.readFileSync('pesos-out.json', 'utf8')), risk = JSON.parse(fs.readFileSync('pesos-risk.json', 'utf8'));
let T = {}; for (const f of ['trades.json', 'trades-hybrid.json']) Object.assign(T, JSON.parse(fs.readFileSync(f, 'utf8')));
const LEGS = { live: [['bb-core|BBX|4h', .5], ['i-core|P7|4h', .5]], bbc: [['bb-core|BBX|4h', 1]], ic: [['i-core|P7|4h', 1]], 'bbc-ic73': [['bb-core|BBX|4h', .7], ['i-core|P7|4h', .3]], 'bbc-tr55': [['bb-core|BBX|4h', .5], ['bb-trail|P14|4h', .5]], 'bbc-tr73': [['bb-core|BBX|4h', .7], ['bb-trail|P14|4h', .3]], 'bbc-fr55': [['bb-core|BBX|4h', .5], ['fractal|P14|4h', .5]], 'bbc-h73': [['bb-core|BBX|4h', .7], ['bb-hybrid|BBX192|4h', .3]], 'bbc-1h': [['bb-core|BBX|4h', .5], ['bb-core|BBX|1h', .5]], three: [['bb-core|BBX|4h', .5], ['i-core|P7|4h', .25], ['bb-trail|P14|4h', .25]], three1h: [['bb-core|BBX|4h', .4], ['bb-core|BBX|1h', .3], ['i-core|P7|4h', .3]] };
const cut = Date.UTC(2023, 0, 1) / 1000;
const half = (id, a, b) => { const all = []; for (const [k, w] of LEGS[id]) for (const t of T[k]) if (t[2] >= a && t[2] < b) all.push([t[2], t[3] * w]); all.sort((x, y) => x[0] - y[0]); let e = 0, p = 0, d = 0; for (const [, r] of all) { e += r; p = Math.max(p, e); d = Math.max(d, p - e); } return { R: e, dd: d, rdd: d ? e / d : 0 }; };
const r1 = (v, n = 1) => +v.toFixed(n);
const ports = o.ports.map((p) => {
  const pre = half(p.id, 0, cut), post = half(p.id, cut, 1e12), yrs = Object.values(p.yearPHP);
  return {
    id: p.id, portfolio: p.name, live: p.live ? 'yes' : 'no', bots: p.legs.length, trades: p.trades, ev_per_trade_R: r1(p.evR, 3),
    total_R: r1(p.totR), max_dd_R: r1(p.ddR), return_to_dd: r1(p.rdd), without_best10_R: r1(p.exBest10), sharpe: r1(p.sharpe, 2),
    pos_months: p.posMonths, months: p.months, pos_month_share: r1(p.posMonths / p.months, 3), pos_years: p.posYears, worst_month_R: r1(p.worstMonthR),
    longest_no_new_high_months: p.longestNoHighMonths, monthly_corr_first_two: p.corr == null ? null : r1(p.corr, 2),
    bear_month_avg_R: r1(p.regStat.bear.avgR, 2), sideways_month_avg_R: r1(p.regStat.sideways.avgR, 2), bull_month_avg_R: r1(p.regStat.bull.avgR, 2),
    before_2023_R: r1(pre.R), before_2023_rdd: r1(pre.rdd), from_2023_R: r1(post.R), from_2023_dd_R: r1(post.dd), from_2023_rdd: r1(post.rdd),
    php_avg_per_year: Math.round(yrs.reduce((a, b) => a + b, 0) / yrs.length), php_worst_year: Math.round(Math.min(...yrs)), php_7yr_withdraw_yearly: Math.round(yrs.reduce((a, b) => a + b, 0)),
    php_7yr_compound: Math.round(p.endPHP), max_dd_pct: r1(p.ddPct, 3), recover_needed_pct: r1(p.recoverNeeded, 3),
    mc_dd95_R: r1(p.mc.dd95), mc_dd95_pct: r1(p.mc.ddPct95, 3), mc_p_dd_over_30pct: r1(p.mc.pDD30, 3), mc_p_losing_year: r1(p.mc.pAnyNegYear, 3), mc_total5_R: r1(p.mc.tot5),
  };
});
const years = []; for (const p of o.ports) for (const y of o.YEARS) years.push({ id: p.id, year: y, R: r1(p.yR[y]), php: Math.round(p.yearPHP[y]) });
const months = []; for (const p of o.ports) { let c = 0; for (const m of o.MONTHS) { c += p.mR[m]; months.push({ id: p.id, month: m, R: r1(p.mR[m], 2), cum_R: r1(c), php: Math.round(p.monthPHP[m]), market: o.REG[m].reg, basket_ret: r1(o.REG[m].ret, 3) }); } }
const riskRows = []; for (const [id, arr] of Object.entries(risk)) for (const x of arr) riskRows.push({ id, risk_pct: x.risk, php_avg_per_year: Math.round(x.avgYear), php_worst_year: Math.round(x.worstYear), max_dd_pct: r1(x.ddPct, 3) });
const w = o.walk;
const walk = [
  { row: 'bb-core alone', before_2023_rdd: r1(w.aloneIn.rdd), from_2023_rdd: r1(w.aloneOut.rdd), from_2023_R: r1(w.aloneOut.tot) },
  { row: 'Live pair (bb-core + I-Core 50/50)', before_2023_rdd: r1(w.liveIn.rdd), from_2023_rdd: r1(w.liveOut.rdd), from_2023_R: r1(w.liveOut.tot) },
  { row: `Blind pick on 2020-2022: bb-core + ${w.pick.split('|').slice(0, 2).join(' ')} (${w.w * 100}/${100 - w.w * 100})`, before_2023_rdd: r1(w.inSample.rdd), from_2023_rdd: r1(w.outSample.rdd), from_2023_R: r1(w.outSample.tot) },
];
const walkSummary = [{ sleeves: w.sleeves, beat_bbcore_from_2023: w.sleevesBetterOut, beat_live_from_2023: w.sleevesBetterThanLiveOut }];
const W = (n, d) => { fs.writeFileSync(path.join(OUT, n), JSON.stringify(d)); console.log(n, (JSON.stringify(d).length / 1024).toFixed(0) + ' KB', d.length); };
W('portfolios.json', ports); W('years.json', years); W('months.json', months); W('risk-levels.json', riskRows); W('walk-forward.json', walk); W('walk-summary.json', walkSummary);
for (const p of ports) console.log(p.id, 'pre', p.before_2023_rdd, 'post', p.from_2023_rdd, p.from_2023_R, 'avgYr', p.php_avg_per_year, 'worstYr', p.php_worst_year);
