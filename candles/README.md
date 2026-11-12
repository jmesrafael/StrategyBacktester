# Local candle library

One shared copy of 1h and 4h candles plus funding for backtests. Backtests read from here and never download again.
Only `node update.js` touches the network, and it fetches only the bars that closed since the last run.

## Source
Binance USDT-M perpetual futures (`fapi.binance.com`, public endpoints, no key).
Chosen because it has the longest continuous perp history of any major venue (BTC from Sep 2019, most majors from early 2020),
high volume (the prints are real trades, not thin-book noise), and it is the same contract type the bots trade.
History before a coin's perp listing (spot only) is not included on purpose: spot and perp are different markets.

## Coins (`coins.json`)
- Bots: SOL, ADA, NEAR, GALA, ZEC
- Extra: BTC, ETH, BNB, XRP, DOGE, AVAX, LINK, DOT, SUI

| Coin | From | Coin | From |
|---|---|---|---|
| BTC | 2019-09-08 | DOGE | 2020-07-10 |
| ETH | 2019-11-27 | DOT | 2020-08-22 |
| XRP | 2020-01-06 | SOL | 2020-09-14 |
| LINK | 2020-01-17 | AVAX | 2020-09-23 |
| ADA | 2020-01-31 | NEAR | 2020-10-15 |
| ZEC | 2020-02-05 | GALA | 2021-09-18 |
| BNB | 2020-02-10 | SUI | 2023-05-03 |

## Use
```js
const C = require('../../candles/candles.js');      // path from research/<folder>/
const bars = C.load('SOL', '1h');                    // [[openTimeSec, o, h, l, c, volume], ...]
const part = C.load('ZEC', '4h', { from: '2024-01-01', to: '2025-01-01' });
const fund = C.funding('SOL');                       // [[fundingTimeSec, rate], ...]
C.coins();                                           // what is in the library
C.closeTime(bar, '1h');                              // when the bar becomes known: act at this time, never before
```

## Update / add coins
```
node update.js                 # all coins, only new closed bars (takes seconds)
node update.js PEPE,WIF        # add or update specific coins (also add them to coins.json to keep them)
node update.js --full SOL      # re-download one coin from scratch
```

## Why it is safe for no-lookahead replay
- Only closed bars are stored. The bar that is still forming is never written.
- Stored bars are never edited. Each update re-fetches the last stored bar and must match it exactly before
  appending. If Binance has revised it, the coin is flagged and left alone.
- Every update checks for duplicates, out-of-order rows, missing bars and impossible OHLC, and writes the
  result to `binance-futures/MANIFEST.json`. First build (Nov 12 2026): 0 gaps, 0 bad bars on all 14 coins.
- Times are bar OPEN times in UTC seconds. A bar's data is usable only from `open + 1h` (or `+ 4h`).

## Not here
- 1m candles (fills/stops) are large (~130 MB per coin) and live in `research/orb-universe/data/<COIN>-1m.json`.
- Delisted coins (survivorship bias: results on this set look better than on a true historical universe).
