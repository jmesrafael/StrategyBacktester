// track-old-position.js — books ONE position this bot did not open when it closes: I-Core's old SOL short, still open on the account T-CORE now trades.
// Run every 5 minutes (cron, user tcore). Read-only on MEXC. What it does:
//   - position still open  -> writes nothing to the ledger (only refreshes /var/lib/tcore/old-position.json with entry, size, stop and the open P&L, for tracking);
//   - position closed      -> reads MEXC's own closed-position record (history_positions: realised, fees, funding: the figure MEXC booked, never an estimate)
//                             and sends it once to the ledger as a closed trade of wallet tcore (ledger-sync.js, the same path every live exit takes);
//                             then writes /var/lib/tcore/old-position.done and does nothing more.
// The ledger records each position id once; an identical resend is a harmless replay, so a failed or repeated run is safe. Never places or cancels an order.
//   node track-old-position.js [--dry]        --dry: show what it sees and would send, send nothing
'use strict';
const fs = require('fs'), path = require('path');
const STATE = process.env.ICORE_STATE_DIR || '/var/lib/tcore';
const POSITION_ID = process.env.OLD_POSITION_ID || '1529457475', SYMBOL = 'SOL_USDT', SIDE = 'SHORT';
const FILE = path.join(STATE, 'old-position.json'), DONE = path.join(STATE, 'old-position.done');
const dry = process.argv.includes('--dry');
const mexc = require('../mexc.js'), sync = require('../ledger-sync.js');
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

(async () => {
  if (fs.existsSync(DONE)) return log('already booked: nothing to do (remove the cron line /etc/cron.d/tcore-old-position)');
  await mexc.client.syncTime();
  const open = ((await mexc.client.openPositions(SYMBOL)) || []).find((p) => String(p.positionId) === POSITION_ID && +p.holdVol > 0);
  if (open) {
    const rec = { positionId: POSITION_ID, symbol: SYMBOL, side: SIDE, status: 'open', contracts: +open.holdVol, entry: +open.holdAvgPrice, leverage: open.leverage, openedAt: open.createTime ? new Date(+open.createTime).toISOString() : null,
      unrealized_note: 'see status.sh balance', checkedAt: new Date().toISOString() };
    if (!dry) fs.writeFileSync(FILE, JSON.stringify(rec, null, 2) + '\n');
    return log(`position ${POSITION_ID} (${SYMBOL} ${SIDE} ${rec.contracts} @ ${rec.entry}) still open: nothing to book`);
  }
  const hist = ((await mexc.client.historyPositions(SYMBOL, Date.now() - 30 * 86400e3)) || []).find((x) => String(x.positionId) === POSITION_ID && +x.state === 3);
  if (!hist) return log(`position ${POSITION_ID} is not open and MEXC has no closed record for it yet: will look again next run`);
  const trade = { mode: 'live', symbol: SYMBOL, side: SIDE, costs: { exit: { mexc_history: Object.fromEntries(['positionId', 'realised', 'fee', 'holdFee', 'updateTime', 'closeAvgPrice', 'openAvgPrice', 'holdVol'].filter((k) => hist[k] !== undefined).map((k) => [k, hist[k]])) } } };
  const r = await sync.postClosedTrade({ enabled: true, trade, dry });
  log(`MEXC booked realised ${hist.realised} (fee ${hist.fee}, funding ${hist.holdFee}), closed ${new Date(+hist.updateTime).toISOString()} · ledger: ${r.status}${r.detail ? ' — ' + r.detail : ''}${r.replayed ? ' (already recorded)' : ''}`);
  if (r.status === 'sent') {
    fs.writeFileSync(FILE, JSON.stringify({ positionId: POSITION_ID, symbol: SYMBOL, side: SIDE, status: 'closed and booked', realised: +hist.realised, fee: +hist.fee, funding: +hist.holdFee, closeAvgPrice: hist.closeAvgPrice, closedAt: new Date(+hist.updateTime).toISOString(), bookedAt: new Date().toISOString() }, null, 2) + '\n');
    fs.writeFileSync(DONE, new Date().toISOString() + '\n');
  }
})().catch((e) => { log('failed (will retry next run): ' + e.message); process.exitCode = 1; });
