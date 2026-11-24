// Readable, unique trade ID: BOT-COIN-SIDE-YYMMDD-HHMM, built from facts every bot already knows
// (bot, coin, side, open time of the 4h signal candle, UTC). No counter or database state, so the same trade always gets the same ID,
// old trades can be back-filled, and the backtest produces the same ID as the live bot.
//   BBC = BB-CORE, ICO = I-CORE, TCO = T-CORE.   Example: BBC-SOL-S-261120-0800 = BB-CORE short on SOL, signal candle 2026-11-20 08:00 UTC.
'use strict';
const BOT = { bbcore: 'BBC', icore: 'ICO', tcore: 'TCO', bbtr: 'TCP', bb1h: 'B1H' };   // TCP = T-CORE paper, B1H = BB-CORE 1h paper
const p2 = (n) => String(n).padStart(2, '0');
function tradeId(bot, symbol, side, signalCandleOpenMs) {
  const b = BOT[String(bot || 'bbcore').toLowerCase()];
  if (!b) throw new Error('trade-id: unknown bot ' + bot);
  const coin = String(symbol).split('_')[0].toUpperCase();
  const s = String(side).toUpperCase()[0];
  if (s !== 'S' && s !== 'L') throw new Error('trade-id: side must be SHORT/LONG, got ' + side);
  const d = new Date(Number(signalCandleOpenMs));
  if (!Number.isFinite(d.getTime())) throw new Error('trade-id: bad signal candle time ' + signalCandleOpenMs);
  const ymd = String(d.getUTCFullYear()).slice(2) + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate());
  return `${b}-${coin}-${s}-${ymd}-${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}`;
}
// the old internal id "SOL_USDT|SHORT|1794168000000" does not say which bot, so two bots on the same coin and candle collide
const fromOld = (bot, oldId) => { const [sym, side, ms] = String(oldId).split('|'); return tradeId(bot, sym, side, ms); };
module.exports = { tradeId, fromOld, BOT };
if (require.main === module) {
  const assert = require('assert');
  assert.strictEqual(tradeId('bbcore', 'SOL_USDT', 'SHORT', 1795161600000), 'BBC-SOL-S-261120-0800');
  assert.strictEqual(fromOld('icore', 'SOL_USDT|SHORT|1795449600000'), 'ICO-SOL-S-261123-1600');
  assert.notStrictEqual(fromOld('bbcore', 'ZEC_USDT|SHORT|1794168000000'), fromOld('icore', 'ZEC_USDT|SHORT|1794168000000'));
  assert.throws(() => tradeId('xyz', 'SOL_USDT', 'SHORT', 1)); assert.throws(() => tradeId('icore', 'SOL_USDT', 'UP', 1));
  console.log('trade-id: 5/5 checks pass');
}
