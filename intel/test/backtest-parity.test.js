// Parity: the unified engine must reproduce each bot's own backtest trade for trade (same entries, exits, reasons and R).
// Needs the bot repos beside this one (../../bb-core, ../../i-core, ../bb-trail). A missing repo skips that bot's test, it does not fail.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const E = require('../engines/backtest/engine'), S = require('../engines/backtest/strategies'), M = require('../lib/market');
const CORES = { bbcore: path.join(__dirname, '../../../bb-core/lucidio-core.js'), icore: path.join(__dirname, '../../../i-core/icore-core.js'), tcore: path.join(__dirname, '../../bb-trail/icore-core.js') };
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
let marketOk = true; try { M.bars('BTC', '4h'); } catch (e) { marketOk = false; }
for (const bot of Object.keys(CORES)) for (const ver of ['v3', 'legacy']) {
  test(`${bot} ${ver}: engine equals the bot's own backtest on ${COINS.join(' ')}`, { skip: !marketOk ? 'market dataset not built' : !fs.existsSync(CORES[bot]) ? 'bot repo not present' : false }, () => {
    const core = require(CORES[bot]); let total = 0;
    for (const coin of COINS) {
      const B = M.candles(coin, '4h'), F = M.bars(coin, 'funding'), leg = ver === 'legacy' ? core.LEGACY : {};
      const a = bot === 'bbcore' ? core.backtest(B, leg, F).trades : core.backtest(B, leg).trades;
      const b = E.run(B, S.bot(bot, ver), bot === 'bbcore' ? E.bbNativeCost(undefined, F) : E.icNativeCost()).trades;
      assert.equal(b.length, a.length, `${coin}: trade count`);
      for (let i = 0; i < a.length; i++) { assert.equal(b[i].t, a[i].t); assert.equal(b[i].tExit, a[i].tExit); assert.equal(b[i].dir, a[i].dir); assert.equal(b[i].why, a[i].why); assert.ok(Math.abs(b[i].R - a[i].R) < 1e-9, `${coin} trade ${i}: R ${b[i].R} vs ${a[i].R}`); }
      total += a.length;
    }
    assert.ok(total > 500);
  });
}
test('T-CORE legacy rules give the documented 613 trades on the five coins up to Nov 6 2026', { skip: !marketOk }, () => {
  const cut = Date.UTC(2026, 10, 6) / 1000; let n = 0;
  for (const coin of COINS) n += E.run(M.candles(coin, '4h', { to: cut }), S.bot('tcore', 'legacy'), E.icNativeCost()).trades.length;
  assert.ok(Math.abs(n - 613) <= 6, `got ${n} trades (documented 613; a few more or fewer is the data end date)`);
});
