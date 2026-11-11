// perbot.js — a 5th coin PER BOT. T-CORE already trades ETH (Nov 12, 2026); BB-CORE and I-CORE run SOL+NEAR+ADA+GALA only.
// Every candidate (all crypto with data in ../zec-replacement + the MEXC tradfi perps here, 24/7 flat-filled) is scored per bot.
//   node perbot.js   -> perbot.json + PERBOT.md (+ console)
// Gates per bot (fixed before results): >= 3 years scored; PF >= 1.3; both halves of its history positive; >= 75% of rolling
// 12-month windows positive; positive at double costs; listed on MEXC futures with >= $1M/day (bot positions are ~$40-100).
// Deciding test: that bot's keepers + candidate vs keepers alone (and vs keepers + ETH), same window (Oct 18, 2021 or the candidate's start).
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6'), Z = path.join(__dirname, '..', 'zec-replacement');
const { run, stats, COST } = require(path.join(H, 'engine.js'));
const { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));

const IV = 14400, NOW = Date.parse('2026-11-11T00:00:00Z') / 1000, YR = 365.25 * 86400, P0 = Date.UTC(2021, 9, 18) / 1000, SPAN_FROM = Date.UTC(2016, 11, 2) / 1000;
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' };
const KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'];
const by = (id) => S.find((s) => s.id === id);
const tmeta = JSON.parse(fs.readFileSync(path.join(__dirname, 'fetch-meta.json'), 'utf8'));
const vol = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, 'ticker.json'), 'utf8')).data.map((t) => [t.symbol, +t.amount24]));
const fill = (rows) => { const out = []; for (const r of rows) { const t = Math.floor(r[0] / IV) * IV; if (out.length) { const p = out[out.length - 1]; for (let k = p[0] + IV; k < t; k += IV) out.push([k, p[4], p[4], p[4], p[4], 0]); if (t <= p[0]) continue; } out.push([t, r[1], r[2], r[3], r[4], r[5]]); } return out; };
const toB = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));

function load(name) {
  if (tmeta[name] && !tmeta[name].error) {
    let F = JSON.parse(fs.readFileSync(path.join(__dirname, 'funding', name + '.json'), 'utf8'));
    const B = toB(fill(JSON.parse(fs.readFileSync(path.join(__dirname, 'data4h', name + '.json'), 'utf8'))));
    if (F.length) { const mean = F.reduce((a, r) => a + r[1], 0) / F.length, back = []; for (let t = F[0][0] - 28800; t > B[0].time; t -= 28800) back.push([t, mean]); F = [...back.reverse(), ...F]; }
    return { B, funding: F.length ? F : null, kind: 'tradfi', usd: vol[tmeta[name].sym] || 0 };
  }
  const f10 = path.join(Z, 'data4h-10y', name + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', name + '.json');
  const fp = path.join(Z, 'funding', name + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  return { B: toB(JSON.parse(fs.readFileSync(f, 'utf8'))), funding: F.length ? F : null, kind: 'crypto', usd: vol[name + '_USDT'] || 0 };
}
const curve = (tr) => { tr = [...tr].sort((a, b) => a.tExit - b.tExit); let e = 0, p = 0, d = 0; for (const t of tr) { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); } return { total: e, dd: d, rdd: d > 0 ? e / d : e > 0 ? 99 : 0 }; };
const mIdx = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
function monthly(tr, a, b) { const M = new Array(b - a + 1).fill(0); for (const t of tr) { const k = mIdx(t.tExit) - a; if (k >= 0 && k < M.length) M[k] += t.R; } return M; }
function roll12(tr, from) { let pos = 0, n = 0; for (let a = from; a + YR <= NOW; a += YR / 12) { n++; if (tr.filter((t) => t.tExit > a && t.tExit <= a + YR).reduce((x, t) => x + t.R, 0) > 0) pos++; } return n ? pos / n : null; }
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sx && sy ? sxy / Math.sqrt(sx * sy) : 0; };

const names = [...new Set([...fs.readdirSync(path.join(Z, 'data4h')), ...fs.readdirSync(path.join(Z, 'data4h-10y'))].map((f) => f.replace('.json', '')))]
  .concat(Object.keys(tmeta).filter((n) => !tmeta[n].error)).filter((n) => n !== 'ZEC');
const T = {}, info = {};
for (const name of names) {
  const d = load(name); if (d.B.length < 600) continue;
  const ctx = makeCtx(d.B, '4h'), from = Math.max(SPAN_FROM, d.B[205].time);
  const bbc = by('bb-core').build(ctx), built = { BBX: bbc, P7: by('i-core').build(ctx), P14: { ...bbc, stopL: null, stopS: null } };
  info[name] = { kind: d.kind, usd: d.usd, from, span: (NOW - from) / YR };
  for (const [bot, p] of Object.entries(BOTS)) {
    const tr = run(d.B, ctx.atr14, built[p], exitOf(p, ctx), d.funding, IV, COST).trades.filter((t) => t.t >= from && t.tExit <= NOW + IV);
    const c2 = run(d.B, ctx.atr14, built[p], exitOf(p, ctx), d.funding, IV, { fee: COST.fee * 2, slip: COST.slip * 2 }).trades.filter((t) => t.t >= from).reduce((x, t) => x + t.R, 0);
    T[name + '|' + bot] = { tr: tr.map((t) => ({ t: t.t, tExit: t.tExit, R: t.R })), cost2: c2 };
  }
}

const out = {};
for (const bot of Object.keys(BOTS)) {
  const keepTr = KEEP.flatMap((c) => T[c + '|' + bot].tr), rows = [];
  for (const name of Object.keys(info)) {
    if (KEEP.includes(name)) continue;
    const { tr, cost2 } = T[name + '|' + bot], i = info[name], s = stats(tr), mid = i.from + (NOW - i.from) / 2;
    const a = mIdx(i.from) + 1, b = mIdx(NOW) - 1, M = monthly(tr, a, b), yrs = {};
    for (const t of tr) { const y = new Date(t.tExit * 1000).getUTCFullYear(); yrs[y] = (yrs[y] || 0) + t.R; }
    const w0 = Math.max(P0, i.from), wa = mIdx(w0) + 1, keepW = keepTr.filter((t) => t.tExit > w0), candW = tr.filter((t) => t.tExit > w0), ethW = T['ETH|' + bot].tr.filter((t) => t.tExit > w0);
    const keepC = curve(keepW), withC = curve([...keepW, ...candW]), withE = curve([...keepW, ...ethW]);
    const mk = monthly([...keepW, ...candW], wa, b), mko = monthly(keepW, wa, b);
    const r = {
      name, kind: i.kind, usdM: i.usd / 1e6, years: i.span, from: new Date(i.from * 1000).toISOString().slice(0, 10),
      n: s.n, avgR: s.exp, pf: s.pf, win: s.win, total: s.total, perYear: s.total / i.span, dd: s.dd,
      loseMo: M.filter((v) => v < 0).length / M.length, roll12: roll12(tr, i.from), h1: tr.filter((t) => t.tExit <= mid).reduce((x, t) => x + t.R, 0), h2: tr.filter((t) => t.tExit > mid).reduce((x, t) => x + t.R, 0),
      yearsPos: Object.entries(yrs).filter(([y, v]) => +y < 2026 && v > 0).length, yearsN: Object.keys(yrs).filter((y) => +y < 2026).length, cost2,
      corrKeep: corr(monthly(candW, wa, b), mko), port: { from: new Date(w0 * 1000).toISOString().slice(0, 10), keepers: keepC, withCand: withC, withETH: withE, loseMoKeep: mko.filter((v) => v < 0).length / mko.length, loseMoWith: mk.filter((v) => v < 0).length / mk.length },
    };
    r.failed = [];
    if (r.years < 3) r.failed.push('3y'); if (!(r.pf >= 1.3)) r.failed.push('pf'); if (!(r.h1 > 0 && r.h2 > 0)) r.failed.push('halves');
    if (!(r.roll12 >= 0.75)) r.failed.push('roll12'); if (!(r.cost2 > 0)) r.failed.push('cost2'); if (!(r.usdM >= 1)) r.failed.push('mexc');
    r.dRdd = withC.rdd - keepC.rdd; r.dRddETH = withC.rdd - withE.rdd;
    rows.push(r);
  }
  out[bot] = rows.sort((x, y) => y.dRdd - x.dRdd);
}
fs.writeFileSync(path.join(__dirname, 'perbot.json'), JSON.stringify(out, null, 1));

const f = (v, d = 1) => (v == null ? '-' : (v >= 0 ? '+' : '') + v.toFixed(d)), pc = (v) => (v == null ? '-' : Math.round(v * 100) + '%');
let md = `# 5th coin per bot (Nov 12, 2026)\n\nT-CORE already trades ETH. BB-CORE and I-CORE run SOL+NEAR+ADA+GALA. Candidates: ${Object.keys(info).length - KEEP.length} markets (crypto + MEXC tradfi perps, 24/7 flat-filled). ` +
  `Gates: ≥ 3 yrs, PF ≥ 1.3, both halves +, ≥ 75% rolling 12-mo windows +, + at 2× costs, MEXC ≥ $1M/day. ` +
  `Portfolio = that bot's 4 keepers + candidate vs the 4 keepers alone, same window (Oct 18, 2021 or the candidate's start).\n`;
for (const bot of Object.keys(BOTS)) {
  const head = `| coin | type | yrs | trades | win | PF | exp R | R/yr | DD | losing mo | 12-mo + | yrs + | 1st/2nd half | 2× cost | MEXC $M/d | corr keepers | keepers ret/DD → with coin (with ETH) | losing mo keepers → with | gates |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const line = (r) => `| ${r.name} | ${r.kind} | ${r.years.toFixed(1)} | ${r.n} | ${pc(r.win)} | ${r.pf.toFixed(2)} | ${f(r.avgR, 2)} | ${f(r.perYear)} | ${r.dd.toFixed(1)} | ${pc(r.loseMo)} | ${pc(r.roll12)} | ${r.yearsPos}/${r.yearsN} | ${f(r.h1, 0)}/${f(r.h2, 0)} | ${f(r.cost2, 0)} | ${r.usdM.toFixed(1)} | ${r.corrKeep.toFixed(2)} | ${r.port.keepers.rdd.toFixed(2)} → **${r.port.withCand.rdd.toFixed(2)}** (${r.port.withETH.rdd.toFixed(2)}) | ${pc(r.port.loseMoKeep)} → ${pc(r.port.loseMoWith)} | ${r.failed.length ? r.failed.join(', ') : '✅'} |\n`;
  const pass = out[bot].filter((r) => !r.failed.length);
  md += `\n## ${bot} — ${pass.length} pass all gates (sorted by portfolio ret/DD gain)\n\n` + head + pass.map(line).join('');
  md += `\n<details><summary>${bot}: best 25 that failed a gate</summary>\n\n` + head + out[bot].filter((r) => r.failed.length).slice(0, 25).map(line).join('') + `\n</details>\n`;
}
fs.writeFileSync(path.join(__dirname, 'PERBOT.md'), md);
console.log(md);
