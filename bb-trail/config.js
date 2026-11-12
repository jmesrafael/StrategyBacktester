// config.js — bot-config.json: defaults, limits and validation, shared by the bot (re-read every run) and the dashboard Settings panel.
// Every value the dashboard may write is listed in FIELDS with hard limits; anything outside them is refused, never clamped silently.
'use strict';
const fs = require('fs'), path = require('path');

const FILE = path.join(__dirname, 'bot-config.json');
// THE allowlist: the only contracts this bot may ever trade. Defined once, enforced in three layers (config load, every order-placement
// function in paper.enter / live.enter / mexc.createOrder, and the tests in test/selftest.js). Adding a coin is a code + research decision.
// I-Core starts on the same five coins as bb-core (SOL, ZEC, NEAR, ADA, GALA): the Ichimoku strategy was tuned on 2020-2022 data of these five and judged on
// 2023-2026 (research: StrategyBacktester/research/big-swings, RESULTS-search5.md). Caveat kept on purpose: a few giant winners (ZEC in 2025) carry most of the profit.
// ETH was added and ZEC retired on Nov 12, 2026 (owner's decision; ZEC is being delisted): ETH was the best replacement of 45 coins over 7 years,
// 9 coins over 10 years and the top 100 (StrategyBacktester research/zec-replacement). ZEC stays in this list ONLY so the ZEC trades still open
// are managed to their exit (a coin in the allowlist but not in "coins" gets no new entries); bot-config.json no longer lists it.
// SUI and ARB were added on Nov 12, 2026 for T-CORE LIVE (owner's decision, live without a paper period): added together to the five coins from Jun 2023 to
// Nov 2026 they lift T-CORE from +355R to +453R while its worst drop stays about the same (34.5R -> 34.9R) (StrategyBacktester research/coin-walkforward/SUI-ARB.md,
// MONTHLY.md). Caveats kept on purpose: 60% of SUI's T-CORE profit is one month (Feb 2024) and about half of ARB's is one month (Oct 2026); ARB alone deepens the
// worst drop (40.7R), only the pair keeps it flat; the coins were picked after seeing the results. MEXC: 1 contract = 1 SUI / 1 ARB. The paper lab (bbtr) keeps
// its own coin list in bot-config.json (unchanged); only the live build (apply-tcore-live-patch.js) turns SUI and ARB on.
const ALLOWED_SYMBOLS = Object.freeze(['SOL_USDT', 'ZEC_USDT', 'NEAR_USDT', 'ADA_USDT', 'GALA_USDT', 'ETH_USDT', 'SUI_USDT', 'ARB_USDT']);
const COINS = ALLOWED_SYMBOLS.map((s) => s.replace(/_USDT$/, ''));   // ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB']: the short names used in the config and state
class SymbolNotAllowedError extends Error { constructor(msg) { super(msg); this.name = 'SymbolNotAllowedError'; this.code = 'SYMBOL_NOT_ALLOWED'; } }
// throws unless `symbol` is exactly one of ALLOWED_SYMBOLS (a coin name like 'SOL' is NOT a symbol: pass `${coin}_USDT`)
function assertAllowedSymbol(symbol, what = 'order') {
  if (typeof symbol !== 'string' || !ALLOWED_SYMBOLS.includes(symbol)) throw new SymbolNotAllowedError(`${what} refused: ${JSON.stringify(symbol)} is not in the allowlist ${ALLOWED_SYMBOLS.join(', ')}`);
  return symbol;
}
const coinToSymbol = (coin) => `${coin}_USDT`;
const MAX_RISK_PCT = 0.05;      // hard cap: 5% of balance per trade. Raised from 1% on Oct 24, 2026 at the owner's explicit request (the audit, §11 item 7, advised 0.25-0.5% for a first live phase: 5% = 94% chance of a >50% drawdown)

const DEFAULTS = {
  mode: 'paper', coins: ['SOL', 'ETH', 'NEAR', 'ADA', 'GALA'], riskUsd: 1, riskPct: 0.005, maxRiskUsd: 0,
  // risk steps DOWN as the account grows (Oct 29, 2026, owner's decision): [balance from ($, highest balance so far), risk per trade]. Replaces riskPct while set; [] = off.
  riskTiers: [[0, 0.025], [500, 0.02], [1000, 0.015]], maxRiskMult: 1.5, maxLeverage: 20, startBalance: 100,
  haltAtR: -35, maxEntryDelaySec: 900, wakeDelaySec: 2, heartbeatUrl: '',
  ledgerSync: false,   // I-Core runs in its OWN account: keep this false so its balance is never mixed into the investor ledger
  ledgerWalletSync: false,   // true = send THIS wallet's own report (its equity, withdrawable, positions) to the ledger under its own wallet name and key (see ledger-sync.js). The ledger keeps the wallets apart and adds them; this is not the shared-total path above. Off: nothing is sent
};

// type, limits, and what the Settings panel shows. "live: true" = takes effect for real money.
const FIELDS = {
  mode:             { type: 'enum', values: ['paper', 'live'], label: 'Mode', help: 'paper = simulated account; live = real orders on MEXC' },
  coins:            { type: 'coins', values: COINS, min: 1, label: 'Coins', help: 'the bot trades SOL, ETH, NEAR, ADA and GALA (T-CORE live also SUI and ARB, added Nov 12, 2026); ZEC is retired (it only finishes trades already open); untick one to pause it' },
  riskPct:          { type: 'number', min: 0, max: MAX_RISK_PCT, label: 'Risk per trade (% of balance)', help: '0 = use the fixed $ amount instead. Hard cap 5% (raised from 1% on Oct 24, 2026); the audit suggests 0.25–0.5% for a first live phase' },
  riskUsd:          { type: 'number', min: 0.1, max: 100, label: 'Fixed risk per trade ($)', help: 'used when % risk is 0' },
  maxRiskUsd:       { type: 'number', min: 0, max: 500, label: 'Max risk per trade ($)', help: '0 = no cap (default since Oct 29, 2026). Otherwise a hard cap on any trade, also when % risk grows the amount' },
  riskTiers:        { type: 'tiers', label: 'Risk steps (balance $ -> % per trade)', help: 'risk per trade by the HIGHEST balance so far, e.g. [[0,0.025],[500,0.02],[1000,0.015]]; a step down never goes back up in a drawdown. [] = use riskPct' },
  maxRiskMult:      { type: 'number', min: 1, max: 3, label: 'Max over-size from contract rounding (×)', help: 'skip a trade if whole contracts would risk more than this × the target risk' },
  maxLeverage:      { type: 'int', min: 1, max: 50, label: 'Max leverage (×)', help: 'isolated; the bot picks lower so liquidation is ~2× the stop distance' },
  startBalance:     { type: 'number', min: 10, max: 1e6, label: 'Paper start balance ($)', help: 'paper mode only; live uses the real MEXC equity' },
  haltAtR:          { type: 'number', min: -100, max: -5, label: 'Halt after a drawdown of (R)', help: 'no new entries once the account is this far below its best point; research: worst drop 30R' },
  maxEntryDelaySec: { type: 'int', min: 60, max: 3600, label: 'Skip a signal if later than (seconds)', help: 'wide stops (about 6% of price): a late entry costs little in the research; one candle late cost about 6% of the profit' },
  wakeDelaySec:     { type: 'int', min: 0, max: 60, label: 'Wake after the 4h close (seconds)', help: 'the bot also waits for MEXC to show the new candle' },
  heartbeatUrl:     { type: 'url', label: 'Missed-run alert URL', help: 'free healthchecks.io ping URL; empty = off' },
};

function read() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } }
class ConfigError extends Error { constructor(msg) { super(msg); this.name = 'ConfigError'; } }
// Layer 1 of the allowlist: a coin / symbol outside ALLOWED_SYMBOLS in the file is an ERROR, not something to drop quietly. The bot refuses to start
// (and a running bot refuses to trade that run) until the file is fixed. "SOL" and "SOL_USDT" are both accepted and normalised to "SOL".
function load() {
  const raw = read();
  const cfg = { ...DEFAULTS, ...raw };
  if (raw.coins !== undefined) {
    if (!Array.isArray(raw.coins)) throw new ConfigError(`bot-config.json: "coins" must be a list like ["SOL","ZEC"], not ${JSON.stringify(raw.coins)}`);
    const bad = raw.coins.filter((c) => typeof c !== 'string' || !ALLOWED_SYMBOLS.includes(c.endsWith('_USDT') ? c : coinToSymbol(c)));
    if (bad.length) throw new ConfigError(`bot-config.json: coin(s) ${JSON.stringify(bad)} are not allowed. This bot trades only ${ALLOWED_SYMBOLS.join(', ')}. Fix bot-config.json "coins".`);
    cfg.coins = [...new Set(raw.coins.map((c) => c.replace(/_USDT$/, '')))];
  }
  if (!cfg.coins.length) cfg.coins = [...DEFAULTS.coins];
  // a hand-edited file may not exceed the cap: clamp (and say so, see icore.js runOnce) instead of trading bigger than allowed
  const rp = Number(cfg.riskPct);
  if (!Number.isFinite(rp) || rp < 0) cfg.riskPct = DEFAULTS.riskPct;
  else if (rp > MAX_RISK_PCT) { cfg.riskPctClamped = rp; cfg.riskPct = MAX_RISK_PCT; }
  else delete cfg.riskPctClamped;
  if (tiersError(cfg.riskTiers)) { cfg.riskTiersInvalid = cfg.riskTiers; cfg.riskTiers = []; } else delete cfg.riskTiersInvalid;
  return cfg;
}

// [[usdFrom, pct], ...]: starts at 0, ascending balances, every pct in (0, MAX_RISK_PCT]. [] is valid (= off). Returns an error text or null.
function tiersError(v) {
  if (!Array.isArray(v)) return 'a list like [[0,0.025],[500,0.02]]';
  if (!v.length) return null;
  if (v.some((t) => !Array.isArray(t) || t.length !== 2 || !Number.isFinite(+t[0]) || !Number.isFinite(+t[1]))) return 'each step is [balance $, risk fraction]';
  if (+v[0][0] !== 0) return 'the first step must start at balance 0';
  for (let i = 1; i < v.length; i++) if (!(+v[i][0] > +v[i - 1][0])) return 'balances must go up';
  if (v.some((t) => !(+t[1] > 0 && +t[1] <= MAX_RISK_PCT))) return `every risk must be above 0 and at most ${MAX_RISK_PCT}`;
  return null;
}
// the risk fraction for an account whose highest balance so far is peakUsd: the last step reached, or riskPct when no table is set
function riskPctFor(cfg, peakUsd) {
  const t = Array.isArray(cfg.riskTiers) ? cfg.riskTiers : [];
  if (!t.length) return cfg.riskPct;
  let pct = t[0][1];
  for (const [from, p] of t) if (peakUsd >= from) pct = p;
  return pct;
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
    } else if (f.type === 'tiers') {
      const e = tiersError(v); if (e) errors[k] = e; else next[k] = v.map(([a, p]) => [+a, +p]);
    } else if (f.type === 'url') {
      if (typeof v !== 'string' || (v !== '' && !/^https:\/\/[^\s]+$/.test(v))) errors[k] = 'empty, or an https:// URL'; else next[k] = v;
    } else {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || (f.type === 'int' && !Number.isInteger(n))) errors[k] = f.type === 'int' ? 'whole number' : 'number';
      else if (n < f.min || n > f.max) errors[k] = `between ${f.min} and ${f.max}`;
      else next[k] = n;
    }
  }
  if (!errors.maxRiskUsd && !errors.riskUsd && next.riskPct === 0 && next.maxRiskUsd > 0 && next.riskUsd > next.maxRiskUsd) errors.riskUsd = `above the max risk ($${next.maxRiskUsd})`;
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

module.exports = { FILE, COINS, ALLOWED_SYMBOLS, assertAllowedSymbol, coinToSymbol, SymbolNotAllowedError, ConfigError, MAX_RISK_PCT, DEFAULTS, FIELDS, load, validate, save, riskPctFor, tiersError };
