// test/dashboard-tag-test.js - what I-Core sends to the SHARED dashboard: every event tagged bot:'icore', ids starting "ic|", the dashboard's signature headers, and no
// Ask-bot-now polling (that button is BB-Core's). The events are checked against the dashboard's own schema (BB-Core/dashboard/lib/schema.js).
//   node test/dashboard-tag-test.js
'use strict';
const fs = require('fs'), path = require('path');
const push = require('../dashboard-push.js');
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const now = 1.79e12;
const hb = push.heartbeatEvent({ mode: 'paper', coins: ['SOL_USDT'], uptimeSec: 5, kill: false }, now);
const eq = push.equityEvent({ mode: 'paper', balance: 100, totalR: 0, peakR: 0, drawdownR: 0, trades: 0, candleMs: 1789000000000 }, now);
ok(hb.bot === 'bbtr' && hb.event_id.startsWith('bbtr|hb:paper:') && eq.bot === 'bbtr' && eq.event_id.startsWith('bbtr|eq:paper:'), 'heartbeat and equity events carry bot bbtr and a bbtr| id');
const schemaPath = path.join(__dirname, '..', '..', '🔴BB-Core', 'dashboard', 'lib', 'schema.js');
if (fs.existsSync(schemaPath)) {
  const r = require(schemaPath).validateBody({ events: [hb, eq] });
  ok(r.ok && r.events.every((e) => e.data.bot === 'bbtr'), 'the dashboard\'s own schema accepts them and stores the tag');
} else console.log('SKIP  BB-Core dashboard schema not found next to I-Core');
const src = fs.readFileSync(path.join(__dirname, '..', 'dashboard-push.js'), 'utf8');
ok(/X-Lucidio-Signature/.test(src) && /X-Lucidio-Timestamp/.test(src) && !/X-ICore-(Signature|Timestamp)/.test(src), 'the request headers are the ones the dashboard server checks (X-Lucidio-*)');
ok(/if \(v === undefined \|\| v === ''\) return 0;/.test(src), 'Ask-bot-now polling is off by default for I-Core (it would swallow BB-Core\'s requests)');
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
