// cmp5y.js — ZIL vs GALA (and BTC) over the SAME window, alone and added to SOL+ZEC+NEAR+ADA. usage: node cmp5y.js
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('./lib.js');
const APP = path.resolve(__dirname, '../..'), COINS = ['SOL','ZEC','NEAR','ADA'], RISK = 5, START = 1000, TP = 4;
const FUND = Object.fromEntries(COINS.map((s) => [s, JSON.parse(fs.readFileSync(path.join(__dirname, 'datafund', s + '.json'), 'utf8'))]));
const REAL = { entryFee: 0.0005, stopFee: 0.0005, tpFee: 0.0002, timeFee: 0.0005, slip: 0.0002, tpSlip: 0, tpBuf: 0.0005, funding: true };
const APPCOST = { entryFee: 0.0004, stopFee: 0.0004, tpFee: 0.0004, timeFee: 0.0004, slip: 0.0002, tpSlip: 0.0002, tpBuf: 0, funding: false };
const out = []; const P = (...a) => out.push(...(a.length ? a : ['']));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const usd = (v) => (Math.abs(v) < 0.5 ? '$0' : (v < 0 ? '−$' : '+$') + Math.abs(v).toFixed(0));
const pct = (v) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(0) + '%');
const sp = (v) => (v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '+') + Math.abs(v * 100).toFixed(0) + '%');
const r2 = (v) => (v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2));
const pf = (v) => (v == null ? '—' : !isFinite(v) ? '∞' : v.toFixed(2));
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7), yr = (t) => +new Date(t * 1000).toISOString().slice(0, 4);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// ---------------- the bot ----------------
// opt.skip(f) -> true skips the signal (the slot stays free for the next one); opt.beR -> stop moves to entry once price has reached +beR
function bot(sym, cost, tpR = TP, opt = {}) {
  const B = L.bars(sym, 240), fd = FUND[sym], trades = [];
  const closes = [], trs = []; let atr = null, pos = null, pendEntry = null, pendClose = false;
  const smaHist = [], atrHist = [];
  for (let i = 0; i < B.length; i++) {
    const c = B[i];
    if (pendEntry) { const d = pendEntry.dir, fill = c.open * (1 + d * cost.slip), dist = Math.abs(fill - pendEntry.stop) / fill;
      if (dist > 0 && (d === 1 ? pendEntry.stop < fill : pendEntry.stop > fill)) pos = { ...pendEntry, entry: fill, i0: i, dist, mfe: 0, mae: 0 };
      pendEntry = null; }
    if (pendClose && pos) exit(c.open * (1 - pos.dir * cost.slip), i, cost.timeFee, 'time');
    pendClose = false;
    if (pos) {
      const d = pos.dir, risk = Math.abs(pos.entry - pos.stop);
      pos.mfe = Math.max(pos.mfe, d * ((d === 1 ? c.high : c.low) - pos.entry) / risk); pos.mae = Math.min(pos.mae, d * ((d === 1 ? c.low : c.high) - pos.entry) / risk);
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * cost.slip), i, cost.stopFee, 'stop');
      else if (d === 1 ? c.high >= pos.tp * (1 + cost.tpBuf) : c.low <= pos.tp * (1 - cost.tpBuf)) exit((d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open)) * (1 - d * cost.tpSlip), i, cost.tpFee, 'target');
      if (pos && opt.beR && pos.mfe >= opt.beR && (d === 1 ? pos.stop < pos.entry : pos.stop > pos.entry)) pos.stop = pos.entry; // from the next candle
    }
    // the candle has CLOSED: indicators get this candle and nothing later
    closes.push(c.close);
    trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
    if (i === 13) atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14; else if (i > 13) atr = (atr * 13 + trs[i]) / 14;
    const sma = i >= 199 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : null; smaHist.push(sma); atrHist.push(atr);
    if (pos) { if (i - pos.i0 >= 48) pendClose = true; continue; }
    if (i < 202 || i >= B.length - 1) continue;
    const w = closes.slice(-20), mid = w.reduce((a, b) => a + b, 0) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / 20);
    const up = mid + 2 * sd, lo = mid - 2 * sd;
    const dir = c.close > up ? 1 : c.close < lo ? -1 : 0;
    if (!dir || (dir === 1 ? c.close < sma : c.close > sma)) continue;
    const dist = Math.abs(c.close - mid); if (!(dist > 0) || dist < 0.3 * atr) continue;
    // features known at this close (for the regime analysis only — they never change the trade)
    let path60 = 0; for (let j = i - 59; j <= i; j++) path60 += Math.abs(closes[j] - closes[j - 1]);
    const er = Math.abs(closes[i] - closes[i - 60]) / path60;
    const atrp = atr / c.close; let below = 0, cnt = 0;
    for (let j = Math.max(14, i - 540); j < i; j++) { cnt++; if (atrHist[j] / closes[j] < atrp) below++; }
    const slope = smaHist[i - 30] ? dir * (sma - smaHist[i - 30]) / smaHist[i - 30] : null;
    const ext = dir * (c.close - sma) / atr;
    let crosses = 0; for (let j = i - 179; j <= i; j++) if (smaHist[j - 1] != null && (closes[j] > smaHist[j]) !== (closes[j - 1] > smaHist[j - 1])) crosses++;
    pendEntry = { dir, stop: mid, tp: c.close + dir * tpR * dist, f: { er, volRank: below / cnt, slope, ext, bandSd: (2 * sd) / c.close, crosses } };
    if (opt.skip && opt.skip(pendEntry.f)) pendEntry = null;
  }
  if (pos) exit(B[B.length - 1].close, B.length - 1, cost.timeFee, 'end');
  return trades;
  function exit(px, i, fee, why) {
    let fr = 0; if (cost.funding) { const te = B[pos.i0].time, tx = B[i].time + 7200; for (const [t, r] of fd) { if (t > tx) break; if (t > te) fr += r; } }
    const R = (pos.dir * (px - pos.entry) / pos.entry - cost.entryFee - fee - pos.dir * fr) / pos.dist;
    trades.push({ sym, dir: pos.dir, i0: pos.i0, i1: i, t: B[pos.i0].time, x: B[i].time + 14400, R, usd: R * RISK, why, bars: i - pos.i0 + 1,
      fundR: -pos.dir * fr / pos.dist, mfe: pos.mfe, mae: pos.mae, f: pos.f });
    pos = null;
  }
}

// ---------------- statistics over a list of trades (in exit order) ----------------
function st(tr, start = START) {
  const n = tr.length, w = tr.filter((t) => t.R > 0), l = tr.filter((t) => t.R <= 0);
  const gp = w.reduce((a, t) => a + t.usd, 0), gl = -l.reduce((a, t) => a + t.usd, 0);
  let eq = start, pk = start, dd = 0, ddPct = 0, streak = 0, maxStreak = 0, lossRun = 0, maxLossRun = 0;
  for (const t of tr) {
    eq += t.usd; if (eq > pk) pk = eq; if (pk - eq > dd) { dd = pk - eq; ddPct = dd / pk; }
    if (t.R <= 0) { streak++; lossRun += t.usd; if (streak > maxStreak) maxStreak = streak; } else { streak = 0; lossRun = 0; }
  }
  const net = gp - gl;
  return { n, w: w.length, l: l.length, wr: n ? w.length / n : null, net, pf: gl ? gp / gl : n ? Infinity : null, avgR: n ? net / RISK / n : null,
    avgW: w.length ? gp / w.length / RISK : null, avgL: l.length ? -gl / l.length / RISK : null, dd, ddPct, maxStreak, start, end: start + net,
    tp: tr.filter((t) => t.why === 'target').length, sl: tr.filter((t) => t.why === 'stop').length, tx: tr.filter((t) => t.why === 'time').length,
    long: tr.filter((t) => t.dir === 1), short: tr.filter((t) => t.dir === -1), best: n ? Math.max(...tr.map((t) => t.R)) : null, fund: tr.reduce((a, t) => a + t.fundR * RISK, 0) };
}
const X = (k) => ({ ...REAL, entryFee: REAL.entryFee * k, stopFee: REAL.stopFee * k, tpFee: REAL.tpFee * k, timeFee: REAL.timeFee * k, slip: REAL.slip * k });
// ===== four-coin report: SOL+ZEC+NEAR+ADA, 5% risk, P5,000 baseline, fresh-each-year vs compounding =====
const { execFileSync } = require('child_process');
const OUTDIR = 'C:/Users/WEB.WEB-DEVPC1/Desktop/testing/ledger/reports', CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe', SLUG = 'four-coin-5pct';
const BASE = 5000, RP = 0.05;
const TR = COINS.flatMap((c) => bot(c, REAL)).sort((a, b) => a.x - b.x);
const YRS = [...new Set(TR.map((t) => yr(t.x)))], lastX = TR[TR.length - 1].x;
const FIRST = {}; for (const c of COINS) FIRST[c] = iso(TR.find((t) => t.sym === c).t);

function runLedger(rp, mode) {
  let bal = BASE; const years = [], tr = [];
  for (const y of YRS) {
    const t = TR.filter((x) => yr(x.x) === y), start = mode === 'fresh' ? BASE : bal, risk = rp * start;
    let eq = start, pk = start, dd = 0, ddp = 0, low = start, s = 0, ms = 0, gp = 0, gl = 0, wins = 0, sR = 0, tp = 0; const m = Array(12).fill(0), cnt = Array(12).fill(0);
    for (const x of t) {
      const p = x.R * risk; tr.push({ ...x, p, y }); eq += p; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); ddp = Math.max(ddp, (pk - eq) / pk); low = Math.min(low, eq);
      if (x.R <= 0) { s++; ms = Math.max(ms, s); gl -= p; } else { s = 0; gp += p; wins++; }
      sR += x.R; if (x.why === 'target') tp++;
      const mi = new Date(x.x * 1000).getUTCMonth(); m[mi] += p; cnt[mi]++;
    }
    const have = cnt.map((c) => c > 0), idx = m.map((v, i) => i).filter((i) => have[i]);
    const best = idx.reduce((a, i) => (m[i] > m[a] ? i : a), idx[0]), worst = idx.reduce((a, i) => (m[i] < m[a] ? i : a), idx[0]);
    years.push({ y, start, end: eq, net: eq - start, ret: eq / start - 1, risk, dd, ddp, low, lowp: low / start - 1, streak: ms, n: t.length, wins, pf: gp / gl, avgR: sR / t.length, tp, m, cnt, have, pos: idx.filter((i) => m[i] > 0).length, nm: idx.length, best, worst });
    bal = eq;
  }
  return { years, tr, final: bal };
}
const F = runLedger(RP, 'fresh'), C = runLedger(RP, 'comp'), F25 = runLedger(0.025, 'fresh'), C25 = runLedger(0.025, 'comp');

// ---------- formatting ----------
const N0 = (v) => Math.round(v).toLocaleString('en-US');
const PES = (v) => '₱' + N0(Math.abs(v)), SG = (v) => (Math.round(v) < 0 ? '−' : '+') + '₱' + N0(Math.abs(v));
const cls = (v) => (v > 0.5 ? 'pos' : v < -0.5 ? 'neg' : 'flat');
const PC = (v, d = 0) => (v < 0 ? '−' : '+') + Math.abs(v * 100).toFixed(d) + '%', PCu = (v, d = 0) => (v * 100).toFixed(d) + '%';
const spn = (v) => `<span class="${cls(v)}" style="white-space:nowrap">${SG(v)}</span>`;
const rr = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);
const tbl = (head, rows, o = {}) => `<table${o.style ? ` style="${o.style}"` : ''}><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.tot ? ' class="tot"' : ''}>${(r.c || r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const heat = (v, mx) => { if (v == null) return ''; const a = Math.min(1, Math.abs(v) / mx) * 0.62 + (Math.abs(v) > 0.5 ? 0.1 : 0); return v >= 0 ? `background:rgba(22,163,74,${a.toFixed(2)})` : `background:rgba(220,38,38,${a.toFixed(2)})`; };
const short = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 10000 ? (v / 1000).toFixed(0) + 'k' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : N0(v));
const gridHTML = (L, mode) => {
  const mx = 5200; let h = `<table class="cal"><thead><tr><th></th>${MON.map((m) => `<th>${m}</th>`).join('')}<th>Year</th></tr></thead><tbody>`;
  for (const yv of L.years) {
    h += `<tr><td class="yr">${yv.y}</td>` + yv.m.map((v, i) => (yv.have[i] ? `<td style="${heat(v / (mode === 'comp' ? yv.start / BASE : 1), mx)}">${v < 0 ? '−' : ''}${short(Math.abs(v))}</td>` : '<td style="color:#cbd5e1">·</td>')).join('') + `<td class="tot">${yv.net < 0 ? '−' : ''}${short(Math.abs(yv.net))}</td></tr>`;
  }
  return h + '</tbody></table>';
};
// ---------- charts ----------
function logChart(series, ticks) {
  const W = 680, H = 250, x0 = 66, x1 = 664, y0 = 213, y1 = 18, lo = Math.log10(ticks[0]), hi = Math.log10(ticks[ticks.length - 1]);
  const X = (i) => x0 + (x1 - x0) * (i / (series.length - 1)), Y = (v) => y0 - (y0 - y1) * ((Math.log10(Math.max(v, ticks[0])) - lo) / (hi - lo));
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%">`;
  for (const t of ticks) s += `<line x1="${x0}" x2="${x1}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="#e2e8f0"/><text x="50" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" class="ax">₱${short(t)}</text>`;
  YRS.forEach((y, k) => { const i = series.findIndex((p) => p.y === y && p.i === 0); s += `<text x="${X(i).toFixed(1)}" y="242" class="ax">${y}</text>`; });
  s += `<path d="${series.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p.bal).toFixed(1)).join(' ')}" fill="none" stroke="#1d4ed8" stroke-width="2.4" stroke-linejoin="round"/>`;
  YRS.forEach((y) => { const i = series.findIndex((p) => p.y === y && p.i === 11); const p = series[i >= 0 ? i : series.length - 1], ii = i >= 0 ? i : series.length - 1; s += `<circle cx="${X(ii).toFixed(1)}" cy="${Y(p.bal).toFixed(1)}" r="3.6" fill="#1d4ed8"/><text x="${(X(ii) - 3).toFixed(1)}" y="${(Y(p.bal) - 9).toFixed(1)}" text-anchor="${ii === series.length - 1 ? 'end' : 'middle'}" class="tiny">${PES(p.bal)}</text>`; });
  return s + '</svg>';
}
function barChart(items, o = {}) {
  const W = 680, H = o.h || 200, x0 = 40, x1 = 664, top = 22, bot = H - 30, mx = Math.max(...items.map((i) => Math.abs(i.v)), 1) * 1.15, mnv = Math.min(0, ...items.map((i) => i.v)), mxv = Math.max(0, ...items.map((i) => i.v));
  const Y = (v) => top + (bot - top) * ((mxv * 1.15 - v) / ((mxv * 1.15) - (mnv * 1.15))), bw = (x1 - x0) / items.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="${x0}" x2="${x1}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#94a3b8"/>`;
  items.forEach((it, i) => { const xx = x0 + bw * i + bw * 0.15, w = bw * 0.7, y = Y(Math.max(it.v, 0)), h = Math.abs(Y(it.v) - Y(0)); s += `<rect x="${xx.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 0.6).toFixed(1)}" rx="2" fill="${it.v >= 0 ? '#16a34a' : '#dc2626'}"/><text x="${(xx + w / 2).toFixed(1)}" y="${(it.v >= 0 ? y - 4 : y + h + 11).toFixed(1)}" text-anchor="middle" class="tiny">${o.fmt ? o.fmt(it.v) : N0(it.v)}</text><text x="${(xx + w / 2).toFixed(1)}" y="${H - 12}" text-anchor="middle" class="ax">${it.l}</text>`; });
  return s + '</svg>';
}

// ---------- data used by several pages ----------
const fm = {}; for (const t of F.tr) { const k = ym(t.x); (fm[k] = fm[k] || []).push(t); }
const mp = (k) => (fm[k] || []).reduce((s, t) => s + t.p, 0), full = (k) => k >= '2021-01';
const mkeys = Object.keys(fm).filter(full).sort(), mv = mkeys.map((k) => ({ k, v: mp(k) })), sortedV = mv.map((o) => o.v).sort((a, b) => a - b);
const negM = mv.filter((o) => o.v < 0), avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const cal = [];
for (let m = 0; m < 12; m++) {
  const ks = mkeys.filter((k) => +k.slice(5) === m + 1), pairs = ks.map((k) => ({ k, v: mp(k) })).sort((a, b) => a.v - b.v), v = pairs.map((o) => o.v), tt = ks.flatMap((k) => fm[k]);
  const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  cal.push({ m, avg: avg(v), med, pos: v.filter((x) => x > 0).length, n: v.length, worst: pairs[0], best: pairs[pairs.length - 1], tr: tt.length / v.length, win: tt.filter((x) => x.R > 0).length / tt.length, avgR: tt.reduce((a, x) => a + x.R, 0) / tt.length });
}
const rank = [...cal].sort((a, b) => b.avg - a.avg).map((c) => c.m);
// seasonality permutation test
const allM = mkeys.map((k) => ({ m: +k.slice(5) - 1, v: mp(k) }));
const spread = (arr) => { const s = Array(12).fill(0), n = Array(12).fill(0); for (const o of arr) { s[o.m] += o.v; n[o.m]++; } const a = s.map((x, i) => x / n[i]); return Math.max(...a) - Math.min(...a); };
const obs = spread(allM); let ge = 0, seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let i = 0; i < 5000; i++) { const vs = allM.map((o) => o.v); for (let j = vs.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [vs[j], vs[r]] = [vs[r], vs[j]]; } if (spread(allM.map((o, k) => ({ m: o.m, v: vs[k] }))) >= obs) ge++; }
const pSeason = ge / 5000;
// streaks & stretches
let rs = 0, mrs = 0, rsEnd = ''; for (const o of mv) { if (o.v < 0) { rs++; if (rs > mrs) { mrs = rs; rsEnd = o.k; } } else rs = 0; }
const r3 = mv.slice(2).map((o, i) => ({ k: mv[i].k + ' → ' + o.k, v: mv[i].v + mv[i + 1].v + o.v })).sort((a, b) => a.v - b.v);
// start-month analysis (fresh sizing, flat RP*BASE per trade, trades opened after the start)
const starts = []; for (let y = 2021; y <= 2026; y++) for (let m = 0; m < 12; m++) { const s = Date.UTC(y, m, 1) / 1000; if (s > lastX - 30 * 86400) continue; starts.push({ y, m, s }); }
const SR = starts.map(({ y, m, s }) => {
  const t = F.tr.filter((x) => x.t >= s), at = (mo) => { const e = s + mo * 86400 * 30.44; return e > lastX ? null : t.filter((x) => x.x <= e).reduce((a, x) => a + x.p, 0); };
  let eq = 0, low = 0, under = null, back = null;
  for (const x of t) { if (x.x > s + 365 * 86400) break; eq += x.p; if (eq < low) low = eq; if (eq < 0 && under == null) under = x.x; if (under != null && back == null && eq >= 0 && x.x > under) back = x.x; }
  return { y, m, k: `${y}-${String(m + 1).padStart(2, '0')}`, m1: at(1), m3: at(3), m6: at(6), m12: at(12), low, rec: under == null ? 0 : back == null ? null : (back - s) / 86400 };
});
const cnt = (key) => SR.filter((o) => o[key] != null), negc = (key) => cnt(key).filter((o) => o[key] < 0).length;
// per coin
const cmv = (cn) => mkeys.map((k) => (fm[k] || []).filter((x) => x.sym === cn).reduce((a, x) => a + x.p, 0));
const corr = (a, b) => { const ma = avg(a), mb = avg(b); let x = 0, y = 0, z = 0; for (let i = 0; i < a.length; i++) { x += (a[i] - ma) * (b[i] - mb); y += (a[i] - ma) ** 2; z += (b[i] - mb) ** 2; } return x / Math.sqrt(y * z); };
const allLose = mv.filter((o) => COINS.every((cn) => (fm[o.k] || []).filter((x) => x.sym === cn).reduce((a, x) => a + x.p, 0) < 0));
const threeLose = mv.filter((o) => COINS.filter((cn) => (fm[o.k] || []).filter((x) => x.sym === cn).reduce((a, x) => a + x.p, 0) < 0).length >= 3).length;
const ft = F.tr.filter((x) => full(ym(x.x)));
const grp = (fn) => { const g = {}; for (const x of ft) { const k = fn(x); (g[k] = g[k] || []).push(x); } return Object.entries(g).sort(); };
const grow = ([k, v]) => [k.replace(/^\d/, ''), v.length, PCu(v.filter((x) => x.R > 0).length / v.length), rr(v.reduce((a, x) => a + x.R, 0) / v.length), spn(v.reduce((a, x) => a + x.p, 0))];
const W = ft.filter((x) => x.R > 0), Ls = ft.filter((x) => x.R <= 0);
let sk = 0, msk = 0, cur = 0, worstRun = 0; for (const x of ft) { if (x.R <= 0) { sk++; cur += x.p; msk = Math.max(msk, sk); worstRun = Math.min(worstRun, cur); } else { sk = 0; cur = 0; } }
const totalNetF = F.years.reduce((a, y) => a + y.net, 0), nTr = TR.length;
const posYears = F.years.filter((y) => y.net > 0).length;
const DOWN = `${SLUG}.pdf`;

// ---------- pages ----------
const pages = [];
const addPage = (html) => pages.push(html);
const H3 = (t) => `<h3>${t}</h3>`, SUB = (t, st = '') => `<p class="sub" style="${st}">${t}</p>`;
const GROSSNOTE = `<div class="note"><b>Before the 20% fee.</b> Every peso figure in this report is the trading result <b>before</b> the 20% performance fee, so it is directly comparable to the strategy's raw numbers. The investor report ("What ₱1,000 could have become") shows results after that fee. Trading costs (exchange fees, slippage, funding) <b>are</b> included here.</div>`;

// P1 cover
addPage(`<div class="cover-band"><div class="tag">Past-price test · Strategy report</div><h1>The four-coin system at 5% risk</h1>
<p class="sub" style="font-size:14px;margin:0">SOL, ZEC, NEAR and ADA tested on real market data from March 2020 to ${new Date(lastX * 1000).getUTCDate()} October 2026, about 6½ years, starting with ₱5,000. Shown two ways: a <b>fresh ₱5,000 every January</b> and <b>compounding</b> year to year.</p></div>
<div class="kpis"><div class="kpi"><div class="v">${PES(BASE)}</div><div class="k">Baseline balance</div></div><div class="kpi"><div class="v pos">${SG(totalNetF)}</div><div class="k">Total profit, fresh ₱5,000 each year (${YRS.length} years)</div></div><div class="kpi"><div class="v pos">${PES(C.final)}</div><div class="k">Final balance if compounded</div></div><div class="kpi"><div class="v">${posYears} / ${YRS.length}</div><div class="k">Profitable years</div></div></div>
<div class="kpis" style="margin-top:0"><div class="kpi"><div class="v">${PC(totalNetF / BASE / YRS.length)}</div><div class="k">Average per year, fresh ₱5,000</div></div><div class="kpi"><div class="v">${mv.length - negM.length} / ${mv.length}</div><div class="k">Profitable months (2021 on)</div></div><div class="kpi"><div class="v neg">−${(Math.max(...F.years.map((y) => y.ddp)) * 100).toFixed(0)}%</div><div class="k">Worst drop from a high in a year</div></div><div class="kpi"><div class="v">${N0(nTr)}</div><div class="k">Trades taken</div></div></div>
${GROSSNOTE}
<h2>How it works, in plain words</h2>${SUB('A fixed set of rules run by a computer on four large, liquid coins. It never guesses and has no emotions.')}
<div class="steps"><div class="step"><div class="n">1</div><b>Four coins, one rule</b><p>Solana, Zcash, NEAR and Cardano. On the 4-hour chart the system trades when price closes beyond its Bollinger Band in the direction of the 200-period trend, both long and short.</p></div>
<div class="step"><div class="n">2</div><b>5% risked per trade</b><p>Every trade has its exit for a loss set before it opens, placed so the loss is <b>5% of the account</b> (₱250 on ₱5,000). Wins are targeted at 4 times that risk.</p></div>
<div class="step"><div class="n">3</div><b>Two ways to size</b><p><b>Fresh:</b> every 1 January the account is reset to ₱5,000. <b>Compounding:</b> every 1 January the 5% is recalculated from the new, larger balance.</p></div></div>
${H3('What to expect')}<ul style="margin:4px 0 0;padding-left:18px"><li><b>Most trades lose.</b> Only about ${PCu(W.length / ft.length)} win. Wins average +${(W.reduce((a, x) => a + x.R, 0) / W.length).toFixed(1)}R and losses −${Math.abs(Ls.reduce((a, x) => a + x.R, 0) / Ls.length).toFixed(2)}R, so the wins pay for everything.</li>
<li><b>The balance dips below the start in almost every first year.</b> ${SR.filter((o) => o.low < 0).length} of ${SR.length} possible starting months went below the starting balance at some point, by about ${PES(-avg(SR.map((o) => o.low)))} on average.</li>
<li><b>It works in both directions.</b> Longs and shorts both made money; shorts carried the 2022 bear market.</li><li><b>The edge is slowly shrinking.</b> Profit factor went from ${F.years[1].pf.toFixed(2)} in 2021 to ${F.years[F.years.length - 1].pf.toFixed(2)} in 2026.</li></ul>`);

// P2 comparison
const trow = (a, b, c, d) => ({ tot: true, c: [a, b, c, d] });
addPage(`<h2>Fresh ₱5,000 each year vs compounding</h2>${SUB('Same trades, same signals. The only difference is how big each trade is. In both versions 5% of the account is risked per trade, so the percent return of each year is identical. Only the peso amounts differ.')}
${H3('Version 1: fresh ₱5,000 every January')}${tbl(['Year', 'Starts at', 'Risk per trade', 'Profit', 'Return', 'Ends at'], [...F.years.map((f) => [f.y + (f.y === 2020 ? '*' : f.y === 2026 ? '†' : ''), PES(f.start), PES(f.risk), spn(f.net), `<span class="${cls(f.ret)}">${PC(f.ret)}</span>`, PES(f.end)]), { tot: true, c: ['Total', '', '', spn(totalNetF), '', ''] }])}
${H3('Version 2: compounding, ₱5,000 once and everything kept in')}${tbl(['Year', 'Starts at', 'Risk per trade', 'Profit', 'Return', 'Ends at'], [...C.years.map((f) => [f.y + (f.y === 2020 ? '*' : f.y === 2026 ? '†' : ''), PES(f.start), PES(f.risk), spn(f.net), `<span class="${cls(f.ret)}">${PC(f.ret)}</span>`, `<b>${PES(f.end)}</b>`]), { tot: true, c: ['Total', PES(BASE), '', spn(C.final - BASE), '', `<b>${PES(C.final)}</b>`] }])}
<p class="sub" style="margin-top:4px">* 2020 starts in March (ZEC and ADA first signals 8–12 March; SOL in October; NEAR in November). † 2026 runs to 20 October.</p>
<div class="two" style="margin-top:12px"><div class="card"><h3 style="margin-top:0">Fresh ₱5,000 each year</h3><p style="font-size:11.5px">You start every January with exactly ₱5,000 and risk a flat <b>₱250</b> per trade all year. Profit is paid out or set aside at year end.</p><ul style="font-size:11.5px;margin:4px 0;padding-left:16px"><li>Total profit <b>${SG(totalNetF)}</b></li><li>Average year <b>${SG(totalNetF / YRS.length)}</b> (${PC(totalNetF / BASE / YRS.length)})</li><li>Best year ${SG(Math.max(...F.years.map((y) => y.net)))} (${F.years.reduce((a, y) => (y.net > a.net ? y : a)).y}), weakest ${SG(Math.min(...F.years.map((y) => y.net)))} (${F.years.reduce((a, y) => (y.net < a.net ? y : a)).y})</li><li>Lowest balance reached: <b>${PES(Math.min(...F.years.map((y) => y.low)))}</b> (${F.years.reduce((a, y) => (y.low < a.low ? y : a)).y})</li></ul></div>
<div class="card"><h3 style="margin-top:0">Compounding year to year</h3><p style="font-size:11.5px">Start with ₱5,000 and keep everything in. On each 1 January the 5% is recalculated, so risk per trade grows from ₱250 to <b>${PES(C.years[C.years.length - 1].risk)}</b>.</p><ul style="font-size:11.5px;margin:4px 0;padding-left:16px"><li>Final balance <b>${PES(C.final)}</b> (×${(C.final / BASE).toFixed(1)})</li><li>Biggest single-year gain: ${SG(Math.max(...C.years.map((y) => y.net)))}</li><li>Worst drop in pesos: <b>${PES(Math.max(...C.years.map((y) => y.dd)))}</b> (${C.years.reduce((a, y) => (y.dd > a.dd ? y : a)).y})</li><li>Percent drops are the same as fresh, but each one costs far more pesos as the account grows</li></ul></div></div>
<div class="note warn"><b>Treat the compounding figure as a ceiling, not a forecast.</b> It assumes the 2020–2026 pattern repeats, the coins stay liquid at ever bigger size, and nothing is withdrawn. A ${PES(C.final)} result would need position sizes the order books of these coins cannot fill without moving price. Use the fresh table to judge what to expect, and the compounding table to compare risk levels.</div>`);

// P3 charts
const series = []; { let bal = BASE; for (const yv of C.years) { let c = yv.start; for (let i = 0; i < 12; i++) { c += yv.m[i]; if (yv.y === 2026 && i > new Date(lastX * 1000).getUTCMonth()) continue; series.push({ y: yv.y, i, bal: c }); } } }
const tk = [5000]; while (tk[tk.length - 1] < C.final) tk.push(tk[tk.length - 1] * 10); tk.length > 1 && tk[0] === 5000 && tk.splice(0, 1, 5000);
addPage(`<h2>Growth of ₱5,000</h2>${SUB('Compounding version: balance at the end of every month, before the 20% fee. The scale grows evenly in percentage terms, so the same percent gain looks the same size in 2021 as in 2025. Dots show each year-end.')}
<div class="card">${logChart(series, tk)}</div>
${H3('Profit each year with a fresh ₱5,000')}${SUB('Every bar starts from the same ₱5,000, so the bars show what each market year was worth on its own. 2021 was the bull run; since 2022 the range has been steady.', 'margin-bottom:4px')}
<div class="card">${barChart(F.years.map((y) => ({ l: y.y + (y.y === 2020 ? '*' : y.y === 2026 ? '†' : ''), v: y.net })), { fmt: (v) => '+₱' + N0(v), h: 215 })}</div>
${H3('Return each year, same in both versions')}${barChart(F.years.map((y) => ({ l: String(y.y), v: y.ret * 100 })), { fmt: (v) => '+' + v.toFixed(0) + '%', h: 170 })}
<p class="sub" style="margin-top:2px">* partial year (from March) † to 20 October</p>`);

// P4 fresh stats
const perfRows = (L) => L.years.map((y) => [y.y, spn(y.net), `<span class="${cls(y.ret)}">${PC(y.ret)}</span>`, y.n, PCu(y.wins / y.n), y.pf.toFixed(2), rr(y.avgR), y.tp, y.streak]);
const riskRows = (L) => L.years.map((y) => [y.y, `<span class="neg">−${(y.ddp * 100).toFixed(0)}%</span>`, `<span class="neg">−${PES(y.dd)}</span>`, PES(y.low), `${y.pos}/${y.nm}`, `${MON[y.best]} ${spn(y.m[y.best])}`, `${MON[y.worst]} ${spn(y.m[y.worst])}`]);
addPage(`<h2>Year by year: fresh ₱5,000 each year</h2>${SUB('Flat ₱250 risked per trade. Trades are counted in the year they close.')}
${H3('Results')}${tbl(['Year', 'Profit', 'Return', 'Trades', 'Win rate', 'Profit factor', 'Avg R / trade', 'Hit the 4R target', 'Longest losing streak'], perfRows(F))}
${H3('Risk and the ups and downs')}${tbl(['Year', 'Worst drop from a high', 'In pesos', 'Lowest balance', 'Profitable months', 'Best month', 'Worst month'], riskRows(F))}
<div class="note"><b>How to read this.</b> “Worst drop from a high” is the biggest fall from the account's highest point so far that year. “Lowest balance” is the lowest the account ever got, on a ₱5,000 start. <b>2023 and 2024 are the stress years:</b> the account fell to ${PES(F.years.find((y) => y.y === 2023).low)} and ${PES(F.years.find((y) => y.y === 2024).low)} before ending the year at ${PES(F.years.find((y) => y.y === 2023).end)} and ${PES(F.years.find((y) => y.y === 2024).end)}.</div>
${H3('What the numbers say')}<ul style="margin:4px 0 0;padding-left:18px"><li><b>2021</b> is the outlier: +${(F.years[1].ret * 100).toFixed(0)}% on the bull run, with the best month (August, ${SG(F.years[1].m[7])}).</li><li><b>2022</b> had the longest losing streak (${F.years.find((y) => y.y === 2022).streak} trades in a row) but still finished ${SG(F.years.find((y) => y.y === 2022).net)} because short trades paid in the bear market.</li><li><b>Profit factor</b> (money won ÷ money lost) fell from ${F.years[1].pf.toFixed(2)} in 2021 to ${F.years[F.years.length - 1].pf.toFixed(2)} in 2026. Still above 1, but the margin is thinner.</li><li><b>Only about ${PCu(W.length / ft.length)} of trades win.</b> That is normal for this style: small frequent losses, occasional big wins.</li></ul>`);

// P5 compounding stats
addPage(`<h2>Year by year: compounding</h2>${SUB('Each January the risk per trade is reset to 5% of the balance on that day, then held flat for the year. Percent results match the fresh version; the pesos grow.')}
${tbl(['Year', 'Starts at', 'Risk per trade', 'Profit', 'Return', 'Ends at', 'Multiple of start'], C.years.map((y) => [y.y, PES(y.start), PES(y.risk), spn(y.net), `<span class="${cls(y.ret)}">${PC(y.ret)}</span>`, `<b>${PES(y.end)}</b>`, '×' + (y.end / y.start).toFixed(2)]))}
${H3('Risk in pesos as the account grows')}${tbl(['Year', 'Worst drop from a high', 'In pesos', 'Lowest balance', 'Lowest vs. start of year', 'Longest losing run'], C.years.map((y) => [y.y, `<span class="neg">−${(y.ddp * 100).toFixed(0)}%</span>`, `<span class="neg">−${PES(y.dd)}</span>`, PES(y.low), `<span class="${cls(y.lowp)}">${y.lowp >= 0 ? 'never below start' : PC(y.lowp)}</span>`, y.streak + ' trades']))}
<div class="note"><b>Why the percentages stay the same but the pain grows.</b> A −${(Math.max(...C.years.map((y) => y.ddp)) * 100).toFixed(0)}% drop in ${C.years.reduce((a, y) => (y.ddp > a.ddp ? y : a)).y} cost ${PES(C.years.reduce((a, y) => (y.ddp > a.ddp ? y : a)).dd)}, while the same kind of fall in 2021 cost only ${PES(C.years[1].dd)}. If you compound, the biggest peso losses always come in the later, larger years, exactly when it feels least safe to lose them.</div>
<div class="note warn"><b>One more thing.</b> Year-end compounding is a simplification. If you re-size more often (after every trade), growth is faster on the way up and drops are deeper on the way down. The numbers above are the gentler version.</div>`);

// P6, P7 monthly grids
const colorLegend = `<div class="legend"><span><i class="sw" style="background:rgba(220,38,38,.7)"></i>Losing month</span><span><i class="sw" style="background:rgba(22,163,74,.7)"></i>Winning month</span><span>Numbers in ₱ (k = thousand). Darker = bigger. “·” = system not yet trading.</span></div>`;
addPage(`<h2>Every month: fresh ₱5,000 each year</h2>${SUB('Profit or loss per month on a ₱5,000 account risking ₱250 per trade. A trade counts in the month it closes.')}
${gridHTML(F, 'fresh')}${colorLegend}
${H3('As a percent of ₱5,000')}${tbl(['Year', ...MON], F.years.map((y) => [y.y, ...y.m.map((v, i) => (y.have[i] ? `<span class="${cls(v)}">${(v / BASE * 100).toFixed(0)}%</span>` : '·'))]), { style: 'font-size:9.5px' })}
${H3('Since 2021 (all four coins live)')}<ul style="margin:4px 0 0;padding-left:18px"><li><b>${mv.length - negM.length} of ${mv.length} months made money</b> (${PCu(1 - negM.length / mv.length)}). Average month ${SG(avg(mv.map((o) => o.v)))}, average losing month ${SG(avg(negM.map((o) => o.v)))}.</li><li>Never more than <b>${mrs} negative months in a row</b>. Only ${r3.filter((o) => o.v < 0).length} of ${r3.length} three-month stretches lost money.</li></ul>`);
addPage(`<h2>Every month: compounding</h2>${SUB('The same trades in pesos on the growing account. Profit (top) and the balance at the end of each month (bottom).')}
${H3('Profit per month')}${gridHTML(C, 'comp')}${colorLegend}
${H3('Balance at the end of each month')}<table class="cal"><thead><tr><th></th>${MON.map((m) => `<th>${m}</th>`).join('')}</tr></thead><tbody>${C.years.map((yv) => { let c = yv.start; return `<tr><td class="yr">${yv.y}</td>` + yv.m.map((v, i) => { c += v; if (yv.y === 2020 && i < 2) return '<td style="color:#cbd5e1">·</td>'; if (yv.y === 2026 && i > new Date(lastX * 1000).getUTCMonth()) return '<td style="color:#cbd5e1">·</td>'; return `<td style="background:#f1f5f9">${short(c)}</td>`; }).join('') + '</tr>'; }).join('')}</tbody></table>
<p class="sub" style="margin-top:6px">The monthly colors are scaled to the size of the account at the start of each year, so a red box in 2024 is as bad in percent terms as a red box in 2021, even though the pesos are much larger.</p>`);

// P8 calendar month
addPage(`<h2>Which calendar months are best and worst?</h2>${SUB('Every January together, every February together, and so on, for 2021 to 2026 (fresh ₱5,000). With only five or six of each, treat this as a description, not a rule.')}
<div class="card">${barChart(cal.map((c) => ({ l: MON[c.m], v: c.avg })), { fmt: (v) => (v < 0 ? '−' : '+') + N0(Math.abs(v)), h: 190 })}</div>
${tbl(['Month', 'Average', 'Median', 'Profitable years', 'Worst (year)', 'Best (year)', 'Trades', 'Win rate', 'Avg R', 'Rank'], cal.map((c) => [MON[c.m], spn(c.avg), spn(c.med), `${c.pos}/${c.n}`, `${spn(c.worst.v)} (${c.worst.k.slice(0, 4)})`, `${spn(c.best.v)} (${c.best.k.slice(0, 4)})`, c.tr.toFixed(0), PCu(c.win), rr(c.avgR), '#' + (rank.indexOf(c.m) + 1)]))}
<div class="note"><b>Strongest:</b> ${rank.slice(0, 4).map((m) => MON[m]).join(', ')}. <b>Weakest:</b> ${rank.slice(-4).reverse().map((m) => MON[m]).join(', ')}. <b>${MON[cal.find((c) => c.pos === c.n).m]}</b> was positive every year it was tested.<br><b>But it is probably noise.</b> We shuffled the ${mv.length} monthly results randomly across the calendar 5,000 times. A gap between best and worst month as large as the real one (${PES(obs)}) appeared <b>${PCu(pSeason)}</b> of the time by pure chance. One huge month moves a monthly average a lot: August's average is mostly August 2021 (${SG(cal[7].best.v)}), and its median is only ${SG(cal[7].med)}. <b>Do not time the start or stop of trading by the calendar.</b></div>`);

// P9 distribution
const bands = [['Worse than −₱500', (v) => v < -500], ['−₱500 to −₱100', (v) => v >= -500 && v < -100], ['−₱100 to ₱0', (v) => v >= -100 && v < 0], ['₱0 to +₱1,000', (v) => v >= 0 && v < 1000], ['+₱1,000 to +₱2,500', (v) => v >= 1000 && v < 2500], ['Above +₱2,500', (v) => v >= 2500]];
const srt = [...mv].sort((a, b) => a.v - b.v);
addPage(`<h2>The shape of a typical month</h2>${SUB(`${mv.length} months from January 2021 to October 2026, fresh ₱5,000.`)}
<div class="kpis"><div class="kpi"><div class="v">${PCu((mv.length - negM.length) / mv.length)}</div><div class="k">Months that made money</div></div><div class="kpi"><div class="v pos">${SG(avg(mv.map((o) => o.v)))}</div><div class="k">Average month</div></div><div class="kpi"><div class="v neg">${SG(avg(negM.map((o) => o.v)))}</div><div class="k">Average losing month</div></div><div class="kpi"><div class="v">${mrs}</div><div class="k">Most losing months in a row</div></div></div>
<div class="two"><div>${H3('How the months were spread')}${tbl(['Monthly result', 'Months'], bands.map(([l, f]) => [l, sortedV.filter(f).length]))}<p class="sub" style="margin-top:8px">Median month ${SG(sortedV[Math.floor(sortedV.length / 2)])}. Losing months are usually small, but ${sortedV.filter((v) => v < -500).length} of them lost more than ₱500, which is ${(500 / BASE * 100).toFixed(0)}% of the account.</p></div>
<div>${H3('Worst three-month stretches')}${tbl(['Stretch', 'Result'], r3.slice(0, 5).map((o) => [o.k, spn(o.v)]))}<p class="sub" style="margin-top:8px">${r3.filter((o) => o.v < 0).length} of ${r3.length} three-month stretches lost money. The 2022 summer stretch is the one to remember.</p></div></div>
<div class="two"><div>${H3('Ten worst months')}${tbl(['Month', 'Result', 'Coins losing'], srt.slice(0, 10).map((o) => [o.k, spn(o.v), COINS.filter((cn) => (fm[o.k] || []).filter((x) => x.sym === cn).reduce((a, x) => a + x.p, 0) < 0).length + ' of 4']))}</div>
<div>${H3('Ten best months')}${tbl(['Month', 'Result', 'Coins winning'], [...srt].reverse().slice(0, 10).map((o) => [o.k, spn(o.v), COINS.filter((cn) => (fm[o.k] || []).filter((x) => x.sym === cn).reduce((a, x) => a + x.p, 0) > 0).length + ' of 4']))}</div></div>
<div class="note"><b>The worst months are the ones where all four coins lose together:</b> ${allLose.map((o) => `${o.k} (${SG(o.v)})`).join(', ')}. That happened in ${allLose.length} of ${mv.length} months, and in ${threeLose} months at least three of the four lost. Spreading across four coins helps most months, but not when the whole market turns against the system at once. <b>${PCu(negM.length / mv.length)} of months lose money, and they come singly or in pairs, never more than ${mrs} in a row.</b></div>`);

// P10 start month
const startRows = []; for (let m = 0; m < 12; m++) {
  const r = SR.filter((o) => o.m === m), q = (key) => r.filter((o) => o[key] != null), ng = (key) => q(key).filter((o) => o[key] < 0).length + '/' + q(key).length, av = (key) => spn(avg(q(key).map((o) => o[key])));
  const dips = r.filter((o) => o.low < 0), recs = dips.filter((o) => o.rec != null);
  startRows.push([`<b>${MON[m]}</b>`, r.length, ng('m1'), ng('m3'), ng('m6'), av('m1'), av('m3'), av('m6'), `<span class="neg">−${PES(-avg(r.map((o) => o.low)))}</span>`, `<span class="neg">−${PES(-Math.min(...r.map((o) => o.low)))}</span>`, recs.length ? avg(recs.map((o) => o.rec)).toFixed(0) + ' d' : '—']);
}
const all12 = cnt('m12');
addPage(`<h2>Does the month you start in matter?</h2>${SUB('Start with ₱5,000 on the 1st of a month, risk a flat ₱250 per trade, and take only trades opened after that date. Each month was tried as a start date in every year from 2021 to 2026 (69 start dates in all).')}
${tbl(['Start month', 'Tries', '1st month negative', 'After 3 mo. negative', 'After 6 mo. negative', 'Avg 1st month', 'Avg after 3 mo.', 'Avg after 6 mo.', 'Avg dip below ₱5,000', 'Worst dip', 'Avg days to recover'], startRows, { style: 'font-size:9.5px' })}
<div class="kpis" style="margin-top:12px"><div class="kpi"><div class="v neg">${negc('m1')}/${cnt('m1').length}</div><div class="k">Starts negative after 1 month</div></div><div class="kpi"><div class="v neg">${negc('m3')}/${cnt('m3').length}</div><div class="k">Negative after 3 months</div></div><div class="kpi"><div class="v neg">${negc('m6')}/${cnt('m6').length}</div><div class="k">Negative after 6 months</div></div><div class="kpi"><div class="v pos">${all12.filter((o) => o.m12 < 0).length}/${all12.length}</div><div class="k">Negative after 12 months</div></div></div>
<div class="note"><b>Reading the table.</b> “Negative” means the account was below its starting ₱5,000 at that point. “Dip” is the lowest the account got at any time in the first year, measured from ₱5,000. “Days to recover” is how long it took to get back above the start after first dropping under it.</div>`);

// P11 start detail
const worstS = [...SR].sort((a, b) => a.low - b.low).slice(0, 8), bestS = [...SR].filter((o) => o.m12 != null).sort((a, b) => b.m12 - a.m12);
addPage(`<h2>Starting out: what to expect</h2>${SUB('The same start-date test, boiled down to what a new account should plan for.')}
<div class="kpis"><div class="kpi"><div class="v">${SR.filter((o) => o.low < 0).length}/${SR.length}</div><div class="k">Starts that went below ₱5,000 at some point</div></div><div class="kpi"><div class="v neg">−${PES(-avg(SR.map((o) => o.low)))}</div><div class="k">Average dip in the first year</div></div><div class="kpi"><div class="v pos">${SG(avg(all12.map((o) => o.m12)))}</div><div class="k">Average after 12 months</div></div><div class="kpi"><div class="v">${SG(Math.min(...all12.map((o) => o.m12)))}</div><div class="k">Worst 12-month result</div></div></div>
<div class="two"><div>${H3('Eight roughest starts')}${tbl(['Start', 'Deepest dip', 'Recovered'], worstS.map((o) => [o.k + '-01', `<span class="neg">−${PES(-o.low)}</span> (${(o.low / BASE * 100).toFixed(0)}%)`, o.rec == null ? 'not yet' : o.rec.toFixed(0) + ' days']))}<p class="sub" style="margin-top:8px">The deepest was ${worstS[0].k}: the account fell to ${PES(BASE + worstS[0].low)}, a ${(-worstS[0].low / BASE * 100).toFixed(0)}% loss, and took ${worstS[0].rec == null ? 'longer than the data' : worstS[0].rec.toFixed(0) + ' days'} to recover.</p></div>
<div>${H3('12-month outcomes, all starts')}${tbl(['Measure', 'Result'], [['Starts measured', all12.length], ['Best 12 months', spn(bestS[0].m12)], ['Median 12 months', spn([...all12].map((o) => o.m12).sort((a, b) => a - b)[Math.floor(all12.length / 2)])], ['Worst 12 months', spn(Math.min(...all12.map((o) => o.m12)))], ['12-month results below zero', all12.filter((o) => o.m12 < 0).length]])}</div></div>
${H3('What this means')}<ul style="margin:4px 0 0;padding-left:18px"><li><b>Starting negative is normal.</b> About one start in three (${negc('m1')} of ${cnt('m1').length}) is below the starting balance after the first month, and nearly every start dips at some point in the first year.</li><li><b>It does not stay that way.</b> By six months only ${negc('m6')} of ${cnt('m6').length} starts were still underwater, and no start finished its first twelve months in the red.</li>
<li><b>July and March were the roughest starting months.</b> July is the only month with a negative average first month and the deepest average dip. March had the most negative first months (${SR.filter((o) => o.m === 2 && o.m1 < 0).length} of ${SR.filter((o) => o.m === 2).length}). With six tries each, this is a pattern to be aware of, not a rule.</li><li><b>October, May and January were the gentlest.</b></li><li><b>The real risk is the size of the dip, not whether it happens.</b> At 5% risk the rough starts lost ${(-worstS[3].low / BASE * 100).toFixed(0)}% to ${(-worstS[0].low / BASE * 100).toFixed(0)}% of the account before recovering. Only start with money you can leave alone through that.</li></ul>`);

// P12 per coin
const coinRows = COINS.map((cn) => { const t = F.tr.filter((x) => x.sym === cn), tf = t.filter((x) => full(ym(x.x))), cm = MON.map((_, m) => tf.filter((x) => +ym(x.x).slice(5) === m + 1).reduce((a, x) => a + x.p, 0)), b = cm.indexOf(Math.max(...cm)), w = cm.indexOf(Math.min(...cm)), mm = cmv(cn); return [`<b>${cn}</b>`, ...YRS.map((y) => spn(t.filter((x) => x.y === y).reduce((a, x) => a + x.p, 0))), spn(t.reduce((a, x) => a + x.p, 0)), `${mm.filter((v) => v > 0).length}/${mm.length}`, `${MON[b]} ${spn(cm[b])}`, `${MON[w]} ${spn(cm[w])}`]; });
const pairs = COINS.flatMap((a, i) => COINS.slice(i + 1).map((b) => [`${a} – ${b}`, corr(cmv(a), cmv(b))]));
addPage(`<h2>The four coins</h2>${SUB('Profit by coin per year on the fresh ₱5,000 version. First signals: ' + COINS.map((c) => `${c} ${FIRST[c]}`).join(', ') + '.')}
${tbl(['Coin', ...YRS, 'Total', 'Profitable months', 'Best calendar month', 'Worst calendar month'], coinRows, { style: 'font-size:9.5px' })}
<div class="two"><div>${H3('How much the coins move together')}${tbl(['Pair', 'Monthly correlation'], pairs.map(([n, c]) => [n, c.toFixed(2)]))}<p class="sub" style="margin-top:8px">0 means unrelated, 1 means identical. Everything is below 0.4, and <b>SOL and ZEC are almost independent (${pairs[0][1].toFixed(2)})</b>. That is why the portfolio is steadier than any single coin.</p></div>
<div>${H3('Coins covering for each other')}<ul style="margin:4px 0 0;padding-left:18px;font-size:11.5px"><li><b>ZEC</b> made almost nothing in 2022–23 (${SG(F.tr.filter((x) => x.sym === 'ZEC' && x.y === 2022).reduce((a, x) => a + x.p, 0))}, ${SG(F.tr.filter((x) => x.sym === 'ZEC' && x.y === 2023).reduce((a, x) => a + x.p, 0))}); SOL carried 2023 with ${SG(F.tr.filter((x) => x.sym === 'SOL' && x.y === 2023).reduce((a, x) => a + x.p, 0))}.</li><li><b>SOL</b> was weaker in 2024–25; ZEC made ${SG(F.tr.filter((x) => x.sym === 'ZEC' && x.y === 2024).reduce((a, x) => a + x.p, 0))} and ${SG(F.tr.filter((x) => x.sym === 'ZEC' && x.y === 2025).reduce((a, x) => a + x.p, 0))}.</li><li><b>ADA</b> is the steadiest, ${SG(Math.min(...YRS.slice(0, 6).map((y) => F.tr.filter((x) => x.sym === 'ADA' && x.y === y).reduce((a, x) => a + x.p, 0))))} or more every year until 2026, then only ${SG(F.tr.filter((x) => x.sym === 'ADA' && x.y === 2026).reduce((a, x) => a + x.p, 0))}. <b>Worth watching.</b></li><li><b>NEAR</b> is the smallest earner but positive every year.</li></ul></div></div>
<div class="note"><b>When they all lose together.</b> In ${allLose.length} months (${allLose.map((o) => o.k).join(', ')}) every coin lost at once, and in ${threeLose} of ${mv.length} months at least three did. Those were the worst months of the whole test. Diversifying over four coins reduces risk, it does not remove it.</div>`);

// P13 trade angles
const dirT = grp((x) => (x.dir === 1 ? 'Long' : 'Short')), exitT = grp((x) => ({ stop: 'Stopped out', target: 'Hit the 4R target', time: 'Closed by time limit', end: 'Still open at end' }[x.why]));
addPage(`<h2>Inside the trades</h2>${SUB(`${N0(ft.length)} trades from 2021 onward, fresh ₱5,000 (₱250 per trade). R means “multiples of the amount risked”: +4R is a win of four times the risk, −1R a full loss.`)}
<div class="kpis"><div class="kpi"><div class="v">${PCu(W.length / ft.length)}</div><div class="k">Win rate</div></div><div class="kpi"><div class="v pos">+${(W.reduce((a, x) => a + x.R, 0) / W.length).toFixed(2)}R</div><div class="k">Average win</div></div><div class="kpi"><div class="v neg">${(Ls.reduce((a, x) => a + x.R, 0) / Ls.length).toFixed(2)}R</div><div class="k">Average loss</div></div><div class="kpi"><div class="v">${(ft.length / mv.length).toFixed(1)}</div><div class="k">Trades per month</div></div></div>
<div class="two"><div>${H3('Long vs short')}${tbl(['Side', 'Trades', 'Win rate', 'Avg R', 'Profit'], dirT.map(grow))}<br>${H3('How trades ended')}${tbl(['Exit', 'Trades', 'Win rate', 'Avg R', 'Profit'], exitT.map(grow))}</div>
<div>${H3('By quarter')}${tbl(['Quarter', 'Trades', 'Win rate', 'Avg R', 'Profit'], grp((x) => 'Q' + (Math.floor(new Date(x.x * 1000).getUTCMonth() / 3) + 1)).map(grow))}<br>${H3('By day of entry (UTC)')}${tbl(['Day', 'Trades', 'Win rate', 'Avg R', 'Profit'], grp((x) => new Date(x.t * 1000).getUTCDay() + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(x.t * 1000).getUTCDay()]).map(grow))}</div></div>
${H3('Long vs short, year by year')}${tbl(['Year', 'Long trades', 'Long profit', 'Long avg R', 'Short trades', 'Short profit', 'Short avg R'], YRS.filter((y) => y >= 2021).map((y) => { const l = ft.filter((x) => x.y === y && x.dir === 1), s = ft.filter((x) => x.y === y && x.dir === -1); return [y, l.length, spn(l.reduce((a, x) => a + x.p, 0)), rr(l.reduce((a, x) => a + x.R, 0) / l.length), s.length, spn(s.reduce((a, x) => a + x.p, 0)), rr(s.reduce((a, x) => a + x.R, 0) / s.length)]; }))}
<div class="note"><b>Where the money comes from.</b> ${grp((x) => x.why).find((e) => e[0] === 'target')[1].length} trades reached the 4R target and ${grp((x) => x.why).find((e) => e[0] === 'time')[1].length} were closed by the 8-day time limit mostly in profit; together they pay for the ${grp((x) => x.why).find((e) => e[0] === 'stop')[1].length} stop-outs. Winners last about ${(W.reduce((a, x) => a + x.bars * 4, 0) / W.length / 24).toFixed(1)} days and losers ${(Ls.reduce((a, x) => a + x.bars * 4, 0) / Ls.length / 24).toFixed(1)} days. The longest losing streak was <b>${msk} trades in a row</b>, a run that cost ${PES(-worstRun)}. Funding costs over the whole test: ${SG(ft.reduce((a, x) => a + x.fundR * RP * BASE, 0))}. Monday entries were the weakest and Friday the strongest, but with this sample size that is more likely noise than a rule.</div>`);

// P14 risk dial
const rd = (L, key) => L.years.map((y) => y[key]);
addPage(`<h2>Turning the risk dial: 2.5% vs 5%</h2>${SUB('Same four coins, same trades, with half the risk per trade (₱125 on ₱5,000). Profit and the size of every loss in pesos are cut exactly in half. The percent drop from a high shrinks by a little less than half, because the peaks it is measured from are lower too.')}
${H3('Fresh ₱5,000 each year')}${tbl(['Year', 'Profit at 2.5%', 'Profit at 5%', 'Worst drop at 2.5%', 'Worst drop at 5%', 'Lowest balance at 2.5%', 'Lowest balance at 5%'], F.years.map((y, i) => [y.y, spn(F25.years[i].net), spn(y.net), `<span class="neg">−${(F25.years[i].ddp * 100).toFixed(0)}%</span>`, `<span class="neg">−${(y.ddp * 100).toFixed(0)}%</span>`, PES(F25.years[i].low), PES(y.low)]).concat([{ tot: true, c: ['Total / worst', spn(F25.years.reduce((a, y) => a + y.net, 0)), spn(totalNetF), `−${(Math.max(...F25.years.map((y) => y.ddp)) * 100).toFixed(0)}%`, `−${(Math.max(...F.years.map((y) => y.ddp)) * 100).toFixed(0)}%`, PES(Math.min(...F25.years.map((y) => y.low))), PES(Math.min(...F.years.map((y) => y.low)))] }]))}
${H3('Compounding')}${tbl(['Year', 'Ends at (2.5%)', 'Ends at (5%)', 'Worst drop in pesos (2.5%)', 'Worst drop in pesos (5%)'], C.years.map((y, i) => [y.y, PES(C25.years[i].end), `<b>${PES(y.end)}</b>`, `<span class="neg">−${PES(C25.years[i].dd)}</span>`, `<span class="neg">−${PES(y.dd)}</span>`]))}
<div class="note"><b>What changes with the dial.</b> At 2.5% the typical year earns about ${PES(F25.years.reduce((a, y) => a + y.net, 0) / YRS.length)} on ₱5,000 (${PC(F25.years.reduce((a, y) => a + y.net, 0) / YRS.length / BASE)}) instead of ${PES(totalNetF / YRS.length)}, and the worst fall from a high drops from ${(Math.max(...F.years.map((y) => y.ddp)) * 100).toFixed(0)}% to ${(Math.max(...F25.years.map((y) => y.ddp)) * 100).toFixed(0)}%. The account's lowest point in the worst year goes from ${PES(Math.min(...F.years.map((y) => y.low)))} to ${PES(Math.min(...F25.years.map((y) => y.low)))}. Profit is cut in half, and so is the worst loss in pesos (from ${PES(BASE - Math.min(...F.years.map((y) => y.low)))} to ${PES(BASE - Math.min(...F25.years.map((y) => y.low)))} below the start).</div>
${H3('How to choose')}<ul style="margin:4px 0 0;padding-left:18px"><li><b>5%</b> is the aggressive setting. It roughly doubles profit, but the account has fallen by more than ${(Math.floor(Math.max(...F.years.map((y) => y.ddp)) * 10) * 10)}% from a high within a single year, and some starting months lost over ${(-worstS[0].low / BASE * 100).toFixed(0)}% before recovering.</li><li><b>2.5%</b> keeps most of the same shape of results with drops that are far easier to sit through. Slower, but easier to stay with.</li><li>Pick the setting by the largest loss you could live with, not by the best-looking profit column.</li></ul>`);

// P15 method + caveats
addPage(`<h2>How this was tested, and what it cannot tell you</h2>
${H3('Method')}<ul style="margin:4px 0 0;padding-left:18px"><li><b>Data:</b> real 4-hour candles for SOL, ZEC, NEAR and ADA from Binance futures, March 2020 to ${iso(lastX)}.</li><li><b>Rules (never changed during the test):</b> a 4-hour candle closes beyond the Bollinger Band (20, 2) in the direction of the 200-candle average; the stop is the middle band; the target is 4 times the stop distance; any trade still open after 48 candles (8 days) is closed. Entry on the next candle's open. Long and short.</li><li><b>Costs included:</b> exchange fees (0.05% entry and stop, 0.02% target), slippage (0.02%) and the real funding rate paid on every open trade.</li><li><b>One trade at a time per coin;</b> four coins can be open together, so up to 20% of the account is at risk at once at 5%.</li><li><b>Sizing:</b> “Fresh” risks a flat 5% of ₱5,000 (₱250) on every trade of the year. “Compounding” risks 5% of the balance on each 1 January.</li><li><b>Not included:</b> the 20% performance fee, tax, deposit and withdrawal costs, and anything that happens between the 4-hour candles.</li></ul>
${H3('What it cannot tell you')}<ul style="margin:4px 0 0;padding-left:18px"><li><b>The four coins were chosen after seeing results.</b> That makes the test look better than live trading is likely to be. The edge has been shrinking since 2021.</li><li><b>Real fills can be worse</b> in fast markets, especially on bigger positions. The compounding numbers get less realistic the larger the account.</li><li><b>Six and a half years is one market cycle.</b> A longer sideways or very different market is not in this data.</li><li><b>Calendar and weekday patterns are not reliable.</b> Tests show they are consistent with chance.</li><li><b>Backtests are simulations,</b> not a record of real trades.</li></ul>
<div class="note warn"><b>Past results do not guarantee future returns.</b> Only use money you can afford to lose. The test shows a system that made money in every year it was tested, but also one that regularly falls 20% to 50% below its high before recovering.</div>
${H3('Files')}<p class="sub">Built from the research engine in <b>research/bollinger/cmp5y.js</b> and <b>build-four-coin-report.js</b>. Related reports: <i>What ₱1,000 Could Have Become</i> (after the 20% fee).</p>`);

// ---------- stress test: the year's worst losing stretch comes FIRST, start P30,000, compounding on every trade ----------
const S0 = 30000;
const stSeg = (t) => { let cum = 0, pk = 0, pkIdx = -1, best = 0, bi = 0, bj = -1; for (let k = 0; k < t.length; k++) { cum += t[k].R; if (cum > pk) { pk = cum; pkIdx = k; } if (pk - cum > best) { best = pk - cum; bi = pkIdx + 1; bj = k; } } return { bi, bj, best, n: bj - bi + 1 }; };
const stFront = (t) => { const s = stSeg(t); return s.best > 0 ? [...t.slice(s.bi, s.bj + 1), ...t.slice(0, s.bi), ...t.slice(s.bj + 1)] : t; };
const stSim = (seq, bal0, rp) => { let bal = bal0, pk = bal0, low = bal0, ddp = 0; for (const x of seq) { bal *= 1 + x.R * rp; if (bal > pk) pk = bal; if (bal < low) low = bal; ddp = Math.max(ddp, (pk - bal) / pk); } return { end: bal, low, ddp }; };
function stRun(mode, fl, rp) {
  let bal = S0; const out = [];
  for (const y of YRS) { const t = TR.filter((x) => yr(x.x) === y), s0 = mode === 'chain' ? bal : S0, r = stSim(fl ? stFront(t) : t, s0, rp); out.push({ y, start: s0, ...r }); bal = r.end; }
  return { out, final: bal, lowAll: Math.min(...out.map((o) => o.low)) };
}
const ST = { fN: stRun('fresh', false, 0.05), fW: stRun('fresh', true, 0.05), cN: stRun('chain', false, 0.05), cW: stRun('chain', true, 0.05), fN25: stRun('fresh', false, 0.025), fW25: stRun('fresh', true, 0.025) };
const STSEG = YRS.map((y) => { const t = TR.filter((x) => yr(x.x) === y), s = stSeg(t), seg = t.slice(s.bi, s.bj + 1), w = seg.filter((x) => x.R > 0).length; return { y, n: s.n, losses: seg.length - w, wins: w, R: s.best, from: iso(seg[0].t), to: iso(seg[seg.length - 1].x) }; });
const stLow = (o) => `${PES(o.low)} <span class="${o.low < o.start ? 'neg' : 'flat'}">(${o.low < o.start ? '−' : ''}${((1 - o.low / o.start) * 100).toFixed(0)}%)</span>`;
const stTbl = (L, startCol = false) => tbl(startCol ? ['Year', 'Starts at', 'Lowest point', 'Worst drop from a high', 'Ends at', 'Return'] : ['Year', 'Lowest point', 'Worst drop from a high', 'Ends at', 'Return'],
  L.out.map((o) => [o.y, ...(startCol ? [PES(o.start)] : []), stLow(o), `<span class="neg">−${(o.ddp * 100).toFixed(0)}%</span>`, `<b>${PES(o.end)}</b>`, `<span class="pos">+${N0((o.end / o.start - 1) * 100)}%</span>`]));
const stWorst = (L) => L.out.reduce((a, o) => (o.low / o.start < a.low / a.start ? o : a));
const wN = stWorst(ST.fN), wW = stWorst(ST.fW), wW25 = stWorst(ST.fW25), wN25 = stWorst(ST.fN25);

addPage(`<h2>Worst-case start: a year's whole loss comes first</h2>${SUB('What if the worst losing stretch of every year hit on the very first trades, with no profit built up yet to cushion it? Start with ₱30,000, risk 5% of the current balance on every trade, and compound after every single trade.')}
<div class="kpis"><div class="kpi"><div class="v">${PES(S0)}</div><div class="k">Starting balance</div></div><div class="kpi"><div class="v neg">${PES(wN.low)}</div><div class="k">Lowest point, normal order (${wN.y})</div></div><div class="kpi"><div class="v neg">${PES(wW.low)}</div><div class="k">Lowest point, worst stretch first (${wW.y}, −${((1 - wW.low / wW.start) * 100).toFixed(0)}%)</div></div><div class="kpi"><div class="v">Same</div><div class="k">Final result either way</div></div></div>
<div class="note"><b>How the test works.</b> For each year we find the worst stretch of trades, the run from the account's highest point down to its lowest point that year. We move that whole stretch to the <b>start of the year</b> and keep every other trade in its original order after it. Every trade then risks 5% of the balance <b>at that moment</b>, so wins and losses compound trade by trade, not month by month or year by year. Nothing is invented: the trades, wins and losses are exactly the same ones, only the order changes.</div>
${H3('The worst stretch in each year')}${tbl(['Year', 'From', 'To', 'Trades in the stretch', 'Of which losses', 'Of which wins', 'Net loss in R'], STSEG.map((s) => [s.y, s.from, s.to, s.n, s.losses, s.wins, `<span class="neg">−${s.R.toFixed(1)}R</span>`]))}
<p class="sub" style="margin-top:4px">R = multiples of the amount risked. −10R at 5% per trade is about −40% of the account once compounded. The longest stretch is ${STSEG.reduce((a, s) => (s.n > a.n ? s : a)).y}: ${STSEG.reduce((a, s) => (s.n > a.n ? s : a)).n} trades over about two months.</p>
${H3('Fresh ₱30,000 every January, normal order (as it happened)')}${stTbl(ST.fN)}`);

addPage(`${H3('Fresh ₱30,000 every January, worst stretch first')}${stTbl(ST.fW)}
<p class="sub" style="margin-top:4px">Same trades, same final balance each year. Only the dip is different: the deepest point is reached on the first trades, with no earlier profit to soften it.</p>
${H3('The same test at 2.5% risk, worst stretch first')}${tbl(['Year', 'Lowest point', 'Worst drop from a high', 'Ends at', 'Return'], ST.fW25.out.map((o) => [o.y, stLow(o), `<span class="neg">−${(o.ddp * 100).toFixed(0)}%</span>`, `<b>${PES(o.end)}</b>`, `<span class="pos">+${N0((o.end / o.start - 1) * 100)}%</span>`]))}
`);

addPage(`${H3('Carried year to year, worst stretch first (5%)')}${stTbl(ST.cW, true)}
<p class="sub" style="margin-top:4px">Normal order ends at ${PES(ST.cN.final)}; worst-stretch-first ends at ${PES(ST.cW.final)}. <b>Identical.</b> These billions are not achievable: it assumes compounding every trade at 5% for six years with no limit on position size. They are shown only to prove that the order of trades does not change the end result.</p>
${H3('What this tells you')}<ul style="margin:4px 0 0;padding-left:18px"><li><b>The end result does not change, the ride does.</b> Compounding multiplies each trade's result, and multiplication has no order. What changes is how far the balance falls before it starts to recover.</li>
<li><b>Worst case at 5%:</b> the account falls to <b>${PES(wW.low)}</b> in ${wW.y}, a loss of <b>${((1 - wW.low / wW.start) * 100).toFixed(0)}%</b> of ${PES(S0)}, against ${PES(wN.low)} (${((1 - wN.low / wN.start) * 100).toFixed(0)}%) in the normal order.</li>
<li><b>Worst case at 2.5%:</b> ${PES(wW25.low)} in ${wW25.y} (−${((1 - wW25.low / wW25.start) * 100).toFixed(0)}%), so halving the risk cuts the worst-case loss from ${((1 - wW.low / wW.start) * 100).toFixed(0)}% to ${((1 - wW25.low / wW25.start) * 100).toFixed(0)}%.</li>
<li><b>Per-trade compounding protects the account from a wipe-out</b> because each loss is 5% of what is left. Losses get smaller as the balance falls, which is why the worst case stays under about ${(Math.ceil((1 - wW.low / wW.start) * 10) * 10)}% instead of reaching 100%. The trade-off is that gains also compound more slowly while the balance is down.</li>
<li><b>Sizing detail:</b> trades are sized one after another in the order they closed. In real trading two or three trades are often open at once and sized from the same balance, so a real run can fall slightly further than shown.</li></ul>`);

// ---------- assemble ----------
const src = fs.readFileSync(OUTDIR + '/backtest-data.html', 'utf8'), css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
const foot = (i) => `<div class="foot"><span>Past-price test, before the 20% fee. Not live trading. Past performance does not guarantee future results.</span><span>Page ${i + 1} of ${pages.length}</span></div>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="robots" content="noindex, nofollow, noarchive">
<title>The Four-Coin System at 5% Risk · Lucid'io</title><style>${css}
.sw{display:inline-block}
</style></head><body><a class="dlbtn" href="${DOWN}" download>Download PDF</a>${pages.map((p, i) => `<div class="page" id="p${i + 1}">${p}${foot(i)}</div>`).join('\n')}</body></html>`;
fs.writeFileSync(`${OUTDIR}/${SLUG}.html`, html);
console.log('pages', pages.length, 'html bytes', html.length);
if (process.argv.includes('--pdf')) {
  const url = 'file:///' + `${OUTDIR}/${SLUG}.html`.replace(/\\/g, '/');
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', `--print-to-pdf=${OUTDIR}/${SLUG}.pdf`, url], { stdio: 'ignore' });
  console.log('pdf written', fs.statSync(`${OUTDIR}/${SLUG}.pdf`).size);
}
// numbers for the chat summary
console.log(JSON.stringify({ totalNetF, finalC: C.final, finalC25: C25.final, fresh: F.years.map((y) => [y.y, Math.round(y.net), +(y.ddp * 100).toFixed(0), Math.round(y.low)]), comp: C.years.map((y) => [y.y, Math.round(y.end), Math.round(y.dd)]), f25: F25.years.map((y) => [y.y, Math.round(y.net), +(y.ddp * 100).toFixed(0), Math.round(y.low)]), pSeason, obs: Math.round(obs), startNeg: [negc('m1'), cnt('m1').length, negc('m3'), cnt('m3').length, negc('m6'), cnt('m6').length], neg12: all12.filter((o) => o.m12 < 0).length, n12: all12.length }));
