#!/usr/bin/env node
// run.js - the one command for the whole intelligence system. Plain Node.js, no packages, no AI.
//
//   node run.js all                 refresh every dataset and rebuild every report (about 1 minute)
//   node run.js ingest              only the data intake (candles, trades, headlines, recorder)
//   node run.js reports             only the engines and reports (reads what ingest produced)
//   node run.js status              one line per dataset: state, age, files
//   node run.js test                the full automated test suite
//   node run.js snapshot [--with-candles] [--with-recorder]   versioned backup
//   node run.js validate <strategy> run the rule gatekeeper on one strategy (bbFade, rsi2, bbcore, icore, tcore)
//   node run.js selftest            the gatekeeper on known strategies (bots must pass, rejected ideas must fail)
//   node run.js adminreport         rebuild the admin report (HTML with charts) in the ledger reports folder
//   node run.js help
//
// A step that fails or is blocked does not stop the others; the summary lists every step. Exit code 1 if any step failed.
// Before "all", refresh the candle library:  node ../candles/update.js --no-1m   and pull the crypto-news repo for new briefs.
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const cfg = require('./lib/config'), spine = require('./lib/spine'), U = require('./lib/util');

const STEPS = {
  ingest: [
    ['candles', () => require('./ingest/candles').run()],
    ['trades', () => require('./ingest/trades').run()],
    ['headlines', () => require('./ingest/headlines').run()],
    ['recorder', () => require('./ingest/recorder').run()],
  ],
  reports: [
    ['events', () => require('./engines/events').run()],
    ['reference backtests', () => require('./engines/backtest').run()],
    ['regime', () => require('./engines/regime').run()],
    ['correlation', () => require('./engines/correlation').run()],
    ['journal', () => require('./engines/journal').run()],
    ['truth check', () => { const m = require('./integrity/truthcheck').run(), n = spine.load('derived/truth-check', 'findings.csv').filter((f) => f.status === 'review').length; m.notes = [n + ' item(s) need review: see reports/truth-check.md'].concat(m.notes); return m; }],
    ['execution', () => require('./engines/execution').run()],
    ['exposure', () => require('./engines/exposure').run()],
    ['strategy health', () => require('./engines/health').run()],
    ['integrity', () => { const r = require('./integrity/monitor').run(); return { checks: r.faults.map((f) => ({ ok: false, name: f.area + ' / ' + f.check, detail: f.detail })), files: { x: 1 }, notes: [r.rows.length + ' checks, ' + r.blocked.length + ' blocked: see reports/integrity.md'] }; }],
  ],
};
// a step is "ok", "blocked" (an outside step is needed) or "failed"
async function runSteps(list) {
  const out = [];
  for (const [name, fn] of list) {
    const t0 = Date.now();
    try {
      const m = await fn(), bad = m && m.checks ? m.checks.filter((c) => !c.ok) : [];
      const blocked = bad.length && Object.keys(m.files || {}).length === 0;
      out.push({ name, status: !bad.length ? 'ok' : blocked ? 'blocked' : 'failed', detail: bad.length ? bad.map((c) => c.name + ': ' + c.detail).join('; ') : (m && m.notes && m.notes[0]) || '', ms: Date.now() - t0 });
    } catch (e) { out.push({ name, status: 'failed', detail: (e.code ? '[' + e.code + '] ' : '') + e.message.split('\n')[0], ms: Date.now() - t0 }); }
    const r = out[out.length - 1]; console.log(`${r.status.padEnd(8)} ${name.padEnd(20)} ${(r.ms / 1000).toFixed(1).padStart(5)}s  ${r.detail.slice(0, 140)}`);
  }
  return out;
}
function status() {
  const rows = spine.list().map((n) => { const m = spine.manifest(n), age = (Date.now() - Date.parse(m.built_at)) / 3600e3; return { n, s: m.status, age: age < 48 ? age.toFixed(1) + 'h' : (age / 24).toFixed(1) + 'd', files: Object.keys(m.files).length, faults: spine.verify(n).length }; });
  for (const r of rows) console.log(`${r.s.padEnd(7)} ${r.n.padEnd(28)} built ${r.age.padStart(6)} ago, ${r.files} file(s)${r.faults ? ', ' + r.faults + ' FAULT(S) on disk' : ''}`);
  return rows;
}
function writeSummary(results) {
  const L = ['# Last run', '', `Run ${new Date().toISOString().slice(0, 16)} UTC.`, '', U.mdTable(results, [['Step', (r) => r.name], ['Result', (r) => r.status], ['Seconds', (r) => (r.ms / 1000).toFixed(1)], ['Detail', (r) => r.detail.slice(0, 200)]]), '',
    '## Reports', '', ...fs.readdirSync(cfg.reportsDir).filter((f) => f.endsWith('.md') && f !== 'INDEX.md').sort().map((f) => `- [${f}](${f})`), '- [validation/](validation/) (one report per strategy checked by the gatekeeper)'];
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'INDEX.md'), L.join('\n') + '\n');
}
async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'all' || cmd === 'ingest' || cmd === 'reports') {
    const list = cmd === 'all' ? STEPS.ingest.concat(STEPS.reports) : STEPS[cmd], res = await runSteps(list);
    if (cmd !== 'ingest') writeSummary(res);
    const failed = res.filter((r) => r.status === 'failed').length, blocked = res.filter((r) => r.status === 'blocked').length;
    console.log(`\n${res.length} steps: ${res.length - failed - blocked} ok, ${blocked} blocked, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  } else if (cmd === 'status') status();
  else if (cmd === 'adminreport') { const r = require('./report/admin-report').run(); console.log('admin report written: ' + r.file + ' (' + (r.bytes / 1024).toFixed(0) + ' KB)'); }
  else if (cmd === 'test') process.exit(spawnSync(process.execPath, ['--test', 'test/*.test.js'], { cwd: __dirname, stdio: 'inherit' }).status || 0);
  else if (cmd === 'snapshot') process.exit(spawnSync(process.execPath, [path.join(__dirname, 'backup', 'backup.js'), 'snapshot', ...args], { stdio: 'inherit' }).status || 0);
  else if (cmd === 'validate' || cmd === 'selftest') process.exit(spawnSync(process.execPath, [path.join(__dirname, 'engines', 'validator', 'index.js'), cmd === 'selftest' ? 'selftest' : args[0], ...args.slice(1)], { stdio: 'inherit' }).status || 0);
  else console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(0, 14).map((l) => l.slice(3)).join('\n'));
}
main();
