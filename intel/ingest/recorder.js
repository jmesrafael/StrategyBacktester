// ingest/recorder.js - takes the VPS recorder's data (after it has been pulled to this PC) into the spine (dataset "mexc").
//
// Getting the data here is one command, run by the owner because it needs the VPS login:
//     lucidio-recorder\pull-recorder-data.cmd YOUR-VPS
// That writes D:\testing\Strat\recorder-data\lucidio-recorder (config key "recorderData"). This job then
//   - lists every file with its checksum and row count (inventory.json), so a later pull that changed or lost
//     an old file is detected,
//   - builds book_daily.csv: per coin and day, the measured spread and the slippage of market orders of each size.
// The raw files stay in the pulled folder, untouched.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const spine = require('../lib/spine'), cfg = require('../lib/config'), U = require('../lib/util');

const BOOK = { symbol: 'string', coin: 'string', day: 'string', snapshots: 'int', spread_bp_median: 'number?', size_usd: 'int', buy_bp_median: 'number?', buy_bp_p90: 'number?', sell_bp_median: 'number?', sell_bp_p90: 'number?' };
const readLines = (f) => { const buf = fs.readFileSync(f), text = (f.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8'); const out = []; for (const l of text.split('\n')) { if (!l.trim()) continue; try { out.push(JSON.parse(l)); } catch (e) { /* a torn last line after a crash: skipped, as the recorder README says */ } } return out; };

function bookDaily(root) {
  const rows = [], d = path.join(root, 'book'); if (!fs.existsSync(d)) return rows;
  for (const sym of fs.readdirSync(d).sort()) for (const fn of fs.readdirSync(path.join(d, sym)).sort()) {
    const day = fn.slice(0, 10), snaps = readLines(path.join(d, sym, fn)); if (!snaps.length) continue;
    const sp = snaps.map((s) => s.sp).filter(Number.isFinite), sizes = new Set();
    for (const s of snaps) for (const k of Object.keys(s.buy || {})) sizes.add(k);
    for (const size of [...sizes].sort((a, b) => a - b)) {
      const buy = snaps.map((s) => s.buy && s.buy[size]).filter(Number.isFinite), sell = snaps.map((s) => s.sell && s.sell[size]).filter(Number.isFinite);
      rows.push({ symbol: sym, coin: sym.replace('_USDT', ''), day, snapshots: snaps.length, spread_bp_median: sp.length ? U.round(U.median(sp), 3) : null, size_usd: Number(size),
        buy_bp_median: buy.length ? U.round(U.median(buy), 3) : null, buy_bp_p90: buy.length ? U.round(U.quantile(buy, 0.9), 3) : null,
        sell_bp_median: sell.length ? U.round(U.median(sell), 3) : null, sell_bp_p90: sell.length ? U.round(U.quantile(sell, 0.9), 3) : null });
    }
  }
  return rows;
}

function run(opts = {}) {
  const root = opts.root || cfg.path(cfg.recorderData);
  if (!fs.existsSync(root)) {
    return spine.write('mexc', { generator: 'ingest/recorder.js', source: { kind: 'VPS recorder (lucidio-recorder), MEXC public data', path: cfg.recorderData },
      checks: [{ name: 'recorder data pulled', ok: false, detail: `folder not found: ${root}. Run lucidio-recorder\\pull-recorder-data.cmd YOUR-VPS (needs the VPS ssh login), then run this job again.` }], files: {} });
  }
  let prev = null; try { prev = JSON.parse(fs.readFileSync(path.join(spine.dir('mexc'), 'inventory.json'), 'utf8')); } catch (e) { prev = null; }
  const files = {}, lost = [], changed = [];
  for (const rel of U.walk(root)) { const f = path.join(root, rel); files[rel] = { bytes: fs.statSync(f).size, sha256: U.sha256File(f) }; }
  // finished (gzipped) files never change on the server; one that changed or vanished since the last run is a fault
  if (prev) for (const [rel, m] of Object.entries(prev.files)) { if (!rel.endsWith('.gz')) continue; if (!files[rel]) lost.push(rel); else if (files[rel].sha256 !== m.sha256) changed.push(rel); }
  const book = bookDaily(root), n = Object.keys(files).length;
  const status = path.join(root, 'summary', 'status.json');
  return spine.write('mexc', { generator: 'ingest/recorder.js', source: { kind: 'VPS recorder (lucidio-recorder), MEXC public data', path: cfg.recorderData, pulled_by: 'lucidio-recorder/pull-recorder-data.cmd' },
    checks: [{ name: 'recorder data pulled', ok: n > 0, detail: `${n} files` }, { name: 'finished files unchanged', ok: !lost.length && !changed.length, detail: lost.length || changed.length ? `lost: ${lost.join(', ') || 'none'}; changed: ${changed.join(', ') || 'none'}` : 'no finished file lost or changed' }],
    notes: [fs.existsSync(status) ? 'recorder status file present' : 'no recorder status file in the pull'],
    files: { 'inventory.json': { json: { root: cfg.recorderData, files } }, 'book_daily.csv': { rows: book, schema: BOOK } } });
}
module.exports = { run, bookDaily, readLines, BOOK };
if (require.main === module) { const m = run(); console.log('mexc:', m.status, '|', m.checks.map((c) => (c.ok ? 'ok ' : 'FAIL ') + c.name + ': ' + c.detail).join(' | ')); }
