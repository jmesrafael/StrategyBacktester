# Chart Replay — TradingView-style + Trading Simulator

A standalone candlestick chart replay tool that mimics TradingView's **Bar Replay**:
choose a start point, then watch history play back candle by candle — including
**realistic candle formation** (the candle opens, ticks up and down, develops its
high/low, then closes) before the next one begins. While replay runs you can draw,
trade a **mock account with live P&L**, and add indicators — all live.

Built with vanilla JS + [Lightweight Charts](https://www.tradingview.com/lightweight-charts/)
**v5** (TradingView's open-source library — v5 is required for the native sub-pane
support used by RSI). No build step, no backend.

## Run it

Live data comes from **MEXC USDT perpetuals** (SOL, BTC, ETH, XRP, DOGE, ZEC `.P`).
MEXC's API sends no CORS header, so the browser can't call it directly — run the
bundled dev server, which also proxies `/mexc/…` market-data requests:

```bash
npm run serve                 # → http://localhost:8137
```

A plain static server (Live Server, `npx serve`, …) can't reach MEXC unless the
optional edge function is deployed: `supabase functions deploy mexc-proxy --no-verify-jwt`
(see `supabase/functions/mexc-proxy`).

If the live fetch is blocked, the app automatically falls back to a built-in
**offline sample dataset** so every feature still works fully.

## Features

### Layout & theme
- Edge-to-edge TradingView-style layout: thin top bar (symbol, timeframe buttons,
  candle-style picker, Indicators, Replay), left drawing-tool sidebar, right price
  axis, bottom OHLCV bar.
- Pure-black theme by default (`--bg: #000000`, `--chart-bg: #131722`), white text,
  Inter typography throughout.
- **Bottom bar** shows O/H/L/C/Volume for the candle under the cursor.

### Data
- Loads history via **paginated** MEXC perpetual kline requests (2000 bars per page),
  walking backward from the latest (still-forming) candle. 3m / 2h / 6h / 12h, which
  MEXC doesn't offer, are built from 1m / 1h / 1h / 4h candles.
- History depth is MEXC's: 1m ≈ last 30 days, 5m / 15m ≈ months, 1h and up = years.
- **Only the timeframes enabled in the TF toggle are downloaded** — in the background,
  so switching between them is instant — and kept on-device (IndexedDB). A reload opens
  from that copy and fetches just the newest bars; disabling a TF deletes its data.
- **Max candles** selector: 500 / 1000 / 3000 / 5000 (default 5000 ≈ 7 months on 1h).
  A loading indicator shows `Loading… page 2 / 5` while paginating.

### Candle styles
- **Monochrome** (default): bullish = hollow white body, gray wick; bearish = solid
  gray body, gray wick.
- **Classic**: solid green up / red down.
- Switch live from the top-bar picker; the choice recolors all candles instantly
  (including a forming replay candle) and persists for the session.

### Indicators
- **Indicators menu** (top bar) with a searchable, registry-based list — add/remove
  **Moving Averages** (SMA/EMA, configurable period / type / color / line width) and
  toggle **Volume**. Defaults: MA 10, MA 50, Volume on.
- Changes apply live without re-fetching data. The button shows a count badge,
  e.g. `Indicators (3)`.
- **RSI** (Relative Strength Index) renders in its own **stacked sub-pane** below the
  main chart (own right price axis, draggable resize, crosshair synced across panes —
  all native to Lightweight Charts v5). Configurable period, color, and overbought /
  oversold levels (dashed reference lines). Legend shows `RSI 14 · 58.4`.
- **Interactive on-chart legend** (top-left, TradingView-style): each indicator shows
  its name + live value with an **eye** (show/hide on the chart) and a **gear**
  (open a settings popup for period / type / color / width). Hidden indicators stay
  listed, dimmed, so you can switch them back on.
- Indicator set + params persist for the session.

### Canvas settings (top-bar gear)
- Toggle the **grid** on/off, pick the **background color**, and pick the **grid color**.
- Applied live and persisted for the session.

### Drawing tools (left sidebar)
- Cursor (select / move / edit), **Trend line**, **Horizontal line** (a ray that starts
  at the clicked point and extends right), **Rectangle**.
- **Clear all** / **Delete selected** (or the **Del** key).
- Drawings are anchored to price/time, so they stay put when you pan, zoom, or replay.
- In cursor mode, click a drawing to select it (yellow), drag its endpoints or body to
  move it.

### Replay
- Enter **Replay**, then set the start point: click any bar, drag the ✂ cut handle, or
  drag the Start slider.
- Speeds: 1x, 2x, 3x, 5x, 10x, 25x, 50x (changeable mid-replay, takes effect immediately).
- Two formation modes:
  - **Realistic** — each candle animates: opens, price moves, high/low develop, then closes.
  - **Candle** — completed candles appear one at a time.
- Play / Pause (Space), Step forward one candle (→ or the step button), Rewind to start.
- A dashed vertical cursor marks the latest revealed bar; future candles are not drawn.
- Changing the interval mid-session keeps your start point at the same real moment.

### Replay trading simulator
A draggable trading widget appears on the chart when you enter Replay
(inspired by Investagrams TradingGrounds).

- **Widget** (drag by the header anywhere on screen): editable **Balance** (default
  $10,000, locks once your first trade opens), live **Price**, position size buttons
  (10 / 25 / 50 / 100 %), and **LONG ▲ / SHORT ▼ / CLOSE ■** controls.
- **Open** a position at the current revealed candle's close. The size % of balance sets
  the position notional. A dashed **entry line** is drawn on the chart (green = long,
  red = short) with a `LONG @ 3412.50` axis label.
- **Live P&L** updates every tick/frame in the widget and as a floating label by the
  entry line — green when in profit, red when in loss. Long profits when price rises;
  short profits when price falls (mirrors real leveraged P&L).
- **Close** settles at the current price: removes the line/label, shows a result toast
  (`CLOSED LONG · +$58.50 (+2.34%)`), updates the balance, and adds a row to the
  scrollable **trade log**.
- **Fees + slippage** (⚙ Sim Settings row in the widget, applies to **both** Game and
  Strategy mode): **Commission %** (charged on entry and exit) and **Slippage %**
  (worsens the fill — pay up on long entries, sell lower on short entries, and the
  reverse on exit). Settings lock once the first trade opens and unlock on reset. The
  session summary adds a **Total fees paid** line.
- **End of session** (replay reaches the last bar, Exit Replay, or Esc): the widget and
  trade lines vanish, the chart returns to full history, and a **session summary** card
  shows starting/final balance, total return, trade count, win rate, best/worst trade,
  and total fees — with **Play Again** / **Exit**.

### Mobile & installable app
On phones (or any viewport ≤ 820px wide) the same replay game switches to a compact,
Trading Grounds-style layout. The mechanics are identical to desktop; only the layout changes.

- **Top bar**: symbol, a swipeable timeframe strip, a **Replay** button, and a **⋮** menu
  holding chart type, Indicators, Strategy, Data, Max candles, drawing tools and settings.
- **Start a game**: tap **Replay**, then **tap a candle** to start there, or tap
  **🎲 Random** for a random point in history.
- **Trade dock** (under the chart in portrait, beside it in landscape): balance, price,
  session P&L, open-position P&L, size chips, big **LONG / SHORT / CLOSE** buttons,
  ⚙ sim settings and a collapsible trade log. The dock keeps a fixed height, so the chart
  never jumps when a trade opens or closes.
- **Transport bar**: exit, Game/Strategy, rewind / play / step, speed, formation.
- Indicator, strategy and settings panels open as bottom sheets.

**Install it as an app (PWA).** `manifest.webmanifest` + `sw.js` make the site installable:
Chrome/Edge/Android show **Install app** (also in the ⋮ menu); on iOS Safari use
**Share → Add to Home Screen**. It launches full-screen with its own icon. App files
are served network-first (edits show up on the next launch; the cached copy is only used
offline), and CDN libraries are cached. Market data is never cached by the service worker.

> Installing requires **HTTPS** (or `localhost`). To try it on a phone, deploy the folder
> to any static host (Vercel, Netlify, GitHub Pages). Opening `http://<your-pc-ip>:8137`
> over Wi-Fi runs the mobile layout but won't offer install.

### Strategy Mode (automated backtesting)
Switch the **🎮 Game / ⚡ Strategy** tabs in the replay bar. Strategy Mode replaces the
manual LONG/SHORT/CLOSE buttons with a read-only status label and trades automatically
from a strategy file.

- Open the **Strategy** panel (top bar) to pick a strategy, edit its auto-generated
  parameters, and set global Position size / Commission / Slippage.
- **Sizing**: *Fixed % of balance* (every trade uses Position size %), or *Risk % per
  trade*: each trade is sized so that hitting its stop-loss loses exactly that % of the
  balance (size = balance × risk% ÷ stop distance%), capped by **Max size %** (100 = no
  leverage). Trades without a stop fall back to Position size %.
- **Session filter**: only open new trades when the signal candle closes inside the
  chosen hours and weekdays, in a chosen UTC offset (hours may wrap past midnight, e.g.
  22:00–02:00). Exits are always allowed; **Close outside session** also flattens any
  open position when a candle closes outside it. Blocked entries are counted in the
  results. Saved per strategy with **Save inputs**, like the other globals.
- **▶ Run Backtest** runs the strategy silently over *all* candles (<100ms) and shows
  full stats — Net P&L, win rate, profit factor, max drawdown, Sharpe, avg/largest
  win & loss, max consecutive W/L, total fees — plus **faded ▲/▼ markers** across the
  whole chart so you can scan every signal before choosing a replay start point.
- **Fill at** (Strategy panel): **Next bar open** (default) fills a signal decided on a
  candle's close at the *next* candle's open, the earliest price you could really get.
  **Signal bar close** fills at the signal candle's own close (optimistic). Watch Replay
  uses the same rule. Stop-loss / take-profit exits fill at the level, or at the open
  if the candle gapped past it.
- The results also show **Buy & hold** (first open → last close at the same position
  size, fees and slippage) and **Strategy vs B&H**, plus **Same-bar SL + TP**: candles
  that touched both levels. OHLC can't tell which came first, so the stop is assumed;
  when any exist, **Net if target first** shows the best case.
- An **equity curve** (balance marked to market every candle) with the **drawdown**
  from its running peak underneath. Max drawdown is measured on this curve, so it
  includes losses while a trade is still open.
- **👁 Watch Replay** (enabled after a backtest) plays the strategy forward: it warms
  up, fires trades automatically at each signal (same entry line / live P&L / toast /
  trade log as Game Mode), and respects any `stopLoss` / `takeProfit` the strategy
  returns. A collapsible **signal log** streams every decision; hovering a row
  highlights that candle. Hovering a marker shows a **why-it-fired** tooltip.
- A strategy error during replay **pauses** playback and shows an error banner naming
  the strategy and candle — no crash. Changing a parameter mid-replay re-runs the
  silent backtest, refreshes the markers, and resumes from the current candle.
- Ships with examples: **EMA Crossover**, **RSI Reversal**, **EMA + RSI Divergence**
  (with optional ATR stop / target / trail inputs) and **HTF Trend + ATR Risk**, which
  uses every building block below: 4h trend while trading a lower timeframe, ADX filter,
  MACD trigger, ATR stop, R-multiple target, trailing stop and break-even.

#### Writing a strategy
Each strategy is a plain JS file exporting a single `Strategy` object. To add one:

1. Create `strategies/my-strategy.js` (copy `strategies/emacross-strategy.js` as a
   template). Register it at the end with
   `window.__STRATEGIES['my-id'] = Strategy;`.
2. Add a `<script src="strategies/my-strategy.js">` tag in `index.html`, **before**
   `js/strategy.js`.
3. Add one line to `strategies/registry.js`:
   `{ id: 'my-id', label: 'My Strategy' }`. Add `special: true` to show it in green in the
   picker (used for research-backed strategies, e.g. ★ NY SMC v7).

The `Strategy` contract:

```js
const Strategy = {
  name: 'My Strategy',
  description: '…',
  warmUpBars: 50,                 // candles skipped before signals are evaluated
  params: {                       // auto-rendered as panel inputs
    fastPeriod: { label:'Fast EMA', type:'number', default:9, min:2, max:200 },
    direction:  { label:'Direction', type:'select',
                  options:['Long only','Short only','Both'], default:'Long only' },
  },
  init(params) { /* called once per run; stash params + reset state on `this` */ },

  // candle:     { time, open, high, low, close, volume }
  // indicators: see "Indicators passed to onCandle" below
  // account:    { position:'long'|'short'|null, entryPrice, balance,
  //               size, stopLoss, takeProfit, barsInTrade,
  //               limitOrder: { side, price } | null }   (resting limit order)
  // return:     'long' | 'short' | 'close' | 'cancel' | null
  //         or: { signal, stopLoss, takeProfit, trailingStop, trailingStopPct,
  //               breakEvenAt, sizePct, riskPct, limitPrice }   (see "Order object" below)
  onCandle(candle, indicators, account) { /* … */ return null; },
};
```

The engine auto-reverses: returning `'long'` while a short is open closes the short
first. Set `this.reason = '…'` inside `onCandle` to populate the signal log + tooltip.

`closes` and `candles` end at the current candle (no future data), and `indicators.index`
is the current candle's index. `ema/sma/rsi(indicators.closes, p)` are computed once
over the whole series and cached, so a backtest is O(n) rather than recomputing every
bar. Read the latest value with `arr[arr.length - 1]` as before. Passing any other
array computes it directly.

##### Indicators passed to onCandle
All are cached the same way when called on `indicators.closes` / `indicators.candles`,
and all are causal (bar *i* only uses bars 0..*i*). Arrays have leading `null`s until
the indicator has enough data.

| Call | Returns |
|---|---|
| `ema / sma / rsi(closes, p)` | array |
| `highest / lowest(closes, p)` | array: rolling max / min |
| `atr(candles, p = 14)` | array: Wilder ATR (same seeding as TradingView `ta.atr`) |
| `macd(closes, fast = 12, slow = 26, signal = 9)` | `{ macd, signal, hist }` |
| `bollinger(closes, p = 20, mult = 2)` | `{ middle, upper, lower, width }` |
| `vwap(candles, anchor = 'D')` | array: resets each UTC day (`'W'` = week from Monday, `'none'` = never) |
| `stochastic(candles, k = 14, smooth = 3, d = 3)` | `{ k, d }`, 0–100 (`smooth = 1` = fast stochastic) |
| `adx(candles, p = 14)` | `{ adx, plusDI, minusDI }` |
| `htf('240')` | higher-timeframe view (below) |
| `time` | `{ open, close, hour, minute, dow }`: bar open in the session filter's time zone (`dow` 0 = Sunday) |
| `inSession` | `true` if this candle's close is inside the session filter (always `true` when it's off) |

**Higher timeframe**: `const h = indicators.htf('240')` returns the same kind of object
(`h.closes`, `h.candles`, `h.ema(h.closes, 50)`, `h.atr(h.candles, 14)`, …) holding only
the HTF candles that have **closed** by the current candle's close, so there is no
lookahead and no repainting. Intervals use the timeframe codes: `'60'`, `'240'`, `'D'`,
`'W'`, and so on. It uses the real series the app has already downloaded for that
timeframe when it covers the backtest, otherwise it builds the HTF candles from the
current ones (so early bars have less HTF history). `h.source` says which was used.

##### Order object
Return an object instead of a string to manage the trade:

| Field | Meaning |
|---|---|
| `signal` | `'long'`, `'short'`, `'close'` or omitted (just update the open position's levels) |
| `stopLoss` / `takeProfit` | absolute price levels |
| `trailingStop` | trail distance in **price** (e.g. `2 * atr`). The stop follows the best price since entry and never loosens; without a `stopLoss` it starts at entry − distance |
| `trailingStopPct` | trail distance in % of price, instead of `trailingStop` |
| `breakEvenAt` | once price touches this level, the stop moves to the entry price (if that's tighter) |
| `sizePct` | this trade's size as % of balance (overrides the panel) |
| `riskPct` | size this trade to risk this % of balance at its stop (overrides the panel) |
| `limitPrice` | with `signal: 'long'`/`'short'` while flat: place a resting **limit order** instead of a market entry. It fills on a later candle that trades through the price, at the limit (or the open if the candle gapped past it), with no slippage. Its stop / target / break-even attach on the fill. It rests until filled, replaced by another limit order, or cancelled by returning `'cancel'`. On the fill candle only the stop is checked (worst case), unless it filled at the open. `account.limitOrder` shows the resting order |

Trailing and break-even updates use each finished candle's high/low and apply from the
next candle, so a candle never stops itself out on its own range. Exits are labelled
in the log and tooltip as *Stop loss*, *Trailing stop*, *Break-even stop*, *Take profit*
or *Outside session*. Watch Replay draws the live SL (`TRAIL` / `BE` once moved), TP and
break-even trigger lines.

## Project structure

```
chart-replay/
├── index.html           entry point
├── css/styles.css       dark theme + widget/panel styles
├── strategies/
│   ├── registry.js          manual list of strategy files (add one line per strategy)
│   ├── emacross-strategy.js  built-in: fast/slow EMA crossover
│   ├── rsi-strategy.js       built-in: RSI oversold/overbought reversal
│   ├── ema-rsi-divergence-strategy.js  built-in: RSI divergence + EMA cross (optional ATR exits)
│   ├── htf-trend-atr-strategy.js       built-in: HTF trend + ADX + MACD, ATR stop/trail/break-even
│   └── ny-smc-v7-strategy.js           ★ research-backed: NY-morning CHoCH → FVG limit entry (see research/ny-smc-iterations)
└── js/
    ├── config.js        constants, theme tokens, candle styles, sim defaults
    ├── mexc.js          MEXC perpetual kline fetch (via proxy) + built TFs
    ├── candle-store.js  on-device (IndexedDB) copy of enabled TFs
    ├── api.js           candle cache, refresh, prefetch + offline fallback
    ├── indicators.js    SMA/EMA/RSI, ATR, MACD, Bollinger, VWAP, Stochastic, ADX + intrabar path synthesis
    ├── chart.js         Lightweight Charts v5 wrapper (candles, volume, panes, markers, cursor)
    ├── indicators-ui.js IndicatorManager — registry, dropdown panel, interactive legend, badge
    ├── replay.js        replay engine (cut, play/pause/step, speed, both modes)
    ├── drawings.js      drawing overlay (trend / horizontal ray / rect, editable)
    ├── trade-sim.js     trading simulator (widget, positions, live P&L, fees/slippage, log, summary)
    ├── strategy.js      Strategy Mode — picker panel, silent backtest engine, replay execution
    ├── app.js           wiring
    └── mobile.js        phone layout (overflow sheet, docked trade HUD, tap/random start) + PWA install
manifest.webmanifest     installable-app manifest
sw.js                    service worker (offline app shell)
icons/                   app icons (SVG source + generated PNGs)
```

## Defaults (out of the box)
- Theme: pure-black dark mode.
- Candles: monochrome (white/gray).
- Font: Inter.
- Starting balance: $10,000.
- History: 5000 candles (≈ 7 months on 1h).

## Notes & limits
- Realistic formation is **synthesized** from each candle's OHLC (the exchange kline gives one
  OHLC per bar, not raw ticks). The path is seeded by candle time, so a given candle
  animates identically every replay, always touches its true high and low, and lands
  exactly on its real close.
- Drawings and trades live in memory only; the UI choices (candle style, indicators,
  canvas settings) persist per browser-tab **session** via `sessionStorage` and reset
  when the tab closes.
- Single chart, single timeframe at a time.

## Tweaking
- Animation feel: `FRAMES_PER_CANDLE`, `REALISTIC_FRAME_MS`, `CANDLE_STEP_MS` in `js/config.js`.
- Theme & candle styles: `THEME` and `CANDLE_STYLES` in `js/config.js` (and the matching CSS vars in `css/styles.css`).
- History size: `MAX_CANDLES` / `DEFAULTS.maxCandles`; page size `MEXC.PAGE` (js/mexc.js).
- Trading sim: `START_BALANCE`, `SIZE_PCTS`, `DEFAULT_SIZE_PCT`,
  `DEFAULT_COMMISSION_PCT`, `DEFAULT_SLIPPAGE_PCT` in `js/config.js`.
- More symbols / intervals: the `SYMBOLS` and `INTERVALS` arrays in `js/config.js`.
- Add indicators: extend the `REGISTRY` in `js/indicators-ui.js`.
- Add strategies: see **Writing a strategy** above (`strategies/` folder + registry).
