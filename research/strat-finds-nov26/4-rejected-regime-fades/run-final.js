const F = require('./final.js'), L = require('./lib.js');
const P = { trend: 1, day: 5, hour: 16, dir: 1, kStop: 2 };
F.report('IS-pick: Fri 16UTC long, close>SMA800, 2ATR stop, 24 bars', P, 24);
F.report('neighbour hour20 mb48', { ...P, hour: 20 }, 48);
console.log('\n-- controls (hour16 mb24 kStop2) --');
F.report('control: no trend filter', { ...P, trend: 0 }, 24);
for (const day of [1, 2, 3, 4, 6, 0]) { const r = F.run({ ...P, day }, 24); console.log('weekday', day, L.fmt(r)); }
F.report('control: short when below SMA800 (mirror)', { ...P, dir: -1 }, 24);
