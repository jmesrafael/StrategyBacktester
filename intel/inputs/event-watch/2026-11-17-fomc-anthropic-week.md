# Event watch: Nov 17-20, 2026 (FOMC minutes, Nvidia, Anthropic IPO) and what it did to the live shorts

Started Nov 17, 2026 08:41 UTC at the owner's request: keep a permanent record of how news events move the open trades, like the Binance hack, the US midterms and the Nvidia CEO exit, so the strategies can be improved later.
Plain text and CSV only, no AI at runtime. The event rows live in `owner-tags.csv` (the events engine measures BTC and coin moves from the candle library after each event: `node run.js all`).
This file holds what the engine cannot see: the state of OUR trades before and after each event.

## Before the events (what the owner and the web said, NOT verified)

- Backdrop: BTC about $64.3K after six weekly losses, range about $62K-$69K. Fed held at 3.75-4% on Oct 28 in a 10-2 vote; the two dissenters wanted a hike. A 25 bp hike on Dec 9 is priced about 91-96% (sources differ).
- Expectation per the pasted web summaries (written by AI search, may contain mistakes): short-term bearish or choppy, 60-70% odds of bearish-to-sideways in the 24-72 h around the minutes; support $62.0-62.5K (about 26% chance of losing it per one prediction-market quote); relief bounce risk Thursday afternoon / Friday after the IPO and the minutes.
- Dated claims to check against the result: retail sales forecast 0.0%; Nvidia EPS consensus 2.47; Anthropic 825M shares at $70-78, prices evening Nov 18, trades Thu Nov 19.
- Later events (not yet in the CSV): US jobless claims Thu Nov 19 13:30 UTC, UMich sentiment Fri Nov 20 15:00 UTC, Russia exchange trading Nov 22, OKX x ICE 24/7 tokenized stocks Nov 23, FOMC decision Dec 9 19:00 UTC.

## Baseline: our live shorts at Nov 17 08:15 UTC (BTC 64,338 at 08:41)

Ledger (wallet_snapshots, three live wallets):

| Wallet | Open | Equity USDT | Unrealized USDT |
|---|---|---|---|
| BB-Core | 6 | 336.70 | +26.11 |
| I-CORE | 3 | 158.01 | +14.45 |
| T-CORE | 8 | 174.13 | +38.19 |
| **Total** | **17** | **668.84** | **+78.75** |

Reference: the open-profit peak was **+$146.5 (equity $736.7) on Nov 15 01:00 UTC**; no live trade closed since Nov 14 (last entries ARB, GALA, NEAR on Nov 14).

Positions (16 listed in `btc-scenarios/data/positions.json`; the ledger counts 17, so one is missing from that file). Price = Binance perp at about 08:25 UTC.

| Bot | Coin | Entry | Price | Stop | Time exit (UTC) |
|---|---|---|---|---|---|
| T-CORE | ZEC | 1210.98 | 923 | 1301.36 | trailing, no time limit |
| T-CORE | ADA | 0.1684 | 0.1530 | 0.1766 | same |
| T-CORE | ETH | 1933.43 | 1828 | 2010.92 | same |
| T-CORE | SUI | 0.7949 | 0.7217 | 0.8344 | same |
| T-CORE | NEAR | 3.637 | 3.247 | 3.838 | same |
| T-CORE | GALA | 0.001387 | 0.001373 | 0.001466 | same |
| T-CORE | ARB | 0.13149 | 0.13219 | 0.14201 | same |
| BB-Core | SOL | 86.48 | 72.6 | n/a in ledger | Mon Nov 23 04:00 (was Thu Nov 19, extended Nov 17) |
| BB-Core | ADA | 0.1632 | 0.153 | n/a | Mon Nov 23 08:00 (was Sat Nov 21) |
| BB-Core | ZEC | 903.84 | 923 | n/a | Mon Nov 23 08:00 (was Sat Nov 21) |
| BB-Core | NEAR | 3.218 | 3.247 | n/a | Mon Nov 23 20:00 (was Sat Nov 21) |
| BB-Core | GALA | 0.001386 | 0.001373 | n/a | Mon Nov 23 20:00 (was Sat Nov 21) |
| BB-Core | ARB | 0.13149 | 0.13219 | n/a | Mon Nov 23 00:00 (was Sun Nov 22) |
| I-CORE | SOL | 99.79 | 72.6 | n/a | far beyond a normal trade |
| I-CORE | ADA | 0.1819 | 0.153 | n/a | same |
| I-CORE | GALA | 0.001674 | 0.001373 | n/a | same |

Owner action on Nov 17 (08:26-08:28 UTC): BB-Core time exits extended to Monday Nov 23 for all six trades (commands collected by the bot). Stops untouched. This is a manual decision made on the day, so a later result that depends on it must be read with it in mind.

## Result log (fill in after each event; ask for "record the event")

For each event: BTC price at the event moment, 1 h / 24 h / 72 h later, the three wallets' unrealized and equity just before and 1 h / 24 h after, any trade that closed or stop that moved, and what the news actually said. Direction (bullish/bearish) goes into `owner-tags.csv` only once known.

| Event (UTC) | Actual result | BTC at / +1h / +24h / +72h | Live unrealized before | +1h | +24h | Trades closed or stops moved | Lesson |
|---|---|---|---|---|---|---|---|
| US retail sales, Nov 17 13:30 | | | | | | | |
| Nvidia earnings, Nov 17 ~21:20 | | | | | | | |
| FOMC minutes, Nov 18 19:00 | | | | | | | |
| Anthropic IPO priced, Nov 18 evening | | | | | | | |
| Anthropic debut, Nov 19 14:30 | | | | | | | |

## How to read it later

- The engine's `reports/events.md` gives BTC and coin reaction per event. This file adds our P&L reaction. Together they answer: does a hawkish or risk-off event hit a short book (fixed stops vs trailing) and should the strategies react, for example lock +1R before known events.
- The snapshot numbers come from the ledger Supabase project (wallet_snapshots, bot_events, closed_trades); the intel trades dataset is only a Nov 15 seed export until the read-only key is set (see `IMPLEMENTATION-STATUS.md`).
