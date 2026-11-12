// node coin-lab-bots/test/run-original-suites.js [bb|tc] — runs each ORIGINAL bot's own test files against
//  (a) a throw-away temp copy of the original (the baseline; the original folder is never written), and
//  (b) the generated coin lab copy,
// and prints which files pass/fail in each, so a news-lab-only failure stands out. Expected differences (tag, labels, Telegram) are listed.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const STRAT = path.join(__dirname, '..', '..', '..');
const BOTS = {
  bb: { out: 'coin-bb', orig: path.join(STRAT, 'bb-core'), env: 'LUCIDIO' },
  tc: { out: 'coin-tc', orig: path.join(STRAT, 'StrategyBacktester', 'bb-trail'), env: 'ICORE' },
};
const SKIP = /^(mexc-keys.*\.json|\.env.*|state|journal|node_modules|\.git|dist)$/;

function tempCopy(src) {
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'orig-'));
  fs.cpSync(src, dst, { recursive: true, filter: (p) => !SKIP.test(path.basename(p)) });
  return dst;
}
function runFile(dir, file, envPrefix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-'));
  const env = { ...process.env, [`${envPrefix}_STATE_DIR`]: tmp, [`${envPrefix}_KEYS`]: path.join(tmp, 'no-keys.json'), [`${envPrefix}_ENV_FILE`]: path.join(tmp, 'no.env'), [`${envPrefix}_NO_NOTIFY`]: '1', DASHBOARD_ASK_POLL_SEC: '0' };
  for (const k of ['DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']) delete env[k];
  const args = /realpaper-test|\.test\./.test(file) ? ['--test', path.join('test', file)] : [path.join('test', file)];
  const r = cp.spawnSync(process.execPath, args, { cwd: dir, env, encoding: 'utf8', timeout: 240000 });
  const out = (r.stdout || '') + (r.stderr || '');
  return { ok: r.status === 0, why: r.status === 0 ? '' : (out.split('\n').filter((l) => /fail|error|expected|mismatch|✗|not ok/i.test(l)).slice(0, 2).join(' | ').slice(0, 220) || `exit ${r.status}${r.signal ? ' ' + r.signal : ''}`) };
}

const which = process.argv[2] ? [process.argv[2]] : Object.keys(BOTS);
const summary = [];
for (const k of which) {
  const b = BOTS[k], base = tempCopy(b.orig);
  // test harness only (never shipped): a temp copy of the coin lab bot + the original's test fixtures it does not ship
  // (dashboard/, sidecar/, deploy/, extra data files), and the sandbox file lists in the old tests learn the two new files.
  const copy = tempCopy(path.join(__dirname, '..', 'out', b.out));
  fs.cpSync(b.orig, copy, { recursive: true, force: false, errorOnExist: false, filter: (p) => !SKIP.test(path.basename(p)) && !(fs.existsSync(p) && fs.statSync(p).isFile() && path.dirname(p) === b.orig) });
  for (const f of fs.readdirSync(path.join(copy, 'test')).filter((x) => x.endsWith('.js'))) {
    const p = path.join(copy, 'test', f), s = fs.readFileSync(p, 'utf8');
    const t = s.split("'keyinfo.js']) fs.copyFileSync").join("'keyinfo.js', 'realpaper.js', 'newsgate.js'].filter((f) => fs.existsSync(path.join(__dirname, '..', f)))) fs.copyFileSync");
    if (t !== s) fs.writeFileSync(p, t);
  }
  const files = fs.readdirSync(path.join(copy, 'test')).filter((f) => f.endsWith('.js') && f !== 'helpers.js' && !f.startsWith('_'));
  console.log(`\n=== ${b.out} (${files.length} test files) — baseline = temp copy of ${path.relative(STRAT, b.orig)}`);
  let same = 0, newFail = 0;
  for (const f of files) {
    const o = runFile(base, f, b.env), c = runFile(copy, f, b.env);
    const flag = o.ok === c.ok ? (c.ok ? 'pass' : 'fails in both') : c.ok ? 'FIXED?' : 'COIN-LAB ONLY FAIL';
    if (!c.ok && o.ok) newFail++; else same++;
    console.log(`  ${flag.padEnd(20)} ${f}${!c.ok ? '  · copy: ' + c.why : ''}${!o.ok && c.ok ? '  · orig: ' + o.why : ''}`);
  }
  summary.push(`${b.out}: ${files.length} files, ${same} same as the original, ${newFail} fail only in the coin lab copy`);
  fs.rmSync(base, { recursive: true, force: true }); fs.rmSync(copy, { recursive: true, force: true });
}
console.log('\n' + summary.join('\n'));
