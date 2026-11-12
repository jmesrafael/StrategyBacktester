# ORB universe data (Binance USDT-M perpetuals)

Coins (14): the 5 bot coins SOL, ADA, NEAR, GALA, ZEC, plus BTC, ETH, BNB, XRP, DOGE, AVAX, LINK, DOT, SUI.
Add more with `node fetch.js htf XYZ` then `node fetch.js 1m XYZ` (any Binance perp symbol, base asset only).

## Files (data/, gitignored)
| File | Rows | Use |
|---|---|---|
| `<COIN>-1h.json`, `<COIN>-4h.json` | `[openTimeSec, o, h, l, c, volume]` | signal candles (fed one at a time) |
| `<COIN>-1m.json` | `[openTimeSec, o, h, l, c]` | fills, stops, targets, retest limits (same as orb-sol engine) |
| `<COIN>-funding.json` | `[fundingTimeSec, rate]` | real funding cost |
| `MANIFEST.json` | | output of `node validate.js` |

## No-lookahead / no-repaint properties
- Time = candle OPEN time, UTC seconds. A bar is usable only at open + its length.
- The still-forming candle is dropped at fetch time (closed bars only).
- Raw exchange bars, nothing resampled, smoothed or adjusted. Higher TFs are Binance's own, not rebuilt.
- Fetched once and frozen: a replay re-reads the same file, so results do not shift between runs.
- `validate.js` rebuilds 1h/4h from 1m and compares with the downloaded bars.

## Known limits
- Survivorship: only coins that still trade on Binance futures. Delisted/dead perps are not here, so results are flattering vs a true universe.
- Coin selection: the 5 bot coins were picked by earlier research (in-sample); the other 9 are plain liquidity picks, so they are the cleaner out-of-sample test of the ORB rules.
- History starts at each coin's perp listing (GALA Sep 2021, SUI May 2023, BTC Sep 2019). 1m starts at the 1h start, except SOL (Oct 2020, from the earlier audit cache).
- SOL: 2 consecutive bars on 2024-10-28 20:00-21:00 UTC where Binance's own 1m and 1h disagree. Exchange quirk, left as is.
- Binance 1m has occasional missing minutes on some coins; `validate.js` reports gaps and `../orb-sol/fill-gaps.js` shows how to refill them.

## Re-run
```
node fetch.js htf           # 1h, 4h, funding (about 5 min)
node fetch.js 1m            # resumable, about 2 h for all coins at ~4 req/s
node validate.js            # integrity report + MANIFEST.json
```
