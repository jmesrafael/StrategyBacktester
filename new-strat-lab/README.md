# New strategy lab: BB-1H-WIDE and ICHI-X4, PAPER ONLY (Nov 26, 2026)

Why: `research/four-bot-nov26/`. Adding either one as a 4th live bot at 25% each was not clearly better than today's 50/25/25,
so both are watched on paper first. **Nothing here is live, and nothing here changes a live bot.**

| bot | strategy | built from | candles | coins | paper money | service |
|---|---|---|---|---|---|---|
| lab-wide | BB-1H-WIDE: bands 80 / **2.6 sigma**, SMA 800, middle-band stop, out after 192 candles | `bb-core-1h` | 1h | SOL ZEC NEAR ADA GALA ARB | US$200 | `labwide` |
| lab-ichi | ICHI-X4: 9/26/52 cross with the close outside the cloud, 2 ATR stop, out after 12 candles | `bb-trail` machinery + `ichi/icore-core.js` | 4h | same | US$200 | `labichi` |

US$200 is about a quarter of the pool, what a 4th bot would get. Risk steps as live (2.5% / 2% from $500 / 1.5% from $1,000), **no US$ cap
on the risk per trade** (owner, Nov 27), realistic paper costs (MEXC fees, order book, funding). No keys, no Telegram, no ledger money sync.

**Dashboard (Nov 27):** BB-1H-WIDE reports as `bbw`, ICHI-X4 as `ichix`, and both show under Research Lab beside the BB-1h lab (`bb1h`, the
same 1h rules with normal 2.0 sigma bands). The tag is written into the built code, and neither bot ever polls the dashboard for requests.

## The test (rules frozen Nov 26, 2026)
- **Review at the end of February 2027**, together with the BB-CORE v4 review.
- A strategy **fails** if its result since Nov 26 is below the bad (1 in 20) line of past stretches of the same length (`node forward.js`),
  or if its paper bot does not match its backtest (`status.sh compare`).
- **Passing is not enough to go live.** Three months is about 50 trades each: too few to prove an edge. It only removes broken ones.
- Do not tune the rules during the test. A changed rule starts a new test.

## Commands
```
node test.js              build both + check: same entries as the research, bot loop = strategy file, safety locks
node forward.js           results on new candles (run node ../candles/update.js first); needs no server
bash make-deploy.sh       test, then dist/stratlab.tar.gz for the VPS
```
Edit `patches.js` and `ichi/`, never `out/` (generated). Install on the VPS: `VPS-INSTALL.md`.

## Checks (Nov 26, 2026, `node test.js`)
- Same entries as the research engine on all 6 coins from 2020, both strategies (0 differences).
- The bot's own loop equals its strategy file, trade for trade, all 12 coin runs.
- ICHI-X4 differs from the research only in the time exit price (close of the 12th candle instead of the next open, about the same moment): under 1R per coin over 6 years.
- Both pre-flights and one paper cycle ran against public MEXC data on the PC with 0 errors.

## Not done
- Not installed on the VPS.
- The dashboard change is built and tested in the ledger repo (branch `paper-labs-wide-ichi`), **not committed or deployed**. No database change is needed.
