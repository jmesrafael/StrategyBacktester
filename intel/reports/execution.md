# Execution quality and capacity

As of 2026-11-16 05:00 UTC. Live trades only unless stated. Read-only and informational: nothing here suggests a change to any bot.

## A. Entry quality

Sample: 39 live entries. Slippage in R: negative means worse than intended. Slippage in bp: positive means paid more than intended.

| Bot | Coin | n | Median slip R | Mean slip R | Worst R | Median delay s | P90 delay s | n bp | Median bp |
|---|---|---|---|---|---|---|---|---|---|
| bbcore | ALL | 22 | +0.013 | +0.013 | -0.031 | 10.0 | 13.9 | 22 | +2.9 |
| bbcore | ADA | 5 | +0.011 | +0.011 | -0.031 | 11.0 | 14.2 | 5 | +5.1 |
| bbcore | ARB | 1 | -0.017 | -0.017 | -0.017 | 15.0 | 15.0 | 1 | +2.3 |
| bbcore | GALA | 4 | +0.026 | +0.025 | +0.016 | 13.0 | 13.7 | 4 | +6.3 |
| bbcore | NEAR | 5 | -0.004 | +0.002 | -0.005 | 9.0 | 9.6 | 5 | +0.0 |
| bbcore | SOL | 3 | +0.020 | +0.026 | +0.006 | 7.0 | 8.6 | 3 | +5.0 |
| bbcore | ZEC | 4 | +0.013 | +0.017 | -0.004 | 10.0 | 10.0 | 4 | +2.3 |
| icore | ALL | 7 | +0.009 | +0.014 | -0.003 | 8.0 | 11.0 | 7 | +2.2 |
| icore | ADA | 1 | +0.040 | +0.040 | +0.040 | 9.0 | 9.0 | 1 | +0.0 |
| icore | GALA | 2 | +0.000 | +0.000 | +0.000 | 11.0 | 11.0 | 2 | +3.0 |
| icore | SOL | 1 | -0.003 | -0.003 | -0.003 | 8.0 | 8.0 | 1 | +3.0 |
| icore | ZEC | 3 | +0.017 | +0.021 | +0.009 | 7.0 | 7.8 | 3 | +2.2 |
| tcore | ALL | 10 | +0.013 | +0.005 | -0.024 | 14.0 | 16.1 | 10 | +3.9 |
| tcore | ADA | 2 | +0.001 | +0.001 | -0.024 | 12.5 | 13.7 | 2 | -3.2 |
| tcore | ARB | 1 | -0.024 | -0.024 | -0.024 | 16.0 | 16.0 | 1 | +2.3 |
| tcore | ETH | 1 | +0.003 | +0.003 | +0.003 | 16.0 | 16.0 | 1 | -2.0 |
| tcore | GALA | 3 | +0.013 | +0.013 | +0.013 | 14.0 | 15.6 | 3 | +13.4 |
| tcore | NEAR | 1 | +0.015 | +0.015 | +0.015 | 12.0 | 12.0 | 1 | +5.5 |
| tcore | SUI | 1 | -0.007 | -0.007 | -0.007 | 17.0 | 17.0 | 1 | -8.8 |
| tcore | ZEC | 1 | +0.022 | +0.022 | +0.022 | 6.0 | 6.0 | 1 | +16.2 |

## B. Stop quality

Closed trades that ended on the stop and still had the first stop. Overshoot in R: positive means the exit was worse than the stop price.

| Bot | n | Median R | P90 R | Worst R |
|---|---|---|---|---|
| bbcore | 12 | +0.004 | +0.016 | +0.032 |
| icore | 3 | +0.032 | +0.059 | +0.066 |
| tcore | 3 | +0.013 | +0.013 | +0.013 |

## C. Cost per trade (exchange records)

Fees and funding in USD (negative = paid). Cost in R is an estimate.

| Bot | n closed | Fees USD | Funding USD | Realized USD | Fees / gross | n for R | Avg cost R |
|---|---|---|---|---|---|---|---|
| bbcore | 16 | -2.35 | 0.66 | -10.81 | 2.4% | 16 | -0.032 |
| icore | 3 | -0.07 | -0.01 | -3.02 | 2.5% | 3 | -0.031 |
| tcore | 3 | -0.26 | 0.01 | -8.31 | 3.2% | 3 | -0.033 |

## D. Liquidity and its trend (Binance 1h bars)

Sample: 8 coins. Ratio below 0.6 is flagged as liquidity falling.

| Coin | Bars 30d / 180d | Median hour USD 30d | Median hour USD 180d | Ratio 30d/180d | Flag | Median hour range bp (30d) |
|---|---|---|---|---|---|---|
| ADA | 720 / 4320 | 3,790,159 | 5,305,824 | 0.71 |  | 90.3 |
| ARB | 720 / 4320 | 2,552,951 | 1,606,370 | 1.59 |  | 135.8 |
| ETH | 720 / 4320 | 209,937,156 | 224,915,549 | 0.93 |  | 61.2 |
| GALA | 720 / 4320 | 293,899 | 336,314 | 0.87 |  | 103.3 |
| NEAR | 720 / 4320 | 16,235,833 | 9,751,005 | 1.67 |  | 157.3 |
| SOL | 720 / 4320 | 43,232,821 | 51,039,407 | 0.85 |  | 78.8 |
| SUI | 720 / 4320 | 5,481,409 | 6,246,104 | 0.88 |  | 99.8 |
| ZEC | 720 / 4320 | 57,782,447 | 40,836,839 | 1.42 |  | 160.8 |

## E. Capacity estimate (estimate from Binance volume, because MEXC order-book data is not available yet)

Notional = risk % x equity at entry x entry price / 1R distance, median per bot and coin. Max size = 1% of the median hourly dollar volume (30d). Headroom = max size / notional.

| Bot | Coin | Trades / sized | Notional USD | Participation | Max size 1% USD | Headroom x |
|---|---|---|---|---|---|---|
| bbcore | ADA | 5 / 5 | 117 | 0.0031% | 37,902 | 322.6 |
| bbcore | ARB | 1 / 1 | 75 | 0.0030% | 25,530 | 338.9 |
| bbcore | GALA | 4 / 4 | 97 | 0.0332% | 2,939 | 30.2 |
| bbcore | NEAR | 5 / 5 | 95 | 0.0006% | 162,358 | 1707.7 |
| bbcore | SOL | 3 / 2 | 191 | 0.0004% | 432,328 | 2268.6 |
| bbcore | ZEC | 4 / 3 | 81 | 0.0001% | 577,824 | 7103.8 |
| icore | ADA | 1 / 1 | 17 | 0.0005% | 37,902 | 2193.2 |
| icore | GALA | 2 / 2 | 20 | 0.0067% | 2,939 | 148.2 |
| icore | SOL | 1 / 1 | 40 | 0.0001% | 432,328 | 10831.0 |
| icore | ZEC | 3 / 3 | 13 | 0.0000% | 577,824 | 44483.3 |
| tcore | ADA | 2 / 2 | 56 | 0.0015% | 37,902 | 676.4 |
| tcore | ARB | 1 / 1 | 55 | 0.0022% | 25,530 | 463.5 |
| tcore | ETH | 1 / 1 | 77 | 0.0000% | 2,099,372 | 27140.5 |
| tcore | GALA | 3 / 3 | 55 | 0.0188% | 2,939 | 53.2 |
| tcore | NEAR | 1 / 1 | 44 | 0.0003% | 162,358 | 3720.2 |
| tcore | SUI | 1 / 1 | 52 | 0.0010% | 54,814 | 1045.1 |
| tcore | ZEC | 1 / 1 | 36 | 0.0001% | 577,824 | 15907.7 |

## F. Order-book capacity

Order-book capacity is waiting for the recorder pull. The MEXC dataset is not available yet.

## What stands out

- No bot, coin or cost crossed any of the simple warning levels.
- Lowest headroom: bbcore GALA at 30.2x (4 sized trades).
- Median entry slippage per bot: bbcore +0.013R (n=22), icore +0.009R (n=7), tcore +0.013R (n=10).

## Limits

- Small samples: many bot and coin groups have only a few trades. One trade can move a median.
- Binance volume stands in for MEXC volume. The bots trade on MEXC, so real capacity can differ.
- Costs in R are estimates built from fees, paid funding and a dollar value of 1R derived from the exchange record.

Notes: order-book capacity is waiting for the recorder pull
