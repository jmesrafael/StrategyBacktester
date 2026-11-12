// coin-tc: T-CORE paper lab (fresh copy of StrategyBacktester/bb-trail, already paper-locked with realistic costs) -> T-CORE COIN LAB on SUI + ARB, dashboard tag ctc.
// Only the coins, the tag, the labels and Telegram (off) change. Run inside the copy (build.js does that).
'use strict';
const { edit } = require('./edit.js');
const { applyLab } = require('./lab.js');

edit('icore.js', [
  ['// icore.js (BB-TRAIL PAPER LAB)', '// icore.js (T-CORE COIN LAB: the T-CORE paper lab on SUI + ARB, built by coin-lab-bots/patches/coin-tc.js; was BB-TRAIL PAPER LAB)', 1],
  ['const liveAllowed = () => false; // BB-TRAIL PAPER LAB:', 'const liveAllowed = () => false; // T-CORE COIN LAB:', 1],
  ['console.log(`BB-Trail PAPER LAB check · mode', 'console.log(`T-CORE COIN LAB check · mode', 1],
  ['console.log(`BB-Trail ${CFG.mode.toUpperCase()} LAB bot · coins', 'console.log(`T-CORE COIN LAB ${CFG.mode.toUpperCase()} bot · coins', 1],
]);
applyLab({
  mk: ["const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'bbtr|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'bbtr', ...extra, data });",
       "const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'ctc|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'ctc', ...extra, data });   // T-CORE COIN LAB: tag ctc"],
  coreFrom: "const CORE = 'TRAIL LAB';", coreTo: "const CORE = 'TC COIN LAB';",
  coins: ['SUI', 'ARB'], label: 'T-CORE COIN LAB',
});
console.log('coin-tc patched');
