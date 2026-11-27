// patches.js — the edits each NEW STRATEGY LAB bot gets on top of a fresh copy of an existing paper bot. Run inside the copy (build.js does that).
// Every edit must match exactly the expected number of times, or the build stops (../coin-lab-bots/patches/edit.js).
// Both bots: paper only (the lock is already in the source), Telegram removed, dashboard push under the bot's OWN tag (bbw / ichix), never asking the
// dashboard for requests, nothing sent to the ledger's money books, US$200 start (a quarter of the ~US$750 pool, what a 4th bot would get),
// no US$ risk cap (owner, Nov 27 2026), the six BB-CORE coins.
'use strict';
const fs = require('fs');
const { edit } = require('../coin-lab-bots/patches/edit.js');

const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'];
const OFF = 'new strategy lab: ';

function common({ coreFrom, coreTo, label, push }) {
  edit('telegram.js', [
    ['async function call(method, body, { fetchImpl = fetch, timeoutMs = 8000, token = creds().token } = {}) {\n',
     `async function call(method, body, { fetchImpl = fetch, timeoutMs = 8000, token = creds().token } = {}) {\n  return { ok: false, skipped: true, error: '${OFF}Telegram is disabled in this build' };   // NEW STRATEGY LAB: never reaches Telegram\n`, 1],
    ['async function send(text, opt = {}) {\n',
     `async function send(text, opt = {}) {\n  return { ok: false, skipped: true, error: '${OFF}Telegram is disabled in this build' };   // NEW STRATEGY LAB: never sends\n`, 1],
    [coreFrom, coreTo, 1],
  ]);
  edit('dashboard-push.js', [
    ...push,   // the tag is written into the code, so a missing or wrong env setting can never make this bot report as a live one
    // "Ask bot now" and the owner's commands belong to the live bots: a lab bot that polled could take their requests
    ['const askPollSec = () => {', 'const askPollSec = () => 0;   // NEW STRATEGY LAB: never polls the dashboard\nconst unusedAskPollSec = () => {', 1],
  ]);
  const cfg = JSON.parse(fs.readFileSync('bot-config.json', 'utf8'));
  Object.assign(cfg, { mode: 'paper', coins: COINS, startBalance: 200, maxRiskUsd: 0, haltAtR: -60, realisticPaper: true, minTakerFee: 0.0002, ledgerSync: false, ledgerWalletSync: false, heartbeatUrl: '' });
  delete cfg.sharedSizing;
  fs.writeFileSync('bot-config.json', JSON.stringify(cfg, null, 2) + '\n');
  fs.writeFileSync('package.json', JSON.stringify({ name: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), private: true, description: `${label}: paper only. Built by new-strat-lab.` }, null, 2) + '\n');
}

const PATCH = {
  // BB-1H-WIDE = the 1h paper bot with 2.6 sigma bands instead of 2.0
  wide() {
    edit('lucidio-core.js', [['bbLen: 80, bbMult: 2, trendLen: 800,', 'bbLen: 80, bbMult: 2.6, trendLen: 800,', 1]]);
    edit('config.js', [["const ALLOWED_SYMBOLS = Object.freeze(['SOL_USDT', 'ZEC_USDT', 'NEAR_USDT', 'ADA_USDT', 'GALA_USDT']);",
      "const ALLOWED_SYMBOLS = Object.freeze(['SOL_USDT', 'ZEC_USDT', 'NEAR_USDT', 'ADA_USDT', 'GALA_USDT', 'ARB_USDT']);   // NEW STRATEGY LAB: ARB added (paper only)", 1]]);
    edit('lucidio.js', [
      ["console.log(`Lucid'io 1h PAPER check", "console.log(`BB-1H-WIDE PAPER LAB check", 1],
      ["console.log(`Lucid'io 1h ${CFG.mode.toUpperCase()} bot", "console.log(`BB-1H-WIDE LAB ${CFG.mode.toUpperCase()} bot", 1],
    ]);
    common({ coreFrom: "const CORE = 'CORE 1H';", coreTo: "const CORE = 'WIDE LAB';", label: 'BB-1H-WIDE lab',
      push: [["const BOT = String(process.env.DASHBOARD_BOT || '').trim().toLowerCase(), PFX = BOT ? `${BOT}|` : '';", "const BOT = 'bbw', PFX = 'bbw|';   // NEW STRATEGY LAB: tag bbw", 1]] });
  },
  // ICHI-X4 = the T-CORE paper lab's machinery with the ICHI-X4 core (ichi/icore-core.js, copied in by build.js): a fixed stop, no trail, out after 12 candles
  ichi() {
    edit('icore.js', [
      ['// icore.js (BB-TRAIL PAPER LAB)', '// icore.js (ICHI-X4 PAPER LAB, built by new-strat-lab: the strategy is icore-core.js; trail comments below belong to the source bot) (was BB-TRAIL PAPER LAB)', 1],
      ['const liveAllowed = () => false; // BB-TRAIL PAPER LAB:', 'const liveAllowed = () => false; // ICHI-X4 PAPER LAB:', 1],
      // kTrail 0 means "no trailing stop". Without this guard the stop would jump to the best price.
      ['let ns = a > 0 ? p.ext - p.dir * S.kTrail * a : NaN;', 'let ns = a > 0 && S.kTrail > 0 ? p.ext - p.dir * S.kTrail * a : NaN;', 1],
      ['(trails ${S.kTrail} ATR behind the best price, no target)', '(fixed stop, out after ${S.maxBars} candles, no target)', 1],
      ['console.log(`BB-Trail PAPER LAB check · mode', 'console.log(`ICHI-X4 PAPER LAB check · mode', 1],
      ['console.log(`BB-Trail ${CFG.mode.toUpperCase()} LAB bot · coins', 'console.log(`ICHI-X4 LAB ${CFG.mode.toUpperCase()} bot · coins', 1],
    ]);
    common({ coreFrom: "const CORE = 'TRAIL LAB';", coreTo: "const CORE = 'ICHI LAB';", label: 'ICHI-X4 lab',
      push: [["const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'bbtr|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'bbtr', ...extra, data });",
        "const mk = (type, id, tsMs, mode, extra, data) => ({ event_id: 'ichix|' + String(id), type, ts_ms: Math.round(tsMs), mode, bot: 'ichix', ...extra, data });   // NEW STRATEGY LAB: tag ichix", 1]] });
  },
};

const which = process.argv[2];
if (!PATCH[which]) throw new Error('usage: node patches.js wide|ichi (inside the copied bot folder)');
PATCH[which]();
console.log(which + ' patched');
