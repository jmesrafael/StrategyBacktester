// indicators.js — MA math + realistic intrabar path synthesis

function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += values[j];
      prev = s / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

// Build MA line data {time, value} for Lightweight Charts from candle slice
function maLineData(candles, period, type) {
  const closes = candles.map((c) => c.close);
  const arr = type === 'EMA' ? ema(closes, period) : sma(closes, period);
  const out = [];
  for (let i = 0; i < candles.length; i++) {
    if (arr[i] != null) out.push({ time: candles[i].time, value: arr[i] });
  }
  return out;
}

// Relative Strength Index — Wilder's smoothing. Returns an array aligned to
// `values` with leading nulls until the first computable bar (index `period`).
function rsi(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gain += ch; else loss -= ch;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

// Build RSI line data {time, value} from a candle slice (mirrors maLineData)
function rsiLineData(candles, period) {
  const closes = candles.map((c) => c.close);
  const arr = rsi(closes, period);
  const out = [];
  for (let i = 0; i < candles.length; i++) {
    if (arr[i] != null) out.push({ time: candles[i].time, value: arr[i] });
  }
  return out;
}

// ---- Strategy building blocks ----------------------------------------------
// All return arrays aligned to the input (leading nulls until computable) and are
// causal: the value at bar i only uses bars 0..i, so they are safe to precompute
// once over a full series and read bar by bar (the strategy engine does this).

// SMA / EMA over a series that may contain leading nulls (e.g. MACD line).
function _smaSkipNull(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0, n = 0;
  const win = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    win.push(v); sum += v; n++;
    if (win.length > period) sum -= win.shift();
    if (win.length === period) out[i] = sum / period;
  }
  return out;
}
function _emaSkipNull(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null, seed = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev === null) {
      seed.push(v);
      if (seed.length === period) prev = seed.reduce((a, b) => a + b, 0) / period;
      else continue;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

function highest(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let m = -Infinity;
    for (let j = i - period + 1; j <= i; j++) if (values[j] > m) m = values[j];
    out[i] = m;
  }
  return out;
}
function lowest(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let m = Infinity;
    for (let j = i - period + 1; j <= i; j++) if (values[j] < m) m = values[j];
    out[i] = m;
  }
  return out;
}

function _trueRange(candles) {
  return candles.map((c, i) => i === 0 ? c.high - c.low
    : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)));
}

// Average True Range — Wilder's smoothing. Use for volatility-based stops,
// e.g. stopLoss = close - 2 * atr.
function atr(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  if (candles.length < period) return out;
  const tr = _trueRange(candles);
  let a = 0;
  for (let i = 0; i < period; i++) a += tr[i];
  a /= period; out[period - 1] = a;
  for (let i = period; i < candles.length; i++) { a = (a * (period - 1) + tr[i]) / period; out[i] = a; }
  return out;
}

// MACD → { macd, signal, hist } (each aligned to closes)
function macd(closes, fast = 12, slow = 26, signal = 9) {
  const ef = ema(closes, fast), es = ema(closes, slow);
  const line = closes.map((_, i) => (ef[i] != null && es[i] != null) ? ef[i] - es[i] : null);
  const sig = _emaSkipNull(line, signal);
  const hist = line.map((v, i) => (v != null && sig[i] != null) ? v - sig[i] : null);
  return { macd: line, signal: sig, hist };
}

// Bollinger Bands → { middle, upper, lower, width } (width = (upper-lower)/middle)
function bollinger(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  const width = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) v += (closes[j] - mid[i]) ** 2;
    const sd = Math.sqrt(v / period);
    upper[i] = mid[i] + mult * sd; lower[i] = mid[i] - mult * sd;
    width[i] = mid[i] ? (upper[i] - lower[i]) / mid[i] : null;
  }
  return { middle: mid, upper, lower, width };
}

// VWAP of typical price, reset every `anchor` period:
// 'D' = UTC day (default), 'W' = week (Mon 00:00 UTC), 'none' = never reset.
function vwap(candles, anchor = 'D') {
  const out = new Array(candles.length).fill(null);
  const bucket = (t) => anchor === 'W' ? Math.floor((t - 345600) / 604800)
    : anchor === 'none' ? 0 : Math.floor(t / 86400);
  let pv = 0, vol = 0, cur = null;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i], b = bucket(c.time);
    if (b !== cur) { cur = b; pv = 0; vol = 0; }
    const v = c.volume || 0;
    pv += ((c.high + c.low + c.close) / 3) * v; vol += v;
    out[i] = vol ? pv / vol : (c.high + c.low + c.close) / 3;
  }
  return out;
}

// Stochastic oscillator → { k, d } (0..100). kSmooth=1 gives the "fast" stochastic.
function stochastic(candles, kPeriod = 14, kSmooth = 3, dPeriod = 3) {
  const hh = highest(candles.map((c) => c.high), kPeriod);
  const ll = lowest(candles.map((c) => c.low), kPeriod);
  const raw = candles.map((c, i) => hh[i] == null ? null
    : (hh[i] === ll[i] ? 50 : (100 * (c.close - ll[i])) / (hh[i] - ll[i])));
  const k = kSmooth > 1 ? _smaSkipNull(raw, kSmooth) : raw;
  return { k, d: _smaSkipNull(k, dPeriod) };
}

// Average Directional Index (Wilder) → { adx, plusDI, minusDI }.
// adx > ~20-25 = trending market; plusDI > minusDI = up-trend.
function adx(candles, period = 14) {
  const n = candles.length;
  const out = { adx: new Array(n).fill(null), plusDI: new Array(n).fill(null), minusDI: new Array(n).fill(null) };
  if (n <= period * 2) return out;
  const tr = _trueRange(candles);
  let sTR = 0, sP = 0, sM = 0;
  const dx = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const dn = candles[i - 1].low - candles[i].low;
    const pDM = up > dn && up > 0 ? up : 0;
    const mDM = dn > up && dn > 0 ? dn : 0;
    if (i <= period) {
      sTR += tr[i]; sP += pDM; sM += mDM;
      if (i < period) continue;
    } else {
      sTR = sTR - sTR / period + tr[i];
      sP = sP - sP / period + pDM;
      sM = sM - sM / period + mDM;
    }
    const pDI = sTR ? (100 * sP) / sTR : 0, mDI = sTR ? (100 * sM) / sTR : 0;
    out.plusDI[i] = pDI; out.minusDI[i] = mDI;
    dx[i] = (pDI + mDI) ? (100 * Math.abs(pDI - mDI)) / (pDI + mDI) : 0;
  }
  // ADX = Wilder average of DX, seeded with the mean of the first `period` DX values
  let seed = 0, cnt = 0, a = null;
  for (let i = period; i < n; i++) {
    if (a === null) {
      seed += dx[i]; cnt++;
      if (cnt === period) { a = seed / period; out.adx[i] = a; }
    } else {
      a = (a * (period - 1) + dx[i]) / period; out.adx[i] = a;
    }
  }
  return out;
}

// ---- Realistic candle formation -------------------------------------------
// Given a completed candle, produce an array of `frames` synthetic close
// prices that start at open, pass through both extremes, and end at close,
// with a little organic noise so it reads like live ticks. Seeded by time so
// each candle animates identically every replay.
function intrabarPath(candle, frames) {
  const { open, high, low, close, time } = candle;
  const rng = mulberry32((time || 1) >>> 0);

  // Bullish candles tend to dip then rally; bearish the reverse. Occasional flip.
  const bullish = close >= open;
  let order = bullish ? [low, high] : [high, low];
  if (rng() < 0.18) order = [order[1], order[0]];

  const anchors = [open, order[0], order[1], close];

  // distribute frames across the 3 legs proportional to price distance
  const legDist = [
    Math.abs(anchors[1] - anchors[0]),
    Math.abs(anchors[2] - anchors[1]),
    Math.abs(anchors[3] - anchors[2]),
  ];
  const total = legDist[0] + legDist[1] + legDist[2] || 1;
  const legFrames = legDist.map((d) => Math.max(1, Math.round((d / total) * (frames - 1))));

  const path = [open];
  for (let leg = 0; leg < 3; leg++) {
    const a = anchors[leg];
    const b = anchors[leg + 1];
    const n = legFrames[leg];
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      const noise = (rng() - 0.5) * Math.abs(b - a) * 0.18 * (1 - t);
      let p = a + (b - a) * t + noise;
      p = Math.min(high, Math.max(low, p)); // never exceed the real extremes
      path.push(p);
    }
  }
  path[path.length - 1] = close; // land exactly on close
  return path;
}
