// universe.js: Binance spot USDT coins whose 4h history starts on or before CUTOFF (7 years), cross-checked with MEXC USDT-M futures.
//   node universe.js  -> universe.json
'use strict';
const fs = require('fs');
const CUTOFF = Date.UTC(2019, 10, 11); // 7 years before 2026-11-11
const STABLE = new Set(['USDC', 'BUSD', 'TUSD', 'USDP', 'PAX', 'FDUSD', 'DAI', 'EUR', 'GBP', 'AUD', 'USDS', 'USDSB', 'SUSD', 'UST', 'PAXG', 'AEUR', 'EURI', 'BKRW', 'IDRT', 'BIDR', 'TRY', 'BRL', 'RUB', 'NGN', 'UAH', 'ZAR']);
const j = async (u) => { for (let a = 0; a < 5; a++) { try { const r = await fetch(u); if (r.ok) return r.json(); } catch (e) {} await new Promise((s) => setTimeout(s, 1000 * (a + 1))); } throw new Error('fetch failed ' + u); };
(async () => {
  const info = await j('https://data-api.binance.vision/api/v3/exchangeInfo?permissions=SPOT');
  const spot = info.symbols.filter((s) => s.quoteAsset === 'USDT' && s.status === 'TRADING' && !STABLE.has(s.baseAsset) && !/(UP|DOWN|BULL|BEAR)$/.test(s.baseAsset));
  const mexc = (await j('https://contract.mexc.com/api/v1/contract/ticker')).data;
  const mx = Object.fromEntries(mexc.filter((t) => t.symbol.endsWith('_USDT')).map((t) => [t.symbol.replace('_USDT', ''), t.amount24]));
  const fut = (await j('https://fapi.binance.com/fapi/v1/exchangeInfo')).symbols.filter((s) => s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL' && s.status === 'TRADING');
  const fset = new Set(fut.map((s) => s.symbol));
  const fticks = Object.fromEntries((await j('https://fapi.binance.com/fapi/v1/ticker/24hr')).map((t) => [t.symbol, +t.quoteVolume]));
  const out = [];
  for (const s of spot) {
    const k = await j(`https://data-api.binance.vision/api/v3/klines?symbol=${s.symbol}&interval=4h&startTime=0&limit=1`);
    if (!k.length || k[0][0] > CUTOFF) continue;
    out.push({ coin: s.baseAsset, symbol: s.symbol, first: new Date(k[0][0]).toISOString().slice(0, 10), mexcUsd24h: mx[s.baseAsset] ?? null, binanceFutures: fset.has(s.symbol), binanceFutUsd24h: fticks[s.symbol] ?? null });
  }
  out.sort((a, b) => (b.mexcUsd24h || 0) - (a.mexcUsd24h || 0));
  fs.writeFileSync('universe.json', JSON.stringify({ cutoff: new Date(CUTOFF).toISOString(), built: new Date().toISOString(), coins: out }, null, 1));
  console.log(out.length, 'coins with spot 4h history from', new Date(CUTOFF).toISOString().slice(0, 10), 'or earlier;', out.filter((c) => c.mexcUsd24h != null).length, 'on MEXC futures');
  for (const c of out) console.log(c.coin.padEnd(7), c.first, 'MEXC $' + (c.mexcUsd24h == null ? '-' : (c.mexcUsd24h / 1e6).toFixed(1) + 'M'), 'BinFut $' + (c.binanceFutUsd24h == null ? '-' : (c.binanceFutUsd24h / 1e6).toFixed(0) + 'M'));
})();
