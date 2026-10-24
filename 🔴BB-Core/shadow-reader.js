// shadow-reader.js - reads what the shadow recorder wrote: records-YYYY-MM-DD.jsonl, windows-YYYY-MM-DD.jsonl (and the older single records.jsonl), each either
// plain or gzip-compressed (.gz, after rotation). Read-only; a torn line or a damaged .gz is skipped and counted, never fatal. Used by the recorder's own
// reconcile/summary commands and by compare-live-vs-backtest.js. No network, no keys.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const FILE_RE = { records: /^records(-\d{4}-\d{2}-\d{2})?\.jsonl(\.gz)?$/, windows: /^windows-\d{4}-\d{2}-\d{2}\.jsonl(\.gz)?$/ };

function listFiles(dir, family) {
  let names = []; try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((n) => FILE_RE[family].test(n)).sort().map((n) => path.join(dir, n));
}
function readText(file) {
  const buf = fs.readFileSync(file);
  return file.endsWith('.gz') ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
}
// -> { rows, bad, files }  rows in file order (oldest first)
function readFamily(dir, family = 'records') {
  const rows = []; let bad = 0; const files = listFiles(dir, family);
  for (const f of files) {
    let text; try { text = readText(f); } catch { bad++; continue; }
    for (const l of text.split('\n')) { if (!l.trim()) continue; try { rows.push(JSON.parse(l)); } catch { bad++; } }
  }
  return { rows, bad, files: files.length };
}
const readRecords = (dir) => readFamily(dir, 'records');
const readWindows = (dir) => readFamily(dir, 'windows');

// the decision the recorder made for one signal candle, newest snapshot that is a real decision. -> Map "SOL_USDT|<signal candle open ms>" -> { ... }
//   prefers the t+2s snapshot (what the bot saw at wake-up), then 'late', then t+5min
function decisionMap(dir) {
  const rank = { t2s: 0, late: 1, t5m: 2 }, out = new Map(), { rows } = readRecords(dir);
  for (const r of rows) {
    if (r.kind !== 'decision' || !r.mexc || !r.coin || r.candle == null) continue;
    const key = `${r.coin}_USDT|${r.candle * 1000}`, prev = out.get(key);
    if (prev && (rank[prev.snap] ?? 9) <= (rank[r.snap] ?? 9)) continue;
    out.set(key, { snap: r.snap, ts: r.ts, signal: r.mexc.signal, dir: r.mexc.dir ?? null, stop: r.mexc.stop ?? null, target: r.mexc.target ?? null, reasons: r.mexc.reasons || [],
      upper: r.mexc.upper ?? null, mid: r.mexc.mid ?? null, lower: r.mexc.lower ?? null, sma200: r.mexc.sma200 ?? null, atr14: r.mexc.atr14 ?? null, close: r.mexc.close ?? null,
      wake_lag_sec: r.wakeLagSec ?? null, fetched_at_ms: r.fetch ? r.fetch.fetched_at_ms : null, trade_id: r.trade_id || null, binance_signal: r.binance ? r.binance.signal : null });
  }
  return out;
}

module.exports = { listFiles, readFamily, readRecords, readWindows, decisionMap, FILE_RE };
