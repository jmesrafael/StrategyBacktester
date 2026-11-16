'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { detectShocks, withEpisodes, schedType } = require('../engines/events');
const H = 3600;
const T0 = 1700000000 - (1700000000 % H);

// n bars of +-0.1% log returns alternating, constant volume 100. extra = { index: { ret (log), vol } } overrides.
function mkSeries(n, extra = {}) {
  const rows = []; let p = 100;
  for (let i = 0; i < n; i++) {
    const e = extra[i], ret = e ? e.ret : (i % 2 === 0 ? 0.001 : -0.001), c = p * Math.exp(ret);
    rows.push([T0 + i * H, p, Math.max(p, c), Math.min(p, c), c, e && e.vol != null ? e.vol : 100]);
    p = c;
  }
  return rows;
}
const DOWN = Math.log(0.98);

test('detectShocks golden: one -2% bar on 5x volume after 800 quiet bars => exactly one down shock at the bar close', () => {
  const rows = mkSeries(801, { 800: { ret: DOWN, vol: 500 } });
  const s = detectShocks(rows, { lookbackBars: 720 });
  assert.equal(s.length, 1);
  assert.equal(s[0].t, T0 + 800 * H + H);
  assert.equal(s[0].dir, 'down');
  assert.equal(s[0].vol_ratio, 5);
  assert.equal(s[0].pct, -2);
  // z = ln(0.98) / rms, rms of +-0.001 returns = 0.001 -> -20.203
  assert.ok(Math.abs(s[0].z - (DOWN / 0.001)) < 0.01, 'z ' + s[0].z);
});
test('detectShocks: an up shock is labelled up', () => {
  const s = detectShocks(mkSeries(801, { 800: { ret: Math.log(1.03), vol: 600 } }), { lookbackBars: 720 });
  assert.equal(s.length, 1); assert.equal(s[0].dir, 'up'); assert.equal(s[0].pct, 3); assert.equal(s[0].vol_ratio, 6);
});
test('detectShocks: the same move on normal volume is not a shock; volume alone is not a shock', () => {
  assert.deepEqual(detectShocks(mkSeries(801, { 800: { ret: DOWN, vol: 100 } }), { lookbackBars: 720 }), []);
  assert.deepEqual(detectShocks(mkSeries(801, { 800: { ret: DOWN, vol: 190 } }), { lookbackBars: 720 }), []);   // 1.9x < 2x
  assert.equal(detectShocks(mkSeries(801, { 800: { ret: DOWN, vol: 200 } }), { lookbackBars: 720 }).length, 1);   // exactly 2x counts
  assert.deepEqual(detectShocks(mkSeries(801, { 800: { ret: 0.002, vol: 900 } }), { lookbackBars: 720 }), []);     // 2x normal size < 3x
});
test('detectShocks: no shock before the lookback window is full; a flat history yields nothing', () => {
  const rows = mkSeries(300, { 200: { ret: DOWN, vol: 500 } });
  assert.deepEqual(detectShocks(rows, { lookbackBars: 720 }), []);
  assert.equal(detectShocks(rows, { lookbackBars: 100 }).length, 1);
  assert.deepEqual(detectShocks([], {}), []);
  const flat = Array.from({ length: 30 }, (_, i) => [T0 + i * H, 100, 100, 100, 100, 10]);
  flat.push([T0 + 30 * H, 100, 100, 90, 90, 100]);
  assert.deepEqual(detectShocks(flat, { lookbackBars: 20 }), []);   // rms 0 -> z 0, no divide by zero shock
});
test('detectShocks: minZ and minVolRatio options', () => {
  const rows = mkSeries(801, { 800: { ret: DOWN, vol: 500 } });
  assert.equal(detectShocks(rows, { lookbackBars: 720, minZ: 25 }).length, 0);
  assert.equal(detectShocks(rows, { lookbackBars: 720, minVolRatio: 6 }).length, 0);
});
test('detectShocks: no lookahead - shocks on a prefix equal the full-series shocks known by then', () => {
  const rows = mkSeries(1000, { 800: { ret: DOWN, vol: 500 }, 900: { ret: Math.log(1.03), vol: 600 } });
  const full = detectShocks(rows, { lookbackBars: 720 });
  assert.equal(full.length, 2);
  assert.deepEqual(full.map((s) => s.dir), ['down', 'up']);
  for (let k = 760; k <= 1000; k += 7) {
    const pre = detectShocks(rows.slice(0, k), { lookbackBars: 720 }), known = rows[k - 1][0] + H;
    assert.deepEqual(pre, full.filter((s) => s.t <= known), 'prefix length ' + k);
  }
  // changing the future never changes the past
  const alt = mkSeries(1000, { 800: { ret: DOWN, vol: 500 } });
  assert.deepEqual(detectShocks(alt, { lookbackBars: 720 })[0], full[0]);
});
test('withEpisodes: shocks within 24h share an episode, only the first is episode_first; a later shock starts a new one', () => {
  const t = 1700000000, s = [{ t, z: -4 }, { t: t + 3 * H, z: -3 }, { t: t + 33 * H, z: -5 }];
  const r = withEpisodes(s, 'BTC');
  assert.deepEqual(r.map((x) => x.episode_first), [true, false, true]);
  assert.equal(r[0].episode_id, `BTC-${t}`); assert.equal(r[1].episode_id, `BTC-${t}`); assert.equal(r[2].episode_id, `BTC-${t + 33 * H}`);
  assert.ok(r.every((x) => x.asset === 'BTC'));
  assert.equal(r[0].z, -4);
});
test('withEpisodes: the gap is measured to the previous shock (chains extend an episode); exactly 24h is the same episode', () => {
  const t = 1700000000;
  const chain = withEpisodes([{ t }, { t: t + 20 * H }, { t: t + 40 * H }, { t: t + 64 * H }], 'X');
  assert.deepEqual(chain.map((x) => x.episode_first), [true, false, false, false]);
  assert.deepEqual(withEpisodes([{ t }, { t: t + 24 * H }], 'X').map((x) => x.episode_first), [true, false]);
  assert.deepEqual(withEpisodes([{ t }, { t: t + 24 * H + 1 }], 'X').map((x) => x.episode_first), [true, true]);
  assert.deepEqual(withEpisodes([], 'X'), []);
});
test('schedType mapping', () => {
  const cases = { 'CPI m/m': 'CPI', 'Core CPI m/m': 'CPI', 'CPI y/y': 'CPI', 'Non-Farm Employment Change': 'NFP', 'FOMC Statement': 'FOMC', 'Federal Funds Rate': 'FOMC',
    'Core PCE Price Index m/m': 'PCE', 'PPI m/m': 'PPI', 'Prelim GDP q/q': 'GDP', 'Retail Sales m/m': 'other', 'Unemployment Claims': 'other', '': 'other' };
  for (const [name, want] of Object.entries(cases)) assert.equal(schedType(name), want, name);
});
