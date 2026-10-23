// envfile.js - loads KEY=VALUE lines from <app folder>/.env into process.env (only for keys that are not already set).
// This is "the server env file": TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DASHBOARD_URL, DASHBOARD_PUSH_SECRET, ... (template: deploy/lucidio.env.example).
// The service and every CLI command (check, telegram-setup, dashboard-backfill) read it the same way. Values are never printed or logged.
'use strict';
const fs = require('fs'), path = require('path');

function parse(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}

// returns the list of variable NAMES that were set from the file (never the values)
function load(file = process.env.LUCIDIO_ENV_FILE || path.join(__dirname, '.env')) {
  let text; try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const set = [];
  for (const [k, v] of Object.entries(parse(text))) if (process.env[k] === undefined && v !== '') { process.env[k] = v; set.push(k); }
  return set;
}

module.exports = { load, parse };
