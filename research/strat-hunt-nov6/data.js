'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', 'indicator-top10');
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const FUND = path.join(__dirname, '..', '..', '..', 'bb-core', 'data', 'funding');
function load(coin, tf) {
  const f = path.join(R, tf === '4h' ? 'data4h' : 'data1h', coin + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const iv = tf === '4h' ? 14400 : 3600;
  for (let i = 1; i < B.length; i++) if (B[i].time - B[i - 1].time !== iv) throw new Error(coin + ' ' + tf + ' has a gap at ' + B[i].time);
  const fr = path.join(FUND, coin + '.json');
  return { B, iv, funding: fs.existsSync(fr) ? JSON.parse(fs.readFileSync(fr, 'utf8')) : null };
}
module.exports = { load, COINS };
