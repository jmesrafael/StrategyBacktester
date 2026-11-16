// ingest/candles.js - registers the candle library in the spine (dataset "market").
// It does not download anything (run `node ../candles/update.js --no-1m` for that). It reads every 1h, 4h and
// funding file, checks it, and writes the registry that lib/market.js enforces.
//
// Checks per series: rows in time order, no duplicates, valid OHLC, count of missing bars, and
// HISTORY UNCHANGED: the rows that existed at the previous run must hash to the same value now.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../lib/spine'), cfg = require('../lib/config'), U = require('../lib/util');
const SECS = { '1h': 3600, '4h': 14400 };

function checkSeries(rows, tf) {
  const faults = []; let gaps = 0, missing = 0;
  if (!Array.isArray(rows) || !rows.length) return { faults: ['empty or not an array'], gaps: 0, missing: 0 };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (tf !== 'funding') {
      const [t, o, h, l, c, v] = r;
      if (![t, o, h, l, c].every(Number.isFinite) || o <= 0 || h < Math.max(o, c) - 1e-12 || l > Math.min(o, c) + 1e-12 || l <= 0 || (v != null && v < 0)) { faults.push(`bad OHLC at ${Number.isFinite(t) ? U.iso(t) : "row " + (i + 1)}`); if (faults.length > 5) break; }
    }
    if (i > 0) {
      const dt = r[0] - rows[i - 1][0];
      if (dt <= 0) { faults.push(`out of order or duplicate at ${U.iso(r[0])}`); if (faults.length > 5) break; }
      else if (tf !== 'funding' && dt !== SECS[tf]) { gaps++; missing += dt / SECS[tf] - 1; }
    }
  }
  return { faults, gaps, missing };
}

function run(opts = {}) {
  const lib = path.join(cfg.path(cfg.candleLibrary), 'binance-futures');
  let prev = null; try { prev = spine.manifest('market').status === 'ok' ? JSON.parse(fs.readFileSync(path.join(spine.dir('market'), 'registry.json'), 'utf8')) : null; } catch (e) { prev = null; }
  const series = {}, checks = [], changed = [];
  for (const tf of ['1h', '4h', 'funding']) {
    const d = path.join(lib, tf); if (!fs.existsSync(d)) { checks.push({ name: 'folder ' + tf, ok: false, detail: 'missing: ' + d }); continue; }
    for (const fn of fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort()) {
      const coin = fn.replace('.json', ''), key = coin + '/' + tf, f = path.join(d, fn);
      if (opts.coins && !opts.coins.includes(coin)) continue;
      let rows, e;
      try { rows = JSON.parse(fs.readFileSync(f, 'utf8')); e = checkSeries(rows, tf); } catch (err) { rows = []; e = { faults: ['not valid JSON'], gaps: 0, missing: 0 }; }
      const p = prev && prev.series[key];
      // history check: the first p.rows rows must still hash to p.rows_sha256
      if (p && !p.faults.length && rows.length >= p.rows) {
        if (U.sha256(JSON.stringify(rows.slice(0, p.rows))) !== p.rows_sha256) { e.faults.push('history changed: rows that existed at the last run are different now'); changed.push(key); }
      } else if (p && rows.length < p.rows) { e.faults.push(`rows were removed (${p.rows} -> ${rows.length})`); changed.push(key); }
      series[key] = { rows: rows.length, first: rows.length ? rows[0][0] : null, last: rows.length ? rows[rows.length - 1][0] : null, gaps: e.gaps, missing: e.missing,
        faults: e.faults, bytes: fs.statSync(f).size, rows_sha256: U.sha256(JSON.stringify(rows)) };
    }
  }
  const keys = Object.keys(series), faulty = keys.filter((k) => series[k].faults.length);
  const need = [...new Set(cfg.marketCoins.concat(...Object.values(cfg.bots).map((b) => b.coins)))];
  const neededFaulty = faulty.filter((k) => need.includes(k.split('/')[0]) && !k.endsWith('/funding'));
  const missingNeeded = need.filter((c) => !series[c + '/1h'] || !series[c + '/4h']);
  checks.push({ name: 'series found', ok: keys.length > 0, detail: `${keys.length} series` });
  checks.push({ name: 'required coins present', ok: missingNeeded.length === 0 || !!opts.coins, detail: missingNeeded.length ? 'missing: ' + missingNeeded.join(', ') : 'all present' });
  checks.push({ name: 'required coins clean', ok: neededFaulty.length === 0, detail: neededFaulty.length ? neededFaulty.map((k) => k + ': ' + series[k].faults[0]).join('; ') : 'no faults' });
  checks.push({ name: 'history unchanged', ok: changed.filter((k) => need.includes(k.split('/')[0])).length === 0, detail: changed.length ? 'changed: ' + changed.join(', ') : 'no old row changed' });
  const btc = series['BTC/1h'];
  // a coin the updater skipped falls silently behind: every required coin must end within 2 hours of BTC
  const behind = btc ? need.filter((c) => series[c + '/1h'] && btc.last - series[c + '/1h'].last > 2 * 3600) : [];
  checks.push({ name: 'required coins are current', ok: behind.length === 0, detail: behind.length ? `behind BTC: ${behind.map((c) => c + ' (ends ' + U.iso(series[c + '/1h'].last) + ')').join(', ')}. Add them to candles/coins.json and run candles/update.js` : 'all end with BTC' });
  return spine.write('market', {
    source: { kind: 'local candle library', path: cfg.candleLibrary, origin: 'Binance USDT-M perpetual futures public API (fapi.binance.com), closed bars only', updater: 'candles/update.js' },
    generator: 'ingest/candles.js', checks,
    notes: [`faulty series excluded from use: ${faulty.length ? faulty.join(', ') : 'none'}`, `last BTC 1h bar opens ${btc ? U.iso(btc.last) : '?'} UTC`],
    files: { 'registry.json': { json: { tf_seconds: SECS, row_format: '[openTimeSec, open, high, low, close, volume]; funding: [timeSec, rate]', series } } },
  });
}
module.exports = { run, checkSeries };
if (require.main === module) { const m = run(); console.log('market:', m.status, m.checks.map((c) => `${c.ok ? 'ok' : 'FAIL'} ${c.name}: ${c.detail}`).join(' | ')); process.exit(m.status === 'ok' ? 0 : 1); }
