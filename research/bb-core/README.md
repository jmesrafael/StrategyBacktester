# research/bb-core

Everything that used to sit in `🔴BB-Core/` but is **not needed to run the bot**. The bot itself (code, deploy scripts, tests, SOL and ZEC data) now lives in its own repo: `jmesrafael/bb-core`, the folder `🔴BB-Core/` next to this one.

| Here | What it is |
|---|---|
| `audit/` | The strategy audit: `AUDIT-REPORT.md`, the scripts behind it (robustness, Monte Carlo risk, venue parity, no-lookahead test, shadow recorder, ...) and their saved outputs in `audit/out/`. |
| `docs/` | The long-form reports: deep analysis, coin registry, year-by-year P&L, the fee/slippage stress results. |
| `TOP-COINS.md`, `BACKTEST_DATA.html/.pdf` | The ranked coin list and the backtest data summary. |
| `stress.js` | Re-runs the fee/slippage stress test and rewrites `docs/results-stress.md`. |
| `viewer.html` | The trigger-checker chart page. Serve this repo's root with `npm run serve`, then open `http://localhost:8137/research/bb-core/viewer.html`. |
| `app-reference/` | The same rules as they live in the browser app. |
| `data-other-coins/` | 4h candles and funding for BTC, NEAR and ADA (the bot's `data/` only keeps SOL and ZEC). `viewer.html` falls back to this folder. |
| `old-tools/` | `bbot-ui.js` and `mexc-live.js`: older scripts nothing uses any more. |

**How it connects:** these scripts load the bot's algorithm and data from `../../🔴BB-Core/` (`lucidio-core.js`, `data/`). The bot never loads anything from here. That was checked by running all of the bot's tests, a full-history replay and the bundle build from a clean copy of the bb-core repo.

**Local-only:** `audit/cache-1m/` (149 MB of 1-minute candles used by `fetch-1m.js` and `replay-1m.js`) is ignored by git.

Moved on Oct 24, 2026. The offline scripts were all re-run from this location and work. Not re-run: `fetch-1m.js` and `shadow-recorder.js` (need the network), `replay-1m.js` (needs the 1-minute cache), and `recon.py` (Python is not installed on this PC).
