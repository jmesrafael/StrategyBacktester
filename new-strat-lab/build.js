// build.js — makes the two NEW STRATEGY LAB paper bots from FRESH copies of existing paper bots (the originals are only read, never written).
//   node build.js          both  ->  out/lab-wide (BB-1H-WIDE, from ../bb-core-1h) and out/lab-ichi (ICHI-X4, from ../bb-trail)
//   node build.js wide|ichi
// out/ is generated: edit patches.js and ichi/, never out/.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const HERE = __dirname, REPO = path.join(HERE, '..');
const C = require('../candles/candles.js');
const BOTS = {
  wide: { name: 'lab-wide', src: path.join(REPO, 'bb-core-1h'), tf: '1h', main: 'lucidio.js', core: 'lucidio-core.js', replace: [] },
  ichi: { name: 'lab-ichi', src: path.join(REPO, 'bb-trail'), tf: '4h', main: 'icore.js', core: 'icore-core.js', replace: [['ichi/icore-core.js', 'icore-core.js']] },
};
const SKIP_FILE = /^(mexc-keys.*\.json|package-lock\.json|\.env.*|apply-.*-patch\.js|.*\.md|.*\.cmd|.*\.html|parity-check\.js|lab-report\.js)$/i;   // never copied: secrets, records, build tools, docs
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'];
const FROM = '2020-01-01';

function build(key) {
  const b = BOTS[key]; if (!b) throw new Error('unknown bot ' + key + ' (wide | ichi)');
  const out = path.join(HERE, 'out', b.name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'data'), { recursive: true });
  for (const f of fs.readdirSync(b.src)) {
    const p = path.join(b.src, f);
    if (fs.statSync(p).isFile() && /\.(js|json)$/.test(f) && !SKIP_FILE.test(f)) fs.copyFileSync(p, path.join(out, f));
  }
  for (const [from, to] of b.replace) fs.copyFileSync(path.join(HERE, from), path.join(out, to));
  // history for the parity check (the bot itself reads live candles from MEXC): Binance candles from the local library
  for (const c of COINS) fs.writeFileSync(path.join(out, 'data', c + '.json'), JSON.stringify(C.load(c, b.tf, { from: FROM })));
  cp.execFileSync(process.execPath, [path.join(HERE, 'patches.js'), key], { cwd: out, stdio: 'inherit' });
  const main = fs.readFileSync(path.join(out, b.main), 'utf8'), cfg = JSON.parse(fs.readFileSync(path.join(out, 'bot-config.json'), 'utf8'));
  if (!main.includes('const liveAllowed = () => false;')) throw new Error(`${b.name}: paper lock missing`);
  if (cfg.mode !== 'paper' || JSON.stringify(cfg.coins) !== JSON.stringify(COINS)) throw new Error(`${b.name}: config is not paper on ${COINS}`);
  for (const bad of ['mexc-keys.json', '.env', 'state', 'journal']) if (fs.existsSync(path.join(out, bad))) throw new Error(`${b.name}: ${bad} was copied`);
  console.log(`built out/${b.name}  coins ${COINS.join('+')}`);
  return out;
}
if (require.main === module) (process.argv[2] ? [process.argv[2]] : Object.keys(BOTS)).forEach(build);
module.exports = { BOTS, COINS, build };
