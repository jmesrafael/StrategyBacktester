// apply-1h-patch.js — turns the copied 4h bb-core files into the 1h PAPER version. Each edit must match exactly the expected number of times, or it stops.
const fs = require('fs'); let total = 0;
function edit(file, pairs) { let s = fs.readFileSync(file, 'utf8'); for (const [a, b, want] of pairs) { const n = s.split(a).length - 1; if (n !== want) throw new Error(`${file}: expected ${want} of ${JSON.stringify(a)}, found ${n}`); s = s.split(a).join(b); total += n; } fs.writeFileSync(file, s); }
edit('lucidio-core.js', [
  ['bbLen: 20, bbMult: 2, trendLen: 200, targetR: 0, maxBars: 48, minStopAtr: 0.3, atrLen: 14, warmup: 202, interval: 14400,', 'bbLen: 80, bbMult: 2, trendLen: 800, targetR: 0, maxBars: 192, minStopAtr: 0.3, atrLen: 14, warmup: 802, interval: 3600,', 1],
  ['tx = B[i].time + 7200;', 'tx = B[i].time + cfg.interval / 2;', 1],
  ['tExit: B[i].time + 14400,', 'tExit: B[i].time + cfg.interval,', 1],
]);
edit('lucidio.js', [
  ["const liveAllowed = () => process.argv.includes('--allow-live') || process.env.LUCIDIO_ALLOW_LIVE === '1';", 'const liveAllowed = () => false; // 1h PAPER COPY: real trading is impossible here, whatever the config, flags or environment say', 1],
  ['COST = DEFAULTS.cost, IV = 14400;', 'COST = DEFAULTS.cost, IV = DEFAULTS.interval, WIN = Math.max(DEFAULTS.bbLen, DEFAULTS.trendLen) + 200; // WIN: closes each decision sees. The 4h value (400) is below trendLen 800 and would silently give no signals', 1],
  ['closes.slice(Math.max(0, i - 399), i + 1)', 'closes.slice(Math.max(0, i - WIN + 1), i + 1)', 4],
  ['async function fetchMexc(coin, bars = 500)', 'async function fetchMexc(coin, bars = WIN + 100)', 1],
  ['n < 450 ?', 'n < WIN ?', 1],
  ['closes.slice(-20).reduce((x, y) => x + y, 0) / 20', 'closes.slice(-S.bbLen).reduce((x, y) => x + y, 0) / S.bbLen', 1],
  ['new 4h candle', 'new 1h candle', 1], ['no 4h candle', 'no 1h candle', 1], ['MEXC 4h candles', 'MEXC 1h candles', 1], ['× 4h in', '× 1h in', 1], ['next 4h run', 'next 1h run', 1],
  ["Lucid'io check", "Lucid'io 1h PAPER check", 1], ['console.log(`Lucid\'io ${CFG.mode.toUpperCase()} bot', 'console.log(`Lucid\'io 1h ${CFG.mode.toUpperCase()} bot', 1],
]);
edit('mexc.js', [
  ['const IV4H = 14400;', 'const IV1H = 3600;', 1],
  ["klines: (coin, bars = 500) => timed(() => { const end = Math.floor(client.now() / 1000); return client.klines(`${coin}_USDT`, 'Hour4', end - bars * IV4H, end); }),", "klines: (coin, bars = 1100) => timed(() => { const end = Math.floor(client.now() / 1000); return client.klines(`${coin}_USDT`, 'Min60', end - bars * IV1H, end); }),", 1],
]);
console.log('patched', total, 'places');
