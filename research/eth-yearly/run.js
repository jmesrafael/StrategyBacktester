// ETH (and the 5 bot coins) through the three TRI-CORE bots, split by year, coin and strategy.
//   node research/eth-yearly/run.js   -> trades.json + REPORT.md
// Uses the strat-hunt-nov6 engine (bot rules, real fees, slippage and Binance funding). 4h chart.
'use strict';
const fs = require('fs'), path = require('path');
const HUNT = path.join(__dirname, '..', 'strat-hunt-nov6');
const { run } = require(path.join(HUNT, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(HUNT, 'strategies.js'));
const DATA = path.join(__dirname, '..', 'indicator-top10');
const FUND = [path.join(__dirname, '..', '..', '..', '🔴BB-Core', 'data', 'funding'), path.join(DATA, 'funding')];
const COINS = ['ETH', 'SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const BOTS = { 'BB-CORE': ['bb-core', 'BBX'], 'I-CORE': ['i-core', 'P7'], 'T-CORE': ['bb-trail', 'P14'] };
const RISK = 0.01; // % columns = R x 1% risk, not compounded

function load(coin) {
  const B = JSON.parse(fs.readFileSync(path.join(DATA, 'data4h', coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  for (let i = 1; i < B.length; i++) if (B[i].time - B[i - 1].time !== 14400) throw new Error(coin + ' gap at ' + B[i].time);
  const f = FUND.map((d) => path.join(d, coin + '.json')).find((p) => fs.existsSync(p));
  return { B, funding: f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null, fundFile: f };
}

const T = {}, meta = {};
for (const coin of COINS) {
  const { B, funding, fundFile } = load(coin), c = makeCtx(B, '4h');
  meta[coin] = { from: B[0].time, to: B[B.length - 1].time, funding: !!fundFile };
  for (const [bot, [id, prof]] of Object.entries(BOTS)) {
    const st = S.find((s) => s.id === id).build(c), strat = prof.startsWith('BB') ? st : { ...st, stopL: null, stopS: null };
    T[bot + '|' + coin] = run(B, c.atr14, strat, exitOf(prof, c), funding, 14400).trades.map((t) => ({ t: t.t, tExit: t.tExit, R: t.R, dir: t.dir, bars: t.bars, why: t.why }));
  }
}

// ---------- stats (trades counted in the year / month they close)
const ym = (t) => { const d = new Date(t * 1000); return [d.getUTCFullYear(), d.getUTCMonth()]; };
function stats(tr) {
  tr = [...tr].sort((a, b) => a.tExit - b.tExit);
  let eq = 0, pk = 0, dd = 0, gp = 0, gl = 0, w = 0, streak = 0, maxStreak = 0;
  const months = {};
  for (const t of tr) {
    eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq);
    if (t.R > 0) { gp += t.R; w++; streak = 0; } else { gl -= t.R; maxStreak = Math.max(maxStreak, ++streak); }
    const [y, m] = ym(t.tExit), k = y * 12 + m; months[k] = (months[k] || 0) + t.R;
  }
  const n = tr.length, mv = Object.values(months);
  return {
    n, R: eq, win: n ? w / n : 0, pf: gl ? gp / gl : (gp ? Infinity : 0), exp: n ? eq / n : 0, dd,
    avgW: w ? gp / w : 0, avgL: n - w ? gl / (n - w) : 0, streak: maxStreak, long: tr.filter((t) => t.dir === 1).length,
    months, mBest: mv.length ? Math.max(...mv) : 0, mWorst: mv.length ? Math.min(...mv) : 0, mLose: mv.filter((v) => v < 0).length,
  };
}
const byYear = (tr) => { const o = {}; for (const t of tr) (o[ym(t.tExit)[0]] = o[ym(t.tExit)[0]] || []).push(t); return o; };
// months counted from the first month the coin can trade (after the 200-SMA warm-up) to the last full data month
function monthSpan(coin, y) {
  const first = ym(meta[coin].from + 205 * 14400), last = ym(meta[coin].to);
  const a = y === first[0] ? first[1] : y < first[0] ? 12 : 0, b = y === last[0] ? last[1] : y > last[0] ? -1 : 11;
  return Math.max(0, b - a + 1);
}

// ---------- report
const f1 = (x) => (x > 0 ? '+' : '') + x.toFixed(1), f2 = (x) => (x > 0 ? '+' : '') + x.toFixed(2), pc = (x) => (x * 100).toFixed(0) + '%';
const pf = (x) => (x === Infinity ? '∞' : x.toFixed(2)), pct = (r) => f1(r * RISK * 100) + '%';
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const out = { generated: new Date().toISOString(), meta, bots: BOTS, trades: T };
fs.writeFileSync(path.join(__dirname, 'trades.json'), JSON.stringify(out));

let md = `# ETH on the three TRI-CORE bots — year by year\n\nGenerated ${out.generated.slice(0, 16)} UTC. 4h chart. Engine: research/strat-hunt-nov6 (the bots' own rules, ` +
  `0.05% fee each side, 0.02% slippage per fill, real Binance funding). ETH candles ${new Date(meta.ETH.from * 1000).toISOString().slice(0, 10)} → ${new Date(meta.ETH.to * 1000).toISOString().slice(0, 10)} ` +
  `(first ~34 days are the 200-SMA warm-up). Trades and months are counted when the trade closes. **% columns = R × ${RISK * 100}% risk per trade, simple (not compounded).** ` +
  `DD = deepest peak-to-trough drop of the R curve (inside that year for yearly rows). 2026 runs to Nov 5.\n\n` +
  `- **BB-CORE** — Bollinger(20,2) close-through with the 200-SMA, stop = middle band, 48-candle time exit\n- **I-CORE** — Ichimoku cloud break with the 200-SMA, 2 ATR stop, 7 ATR trail\n- **T-CORE** — BB-CORE entry, 2 ATR stop, 14 ATR trail\n`;

const yearHead = `| year | trades | win | PF | exp R | total R | ≈ % @1% | max DD R | losing months | best mo R | worst mo R | max loss streak | avg win R | avg loss R | long/short |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
const yearRow = (lbl, s, months) => `| ${lbl} | ${s.n} | ${pc(s.win)} | ${pf(s.pf)} | ${f2(s.exp)} | ${f1(s.R)} | ${pct(s.R)} | ${s.dd.toFixed(1)} | ${s.mLose}/${months} | ${f1(s.mBest)} | ${f1(s.mWorst)} | ${s.streak} | ${s.avgW.toFixed(2)} | ${s.avgL.toFixed(2)} | ${s.long}/${s.n - s.long} |\n`;
const verdict = {};

md += `\n## 1. ETH — each strategy, each year\n`;
for (const bot of Object.keys(BOTS)) {
  const tr = T[bot + '|ETH'], Y = byYear(tr), all = stats(tr);
  md += `\n### ${bot} on ETH\n\n` + yearHead;
  let losingYears = 0, totM = 0;
  for (const y of Object.keys(Y).sort()) { const s = stats(Y[y]), m = monthSpan('ETH', +y); totM += m; if (s.R < 0) losingYears++; md += yearRow(y, s, m); }
  md += yearRow('**all**', all, totM);
  verdict[bot] = { all, losingYears, years: Object.keys(Y).length, totM };
}

md += `\n## 2. ETH monthly R grid (zero-trade months shown as ·)\n`;
for (const bot of Object.keys(BOTS)) {
  const s = stats(T[bot + '|ETH']), years = [...new Set(Object.keys(s.months).map((k) => Math.floor(k / 12)))].sort();
  md += `\n### ${bot}\n\n| year | ${MN.join(' | ')} | year R |\n|---|${MN.map(() => '---').join('|')}|---|\n`;
  for (const y of years) {
    let tot = 0;
    const cells = MN.map((_, m) => { const v = s.months[y * 12 + m]; if (v == null) return '·'; tot += v; return v < 0 ? `**${f1(v)}**` : f1(v); });
    md += `| ${y} | ${cells.join(' | ')} | ${f1(tot)} |\n`;
  }
}

md += `\n## 3. Every coin, every strategy — totals (for comparison with ETH)\n\n| strategy | coin | data from | trades | win | PF | exp R | total R | max DD R | losing years | losing months |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const bot of Object.keys(BOTS)) for (const coin of COINS) {
  const tr = T[bot + '|' + coin], s = stats(tr), Y = byYear(tr), ly = Object.values(Y).filter((v) => stats(v).R < 0).length;
  const totM = Object.keys(Y).reduce((a, y) => a + monthSpan(coin, +y), 0);
  md += `| ${bot} | ${coin === 'ETH' ? '**ETH**' : coin} | ${new Date(meta[coin].from * 1000).toISOString().slice(0, 7)} | ${s.n} | ${pc(s.win)} | ${pf(s.pf)} | ${f2(s.exp)} | ${f1(s.R)} | ${s.dd.toFixed(1)} | ${ly}/${Object.keys(Y).length} | ${s.mLose}/${totM} |\n`;
}

md += `\n## 4. Year × coin — total R per strategy\n`;
for (const bot of Object.keys(BOTS)) {
  const yrs = [...new Set(COINS.flatMap((c) => Object.keys(byYear(T[bot + '|' + c]))))].sort();
  md += `\n### ${bot}\n\n| coin | ${yrs.join(' | ')} | total |\n|---|${yrs.map(() => '---').join('|')}|---|\n`;
  for (const coin of COINS) {
    const Y = byYear(T[bot + '|' + coin]);
    md += `| ${coin === 'ETH' ? '**ETH**' : coin} | ${yrs.map((y) => (Y[y] ? (stats(Y[y]).R < 0 ? `**${f1(stats(Y[y]).R)}**` : f1(stats(Y[y]).R)) : '–')).join(' | ')} | ${f1(stats(T[bot + '|' + coin]).R)} |\n`;
  }
}

md += `\n## 5. ETH — all three bots together (equal 1R each, one trade per bot)\n\n` + yearHead;
const comb = Object.keys(BOTS).flatMap((b) => T[b + '|ETH']), CY = byYear(comb);
let cm = 0;
for (const y of Object.keys(CY).sort()) { const m = monthSpan('ETH', +y); cm += m; md += yearRow(y, stats(CY[y]), m); }
md += yearRow('**all**', stats(comb), cm);

fs.writeFileSync(path.join(__dirname, 'REPORT.md'), md);
fs.writeFileSync(path.join(__dirname, 'verdict.json'), JSON.stringify(verdict, (k, v) => (k === 'months' ? undefined : v), 1));
console.log(md);
