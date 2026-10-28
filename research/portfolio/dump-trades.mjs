// dump-trades.mjs — writes every backtest trade of both live bots to research/portfolio/trades/ (bb_<COIN>.txt, ic_<COIN>.txt),
// using each bot's OWN backtest (the code that trades live): ../../../🔴BB-Core/backtest.js and ../../../🔴I-Core/backtest.js.
//   node research/portfolio/dump-trades.mjs [bbCoreDir] [iCoreDir]
// The other scripts here read those files: stats.mjs, split.cjs, month.mjs, novdec.mjs (see README.md).
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..', '..');
const bb = process.argv[2] || join(root, '🔴BB-Core'), ic = process.argv[3] || join(root, '🔴I-Core'), out = join(here, 'trades');
mkdirSync(out, { recursive: true });
for (const c of ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA']) {
  writeFileSync(join(out, `bb_${c}.txt`), execFileSync(process.execPath, ['backtest.js', c, '--trades'], { cwd: bb, maxBuffer: 1 << 26 }));
  writeFileSync(join(out, `ic_${c}.txt`), execFileSync(process.execPath, ['backtest.js', c, '--trades'], { cwd: ic, maxBuffer: 1 << 26 }));
  console.log('dumped', c);
}
