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

Open `index.html` in a browser. For live Bybit data, serve it locally so the
fetch isn't blocked by `file://` CORS:

```bash
# VSCode: install the "Live Server" extension, right-click index.html → "Open with Live Server"
# or any static server:
npx serve                     # node
python3 -m http.server 8000   # python — then visit http://localhost:8000
```

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
- Loads months of history via **paginated** Bybit v5 kline requests — walks backward
  page by page and **deduplicates** the one-bar page overlap (no phantom price spike).
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

### Strategy Mode (automated backtesting)
Switch the **🎮 Game / ⚡ Strategy** tabs in the replay bar. Strategy Mode replaces the
manual LONG/SHORT/CLOSE buttons with a read-only status label and trades automatically
from a strategy file.

- Open the **Strategy** panel (top bar) to pick a strategy, edit its auto-generated
  parameters, and set global Position size / Commission / Slippage.
- **▶ Run Backtest** runs the strategy silently over *all* candles (<100ms) and shows
  full stats — Net P&L, win rate, profit factor, max drawdown, Sharpe, avg/largest
  win & loss, max consecutive W/L, total fees — plus **faded ▲/▼ markers** across the
  whole chart so you can scan every signal before choosing a replay start point.
- **👁 Watch Replay** (enabled after a backtest) plays the strategy forward: it warms
  up, fires trades automatically at each signal (same entry line / live P&L / toast /
  trade log as Game Mode), and respects any `stopLoss` / `takeProfit` the strategy
  returns. A collapsible **signal log** streams every decision; hovering a row
  highlights that candle. Hovering a marker shows a **why-it-fired** tooltip.
- A strategy error during replay **pauses** playback and shows an error banner naming
  the strategy and candle — no crash. Changing a parameter mid-replay re-runs the
  silent backtest, refreshes the markers, and resumes from the current candle.
- Ships with two examples: **EMA Crossover** and **RSI Reversal**.

#### Writing a strategy
Each strategy is a plain JS file exporting a single `Strategy` object. To add one:

1. Create `strategies/my-strategy.js` (copy `strategies/emacross-strategy.js` as a
   template). Register it at the end with
   `window.__STRATEGIES['my-id'] = Strategy;`.
2. Add a `<script src="strategies/my-strategy.js">` tag in `index.html`, **before**
   `js/strategy.js`.
3. Add one line to `strategies/registry.js`:
   `{ id: 'my-id', label: 'My Strategy' }`.

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
  // indicators: { ema(closes,p), sma(closes,p), rsi(closes,p), closes[], candles[] }
  // account:    { position:'long'|'short'|null, entryPrice, balance }
  // return:     'long' | 'short' | 'close' | null
  //         or: { signal, stopLoss, takeProfit }
  onCandle(candle, indicators, account) { /* … */ return null; },
};
```

The engine auto-reverses: returning `'long'` while a short is open closes the short
first. Set `this.reason = '…'` inside `onCandle` to populate the signal log + tooltip.

## Project structure

```
chart-replay/
├── index.html           entry point
├── css/styles.css       dark theme + widget/panel styles
├── strategies/
│   ├── registry.js          manual list of strategy files (add one line per strategy)
│   ├── emacross-strategy.js  built-in: fast/slow EMA crossover
│   └── rsi-strategy.js       built-in: RSI oversold/overbought reversal
└── js/
    ├── config.js        constants, theme tokens, candle styles, sim defaults
    ├── api.js           paginated Bybit fetch + dedup + offline fallback
    ├── indicators.js    SMA / EMA / RSI math + realistic intrabar path synthesis
    ├── chart.js         Lightweight Charts v5 wrapper (candles, volume, panes, markers, cursor)
    ├── indicators-ui.js IndicatorManager — registry, dropdown panel, interactive legend, badge
    ├── replay.js        replay engine (cut, play/pause/step, speed, both modes)
    ├── drawings.js      drawing overlay (trend / horizontal ray / rect, editable)
    ├── trade-sim.js     trading simulator (widget, positions, live P&L, fees/slippage, log, summary)
    ├── strategy.js      Strategy Mode — picker panel, silent backtest engine, replay execution
    └── app.js           wiring
```

## Defaults (out of the box)
- Theme: pure-black dark mode.
- Candles: monochrome (white/gray).
- Font: Inter.
- Starting balance: $10,000.
- History: 5000 candles (≈ 7 months on 1h).

## Notes & limits
- Realistic formation is **synthesized** from each candle's OHLC (Bybit kline gives one
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
- History size: `MAX_CANDLES` / `DEFAULTS.maxCandles`; per-request page size `PAGE_LIMIT`.
- Trading sim: `START_BALANCE`, `SIZE_PCTS`, `DEFAULT_SIZE_PCT`,
  `DEFAULT_COMMISSION_PCT`, `DEFAULT_SLIPPAGE_PCT` in `js/config.js`.
- More symbols / intervals: the `SYMBOLS` and `INTERVALS` arrays in `js/config.js`.
- Add indicators: extend the `REGISTRY` in `js/indicators-ui.js`.
- Add strategies: see **Writing a strategy** above (`strategies/` folder + registry).
