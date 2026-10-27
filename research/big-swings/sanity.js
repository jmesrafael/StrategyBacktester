const E = require('./engine.js');
for (const c of ['SOL', 'BTC']) {
  const B = E.load(c), X = E.base(B);
  console.log(c, B.length, new Date(B[B.length - 1].time * 1000).toISOString());
  for (const [f, p] of [['donchian', { n: 55 }], ['ichimoku', {}], ['darvas', {}], ['vortex', {}], ['supertrend', {}], ['keltner', {}], ['adx', {}]]) {
    const T = E.run(B, X, f, p, { coin: c });
    const R = T.reduce((a, t) => a + t.R, 0);
    console.log(' ', f.padEnd(11), 'trades', T.length, 'R', R.toFixed(1), 'win%', (100 * T.filter((t) => t.R > 0).length / T.length).toFixed(0), 'avgbars', (T.reduce((a, t) => a + t.bars, 0) / T.length).toFixed(0));
  }
}
