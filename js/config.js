// config.js — shared constants and theme tokens
window.CFG = {
  // Bybit symbols / intervals
  SYMBOLS: ['ETHUSDT', 'BTCUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'APEUSDT'],
  INTERVALS: [
    ['1', '1m'], ['3', '3m'], ['5', '5m'], ['15', '15m'], ['30', '30m'],
    ['60', '1h'], ['120', '2h'], ['240', '4h'], ['360', '6h'], ['720', '12h'],
    ['D', '1D'], ['W', '1W'],
  ],
  SPEEDS: [1, 2, 3, 5, 10, 25, 50],

  // Master timeframe list — the Timeframes setting picks any subset of these.
  ALL_INTERVALS: [
    ['1', '1m'], ['3', '3m'], ['5', '5m'], ['15', '15m'], ['30', '30m'],
    ['60', '1h'], ['120', '2h'], ['240', '4h'], ['360', '6h'], ['720', '12h'],
    ['D', '1D'], ['W', '1W'],
  ],

  // Max history selector (top bar). Fetched via paginated kline requests.
  // Default to the largest so the chart shows as much history as possible.
  MAX_CANDLES: [1000, 3000, 5000, 10000, 20000],
  PAGE_LIMIT: 1000,         // Bybit v5 per-request maximum

  // Replay timing
  // realistic mode: each candle is animated over FRAMES sub-steps
  FRAMES_PER_CANDLE: 26,
  REALISTIC_FRAME_MS: 38,   // base per-frame ms at 1x
  CANDLE_STEP_MS: 480,      // base per-candle ms at 1x in candle-by-candle mode
  MIN_FRAME_MS: 6,

  // ~10000 candles ≈ 14 months on 1h → always shows deep history by default.
  DEFAULTS: { symbol: 'ETHUSDT', interval: '60', maxCandles: 10000, candleStyle: 'mono' },

  // Replay trading simulator
  START_BALANCE: 10000,
  SIZE_PCTS: [10, 25, 50, 100],
  DEFAULT_SIZE_PCT: 25,
  DEFAULT_COMMISSION_PCT: 0.055,  // charged on entry AND exit, per side
  DEFAULT_SLIPPAGE_PCT: 0.010,    // worsens the fill price on entry and exit

  // localStorage keys (choices persist across reloads and future sessions)
  STORE: { candleStyle: 'cr.candleStyle', indicators: 'cr.indicators',
    bg: 'cr.bg', grid: 'cr.grid', gridColor: 'cr.gridColor',
    candleUp: 'cr.candleUp', candleDown: 'cr.candleDown',
    timeframes: 'cr.timeframes', maxCandles: 'cr.maxCandles',
    defaults: 'cr.defaults', version: 'cr.schema',
    drawLabels: 'cr.drawLabels', drawings: 'cr.drawings',
    stratInputs: 'cr.stratInputs', lastStrategy: 'cr.lastStrategy',
    chartType: 'cr.chartType' },

  // Bump when default settings change so persisted prefs are migrated once.
  SCHEMA_VERSION: 2,

  // Theme (kept in sync with css/styles.css) — monochrome gray / black / white
  THEME: {
    bg: '#0b0b0d',
    grid: 'rgba(255,255,255,0.05)',
    text: '#ffffff',
    textDim: '#8a8d93',
    border: '#2a2d35',
    up: '#d1d4dc',
    down: '#5d6069',
    upWick: '#d1d4dc',
    downWick: '#5d6069',
    volUp: 'rgba(209,212,220,0.32)',
    volDown: 'rgba(120,123,134,0.32)',
    cursor: 'rgba(178,181,190,0.45)',
    formGlow: '#d1d4dc',
    draw: '#787b86',
    drawHandle: '#b0b3bc',
    drawSel: '#d1d4dc',
  },

  // Candlestick color modes (applied live via series.applyOptions)
  CANDLE_STYLES: {
    classic: {
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    },
    mono: {
      // bullish = solid near-white body + wick
      upColor: '#d1d4dc', borderUpColor: '#d1d4dc', wickUpColor: '#d1d4dc',
      // bearish = solid mid-gray body + wick
      downColor: '#5d6069', borderDownColor: '#5d6069', wickDownColor: '#5d6069',
    },
  },

  // Default MA palette for newly added moving averages (neutral grays first)
  MA_COLORS: ['#d1d4dc', '#8a8d93', '#b0b3b8', '#6a6d75', '#e0e0e0'],

  // Drawing tools — line-thickness presets (right-click editor) + default width
  DRAW_WIDTHS: [1, 2, 3, 4],
  DRAW_DEFAULT_WIDTH: 1,
};
