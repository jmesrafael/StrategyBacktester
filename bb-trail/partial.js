// partial.js — "take part of the profit" on ONE open live trade (owner request, Nov 26 2026). Pure functions + a small file inbox, no network.
// The same file ships with BB-CORE (lucidio.js), I-CORE and T-CORE (icore.js); the bot's live executor does the MEXC part (live.js reduce / close).
//
// A request is { id, coin, pct, sigMs, source, ts }. pct is one of 10 / 25 / 50 / 75 / 100:
//   10..75  close that share of the position's CONTRACTS now (rounded DOWN to whole contracts; at least 1 must close and at least 1 must stay open).
//           The rest keeps running under the bot's own rules: same stop, same trailing, same time exit. The bot keeps the new size in its state,
//           so every later order (stop move, time exit) uses the size that is really left.
//   100     close the whole trade now at the market. It is booked like any other exit (journal, Telegram, dashboard, ledger), closed_by 'owner_close'.
// Where a request comes from: the dashboard P button -> /api/command -> the bot's outbound poll (source 'dashboard'), or the command line (source 'cli').
// It is applied only between candle closes (never during a run) and only in LIVE mode.
//
// Money and R: the partial closes are written on the trade (pos.partials) and carried to its exit record. When the trade finally closes, its result is the
// WHOLE position: MEXC's realised P&L for the position (all closes), in R of the ORIGINAL risk. The ledger gets that one total, once, at the final close.
'use strict';
const fs = require('fs'), path = require('path');

const PCTS = [10, 25, 50, 75, 100];
const COIN_RE = /^[A-Z0-9]{2,10}$/;

// validate one request from outside (dashboard, CLI). -> { ok:true, cmd } | { ok:false, error }
function parseCommand(raw, { source = 'cli', now = Date.now() } = {}) {
  const c = raw || {}, coin = String(c.coin || '').toUpperCase().replace(/_USDT$/, ''), pct = Number(c.pct);
  if (!COIN_RE.test(coin)) return { ok: false, error: 'coin is missing or not valid' };
  if (!PCTS.includes(pct)) return { ok: false, error: `pct must be one of ${PCTS.join(', ')}` };
  const sigMs = Number.isFinite(Number(c.sigMs)) && Number(c.sigMs) > 0 ? Math.round(Number(c.sigMs)) : null;   // the trade the owner was looking at: never applied to a newer trade on the coin
  return { ok: true, cmd: { id: String(c.id || `${source}:${now}:${coin}:${pct}`).slice(0, 80), coin, pct, source: String(c.source || source).slice(0, 20), ts: Number(c.ts) || now, ...(sigMs ? { sigMs } : {}) } };
}

// how many contracts a pct closes. -> { full:true } | { vol } | { error }
function planVol(vol, pct) {
  const v = Math.round(Number(vol));
  if (!(v >= 1)) return { error: 'the bot has no contract count for this trade' };
  if (pct === 100) return { full: true };
  const n = Math.floor((v * pct) / 100 + 1e-9);
  if (n < 1) return { error: `${pct}% of ${v} contract${v === 1 ? '' : 's'} is less than one contract: choose a bigger share, or 100% to close it` };
  if (n >= v) return { full: true };
  return { vol: n };
}

// sums over the partial closes already done on a position
const partialVol = (pos) => ((pos && pos.partials) || []).reduce((a, x) => a + (Number(x.vol) || 0), 0);
// what the partial closes realised: MEXC's own running figure read right after the last partial (open position 'realised'), else the price estimate
function partialUsd(pos) {
  const p = (pos && pos.partials) || [];
  if (!p.length) return 0;
  const last = p[p.length - 1];
  return Number.isFinite(Number(last.realised)) ? Number(last.realised) : p.reduce((a, x) => a + (Number(x.usd) || 0), 0);
}
// MEXC's record of a closed position (history_positions): does it cover ALL closes (closeVol = original size) or only the last part?
function historyCoversAll(pos, h) {
  const pv = partialVol(pos);
  if (!pv) return true;
  if (!h || h.closeVol == null || !Number.isFinite(Number(h.closeVol))) return true;   // MEXC keeps one record per position: assume it covers every close
  return Number(h.closeVol) >= Number(pos.vol) + pv - 1e-9;
}
// the whole position's realised P&L in USD (partials included), from MEXC's history when there is one
function totalUsd(pos, h, lastLegUsd) {
  if (h && h.realised != null && Number.isFinite(Number(h.realised))) return Number(h.realised) + (historyCoversAll(pos, h) ? 0 : partialUsd(pos));
  return lastLegUsd + partialUsd(pos);
}
// the price of the LAST close only (closeAvgPrice averages every close when MEXC's record covers them all): used to tell a stop from a manual close
function lastLegPx(pos, h) {
  const px = Number(h && h.closeAvgPrice), pv = partialVol(pos);
  if (!pv || !Number.isFinite(px) || !historyCoversAll(pos, h) || !(pos.vol > 0)) return px;
  const sum = pos.partials.reduce((a, x) => a + Number(x.vol) * Number(x.px), 0), leg = (px * (pos.vol + pv) - sum) / pos.vol;
  return Number.isFinite(leg) && leg > 0 ? leg : px;
}
// the dashboard view of one open position: { vol, vol0, n, usd } (numbers only)
function info(pos) {
  if (!pos || !pos.partials || !pos.partials.length) return null;
  return { vol: Number(pos.vol) || 0, vol0: Number(pos.vol0) || Number(pos.vol) + partialVol(pos), n: pos.partials.length, usd: Math.round(partialUsd(pos) * 1e4) / 1e4 };
}

// ---- the inbox file (state/partial-inbox.json): requests wait here until the bot is between runs ----
const inboxFile = (stateDir) => path.join(stateDir, 'partial-inbox.json');
function readInbox(stateDir) { try { const a = JSON.parse(fs.readFileSync(inboxFile(stateDir), 'utf8')); return Array.isArray(a) ? a : []; } catch { return []; } }
function writeInbox(stateDir, list) {
  fs.mkdirSync(stateDir, { recursive: true });
  const f = inboxFile(stateDir), tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(list)); fs.renameSync(tmp, f);
}
function queue(stateDir, cmds) {
  const have = readInbox(stateDir), ids = new Set(have.map((c) => c.id)), add = (cmds || []).filter((c) => c && !ids.has(c.id));
  if (add.length) writeInbox(stateDir, have.concat(add));
  return add.length;
}
// take every waiting request out of the inbox (validated again). The caller applies them one by one; state.handledPartials stops a second application.
function takeInbox(stateDir, now = Date.now()) {
  const list = readInbox(stateDir);
  if (!list.length) return [];
  try { writeInbox(stateDir, []); } catch {}
  return list.map((c) => { const v = parseCommand(c, { source: c && c.source ? c.source : 'inbox', now }); return v.ok ? v.cmd : { invalid: true, id: c && c.id, coin: c && c.coin, error: v.error }; });
}
// checks before anything is sent. -> null (go) | reason text. Marks the id handled so the same request never runs twice.
function precheck(state, cmd) {
  state.handledPartials = state.handledPartials || [];
  if (state.handledPartials.includes(cmd.id)) return { dup: true, msg: `${cmd.coin}: request ${cmd.id} was already applied` };
  state.handledPartials.push(cmd.id); if (state.handledPartials.length > 100) state.handledPartials.shift();
  const st = state.coins && state.coins[cmd.coin], p = st && st.pos;
  if (!p) return { msg: `${cmd.coin}: no open trade (it may have closed already), nothing sent` };
  if (!p.live) return { msg: `${cmd.coin}: partial closes are for LIVE trades only` };
  if (st.pending) return { msg: `${cmd.coin}: an order is still unfinished, try again after the next run` };
  if (cmd.sigMs && p.sigTime != null && Math.round(p.sigTime * 1000) !== cmd.sigMs) return { msg: `${cmd.coin}: the trade you chose has already closed; ${cmd.coin} now holds a different trade, so nothing was sent` };
  return null;
}

module.exports = { PCTS, parseCommand, planVol, partialVol, partialUsd, historyCoversAll, totalUsd, lastLegPx, info, readInbox, writeInbox, queue, takeInbox, precheck };
