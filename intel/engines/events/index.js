// engines/events - the Event Ledger, the reaction measurements and the Event Study.
//
//   detectShocks()   price shocks from 1h candles (a move at least minZ times normal, on at least minVolRatio times normal volume)
//   buildLedger()    dataset "events": append-only, hash-chained log of shocks, scheduled releases, owner tags and strong headlines
//   buildReactions() dataset "derived/event-reactions": what BTC and the event's own coin did 1h, 24h, 72h and 7d later
//   buildStudy()     dataset "derived/event-study": for each kind of event, the distribution of what followed, against the baseline
//   similar()        the past shock episodes most like a given one, and what followed them
//
// No-lookahead rules: a shock exists only once its bar has closed; a reaction is measured from the last price known
// at first_seen_at; a horizon that has not finished yet is left empty, never estimated.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../../lib/spine'), cfg = require('../../lib/config'), U = require('../../lib/util'), M = require('../../lib/market');
const { H, D } = U;
const HORIZONS = { r_1h: 1, r_24h: 24, r_72h: 72, r_7d: 168 };

// ---------- shocks ----------
// rows: [openTime, o, h, l, c, v]. "Normal size" = root mean square of the previous `lookbackBars` 1h log returns (open to close).
// "Normal volume" = median volume of the same bars. Returns one object per shock bar, time = the bar's CLOSE (when it is known).
function detectShocks(rows, { lookbackBars = 720, minZ = 3, minVolRatio = 2 } = {}) {
  const out = [], n = rows.length, r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = Math.log(rows[i][4] / rows[i][1]);
  let ss = 0;
  for (let i = 0; i < n; i++) {
    if (i >= lookbackBars) {
      const rms = Math.sqrt(ss / lookbackBars), z = rms > 0 ? r[i] / rms : 0;
      if (Math.abs(z) >= minZ) {
        const vols = []; for (let j = i - lookbackBars; j < i; j++) vols.push(rows[j][5]);
        const med = U.median(vols), vr = med > 0 ? rows[i][5] / med : 0;
        if (vr >= minVolRatio) out.push({ t: rows[i][0] + H, z: U.round(z, 3), vol_ratio: U.round(vr, 3), pct: U.round((rows[i][4] / rows[i][1] - 1) * 100, 3), dir: z < 0 ? 'down' : 'up' });
      }
      ss -= r[i - lookbackBars] ** 2;
    }
    ss += r[i] ** 2;
  }
  return out;
}
// an episode = shocks of one asset less than 24h apart. Only the first shock of an episode starts a study sample.
function withEpisodes(shocks, asset) {
  let ep = null, last = -Infinity;
  return shocks.map((s) => { const first = s.t - last > 24 * H; if (first) ep = `${asset}-${s.t}`; last = s.t; return { ...s, asset, episode_id: ep, episode_first: first }; });
}

// ---------- ledger ----------
const LEDGER = { event_id: 'string', kind: 'string', subtype: 'string?', asset: 'string', title: 'string', direction: 'string?', event_time: 'int?', published_at: 'int?', first_seen_at: 'int', usable_at: 'int',
  recorded_at: 'int', backfilled: 'bool', time_precision: 'string?', magnitude: 'json', episode_id: 'string?', episode_first: 'bool?', source: 'string?', link: 'string?', note: 'string?', seq: 'int', prev_hash: 'string', row_hash: 'string' };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
const schedType = (name) => (/core cpi|cpi/i.test(name) ? 'CPI' : /non-farm|nfp|employment change/i.test(name) ? 'NFP' : /fomc|federal funds|fed /i.test(name) ? 'FOMC' : /pce/i.test(name) ? 'PCE' : /ppi/i.test(name) ? 'PPI' : /gdp/i.test(name) ? 'GDP' : 'other');

function candidates(now) {
  const out = [], notes = [];
  // 1. price shocks, every market coin. BTC shocks are the market-wide ones.
  for (const coin of cfg.marketCoins) {
    if (!M.has(coin, '1h')) { notes.push(`${coin}: no clean 1h series, shocks skipped`); continue; }
    for (const s of withEpisodes(detectShocks(M.bars(coin, '1h'), cfg.shock), coin))
      out.push({ event_id: `shock:${coin}:${s.t}`, kind: 'price_shock', subtype: coin === 'BTC' ? 'market' : 'coin', asset: coin, title: `${coin} 1h ${s.dir} shock ${s.pct}%`, direction: s.dir, event_time: s.t - H, published_at: null,
        first_seen_at: s.t, usable_at: s.t, time_precision: 'exact (bar close)', magnitude: { z: s.z, vol_ratio: s.vol_ratio, pct: s.pct }, episode_id: s.episode_id, episode_first: s.episode_first,
        source: 'candle library (Binance perps 1h)', link: null, note: null });
  }
  // 2. scheduled releases (Pulse calendar history)
  const pe = cfg.path(cfg.pulseEvents);
  if (fs.existsSync(pe)) for (const e of JSON.parse(fs.readFileSync(pe, 'utf8'))) {
    if (!e || !e.name || !Number.isFinite(e.t)) continue;
    out.push({ event_id: `sched:${slug(e.name)}:${e.t}`, kind: 'scheduled', subtype: schedType(e.name), asset: 'BTC', title: e.name, direction: null, event_time: e.t, published_at: e.t, first_seen_at: e.t, usable_at: e.t,
      time_precision: 'exact (scheduled release)', magnitude: {}, episode_id: null, episode_first: null, source: 'Pulse events-history.json (ForexFactory calendar)', link: null, note: 'The date was known in advance; first_seen_at is the release moment.' });
  } else notes.push('Pulse events-history.json not found: scheduled releases skipped');
  // 3. owner tags (hand-written file)
  const tf = cfg.path(cfg.ownerTags);
  if (fs.existsSync(tf)) for (const r of U.parseCsv(fs.readFileSync(tf, 'utf8'))) {
    const fs_ = U.toSec(r.first_seen_at_utc); if (!r.tag || fs_ == null) continue;
    out.push({ event_id: `owner:${slug(r.tag)}:${fs_}`, kind: 'owner_tag', subtype: r.type || null, asset: 'BTC', title: r.tag, direction: r.direction || null, event_time: U.toSec(r.event_time_utc), published_at: U.toSec(r.published_at_utc),
      first_seen_at: fs_, usable_at: fs_, time_precision: r.time_precision || null, magnitude: {}, episode_id: null, episode_first: null, source: 'owner tag (inputs/owner-tags.csv)', link: r.source_url || null, note: r.note || null });
  }
  // 4. strong market-impact headlines from the archive. The label is usable only from the brief that produced it.
  if (spine.exists('headlines')) {
    try {
      const first = new Map();
      for (const h of spine.load('headlines', 'headlines.jsonl')) if (h.impact && h.strength >= 60 && h.bias !== 'NEUTRAL' && !first.has(h.id)) first.set(h.id, h);
      for (const h of first.values()) out.push({ event_id: `headline:${h.id}`, kind: 'headline', subtype: h.category, asset: 'BTC', title: h.title, direction: h.bias === 'SHORT' ? 'bearish' : 'bullish', event_time: null, published_at: h.published_at,
        first_seen_at: h.first_seen_at, usable_at: Math.max(h.first_seen_at, h.brief_generated_at), time_precision: 'minute (Pulse first seen)', magnitude: { strength: h.strength, stories: h.story_count, label_known_at: h.brief_generated_at },
        episode_id: null, episode_first: null, source: 'headline archive (Pulse, keyword label)', link: h.link, note: null });
    } catch (e) { notes.push('headlines not usable: ' + e.message); }
  }
  // an event enters the ledger only once it has happened (a release scheduled for next week is not an event yet)
  const past = out.filter((r) => r.first_seen_at <= now); out.length = 0; out.push(...past);
  for (const r of out) { r.recorded_at = now; r.backfilled = now - r.first_seen_at > 2 * H; }
  out.sort((a, b) => a.first_seen_at - b.first_seen_at || (a.event_id < b.event_id ? -1 : 1));
  return { out, notes };
}

function buildLedger(opts = {}) {
  const now = opts.now || Math.floor(Date.now() / 1000), f = path.join(spine.dir('events'), 'events.jsonl');
  const existing = fs.existsSync(f) ? U.parseJsonl(fs.readFileSync(f, 'utf8')) : [], broken = spine.chainVerify(existing);
  const checks = [{ name: 'ledger intact (hash chain)', ok: broken == null, detail: broken == null ? `${existing.length} stored rows verified` : `row ${broken} was altered or removed: nothing is appended until this is resolved (restore from backup)` }];
  let all = existing, added = 0, notes = [];
  if (broken == null) {
    const c = candidates(now), have = new Set(existing.map((r) => r.event_id)), fresh = c.out.filter((r) => !have.has(r.event_id));
    notes = c.notes; added = fresh.length; all = spine.chainAppend(existing, fresh, LEDGER);
  }
  const kinds = {}; for (const r of all) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  return spine.write('events', { generator: 'engines/events (buildLedger)', checks, inputs: [spine.ref('market')].concat(spine.exists('headlines') ? [spine.ref('headlines')] : []),
    source: { kind: 'derived from candles + Pulse calendar + owner tags + headline archive' },
    notes: notes.concat([`${added} new events appended`, `by kind: ${JSON.stringify(kinds)}`, 'rows with backfilled=true were written after the fact; rows recorded live from now on have backfilled=false']),
    files: { 'events.jsonl': { rows: all, schema: LEDGER } } });
}

// ---------- reactions ----------
const REACT = { event_id: 'string', kind: 'string', subtype: 'string?', asset: 'string', measured: 'string', direction: 'string?', first_seen_at: 'int', base_t: 'int', base_price: 'number', pre_24h: 'number?', pre_72h: 'number?',
  r_1h: 'number?', r_24h: 'number?', r_72h: 'number?', r_7d: 'number?', episode_first: 'bool?', z: 'number?', vol_ratio: 'number?' };
// forward return in % of `coin` from the last price known at T to `hours` later; null when that bar has not closed yet (asOf)
function reaction(coin, T, asOf) {
  const base_t = Math.floor(T / H) * H, p0 = M.priceAt(coin, base_t); if (p0 == null) return null;
  const at = (h) => { const t = base_t + h * H; if (t > asOf) return null; const p = M.priceAt(coin, t); return p == null ? null : U.round((p / p0 - 1) * 100, 4); };
  const before = (h) => { const p = M.priceAt(coin, base_t - h * H); return p == null ? null : U.round((p0 / p - 1) * 100, 4); };   // the move over the h hours BEFORE the event
  const o = { base_t, base_price: p0, pre_24h: before(24), pre_72h: before(72) };
  for (const [k, h] of Object.entries(HORIZONS)) o[k] = at(h);
  return o;
}
function buildReactions(opts = {}) {
  const ev = spine.load('events', 'events.jsonl'), asOf = opts.asOf || M.lastClose('BTC'), rows = [];
  for (const e of ev) {
    if (e.first_seen_at > asOf) continue;
    for (const coin of [...new Set(['BTC', e.asset])]) {
      if (!M.has(coin, '1h')) continue;
      const r = reaction(coin, e.first_seen_at, asOf); if (!r) continue;
      rows.push({ event_id: e.event_id, kind: e.kind, subtype: e.subtype, asset: e.asset, measured: coin, direction: e.direction, first_seen_at: e.first_seen_at, ...r, episode_first: e.episode_first, z: e.magnitude.z == null ? null : e.magnitude.z, vol_ratio: e.magnitude.vol_ratio == null ? null : e.magnitude.vol_ratio });
    }
  }
  return spine.write('derived/event-reactions', { generator: 'engines/events (buildReactions)', inputs: [spine.ref('events'), spine.ref('market')],
    checks: [{ name: 'reactions measured', ok: rows.length > 0, detail: `${rows.length} rows as of ${U.iso(asOf)} UTC` }],
    notes: ['returns are in percent, from the last closed 1h bar at or before first_seen_at', 'a horizon that had not finished at the as-of time is empty'],
    files: { 'reactions.csv': { rows, schema: REACT } } });
}

// ---------- study ----------
const STUDY = { group: 'string', measured: 'string', horizon: 'string', n: 'int', n_nonoverlap: 'int', mean: 'number', median: 'number', p10: 'number', p90: 'number', share_down: 'number', mean_abs: 'number',
  base_mean: 'number', base_mean_abs: 'number', diff_mean: 'number', diff_ci_lo: 'number', diff_ci_hi: 'number', n_before_2024: 'int', mean_before_2024: 'number?', n_from_2024: 'int', mean_from_2024: 'number?', verdict: 'string' };
const CUT = Date.UTC(2024, 0, 1) / 1000;
// unconditional forward returns of a coin at every hour: the baseline an event group is compared with
const baseCache = new Map();
function baseline(coin, hours) {
  const k = coin + hours; if (baseCache.has(k)) return baseCache.get(k);
  const rows = M.bars(coin, '1h'), out = [];
  for (let i = 0; i + hours < rows.length; i++) out.push((rows[i + hours][4] / rows[i][4] - 1) * 100);
  const v = { mean: U.mean(out), meanAbs: U.mean(out.map(Math.abs)) }; baseCache.set(k, v); return v;
}
function groupStat(group, measured, key, rows, seed = 7) {
  const hours = HORIZONS[key], xs = rows.filter((r) => r[key] != null), v = xs.map((r) => r[key]); if (v.length < 1) return null;
  let last = -Infinity, nn = 0; for (const r of xs) if (r.base_t - last >= hours * H) { nn++; last = r.base_t; }   // samples whose windows do not overlap
  const b = baseline(measured, hours), rnd = U.rng(seed), boots = [];
  for (let k = 0; k < 1000; k++) { let s = 0; for (let i = 0; i < v.length; i++) s += v[Math.floor(rnd() * v.length)]; boots.push(s / v.length - b.mean); }
  const lo = U.quantile(boots, 0.025), hi = U.quantile(boots, 0.975), pre = xs.filter((r) => r.base_t < CUT).map((r) => r[key]), post = xs.filter((r) => r.base_t >= CUT).map((r) => r[key]);
  const diff = U.mean(v) - b.mean, sameSign = pre.length >= 20 && post.length >= 20 && Math.sign(U.mean(pre) - b.mean) === Math.sign(U.mean(post) - b.mean);
  const verdict = nn < 30 ? 'too few samples' : lo > 0 || hi < 0 ? (sameSign ? 'differs from baseline, both periods agree' : 'differs from baseline, periods disagree or too short') : 'not different from baseline';
  return { group, measured, horizon: key, n: v.length, n_nonoverlap: nn, mean: U.round(U.mean(v), 3), median: U.round(U.median(v), 3), p10: U.round(U.quantile(v, 0.1), 3), p90: U.round(U.quantile(v, 0.9), 3),
    share_down: U.round(v.filter((x) => x < 0).length / v.length, 3), mean_abs: U.round(U.mean(v.map(Math.abs)), 3), base_mean: U.round(b.mean, 3), base_mean_abs: U.round(b.meanAbs, 3), diff_mean: U.round(diff, 3),
    diff_ci_lo: U.round(lo, 3), diff_ci_hi: U.round(hi, 3), n_before_2024: pre.length, mean_before_2024: pre.length ? U.round(U.mean(pre), 3) : null, n_from_2024: post.length, mean_from_2024: post.length ? U.round(U.mean(post), 3) : null, verdict };
}
function buildStudy() {
  const R = spine.load('derived/event-reactions', 'reactions.csv'), groups = new Map(), seenSched = new Set();
  const add = (g, measured, r) => { const k = g + '|' + measured; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); };
  for (const r of R) {
    if (r.kind === 'price_shock' && r.episode_first) {
      const big = Math.abs(r.z) >= 5 ? 'large (5x+)' : 'medium (3-5x)';
      if (r.asset === 'BTC' && r.measured === 'BTC') { add(`BTC ${r.direction} shock, all`, 'BTC', r); add(`BTC ${r.direction} shock, ${big}`, 'BTC', r); }
      if (r.asset !== 'BTC' && r.measured === r.asset) add(`alt-coin ${r.direction} shock (own coin, pooled)`, 'own coin', r);
    } else if (r.kind === 'scheduled' && r.measured === 'BTC') { const k = r.subtype + r.base_t; if (seenSched.has(k)) continue; seenSched.add(k); add(`scheduled: ${r.subtype}`, 'BTC', r); }   // several lines of one release (CPI m/m, y/y, core) count once
    else if (r.kind === 'headline' && r.measured === 'BTC') add(`headline labelled ${r.direction}`, 'BTC', r);
    else if (r.kind === 'owner_tag' && r.measured === 'BTC') add('owner tags (all)', 'BTC', r);
  }
  const rows = [];
  for (const [k, list] of [...groups].sort()) {
    const [g, measured] = k.split('|'); list.sort((a, b) => a.base_t - b.base_t);
    // pooled alt-coin groups mix coins: the baseline used is BTC-free, each coin against itself would need per-coin baselines; BTC's baseline is not used for them
    for (const key of Object.keys(HORIZONS)) {
      const meas = g.startsWith('alt-coin') ? null : measured;
      const s = meas ? groupStat(g, meas, key, list) : pooledAlt(g, key, list);
      if (s) rows.push(s);
    }
  }
  const m = spine.write('derived/event-study', { generator: 'engines/events (buildStudy)', inputs: [spine.ref('derived/event-reactions'), spine.ref('market')],
    checks: [{ name: 'study built', ok: rows.length > 0, detail: `${rows.length} group x horizon rows` }],
    notes: ['diff_mean = group mean minus the baseline mean (every hour of that coin). The interval is a 95% bootstrap interval (1,000 resamples, fixed seed).',
      'Events closer together than the horizon overlap and are not independent: n_nonoverlap counts the ones that do not overlap.', 'A verdict needs at least 30 non-overlapping samples.'],
    files: { 'study.csv': { rows, schema: STUDY } } });
  return { manifest: m, rows };
}
// pooled alt coins: each sample is compared with its own coin's baseline, then pooled
function pooledAlt(group, key, list) {
  const hours = HORIZONS[key], adj = [];
  for (const r of list) if (r[key] != null) adj.push({ ...r, [key]: r[key] - baseline(r.measured, hours).mean, raw: r[key] });
  if (!adj.length) return null;
  const v = adj.map((r) => r[key]), raw = adj.map((r) => r.raw), rnd = U.rng(11), boots = [];
  for (let k = 0; k < 1000; k++) { let s = 0; for (let i = 0; i < v.length; i++) s += v[Math.floor(rnd() * v.length)]; boots.push(s / v.length); }
  const lo = U.quantile(boots, 0.025), hi = U.quantile(boots, 0.975), pre = adj.filter((r) => r.base_t < CUT).map((r) => r[key]), post = adj.filter((r) => r.base_t >= CUT).map((r) => r[key]);
  const sameSign = pre.length >= 20 && post.length >= 20 && Math.sign(U.mean(pre)) === Math.sign(U.mean(post));
  return { group, measured: 'own coin', horizon: key, n: v.length, n_nonoverlap: v.length, mean: U.round(U.mean(raw), 3), median: U.round(U.median(raw), 3), p10: U.round(U.quantile(raw, 0.1), 3), p90: U.round(U.quantile(raw, 0.9), 3),
    share_down: U.round(raw.filter((x) => x < 0).length / raw.length, 3), mean_abs: U.round(U.mean(raw.map(Math.abs)), 3), base_mean: 0, base_mean_abs: 0, diff_mean: U.round(U.mean(v), 3), diff_ci_lo: U.round(lo, 3), diff_ci_hi: U.round(hi, 3),
    n_before_2024: pre.length, mean_before_2024: pre.length ? U.round(U.mean(pre), 3) : null, n_from_2024: post.length, mean_from_2024: post.length ? U.round(U.mean(post), 3) : null,
    verdict: (lo > 0 || hi < 0 ? (sameSign ? 'differs from baseline, both periods agree' : 'differs from baseline, periods disagree or too short') : 'not different from baseline') + ' (coins move together, so samples are not independent)' };
}

// ---------- similarity search ----------
// The k past BTC shock episodes most like the query one, using only what was known at each shock:
// size (z), volume ratio, the 24h and 72h moves before it. Features are standardised with the episodes BEFORE the query.
// Only neighbours whose 7-day outcome was already complete at the query time are used.
function similar(queryId, k = 10) {
  const R = spine.load('derived/event-reactions', 'reactions.csv').filter((r) => r.kind === 'price_shock' && r.asset === 'BTC' && r.measured === 'BTC' && r.episode_first && r.pre_72h != null);
  const q = queryId ? R.find((r) => r.event_id === queryId) : R[R.length - 1]; if (!q) throw new Error('no such BTC shock episode: ' + queryId);
  const pool = R.filter((r) => r.direction === q.direction && r.first_seen_at + 168 * H <= q.first_seen_at && r.r_7d != null);
  const feats = (r) => [Math.abs(r.z), Math.log(r.vol_ratio), r.pre_24h, r.pre_72h];
  const cols = [0, 1, 2, 3].map((j) => pool.map((r) => feats(r)[j])), mu = cols.map(U.mean), sg = cols.map((c) => U.sd(c) || 1);
  const dist = (r) => Math.sqrt(U.sum(feats(r).map((v, j) => ((v - mu[j]) / sg[j] - (feats(q)[j] - mu[j]) / sg[j]) ** 2)));
  const near = pool.map((r) => ({ ...r, distance: U.round(dist(r), 3) })).sort((a, b) => a.distance - b.distance).slice(0, k);
  const sm = (key) => ({ mean: U.round(U.mean(near.map((r) => r[key])), 2), median: U.round(U.median(near.map((r) => r[key])), 2), share_down: U.round(near.filter((r) => r[key] < 0).length / (near.length || 1), 2) });
  return { query: q, pool: pool.length, neighbours: near, summary: { r_24h: sm('r_24h'), r_72h: sm('r_72h'), r_7d: sm('r_7d') } };
}

// ---------- report ----------
function report() {
  const ev = spine.load('events', 'events.jsonl'), study = spine.load('derived/event-study', 'study.csv'), R = spine.load('derived/event-reactions', 'reactions.csv');
  const kinds = {}; for (const e of ev) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  const L = ['# Event ledger and event study', '', `Built ${new Date().toISOString().slice(0, 16)} UTC. Ledger rows: ${ev.length} (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')}).`,
    `First event ${U.iso(ev[0].first_seen_at)}, last ${U.iso(ev[ev.length - 1].first_seen_at)} UTC.`, '',
    '## What followed each kind of event', '', 'Returns in percent. "vs baseline" is the group mean minus the average of every hour, with a 95% interval.', ''];
  L.push(U.mdTable(study, [['Group', (r) => r.group], ['Measured', (r) => r.measured], ['Horizon', (r) => r.horizon.replace('r_', '')], ['n', (r) => r.n], ['n no overlap', (r) => r.n_nonoverlap], ['Mean', (r) => U.signed(r.mean)],
    ['Median', (r) => U.signed(r.median)], ['10% to 90%', (r) => `${U.signed(r.p10)} to ${U.signed(r.p90)}`], ['Fell', (r) => Math.round(r.share_down * 100) + '%'], ['vs baseline', (r) => `${U.signed(r.diff_mean)} (${U.signed(r.diff_ci_lo)} to ${U.signed(r.diff_ci_hi)})`],
    ['Before 2024', (r) => (r.mean_before_2024 == null ? '-' : `${U.signed(r.mean_before_2024)} (n ${r.n_before_2024})`)], ['From 2024', (r) => (r.mean_from_2024 == null ? '-' : `${U.signed(r.mean_from_2024)} (n ${r.n_from_2024})`)], ['Verdict', (r) => r.verdict]]));
  const tags = R.filter((r) => r.kind === 'owner_tag' && r.measured === 'BTC'), byId = new Map(ev.map((e) => [e.event_id, e]));
  L.push('', '## Owner-tagged events', '', U.mdTable(tags, [['Event', (r) => byId.get(r.event_id).title], ['First seen (UTC)', (r) => U.iso(r.first_seen_at)], ['72h before', (r) => U.signed(r.pre_72h)], ['1h', (r) => U.signed(r.r_1h)], ['24h', (r) => U.signed(r.r_24h)], ['72h', (r) => U.signed(r.r_72h)], ['7d', (r) => U.signed(r.r_7d)]]));
  try {
    const s = similar(null, 10);
    L.push('', '## Latest BTC shock episode and its closest past matches', '', `Latest: ${U.iso(s.query.first_seen_at)} UTC, ${s.query.direction}, ${Math.abs(s.query.z)}x normal, volume ${s.query.vol_ratio}x. Compared with ${s.pool} earlier ${s.query.direction} episodes.`, '',
      U.mdTable(s.neighbours, [['Past episode (UTC)', (r) => U.iso(r.first_seen_at)], ['Size', (r) => Math.abs(r.z) + 'x'], ['Volume', (r) => r.vol_ratio + 'x'], ['72h before', (r) => U.signed(r.pre_72h)], ['24h after', (r) => U.signed(r.r_24h)], ['72h after', (r) => U.signed(r.r_72h)], ['7d after', (r) => U.signed(r.r_7d)], ['Distance', (r) => r.distance]]),
      '', `After the 10 closest matches: 24h median ${U.signed(s.summary.r_24h.median)}%, 72h median ${U.signed(s.summary.r_72h.median)}%, 7d median ${U.signed(s.summary.r_7d.median)}% (fell in ${Math.round(s.summary.r_7d.share_down * 100)}% of them). Ten cases is a description, not a forecast.`);
  } catch (e) { L.push('', 'Similarity search not available: ' + e.message); }
  L.push('', '## Limits', '', '- Shocks are back-filled from candles and are exact. Owner tags before Nov 16 2026 were written after the fact, with approximate hours.',
    '- Headlines exist only from the first Pulse brief (Nov 11 2026). Scheduled releases come from the Pulse calendar history only.', '- Samples of one coin group are not independent when coins fall together; treat pooled alt-coin rows as indicative.');
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'events.md'), L.join('\n') + '\n');
  return path.join(cfg.reportsDir, 'events.md');
}

function run(opts = {}) { const a = buildLedger(opts); if (a.status !== 'ok') return a; buildReactions(opts); const s = buildStudy(); report(); return s.manifest; }
module.exports = { detectShocks, withEpisodes, buildLedger, buildReactions, buildStudy, similar, report, run, reaction, candidates, schedType, HORIZONS, LEDGER };
if (require.main === module) { const m = run(); console.log('events:', m.status, '-> reports/events.md'); }
