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
  { id: 'htftrend', label: 'HTF Trend + ATR Risk' },
  { id: 'pivotcross', label: 'Pivot Cross V1 — Improved' },
  { id: 'pivotcrossimproved', label: 'Pivot Cross — Improved (TV-style)' },
  { id: 'pivotcrossv2', label: 'Pivot Cross V2 — Break & Trail' },
  { id: 'pivotreject', label: 'Pivot Cross V3 — Rejection' },
  { id: 'pivotcrossv4', label: 'Pivot Cross V4 — CPR Regime + Level Targets' },
  { id: 'orb4h', label: '4H Opening Range Breakout-Reversal' },
  { id: 'emarsidiv', label: 'EMA + RSI Divergence' },
  { id: 'macdmoneymap', label: 'MACD Money Map — Trend System' },
  { id: 'dematematrend', label: 'DEMA/TEMA Trend Cross' },
  { id: 'fixedmtfgc', label: 'Fixed-MTF Golden Cross + MACD + Pivots (SMC)' },
];
