// make-export.js - turns the saved results of scripts/export-queries.sql into the export file the trade exporter reads.
//   node scripts/make-export.js <result-file> [<result-file> ...] [--out inputs/db-export/export-YYYY-MM-DD.json]
// A result file may be the raw JSON, or the text the Supabase MCP tool saves (JSON wrapped in "untrusted data" lines).
// It never contacts anything. It also drops key_hash fields, so no key material is stored in an export.
'use strict';
const fs = require('fs'), path = require('path');
const cfg = require('../lib/config');
function parseResult(file) {
  let s = fs.readFileSync(file, 'utf8');
  try { const o = JSON.parse(s); if (o && typeof o.result === 'string') s = o.result; else if (Array.isArray(o)) return o[0].export; } catch (e) { /* not plain JSON: fall through */ }
  const a = s.indexOf('[{"export"'), b = s.lastIndexOf('}]');
  if (a < 0 || b < 0) throw new Error(`${file}: no query result found (expected a row with a column named "export")`);
  const body = s.slice(a, b + 2);
  try { return JSON.parse(body)[0].export; } catch (e) { return JSON.parse(body.replace(/\\"/g, '"'))[0].export; }   // text copied with escaped quotes
}
function scrub(x) { if (Array.isArray(x)) return x.map(scrub); if (x && typeof x === 'object') { const o = {}; for (const [k, v] of Object.entries(x)) if (k !== 'key_hash') o[k] = scrub(v); return o; } return x; }
function build(parts) {
  const m = Object.assign({}, ...parts.map((p) => ({ ...p })));
  const need = ['bot_events', 'closed_trades', 'wallet_snapshots'], miss = need.filter((k) => !m[k]);
  if (miss.length) throw new Error('missing parts: ' + miss.join(', ') + ' (give both query results)');
  const wsCols = parts.find((p) => p.wallet_snapshots).columns;
  return scrub({ source: 'Supabase project Backtester (dashboard database), read-only SELECT queries (scripts/export-queries.sql)', exported_at: parts[0].exported_at, method: 'make-export.js from saved query results', counts: m.counts,
    bot_events: m.bot_events, closed_trades: m.closed_trades, bot_wallets: m.bot_wallets || [], wallet_snapshot_columns: wsCols, wallet_snapshots: m.wallet_snapshots });
}
module.exports = { parseResult, build, scrub };
if (require.main === module) {
  const args = process.argv.slice(2), oi = args.indexOf('--out'), files = args.filter((a, i) => !a.startsWith('--') && i !== oi + 1);
  if (!files.length) { console.log('usage: node scripts/make-export.js <result-file> [<result-file> ...] [--out file]'); process.exit(2); }
  const exp = build(files.map(parseResult)), out = oi >= 0 ? path.resolve(args[oi + 1]) : path.join(cfg.path(cfg.dbExportDir), `export-${exp.exported_at.slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(exp));
  console.log(`wrote ${out}: ${exp.bot_events.length} events, ${exp.closed_trades.length} closed trades, ${exp.wallet_snapshots.length} wallet snapshots. Next: node run.js all`);
}
