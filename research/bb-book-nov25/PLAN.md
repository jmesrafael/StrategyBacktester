# Can an idea from the book beat BB-CORE? Rules fixed before running (Nov 25, 2026)

Research only. No bot, server or database is touched. Written before any result of this study was seen.

## Baseline
BB-CORE v3 on 4h (see `BOOK-NOTES.md`). Candles `../../candles`, up to 2026-11-24 00:00 UTC. Costs: 0.05% taker and
0.02% slippage per side plus real funding. The study engine must match `intel/engines/backtest` trade for trade.

## Coin sets
- **LIVE**: SOL ZEC NEAR ADA GALA ARB (decides).
- **WIDE**: every other coin in the library (never used to choose these rules; checks that an effect is general).

## Windows
IS = trades closed 2020-01-01 to 2023-12-31. OOS = 2024-01-01 to 2026-11-24.
Honest limit: 2024-26 has been looked at by many earlier studies, so it is not a truly unseen period.

## Candidates (one change at a time; "n" = neighbour setting, reported but not eligible to be picked)
Unless stated, everything else stays BB-CORE v3.

| Id | Change |
|---|---|
| F1 | Squeeze first: BandWidth was at its 125-candle low within the last 20 candles (n: 10, 40; calendar 6 months = 1095 candles) |
| F2 | BandWidth expanding on the signal candle |
| F3 | MFI(10) > 80 long / < 20 short (n: 70/30, 60/40) |
| F4 | Intraday Intensity % (21) agrees with the direction (n: 10, 42) |
| F5 | Accumulation/Distribution % (21), (C-O)/(H-L) x volume, agrees (n: 10, 42) |
| F6 | RSI(10) > 70 long / < 30 short (n: 60/40) |
| F7 | Head fake: the opposite band was broken within the last 20 candles (n: 10, 40) |
| E1 | Method II entry (%b > 0.8 and MFI(10) > 80, mirrored) instead of the band break, same stop and exit (n: MFI 70) |
| E2 | Pullback entry: after a signal wait (max 12 candles) for a candle closing against it, then enter after the first candle closing with it; cancel if price closes past the middle band (n: 6, 24) |
| X1 | Add an opposite-band-tag exit, keep the middle stop, no time exit (and X1t: with the 42-candle time exit) |
| X2 | Initial stop = opposite band, exit on its tag, no time exit |
| X3 | Parabolic SAR (0.02 / 0.2) starting at the middle-band stop, no time exit (X3t: with time exit; n: 0.01 / 0.1) |
| X4 | Parabolic SAR starting at the 10-candle formation low/high, no time exit (X4t: with time exit; n: 0.01 / 0.1) |
| X5 | Exit when a new band tag with a higher high (lower low) has a weaker MFI than the previous tag |
| B1 | Bands on typical price |
| B2 | Bands on weighted close |
| B3 | Book pair 50 / 2.1 (n: 50 / 1.9) |
| B4 | Book pair 10 / 1.9 (n: 10 / 1.7) |
| M1 | Method I as written: BB(20,2), squeeze (F1), no 200 SMA, formation stop + Parabolic (M1o: opposite-band exit) |
| M2 | Method II as written: %b 0.8 + MFI 80, BB(20,2), no 200 SMA, formation stop + Parabolic (M2o: opposite-band exit) |

## Size tilt (second way to use a confirmation)
For F1-F7: keep every BB-CORE trade, risk 1.5 units when the condition holds and 0.5 when not, then rescale so the
average risk is 1. This only helps if the condition really separates good trades from bad ones.

## Pass mark (all must hold to say "beats BB-CORE")
1. LIVE: total R / max drawdown higher than baseline in **both** IS and OOS.
2. LIVE: monthly Sharpe higher in **both** IS and OOS.
3. LIVE: total R at least 80% of baseline in both windows.
4. LIVE at 2x costs: R / drawdown higher over the full period.
5. WIDE: pooled average R per trade higher in both windows.
6. Neighbour settings, where listed: most of them also pass rule 1.

Also reported: without the 10 best trades, per year, per coin, share of random same-size subsets that do as well
(filters), and the effect on TRI-CORE for anything that passes. With about 50 variants, one or two can pass by luck:
a pass means **paper test**, never a live change.
