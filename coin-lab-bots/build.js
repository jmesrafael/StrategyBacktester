// build.js — makes the two COIN LAB paper bots from FRESH copies of the originals (the originals are only read, never written).
//   node coin-lab-bots/build.js          both  ->  coin-lab-bots/out/coin-bb (BB-CORE on ARB, tag cbb), out/coin-tc (T-CORE on SUI + ARB, tag ctc)
//   node coin-lab-bots/build.js bb|tc    one of them
// Why: SUI and ARB study (research/coin-walkforward/SUI-ARB.md): BB-CORE + ARB and T-CORE + SUI + ARB, I-CORE unchanged. Paper first.
// Each lab trades ONLY the new coins, so the dashboard shows exactly what SUI / ARB add. out/ is generated: edit patches/, never out/.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const HERE = __dirname, STRAT = path.join(HERE, '..', '..');           // D:\testing\Strat
// 4h history for replay / parity checks (the bots fetch live candles from MEXC). Binance USDT-M 4h, same format as the bots' data/ files.
const DATA = { SUI: path.join(STRAT, 'StrategyBacktester', 'candles', 'binance-futures', '4h', 'SUI.json'), ARB: path.join(STRAT, 'StrategyBacktester', 'research', 'zec-replacement', 'data4h', 'ARB.json') };
const BOTS = {
  bb: { name: 'coin-bb', src: path.join(STRAT, 'bb-core'), patch: 'coin-bb.js', main: 'lucidio.js', coins: ['ARB'], tag: 'cbb', extra: [[path.join(STRAT, 'StrategyBacktester', 'bb-core-1h', 'realpaper.js'), 'realpaper.js']] },
  tc: { name: 'coin-tc', src: path.join(STRAT, 'StrategyBacktester', 'bb-trail'), patch: 'coin-tc.js', main: 'icore.js', coins: ['SUI', 'ARB'], tag: 'ctc', extra: [] },
};
const SKIP_FILE = /^(mexc-keys.*\.json|package-lock\.json|\.env.*|apply-.*-patch\.js|.*\.md|.*\.cmd|.*\.html)$/i;   // never copied: secrets, records, build tools, docs

function copyBot(b) {
  const out = path.join(HERE, 'out', b.name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'data'), { recursive: true });
  for (const f of fs.readdirSync(b.src)) {
    const p = path.join(b.src, f);
    if (fs.statSync(p).isFile() && /\.(js|json)$/.test(f) && !SKIP_FILE.test(f)) fs.copyFileSync(p, path.join(out, f));
  }
  for (const c of b.coins) fs.copyFileSync(DATA[c], path.join(out, 'data', c + '.json'));
  if (fs.existsSync(path.join(b.src, 'test'))) fs.cpSync(path.join(b.src, 'test'), path.join(out, 'test'), { recursive: true });
  for (const [from, to] of b.extra) fs.copyFileSync(from, path.join(out, to));
  if (!fs.existsSync(path.join(out, b.main))) throw new Error(`${b.name}: ${b.main} missing after copy`);
  for (const bad of ['mexc-keys.json', '.env', 'state', 'journal']) if (fs.existsSync(path.join(out, bad))) throw new Error(`${b.name}: ${bad} was copied`);
  return out;
}
const which = process.argv[2] ? [process.argv[2]] : Object.keys(BOTS);
for (const k of which) {
  const b = BOTS[k]; if (!b) throw new Error('unknown bot ' + k + ' (bb | tc)');
  const out = copyBot(b);
  cp.execFileSync(process.execPath, [path.join(HERE, 'patches', b.patch)], { cwd: out, stdio: 'inherit' });
  const main = fs.readFileSync(path.join(out, b.main), 'utf8'), push = fs.readFileSync(path.join(out, 'dashboard-push.js'), 'utf8');
  const cfg = JSON.parse(fs.readFileSync(path.join(out, 'bot-config.json'), 'utf8'));
  if (!main.includes('const liveAllowed = () => false;')) throw new Error(`${b.name}: paper lock missing`);
  if (!push.includes(`bot: '${b.tag}'`)) throw new Error(`${b.name}: dashboard tag missing`);
  if (cfg.mode !== 'paper' || JSON.stringify(cfg.coins) !== JSON.stringify(b.coins)) throw new Error(`${b.name}: config not paper on ${b.coins}`);
  console.log(`built ${path.relative(STRAT, out)}  coins ${b.coins.join('+')}  tag ${b.tag}`);
}
module.exports = { BOTS };
