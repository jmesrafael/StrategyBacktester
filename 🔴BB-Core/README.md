# BB Breakout — core algorithm (4h, 1:4)

The profitable version of the Bollinger-band strategy, pulled out of the app and the `research/bollinger/` experiments into one
self-contained folder. No browser, no npm packages — just Node 18+.

```
node backtest.js                      # every coin in data/ (NEAR, ADA, + whatever you fetched)
node backtest.js SOL,ZEC,BTC          # chosen coins + a combined portfolio line
node backtest.js SOL --trades         # print every trade
node backtest.js SOL --costs 3        # stress test: fees + slippage x3   (--costs 0 = frictionless)
node backtest.js SOL --risk 10 --target 3 --bars 48
node fetch-data.js SOL,ZEC,BTC        # download 4h candles + funding from Binance (public API, no key)
```

`data/` ships with NEAR and ADA (candles + funding). SOL / ZEC / BTC were fetched with `fetch-data.js` and are in `data/` as well.

## What's in here

| File | What it is |
|---|---|
| [bb-breakout.js](bb-breakout.js) | **The algorithm.** `backtest(candles, cfg, funding)` — the whole strategy + `stats()`. ~100 lines, no dependencies. |
| [backtest.js](backtest.js) | Command-line runner: loads `data/<COIN>.json`, prints trades, per-year profit, drawdown, portfolio. |
| [fetch-data.js](fetch-data.js) | Downloads Binance USDT-M 4h candles + real funding rates (`--mexc` for MEXC perpetuals). |
| [stress.js](stress.js) | SOL + ZEC under heavier fees / slippage, every year, Binance and MEXC → `docs/results-stress.md`. |
| [viewer.html](viewer.html) | Trigger checker screen: chart + independent audit of every trade. |
| [bbot.js](bbot.js) | Paper auto-trader for SOL + ZEC on MEXC candles. |
| `data/` | 4h candles `[time, o, h, l, c, v]` and `data/funding/` `[time, rate]`. |
| [TOP-COINS.md](TOP-COINS.md) | **Our best coins**, ranked, with the ones to avoid. |
| [docs/REPORT-bb-deep.md](docs/REPORT-bb-deep.md) | The full 6-year analysis (which years/regimes work, drawdown risk, ideas tested and rejected). |
| [docs/COIN-REGISTRY-bb-breakout.md](docs/COIN-REGISTRY-bb-breakout.md) | Every coin already screened — which ones work, which are too illiquid. |
| [docs/results-rr4-allyears.md](docs/results-rr4-allyears.md) | Year-by-year and month-by-month P&L per coin at 1:3 / 1:4 / 1:5. |
| `app-reference/` | The same rules as they live in the browser app (`bb-breakout-strategy.js` = backtest strategy, `bbx.js` = chart indicator with setup alerts). Note the app files default to a 3R target; this folder uses the final 4R. |

## How it works

It is a **momentum breakout that only trades with the long-term trend**. When price closes outside the Bollinger Band, the move is
statistically stretched — the research found that *continuing* in that direction (not fading it) is where the edge is, as long as
the 200-SMA agrees with the direction. Mean-reversion (fading band closes) was tested and lost on almost every setting.

Everything is decided on a **closed** 4h candle and filled at the **next candle's open**, so nothing uses future data.

### Entry
| | Long | Short |
|---|---|---|
| Trigger | candle **closes above** the upper Bollinger band (20 periods, 2σ) | candle **closes below** the lower band |
| Trend filter | close is **above** the 200-SMA | close is **below** the 200-SMA |
| Skip if | stop distance < 0.3 × ATR(14) (stop would just be noise) | same |

One position at a time per coin. Warm-up: 202 candles before the first signal.

### Exit (whichever comes first)
- **Stop loss** — the Bollinger **middle band** (the 20-SMA) at the signal close. Risk per trade = distance from entry to that line.
- **Target** — `entry ± 4 × (signal close − middle band)`, i.e. **1:4 risk/reward**.
- **Time exit** — if neither is hit after **48 candles (8 days)**, close at the next open.
- If one candle touches both stop and target the engine assumes the **stop** hit first (pessimistic). Gaps fill at the open.

### Sizing
Fixed risk per trade (the tests use **$5** on a notional $1,000 account per coin, no compounding). Position size = `risk ÷ stop distance`.
Results are also stated in **R** (1R = the amount risked), so they scale to any account size.

### Why the numbers look the way they do
- **Win rate is low (~38%)** but wins are big: 14–17% of trades hit the 4R target (+3.9R each), stops lose about −1R, and the 48-candle
  time exits are positive on average (+0.9R). The whole edge is a few large winners paying for lots of small losses.
- It **profits in big clean moves in either direction** (the 200-SMA flips it short in bear markets — 2022 was mostly short profit) and
  **bleeds slowly in sideways chop**. It does not detect regimes; losses in chop are just small and capped.
- Uncorrelated coins smooth it out: one coin's bad year is usually another's good one, which is why you run several coins.

## Results (this folder's engine, Binance data to 21 Oct 2026, $5 risk/trade)

Realistic costs: taker fees 0.05% on entry/stop/time exit, maker 0.02% on target (price must trade 0.05% *through* it), 0.02% slippage,
plus **real Binance funding** on every 8h event a trade was open.

| Coin | Trades | Net | Avg | Win | Max DD | Profitable years |
|---|---|---|---|---|---|---|
| SOL | 309 | **+$527** | +0.34R | 39% | −$64 | 7 / 7 |
| ZEC | 332 | **+$592** | +0.36R | 39% | −$78 | 7 / 7 |
| ADA | 327 | **+$533** | +0.33R | 38% | −$63 | 7 / 7 |
| NEAR | 297 | **+$390** | +0.26R | 38% | −$55 | 7 / 7 |
| BTC | 369 | +$306 | +0.17R | 34% | −$85 | 5 / 8 (lost 2021, 2025) |
| **All 5** | 1,634 | **+$2,348** | +0.29R | | −$119 | every year 2020–2026 positive |

Portfolio by year: 2020 +$329 · 2021 +$525 · 2022 +$278 · 2023 +$367 · 2024 +$359 · 2025 +$229 · 2026 (to Oct) +$261.

**Cost stress (5 coins):** frictionless +$2,635 → real +$2,348 → fees×2 +$2,089 → fees×3 +$1,834. Still positive every year at ×3.
(BTC is the most cost-sensitive: its stops are about half as wide, so fees are a bigger share of each trade.)

### SOL + ZEC at 0.08% fees + slippage, every year — [docs/results-stress.md](docs/results-stress.md) (`node stress.js`)

0.08% fee on **every** fill (entry and exit, no maker discount on targets) + 0.05% slippage on every fill, real funding, $5 risk:

| Candles | 2020* | 2021 | 2022 | 2023 | 2024 | 2025 | 2026* | Total | Max DD |
|---|---|---|---|---|---|---|---|---|---|
| Binance SOL+ZEC | +$103 | +$314 | +$70 | +$151 | +$157 | +$155 | +$83 | **+$1,032** | −$80 |
| MEXC SOL+ZEC | +$6 | +$300 | +$69 | +$128 | +$152 | +$132 | +$89 | **+$877** | −$81 |
| MEXC SOL alone | $0 | +$134 | +$73 | +$157 | +$37 | +$34 | +$47 | +$482 | −$56 |
| MEXC ZEC alone | +$6 | +$165 | −$4 | **−$29** | +$116 | +$99 | +$42 | +$395 | −$89 |

\*2020 partial, 2026 to 21 Oct. The pair is positive **every year** in every scenario, up to 0.10% fees + 0.15% slippage (+$726 on MEXC).
ZEC alone has losing years on MEXC (2022, 2023), and ZEC on MEXC is weaker than on Binance (+$395 vs +$547). Run the two coins together.

## Trigger checker screen — [viewer.html](viewer.html)

```
npm run serve        (from the repo root)   →   http://localhost:8137/🔴BB-Core/viewer.html
```

- Chart with the Bollinger bands, SMA200 and every trade (arrows = entries, circles = exits with R). Pick SOL/ZEC on Binance, MEXC files,
  or **MEXC LIVE** (latest closed candles through the server's MEXC proxy). Switch the cost model (default: 0.08% fee + 0.05% slip).
- The trades come from the same `bb-breakout.js` the bot runs. The page then **re-derives every trade with separate code** (its own
  Bollinger/SMA/ATR and its own exit walk), and scans every flat candle for a signal the engine might have missed. The audit box shows ✓/✗.
- Click a trade → it lists each rule for that signal candle with the numbers (close vs band, vs SMA200, stop ≥ 0.3 ATR, stop = middle band,
  target = 4×, fill = next open + slippage, exit reason). Click any candle → what the rules say about it. ←/→ step through trades.
- Checked: SOL, ZEC, MEXC SOL, MEXC ZEC, BTC — all trades ✓, 0 missed signals. Planting a bug in the engine (band 1.9σ, or a 47-candle
  exit) makes the audit fail (44 / 97 trades ✗), so the check is real.

## Read this before trusting it

- **Settings were picked on 2019–2022 BTC/ETH/SOL.** ZEC, NEAR and ADA were never used for tuning, which is the cleanest evidence. But the
  **4R target was chosen after seeing all years**, and *choosing these 5 coins* is in-sample too — the registry lists many coins that lose
  (LTC, BCH, ETC, ATOM, XMR...) and several that faded after 2023 (ETH, XRP, DOGE).
- **Year-by-year the edge is real but uneven**: ZEC made only +$4 in 2023, ADA +$9 in 2026, BTC lost two years. A bad year on one coin is normal.
- **Plan for drawdown ≈ 32R across 3 coins (95th percentile)** — $160 at $5 risk — and a losing streak of 8–10 trades per coin.
  Suggested stop-and-review triggers (from the report): drawdown > 39R, rolling 50-trade result < −14R, target-hit rate < ~10% over 60+ trades.
- **Liquidity**: only coins with real volume (> ~$30M/day) are trustworthy; illiquid coins with great backtests are in the registry marked ⚠.
- It was checked for look-ahead (truncation test: 103,000 orders, 0 mismatches) and the live-bot loop matched the app trade-for-trade.
  Paper-trade before real money.

## BBOT — the auto-trader (SOL + ZEC) — [bbot.js](bbot.js)

**Status: PAPER trading only.** It reads real MEXC 4h candles and trades a simulated account; it never sends an order.

```
start-bbot.cmd                 # double-click: runs forever, wakes 30s after every 4h close (00,04,08,12,16,20 UTC)
node bbot.js once              # one check now (use this from Windows Task Scheduler instead of loop if you prefer)
node bbot.js status            # balance, next trade's risk, open positions + realized R so far
node bbot.js replay SOL,ZEC    # self-test: whole history through the bot == backtest, trade for trade
```

- Sizing: `riskPct` (set to 0.05) = risk 5% of the **account balance** on every trade, recalculated after every closed trade (compounding).
  SOL and ZEC share one balance, which starts at `startBalance` ($100). Set `riskPct` to 0 to go back to a fixed `riskUsd` per trade.
  At 5% the backtest's typical worst drop is about −66% (random-order test, 3,000 runs); expect a −50% drawdown at some point.
- Settings in [bot-config.json](bot-config.json): coins, `riskPct` / `startBalance` / `riskUsd`, `haltAtR` (stop opening trades after −39R,
  the report's 99th-percentile drawdown), `maxEntryDelaySec` (skip a signal if the bot wakes more than 15 min after the candle closed —
  it would no longer get the "next open" price the backtest assumed).
- **Kill switch:** create an empty file named `STOP` in this folder → no new entries (open trades still managed).
- State, trade history and a log are written to `state/` (`state.json`, `bot.log`). It survives restarts: on start it re-reads state and
  processes every candle it missed, in order.
- The entry rule is the same `signalFrom()` the backtest uses, and `replay` checks the full loop: SOL, ZEC, BTC, NEAR, ADA all
  **identical trade-for-trade** with `backtest()`.
- Paper results exclude funding (small: ~4% of profit historically).

### Path to real money
1. **Paper for 4–8 weeks** (≈ 15–30 trades on SOL+ZEC). Compare each trade with what the chart/backtest says for the same candles.
2. Create a MEXC **futures API key** — trade permission only, **no withdrawal**, IP-restricted.
3. Add a live executor (same 3 methods as the paper one: `enter`, `checkExit`, `timeExit`): market entry, stop + take-profit placed on the
   exchange as trigger orders right after the fill, reconcile against MEXC's real positions on every run, unique client order IDs.
4. Start at **$1 risk**. Note MEXC's contract steps (SOL 0.1, ZEC 0.01 coins ≈ $11–13 a step), so at $1 risk the real risk per trade
   swings between ~$0.50 and $1.70 — see `PDF/BB Breakout - Risks and How We Prevent Them - Live Bot on MEXC.pdf`.

## Using the core in your own code

`backtest()` is also the live loop. Fetch recent **closed** candles, call it, and look at the result:
- `res.setup` is non-null → the last closed candle fired a signal: enter at the next open, `stop = res.setup.stop`, `tp = res.setup.tp`.
- `res.open` is non-null → a position from the signal is open; `bars` counts candles in the trade (exit at the next open after 48).

```js
const { backtest } = require('./bb-breakout');
const res = backtest(closedCandles /* [{time,open,high,low,close}, ...] */, { targetR: 4 });
if (res.setup) console.log(res.setup.dir === 1 ? 'LONG' : 'SHORT', 'stop', res.setup.stop, 'tp', res.setup.tp);
```

Make sure the last candle you pass is **closed** (drop the forming one) — `fetch-data.js` already does this.
