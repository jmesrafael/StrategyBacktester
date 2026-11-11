// news-tc: T-CORE paper lab (fresh copy of StrategyBacktester/bb-trail, already paper-locked with realistic costs) -> T-CORE NEWS LAB, dashboard tag tcn.
// Only the tag, the labels, Telegram (off) and the news gate change.
'use strict';
const fs = require('fs');
const { edit } = require('./edit.js');
const { applyGate } = require('./gate.js');

edit('icore.js', [
  ['// icore.js (BB-TRAIL PAPER LAB)', '// icore.js (T-CORE NEWS LAB: the T-CORE paper lab with the NEWS GATE, built by news-lab-bots/patches/news-tc.js; was BB-TRAIL PAPER LAB)', 1],
  ['const liveAllowed = () => false; // BB-TRAIL PAPER LAB:', 'const liveAllowed = () => false; // T-CORE NEWS LAB:', 1],
  ['console.log(`BB-Trail PAPER LAB check · mode', 'console.log(`T-CORE NEWS LAB check · mode', 1],
  ['console.log(`BB-Trail ${CFG.mode.toUpperCase()} LAB bot · coins', 'console.log(`T-CORE NEWS LAB ${CFG.mode.toUpperCase()} bot · coins', 1],
]);

applyGate({
  main: 'icore.js',
  codeFilesFrom: "'realpaper.js', 'live.js',", codeFilesTo: "'realpaper.js', 'newsgate.js', 'live.js',",
  mk: ["const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'bbtr|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'bbtr', ...extra, data });",
       "const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'tcn|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'tcn', ...extra, data });   // T-CORE NEWS LAB: tag tcn"],
  coreFrom: "const CORE = 'TRAIL LAB';", coreTo: "const CORE = 'TC NEWS LAB';",
});

const cfg = JSON.parse(fs.readFileSync('bot-config.json', 'utf8'));
Object.assign(cfg, { mode: 'paper', startBalance: 100, realisticPaper: true, heartbeatUrl: '' });
fs.writeFileSync('bot-config.json', JSON.stringify(cfg, null, 2) + '\n');
if (fs.existsSync('package.json')) { const p = JSON.parse(fs.readFileSync('package.json', 'utf8')); p.name = 't-core-news-lab'; p.description = 'T-CORE NEWS LAB: the T-CORE paper lab with the news gate, paper only, no Telegram. Built by news-lab-bots/patches/news-tc.js.'; fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n'); }
console.log('news-tc patched');
