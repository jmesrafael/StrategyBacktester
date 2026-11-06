// test/risk-tiers-test.js — risk per trade that steps DOWN as the account grows (Oct 29, 2026): 2.5% below $500, 2.0% from $500, 1.5% from $1,000,
// judged on the HIGHEST balance so far (a step down is permanent: risk never rises in a drawdown), and maxRiskUsd 0 = no $ cap. No network, no money.
//   node test/risk-tiers-test.js
'use strict';
process.env.ICORE_STATE_DIR = require('path').join(require('os').tmpdir(), 'i-core-tiers-state');
process.env.ICORE_NO_NOTIFY = '1';
const config = require('../config.js');
const bot = require('../icore.js');
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

// defaults
ok(JSON.stringify(config.DEFAULTS.riskTiers) === '[[0,0.025],[500,0.02],[1000,0.015]]' && config.DEFAULTS.maxRiskUsd === 0, 'defaults: steps 2.5% / 2.0% from $500 / 1.5% from $1,000, and no $ cap (maxRiskUsd 0)');
// the step table
const cfg = { riskPct: 0.005, riskTiers: config.DEFAULTS.riskTiers };
ok([[0, 0.025], [172, 0.025], [499.99, 0.025], [500, 0.02], [999, 0.02], [1000, 0.015], [1e6, 0.015]].every(([b, p]) => near(config.riskPctFor(cfg, b), p)), 'riskPctFor: $0-499 -> 2.5%, $500-999 -> 2.0%, $1,000+ -> 1.5%');
ok(near(config.riskPctFor({ riskPct: 0.005, riskTiers: [] }, 5000), 0.005), 'no steps ([]) -> riskPct is used, as before');
// validation
const bad = [[[100, 0.02]], [[0, 0.02], [500, 0.06]], [[0, 0.02], [500, 0.01], [400, 0.01]], [[0, 0]], 'x', [[0]]];
ok(bad.every((t) => config.tiersError(t)) && !config.tiersError([]) && !config.tiersError(config.DEFAULTS.riskTiers), 'tiersError: must start at 0, balances going up, each risk above 0 and at most 5%; [] is allowed');
ok(config.validate({ riskTiers: [[0, 0.03], [2000, 0.01]] }, { ...config.DEFAULTS }).ok && !config.validate({ riskTiers: [[0, 0.09]] }, { ...config.DEFAULTS }).ok, 'validate: a good table is accepted, a step above the 5% hard cap is refused');
ok(config.validate({ maxRiskUsd: 0 }, { ...config.DEFAULTS }).ok, 'validate: maxRiskUsd 0 (no cap) is accepted');
// sizing in the bot
const C = bot.CFG, keep = { riskTiers: C.riskTiers, riskPct: C.riskPct, maxRiskUsd: C.maxRiskUsd };
Object.assign(C, { riskTiers: config.DEFAULTS.riskTiers, riskPct: 0.005, maxRiskUsd: 0 });
let a = { balance: 172 };
ok(near(bot.riskFor(a), 172 * 0.025) && a.peakBalance === 172, `$172 account: risk $${bot.riskFor(a).toFixed(2)} = 2.5%, and the peak is remembered`);
a = { balance: 800, peakBalance: 800 }; ok(near(bot.riskFor(a), 16), '$800: 2.0% = $16');
a = { balance: 20000, peakBalance: 20000 }; ok(near(bot.riskFor(a), 300), '$20,000: 1.5% = $300, NOT capped at $10 (no cap)');
a = { balance: 700, peakBalance: 1200 }; ok(near(bot.riskFor(a), 700 * 0.015) && a.peakBalance === 1200, 'drawdown from $1,200 to $700: still 1.5% (the step down is permanent; risk never rises while losing)');
Object.assign(C, { maxRiskUsd: 50 }); a = { balance: 20000, peakBalance: 20000 }; ok(near(bot.riskFor(a), 50), 'a cap can still be set: maxRiskUsd 50 -> $50');
Object.assign(C, { riskTiers: [], riskPct: 0.01, maxRiskUsd: 0 }); a = { balance: 3000 }; ok(near(bot.riskFor(a), 30), 'steps off ([]): flat riskPct 1% of $3,000 = $30, as before');
Object.assign(C, keep);
console.log(`\n${pass} passed, ${failN} failed`);
process.exitCode = failN ? 1 : 0;
