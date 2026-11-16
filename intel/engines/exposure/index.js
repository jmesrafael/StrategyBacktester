// engines/exposure - the combined exposure monitor and stress test. OBSERVATION AND ALERTS ONLY.
// It never touches a bot. It answers: "how big is the one combined bet of all live bots right now?"
//
// For every open live position: risk_usd = risk_pct x equity of its bot at entry (the dollar amount lost at the first stop).
// signed risk s_i = direction x risk_usd. Effective bets = (sum |s_i|)^2 / (s' C s), C = correlation of the coins' 1h returns
// over the last 168h (positions on the same coin have correlation 1). 1 = everything is one bet, N = N independent bets.
// Alerts (config.json "exposure"): effective bets below alertEffectiveBets, or open net R beyond alertNetR.
// Stress: a BTC move of -10%/-5%/+5%/+10% moves each coin by its beta; each position's loss in R = move / stop distance.
// Outputs: dataset "derived/exposure" (history.csv every 4h, now.json, stress.csv, alerts.csv) and reports/exposure.md.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../../lib/spine'), cfg = require('../../lib/config'), U = require('../../lib/util'), M = require('../../lib/market');
const Corr = require('../correlation'), J = require('../journal');
const { H, D } = U;

// signed-risk vector, correlation matrix (same order) -> effective number of independent bets
function effectiveBets(s, C) {
  const gross = U.sum(s.map(Math.abs)); if (!gross) return null;
  let q = 0; for (let i = 0; i < s.length; i++) for (let j = 0; j < s.length; j++) q += s[i] * s[j] * C[i][j];
  return q > 0 ? (gross * gross) / q : null;
}
// positions: [{ coin, dir, risk_usd, entry, one_r }]; matrix: { coins, corr, cov }
const corrOf = (m, a, b) => (a === b ? 1 : (() => { const i = m.coins.indexOf(a), j = m.coins.indexOf(b); return i < 0 || j < 0 ? 0 : m.corr[i][j]; })());
function analyse(pos, m) {
  if (!pos.length) return { n: 0, gross_risk_usd: 0, net_risk_usd: 0, long_share: null, effective_bets: null, top_coin: null, top_coin_share: null };
  const s = pos.map((p) => p.dir * p.risk_usd), C = pos.map((a) => pos.map((b) => corrOf(m, a.coin, b.coin))), gross = U.sum(s.map(Math.abs)), byCoin = {};
  pos.forEach((p) => { byCoin[p.coin] = (byCoin[p.coin] || 0) + p.risk_usd; });
  const top = Object.entries(byCoin).sort((a, b) => b[1] - a[1])[0];
  return { n: pos.length, gross_risk_usd: U.round(gross, 2), net_risk_usd: U.round(U.sum(s), 2), long_share: U.round(U.sum(pos.filter((p) => p.dir === 1).map((p) => p.risk_usd)) / gross, 3),
    effective_bets: U.round(effectiveBets(s, C), 2), top_coin: top[0], top_coin_share: U.round(top[1] / gross, 3) };
}
// loss (negative) or gain in R and USD if BTC moves by btcPct percent, each coin moving beta x that (stop distance = one_r / entry)
function stress(pos, m, btcPct) {
  const bi = m.coins.indexOf('BTC'), out = [];
  for (const p of pos) { const i = m.coins.indexOf(p.coin); if (i < 0 || bi < 0) continue; const beta = m.cov[i][bi] / m.cov[bi][bi], move = beta * btcPct, r = p.dir * (move / 100) / (p.one_r / p.entry);
    out.push({ ...p, beta, move_pct: move, r, usd: r * p.risk_usd }); }
  return out;
}

function positionsAt(trades, wallets, T, asOf) {   // open live positions as known at T, with entry-time equity
  const eq = (bot, t) => { let best = null; for (const w of wallets) if (w.wallet === bot && !w.suspect && w.t <= t && (!best || w.t > best.t)) best = w; return best ? best.equity_usdt : null; };
  return trades.filter((t) => t.mode === 'live' && t.entry_s <= T && (t.exit_s == null || t.exit_s > T || t.exit_s > asOf)).map((t) => {
    const e = eq(t.bot, t.entry_s); return e != null && t.risk_pct ? { key: t.trade_key, bot: t.bot, coin: t.coin, dir: t.dir, risk_usd: t.risk_pct * e, entry: t.entry_price, one_r: t.one_r, t } : null; }).filter(Boolean);
}

const HIST = { t: 'int', n_open: 'int', gross_risk_usd: 'number', net_risk_usd: 'number', long_share: 'number?', effective_bets: 'number?', open_net_r: 'number', top_coin: 'string?', top_coin_share: 'number?', alert: 'string?' };
const STRESS = { scenario: 'string', bot: 'string', coin: 'string', side: 'string', move_pct: 'number', loss_r: 'number', loss_usd: 'number' };
const ALERT = { t: 'int', kind: 'string', detail: 'string' };

function build(opts = {}) {
  const asOf = opts.asOf || M.lastClose('BTC'), trades = spine.load('trades', 'trades.csv'), wallets = spine.load('trades', 'wallets.csv').filter((w) => w.t <= asOf), live = trades.filter((t) => t.mode === 'live');
  const start = Math.floor(Math.min(...live.map((t) => t.entry_s)) / D) * D, hist = [], alerts = [], mcache = new Map();
  const matrixAt = (T) => { const day = Math.floor(T / D) * D; if (!mcache.has(day)) mcache.set(day, Corr.latest(Math.min(day, asOf))); return mcache.get(day); };
  for (let T = start + D; T <= asOf; T += 4 * H) {
    const pos = positionsAt(trades, wallets, T, asOf), a = analyse(pos, matrixAt(T)), openR = U.sum(pos.map((p) => J.rAt(p.t, T)));
    let al = null; if (a.effective_bets != null && a.n >= 3 && a.effective_bets < cfg.exposure.alertEffectiveBets) al = `effective bets ${a.effective_bets} below ${cfg.exposure.alertEffectiveBets}`;
    if (Math.abs(openR) > cfg.exposure.alertNetR) al = (al ? al + '; ' : '') + `open net R ${U.round(openR, 1)} beyond +-${cfg.exposure.alertNetR}`;
    hist.push({ t: T, n_open: a.n, gross_risk_usd: a.gross_risk_usd, net_risk_usd: a.net_risk_usd, long_share: a.long_share, effective_bets: a.effective_bets, open_net_r: U.round(openR, 2), top_coin: a.top_coin, top_coin_share: a.top_coin_share, alert: al });
    if (al) alerts.push({ t: T, kind: 'exposure', detail: al });
  }
  const m = matrixAt(asOf), pos = positionsAt(trades, wallets, asOf, asOf), now = { as_of: asOf, ...analyse(pos, m), open_net_r: U.round(U.sum(pos.map((p) => J.rAt(p.t, asOf))), 2),
    by_bot: Object.fromEntries([...new Set(pos.map((p) => p.bot))].map((b) => [b, analyse(pos.filter((p) => p.bot === b), m)])), positions: pos.map((p) => ({ bot: p.bot, coin: p.coin, side: p.dir === 1 ? 'LONG' : 'SHORT', risk_usd: U.round(p.risk_usd, 2), r_now: U.round(J.rAt(p.t, asOf), 2) })) };
  const stressRows = [];
  for (const [name, mv] of [['BTC -10%', -10], ['BTC -5%', -5], ['BTC +5%', 5], ['BTC +10%', 10]]) for (const x of stress(pos, m, mv)) stressRows.push({ scenario: name, bot: x.bot, coin: x.coin, side: x.dir === 1 ? 'LONG' : 'SHORT', move_pct: U.round(x.move_pct, 2), loss_r: U.round(x.r, 2), loss_usd: U.round(x.usd, 2) });
  return { asOf, hist, alerts, now, stressRows };
}

function run(opts = {}) {
  const g = build(opts);
  const m = spine.write('derived/exposure', { generator: 'engines/exposure', inputs: [spine.ref('trades'), spine.ref('market'), spine.ref('derived/correlation')].filter((x) => x),
    checks: [{ name: 'exposure history built', ok: g.hist.length > 0, detail: `${g.hist.length} points, ${g.alerts.length} alert points` }],
    notes: ['observation and alerts only: no output of this engine is read by any bot', 'risk_usd = risk fraction x bot equity at entry; open R is valued from Binance prices (estimate)'],
    files: { 'history.csv': { rows: g.hist, schema: HIST }, 'now.json': { json: g.now }, 'stress.csv': { rows: g.stressRows, schema: STRESS }, 'alerts.csv': { rows: g.alerts, schema: ALERT } } });
  const n = g.now, L = ['# Combined exposure (alert-only)', '', `As of ${U.iso(g.asOf)} UTC. Live bots only. Nothing here changes a trade.`, '', '## Now', '',
    `${n.n} open positions. Gross risk $${n.gross_risk_usd}, net risk $${n.net_risk_usd} (${Math.round((n.long_share || 0) * 100)}% long). **Effective independent bets: ${n.effective_bets}** (1 = one single bet, ${n.n} = all independent). Open net R ${U.signed(n.open_net_r)}. Largest coin: ${n.top_coin} (${Math.round((n.top_coin_share || 0) * 100)}% of risk).`, '',
    U.mdTable(Object.entries(n.by_bot), [['Bot', (x) => x[0]], ['Positions', (x) => x[1].n], ['Gross risk $', (x) => x[1].gross_risk_usd], ['Effective bets', (x) => x[1].effective_bets], ['Long share', (x) => Math.round(x[1].long_share * 100) + '%']]), '',
    '## Stress: what a BTC move would do to the open positions', '', U.mdTable(['BTC -10%', 'BTC -5%', 'BTC +5%', 'BTC +10%'].map((s) => ({ s, rows: g.stressRows.filter((x) => x.scenario === s) })), [['Scenario', (x) => x.s], ['Total R', (x) => U.signed(U.sum(x.rows.map((r) => r.loss_r)))], ['Total USD', (x) => U.signed(U.sum(x.rows.map((r) => r.loss_usd)))], ['Worst position', (x) => { const w = [...x.rows].sort((a, b) => a.loss_r - b.loss_r)[0]; return w ? `${w.bot} ${w.coin} ${U.signed(w.loss_r)}R` : '-'; }]]), '',
    'Each coin moves by its beta to BTC (from the last 168h). Loss in R = coin move / stop distance. A move that reaches a stop shows about -1R for that position.', '', '## History of the alert thresholds', '',
    `Alert points: ${g.alerts.length} of ${g.hist.length}. First: ${g.alerts.length ? U.iso(g.alerts[0].t) : 'none'}.`, '', U.mdTable(g.hist.filter((x, i) => i % 6 === 0), [['Time (UTC)', (x) => U.iso(x.t)], ['Open', (x) => x.n_open], ['Gross $', (x) => x.gross_risk_usd], ['Long share', (x) => (x.long_share == null ? '-' : Math.round(x.long_share * 100) + '%')], ['Effective bets', (x) => x.effective_bets], ['Open net R', (x) => U.signed(x.open_net_r)], ['Alert', (x) => x.alert]]), '',
    '## Limits', '', '- Correlation changes quickly in a sell-off, and this uses the last 7 days only.', '- Thresholds are first guesses in config.json; the history shows how often each would have fired. They are not tuned.'];
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'exposure.md'), L.join('\n') + '\n');
  return m;
}
module.exports = { effectiveBets, analyse, stress, positionsAt, build, run };
if (require.main === module) { const m = run(); console.log('exposure:', m.status, '-> reports/exposure.md'); }
