// registry.js — manual list of available strategy files.
//
// The browser cannot scan folders, so adding a new strategy is a 3-step process:
//   1. Create strategies/my-strategy.js (export a Strategy object, register it on
//      window.__STRATEGIES['my-id'] — see emacross-strategy.js for the template).
//   2. Add a <script src="strategies/my-strategy.js"> tag in index.html
//      (before js/strategy.js).
//   3. Add one { id, label } line to STRATEGY_REGISTRY below
//      (add `special: true` to show it in green as a research-backed strategy).
//
// Each strategy file registers its Strategy object here:
window.__STRATEGIES = window.__STRATEGIES || {};

window.STRATEGY_REGISTRY = [
  { id: 'nysmcv7', label: '★ NY SMC v7 · CHoCH → FVG', special: true },
  { id: 'bbbreakout', label: '★ BB Breakout · 4h trend', special: true },
  { id: 'emarsidiv', label: 'EMA + RSI Divergence' },
  { id: 'htftrend', label: 'HTF Trend + ATR Risk' },
  { id: 'emacross', label: 'EMA Crossover' },
  { id: 'rsi', label: 'RSI Reversal' },
];
