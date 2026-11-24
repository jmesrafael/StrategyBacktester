// Copies the last 180 days of 4h candles for BTC and the bot coins
// from the local candle library into ./data, so the page works offline.
// Run: node build-data.js   (re-run any time after `node update.js` in candles/)
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'candles', 'binance-futures', '4h');
const OUT = path.join(__dirname, 'data');
const COINS = ['BTC', 'ETH', 'SOL', 'ADA', 'NEAR', 'GALA', 'ZEC', 'SUI', 'ARB'];
const DAYS = 180;

fs.mkdirSync(OUT, { recursive: true });
for (const c of COINS) {
  const file = path.join(SRC, c + '.json');
  if (!fs.existsSync(file)) { console.log('missing', c); continue; }
  const bars = JSON.parse(fs.readFileSync(file, 'utf8'));
  const keep = bars.slice(-DAYS * 6); // 6 bars per day on 4h
  fs.writeFileSync(path.join(OUT, c + '.json'), JSON.stringify(keep));
  const last = keep[keep.length - 1];
  console.log(c.padEnd(5), keep.length, 'bars, last', new Date(last[0] * 1000).toISOString(), 'close', last[4]);
}
