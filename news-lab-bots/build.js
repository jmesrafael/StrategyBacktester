// build.js — makes the three NEWS LAB bots from FRESH copies of the originals (the originals are only read, never written).
//   node news-lab-bots/build.js            all three  ->  news-lab-bots/out/news-bb, out/news-ic, out/news-tc
//   node news-lab-bots/build.js bb|ic|tc   one of them
// out/ is generated: change the patch scripts in patches/, never the files in out/.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const HERE = __dirname, STRAT = path.join(HERE, '..', '..');           // D:\testing\Strat
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];

const BOTS = {
  bb: { name: 'news-bb', src: path.join(STRAT, 'bb-core'), patch: 'news-bb.js', main: 'lucidio.js', extra: [[path.join(STRAT, 'StrategyBacktester', 'bb-core-1h', 'realpaper.js'), 'realpaper.js']] },
  ic: { name: 'news-ic', src: path.join(STRAT, 'i-core'), patch: 'news-ic.js', main: 'icore.js', extra: [[path.join(STRAT, 'StrategyBacktester', 'bb-trail', 'realpaper.js'), 'realpaper.js']] },
  tc: { name: 'news-tc', src: path.join(STRAT, 'StrategyBacktester', 'bb-trail'), patch: 'news-tc.js', main: 'icore.js', extra: [] },
};
// never copied: secrets, records, build tools of the original, docs
const SKIP_FILE = /^(mexc-keys.*\.json|package-lock\.json|\.env.*|apply-.*-patch\.js|.*\.md|.*\.cmd|.*\.html)$/i;

function copyBot(b) {
  const out = path.join(HERE, 'out', b.name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'data'), { recursive: true });
  for (const f of fs.readdirSync(b.src)) {
    const p = path.join(b.src, f);
    if (fs.statSync(p).isFile() && /\.(js|json)$/.test(f) && !SKIP_FILE.test(f)) fs.copyFileSync(p, path.join(out, f));
  }
  for (const c of COINS) fs.copyFileSync(path.join(b.src, 'data', c + '.json'), path.join(out, 'data', c + '.json'));
  if (fs.existsSync(path.join(b.src, 'test'))) fs.cpSync(path.join(b.src, 'test'), path.join(out, 'test'), { recursive: true });
  for (const [from, to] of b.extra) fs.copyFileSync(from, path.join(out, to));
  fs.copyFileSync(path.join(HERE, 'newsgate.js'), path.join(out, 'newsgate.js'));
  if (!fs.existsSync(path.join(out, b.main))) throw new Error(`${b.name}: ${b.main} missing after copy`);
  for (const bad of ['mexc-keys.json', '.env', 'state', 'journal']) if (fs.existsSync(path.join(out, bad))) throw new Error(`${b.name}: ${bad} was copied`);
  return out;
}

const which = process.argv[2] ? [process.argv[2]] : Object.keys(BOTS);
for (const k of which) {
  const b = BOTS[k]; if (!b) throw new Error('unknown bot ' + k + ' (bb | ic | tc)');
  const out = copyBot(b);
  cp.execFileSync(process.execPath, [path.join(HERE, 'patches', b.patch)], { cwd: out, stdio: 'inherit' });
  const main = fs.readFileSync(path.join(out, b.main), 'utf8');
  if (!main.includes('const liveAllowed = () => false;')) throw new Error(`${b.name}: paper lock missing`);
  if (!main.includes("newsgate.decide(opt.news")) throw new Error(`${b.name}: news gate missing`);
  console.log(`built ${path.relative(STRAT, out)}`);
}
module.exports = { BOTS };
