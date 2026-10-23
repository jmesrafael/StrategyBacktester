// config.js — bot-config.json: defaults, limits and validation, shared by the bot (re-read every run) and the dashboard Settings panel.
// Every value the dashboard may write is listed in FIELDS with hard limits; anything outside them is refused, never clamped silently.
'use strict';
const fs = require('fs'), path = require('path');

const FILE = path.join(__dirname, 'bot-config.json');
const COINS = ['SOL', 'ZEC'];   // the bot trades SOL and ZEC only; adding a coin is a code + research decision, not a setting
const MAX_RISK_PCT = 0.01;      // hard cap: 1% of balance per trade (audit §11 item 7: 0.25-0.5% for a first live phase; 5% = 94% chance of a >50% drawdown)

const DEFAULTS = {
  mode: 'paper', coins: ['SOL', 'ZEC'], riskUsd: 1, riskPct: 0, maxRiskUsd: 10, maxRiskMult: 1.5, maxLeverage: 20, startBalance: 100,
  haltAtR: -39, maxEntryDelaySec: 900, wakeDelaySec: 2, heartbeatUrl: '',
  ledgerSync: false,   // true = post the real MEXC equity to the Lucid'io Ledger after every run (see ledger-sync.js); set by hand in this file
};

// type, limits, and what the Settings panel shows. "live: true" = takes effect for real money.
const FIELDS = {
  mode:             { type: 'enum', values: ['paper', 'live'], label: 'Mode', help: 'paper = simulated account; live = real orders on MEXC' },
  coins:            { type: 'coins', values: COINS, min: 1, label: 'Coins', help: 'the bot trades SOL and ZEC only; untick one to pause it' },
  riskPct:          { type: 'number', min: 0, max: MAX_RISK_PCT, label: 'Risk per trade (% of balance)', help: '0 = use the fixed $ amount instead. Hard cap 1%; the audit suggests 0.25–0.5% for a first live phase' },
  riskUsd:          { type: 'number', min: 0.1, max: 100, label: 'Fixed risk per trade ($)', help: 'used when % risk is 0' },
  maxRiskUsd:       { type: 'number', min: 0.5, max: 500, label: 'Max risk per trade ($)', help: 'hard cap on any trade, also when % risk grows the amount' },
  maxRiskMult:      { type: 'number', min: 1, max: 3, label: 'Max over-size from contract rounding (×)', help: 'skip a trade if whole contracts would risk more than this × the target' },
  maxLeverage:      { type: 'int', min: 1, max: 50, label: 'Max leverage (×)', help: 'isolated; the bot picks lower so liquidation is ~2× the stop distance' },
  startBalance:     { type: 'number', min: 10, max: 1e6, label: 'Paper start balance ($)', help: 'paper mode only; live uses the real MEXC equity' },
  haltAtR:          { type: 'number', min: -100, max: -5, label: 'Halt after a drawdown of (R)', help: 'no new entries once the account is this far below its best point; report: 39R' },
  maxEntryDelaySec: { type: 'int', min: 60, max: 3600, label: 'Skip a signal if later than (seconds)', help: 'research: 5–60 min late costs about nothing; 2 h costs ~11%' },
  wakeDelaySec:     { type: 'int', min: 0, max: 60, label: 'Wake after the 4h close (seconds)', help: 'the bot also waits for MEXC to show the new candle' },
  heartbeatUrl:     { type: 'url', label: 'Missed-run alert URL', help: 'free healthchecks.io ping URL; empty = off' },
};

function read() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } }
// coins outside COINS are dropped even if typed into the file by hand: the bot never trades them
function load() {
  const cfg = { ...DEFAULTS, ...read() };
  cfg.coins = (Array.isArray(cfg.coins) ? cfg.coins : []).filter((x) => COINS.includes(x));
  if (!cfg.coins.length) cfg.coins = [...DEFAULTS.coins];
  // a hand-edited file may not exceed the cap: clamp (and say so, see lucidio.js runOnce) instead of trading bigger than allowed
  const rp = Number(cfg.riskPct);
  if (!Number.isFinite(rp) || rp < 0) cfg.riskPct = DEFAULTS.riskPct;
  else if (rp > MAX_RISK_PCT) { cfg.riskPctClamped = rp; cfg.riskPct = MAX_RISK_PCT; }
  else delete cfg.riskPctClamped;
  return cfg;
}

// patch = only the fields to change. Returns { ok, errors: {field: msg}, next } — next = the full config that would be written.
function validate(patch, current = load()) {
  const errors = {}, next = { ...current };
  for (const [k, v] of Object.entries(patch || {})) {
    const f = FIELDS[k];
    if (!f) { errors[k] = 'unknown setting'; continue; }
    if (f.type === 'enum') { if (!f.values.includes(v)) errors[k] = `must be one of ${f.values.join(', ')}`; else next[k] = v; }
    else if (f.type === 'coins') {
      if (!Array.isArray(v) || v.length < f.min || v.some((c) => !f.values.includes(c)) || new Set(v).size !== v.length) errors[k] = `pick 1+ of ${f.values.join(', ')}`;
      else next[k] = f.values.filter((c) => v.includes(c));
    } else if (f.type === 'url') {
      if (typeof v !== 'string' || (v !== '' && !/^https:\/\/[^\s]+$/.test(v))) errors[k] = 'empty, or an https:// URL'; else next[k] = v;
    } else {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || (f.type === 'int' && !Number.isInteger(n))) errors[k] = f.type === 'int' ? 'whole number' : 'number';
      else if (n < f.min || n > f.max) errors[k] = `between ${f.min} and ${f.max}`;
      else next[k] = n;
    }
  }
  if (!errors.maxRiskUsd && !errors.riskUsd && next.riskPct === 0 && next.riskUsd > next.maxRiskUsd) errors.riskUsd = `above the max risk ($${next.maxRiskUsd})`;
  return { ok: !Object.keys(errors).length, errors, next };
}

// writes atomically, keeps keys this file does not know about. Returns the list of changes [{k, from, to}].
function save(next) {
  const before = load(), out = { ...read() };
  for (const k of Object.keys(FIELDS)) if (next[k] !== undefined) out[k] = next[k];
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2) + '\n');
  fs.renameSync(tmp, FILE);
  return Object.keys(FIELDS).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(out[k])).map((k) => ({ k, from: before[k], to: out[k] }));
}

module.exports = { FILE, COINS, MAX_RISK_PCT, DEFAULTS, FIELDS, load, validate, save };
