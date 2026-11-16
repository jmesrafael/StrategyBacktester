// engines/journal - the Daily Journal, streak reports, entry clusters and entry stamps.
// Answers "which kind of day makes or loses money for each bot" from recorded facts only.
//
// Inputs (through the spine): trades, market, events, headlines (optional).
// Outputs: dataset "derived/journal" (days.csv, stamps.csv, streaks.csv, clusters.csv, summary.json) and reports/journal.md.
//
// R of an open trade at time T = direction x (last known price - entry) / (entry - first stop). A closed trade keeps its recorded R.
// Every row for a day uses only data known at that day's end. opts.asOf replays the journal as of an earlier moment.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../../lib/spine'), cfg = require('../../lib/config'), U = require('../../lib/util'), M = require('../../lib/market');
const { knownAt } = require('../../ingest/headlines');
const { H, D } = U;

const DAYS = { day: 'string', bot: 'string', day_r: 'number', realized_r: 'number', open_n: 'int', entries_n: 'int', btc_day: 'number?', btc_7d: 'number?', phase: 'string', range_x: 'number?', shocks_down: 'int', shocks_up: 'int',
  mood: 'number?', mood_hindsight: 'number?', tags: 'string?' };
const STAMPS = { trade_key: 'string', bot: 'string', coin: 'string', side: 'string', entry_s: 'int', btc_24h: 'number?', btc_72h: 'number?', context: 'string', mood: 'number?', mood_hindsight: 'number?', tags: 'string?', r_now: 'number', status: 'string', reason: 'string?' };
const STREAKS = { bot: 'string', kind: 'string', from: 'string', to: 'string', days: 'int', total_r: 'number', btc_pct: 'number?', phases: 'string', avg_range_x: 'number?', shock_days: 'int', tags: 'string?' };
const CLUSTERS = { first_entry_s: 'int', entries: 'int', bots: 'string', coins: 'string', sides: 'string', btc_72h: 'number?', shocks_72h: 'string?', tags_72h: 'string?', live_r: 'number', live_won: 'int', live_lost: 'int' };

const ret = (coin, T, hours) => { const a = M.priceAt(coin, T - hours * H), b = M.priceAt(coin, T); return a && b ? (b / a - 1) * 100 : null; };
// R of a trade as known at time T
function rAt(t, T) {
  if (T < t.entry_s) return 0;
  if (t.exit_s != null && T >= t.exit_s) return t.r;
  const p = M.priceAt(t.coin, T); return p ? t.dir * (p - t.entry_price) / t.one_r : 0;
}

function build(opts = {}) {
  const asOf = opts.asOf || M.lastClose('BTC');
  // a replay as of an earlier time must not know about later exits: such a trade is open again at asOf
  const all = spine.load('trades', 'trades.csv').filter((t) => t.entry_s <= asOf).map((t) => (t.exit_s != null && t.exit_s > asOf ? { ...t, exit_s: null, r: null, status: 'open', reason: null } : t));
  const live = all.filter((t) => t.mode === 'live'), notes = [];
  const missing = [...new Set(live.map((t) => t.coin))].filter((c) => !M.has(c, '1h'));
  const ev = spine.load('events', 'events.jsonl').filter((e) => e.first_seen_at <= asOf);
  const shocks = ev.filter((e) => e.kind === 'price_shock' && e.asset === 'BTC'), tags = ev.filter((e) => e.kind === 'owner_tag');
  let heads = []; try { heads = spine.load('headlines', 'headlines.jsonl'); } catch (e) { notes.push('headlines not available: news mood left empty'); }
  // news mood in the 24h before T: bearish minus bullish market-impact stories, each weighted by strength/100.
  // strict = only labels that existed at T; hindsight = also stories whose label was computed later (shown for comparison only).
  const moodOf = (T, late) => { const k = knownAt(heads, T, { includeLate: late }).filter((h) => h.impact && h.first_seen_at > T - D && (late || !h.late_label)); if (!heads.length || (!late && !heads.some((h) => h.brief_generated_at <= T))) return null;
    return U.round(U.sum(k.map((h) => (h.bias === 'LONG' ? 1 : h.bias === 'SHORT' ? -1 : 0) * h.strength / 100)), 2); };
  const firstSeen = heads.length ? Math.min(...heads.map((h) => h.first_seen_at)) : Infinity;
  const tagsIn = (a, b) => tags.filter((e) => e.first_seen_at >= a && e.first_seen_at < b).map((e) => e.title);
  const tagsBefore = (T, hours) => tags.filter((e) => e.first_seen_at <= T && e.first_seen_at > T - hours * H).map((e) => e.title);
  const B = M.bars('BTC', '1h');
  const dayRange = (d0, d1) => { let hi = -Infinity, lo = Infinity; for (let t = d0; t < d1; t += H) { const i = (t - B[0][0]) / H; const b = B[i]; if (b && b[0] === t) { hi = Math.max(hi, b[2]); lo = Math.min(lo, b[3]); } } return hi > 0 ? hi / lo - 1 : null; };

  const start = live.length ? Math.floor(Math.min(...live.map((t) => t.entry_s)) / D) * D : asOf, days = [];
  const bots = ['ALL', ...new Set(live.map((t) => t.bot))];
  for (let d0 = start; d0 < asOf; d0 += D) {
    const d1 = Math.min(d0 + D, asOf), btc7 = ret('BTC', d1, 168), rng = dayRange(d0, d1), past = []; for (let k = 1; k <= 30; k++) { const r = dayRange(d0 - k * D, d0 - (k - 1) * D); if (r != null) past.push(r); }
    const sh = shocks.filter((s) => s.first_seen_at > d0 && s.first_seen_at <= d1);
    const common = { day: U.day(d0), btc_day: U.round(ret('BTC', d1, (d1 - d0) / H), 3), btc_7d: U.round(btc7, 3), phase: btc7 == null ? 'unknown' : btc7 <= -4 ? 'down' : btc7 >= 4 ? 'up' : 'sideways',
      range_x: rng != null && past.length ? U.round(rng / U.median(past), 3) : null, shocks_down: sh.filter((s) => s.direction === 'down').length, shocks_up: sh.filter((s) => s.direction === 'up').length,
      mood: moodOf(d1, false), mood_hindsight: d1 >= firstSeen ? moodOf(d1, true) : null, tags: tagsIn(d0, d1).join('; ') || null };
    for (const bot of bots) {
      const g = live.filter((t) => bot === 'ALL' || t.bot === bot);
      days.push({ ...common, bot, day_r: U.round(U.sum(g.map((t) => rAt(t, d1) - rAt(t, d0))), 4), realized_r: U.round(U.sum(g.filter((t) => t.exit_s != null && t.exit_s >= d0 && t.exit_s < d1).map((t) => t.r)), 4),
        open_n: g.filter((t) => t.entry_s < d1 && (t.exit_s == null || t.exit_s >= d1)).length, entries_n: g.filter((t) => t.entry_s >= d0 && t.entry_s < d1).length });
    }
  }
  // streaks: 3 or more days in a row with the same sign (a day within 0.05R of zero is flat and ends a streak)
  const streaks = [];
  for (const bot of bots) {
    let cur = null; const flush = () => { if (cur && cur.rows.length >= 3 && cur.kind !== 'flat') { const a = cur.rows, t0 = Date.parse(a[0].day) / 1000, t1 = Math.min(Date.parse(a[a.length - 1].day) / 1000 + D, asOf), p0 = M.priceAt('BTC', t0), p1 = M.priceAt('BTC', t1);
      streaks.push({ bot, kind: cur.kind, from: a[0].day, to: a[a.length - 1].day, days: a.length, total_r: U.round(U.sum(a.map((x) => x.day_r)), 3), btc_pct: p0 && p1 ? U.round((p1 / p0 - 1) * 100, 2) : null, phases: [...new Set(a.map((x) => x.phase))].join('/'),
        avg_range_x: U.round(U.mean(a.filter((x) => x.range_x != null).map((x) => x.range_x)), 2), shock_days: a.filter((x) => x.shocks_down + x.shocks_up > 0).length, tags: a.map((x) => x.tags).filter(Boolean).join('; ') || null }); } };
    for (const x of days.filter((r) => r.bot === bot)) { const kind = x.day_r > 0.05 ? 'profit' : x.day_r < -0.05 ? 'loss' : 'flat'; if (cur && cur.kind === kind) cur.rows.push(x); else { flush(); cur = { kind, rows: [x] }; } }
    flush();
  }
  // entry clusters: 3 or more entries (live and paper) inside 4 hours
  const clusters = [], sorted = [...all].sort((a, b) => a.entry_s - b.entry_s);
  for (let i = 0; i < sorted.length;) {
    let j = i; while (j + 1 < sorted.length && sorted[j + 1].entry_s - sorted[i].entry_s <= 4 * H) j++;
    const g = sorted.slice(i, j + 1);
    if (g.length >= 3) { const T = g[0].entry_s, lv = g.filter((t) => t.mode === 'live'), rs = lv.map((t) => rAt(t, asOf));
      clusters.push({ first_entry_s: T, entries: g.length, bots: [...new Set(g.map((t) => t.bot))].join(' '), coins: [...new Set(g.map((t) => t.coin))].join(' '), sides: [...new Set(g.map((t) => t.side))].join('/'), btc_72h: U.round(ret('BTC', T, 72), 2),
        shocks_72h: shocks.filter((s) => s.first_seen_at <= T && s.first_seen_at > T - 72 * H).map((s) => s.direction).join(',') || null, tags_72h: tagsBefore(T, 72).join('; ') || null, live_r: U.round(U.sum(rs), 3), live_won: rs.filter((r) => r > 0).length, live_lost: rs.filter((r) => r <= 0).length }); }
    i = j + 1;
  }
  // stamps: what was known at each live entry
  const stamps = live.map((t) => { const s72 = shocks.filter((s) => s.first_seen_at <= t.entry_s && s.first_seen_at > t.entry_s - 72 * H), dn = s72.some((s) => s.direction === 'down'), up = s72.some((s) => s.direction === 'up');
    return { trade_key: t.trade_key, bot: t.bot, coin: t.coin, side: t.side, entry_s: t.entry_s, btc_24h: U.round(ret('BTC', t.entry_s, 24), 2), btc_72h: U.round(ret('BTC', t.entry_s, 72), 2),
      context: dn && !up ? 'after down-shock' : up && !dn ? 'after up-shock' : dn && up ? 'after both' : 'quiet', mood: moodOf(t.entry_s, false), mood_hindsight: t.entry_s >= firstSeen ? moodOf(t.entry_s, true) : null,
      tags: tagsBefore(t.entry_s, 72).join('; ') || null, r_now: U.round(rAt(t, asOf), 4), status: t.status, reason: t.reason }; });
  const summary = { as_of: asOf, bots: {} };
  for (const bot of bots) { const g = live.filter((t) => bot === 'ALL' || t.bot === bot), c = g.filter((t) => t.status === 'closed'), o = g.filter((t) => t.status === 'open');
    summary.bots[bot] = { closed_n: c.length, closed_won: c.filter((t) => t.r > 0).length, closed_r: U.round(U.sum(c.map((t) => t.r)), 4), open_n: o.length, open_r: U.round(U.sum(o.map((t) => rAt(t, asOf))), 4), total_r: U.round(U.sum(g.map((t) => rAt(t, asOf))), 4) }; }
  return { asOf, days, streaks, clusters, stamps, summary, notes, missing };
}

function run(opts = {}) {
  const j = build(opts);
  const m = spine.write('derived/journal', { generator: 'engines/journal', inputs: ['trades', 'market', 'events'].concat(spine.exists('headlines') ? ['headlines'] : []).map(spine.ref),
    checks: [{ name: 'prices available for every traded coin', ok: j.missing.length === 0, detail: j.missing.length ? 'no clean 1h candles for: ' + j.missing.join(', ') : 'all coins priced' },
      { name: 'journal built', ok: j.days.length > 0, detail: `${j.days.filter((d) => d.bot === 'ALL').length} days as of ${U.iso(j.asOf)} UTC` }],
    notes: j.notes.concat(['open trades are valued from Binance prices with the first stop as 1R; the bots trade on MEXC, so open R is an estimate', 'mood = strict (labels known at the time); mood_hindsight also uses labels computed later and is for comparison only']),
    files: { 'days.csv': { rows: j.days, schema: DAYS }, 'stamps.csv': { rows: j.stamps, schema: STAMPS }, 'streaks.csv': { rows: j.streaks, schema: STREAKS }, 'clusters.csv': { rows: j.clusters, schema: CLUSTERS }, 'summary.json': { json: j.summary } } });
  if (m.status === 'ok' && !opts.noReport) report(j);
  return m;
}

function report(j) {
  const L = ['# Daily journal and streaks', '', `As of ${U.iso(j.asOf)} UTC. Live bots only. Open trades are estimates (Binance price, first stop = 1R).`, '', '## Result so far', ''];
  L.push(U.mdTable(Object.entries(j.summary.bots), [['Bot', (r) => r[0]], ['Closed', (r) => `${r[1].closed_n} (${r[1].closed_won} won)`], ['Closed R', (r) => U.signed(r[1].closed_r)], ['Open', (r) => r[1].open_n], ['Open R', (r) => U.signed(r[1].open_r)], ['Total R', (r) => U.signed(r[1].total_r)]]));
  const all = j.days.filter((d) => d.bot === 'ALL');
  L.push('', '## Days (all live bots)', '', U.mdTable(all, [['Day', (r) => r.day], ['Day R', (r) => U.signed(r.day_r)], ['Open', (r) => r.open_n], ['New', (r) => r.entries_n], ['BTC day', (r) => U.signed(r.btc_day, 1) + '%'], ['BTC 7d', (r) => U.signed(r.btc_7d, 1) + '%'], ['Phase', (r) => r.phase],
    ['Range vs normal', (r) => (r.range_x == null ? '-' : r.range_x.toFixed(1) + 'x')], ['Shocks down/up', (r) => `${r.shocks_down}/${r.shocks_up}`], ['News mood', (r) => (r.mood == null ? 'no data' : U.signed(r.mood, 1))], ['Tag', (r) => r.tags]]));
  L.push('', '## Streaks (3 or more days in a row)', '', j.streaks.length ? U.mdTable(j.streaks, [['Bot', (r) => r.bot], ['Kind', (r) => r.kind], ['Days', (r) => `${r.from} to ${r.to} (${r.days})`], ['Total R', (r) => U.signed(r.total_r)], ['BTC', (r) => U.signed(r.btc_pct, 1) + '%'], ['Phase', (r) => r.phases], ['Avg range', (r) => r.avg_range_x + 'x'], ['Shock days', (r) => r.shock_days], ['Tags', (r) => r.tags]]) : 'None yet.');
  const grp = (title, key) => { const m = new Map(); for (const x of all) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    L.push('', `### ${title}`, '', U.mdTable([...m], [[title, (r) => r[0]], ['Days', (r) => r[1].length], ['Total R', (r) => U.signed(U.sum(r[1].map((x) => x.day_r)))], ['Avg R per day', (r) => U.signed(U.mean(r[1].map((x) => x.day_r)))], ['Profit days', (r) => r[1].filter((x) => x.day_r > 0.05).length]])); };
  L.push('', '## What kind of day made or lost money');
  grp('BTC 7-day phase', (x) => x.phase); grp('Day range', (x) => (x.range_x == null ? 'unknown' : x.range_x >= 1.5 ? 'wide (1.5x or more)' : x.range_x <= 0.75 ? 'narrow (0.75x or less)' : 'normal'));
  grp('Price shock that day', (x) => (x.shocks_down ? 'down-shock' : x.shocks_up ? 'up-shock only' : 'none'));
  L.push('', '## Entry clusters (3 or more entries inside 4 hours)', '', j.clusters.length ? U.mdTable(j.clusters, [['First entry (UTC)', (r) => U.iso(r.first_entry_s)], ['Entries', (r) => r.entries], ['Bots', (r) => r.bots], ['Coins', (r) => r.coins], ['Side', (r) => r.sides], ['BTC 72h before', (r) => U.signed(r.btc_72h, 1) + '%'], ['Shocks 72h before', (r) => r.shocks_72h], ['Tags 72h before', (r) => r.tags_72h], ['Live R', (r) => U.signed(r.live_r)], ['Won / lost', (r) => `${r.live_won} / ${r.live_lost}`]]) : 'None.');
  const g2 = (title, key) => { const m = new Map(); for (const x of j.stamps) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    L.push('', `### ${title}`, '', U.mdTable([...m], [[title, (r) => r[0]], ['Entries', (r) => r[1].length], ['Total R', (r) => U.signed(U.sum(r[1].map((x) => x.r_now)))], ['Avg R', (r) => U.signed(U.mean(r[1].map((x) => x.r_now)))], ['Winners', (r) => r[1].filter((x) => x.r_now > 0).length]])); };
  L.push('', '## Entries grouped by what was known at entry');
  g2('Shock in the 72h before entry', (x) => x.context); g2('BTC 72h before entry', (x) => (x.btc_72h == null ? 'unknown' : x.btc_72h <= -3 ? 'falling (-3% or more)' : x.btc_72h >= 3 ? 'rising (+3% or more)' : 'flat')); g2('Bot', (x) => x.bot);
  L.push('', '## Limits', '', `- ${all.length} days is a description of one period, not evidence of a rule.`, '- Groups with few days or entries swing on single trades.');
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'journal.md'), L.join('\n') + '\n');
}
module.exports = { build, run, report, rAt };
if (require.main === module) { const m = run(); console.log('journal:', m.status, '-> reports/journal.md'); }
