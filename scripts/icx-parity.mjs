// icx-parity.mjs — proves the 🧭 I-Core setups indicator (js/icx.js) draws exactly the I-Core bot's trades.
//   node scripts/icx-parity.mjs [path/to/🔴I-Core]
// 1. js/icore-core.js must be the bot's icore-core.js unchanged (sync-icore-core.mjs --check).
// 2. For every coin in the bot's data/: the indicator's scan() (run in a browser-like sandbox, with the app's copy of the engine) must
//    return the same trades as the bot's engine loaded straight from the bot repo — entry, exit, stop, R, reason — and the same open
//    position and setup. Prints the totals so they can be compared with the bot README (760 trades, +658R, costs included).
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url)), app = join(here, '..');
const bot = process.argv[2] || join(app, '..', '🔴I-Core');
execFileSync(process.execPath, [join(here, 'sync-icore-core.mjs'), '--check', join(bot, 'icore-core.js')], { stdio: 'inherit' });

const Bot = createRequire(import.meta.url)(join(bot, 'icore-core.js'));
const box = { console }; box.globalThis = box; vm.createContext(box);
vm.runInContext(readFileSync(join(app, 'js', 'icore-core.js'), 'utf8'), box);
vm.runInContext(readFileSync(join(app, 'js', 'icx.js'), 'utf8') + '\nglobalThis.ICXIndicator = ICXIndicator;', box);
const ICX = box.ICXIndicator, P = ICX.getDefaults();

let all = 0, sumR = 0, bad = 0;
const same = (a, b) => Math.abs(a - b) < 1e-9;
for (const f of readdirSync(join(bot, 'data')).filter((x) => /^[A-Z]+\.json$/.test(x)).sort()) {
  const B = JSON.parse(readFileSync(join(bot, 'data', f), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const want = Bot.backtest(B), got = ICX.scan(B, P, 14400);
  let diff = want.trades.length !== got.trades.length ? `count ${got.trades.length} vs ${want.trades.length}` : '';
  for (let k = 0; !diff && k < want.trades.length; k++) {
    const a = want.trades[k], b = got.trades[k];
    for (const key of ['dir', 'i0', 'i1', 'entry', 'exit', 'stop0', 'stop', 'R', 'why']) if (!(typeof a[key] === 'number' ? same(a[key], b[key]) : a[key] === b[key])) { diff = `trade ${k} ${key}: ${b[key]} vs ${a[key]}`; break; }
    if (!diff && !same(b.stops[b.stops.length - 1], a.stop)) diff = `trade ${k}: drawn trail ends at ${b.stops[b.stops.length - 1]}, engine stop ${a.stop}`;
  }
  if (!diff && !!want.open !== !!got.open) diff = 'open position differs';
  if (!diff && want.open && !(same(want.open.entry, got.open.entry) && same(want.open.stop, got.open.next))) diff = 'open position levels differ';
  if (!diff && !!want.setup !== !!got.setup) diff = 'setup differs';
  const R = want.trades.reduce((a, t) => a + t.R, 0);
  all += want.trades.length; sumR += R;
  console.log(`${f.replace('.json', '').padEnd(5)} ${String(want.trades.length).padStart(4)} trades  ${(R >= 0 ? '+' : '') + R.toFixed(1)}R  ${diff ? 'MISMATCH ' + diff : 'IDENTICAL'}`);
  if (diff) bad++;
}
console.log(`all   ${all} trades  +${sumR.toFixed(1)}R  ${bad ? bad + ' coin(s) differ' : 'every coin identical to the bot'}`);
process.exit(bad ? 1 : 0);
