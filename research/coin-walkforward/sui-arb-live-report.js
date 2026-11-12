// sui-arb-live-report.js — the ledger report for the Nov 12, 2026 coin change: ARB joins BB-CORE, SUI and ARB join T-CORE, I-CORE unchanged (live).
//   node sui-arb-live-report.js  -> D:\testing\Strat\ledger\reports\sui-arb-live.html + its entry in reports/index.json, sui-arb-live.json
// Same trades as sui-arb.js / monthly.js (live bot rules from ../strat-hunt-nov6, Binance 4h, real fees, slippage and funding, 1R per trade, R booked at exit).
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), Z = path.join(__dirname, '../zec-replacement');
const LEDGER = path.join(__dirname, '..', '..', '..', 'ledger', 'reports');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, WT = { 'BB-CORE': .5, 'I-CORE': .25, 'T-CORE': .25 };
const BASE = { 'BB-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'I-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'T-CORE': ['SOL', 'NEAR', 'ADA', 'GALA', 'ETH'] };
const ADD = { 'BB-CORE': ['ARB'], 'I-CORE': [], 'T-CORE': ['SUI', 'ARB'] };
const COINS = ['SUI', 'ARB', 'SOL', 'NEAR', 'ADA', 'GALA', 'ETH'];
const W0 = Date.UTC(2023, 5, 10) / 1000, END = Date.UTC(2026, 10, 12) / 1000;
const DATE = 'Nov 12, 2026', TITLE = 'SUI and ARB Join the Live Bots', SLUG = 'sui-arb-live';
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---- trades (identical to monthly.js)
const by = (id) => S.find((s) => s.id === id), T = {};
for (const c of COINS) {
  const f10 = path.join(Z, 'data4h-10y', c + '.json'), fp4 = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(fp4, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(Z, 'funding', c + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  T[c] = {};
  for (const [bot, p] of Object.entries(BOTS)) T[c][bot] = run(B, x.atr14, built[p], exitOf(p, x), F.length ? F : null, 14400, COST).trades.filter((t) => t.tExit <= END).map((t) => ({ x: t.tExit, R: t.R }));
}

// ---- helpers
const mkey = (x) => { const d = new Date(x * 1e3); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const monthKeys = (from, to) => { const k = []; for (let d = new Date(Date.UTC(new Date(from * 1e3).getUTCFullYear(), new Date(from * 1e3).getUTCMonth(), 1)); d.getTime() / 1e3 < to; d.setUTCMonth(d.getUTCMonth() + 1)) k.push(d.toISOString().slice(0, 7)); return k; };
const KEYS = monthKeys(W0, END);   // Jun 2023 .. Nov 2026 (42 months)
const monthly = (tr, keys = KEYS) => { const m = Object.fromEntries(keys.map((k) => [k, 0])); for (const t of tr) if (m[mkey(t.x)] !== undefined) m[mkey(t.x)] += t.R; return keys.map((k) => m[k]); };
const sorted = (tr) => [...tr].sort((a, b) => a.x - b.x);
function stats(tr) {
  const s = sorted(tr), R = s.map((t) => t.R), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0);
  let e = 0, pk = 0, dd = 0, run = 0, streak = 0; for (const r of R) { e += r; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); run = r <= 0 ? run + 1 : 0; streak = Math.max(streak, run); }
  const gw = w.reduce((a, b) => a + b, 0), gl = -l.reduce((a, b) => a + b, 0);
  return { n: R.length, total: e, win: R.length ? w.length / R.length : 0, pf: gl ? gw / gl : 0, exp: R.length ? e / R.length : 0, dd, streak };
}
const inWin = (tr, a = W0, b = END) => tr.filter((t) => t.x > a && t.x <= b);
const botSet = (bot, coins) => coins.flatMap((c) => T[c][bot]);
const acct = (add) => Object.keys(BOTS).flatMap((b) => [...BASE[b], ...add[b]].flatMap((c) => T[c][b].map((t) => ({ x: t.x, R: t.R * WT[b] }))));
const NONE = { 'BB-CORE': [], 'I-CORE': [], 'T-CORE': [] };
const posM = (mv) => mv.filter((v) => v > 1e-9).length;

// ---- the numbers
const cur = inWin(acct(NONE)), sel = inWin(acct(ADD));
const sCur = stats(cur), sSel = stats(sel), mvCur = monthly(cur), mvSel = monthly(sel), mvDiff = mvSel.map((v, i) => v - mvCur[i]);
const options = [];
for (const b of Object.keys(BOTS)) for (const extra of [[], ['ARB'], ['SUI'], ['SUI', 'ARB']]) {
  const s = stats(inWin(botSet(b, [...BASE[b], ...extra]))), mv = monthly(inWin(botSet(b, [...BASE[b], ...extra])));
  options.push({ bot: b, extra, ...s, rdd: s.total / s.dd, pos: posM(mv), chosen: extra.join() === ADD[b].join() });
}
const NEW = [['SUI', 'T-CORE'], ['ARB', 'T-CORE'], ['ARB', 'BB-CORE']];
const coinRows = NEW.map(([c, b]) => {
  const all = T[c][b], s = stats(all), mvAll = monthly(all, monthKeys(Math.min(...all.map((t) => t.x)), END));
  const years = {}; for (const t of all) { const y = new Date(t.x * 1e3).getUTCFullYear(); (years[y] = years[y] || []).push(t); }
  const yr = Object.fromEntries(Object.entries(years).map(([y, tr]) => [y, stats(tr)]));
  const bestM = Math.max(...mvAll), months = mvAll.length;
  return { c, b, ...s, months, perMonth: s.n / months, pos: posM(mvAll), yr, bestM, bestShare: bestM / s.total, inBotShare: stats(inWin(all)).total };
});
const contrib = { 'ARB on BB-CORE': 0.5 * stats(inWin(T.ARB['BB-CORE'])).total, 'SUI on T-CORE': 0.25 * stats(inWin(T.SUI['T-CORE'])).total, 'ARB on T-CORE': 0.25 * stats(inWin(T.ARB['T-CORE'])).total };
fs.writeFileSync(path.join(__dirname, 'sui-arb-live.json'), JSON.stringify({ account: { current: sCur, selective: sSel, posCur: posM(mvCur), posSel: posM(mvSel), better: posM(mvDiff) }, options, coinRows, contrib }, null, 1));

// ================= HTML =================
const CSS = fs.readFileSync(path.join(LEDGER, 'tcore-eth.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const EXTRA = `.bar { display:inline-block; height:9px; border-radius:3px; background:#0f766e; vertical-align:middle; margin-right:6px; }
.bar.grey { background:#cbd5e1; } td.nw { white-space:nowrap; } tr.pick td { background:#f0fdfa; font-weight:600; } .pill { display:inline-block; font-size:9px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; padding:2px 7px; border-radius:999px; }
.pill.go { background:#ccfbf1; color:#0f766e; } .pill.no { background:#fee2e2; color:#b91c1c; } .pill.keep { background:#e2e8f0; color:#334155; }
table.heat td { text-align:center; padding:4px 2px; font-size:9.5px; } table.heat th { text-align:center; } table.heat td:first-child { text-align:left; font-weight:700; }
table.heat tr.tot td { background:#f1f5f9; }`;
const f = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d), n1 = (v, d = 1) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d), pc = (v, d = 0) => (v * 100).toFixed(d) + '%';
const cls = (v) => (v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'flat');
const heat = (v, full = 12) => { if (Math.abs(v) < 0.05) return '#f8fafc'; const a = Math.min(1, Math.abs(v) / full); return v > 0 ? `rgba(15,118,110,${0.12 + 0.6 * a})` : `rgba(220,38,38,${0.12 + 0.6 * a})`; };
const ink = (v, full = 12) => (Math.abs(v) / full > 0.6 ? '#fff' : '#0f172a');
let page = 0; const foot = () => `<div class="foot"><span>Lucid'io · ${TITLE} · ${DATE}</span><span>A test on past prices, not a promise · page ${++page}</span></div>`;
const card = (k, v, sub) => `<div class="cmp"><div class="k">${k}</div><div class="row"><div><span class="v up">${v}</span></div><div style="font-size:10.5px;color:#64748b">${sub}</div></div></div>`;
const NC = '#0f766e', CC = '#94a3b8';

// account curve: current vs new, cumulative R by month
function curveSvg() {
  let a = 0, b = 0; const pc1 = mvCur.map((v) => (a += v)), ps = mvSel.map((v) => (b += v)), w = 760, h = 240, l = 44, r = 84, t = 12, bt = 26;
  const max = Math.ceil(Math.max(...ps) / 50) * 50, min = Math.min(0, ...pc1, ...ps);
  const X = (i) => l + (i / (KEYS.length - 1)) * (w - l - r), Y = (v) => t + (1 - (v - min) / (max - min)) * (h - t - bt);
  let g = ''; for (let v = 0; v <= max; v += 50) g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e2e8f0"/><text class="ax" x="${l - 6}" y="${Y(v) + 3}" text-anchor="end">${v}R</text>`;
  KEYS.forEach((k, i) => { if (k.endsWith('-01') || i === 0) g += `<text class="ax" x="${X(i)}" y="${h - 8}" text-anchor="middle">${i === 0 ? 'Jun 2023' : k.slice(0, 4)}</text>`; });
  const line = (pts, col, wd) => `<polyline fill="none" stroke="${col}" stroke-width="${wd}" points="${pts.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/>`;
  const yA = Y(ps.at(-1)), yB = Y(pc1.at(-1)), sep = Math.abs(yA - yB) < 14 ? 14 - Math.abs(yA - yB) : 0;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="TRI-CORE account, cumulative R by month, current coins vs with SUI and ARB">${g}${line(pc1, CC, 2)}${line(ps, NC, 2.6)}
  <text class="lbl" x="${w - r + 6}" y="${yA - sep / 2 + 4}" fill="${NC}">${f(ps.at(-1), 0)}R</text><text class="lbl" x="${w - r + 6}" y="${yB + sep / 2 + 4}" fill="#64748b">${f(pc1.at(-1), 0)}R</text></svg>`;
}
// yearly contribution of the three additions to the account (weighted R), grouped bars
function contribSvg() {
  const yrs = [2023, 2024, 2025, 2026], series = [['ARB on BB-CORE', 'BB-CORE', 'ARB', 0.5, '#0f766e'], ['SUI on T-CORE', 'T-CORE', 'SUI', 0.25, '#1d4ed8'], ['ARB on T-CORE', 'T-CORE', 'ARB', 0.25, '#7c3aed']];
  const val = (bot, c, wt, y) => inWin(T[c][bot]).filter((t) => new Date(t.x * 1e3).getUTCFullYear() === y).reduce((s, t) => s + t.R * wt, 0);
  const V = series.map(([, bot, c, wt]) => yrs.map((y) => val(bot, c, wt, y))), all = V.flat(), mx = Math.ceil(Math.max(...all) / 2) * 2, mn = Math.floor(Math.min(0, ...all) / 2) * 2;
  const w = 760, h = 200, l = 40, r = 10, t = 10, b = 26, gw = (w - l - r) / yrs.length, bw = gw / 5;
  const Y = (v) => t + (1 - (v - mn) / (mx - mn)) * (h - t - b);
  let g = ''; for (let v = mn; v <= mx; v += 2) if (v % 4 === 0) g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? '#94a3b8' : '#e2e8f0'}"/><text class="ax" x="${l - 6}" y="${Y(v) + 3}" text-anchor="end">${v}R</text>`;
  yrs.forEach((y, i) => {
    g += `<text class="ax" x="${l + gw * i + gw / 2}" y="${h - 8}" text-anchor="middle">${y === 2023 ? '2023 (from Jun)' : y === 2026 ? '2026 (to Nov 11)' : y}</text>`;
    series.forEach(([, , , , col], k) => { const v = V[k][i], x = l + gw * i + bw * (k + 1), y0 = Y(Math.max(0, v)), hh = Math.abs(Y(v) - Y(0)); g += `<rect x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${Math.max(0.5, hh).toFixed(1)}" fill="${col}" rx="2"/><text class="tiny" x="${(x + (bw - 4) / 2).toFixed(1)}" y="${(v >= 0 ? y0 - 3 : y0 + hh + 10).toFixed(1)}" text-anchor="middle">${f(v)}</text>`; });
  });
  const legend = series.map(([nm, , , , col]) => `<span><span class="sw" style="background:${col}"></span>${nm}</span>`).join('');
  return `<div class="legend">${legend}</div><svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="What each new coin added to the account each year">${g}</svg>`;
}
// month grid with year totals and a Total row
function grid(mvByKey, years, full = 12, label = 'Year R') {
  const rows = years.map((y) => { const cells = MN.map((_, i) => { const k = `${y}-${String(i + 1).padStart(2, '0')}`; return mvByKey[k] === undefined ? null : mvByKey[k]; }); return { y, cells, tot: cells.filter((v) => v != null).reduce((a, b) => a + b, 0), pos: cells.filter((v) => v != null && v > 1e-9).length, nm: cells.filter((v) => v != null).length }; });
  const colT = MN.map((_, i) => { const v = rows.map((r) => r.cells[i]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; });
  const all = rows.reduce((s, r) => s + r.tot, 0), pos = rows.reduce((s, r) => s + r.pos, 0), nm = rows.reduce((s, r) => s + r.nm, 0);
  return `<table class="score heat" style="table-layout:fixed"><tr><th style="width:46px;text-align:left">Year</th>${MN.map((m) => `<th>${m}</th>`).join('')}<th style="width:52px">${label}</th><th style="width:40px">+ mo</th></tr>
${rows.map((r) => `<tr><td>${r.y}</td>${r.cells.map((v) => v == null ? '<td style="background:#fff;color:#cbd5e1">·</td>' : `<td style="background:${heat(v, full)};color:${ink(v, full)}">${Math.abs(v) < 0.05 ? '0' : f(v)}</td>`).join('')}<td class="${cls(r.tot)}"><b>${f(r.tot)}</b></td><td>${r.pos}/${r.nm}</td></tr>`).join('')}
<tr class="tot"><td>Total</td>${colT.map((v) => v == null ? '<td></td>' : `<td class="${cls(v)}">${f(v)}</td>`).join('')}<td class="${cls(all)}"><b>${f(all)}</b></td><td>${pos}/${nm}</td></tr></table>`;
}
const byKey = (tr, from) => { const keys = monthKeys(from, END), mv = monthly(tr, keys); return Object.fromEntries(keys.map((k, i) => [k, mv[i]])); };

// ---- page 1: the change and the answer
const lift = sSel.total - sCur.total;
const p1 = `<section class="page">
  <div class="cover-band">
    <div class="tag">Coin change · live bots · decided ${DATE}</div>
    <h1>${TITLE}</h1>
    <p class="sub">ARB is added to BB-CORE, and SUI and ARB are added to T-CORE. I-CORE keeps its coins. Same rules, same risk per trade. This report shows why these three additions were picked, what each coin did year by year and month by month, what the account gains, and the risks to watch.</p>
    <div class="vs">
      <div class="team"><div class="nm" style="color:#fdba74">Before</div><div class="bots">SOL · NEAR · ADA · GALA</div><div class="split">BB-CORE and I-CORE: these 4 coins<br>T-CORE: these 4 + ETH</div></div>
      <div class="x">→</div>
      <div class="team"><div class="nm" style="color:#5eead4">After (live)</div><div class="bots">BB-CORE + ARB · T-CORE + SUI + ARB</div><div class="split">I-CORE: unchanged<br>same rules, same 2.5% risk per trade</div></div>
    </div>
  </div>
  <h2>The answer: more profit for the same risk</h2>
  <p>On the TRI-CORE account (BB-CORE 50%, I-CORE 25%, T-CORE 25%), from June 2023 to November 2026, the three additions raise the result from <b>${f(sCur.total)}R to ${f(sSel.total)}R</b> (${f(lift)}R) while the worst drop stays the same (<b>${sCur.dd.toFixed(1)}R → ${sSel.dd.toFixed(1)}R</b>). Of all the coin sets tested, this one has the best profit per unit of drawdown. The added coins did better than the old line-up in ${posM(mvDiff)} of 42 months.</p>
  <div class="cmps">
    ${card('Account result', `${f(sSel.total, 0)}R`, `was ${f(sCur.total, 0)}R · ${f(lift)}R`)}
    ${card('Worst drop', `${sSel.dd.toFixed(1)}R`, `was ${sCur.dd.toFixed(1)}R · no deeper`)}
    ${card('Profit ÷ worst drop', (sSel.total / sSel.dd).toFixed(2), `was ${(sCur.total / sCur.dd).toFixed(2)}`)}
    ${card('Winning months', `${posM(mvSel)} / 42`, `was ${posM(mvCur)} / 42`)}
    ${card('Months the change helped', `${posM(mvDiff)} / 42`, 'new line-up beat the old one')}
    ${card('Share of profit from new coins', pc(lift / sSel.total), 'the old coins still carry the account')}
  </div>
  <h3>TRI-CORE account, cumulative R by month (Jun 2023 → Nov 2026)</h3>
  <div class="legend"><span><span class="sw" style="background:${NC}"></span>With SUI and ARB (new)</span><span><span class="sw" style="background:${CC}"></span>Current coins</span></div>
  ${curveSvg()}
  <p class="sub">R = one unit of risk per trade (each bot risks 2.5% of its balance per trade). Fees, slippage and real funding included. The window starts on Jun 10, 2023, when SUI has enough history for the bots' indicators.</p>
  ${foot()}
</section>`;

// ---- page 2: every option tested
const optRow = (o) => {
  const base = options.find((x) => x.bot === o.bot && !x.extra.length), dR = o.total - base.total, dD = o.dd - base.dd;
  const set = o.extra.length ? `+ ${o.extra.join(' + ')}` : 'current coins';
  let tag, why;
  if (o.bot === 'I-CORE') { tag = o.extra.length ? '<span class="pill no">rejected</span>' : '<span class="pill keep">kept</span>'; why = o.extra.length ? `worse: profit ÷ drop falls to ${o.rdd.toFixed(2)}` : 'both coins make I-CORE worse'; }
  else if (o.chosen) { tag = '<span class="pill go">chosen</span>'; why = `${f(dR, 0)}R for ${f(dD)}R more drop`; }
  else if (!o.extra.length) { tag = '<span class="pill keep">before</span>'; why = 'the line-up until now'; }
  else { tag = '<span class="pill no">not chosen</span>'; why = dD > 3 ? `drop ${f(dD)}R deeper` : o.rdd < (options.find((x) => x.bot === o.bot && x.chosen) || base).rdd ? 'lower profit ÷ drop than the pick' : ''; }
  const maxRdd = Math.max(...options.map((x) => x.rdd));
  return `<tr class="${o.chosen && o.bot !== 'I-CORE' ? 'pick' : ''}"><td class="nw">${o.bot}</td><td class="nw" style="text-align:left">${set}</td><td>${f(o.total, 0)}</td><td class="${cls(dR)}">${o.extra.length ? f(dR, 0) : '·'}</td><td>${o.dd.toFixed(1)}</td><td class="${dD > 0.05 ? 'neg' : dD < -0.05 ? 'pos' : 'flat'}">${o.extra.length ? f(dD) : '·'}</td><td class="nw" style="text-align:left"><span class="bar ${o.chosen ? '' : 'grey'}" style="width:${(o.rdd / maxRdd * 48).toFixed(0)}px"></span>${o.rdd.toFixed(2)}</td><td>${o.pos}/42</td><td style="text-align:left">${tag} <span style="color:#64748b;font-size:10px">${why}</span></td></tr>`;
};
const p2 = `<section class="page">
  <h2>Every option tested, bot by bot</h2>
  <p class="sub">Each bot on its current coins, then with ARB, with SUI, and with both. Same rules and same risk per trade for every coin. Jun 10, 2023 → Nov 11, 2026 (42 months). Drop = worst fall from a peak, trade by trade.</p>
  <div class="wrap"><table class="score"><tr><th>Bot</th><th style="text-align:left">Coins</th><th>Total R</th><th>vs now</th><th>Worst drop R</th><th>vs now</th><th style="text-align:left">Profit ÷ drop</th><th>+ months</th><th style="text-align:left">Decision</th></tr>
  ${options.map(optRow).join('')}</table></div>
  <div class="two" style="margin-top:12px">
    <div class="note good"><b>BB-CORE + ARB.</b> ARB adds ${f(options.find((o) => o.bot === 'BB-CORE' && o.chosen).total - options.find((o) => o.bot === 'BB-CORE' && !o.extra.length).total, 0)}R and deepens the worst drop by only ${(options.find((o) => o.bot === 'BB-CORE' && o.chosen).dd - options.find((o) => o.bot === 'BB-CORE' && !o.extra.length).dd).toFixed(1)}R. SUI would add more profit on BB-CORE, but it also adds about 7R of drop, because its bad months fall at the same time as the current coins'.</div>
    <div class="note good"><b>T-CORE + SUI + ARB.</b> The pair gives T-CORE its best profit ÷ drop of all sets (${options.find((o) => o.bot === 'T-CORE' && o.chosen).rdd.toFixed(2)}). ARB alone would deepen the drop to ${options.find((o) => o.bot === 'T-CORE' && o.extra.join() === 'ARB').dd.toFixed(1)}R; with SUI next to it the drop stays at ${options.find((o) => o.bot === 'T-CORE' && o.chosen).dd.toFixed(1)}R. So the two go on together, or not at all.</div>
  </div>
  <div class="note"><b>I-CORE stays as it is.</b> Every addition lowers its profit ÷ drop (from ${options.find((o) => o.bot === 'I-CORE' && !o.extra.length).rdd.toFixed(2)} to between ${Math.min(...options.filter((o) => o.bot === 'I-CORE' && o.extra.length).map((o) => o.rdd)).toFixed(2)} and ${Math.max(...options.filter((o) => o.bot === 'I-CORE' && o.extra.length).map((o) => o.rdd)).toFixed(2)}), and ARB lost money on I-CORE in 2026.</div>
  ${foot()}
</section>`;

// ---- page 3: each new coin, year by year
const yearTable = (r) => {
  const ys = Object.keys(r.yr).sort();
  return `<h3>${r.c} on ${r.b}</h3><table class="score"><tr><th>Year</th><th>Trades</th><th>Win rate</th><th>Profit factor</th><th>R per trade</th><th>Total R</th><th>Worst drop R</th><th>Losing streak</th></tr>
  ${ys.map((y) => { const s = r.yr[y]; return `<tr><td>${y}${y === '2026' ? ' (to Nov 11)' : ''}</td><td>${s.n}</td><td>${pc(s.win)}</td><td>${s.pf.toFixed(2)}</td><td class="${cls(s.exp)}">${f(s.exp, 2)}</td><td class="${cls(s.total)}"><b>${f(s.total)}</b></td><td>${s.dd.toFixed(1)}</td><td>${s.streak}</td></tr>`; }).join('')}
  <tr class="tot"><td>Total</td><td>${r.n}</td><td>${pc(r.win)}</td><td>${r.pf.toFixed(2)}</td><td class="${cls(r.exp)}">${f(r.exp, 2)}</td><td class="${cls(r.total)}">${f(r.total)}</td><td>${r.dd.toFixed(1)}</td><td>${r.streak}</td></tr></table>`;
};
const p3 = `<section class="page">
  <h2>Each new coin, year by year</h2>
  <p class="sub">From each coin's start on Binance (ARB Mar 2023, SUI May 2023, plus about 34 days for the indicators to warm up) to Nov 11, 2026. 1R per trade on the coin alone.</p>
  ${coinRows.map(yearTable).join('')}
  <h3>What each addition added to the account, by year</h3>
  ${contribSvg()}
  <p class="sub">Account R = the coin's R × the bot's share of the account (BB-CORE 0.5, T-CORE 0.25). Together: ${f(Object.values(contrib).reduce((a, b) => a + b, 0))}R since Jun 2023.</p>
  ${foot()}
</section>`;

// ---- page 4: every month of the three additions
const p4 = `<section class="page">
  <h2>Every month, each new coin</h2>
  <p class="sub">R closed in each month, coin alone, 1R per trade. Green = profit, red = loss, the darker the bigger (full colour at 12R). 0 = no trade closed. Nov 2026 runs to Nov 11. The last column counts winning months.</p>
  ${NEW.map(([c, b]) => { const tr = T[c][b], from = Math.min(...tr.map((t) => t.x)); return `<h3>${c} on ${b}</h3><div class="wrap">${grid(byKey(tr, from), [2023, 2024, 2025, 2026])}</div>`; }).join('')}
  ${foot()}
</section>`;

// ---- page 5: what the account gains each month
const diffKey = Object.fromEntries(KEYS.map((k, i) => [k, mvDiff[i]]));
const worstDiff = Math.min(...mvDiff), bestDiff = Math.max(...mvDiff);
const p5 = `<section class="page">
  <h2>What the account gains, month by month</h2>
  <p class="sub">TRI-CORE account with SUI and ARB minus the account with the current coins, in account R. Green = the new line-up did better that month. Full colour at 4R.</p>
  <div class="wrap">${grid(diffKey, [2023, 2024, 2025, 2026], 4, 'Year gain')}</div>
  <ul class="tight">
    <li>The change helped in <b>${posM(mvDiff)} of 42 months</b>. The biggest monthly gain was ${f(bestDiff)}R and the biggest monthly cost ${f(worstDiff)}R, so no single month hurts much.</li>
    <li>The first months (2023) cost ${f(KEYS.map((k, i) => k.startsWith('2023') ? mvDiff[i] : 0).reduce((a, b) => a + b, 0))}R: both coins were new and ARB lost money in its first year. Since 2024 the gain grows every year.</li>
    <li>Most of the gain is recent: 2026 alone gave ${f(KEYS.map((k, i) => k.startsWith('2026') ? mvDiff[i] : 0).reduce((a, b) => a + b, 0))}R of the ${f(lift)}R.</li>
  </ul>
  <h3>The account month by month, with SUI and ARB</h3>
  <div class="wrap">${grid(Object.fromEntries(KEYS.map((k, i) => [k, mvSel[i]])), [2023, 2024, 2025, 2026], 30)}</div>
  ${foot()}
</section>`;

// ---- page 6: risks, what to watch, how it goes live
const watchRow = (r) => `<tr><td class="nw" style="text-align:left">${r.c} on ${r.b}</td><td>${r.perMonth.toFixed(1)}</td><td>${pc(r.win)}</td><td>${f(r.exp, 2)}</td><td>${r.dd.toFixed(1)}R</td><td>${r.streak}</td><td>${pc(r.bestShare)}</td><td style="text-align:left">review if its own drop passes ${Math.ceil(r.dd * 1.25)}R</td></tr>`;
const p6 = `<section class="page">
  <h2>The risks, and what to watch</h2>
  <div class="note warn"><b>Picked after seeing the results.</b> The three additions were chosen from the same 42 months they are scored on. Expect less than the backtest shows. The coins go live without a paper period, on the owner's decision of ${DATE}.</div>
  <div class="note warn"><b>A few big months carry the profit.</b> 60% of SUI's T-CORE profit came in one month (Feb 2024), about half of ARB's T-CORE profit in one month (Oct 2026), and 72% of ARB's BB-CORE profit came in 2026. ARB lost money on BB-CORE in both 2023 and 2024.</div>
  <div class="note"><b>The coins move together.</b> SUI, ARB and the current coins are all altcoins and can fall at the same time. The account's worst drop did not get deeper in the test, but a market-wide sell-off hits every coin at once.</div>
  <h3>What normal looks like (backtest, each coin alone)</h3>
  <div class="wrap"><table class="score"><tr><th style="text-align:left">Coin on bot</th><th>Trades a month</th><th>Win rate</th><th>R per trade</th><th>Worst drop</th><th>Losing streak</th><th>Best month's share</th><th style="text-align:left">Look again</th></tr>
  ${coinRows.map(watchRow).join('')}</table></div>
  <p class="sub">With about 2 trades a month per coin on T-CORE and 4 on BB-CORE, the live results say little before 6 months. Judge on the drop and the losing streak first, then on the total. A drop 25% past the backtest's worst is the signal to look again (switch the coin off in the bot's settings; the bot then only finishes the trades it has open).</p>
  <h3>How it goes live</h3>
  <div class="steps">
    <div class="step"><div class="n">1</div><b>Dashboard database</b><p>Allow SUI and ARB in the bot event log (one prepared SQL change). Without it the dashboard rejects the new coins' trades.</p></div>
    <div class="step"><div class="n">2</div><b>BB-CORE</b><p>Update the bot on the VPS, then switch ARB on in its settings. 1 MEXC contract = 1 ARB (about $0.15), so sizing is fine-grained.</p></div>
    <div class="step"><div class="n">3</div><b>T-CORE</b><p>Install the new live build (coins SOL, NEAR, ADA, GALA, ETH, SUI, ARB). 1 contract = 1 SUI (about $0.81). Open trades and the account are kept.</p></div>
  </div>
  <div class="note">Backtest on Binance 4h prices with real fees, slippage and funding; MEXC volume on Nov 12, 2026: SUI about $37M a day, ARB about $15M a day (GALA, already traded, about $1M). Scripts: StrategyBacktester/research/coin-walkforward (sui-arb.js, monthly.js, sui-arb-live-report.js). Monthly tables: MONTHLY.md.</div>
  ${foot()}
</section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="robots" content="noindex, nofollow, noarchive">
<title>${TITLE} · Lucid'io</title>
<style>${CSS}
${EXTRA}</style></head><body>
${p1}
${p2}
${p3}
${p4}
${p5}
${p6}
</body></html>`;
fs.writeFileSync(path.join(LEDGER, `${SLUG}.html`), html);
const idxPath = path.join(LEDGER, 'index.json'), idx = JSON.parse(fs.readFileSync(idxPath, 'utf8')).filter((r) => r.slug !== SLUG);
idx.unshift({ slug: SLUG, title: TITLE, kind: 'Decision report', updated: DATE, file: `/reports/${SLUG}.html`,
  summary: `Nov 12, 2026: ARB joins BB-CORE, SUI and ARB join T-CORE, I-CORE keeps its coins (live). On the TRI-CORE account from Jun 2023 to Nov 2026 the change lifts the result from ${f(sCur.total, 0)}R to ${f(sSel.total, 0)}R with the same worst drop (${sCur.dd.toFixed(1)}R → ${sSel.dd.toFixed(1)}R) and helped in ${posM(mvDiff)} of 42 months. Every option per bot, each new coin by year and month, what the account gains each month, the risks (picked after seeing the results; a few big months carry the profit) and what to watch. A test on past prices, not a promise.` });
fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2) + '\n');
console.log('wrote', path.join(LEDGER, `${SLUG}.html`), (html.length / 1024).toFixed(0) + ' KB · account', sCur.total.toFixed(1), '->', sSel.total.toFixed(1), 'dd', sCur.dd.toFixed(1), '->', sSel.dd.toFixed(1), '· better months', posM(mvDiff), '· contrib', JSON.stringify(contrib));
