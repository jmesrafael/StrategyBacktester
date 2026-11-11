// top100.js — CoinGecko top coins by market cap (stablecoins, wrapped/staked/bridged copies and gold tokens removed) -> the first 100,
// matched to MEXC USDT-M futures (where the bots trade) and to the longest 4h history: Binance spot, else Binance futures, else MEXC futures.
//   node top100.js  -> top100.json
'use strict';
const fs = require('fs');
const j = async (u) => { for (let a = 0; a < 6; a++) { try { const r = await fetch(u, { headers: { accept: 'application/json' } }); if (r.ok) return await r.json(); if (r.status === 400) return null; } catch (e) {} await new Promise((s) => setTimeout(s, 4000 * (a + 1))); } return null; };
const SKIP = /usd|eur|dai$|^frax|^pyusd|^fdusd|wrapped|staked|bridged|wbtc|weth|steth|^cbbtc|^cbeth|^reth|^wsteth|^weeth|^ezeth|^rseth|^meth|^jitosol|^msol|^bnsol|gold|xaut|paxg|^susde|^usde|^usds|^bfusd|^usd0|^buidl|^ousg|^syrup|^solvbtc|^lbtc|^tbtc|^clbtc|^jlp|^bgb$|^leo$|^okb$|^ht$|^kcs$|^gt$|^cro$|^wbt$|^figr/i;
(async () => {
  const list = [];
  for (const p of [1, 2]) { const a = await j(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=125&page=${p}`); if (a) list.push(...a); await new Promise((s) => setTimeout(s, 3000)); }
  const coins = list.filter((c) => !SKIP.test(c.symbol) && !SKIP.test(c.id) && !SKIP.test(c.name)).slice(0, 100);
  const mexc = Object.fromEntries((await j('https://contract.mexc.com/api/v1/contract/ticker')).data.filter((t) => t.symbol.endsWith('_USDT')).map((t) => [t.symbol.replace('_USDT', ''), t.amount24]));
  const spot = new Set((await j('https://data-api.binance.vision/api/v3/exchangeInfo?permissions=SPOT')).symbols.filter((s) => s.quoteAsset === 'USDT' && s.status === 'TRADING').map((s) => s.baseAsset));
  const fut = new Set((await j('https://fapi.binance.com/fapi/v1/exchangeInfo')).symbols.filter((s) => s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL' && s.status === 'TRADING').map((s) => s.baseAsset));
  const out = coins.map((c, i) => { const s = c.symbol.toUpperCase();
    const alias = [s, '1000' + s, s + '1000'].find((x) => mexc[x] != null);
    return { rank: i + 1, coin: s, name: c.name, mcap: c.market_cap, mexc: alias || null, mexcUsd24h: alias ? mexc[alias] : null, binanceSpot: spot.has(s), binanceFut: fut.has(s) ? s : fut.has('1000' + s) ? '1000' + s : null }; });
  fs.writeFileSync('top100.json', JSON.stringify({ built: new Date().toISOString(), coins: out }, null, 1));
  console.log(out.length, 'coins;', out.filter((c) => c.mexc).length, 'on MEXC futures;', out.filter((c) => c.mexc && c.binanceSpot).length, 'with Binance spot data');
  console.log(out.map((c) => `${c.rank}.${c.coin}${c.mexc ? '' : '(no MEXC)'}${c.binanceSpot ? '' : c.binanceFut ? '[fut]' : c.mexc ? '[mexc]' : ''}`).join(' '));
})();
