// shared-sizing.js — size every trade from the TOTAL of all three live wallets × this bot's weight (TRI-CORE "Shared + rebalance 3 mo").
// Study: 🔴StrategyBacktester/research/capital-split, report /capital-split.html (Nov 19, 2026). Switched on live Nov 20, 2026 at the owner's request.
//
// The money stays in each bot's own MEXC sub-account (so two bots can still hold the same coin); only the number a trade is sized from is shared:
//   base = (own equity now + the other live wallets' newest equity readings) × weight          BB-CORE 0.50, I-CORE 0.25, T-CORE 0.25
// The risk steps (2.5% / 2% from $500 / 1.5% from $1,000) are looked up on this base's highest value so far, so they step down at the same point
// they would for a wallet holding exactly its share: the change is the sizing method only, not the risk level.
// The cash follows the sizing through the quarterly rebalance (reminder on the manager dashboard + Telegram, Jan/Apr/Jul/Oct 1).
//
// Where the other wallets come from: each bot runs as its own Linux user and cannot read the others' journals, so a root timer (wallets-export.js,
// every 5 min) copies ONLY each wallet's newest { mode, equity, ts_ms } into a world-readable file. No key, no exchange call, no order.
//
// Safety: if the file or any other wallet's reading is missing, unreadable, not live or older than maxAgeMin, the bot sizes from its OWN equity
// exactly as before, and the ENTER line says why.
//
// bot-config.json:  "sharedSizing": { "on": true, "weight": 0.5, "others": ["icore", "tcore"],
//                                      "file": "/var/lib/lucidio-wallets/wallets.json", "maxAgeMin": 300 }
'use strict';
const fs = require('fs');
const FILE = '/var/lib/lucidio-wallets/wallets.json';

// The config block if it is switched on and valid, else null. A bad block is never traded on.
function settings(cfg) {
  const s = cfg && cfg.sharedSizing;
  if (!s || s.on !== true) return null;
  const w = Number(s.weight);
  if (!(w > 0 && w <= 1) || !Array.isArray(s.others) || !s.others.length || s.others.some((n) => typeof n !== 'string' || !n)) return { invalid: 'sharedSizing needs on, weight (0-1] and the other wallets\' names in "others"' };
  return { weight: w, others: s.others, file: s.file || FILE, maxAgeMin: Number(s.maxAgeMin) > 0 ? Number(s.maxAgeMin) : 300 };
}

const readFile = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { error: e.code === 'ENOENT' ? 'no wallets file' : 'wallets file unreadable' }; } };

// One other wallet's reading from the exported file: { name, ok, equity, ts_ms, why }
function readWallet(name, doc, now, maxAgeMin) {
  const s = doc && doc.wallets && doc.wallets[name];
  if (!s) return { name, ok: false, why: `${name}: no reading` };
  if (s.mode !== 'live') return { name, ok: false, why: `${name}: not a live wallet (mode ${s.mode})` };
  const eq = Number(s.equity), ts = Number(s.ts_ms);
  if (s.equity == null || !(eq >= 0)) return { name, ok: false, why: `${name}: reading has no equity` };
  if (!(ts > 0) || now - ts > maxAgeMin * 60e3) return { name, ok: false, why: `${name}: reading is ${ts > 0 ? Math.round((now - ts) / 60e3) + ' min' : 'of unknown age,'} old (max ${maxAgeMin})` };
  return { name, ok: true, equity: eq, ts_ms: ts };
}

// The sizing base for this bot. own = this wallet's equity right now.
// Returns { shared: true, base, total, weight, parts } or { shared: false, base: own, why } (fallback = per-wallet sizing as before).
function base(cfg, own, { now = Date.now(), read = readFile } = {}) {
  const st = settings(cfg);
  if (!st) return { shared: false, base: own, why: null };
  if (st.invalid) return { shared: false, base: own, why: st.invalid };
  if (!(own > 0)) return { shared: false, base: own, why: 'own equity unknown' };
  const doc = read(st.file);
  if (doc && doc.error) return { shared: false, base: own, why: doc.error };
  const parts = st.others.map((n) => readWallet(n, doc, now, st.maxAgeMin));
  const bad = parts.filter((p) => !p.ok);
  if (bad.length) return { shared: false, base: own, why: bad.map((p) => p.why).join('; ') };
  const total = own + parts.reduce((s, p) => s + p.equity, 0);
  return { shared: true, base: total * st.weight, total, weight: st.weight, parts };
}

const text = (b, usd = (v) => '$' + v.toFixed(2)) => (b && b.shared
  ? `shared base ${usd(b.base)} = total ${usd(b.total)} × ${Math.round(b.weight * 100)}%`
  : b && b.why ? `own balance (shared sizing off for this trade: ${b.why})` : 'own balance');

module.exports = { base, settings, readWallet, text, FILE };
