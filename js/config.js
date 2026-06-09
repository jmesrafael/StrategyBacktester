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

  // Max history selector (top bar). Fetched via paginated kline requests.
  MAX_CANDLES: [500, 1000, 3000, 5000],
  PAGE_LIMIT: 1000,         // Bybit v5 per-request maximum

  // Replay timing
  // realistic mode: each candle is animated over FRAMES sub-steps
  FRAMES_PER_CANDLE: 26,
  REALISTIC_FRAME_MS: 38,   // base per-frame ms at 1x
  CANDLE_STEP_MS: 480,      // base per-candle ms at 1x in candle-by-candle mode
  MIN_FRAME_MS: 6,

  // ~5000 candles ≈ 7 months on 1h → guarantees the ≥6-month requirement.
  DEFAULTS: { symbol: 'ETHUSDT', interval: '60', maxCandles: 5000, candleStyle: 'mono' },

  // Replay trading simulator
  START_BALANCE: 10000,
  SIZE_PCTS: [10, 25, 50, 100],
  DEFAULT_SIZE_PCT: 25,
  DEFAULT_COMMISSION_PCT: 0.055,  // charged on entry AND exit, per side
  DEFAULT_SLIPPAGE_PCT: 0.010,    // worsens the fill price on entry and exit

  // sessionStorage keys (choices persist for the tab session)
  STORE: { candleStyle: 'cr.candleStyle', indicators: 'cr.indicators',
    bg: 'cr.bg', grid: 'cr.grid', gridColor: 'cr.gridColor' },

  // Theme (kept in sync with css/styles.css) — pure-black TradingView dark
  THEME: {
    bg: '#131722',
    grid: 'rgba(255,255,255,0.06)',
    text: '#ffffff',
    textDim: '#b2b5be',
    border: '#2a2e39',
    up: '#26a69a',
    down: '#ef5350',
    upWick: '#26a69a',
    downWick: '#ef5350',
    volUp: 'rgba(38,166,154,0.45)',
    volDown: 'rgba(239,83,80,0.45)',
    cursor: 'rgba(178,181,190,0.55)',
    formGlow: '#f0b90b',
    draw: '#2962ff',
    drawHandle: '#ffffff',
    drawSel: '#f0b90b',
  },

  // Candlestick color modes (applied live via series.applyOptions)
  CANDLE_STYLES: {
    classic: {
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    },
    mono: {
      // bullish = hollow white body, gray wick
      upColor: 'rgba(0,0,0,0)', borderUpColor: '#ffffff', wickUpColor: '#787b86',
      // bearish = solid gray body, gray wick
      downColor: '#787b86', borderDownColor: '#787b86', wickDownColor: '#787b86',
    },
  },

  // Default MA palette for preloaded / newly added moving averages
  MA_COLORS: ['#2962ff', '#ff6d00', '#ab47bc', '#26c6da', '#ffca28'],
};
