// integrity/monitor.js - the Data Integrity Monitor. One line per dataset and per check: ok, fault, or blocked.
//
// What it looks at:
//   every dataset   manifest present, status ok, every file matches its checksum
//   market          newest BTC bar is recent; faulty series are listed
//   trades          export is recent; every live entry price lies inside (or near) the Binance candle of its hour
//   headlines       hash chain intact; no brief day missing; newest brief is recent
//   events          hash chain intact
//   mexc            recorder data pulled (blocked until the owner runs the pull)
//   venue parity    Binance and MEXC 4h closes agree (local MEXC samples from the bot folder, when present)
// "fault" means an engine should not be trusted on that data. "blocked" means an outside step is still needed.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../lib/spine'), cfg = require('../lib/config'), U = require('../lib/util'), M = require('../lib/market');
const ROW = { area: 'string', check: 'string', status: 'string', detail: 'string' };

function run(opts = {}) {
  const now = opts.now || Date.now() / 1000, rows = [], add = (area, check, status, detail) => rows.push({ area, check, status, detail });
  // 1. every dataset against its manifest
  for (const name of spine.list()) {
    if (name === 'derived/integrity') continue;
    const m = (() => { try { return spine.manifest(name); } catch (e) { return null; } })();
    const blocked = m && m.status !== 'ok' && m.checks.some((c) => !c.ok && /pull|key|not found/i.test(c.detail)) && Object.keys(m.files).length === 0;
    const faults = spine.verify(name);
    add(name, 'manifest and checksums', faults.length ? (blocked ? 'blocked' : 'fault') : 'ok', faults.length ? (blocked ? m.checks.filter((c) => !c.ok).map((c) => c.detail).join('; ') : faults.join('; ')) : `${Object.keys(m.files).length} file(s) verified, built ${m.built_at.slice(0, 16)}`);
  }
  const safe = (area, check, fn) => { try { fn(); } catch (e) { add(area, check, e.code === 'MISSING' ? 'blocked' : 'fault', e.message); } };
  // 2. market freshness
  safe('market', 'newest BTC bar is recent', () => { M.reset(); const age = (now - M.lastClose('BTC')) / 3600; add('market', 'newest BTC bar is recent', age <= cfg.freshness.marketHours ? 'ok' : 'fault', `last closed 1h bar is ${age.toFixed(1)}h old (limit ${cfg.freshness.marketHours}h). Refresh: node ../candles/update.js --no-1m, then "ingest"`); });
  safe('market', 'faulty series', () => { const reg = spine.load('market', 'registry.json').series, bad = Object.keys(reg).filter((k) => reg[k].faults.length); add('market', 'faulty series', 'ok', bad.length ? `excluded from use: ${bad.map((k) => k + ' (' + reg[k].faults[0] + ')').join('; ')}` : 'none'); });
  // 3. trades
  safe('trades', 'export is recent', () => { const m = spine.manifest('trades'), age = (now - Date.parse(m.source.exported_at) / 1000) / 3600; add('trades', 'export is recent', age <= cfg.freshness.tradesHours ? 'ok' : 'fault', `database export is ${age.toFixed(1)}h old (limit ${cfg.freshness.tradesHours}h). ${m.notes[0] || ''}`); });
  safe('trades', 'entry prices match the market', () => {
    const bad = [], tr = spine.load('trades', 'trades.csv').filter((t) => t.mode === 'live'); let checked = 0;
    for (const t of tr) { if (!M.has(t.coin, '1h')) continue; const t0 = Math.floor(t.entry_s / 3600) * 3600, b = M.bars(t.coin, '1h', { from: t0, to: t0 + 3600 })[0]; if (!b) continue; checked++;
      if (t.entry_price > b[2] * 1.01 || t.entry_price < b[3] * 0.99) bad.push(`${t.bot} ${t.coin} ${U.iso(t.entry_s)}: entry ${t.entry_price}, Binance bar ${b[3]}-${b[2]}`); }
    add('trades', 'entry prices match the market', bad.length ? 'fault' : 'ok', bad.length ? bad.join('; ') : `${checked} live entries lie within 1% of the Binance candle of their hour`);
  });
  // 4. headlines and events: chains and coverage
  for (const [name, file] of [['headlines', 'headlines.jsonl'], ['events', 'events.jsonl']]) safe(name, 'append-only log intact', () => { const rowsL = spine.load(name, file), b = spine.chainVerify(rowsL); add(name, 'append-only log intact', b == null ? 'ok' : 'fault', b == null ? `${rowsL.length} rows, hash chain verified` : `row ${b} altered or removed`); });
  safe('headlines', 'no missing days', () => { const c = spine.load('headlines', 'coverage.json'), age = c.last ? (now - Date.parse(c.last) / 1000) / 3600 : Infinity;
    add('headlines', 'no missing days', c.missing.length ? 'fault' : 'ok', c.missing.length ? 'missing brief dates: ' + c.missing.join(', ') : `briefs ${c.first} to ${c.last}, none missing`);
    add('headlines', 'newest brief is recent', age <= cfg.freshness.headlinesHours + 24 ? 'ok' : 'fault', `newest brief is dated ${c.last} (pull the crypto-news repo to bring newer briefs, then "ingest")`); });
  // 5. venue parity: Binance against MEXC (the bots trade on MEXC, the research uses Binance)
  const samples = cfg.path(cfg.mexcSamples || '../../bb-core/data');
  if (samples && fs.existsSync(samples)) for (const coin of ['SOL', 'ADA', 'NEAR', 'GALA', 'ZEC']) safe('venue parity', coin, () => {
    const f = path.join(samples, `MEXC_${coin}.json`); if (!fs.existsSync(f) || !M.has(coin, '4h')) return;
    const mx = new Map(JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => [r[0], r[4]])), d = [];
    for (const b of M.bars(coin, '4h')) { const c = mx.get(b[0]); if (c > 0) d.push(Math.abs(b[4] / c - 1) * 1e4); }
    if (d.length < 100) return;
    // judged on the most recent 2,000 bars (about 11 months): the early years of a listing are thin on both venues
    const rec = d.slice(-2000), p99 = U.quantile(rec, 0.99), big = d.filter((x) => x > 100).length;
    add('venue parity', coin + ' 4h close, Binance vs MEXC', p99 <= 50 ? 'ok' : 'fault', `last ${rec.length} bars: median difference ${U.median(rec).toFixed(1)} bp, 99th percentile ${p99.toFixed(1)} bp (limit 50). Whole history (${d.length} bars): 99th percentile ${U.quantile(d, 0.99).toFixed(1)} bp, ${big} bars over 1%`);
  });
  else add('venue parity', 'Binance vs MEXC', 'blocked', 'no MEXC candle samples found (the recorder pull will provide them)');
  const faults = rows.filter((r) => r.status === 'fault'), blocked = rows.filter((r) => r.status === 'blocked');
  const m = spine.write('derived/integrity', { generator: 'integrity/monitor.js', checks: [{ name: 'monitor ran', ok: true, detail: `${rows.length} checks: ${faults.length} fault(s), ${blocked.length} blocked` }], files: { 'status.csv': { rows, schema: ROW } } });
  const L = ['# Data integrity', '', `Checked ${new Date(now * 1000).toISOString().slice(0, 16)} UTC. ${faults.length} fault(s), ${blocked.length} blocked, ${rows.length - faults.length - blocked.length} ok.`, '',
    U.mdTable(rows, [['Area', (r) => r.area], ['Check', (r) => r.check], ['Status', (r) => r.status], ['Detail', (r) => r.detail]])];
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'integrity.md'), L.join('\n') + '\n');
  return { manifest: m, rows, faults, blocked };
}
module.exports = { run };
if (require.main === module) { const r = run(); for (const x of r.rows) console.log(x.status.padEnd(8), (x.area + ' / ' + x.check).padEnd(58), x.detail.slice(0, 150)); process.exit(r.faults.length ? 1 : 0); }
