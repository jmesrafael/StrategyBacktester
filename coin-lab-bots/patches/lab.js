// The edits every COIN LAB bot gets on top of its own paper build (coin-bb.js / coin-tc.js):
//   - SUI_USDT and ARB_USDT added to the coin allowlist (config.js layer 1; layer 2 only guards live orders, which are locked off)
//   - the dashboard tag (event ids '<tag>|...', bot: '<tag>') so the dashboard keeps the lab apart from every other bot
//   - Telegram disabled in the code (send and call never reach the network, whatever the environment holds)
//   - the paper config: $100 start, the bot's own risk steps and halt, realistic paper costs, nothing sent to the ledger
// No strategy change: the entry and exit rules are the original bot's, byte for byte.
'use strict';
const fs = require('fs');
const { edit } = require('./edit.js');

const ALLOW_FROM = "const ALLOWED_SYMBOLS = Object.freeze(['SOL_USDT', 'ZEC_USDT', 'NEAR_USDT', 'ADA_USDT', 'GALA_USDT', 'ETH_USDT']);";
const ALLOW_TO = "const ALLOWED_SYMBOLS = Object.freeze(['SOL_USDT', 'ZEC_USDT', 'NEAR_USDT', 'ADA_USDT', 'GALA_USDT', 'ETH_USDT', 'SUI_USDT', 'ARB_USDT']);   // COIN LAB: SUI and ARB added (paper only)";

function applyLab({ codeFilesFrom, codeFilesTo, mk, coreFrom, coreTo, coins, label }) {
  edit('config.js', [[ALLOW_FROM, ALLOW_TO, 1]]);
  if (codeFilesFrom) edit('journal.js', [[codeFilesFrom, codeFilesTo, 1]]);
  edit('dashboard-push.js', [[mk[0], mk[1], 1]]);
  edit('telegram.js', [
    ['async function call(method, body, { fetchImpl = fetch, timeoutMs = 8000, token = creds().token } = {}) {\n',
     "async function call(method, body, { fetchImpl = fetch, timeoutMs = 8000, token = creds().token } = {}) {\n  return { ok: false, skipped: true, error: 'coin lab: Telegram is disabled in this build' };   // COIN LAB: never reaches Telegram\n", 1],
    ['async function send(text, opt = {}) {\n',
     "async function send(text, opt = {}) {\n  return { ok: false, skipped: true, error: 'coin lab: Telegram is disabled in this build' };   // COIN LAB: never sends, whatever the environment holds\n", 1],
    [coreFrom, coreTo, 1],
  ]);
  const cfg = JSON.parse(fs.readFileSync('bot-config.json', 'utf8'));
  Object.assign(cfg, { mode: 'paper', coins, startBalance: 100, realisticPaper: true, minTakerFee: 0.0002, ledgerSync: false, ledgerWalletSync: false, heartbeatUrl: '' });
  fs.writeFileSync('bot-config.json', JSON.stringify(cfg, null, 2) + '\n');
  if (fs.existsSync('package.json')) { const p = JSON.parse(fs.readFileSync('package.json', 'utf8')); p.name = label.toLowerCase().replace(/[^a-z0-9]+/g, '-'); p.description = `${label}: paper only, no Telegram. Built by coin-lab-bots.`; fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n'); }
}
module.exports = { applyLab };
