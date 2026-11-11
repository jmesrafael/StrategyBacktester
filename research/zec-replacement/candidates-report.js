// candidates-report.js — XRP, BNB, ONE and DOT as a 5th/6th coin, bot by bot: each coin alone (every year 2020-2026), the owner's stability rule
// (stability.js), and what the coin does to each bot's CURRENT lineup (profit added vs risk added). Writes the ledger report + index entry.
//   node candidates-report.js  -> ../../../🔴LEDGER/reports/coin-candidates.html, index.json entry, candidates.json
// Lineups (live, Nov 12 2026): BB-CORE and I-CORE = SOL, NEAR, ADA, GALA; T-CORE = SOL, NEAR, ADA, GALA, ETH. Engine = the bots' own rules (parity.js).
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..', 'strat-hunt-nov6');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const LEDGER = path.join(__dirname, '..', '..', '..', '🔴LEDGER', 'reports');
const CSS = fs.readFileSync(path.join(LEDGER, 'live-pair-vs-three-bot.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'];
const LINEUP = { 'BB-CORE': KEEP, 'I-CORE': KEEP, 'T-CORE': [...KEEP, 'ETH'] };
const CANDS = ['XRP', 'BNB', 'ONE', 'DOT'];
const MEXC = { XRP: 326.8e6, BNB: 6.2e6, ONE: 7.7e6, DOT: 7.8e6 }, PRICE = { XRP: null, BNB: 685.73, ONE: 0.00158, DOT: 0.8517 };
const Y0 = Date.UTC(2020, 0, 1) / 1000, P0 = Date.UTC(2021, 0, 1) / 1000, END = Date.UTC(2026, 10, 1) / 1000, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const DATE = 'Nov 12, 2026', TITLE = 'XRP, BNB, ONE and DOT: where they fit';

// ---- data + trades
const load = (c) => { const f10 = path.join(__dirname, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(__dirname, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })); const fp = path.join(__dirname, 'funding', c + '.json');
  return { B, F: fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null }; };
const by = (id) => S.find((s) => s.id === id), TR = {};
for (const c of [...KEEP, 'ETH', ...CANDS]) { const { B, F } = load(c), x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  TR[c] = Object.fromEntries(Object.entries(BOTS).map(([b, p]) => [b, run(B, x.atr14, built[p], exitOf(p, x), F && F.length ? F : null, 14400, COST).trades.map((t) => ({ x: t.tExit, R: t.R }))])); }

// ---- measures
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const corr = (x, y) => { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return a / Math.sqrt(b * c); };
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const mkeys = (from) => { const k = []; for (let d = new Date(from * 1000); d.getTime() / 1000 < END; d.setUTCMonth(d.getUTCMonth() + 1)) k.push(d.toISOString().slice(0, 7)); return k; };
const monthly = (tr, keys) => { const m = Object.fromEntries(keys.map((k) => [k, 0])); for (const t of tr) { const k = new Date(t.x * 1000).toISOString().slice(0, 7); if (k in m) m[k] += t.R; } return keys.map((k) => m[k]); };
function measure(tr, from) {
  tr = tr.filter((t) => t.x > from && t.x <= END).sort((a, b) => a.x - b.x);
  const keys = mkeys(from), mv = monthly(tr, keys), R = tr.map((t) => t.R), w = R.filter((r) => r > 0), l = R.filter((r) => r <= 0);
  let e = 0, p = 0, dd = 0; for (const r of R) { e += r; p = Math.max(p, e); dd = Math.max(dd, p - e); }
  let me = 0, mp = 0, mdd = 0; for (const v of mv) { me += v; mp = Math.max(mp, me); mdd = Math.max(mdd, mp - me); }
  let neg = 0, n12 = 0, w12 = Infinity; for (let i = 0; i + 12 <= mv.length; i++) { const s = mv.slice(i, i + 12).reduce((a, b) => a + b, 0); n12++; if (s < 0) neg++; w12 = Math.min(w12, s); }
  let run = 0, mr = 0; for (const v of mv) { if (v < 0) { run++; mr = Math.max(mr, run); } else run = 0; }
  const yrs = {}; for (const t of tr) { const y = new Date(t.x * 1000).getUTCFullYear(); yrs[y] = (yrs[y] || 0) + t.R; }
  const yv = Object.entries(yrs).sort();
  const dds = []; for (let k = 0; k < 3000; k++) { const s = [...R]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } let e2 = 0, p2 = 0, d2 = 0; for (const r of s) { e2 += r; p2 = Math.max(p2, e2); d2 = Math.max(d2, p2 - e2); } dds.push(d2); }
  return { n: R.length, total: e, perYear: e / ((END - from) / (365.25 * 86400)), mv, losingM: mv.filter((v) => v < 0).length / mv.length, losingRun: mr, dd, mdd, neg12: neg / n12, w12,
    win: w.length / R.length, payoff: mean(w) / -mean(l), pf: w.reduce((a, b) => a + b, 0) / -l.reduce((a, b) => a + b, 0), exp: e / R.length,
    years: Object.fromEntries(yv), yearsWon: yv.filter(([, v]) => v > 0).length, yearsN: yv.length, worstYear: Math.min(...yv.map(([, v]) => v)),
    sharpe: (mean(mv) / sd(mv)) * Math.sqrt(12), mcDD95: pct(dds, 0.95) };
}

// ---- per bot: the rule bar, each candidate alone, and the lineup with / without it
const out = {};
for (const bot of Object.keys(BOTS)) {
  const K = Object.fromEntries(KEEP.map((k) => [k, measure(TR[k][bot], Y0)]));
  const bar = { losingM: median(KEEP.map((k) => K[k].losingM)), dd: median(KEEP.map((k) => K[k].dd)), neg12: median(KEEP.map((k) => K[k].neg12)), payoff: median(KEEP.map((k) => K[k].payoff)), worstYear: median(KEEP.map((k) => K[k].worstYear)) };
  const lineTr = LINEUP[bot].flatMap((c) => TR[c][bot]), base = measure(lineTr, P0), keys = mkeys(P0);
  const lineMv = monthly(lineTr.filter((t) => t.x > P0), keys);
  const rows = {};
  for (const c of CANDS) {
    const alone = measure(TR[c][bot], Y0), withC = measure([...lineTr, ...TR[c][bot]], P0), cMv = monthly(TR[c][bot].filter((t) => t.x > P0), keys);
    const tests = { years: alone.yearsN >= 7 && alone.yearsWon >= 6, losing: alone.losingM <= bar.losingM + 1e-9, dd: alone.dd <= bar.dd + 1e-9, bad12: alone.neg12 <= bar.neg12 + 1e-9, payoff: alone.payoff >= bar.payoff - 1e-9, worst: alone.worstYear >= bar.worstYear - 1e-9 };
    const dTotal = withC.total - base.total, dDD = withC.dd - base.dd, dMDD = withC.mdd - base.mdd;
    const better = (withC.total / withC.dd >= base.total / base.dd) && withC.losingM <= base.losingM + 0.005 && withC.sharpe >= base.sharpe - 0.01;
    const worse = withC.total / withC.dd < base.total / base.dd - 0.5 && withC.sharpe < base.sharpe;
    const verdict = better ? 'improves' : worse ? 'worsens' : 'trade-off';
    rows[c] = { alone, tests, passes: Object.values(tests).every(Boolean), failed: Object.entries(tests).filter(([, v]) => !v).map(([k]) => k), withC, dTotal, dDD, dMDD, corr: corr(cMv, lineMv), perRisk: dDD > 0.05 ? dTotal / dDD : null, verdict };
  }
  out[bot] = { bar, keepers: K, base, rows };
}
fs.writeFileSync(path.join(__dirname, 'candidates.json'), JSON.stringify(out, (k, v) => (k === 'mv' ? undefined : v), 1));

// ================= HTML =================
const f = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d), n = (v, d = 1) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d), pc = (v) => (v * 100).toFixed(0) + '%';
const cls = (v) => (v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'flat');
let page = 0; const foot = () => `<div class="foot"><span>Lucid'io · Coin candidates · ${DATE}</span><span>A test on past prices, not a promise · page ${++page}</span></div>`;
const VC = { improves: '#0f766e', 'trade-off': '#b45309', worsens: '#dc2626' }, VL = { improves: 'Improves', 'trade-off': 'Trade-off', worsens: 'Worsens' };
const badge = (v) => `<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:700;color:#fff;background:${VC[v]}">${VL[v]}</span>`;
const TESTN = { years: '6–7 of 7 years won', losing: 'losing months', dd: 'drawdown', bad12: 'bad 12-month windows', payoff: 'wins big vs losses', worst: 'worst year' };
const botNames = Object.keys(BOTS);

// page 1: the matrix
const matrix = `<table class="score"><tr><th>Coin</th>${botNames.map((b) => `<th style="text-align:center">${b}<br><span style="font-weight:400;text-transform:none">${LINEUP[b].length} coins today</span></th>`).join('')}</tr>${CANDS.map((c) => `<tr><td><b>${c}</b></td>${botNames.map((b) => { const r = out[b].rows[c]; return `<td style="text-align:center">${badge(r.verdict)}<br><span class="${cls(r.dTotal)}">${f(r.dTotal, 0)}R profit</span> · <span class="${r.dDD > 0.05 ? 'neg' : 'pos'}">${f(r.dDD)}R drop</span><br><span style="color:#64748b">losing months ${pc(out[b].base.losingM)} → ${pc(r.withC.losingM)} · rule ${r.passes ? '<b style="color:#0f766e">passes</b>' : `fails ${r.failed.length}/6`}</span></td>`; }).join('')}</tr>`).join('')}</table>`;
const verdictLines = CANDS.map((c) => { const best = botNames.map((b) => [b, out[b].rows[c]]).sort((a, b) => (b[1].withC.total / b[1].withC.dd) - (a[1].withC.total / a[1].withC.dd))[0];
  const imp = botNames.filter((b) => out[b].rows[c].verdict === 'improves');
  return `<li><b>${c}:</b> ${imp.length ? `improves ${imp.join(' and ')}` : 'improves no bot outright'}; best fit ${best[0]} (${f(best[1].dTotal, 0)}R profit for ${f(best[1].dDD)}R deeper worst drop). ${c === 'ONE' ? 'Caution: price $0.0016, a 2022 bridge hack and thin MEXC volume: ONE is itself a delisting risk.' : c === 'DOT' ? 'Caution: moves with the other alts (highest correlation), and its price has been falling for years.' : c === 'BNB' ? 'Exchange coin with deep history; MEXC volume is modest ($6M a day) but fine at bot size.' : 'Very liquid; its best years are 2020–21 and 2024.'}</li>`; }).join('');
const p1 = `<section class="page">
  <div class="cover-band">
    <div class="tag">Coin review · BB-CORE · I-CORE · T-CORE · 2020 → Nov 2026</div>
    <h1>${TITLE}</h1>
    <p class="sub">Four coins came out of the replacement studies: XRP, BNB, ONE and DOT. This report tests each one on each bot, with the bot's own rules and real costs, against the owner's rule (6–7 winning years, few losing months, low drawdowns, small losses and big wins: stability over luck), and shows what each does to the lineup the bot trades today: how much profit it adds and how much risk it adds.</p>
  </div>
  <h2>The answer at a glance</h2>
  <p class="sub">Lineup effect, Jan 2021 → Oct 2026: profit added and the change in the worst drop (trade by trade), and the share of losing months before → after. <b>Improves</b> = better return per unit of drawdown, no more losing months, Sharpe not lower. <b>Worsens</b> = clearly lower on both. Otherwise a <b>trade-off</b>: more profit for more risk.</p>
  <div class="wrap">${matrix}</div>
  <h3>In one line each</h3>
  <ul class="tight">${verdictLines}</ul>
  <div class="note">Today's lineups: BB-CORE and I-CORE trade SOL, NEAR, ADA, GALA; T-CORE trades SOL, NEAR, ADA, GALA, ETH. Nothing in this report has been switched on.</div>
  ${foot()}
</section>`;

// risk vs profit scatter
function scatter() {
  const pts = []; for (const b of botNames) for (const c of CANDS) { const r = out[b].rows[c]; pts.push({ b, c, x: r.dDD, y: r.dTotal, v: r.verdict }); }
  const w = 760, h = 330, l = 56, r = 20, t = 16, bt = 40, xmax = Math.ceil(Math.max(...pts.map((p) => p.x), 1) / 5) * 5, xmin = Math.min(0, Math.floor(Math.min(...pts.map((p) => p.x)))), ymax = Math.ceil(Math.max(...pts.map((p) => p.y)) / 50) * 50, ymin = Math.min(0, Math.floor(Math.min(...pts.map((p) => p.y)) / 50) * 50);
  const X = (v) => l + ((v - xmin) / (xmax - xmin)) * (w - l - r), Y = (v) => t + (1 - (v - ymin) / (ymax - ymin)) * (h - t - bt);
  let g = ''; for (let v = ymin; v <= ymax; v += 50) g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e2e8f0"/><text class="ax" x="${l - 6}" y="${Y(v) + 3}" text-anchor="end">${f(v, 0)}R</text>`;
  for (let v = xmin; v <= xmax; v += 5) g += `<line x1="${X(v)}" x2="${X(v)}" y1="${t}" y2="${h - bt}" stroke="#f1f5f9"/><text class="ax" x="${X(v)}" y="${h - bt + 14}" text-anchor="middle">${f(v, 0)}R</text>`;
  g += `<line x1="${X(0)}" x2="${X(0)}" y1="${t}" y2="${h - bt}" stroke="#94a3b8"/><text class="ax b" x="${(l + w - r) / 2}" y="${h - 6}" text-anchor="middle">change in the bot's worst drop (left = safer)</text><text class="ax b" transform="translate(12 ${(t + h - bt) / 2}) rotate(-90)" text-anchor="middle">profit added</text>`;
  const SH = { 'BB-CORE': 'BB', 'I-CORE': 'IC', 'T-CORE': 'TC' };
  for (const p of pts) g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="6" fill="${VC[p.v]}" opacity=".85"/><text class="tiny" x="${X(p.x) + 8}" y="${Y(p.y) + 3}">${p.c} · ${SH[p.b]}</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Profit added against the change in worst drop, per coin and bot">${g}</svg>`;
}
const p2 = `<section class="page">
  <h2>Risk against profit</h2>
  <p class="sub">Every coin on every bot: how much profit it adds to today's lineup (up) against how much deeper it makes the worst drop (right). Top-left is the ideal: more profit, no extra risk. BB = BB-CORE, IC = I-CORE, TC = T-CORE. Colour = verdict.</p>
  ${scatter()}
  <div class="wrap"><table class="score"><tr><th>Coin · bot</th><th>Profit added</th><th>Worst drop (trade by trade)</th><th>Worst drop (month-end)</th><th>R gained per extra R of drop</th><th>Losing months</th><th>Worst 12 months</th><th>Sharpe</th><th>Monte Carlo drop (1 in 20)</th><th>Correlation with lineup</th></tr>
  ${botNames.map((b) => { const B0 = out[b].base; return `<tr class="tot"><td>${b} today</td><td>${f(B0.total, 0)}R total</td><td>${B0.dd.toFixed(1)}</td><td>${B0.mdd.toFixed(1)}</td><td>—</td><td>${pc(B0.losingM)}</td><td>${f(B0.w12)}</td><td>${B0.sharpe.toFixed(2)}</td><td>${B0.mcDD95.toFixed(1)}</td><td>—</td></tr>` + CANDS.map((c) => { const r = out[b].rows[c], w = r.withC;
    return `<tr><td>+ ${c}</td><td class="${cls(r.dTotal)}">${f(r.dTotal, 0)}</td><td class="${r.dDD > 0.05 ? 'neg' : 'pos'}">${w.dd.toFixed(1)} (${f(r.dDD)})</td><td class="${r.dMDD > 0.05 ? 'neg' : 'pos'}">${w.mdd.toFixed(1)} (${f(r.dMDD)})</td><td>${r.perRisk == null ? 'no extra drop' : r.perRisk.toFixed(1)}</td><td class="${w.losingM < B0.losingM - 0.005 ? 'pos' : w.losingM > B0.losingM + 0.005 ? 'neg' : ''}">${pc(w.losingM)}</td><td>${f(w.w12)}</td><td class="${w.sharpe > B0.sharpe + 0.01 ? 'pos' : w.sharpe < B0.sharpe - 0.01 ? 'neg' : ''}">${w.sharpe.toFixed(2)}</td><td>${w.mcDD95.toFixed(1)}</td><td>${r.corr.toFixed(2)}</td></tr>`; }).join(''); }).join('')}</table></div>
  <p class="sub">"R gained per extra R of drop" divides the profit added by how much deeper the worst trade-by-trade drop gets. On BB-CORE every alt adds about the same extra drop (the alts fall together in the same crash), so this ratio, the losing months and the Sharpe are what separate them.</p>
  ${foot()}
</section>`;

// one page per coin
const coinPage = (c) => {
  const yr = botNames.map((b) => { const a = out[b].rows[c].alone; return `<tr><td>${b}</td>${YEARS.map((y) => { const v = a.years[y]; return v == null ? '<td class="na">–</td>' : `<td class="${cls(v)}">${f(v)}</td>`; }).join('')}<td><b>${a.yearsWon}/${a.yearsN}</b></td></tr>`; }).join('');
  const alone = botNames.map((b) => { const a = out[b].rows[c].alone, bar = out[b].bar, t = out[b].rows[c].tests;
    const cell = (ok, v) => `<td class="${ok ? 'pos' : 'neg'}">${v}${ok ? ' ✓' : ' ✗'}</td>`;
    return `<tr><td>${b}</td>${cell(t.losing, pc(a.losingM) + ' (bar ' + pc(bar.losingM) + ')')}${cell(t.dd, a.dd.toFixed(1) + ' (bar ' + bar.dd.toFixed(1) + ')')}${cell(t.bad12, pc(a.neg12) + ' (bar ' + pc(bar.neg12) + ')')}${cell(t.payoff, a.payoff.toFixed(2) + '× (bar ' + bar.payoff.toFixed(2) + '×)')}${cell(t.worst, f(a.worstYear) + ' (bar ' + f(bar.worstYear) + ')')}<td>${pc(a.win)} · PF ${a.pf.toFixed(2)} · ${f(a.exp, 2)}R</td></tr>`; }).join('');
  const fits = botNames.map((b) => { const r = out[b].rows[c], B0 = out[b].base, w = r.withC;
    const words = r.verdict === 'improves' ? `makes ${b} better: ${f(r.dTotal, 0)}R more profit, worst drop ${f(r.dDD)}R, losing months ${pc(B0.losingM)} → ${pc(w.losingM)}, Sharpe ${B0.sharpe.toFixed(2)} → ${w.sharpe.toFixed(2)}.`
      : r.verdict === 'worsens' ? `makes ${b} worse: ${f(r.dTotal, 0)}R profit for ${f(r.dDD)}R deeper worst drop; return per unit of drop and Sharpe both fall (${B0.sharpe.toFixed(2)} → ${w.sharpe.toFixed(2)}).`
      : `is a trade-off on ${b}: ${f(r.dTotal, 0)}R more profit for a ${f(r.dDD)}R deeper worst drop (${r.perRisk == null ? 'no extra drop' : r.perRisk.toFixed(1) + 'R of profit per extra R of drop'}); losing months ${pc(B0.losingM)} → ${pc(w.losingM)}, Sharpe ${B0.sharpe.toFixed(2)} → ${w.sharpe.toFixed(2)}.`;
    return `<li>${badge(r.verdict)} ${c} ${words} Owner's rule: ${r.passes ? '<b>passes</b>' : 'fails on ' + r.failed.map((k) => TESTN[k]).join(', ')}.</li>`; }).join('');
  return `<section class="page">
  <h2>${c}</h2>
  <p class="sub">MEXC futures volume about $${(MEXC[c] / 1e6).toFixed(1)}M a day${PRICE[c] ? ` · price $${PRICE[c]}` : ''}. Each bot's results on ${c} alone, 2020 → Nov 2026 (2026 to Nov 11).</p>
  <h3>Every year, R</h3>
  <div class="wrap"><table class="score"><tr><th>Bot</th>${YEARS.map((y) => `<th>${y}</th>`).join('')}<th>Years won</th></tr>${yr}</table></div>
  <h3>The owner's rule (bar = the typical kept coin on that bot)</h3>
  <div class="wrap"><table class="score"><tr><th>Bot</th><th>Losing months</th><th>Max drawdown (R)</th><th>Bad 12-month windows</th><th>Avg win ÷ avg loss</th><th>Worst year</th><th>Win rate · PF · R/trade</th></tr>${alone}</table></div>
  <h3>Where it fits</h3>
  <ul class="tight">${fits}</ul>
  ${foot()}
</section>`; };

// last page: verdict
const bestFor = botNames.map((b) => { const rs = CANDS.map((c) => [c, out[b].rows[c]]).sort((a, z) => (z[1].withC.total / z[1].withC.dd) - (a[1].withC.total / a[1].withC.dd)); return [b, rs]; });
const pv = `<section class="page">
  <h2>Verdict</h2>
  ${bestFor.map(([b, rs]) => { const B0 = out[b].base, imp = rs.filter(([, r]) => r.verdict === 'improves'), top = rs[0];
    return `<h3>${b} (today ${LINEUP[b].join(', ')}: ${f(B0.total, 0)}R, worst drop ${B0.dd.toFixed(1)}R, ${pc(B0.losingM)} losing months)</h3>
    <ul class="tight"><li>${imp.length ? `<b>${imp.map(([c]) => c).join(', ')} ${imp.length > 1 ? 'improve' : 'improves'} it outright.</b>` : '<b>No candidate improves it outright.</b>'} Best of the four by return per unit of drop: ${top[0]} (${(top[1].withC.total / top[1].withC.dd).toFixed(1)} vs ${(B0.total / B0.dd).toFixed(1)} today).</li>
    ${rs.map(([c, r]) => `<li>${c}: ${badge(r.verdict)} ${f(r.dTotal, 0)}R profit, ${f(r.dDD)}R worst drop, losing months ${pc(r.withC.losingM)}, rule ${r.passes ? 'passes' : 'fails ' + r.failed.length + '/6'}.</li>`).join('')}</ul>`; }).join('')}
  <div class="note"><b>Alone vs inside the bot.</b> The owner's rule judges a coin on its own; the lineup test judges it inside the bot, which is what the account lives through. They can disagree. BNB on I-CORE fails the rule alone (it loses in ${pc(out['I-CORE'].rows.BNB.alone.losingM)} of months) but lowers I-CORE's losing months from ${pc(out['I-CORE'].base.losingM)} to ${pc(out['I-CORE'].rows.BNB.withC.losingM)} for only ${f(out['I-CORE'].rows.BNB.dDD)}R of extra drop, because it moves on its own (correlation ${out['I-CORE'].rows.BNB.corr.toFixed(2)}): its bad months tend to land when the other coins win. For the account, the lineup result is the one that counts.</div>
  <div class="note good"><b>Stability over luck.</b> A coin that adds profit but also adds drawdown, losing months or a bad year is buying return with risk. The owner's rule asks for the opposite, so a coin should go live only when it is marked <b>Improves</b> (the lineup gets steadier, not just bigger); a <b>Trade-off</b> coin is a paper-test candidate first, and a <b>Worsens</b> coin stays out. ONE should not go live on any bot whatever its numbers: a $0.0016 coin with a bridge-hack history and thin volume could be delisted, the very problem that started this search.</div>
  <h3>Limits</h3>
  <ul class="tight"><li>Backtest on Binance candles with real fees, slippage and funding; the engine reproduces the bots' code trade for trade. In-sample: these four were chosen after screening ~120 markets, which flatters them.</li>
  <li>DOT starts trading in Aug 2020, so its 2020 is a part year. MEXC volume is a one-day snapshot (Nov 11–12, 2026).</li>
  <li>Scripts: StrategyBacktester/research/zec-replacement (candidates-report.js, stability.js, parity.js).</li></ul>
  ${foot()}
</section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="robots" content="noindex, nofollow, noarchive">
<title>Coin Candidates · Lucid'io</title>
<style>${CSS}</style></head><body>
${p1}
${p2}
${CANDS.map(coinPage).join('\n')}
${pv}
</body></html>`;
fs.writeFileSync(path.join(LEDGER, 'coin-candidates.html'), html);
const sum = botNames.map((b) => `${b}: ${CANDS.map((c) => `${c} ${out[b].rows[c].verdict}`).join(', ')}`).join('; ');
const idxPath = path.join(LEDGER, 'index.json'), idx = JSON.parse(fs.readFileSync(idxPath, 'utf8')).filter((r) => r.slug !== 'coin-candidates');
idx.unshift({ slug: 'coin-candidates', title: 'Coin Candidates: XRP, BNB, ONE, DOT', kind: 'Data report', updated: DATE, file: '/reports/coin-candidates.html',
  summary: `XRP, BNB, ONE and DOT tested on BB-CORE, I-CORE and T-CORE with the bots' own rules and real costs: every year 2020–2026, the owner's stability rule (6–7 winning years, few losing months, low drawdown, small losses and big wins), and what each coin does to today's lineup (profit added against risk added). ${sum}. Nothing was switched on. A test on past prices, not a promise.` });
fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2) + '\n');
console.log('wrote coin-candidates.html', (html.length / 1024).toFixed(0) + ' KB');
for (const b of botNames) { const B0 = out[b].base; console.log(`${b} today ${B0.total.toFixed(0)}R DD ${B0.dd.toFixed(1)} mDD ${B0.mdd.toFixed(1)} lose ${pc(B0.losingM)} sharpe ${B0.sharpe.toFixed(2)} mc95 ${B0.mcDD95.toFixed(1)}`);
  for (const c of CANDS) { const r = out[b].rows[c], w = r.withC; console.log(`   +${c.padEnd(4)} ${r.verdict.padEnd(9)} dTot ${f(r.dTotal, 0).padStart(5)} DD ${w.dd.toFixed(1)} (${f(r.dDD)}) mDD ${w.mdd.toFixed(1)} lose ${pc(w.losingM)} sharpe ${w.sharpe.toFixed(2)} mc95 ${w.mcDD95.toFixed(1)} corr ${r.corr.toFixed(2)} | alone yrs ${r.alone.yearsWon}/${r.alone.yearsN} lose ${pc(r.alone.losingM)} DD ${r.alone.dd.toFixed(1)} rule ${r.passes ? 'PASS' : 'fail ' + r.failed.join(',')}`); } }
