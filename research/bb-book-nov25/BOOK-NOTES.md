# Study notes: "Bollinger Bands, the methods" (bollinger_band.pdf), compared with BB-CORE (Nov 25, 2026)

Source: `../../bollinger_band.pdf`, 13 pages, an extract of John Bollinger's *Bollinger on Bollinger Bands*
(daily charts, mainly stocks). It contains the basics, Method I and Method II. **Method III (W bottom reversal)
is only named, not described.**

## What the book says
| Topic | Idea |
|---|---|
| Purpose of bands | They say whether price is high or low in relative terms. A band tag is not a signal by itself. |
| Defaults | 20-period SMA, 2 standard deviations. Longer length needs wider bands: 10 / 1.9, 20 / 2.0, 50 / 2.1 (an older passage says 1.5 and 2.5). |
| Price input | Close; typical price (H+L+C)/3 and weighted close (H+L+2C)/4 are also useful. |
| %b | Position inside the bands: 1 = upper band, 0 = lower band. |
| BandWidth | (upper - lower) / middle. Very narrow bands come before large moves. |
| Walking the bands | Closes outside a band are often continuation, not reversal. |
| Confirmation | Use indicators that are not copies of price: volume ones (MFI, Intraday Intensity, Accumulation/Distribution), one momentum one (RSI). |
| Tag without confirmation | If price tags the upper band and the indicator diverges, that is an exit signal. |
| **Method I (volatility breakout)** | Wait for the Squeeze (BandWidth lowest in about 6 months), go with the break. Exit: Parabolic SAR starting below the breakout formation, or a tag of the opposite band. |
| Head fake | After a Squeeze the first move is often false; the real move follows the other way. Volume indicators give direction clues. |
| **Method II (trend following)** | Buy when %b > 0.8 and MFI(10) > 80 (sell mirrored). Same exits. Optional: wait for the first pullback, then enter on the first up candle. |
| Advice | Test on your own market; parameters are starting values. |

The book shows example charts only. It gives **no trade counts, costs or results**, so every claim has to be tested.

## BB-CORE today (live rules v3)
4h; SOL ZEC NEAR ADA GALA ARB. Close beyond BB(20, 1.8) and on the same side of the 200 SMA; stop = middle band
(at least 0.3 ATR away); enter next open; exit at the stop or after 42 candles; wait 3 candles after a loss.

| Book | BB-CORE | Already tested here? |
|---|---|---|
| Break of the band = continuation | Same | Yes, this is the edge; fading the band loses (`../strat-hunt-nov6`, `../bollinger`) |
| Squeeze as a precondition | Not used | Partly: "adds nothing" (`../bollinger/explore3.js`, `../bb-core-v2/EXPLORE-SOL-H.md`), with a different squeeze definition |
| Parabolic exit | Not used | No |
| Opposite band tag exit | Not used | No (a middle-band trail was tested: much worse) |
| MFI / Intraday Intensity / A-D confirmation | Not used | No (plain volume multiples were tested: no gain) |
| Method II entry (%b + MFI) | Not used | No |
| Pullback entry after the signal | Not used | No |
| Head fake | Not used | No |
| Divergence exit | Not used | No |
| Typical / weighted price, paired length and width | Close, 20 / 1.8 | Length and width yes; price input no |
| Trend filter (200 SMA), time exit | Used | Not in the book; both were shown to help here |
