# Profit-cause simulation: what the recorder would have shown, Oct 24 to Nov 15 2026

Run: `node sim.js` (writes `RESULTS.md` with every table, and `results.json`). No AI is used anywhere.

## What it is

A replay of the "profit-cause recorder" idea on the real live trades, to see what it would have recorded
and whether the news explains the profit. It does not test a trading rule and changes no bot.

## Inputs

| Input | Source | Covers |
|---|---|---|
| Trades | `trades.csv`, entry and exit events from the dashboard database | 39 live entries, 17 paper, Oct 24 to Nov 14 |
| Prices | local candle library, Binance perps 1h | all traded coins and BTC |
| Headlines | Pulse daily briefs (`crypto-news/data/briefs`), keyword-scored by Pulse | Nov 8 to Nov 15 only |
| Hand tags | `events.json`, 5 events dated from public reports | Binance hack, midterms, Nvidia (2), CPI |

## Method

1. **Price shock**: a BTC 1h bar that moved at least 3x its normal size (30-day) with at least 2x normal volume.
2. **Daily journal**: one row per day with the live bots' mark-to-market R, BTC day and 7-day change, phase
   (7-day change of -4% or lower = down, +4% or higher = up, else sideways), day range against the 30-day median,
   shocks, keyword news mood, hand tag.
3. **Streaks**: 3 or more profit days or loss days in a row.
4. **Entry clusters**: 3 or more entries inside 4 hours.
5. **Entry stamp**: each live entry gets what was known at that moment (BTC 24h and 72h change, shocks and tags in the
   72h before, news mood in the 24h before). Nothing after the entry time is used.

Open trades are marked at the last closed bar (Nov 15 23:00 UTC) with the first stop as 1R.

## Findings

1. Live total is about +24.7R, made of -8.45R closed (22 trades, 5 won) and +33.1R still open (17 trades).
   The profit is almost all unrealised.
2. One profit streak carries the period: Nov 10 to 14, +37.9R, while BTC fell 14.9%. Nov 14 alone was +24.0R and
   Nov 15 gave back 10.3R.
3. Down-shock days made +27.7R over 9 days. The 14 days with no shock lost 3.0R. Down-phase days +28.3R,
   sideways days -3.6R.
4. Entries after a shock (30) made +24.7R. Entries in quiet conditions (9) made 0.0R.
5. The two events from the earlier weeks did not pay. The Binance hack days (Oct 28 to 30) were a 3-day loss
   streak, -3.0R: BTC dropped 4.9% in a day and then stalled, and the shorts opened after it were stopped.
   After the midterms BTC rose 4.7% in 24h and Nov 4 cost 5.4R.
6. The largest cluster (9 entries by 4 bots, Nov 9 00:00 UTC, +12.4R live) opened 2.6 hours before Pulse first saw
   the Nvidia story. It followed a price down-shock at Nov 8 21:00 that has no tagged news.
7. Hot CPI (Nov 10 13:30) is the tag that lines up best: a shock 90 minutes later, BTC -7% over 72h, and the start
   of the profit streak. The shorts were already open.
8. Keyword news mood was bearish on only 2 days (Nov 9 and 10) and read zero from Nov 12 to 15, during the largest
   fall. It also mislabelled stories (a Microsoft outage and a stock-sale filing scored as strongly bearish).

## Limits

- 23 days, one market fall, one +24R day. This is a description, not evidence of a rule.
- Headlines exist only from Nov 8, so the hack and the midterms rest on hand tags with approximate hours.
- Open R is an estimate from Binance prices; the bots trade on MEXC. The trade list shows 4 open I-CORE and
  7 open T-CORE positions, the wallets report 3 and 8, so one position on each is unconfirmed.
- Total unrealised R from the wallets (about 34R) agrees with the simulation (33.1R).
