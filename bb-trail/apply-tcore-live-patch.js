// apply-tcore-live-patch.js — turns a COPY of this folder (the T-CORE paper lab) into the T-CORE LIVE bot. Never run it on bb-trail/ itself:
//   node apply-tcore-live-patch.js <staging folder>          (build-tcore-live.sh makes the copy and calls this)
// What changes, and nothing else:
//   1. icore.js: the paper lock is replaced by I-Core's own live gate (live needs --allow-live or ICORE_ALLOW_LIVE=1, which the tcore service sets);
//   2. dashboard-push.js: reports as its own bot 'tcore' (ids "tcore|…"), so it never mixes with the paper lab (bbtr), BB-Core or I-Core;
//   3. telegram.js: messages say [CORE 3]; ledger-sync.js reads the key file from ICORE_KEYS (keys are not beside the root-owned code);
//   4. bot-config.json: mode live, I-Core's live risk settings (2.5% steps, $500 cap), T-CORE's own halt (45R below the best point), no paper cost model.
// The strategy core (icore-core.js) and all the trading machinery are untouched: the live code path is I-Core's, already proven on MEXC.
// Each edit must match exactly the expected number of times, or it stops without writing anything.
'use strict';
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, 'icore.js'))) { console.error('usage: node apply-tcore-live-patch.js <staging folder with a copy of bb-trail>'); process.exit(1); }
if (path.resolve(dir) === path.resolve(__dirname)) { console.error('refusing: this would turn the paper lab source itself into a live bot. Give it a copy.'); process.exit(1); }

const CRNL = String.fromCharCode(13, 10), NL = String.fromCharCode(10);
const out = new Map();
function edit(file, pairs) {
  const p = path.join(dir, file); let s = out.get(p) ?? fs.readFileSync(p, 'utf8');
  const crlf = s.includes(CRNL);
  for (let [a, b, want] of pairs) {
    if (crlf) { a = a.split(NL).join(CRNL); b = b.split(NL).join(CRNL); }
    const n = s.split(a).length - 1;
    if (n !== want) { console.error(`${file}: expected ${want} match(es), found ${n}: ${a.slice(0, 80)}`); process.exit(1); }
    s = s.split(a).join(b);
  }
  out.set(p, s);
}

edit('icore.js', [
  ['const liveAllowed = () => false; // BB-TRAIL PAPER LAB: real trading is impossible here, whatever the config, flags or environment say',
   "const liveAllowed = () => process.argv.includes('--allow-live') || process.env.ICORE_ALLOW_LIVE === '1'; // T-CORE LIVE: I-Core's live gate (the tcore service sets ICORE_ALLOW_LIVE=1)", 1],
]);
edit('dashboard-push.js', [
  ["const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'bbtr|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'bbtr', ...extra, data });",
   "// T-CORE LIVE: tagged bot:'tcore', ids start with \"tcore|\" (kept apart from the T-CORE paper lab, which reports as bbtr)\nconst mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'tcore|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'tcore', ...extra, data });", 1],
]);
edit('telegram.js', [["const CORE = 'TRAIL LAB';", "const CORE = 'CORE 3';", 1]]);
// ledger-sync.js reads the key file next to the code; T-CORE's code folder is root-owned, so its keys live in ICORE_KEYS (/var/lib/tcore). Without this the wallet reports and closed trades never reach the ledger.
edit('ledger-sync.js', [["const KEYS = path.join(__dirname, 'mexc-keys.json');", "const KEYS = process.env.ICORE_KEYS || path.join(__dirname, 'mexc-keys.json');", 1]]);

const cfg = {
  mode: 'live', coins: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], riskPct: 0.025, startBalance: 100, riskUsd: 1, maxRiskUsd: 500, maxRiskMult: 1.5, maxLeverage: 20,
  haltAtR: -45, maxEntryDelaySec: 900, wakeDelaySec: 2, heartbeatUrl: '', riskTiers: [[0, 0.025], [500, 0.02], [1000, 0.015]],
};
out.set(path.join(dir, 'bot-config.json'), JSON.stringify(cfg, null, 2) + '\n');

for (const [p, s] of out) fs.writeFileSync(p, s);
console.log(`T-CORE live patch applied to ${dir}: live gate, dashboard tag tcore, Telegram [CORE 3], live config (2.5% risk, $500 cap, halt -45R)`);
