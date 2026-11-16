# Profit-cause simulation, Oct 24 to Nov 15 2026

Replay of the recorder idea on real trades. No AI used. Prices: Binance perps 1h, last closed bar 2026-11-15 23:00 UTC.
Open trades are marked at that last price with their first stop as 1R, so their R is an estimate (the bots trade on MEXC).

## 1. Live result so far

| Bot | Closed trades | Closed R | Open trades | Open R now | Total R |
|---|---|---|---|---|---|
| bbcore | 16 (5 won) | -2.13 | 6 | +5.64 | +3.51 |
| icore | 3 (0 won) | -3.20 | 4 | +17.02 | +13.82 |
| tcore | 3 (0 won) | -3.12 | 7 | +10.45 | +7.33 |
| ALL | 22 (5 won) | -8.45 | 17 | +33.10 | +24.65 |

## 2. Price shocks the detector found (BTC, 1h move at least 3x normal with volume at least 2x normal)

| Time (UTC) | BTC 1h move | Size vs normal | Volume vs normal | Hand tag within 24h before |
|---|---|---|---|---|
| 2026-10-29 01:00 | -1.35% | 4.1x | 3.9x | - |
| 2026-10-29 14:00 | +1.10% | 3.3x | 6.6x | - |
| 2026-10-29 20:00 | -2.46% | 7.4x | 12.5x | Binance $6.3B hack |
| 2026-10-29 23:00 | -1.28% | 3.7x | 5.7x | Binance $6.3B hack |
| 2026-11-04 02:00 | -1.15% | 3.4x | 3.1x | US midterms, Democrats win |
| 2026-11-04 04:00 | +1.17% | 3.3x | 4.3x | US midterms, Democrats win |
| 2026-11-04 14:00 | +1.25% | 3.6x | 7.1x | US midterms, Democrats win |
| 2026-11-04 15:00 | +1.21% | 3.4x | 13.4x | US midterms, Democrats win |
| 2026-11-05 14:00 | -1.74% | 4.9x | 7.9x | - |
| 2026-11-05 15:00 | -2.88% | 8.1x | 21.3x | - |
| 2026-11-08 21:00 | -2.14% | 6.0x | 8.0x | - |
| 2026-11-10 15:00 | -1.60% | 4.3x | 8.7x | Hot US CPI |
| 2026-11-12 14:00 | -1.20% | 3.2x | 9.0x | - |
| 2026-11-13 03:00 | -1.82% | 4.8x | 10.4x | - |
| 2026-11-13 06:00 | +1.36% | 3.5x | 5.9x | - |
| 2026-11-14 03:00 | -1.37% | 3.5x | 4.8x | - |
| 2026-11-14 14:00 | -1.37% | 3.5x | 6.4x | - |
| 2026-11-14 20:00 | -1.46% | 3.7x | 4.0x | - |
| 2026-11-14 22:00 | -1.41% | 3.6x | 8.5x | - |
| 2026-11-15 01:00 | -1.27% | 3.2x | 10.1x | - |
| 2026-11-15 02:00 | +3.64% | 8.8x | 9.1x | - |
| 2026-11-15 08:00 | +1.88% | 4.3x | 3.9x | - |

## 3. Hand-tagged events and what BTC did next

| Event | Time (UTC) | BTC 24h after | BTC 72h after | Shock within 24h |
|---|---|---|---|---|
| Binance $6.3B hack | 2026-10-29 20:00 | -4.85% | -3.76% | yes |
| US midterms, Democrats win | 2026-11-04 02:00 | +4.71% | -1.32% | yes |
| Nvidia CEO scandal | 2026-11-09 02:39 | -0.12% | -1.94% | no |
| Hot US CPI | 2026-11-10 13:30 | -0.68% | -6.97% | yes |
| Nvidia CEO resigns | 2026-11-10 19:40 | +1.36% | -6.12% | no |

## 4. Daily journal (live bots, mark-to-market)

| Day | Day R | Open | New | BTC day | BTC 7d | Phase | Range vs normal | Shocks | News mood | Tag |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-24 | -0.58 | 1 | 1 | -0.4% | -0.8% | sideways | 1.0x | - | no data | - |
| 2026-10-25 | +0.21 | 1 | 0 | -0.9% | -2.4% | sideways | 0.6x | - | no data | - |
| 2026-10-26 | +0.09 | 1 | 0 | +0.0% | -2.2% | sideways | 0.7x | - | no data | - |
| 2026-10-27 | +0.05 | 2 | 1 | +0.9% | -2.6% | sideways | 0.9x | - | no data | - |
| 2026-10-28 | -0.21 | 2 | 0 | +0.5% | -3.3% | sideways | 0.7x | - | no data | - |
| 2026-10-29 | -0.62 | 3 | 3 | -4.1% | -4.2% | down | 2.1x | down,up,down,down | no data | Binance $6.3B hack |
| 2026-10-30 | -2.19 | 5 | 3 | -0.8% | -4.7% | down | 1.3x | - | no data | - |
| 2026-10-31 | -0.00 | 3 | 0 | +0.3% | -4.1% | down | 0.4x | - | no data | - |
| 2026-11-01 | +0.56 | 2 | 0 | +1.0% | -2.2% | sideways | 0.5x | - | no data | - |
| 2026-11-02 | +3.30 | 7 | 5 | -1.9% | -4.1% | down | 1.2x | - | no data | - |
| 2026-11-03 | -3.20 | 7 | 1 | +0.8% | -4.2% | down | 0.9x | - | no data | - |
| 2026-11-04 | -5.38 | 4 | 1 | +3.9% | -1.0% | sideways | 3.0x | down,up,up,up | no data | US midterms, Democrats win |
| 2026-11-05 | +6.24 | 7 | 3 | -5.5% | -2.5% | sideways | 3.0x | down,down | no data | - |
| 2026-11-06 | -1.70 | 7 | 0 | -0.3% | -1.9% | sideways | 0.8x | - | no data | - |
| 2026-11-07 | +0.07 | 6 | 0 | +0.0% | -2.2% | sideways | 0.4x | - | no data | - |
| 2026-11-08 | +3.38 | 7 | 1 | -1.3% | -4.5% | down | 1.6x | down | +0.0 | - |
| 2026-11-09 | -2.96 | 10 | 7 | +0.7% | -1.9% | sideways | 1.0x | - | -3.5 | Nvidia CEO scandal |
| 2026-11-10 | +7.52 | 9 | 0 | -2.1% | -4.8% | down | 1.5x | down | -5.1 | Hot US CPI; Nvidia CEO resigns |
| 2026-11-11 | +3.52 | 9 | 0 | +0.3% | -8.1% | down | 0.8x | - | -1.0 | - |
| 2026-11-12 | +1.58 | 11 | 2 | -3.5% | -6.1% | down | 1.7x | down | +0.0 | - |
| 2026-11-13 | +1.21 | 11 | 4 | -4.4% | -9.9% | down | 2.4x | down,up | +0.0 | - |
| 2026-11-14 | +24.03 | 17 | 7 | -6.1% | -15.4% | down | 3.2x | down,down,down,down | +0.0 | - |
| 2026-11-15 | -10.28 | 17 | 0 | +2.6% | -12.4% | down | 2.6x | down,up,up | +0.0 | - |

## 5. Streaks (3 or more days in a row)

| Streak | Days | Total R | BTC over streak | Phase | Avg range vs normal | Shock days | Tags |
|---|---|---|---|---|---|---|---|
| loss | 2026-10-28 to 2026-10-30 (3) | -3.02 | -4.4% | sideways/down | 1.4x | 1 | Binance $6.3B hack |
| profit | 2026-11-10 to 2026-11-14 (5) | +37.86 | -14.9% | down | 1.9x | 4 | Hot US CPI; Nvidia CEO resigns |

## 6. What kind of day made or lost money

| BTC 7-day phase | Days | Total R | Avg R per day | Profit days |
|---|---|---|---|---|
| sideways | 11 | -3.60 | -0.33 | 5 |
| down | 12 | +28.25 | +2.35 | 7 |

| Day range | Days | Total R | Avg R per day | Profit days |
|---|---|---|---|---|
| normal | 9 | +3.76 | +0.42 | 3 |
| narrow (0.75x or less) | 6 | +0.72 | +0.12 | 4 |
| wide (1.5x+) | 8 | +20.17 | +2.52 | 5 |

| Price shock that day | Days | Total R | Avg R per day | Profit days |
|---|---|---|---|---|
| none | 14 | -3.04 | -0.22 | 6 |
| down-shock | 9 | +27.69 | +3.08 | 6 |

| Keyword news mood (from Nov 8) | Days | Total R | Avg R per day | Profit days |
|---|---|---|---|---|
| no data | 15 | -3.35 | -0.22 | 6 |
| neutral (near 0) | 6 | +23.45 | +3.91 | 5 |
| bearish (-2 or lower) | 2 | +4.56 | +2.28 | 1 |

## 7. Entry clusters (3 or more entries inside 4 hours, live and paper)

| First entry (UTC) | Entries | Bots | Coins | Side | BTC 72h before | Shock 72h before | Tags 72h before | Live R (closed + open) | Live won / lost |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-30 00:00 | 3 | bbcore | NEAR ADA GALA | SHORT | -2.7% | down,up,down,down | Binance $6.3B hack | -1.58 | 1 / 2 |
| 2026-11-02 16:00 | 3 | bbcore icore | SOL ZEC | SHORT | -0.1% | - | - | -3.10 | 0 / 3 |
| 2026-11-05 15:00 | 6 | bb1h icore bbcore | GALA SOL NEAR ADA | SHORT | +0.6% | down,up,up,up,down | US midterms, Democrats win | +2.98 | 2 / 0 |
| 2026-11-08 20:00 | 5 | bbtr tcore bb1h | NEAR ZEC SOL | SHORT | -0.6% | - | - | +2.12 | 1 / 0 |
| 2026-11-09 00:00 | 9 | bbcore bbtr tcore icore | SOL ADA GALA ZEC | SHORT | -1.6% | down | - | +12.38 | 4 / 3 |
| 2026-11-13 04:00 | 6 | bbtr bbcore tcore | ADA GALA ETH | SHORT | -7.5% | down,down,down | Hot US CPI; Nvidia CEO resigns | +1.01 | 2 / 2 |
| 2026-11-14 13:00 | 5 | bb1h bbcore tcore | GALA NEAR | SHORT | -9.3% | down,down,up,down | - | +0.61 | 3 / 0 |

## 8. Every live entry, stamped with what was known at entry

| Entry (UTC) | Bot | Coin | Side | BTC 24h | BTC 72h | Context | News mood | Tags 72h | Result R | State |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-24 16:00 | bbcore | SOL | SHORT | -2.3% | -5.6% | quiet | no data | - | +1.21 | time |
| 2026-10-27 20:00 | bbcore | ZEC | LONG | +1.0% | +0.4% | quiet | no data | - | -1.03 | stop |
| 2026-10-29 04:00 | bbcore | ADA | SHORT | -1.6% | +0.3% | after down-shock | no data | - | -1.04 | stop |
| 2026-10-29 08:00 | bbcore | NEAR | SHORT | -1.5% | -0.2% | after down-shock | no data | - | -1.04 | stop |
| 2026-10-29 20:00 | icore | SOL | SHORT | -0.9% | +1.0% | after both | no data | Binance $6.3B hack | +7.57 | open |
| 2026-10-30 00:00 | bbcore | NEAR | SHORT | -4.1% | -2.7% | after both | no data | Binance $6.3B hack | -1.01 | stop |
| 2026-10-30 00:00 | bbcore | ADA | SHORT | -4.1% | -2.7% | after both | no data | Binance $6.3B hack | +0.46 | time |
| 2026-10-30 00:00 | bbcore | GALA | SHORT | -4.1% | -2.7% | after both | no data | Binance $6.3B hack | -1.03 | stop |
| 2026-11-02 12:00 | bbcore | NEAR | SHORT | -0.1% | +0.7% | quiet | no data | - | +2.97 | time |
| 2026-11-02 16:00 | bbcore | SOL | SHORT | -0.6% | -0.1% | quiet | no data | - | -1.06 | stop |
| 2026-11-02 20:00 | icore | ZEC | SHORT | -0.9% | +0.2% | quiet | no data | - | -1.02 | stop |
| 2026-11-02 20:00 | bbcore | ZEC | SHORT | -0.9% | +0.2% | quiet | no data | - | -1.02 | stop |
| 2026-11-02 20:00 | bbcore | GALA | SHORT | -0.9% | +0.2% | quiet | no data | - | -1.07 | stop |
| 2026-11-03 20:00 | icore | GALA | SHORT | +0.7% | +0.1% | quiet | no data | - | -1.11 | stop |
| 2026-11-04 12:00 | icore | ZEC | LONG | +1.8% | +0.7% | after both | no data | US midterms, Democrats win | -1.07 | stop |
| 2026-11-05 08:00 | icore | GALA | SHORT | +2.9% | +2.9% | after both | no data | US midterms, Democrats win | +3.41 | open |
| 2026-11-05 16:00 | icore | ADA | SHORT | -5.3% | -1.9% | after both | no data | US midterms, Democrats win | +2.68 | open |
| 2026-11-05 16:00 | bbcore | GALA | SHORT | -5.3% | -1.9% | after both | no data | US midterms, Democrats win | +0.30 | time |
| 2026-11-08 20:00 | tcore | NEAR | SHORT | +0.2% | -0.6% | quiet | +0.0 | - | +2.12 | open |
| 2026-11-09 00:00 | bbcore | SOL | SHORT | -1.3% | -1.6% | after down-shock | +0.0 | - | +4.45 | open |
| 2026-11-09 00:00 | tcore | ZEC | SHORT | -1.3% | -1.6% | after down-shock | +0.0 | - | +3.34 | open |
| 2026-11-09 00:00 | bbcore | ZEC | SHORT | -1.3% | -1.6% | after down-shock | +0.0 | - | +4.37 | stop |
| 2026-11-09 00:00 | icore | ZEC | SHORT | -1.3% | -1.6% | after down-shock | +0.0 | - | +3.36 | open |
| 2026-11-09 00:00 | tcore | ADA | SHORT | -1.3% | -1.6% | after down-shock | +0.0 | - | -1.05 | stop |
| 2026-11-09 00:00 | bbcore | ADA | SHORT | -1.3% | -1.6% | after down-shock | +0.0 | - | -1.05 | stop |
| 2026-11-09 00:00 | tcore | GALA | SHORT | -1.3% | -1.6% | after down-shock | +0.0 | - | -1.04 | stop |
| 2026-11-12 16:00 | bbcore | NEAR | SHORT | -3.1% | -5.1% | after down-shock | +0.0 | Hot US CPI; Nvidia CEO resigns | -1.03 | stop |
| 2026-11-12 16:00 | tcore | SUI | SHORT | -3.1% | -5.1% | after down-shock | +0.0 | Hot US CPI; Nvidia CEO resigns | +1.59 | open |
| 2026-11-13 04:00 | bbcore | ADA | SHORT | -6.6% | -7.5% | after down-shock | +0.0 | Hot US CPI; Nvidia CEO resigns | -1.06 | stop |
| 2026-11-13 04:00 | tcore | ADA | SHORT | -6.6% | -7.5% | after down-shock | +0.0 | Hot US CPI; Nvidia CEO resigns | +1.72 | open |
| 2026-11-13 04:00 | tcore | GALA | SHORT | -6.6% | -7.5% | after down-shock | +0.0 | Hot US CPI; Nvidia CEO resigns | -1.03 | stop |
| 2026-11-13 04:00 | tcore | ETH | SHORT | -6.6% | -7.5% | after down-shock | +0.0 | Hot US CPI; Nvidia CEO resigns | +1.38 | open |
| 2026-11-14 04:00 | bbcore | ZEC | SHORT | -3.2% | -9.5% | after both | +0.0 | - | -0.07 | open |
| 2026-11-14 04:00 | bbcore | ADA | SHORT | -3.2% | -9.5% | after both | +0.0 | - | +0.95 | open |
| 2026-11-14 16:00 | bbcore | NEAR | SHORT | -4.6% | -11.1% | after both | +0.0 | - | +0.03 | open |
| 2026-11-14 16:00 | tcore | GALA | SHORT | -4.6% | -11.1% | after both | +0.0 | - | +0.29 | open |
| 2026-11-14 16:00 | bbcore | GALA | SHORT | -4.6% | -11.1% | after both | +0.0 | - | +0.29 | open |
| 2026-11-14 20:00 | bbcore | ARB | SHORT | -4.8% | -11.7% | after both | +0.0 | - | +0.00 | open |
| 2026-11-14 20:00 | tcore | ARB | SHORT | -4.8% | -11.7% | after both | +0.0 | - | +0.00 | open |

## 9. Entries grouped by what was known at entry

| Shock in the 72h before entry | Entries | Total R | Avg R | Winners |
|---|---|---|---|---|
| quiet | 9 | -0.01 | -0.00 | 3 |
| after down-shock | 15 | +11.88 | +0.79 | 7 |
| after both | 15 | +12.79 | +0.85 | 9 |

| BTC 72h before entry | Entries | Total R | Avg R | Winners |
|---|---|---|---|---|
| falling (-3% or more) | 14 | +4.27 | +0.30 | 8 |
| flat | 25 | +20.39 | +0.82 | 11 |

| Hand tag in the 72h before | Entries | Total R | Avg R | Winners |
|---|---|---|---|---|
| no tag | 25 | +11.77 | +0.47 | 11 |
| tagged event | 14 | +12.89 | +0.92 | 8 |

| Keyword news mood at entry (from Nov 8) | Entries | Total R | Avg R | Winners |
|---|---|---|---|---|
| no data | 18 | +7.10 | +0.39 | 7 |
| neutral (near 0) | 21 | +17.55 | +0.84 | 12 |

## 10. Headlines Pulse saved (keyword-scored, market-impact flag only)

| First seen (UTC) | Label | Strength | Stories | Headline |
|---|---|---|---|---|
| 2026-11-09 02:39 | SHORT | 75 | 18 | Jensen Huang's affair with alleged Chinese spy further complicates Nvidia’s China problem |
| 2026-11-09 02:39 | SHORT | 100 | 41 | Nvidia CEO Jensen Huang’s affair with alleged Chinese spy: a timeline |
| 2026-11-09 02:39 | SHORT | 100 | 167 | Nvidia perps crash 7% as CEO Jensen Huang reportedly faces the axe |
| 2026-11-09 12:41 | NEUTRAL | 9 | 3 | Solana Set for Another Tokenized Stock Venue as Formation Notifies the SEC |
| 2026-11-09 13:40 | LONG | 54 | 6 | NYSE picks Avalanche to settle tokenized stocks amid Wall Street's blockchain race |
| 2026-11-09 18:08 | SHORT | 100 | 15 | Claude code has plenty of growth ahead, says Jim Cramer |
| 2026-11-09 18:31 | SHORT | 24 | 7 | The AI boom was built around Jensen Huang. What happens now? |
| 2026-11-10 09:14 | SHORT | 39 | 4 | Coinbase, Kalshi, Kraken parent back CFTC in legal fight over stock perpetual futures |
| 2026-11-10 10:17 | SHORT | 84 | 3 | Near AI Breach Exposes User Details and Data From 18 AI Agents |
| 2026-11-10 13:32 | SHORT | 100 | 3 | Consumer prices rose 0.4% in October, more than expected, complicating Fed's inflation fight |
| 2026-11-10 16:27 | SHORT | 100 | 5 | Hot US inflation raises odds of half-point Fed hike in December |
| 2026-11-10 19:40 | SHORT | 100 | 42 | Jensen Huang resigns as Nvidia CEO, exits board; shares plunge |
| 2026-11-10 23:46 | SHORT | 24 | 4 | Iran war live: US House blocks Hegseth impeachment with 11 Democrats absent |
| 2026-11-10 23:54 | SHORT | 66 | 14 | OpenAI posts steep losses even as quarterly revenue rises to $10 billion, WSJ reports |
| 2026-11-11 08:30 | SHORT | 100 | 33 | SmartStop director David Mueller sells $13,621 in SMA shares |
| 2026-11-11 15:33 | NEUTRAL | 6 | 29 | Anthropic’s IPO Is About Six Times Oversubscribed |
| 2026-11-13 21:32 | NEUTRAL | 33 | 17 | U.S. air travel could take days to recover after FAA’s lifting of rare nationwide ground stop |
