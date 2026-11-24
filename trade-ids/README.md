# Trade IDs

Format: `BOT-COIN-SIDE-YYMMDD-HHMM` (UTC time of the 4h signal candle). Example: `BBC-SOL-S-261120-0800`.

| Part | Meaning |
|---|---|
| BBC / ICO / TCO | BB-CORE / I-CORE / T-CORE (TCP = T-CORE paper, B1H = BB-CORE 1h paper) |
| COIN | SOL, ZEC, ... |
| S / L | short / long |
| YYMMDD-HHMM | signal candle open, UTC (the bot enters at the next open, 4h later) |

Why this format: it needs no counter or database state, so the same trade always gets the same ID, past trades can be back-filled, and the backtest gives the same ID as the live bot. The old internal ID (`SOL_USDT|SHORT|<ms>`) does not name the bot, so 6 of the 43 live entries share an ID with another bot's trade.

`trade-id.js` is the one function (self-test: `node trade-ids/trade-id.js`). `REGISTER.md` lists every live trade so far.
Not deployed: no bot, dashboard or database was changed.
