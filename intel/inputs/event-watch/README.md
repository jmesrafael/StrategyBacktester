# Event watch: what it is and how to use it

Written Nov 19, 2026. Plain text, no AI needed at runtime.

## What it does

We run a SHORT-only live book (BB-Core, I-Core, T-Core on MEXC). Big news (Fed, CPI, Nvidia, IPOs, hacks) can squeeze or sink it.
The event watch records, for every event, three things: what the news said, what BTC did, and what OUR open profit did.
After enough events we can answer: does a hawkish or risk-off event help or hurt our shorts, and should the strategies react (for example lock +1R before known events)?

## The pieces (all four hold the same event list)

| Piece | Where | What it does |
|---|---|---|
| Notes and scoreboard | `event-watch/2026-11-17-fomc-anthropic-week.md` (this folder) | Our P&L reaction per event. Scoreboard at the top, Result log table, Upcoming watch list at the bottom. READ THIS FIRST |
| Event list for the research engine | `../owner-tags.csv` | One row per event (9 columns, no commas inside fields). `node run.js all` in `intel/` on the home PC measures BTC and coin moves for each row and writes `reports/events.md` |
| Dashboard tab | `ledger/lib/market-events.js` (Market Events tab, admin only) | Shows BTC move, trades held at the news, 1h/24h/72h live P&L, verdict helped/hurt at +-0.5% |
| Telegram heads-up | `ledger/lib/event-alerts.js` | Message about 1 hour before each listed event (only FOMC, CPI and Anthropic are listed) |

## How to record an event (about 10 minutes)

1. Wait at least 1 h after the event (24 h and 72 h later for the longer columns).
2. Refresh candles: in `StrategyBacktester` run `node candles/update.js --no-1m`. Read BTC 1h bars around the event: `require('./candles/candles.js').load('BTC','1h')` (bars are [openTimeSec, o, h, l, c, vol]; a bar's open is the price at its start).
3. Ledger (Supabase project "Backtester", id vkfetsmnlylcsbwxcord): from `wallet_snapshots` take the last report per wallet (`bbcore`, `icore`, `tcore`) per hour, add equity and unrealized across the three wallets, for just before the event, +1h, +24h, +72h. From `closed_trades` list anything closed near the event. Do NOT select investor or profile tables (personal data).
4. What the news actually said: web search, and mark it "unverified" (crypto press is often wrong; the real figure may not be found).
5. Fill the row in the Result log, update the Scoreboard row, and add a line to the "Pattern so far" paragraph if something changed.
6. Set `direction` (bullish/bearish) in `owner-tags.csv` ONLY once it is clear what the event did to BTC. Leave blank if mixed. Keep the CSV at 9 columns: no commas in notes.
7. Mirror the result (`direction`, `result`) into `ledger/lib/market-events.js`; after 72 h copy the live numbers into `recorded` because wallet reports are kept 30 days. Run `npm test` in `ledger` and ask the owner before commit or push.
8. On the home PC: `node run.js all` in `StrategyBacktester/intel`.

## Rules for reading results

- "Good for us" = BTC and alts falling (we are short).
- Always note manual actions that day (extended exits, hand closes, stops hit), they muddy the read. Known so far: BB-Core time exits extended to Mon Nov 23 (Nov 17), SOL closed by hand Nov 17 23:28, ZEC stop hit Nov 17 23:12.
- A move that starts long after the release (for example the Nov 17 15:00 dump, 90 min after retail sales) is not credited to the release.
- Moves under 0.5% of the account in 24 h count as "little effect".
- Web facts are labelled unverified until checked against a primary source (Fed, BLS, BEA, company release).

## Status (Nov 19, 2026)

Recorded: retail sales, Nvidia, FOMC minutes (+1h/+5h), Anthropic IPO pricing. Pending: Anthropic debut Nov 19 14:30 UTC (a one-shot reminder is set for 15:43 UTC / 23:43 Manila in the Claude session that wrote this; it only fires while that session is open), FOMC +24h/+72h, jobless claims, UMich, OKX x ICE, PCE/GDP, Dec 9 FOMC, Dec 10 CPI.
