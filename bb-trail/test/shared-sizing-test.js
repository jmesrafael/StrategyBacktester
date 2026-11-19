// test/shared-sizing-test.js — TRI-CORE shared sizing (Nov 20, 2026): a live trade is sized from (all live wallets) × this bot's weight,
// the risk steps go by that base's highest value, and ANY problem with another wallet's reading falls back to this wallet's own balance.
// No network, no money. Uses a temp wallets file.   node test/shared-sizing-test.js
'use strict';
const os = require('os'), fs = require('fs'), path = require('path');
process.env.ICORE_STATE_DIR = path.join(os.tmpdir(), 'i-core-shared-state');
process.env.ICORE_NO_NOTIFY = '1';
const config = require('../config.js');
const ss = require('../shared-sizing.js');
const bot = require('../icore.js');
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-'));
const now = Date.now();
const file = (name, wallets) => { const f = path.join(dir, name + '.json'); fs.writeFileSync(f, JSON.stringify({ generated_ms: now, wallets })); return f; };
const W = { lucidio: { ok: true, mode: 'live', equity: 337.14, ts_ms: now - 60e3 }, icore: { ok: true, mode: 'live', equity: 158.95, ts_ms: now - 90e3 }, tcore: { ok: true, mode: 'live', equity: 182.87, ts_ms: now - 120e3 } };
const good = file('good', W);
const cfgOn = (extra = {}) => ({ riskTiers: config.DEFAULTS.riskTiers, riskPct: 0.005, maxRiskUsd: 0, mode: 'live',
  sharedSizing: { on: true, weight: 0.25, others: ['lucidio', 'tcore'], file: good, maxAgeMin: 300, ...extra } });
const total = 337.14 + 158.95 + 182.87;

// the base
let b = ss.base(cfgOn(), 158.95, { now });
ok(b.shared && near(b.total, total) && near(b.base, total * 0.25), `I-CORE today: total $${b.total.toFixed(2)} × 25% = base $${b.base.toFixed(2)}`);
ok(!ss.base({ mode: 'live' }, 158.95, { now }).shared && ss.base({ mode: 'live' }, 158.95, { now }).base === 158.95, 'no sharedSizing block -> own balance, as before');
ok(!ss.base(cfgOn({ on: false }), 158.95, { now }).shared, 'on:false -> own balance');
let f = ss.base(cfgOn({ weight: 2 }), 158.95, { now }); ok(!f.shared && f.base === 158.95 && /weight/.test(f.why), 'weight above 1 -> own balance, reason given');
f = ss.base(cfgOn({ others: [] }), 158.95, { now }); ok(!f.shared && /others/.test(f.why), 'no other wallets named -> own balance');
f = ss.base(cfgOn({ file: path.join(dir, 'missing.json') }), 158.95, { now }); ok(!f.shared && f.base === 158.95 && /no wallets file/.test(f.why), 'no wallets file -> own balance, says why');
const junk = path.join(dir, 'junk.json'); fs.writeFileSync(junk, '{oops');
f = ss.base(cfgOn({ file: junk }), 158.95, { now }); ok(!f.shared && /unreadable/.test(f.why), 'a broken wallets file -> own balance');
f = ss.base(cfgOn({ file: file('nt', { lucidio: W.lucidio }) }), 158.95, { now }); ok(!f.shared && /tcore: no reading/.test(f.why), 'a wallet missing from the file -> own balance, says which');
f = ss.base(cfgOn({ file: file('old', { ...W, tcore: { ...W.tcore, ts_ms: now - 6 * 3600e3 } }) }), 158.95, { now }); ok(!f.shared && /360 min old/.test(f.why), 'a reading older than 5 h -> own balance (a stale total is never used)');
f = ss.base(cfgOn({ file: file('pp', { ...W, tcore: { ...W.tcore, mode: 'paper' } }) }), 158.95, { now }); ok(!f.shared && /not a live wallet/.test(f.why), 'a paper wallet is never counted as capital');
f = ss.base(cfgOn({ file: file('ne', { ...W, tcore: { ok: false, why: 'no reading' } }) }), 158.95, { now }); ok(!f.shared, 'a wallet the exporter could not read -> own balance');
f = ss.base(cfgOn(), 0, { now }); ok(!f.shared, 'own equity unknown (0) -> not shared');

// the exporter (BB-Core/wallets-export.js) writes exactly what this reads
let ex = null; for (const p of ['../wallets-export.js', '../../🔴BB-Core/wallets-export.js', '../../../🔴BB-Core/wallets-export.js']) { try { ex = require(p); break; } catch {} }
if (ex) {
  const snap = (n, rows) => { const p = path.join(dir, n + '.jsonl'); fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); return p; };
  const doc = ex.build({ lucidio: snap('l', [{ mode: 'live', equity: 1, ts_ms: now - 9e6 }, { mode: 'live', equity: 337.14, ts_ms: now - 60e3 }]), tcore: snap('t', [{ mode: 'live', equity: 182.87, ts_ms: now - 60e3 }]) }, now);
  const out = path.join(dir, 'exported.json'); ex.writeAtomic(out, doc);
  const e = ss.base(cfgOn({ file: out }), 158.95, { now });
  ok(e.shared && near(e.total, total), 'exporter -> file -> sizing: the newest line of each journal is used end to end');
  ok(ex.build({ x: path.join(dir, 'none.jsonl') }).wallets.x.ok === false, 'exporter: a missing journal is written as not ok (bots then fall back)');
}

// sizing in the bot
const C = bot.CFG, keep = JSON.parse(JSON.stringify({ riskTiers: C.riskTiers, riskPct: C.riskPct, maxRiskUsd: C.maxRiskUsd, mode: C.mode, sharedSizing: C.sharedSizing === undefined ? null : C.sharedSizing }));
Object.assign(C, cfgOn());
let a = { balance: 158.95 };
const r = bot.riskFor(a);
ok(near(r, total * 0.25 * 0.025), `live I-CORE: risk $${r.toFixed(2)} = 2.5% of the shared base $${(total * 0.25).toFixed(2)} (was $${(158.95 * 0.025).toFixed(2)} on its own wallet)`);
ok(near(a.peakShared, total * 0.25) && a.peakBalance === 158.95, 'the base peak is remembered separately (peakShared); the wallet peak is kept too');
ok(!Object.keys(a).includes('lastSizing') && a.lastSizing && a.lastSizing.shared, 'lastSizing is there for the ENTER line but never saved with the state');
a = { balance: 158.95, peakShared: 2400 }; ok(near(bot.riskFor(a), total * 0.25 * 0.015), 'steps go by the base peak: a base that once reached $2,400 risks 1.5% (permanent step down, as before)');
Object.assign(C, cfgOn({ weight: 0.5, others: ['icore', 'tcore'] })); a = { balance: 337.14 };
ok(near(bot.riskFor(a), total * 0.5 * 0.025), `BB-CORE weight 50%: base $${(total * 0.5).toFixed(2)} < $500 -> 2.5% = $${(total * 0.5 * 0.025).toFixed(2)}`);
Object.assign(C, cfgOn({ file: path.join(dir, 'missing.json') })); a = { balance: 158.95 };
ok(near(bot.riskFor(a), 158.95 * 0.025) && /no wallets file/.test(a.lastSizing.why), 'no wallets file: falls back to 2.5% of its own $158.95, reason kept for the log');
Object.assign(C, cfgOn(), { mode: 'paper' }); a = { balance: 100 };
ok(near(bot.riskFor(a), 2.5) && !a.lastSizing.shared, 'paper mode never shares (only real wallets are pooled)');
ok(/shared base \$169\.74 = total \$678\.96 × 25%/.test(ss.text(ss.base(cfgOn(), 158.95, { now }))), 'log text: "shared base $169.74 = total $678.96 × 25%"');
Object.assign(C, keep); if (keep.sharedSizing === null) delete C.sharedSizing;
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${failN} failed`);
process.exitCode = failN ? 1 : 0;
