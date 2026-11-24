# Event watch, automatic record

Built 2026-11-24T05:30Z by `node scripts/event-record.js` (no AI, no network). BTC library ends 11-24 04:00 UTC, ledger export ends 11-24 05:00 UTC (hour 11-24 05:00).
Our book is SHORT only: BTC down = good for us. "Worst in event hour + 1 h" = the lower of the two hourly snapshots (end of event hour, end of next hour) minus the snapshot before the event hour. Events less than 24 h apart overlap, so read their +24 h columns together, not one by one. Equity includes closed trades; unrealized does not.

## Past events (BTC from the candle library, our book from the ledger export)

| Event (UTC) | Type | BTC at hour open | +1h | +4h | +24h | +72h | 24h high / low | Equity before | Worst in event hour + 1 h | Equity 4h / 24h later (vs before) | Equity low / high in 24h | Closed in event hour + 4 h |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11-17 13:30 US retail sales (Oct) | macro, bearish | 65035 | +0.1% | -2.0% | -1.5% | -5.4% | +0.6% / -2.7% | 657.1 | +1.4 | +29.0 / +12.5 | 648.8 / 692.6 | none |
| 11-17 21:20 Nvidia Q3 earnings (first since CEO exit) | stocks, bullish | 63974 | +0.6% | +1.2% | -2.1% | -8.6% | +2.0% / -2.7% | 675.9 | -18.2 | -21.8 / +2.8 | 648.8 / 689.3 | bbcore ZEC -6.14 (-1.03R); bbcore SOL +18.02 (3.55R) |
| 11-18 19:00 FOMC minutes (Oct 27-28 meeting) | macro, bearish | 63143 | -0.7% | -1.5% | -0.4% | -4.8% | +1.4% / -1.8% | 673.3 | +5.4 | +14.6 / +1.2 | 657.6 / 687.9 | none |
| 11-18 22:00 Anthropic IPO priced | stocks, bearish | 62326 | -0.2% | +0.8% | -1.3% | -3.0% | +2.8% / -1.5% | 679.0 | -7.0 | -0.5 / +18.4 | 657.6 / 697.4 | none |
| 11-19 13:30 US jobless claims | macro, bearish | 63848 | +0.2% | -1.7% | -3.6% | -4.7% | +0.3% / -4.2% | 660.2 | -2.5 | +19.7 / +73.9 | 657.7 / 734.1 | none |
| 11-19 14:30 Anthropic ANT Nasdaq debut | stocks, bearish | 64005 | -0.7% | -2.0% | -3.4% | -5.1% | +0.0% / -4.5% | 657.7 | +5.5 | +18.4 / +80.9 | 663.2 / 738.6 | none |
| 11-20 15:00 UMich consumer sentiment (final Nov) | macro, bearish | 61744 | -3.7% | -5.5% | -2.3% | +1.8% | +0.3% / -10.7% | 738.6 | +49.2 | +46.4 / +31.2 | 766.7 / 867.1 | none |
| 11-23 00:00 OKX x ICE 24/7 tokenized stocks launch *(hour unknown)* | crypto | 61237 | +0.1% | +0.0% | +0.0% | pending | +5.4% / -1.4% | 765.0 | +2.6 | -4.3 / -23.1 | 711.9 / 776.2 | none |
| 11-23 13:00 Nvidia reinstates Jensen Huang as CEO | stocks | 61294 | +4.1% | +1.5% | pending | pending | +5.3% / -3.0% (so far) | 756.5 | -44.6 | -36.6 / pending | 711.9 / 753.8 | bbcore SOL -9.94 (-1.08R); icore NEAR +0.26 (0.07R); icore ZEC +9.33 (3.47R) |

How to read: a row with "pending" means the +N h hour has not started yet in the data; run the script again later. "no ledger data" means the event is before the export starts. Direction in the CSV is still set by hand once the +24 h read is in.

## Upcoming events (next 21 days, from owner-tags.csv)

| When (UTC) | In | Event | Type | Record after |
|---|---|---|---|---|
| 11-25 13:30 | 32.0 h | US PCE (Oct) and Q3 GDP second estimate | macro | 11-26 14:30 (+24 h read) |
| 11-26 14:30 | 2.4 d | US Thanksgiving thin liquidity (US stocks closed Nov 26; early close Nov 27) | macro | 11-27 15:30 (+24 h read) |
| 11-30 21:00 | 6.6 d | MSCI removes Strategy (MSTR) and Metaplanet from indexes | crypto | 12-01 22:00 (+24 h read) |
| 12-09 19:00 | 15.6 d | FOMC rate decision | macro | 12-10 20:00 (+24 h read) |
| 12-10 13:30 | 16.3 d | US CPI (November) | macro | 12-11 14:30 (+24 h read) |
| 12-15 00:00 | 20.8 d | ARB token unlock (about 92.6M ARB) | crypto | 12-16 01:00 (+24 h read) |

Events still waiting for the +24 h read: Nvidia reinstates Jensen Huang as CEO.
