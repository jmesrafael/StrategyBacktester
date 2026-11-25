# Event watch, automatic record

Built 2026-11-25T07:14Z by `node scripts/event-record.js` (no AI, no network). BTC library ends 11-25 06:00 UTC, ledger export ends 11-25 06:00 UTC (hour 11-25 06:00).
Our book is SHORT only: BTC down = good for us. "Worst in event hour + 1 h" = the lower of the two hourly snapshots (end of event hour, end of next hour) minus the snapshot before the event hour. Events less than 24 h apart overlap, so read their +24 h columns together, not one by one. Equity includes closed trades; unrealized does not.

## Past events (BTC from the candle library, our book from the ledger export)

| Event (UTC) | Type | BTC at hour open | +1h | +4h | +24h | +72h | 24h high / low | Equity before | Worst in event hour + 1 h | Equity 4h / 24h later (vs before) | Equity low / high in 24h | Closed in event hour + 4 h |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11-23 00:00 OKX x ICE 24/7 tokenized stocks launch *(hour unknown)* | crypto | 61237 | +0.1% | +0.0% | +0.0% | pending | +5.4% / -1.4% | 765.0 | +2.6 | -4.3 / -23.1 | 711.9 / 776.2 | none |
| 11-23 13:00 Nvidia reinstates Jensen Huang as CEO | stocks | 61294 | +4.1% | +1.5% | -1.4% | pending | +5.3% / -3.1% | 756.5 | -44.6 | -36.6 / -2.2 | 711.9 / 755.8 | bbcore SOL -9.94 (-1.08R); icore NEAR +0.26 (0.07R); icore ZEC +9.33 (3.47R) |
| 11-24 14:30 US AI chip stock sell-off | stocks | 59987 | +0.7% | +0.2% | pending | pending | +1.1% / -1.8% (so far) | 759.7 | -0.4 | +3.5 / pending | 756.2 / 769.8 | none |
| 11-24 14:31 US new tariffs on China EU and 14 other economies reported | politics | 59987 | +0.7% | +0.2% | pending | pending | +1.1% / -1.8% (so far) | 759.7 | -0.4 | +3.5 / pending | 756.2 / 769.8 | none |

How to read: a row with "pending" means the +N h hour has not started yet in the data; run the script again later. "no ledger data" means the event is before the export starts. Direction in the CSV is still set by hand once the +24 h read is in.

## Upcoming events (next 21 days, from owner-tags.csv)

| When (UTC) | In | Event | Type | Record after |
|---|---|---|---|---|
| 11-25 13:30 | 6.3 h | US PCE (Oct) and Q3 GDP second estimate | macro | 11-26 14:30 (+24 h read) |
| 11-26 14:30 | 31.3 h | US Thanksgiving thin liquidity (US stocks closed Nov 26; early close Nov 27) | macro | 11-27 15:30 (+24 h read) |
| 11-30 21:00 | 5.6 d | MSCI removes Strategy (MSTR) and Metaplanet from indexes | crypto | 12-01 22:00 (+24 h read) |
| 12-09 19:00 | 14.5 d | FOMC rate decision | macro | 12-10 20:00 (+24 h read) |
| 12-10 13:30 | 15.3 d | US CPI (November) | macro | 12-11 14:30 (+24 h read) |
| 12-15 00:00 | 19.7 d | ARB token unlock (about 92.6M ARB) | crypto | 12-16 01:00 (+24 h read) |

Events still waiting for the +24 h read: US AI chip stock sell-off; US new tariffs on China EU and 14 other economies reported.
