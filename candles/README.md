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
- History (added Nov 12 2026): 75 more perps listed before 2022 (BCH LTC TRX ETC XLM XMR ... ROSE, list in `coins.json`). 1h/4h/funding only, no 1m (add with `node update.js --1m-all`). 89 coins in total, ~350 MB for 1h/4h/funding. KNC 1h has 1 bad-OHLC bar (4h is clean).

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
node update.js                 # all coins, 1h/4h/1m/funding, only new closed bars (about a minute)
node update.js --no-1m         # 1h/4h/funding only (seconds)
node update.js --fill-gaps     # also re-request any holes inside the 1m series
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

## 1m candles (for fills, stops, targets)
- `binance-futures/1m/<COIN>.json`, rows `[openTimeSec, o, h, l, c]` (no volume). ~3.2M rows and 120-160 MB per coin, ~1.9 GB in total.
- Load with `C.load('SOL', '1m')` (takes a few seconds; run node with `--max-old-space-size=8192` when loading several coins).
- They are NTFS hard links to `research/orb-universe/data/<COIN>-1m.json`: one copy on disk, two paths. The updater writes
  in place so both stay identical. Never replace those files with rename/move, or the link breaks.
- Coverage (Nov 12 2026): every coin from its 1h start to the last closed minute, 0 gaps, except one BTC minute that
  Binance never traded. `--fill-gaps` recovered 880 missing XRP minutes.
- `node update.js` updates 1m too (about 1 minute for all coins). `--no-1m` skips it.

## Known bad windows (Binance's own 1m and 1h disagree)
Checked by rebuilding every 1h/4h bar from 1m (`research/orb-universe/validate.js`): 99.9%+ of bars match exactly.
The rest are exchange-side, not download errors:
- **2024-10-28 20:00-22:00 UTC, all coins.** Exchange-wide data incident; 1h and 1m disagree by up to 2%. Exclude these 2 hours or expect noise there.
- **BTC Sep 2019 and ETH Nov-Dec 2019 (listing weeks).** Differences up to 10-16%. Start BTC/ETH backtests at 2020-01-01.
- Single hours: 2023-11-10 15:00-17:00 (BTC, BNB), 2025-01-14 13:00-16:00 (BTC, ETH, ZEC), 2025-01-29 01:00 (ETH), 2022-05-28 17:00 (open only, 6 coins).
- Thin early months (ZEC May-Jul 2020, DOGE Jul-Aug 2020, NEAR Nov-Dec 2020): the 1h open differs from the first 1m open by about a tick. Harmless.

## Not here
- Delisted coins (survivorship bias: results on this set look better than on a true historical universe).
