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
