// The regime engine must give exactly the same labels and numbers as the recorder's classifier (lucidio-recorder/regime.js),
// which runs on the VPS. Skips when the recorder code or the market data is not present.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const REC = path.join(__dirname, '../../lucidio-recorder/regime.js');
let M = null; try { M = require('../lib/market'); M.bars('BTC', '1h'); } catch (e) { M = null; }
test('regimeAt equals the recorder classifier on 200 real positions (SOL, BTC)', { skip: !fs.existsSync(REC) || !M ? 'recorder code or market data not present' : false }, () => {
  const R = require('../engines/regime'), Rec = require(REC);
  for (const coin of ['SOL', 'BTC']) {
    const rows = M.bars(coin, '1h'), S = R.series(rows);
    for (let k = 0; k < 100; k++) {
      const i = 3000 + Math.floor((rows.length - 3001) * k / 100), a = R.regimeAt(S, i), b = Rec.coinRegime(rows.slice(0, i + 1));
      for (const f of ['state', 'atr_pct', 'rv24', 'rv7d', 'trend_pct', 'er48', 'bbw', 'bbw_pctile', 'bb_pos']) assert.equal(a[f], b[f], `${coin} bar ${i} field ${f}`);
    }
  }
});
