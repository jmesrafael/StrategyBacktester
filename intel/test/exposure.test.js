'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const X = require('../engines/exposure');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('exports', () => { for (const k of ['effectiveBets', 'analyse', 'stress', 'positionsAt', 'build', 'run']) assert.equal(typeof X[k], 'function', k); });

test('effectiveBets: two equal same-direction positions with correlation 1 is 1 bet', () => {
  near(X.effectiveBets([100, 100], [[1, 1], [1, 1]]), 1);
});
test('effectiveBets: two equal opposite positions with correlation 1 nets to zero risk => null', () => {
  assert.equal(X.effectiveBets([100, -100], [[1, 1], [1, 1]]), null);
});
test('effectiveBets: two equal same-direction positions with correlation 0 is 2 bets', () => {
  near(X.effectiveBets([100, 100], [[1, 0], [0, 1]]), 2);
});
test('effectiveBets: no risk => null; single position => 1', () => {
  assert.equal(X.effectiveBets([], []), null);
  assert.equal(X.effectiveBets([0, 0], [[1, 0], [0, 1]]), null);
  near(X.effectiveBets([50], [[1]]), 1);
});

const M2 = { coins: ['BTC', 'ETH'], corr: [[1, 0.5], [0.5, 1]], cov: [[0.04, 0.03], [0.03, 0.04]] };
test('analyse: hand-made list: gross 170, net 90, long share 0.765, top coin BTC, effective bets 3.18', () => {
  const pos = [{ coin: 'BTC', dir: 1, risk_usd: 100 }, { coin: 'ETH', dir: -1, risk_usd: 40 }, { coin: 'ETH', dir: 1, risk_usd: 30 }];
  // s = [100,-40,30]; C = [[1,.5,.5],[.5,1,1],[.5,1,1]]; s'Cs = 9100; gross^2 = 28900
  const a = X.analyse(pos, M2);
  assert.deepEqual(a, { n: 3, gross_risk_usd: 170, net_risk_usd: 90, long_share: 0.765, effective_bets: 3.18, top_coin: 'BTC', top_coin_share: 0.588 });
});
test('analyse: empty list and a coin missing from the matrix (correlation 0)', () => {
  assert.deepEqual(X.analyse([], M2), { n: 0, gross_risk_usd: 0, net_risk_usd: 0, long_share: null, effective_bets: null, top_coin: null, top_coin_share: null });
  const a = X.analyse([{ coin: 'BTC', dir: 1, risk_usd: 10 }, { coin: 'XYZ', dir: 1, risk_usd: 10 }], M2);
  assert.equal(a.effective_bets, 2);
});

test('stress: short with beta 1.5, BTC -10%: move -15%, R = 0.15 / (one_r / entry) = +3', () => {
  const m = { coins: ['BTC', 'SOL'], cov: [[0.04, 0.06], [0.06, 0.09]], corr: [[1, 1], [1, 1]] };
  const p = { coin: 'SOL', dir: -1, risk_usd: 10, entry: 100, one_r: 5 };
  const [s] = X.stress([p], m, -10);
  near(s.beta, 1.5); near(s.move_pct, -15, 1e-9); near(s.r, 0.15 / (5 / 100), 1e-9); assert.ok(s.r > 0); near(s.usd, 30, 1e-8);
  const [l] = X.stress([{ ...p, dir: 1 }], m, -10);
  near(l.r, -3, 1e-9);
});
test('stress: a coin that is not in the matrix is skipped', () => {
  assert.deepEqual(X.stress([{ coin: 'XYZ', dir: 1, risk_usd: 1, entry: 1, one_r: 1 }], M2, -10), []);
});

test('positionsAt: only live trades open at T with entry-time equity from the last wallet snapshot at or before the entry', () => {
  const tr = (key, o) => ({ trade_key: key, mode: 'live', bot: 'x', coin: 'SOL', dir: 1, entry_s: 100, exit_s: null, risk_pct: 0.01, entry_price: 50, one_r: 2, ...o });
  const trades = [tr('open'), tr('closed_before', { exit_s: 150 }), tr('closes_after', { exit_s: 250 }), tr('paper', { mode: 'paper' }),
    tr('future', { entry_s: 250 }), tr('no_wallet', { bot: 'nobody' }), tr('no_risk', { risk_pct: 0 }), tr('exact', { entry_s: 90 })];
  const wallets = [{ wallet: 'x', t: 80, equity_usdt: 900 }, { wallet: 'x', t: 90, equity_usdt: 1000 }, { wallet: 'x', t: 100, equity_usdt: 1100 },
    { wallet: 'x', t: 120, equity_usdt: 1200, suspect: true }, { wallet: 'x', t: 105, equity_usdt: 1300, suspect: true }, { wallet: 'x', t: 200, equity_usdt: 2000 }, { wallet: 'y', t: 50, equity_usdt: 500 }];
  const p = X.positionsAt(trades, wallets, 200, 300);
  assert.deepEqual(p.map((x) => x.key).sort(), ['closes_after', 'exact', 'open']);
  const by = Object.fromEntries(p.map((x) => [x.key, x]));
  near(by.open.risk_usd, 11); near(by.exact.risk_usd, 10); near(by.closes_after.risk_usd, 11);   // 1100 (suspect and later rows ignored), 1000
  assert.equal(by.open.entry, 50); assert.equal(by.open.one_r, 2);
});
test('positionsAt: a replay (asOf before the exit) treats a later exit as still open', () => {
  const trades = [{ trade_key: 'a', mode: 'live', bot: 'x', coin: 'SOL', dir: 1, entry_s: 100, exit_s: 150, risk_pct: 0.01, entry_price: 50, one_r: 2 }];
  const w = [{ wallet: 'x', t: 90, equity_usdt: 1000 }];
  assert.equal(X.positionsAt(trades, w, 120, 120).length, 1);
  assert.equal(X.positionsAt(trades, w, 200, 300).length, 0);
});
