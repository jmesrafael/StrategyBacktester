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

Owner action on Nov 17 23:28 UTC (manual): BB-Core SOL short closed by hand on MEXC at 75.14 (entry 86.48), +$18.0163, +3.55R, booked as closed_trades id 24 (reason in the bot log: exchange_tp_or_manual). It was before its extended time exit (Nov 23) and its stop was untouched. Same day, 23:12 UTC: BB-Core ZEC short (entry 903.84) hit its stop at 971.13, -$6.14, -1.03R (closed by the MEXC trigger). Open after that: BB-Core 4 (ADA, NEAR, GALA, ARB), T-CORE 8, I-CORE 3. Anything after this point is no longer the pure system for SOL.

## Result log (fill in after each event; ask for "record the event")

For each event: BTC price at the event moment, 1 h / 24 h / 72 h later, the three wallets' unrealized and equity just before and 1 h / 24 h after, any trade that closed or stop that moved, and what the news actually said. Direction (bullish/bearish) goes into `owner-tags.csv` only once known.

| Event (UTC) | Actual result | BTC at / +1h / +24h / +72h | Live unrealized before | +1h | +24h | Trades closed or stops moved | Lesson |
|---|---|---|---|---|---|---|---|
| US retail sales, Nov 17 13:30 | Census figure NOT found by web search (only an NRF private estimate: 13th month of growth, slowing). Treat as unknown | 65,119 (13:00 close) / 64,981 (14:00) / ~63,300 low at 15:00 / 63,715 (16:00 close) | +68.4 at 13:xx | +70.8 at 14:xx | n/a | none | BTC barely moved at 13:30. The real dump came at 15:00-15:59 (-2.8% from 65,141 open to 63,301 low), 90 min later and not tied to the release; shorts jumped +70.8 to +102.5 in that hour. Do not credit it to retail sales. |
| Nvidia earnings, Nov 17 ~21:20 | Beat (press, unverified): revenue $115.8B vs ~$109B est, adj EPS $2.68 vs 2.47, Q4 guide ~$130B vs ~$125B (ex-China), gross margin guided down to 71-72%; stock +1% to +5% after hours (options priced 8%) | 63,974 at 21:00 open / 64,331 (+1h, 22:00 open) / 64,921 at 00:00 (+3h) / 64,768 at 01:00 (+4h) | +78.8 at 21:xx | 67.7 at 22:xx (+1h) | n/a | BB-Core ZEC short stopped at 971.13 (23:12, -6.14, -1.03R) and BB-Core SOL closed by hand at 75.14 (23:28, +18.02), both inside the +2-3h window | BTC +1.5% in 3h after the beat; open-short profit fell 85.9 (20h) to 78.8 to 67.7 to 46.7 at 23h (the 23h drop includes the two closed trades leaving the open book; equity 668.9 at 21h to 648.8 at 23h, net -20 after booking the +11.9 from those closes). Hurt the shorts, as expected for a risk-on beat. BTC then slid back to 62.2K within 24h so the squeeze faded. |
| FOMC minutes, Nov 18 19:00 | Hawkish (crypto-press summaries, unverified): most officials see more hikes needed; a couple floated more than 25 bp in Dec; Waller said 50 bp probably needed (or 25 bp with a January signal); Dec 25 bp priced about 96% | 63,143 / 62,725 / 63,161 at 00:00 UTC (+5h; +24h not yet); low 62,031 at 22:00 (-1.8%) | +71.1 (BB 12.0, I 14.9, T 44.1) at 18:55 | +76.5 at 19:55 | pending (+5h at 00:55: +68.8, equity 670.6 vs 673.3) | none; no stops moved, 15 shorts still open (BB 4, I 3, T 8) | Hawkish minutes gave only a small dip, shorts gained about +5 in the first hour, peak +85.7 at 22:55, then it all faded back. Event was priced in. |
| Anthropic IPO priced, Nov 18 evening | | | | | | | |
| Anthropic debut, Nov 19 14:30 | | | | | | | |

## How to read it later

- The engine's `reports/events.md` gives BTC and coin reaction per event. This file adds our P&L reaction. Together they answer: does a hawkish or risk-off event hit a short book (fixed stops vs trailing) and should the strategies react, for example lock +1R before known events.
- The snapshot numbers come from the ledger Supabase project (wallet_snapshots, bot_events, closed_trades); the intel trades dataset is only a Nov 15 seed export until the read-only key is set (see `IMPLEMENTATION-STATUS.md`).

## Upcoming watch list (added Nov 19, 2026; rows also in owner-tags.csv and ledger/lib/market-events.js, direction blank until known)

Baseline at Nov 19 01:20 UTC (BTC about 63.2K): live open profit +73.9 (BB-Core +13.1, I-Core +15.5, T-Core +45.3), equity 676.1, 15 shorts open (BB 4, I 3, T 8), free cash about 466. Tightest known stop: T-CORE GALA about 8.5% above price (stops from the Nov 17 file; may have trailed).

| When (UTC) | Event | What would hurt the shorts | Note |
|---|---|---|---|
| Thu Nov 19 13:30 | US jobless claims | Low claims (hot labor) = hike fears = usually bearish for BTC, good for shorts. A weak print eases hike fears = bounce risk | Weekly, small mover |
| Thu Nov 19 14:30 | Anthropic (ANT) Nasdaq debut | Rotation back into crypto after the IPO = squeeze risk. Cash-drain theory = bearish | IPO pricing time Nov 18 still not confirmed; the alert list in ledger/lib/event-alerts.js still has the wrong Nov 20 date |
| Fri Nov 20 15:00 | UMich sentiment (final Nov) | Soft inflation expectations = relief bounce | Watch expectations lines |
| Mon Nov 23 (hour unknown) | OKX x ICE 24/7 tokenized stocks | Unclear, mostly a headline | Unverified, same day BB-Core extended exits fall due (BB-Core still has ADA, NEAR, GALA, ARB open; exits Nov 23 00:00-20:00) |
| Wed Nov 25 13:30 | US PCE (Oct) + Q3 GDP 2nd estimate | Hot PCE = bigger Dec hike = bearish BTC | Date from a release calendar, confirm on BEA |
| Wed Dec 9 19:00 | FOMC decision | 25 bp hike priced about 91-96%; a 50 bp hike or hawkish tone is the surprise risk (Waller floated 50) | |
| Thu Dec 10 13:30 | US CPI (Nov) | Hot CPI was bearish last time (Nov 10) | |

How to record each one (no AI needed at runtime): right after the event note BTC at the event and +1h / +24h / +72h from the candle library (`node candles/update.js --no-1m`), the three wallets' unrealized and equity before and +1h / +24h from wallet_snapshots, any closed trade or stop, then fill the Result log row and set the direction in owner-tags.csv. Also note any manual owner action that day.
