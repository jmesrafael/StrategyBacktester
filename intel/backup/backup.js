// backup/backup.js - versioned snapshots of everything this system owns, and a verified restore.
//
//   node backup/backup.js snapshot [--with-candles] [--with-recorder]   make a new snapshot under intel/backups/<UTC time>/
//   node backup/backup.js verify  <snapshot folder>                     re-check every file of a snapshot against its manifest
//   node backup/backup.js restore <snapshot folder> <target folder>     copy a snapshot into an empty folder and verify it
//   node backup/backup.js list
//
// A snapshot holds the code (so it runs on a machine that has only Node.js), the configuration, the inputs
// (database exports, owner tags) and every dataset. SNAPSHOT.json lists every file with its SHA-256.
// Incremental: a file identical to the one in the previous snapshot is hard-linked, not copied, so daily
// snapshots cost almost no disk. Each snapshot is still a complete folder on its own.
// The candle library (about 300 MB) can be downloaded again from Binance, so it is left out unless --with-candles.
// If config.backupCopyTo names a folder (for example a cloud-synced one), the snapshot is also copied there.
'use strict';
const fs = require('fs'), path = require('path');
const cfg = require('../lib/config'), U = require('../lib/util');

const CODE = ['lib', 'ingest', 'integrity', 'backup', 'engines', 'report', 'scripts', 'test'];
const TOP = (f) => /\.(md|json|js|csv)$/.test(f) && f !== 'secrets.local.json';

function plan(opts = {}) {
  const items = [];   // { rel (inside the snapshot), abs (source) }
  const addTree = (abs, rel) => { for (const f of U.walk(abs)) items.push({ rel: rel + '/' + f, abs: path.join(abs, f) }); };
  for (const d of CODE) addTree(path.join(cfg.BASE, d), 'intel/' + d);
  for (const f of fs.readdirSync(cfg.BASE)) if (fs.statSync(path.join(cfg.BASE, f)).isFile() && TOP(f)) items.push({ rel: 'intel/' + f, abs: path.join(cfg.BASE, f) });
  addTree(path.join(cfg.BASE, 'inputs'), 'intel/inputs');
  addTree(path.join(cfg.BASE, 'data'), 'intel/data');
  addTree(path.join(cfg.BASE, 'reports'), 'intel/reports');
  const lib = cfg.path(cfg.candleLibrary);
  for (const f of ['candles.js', 'update.js', 'coins.json', 'README.md']) if (fs.existsSync(path.join(lib, f))) items.push({ rel: 'candles/' + f, abs: path.join(lib, f) });
  if (opts.withCandles) for (const tf of ['1h', '4h', 'funding']) addTree(path.join(lib, 'binance-futures', tf), 'candles/binance-futures/' + tf);
  if (opts.withRecorder && fs.existsSync(cfg.path(cfg.recorderData))) addTree(cfg.path(cfg.recorderData), 'recorder-data/lucidio-recorder');
  return items.filter((i) => !i.rel.includes('/backups/') && !i.rel.endsWith('secrets.local.json'));
}
const root = () => cfg.path(cfg.backupDir);
const list = () => (fs.existsSync(root()) ? fs.readdirSync(root()).filter((d) => fs.existsSync(path.join(root(), d, 'SNAPSHOT.json'))).sort() : []);

function snapshot(opts = {}) {
  const id = (opts.id || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z'), dst = path.join(root(), id), prevId = list().pop();
  const prev = prevId ? JSON.parse(fs.readFileSync(path.join(root(), prevId, 'SNAPSHOT.json'), 'utf8')) : null;
  U.mkdirp(dst); const files = {}; let linked = 0, copied = 0, bytes = 0;
  for (const it of plan(opts)) {
    const sha = U.sha256File(it.abs), out = path.join(dst, it.rel); U.mkdirp(path.dirname(out));
    const p = prev && prev.files[it.rel];
    let done = false;
    if (p && p.sha256 === sha) { try { fs.linkSync(path.join(root(), prevId, it.rel), out); linked++; done = true; } catch (e) { /* other disk or no hard links: fall back to a copy */ } }
    if (!done) { fs.copyFileSync(it.abs, out); copied++; }
    const size = fs.statSync(out).size; bytes += size; files[it.rel] = { sha256: sha, bytes: size };
  }
  const man = { id, created_at: new Date().toISOString(), previous: prevId || null, with_candles: !!opts.withCandles, with_recorder: !!opts.withRecorder, file_count: Object.keys(files).length, bytes, linked_from_previous: linked, copied, files };
  fs.writeFileSync(path.join(dst, 'SNAPSHOT.json'), JSON.stringify(man, null, 1));
  let copyTo = null;
  if (cfg.backupCopyTo && !opts.noCopy) { copyTo = path.join(cfg.path(cfg.backupCopyTo), id); fs.cpSync(dst, copyTo, { recursive: true }); }
  return { id, dir: dst, files: man.file_count, bytes, linked, copied, copyTo };
}

// returns a list of faults (empty = the snapshot is complete and unchanged)
function verify(dir) {
  const f = path.join(dir, 'SNAPSHOT.json'); if (!fs.existsSync(f)) return ['SNAPSHOT.json missing'];
  const man = JSON.parse(fs.readFileSync(f, 'utf8')), faults = [];
  for (const [rel, m] of Object.entries(man.files)) { const p = path.join(dir, rel); if (!fs.existsSync(p)) faults.push('missing: ' + rel); else if (U.sha256File(p) !== m.sha256) faults.push('changed: ' + rel); }
  return faults;
}
function restore(dir, target) {
  const pre = verify(dir); if (pre.length) throw new Error('snapshot is damaged, not restoring: ' + pre.slice(0, 5).join('; '));
  if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error('target folder is not empty: ' + target);
  U.mkdirp(target); const man = JSON.parse(fs.readFileSync(path.join(dir, 'SNAPSHOT.json'), 'utf8'));
  for (const rel of Object.keys(man.files)) { const out = path.join(target, rel); U.mkdirp(path.dirname(out)); fs.copyFileSync(path.join(dir, rel), out); }
  fs.copyFileSync(path.join(dir, 'SNAPSHOT.json'), path.join(target, 'SNAPSHOT.json'));
  const post = verify(target); if (post.length) throw new Error('restore finished with faults: ' + post.slice(0, 5).join('; '));
  return { files: man.file_count, target };
}
module.exports = { snapshot, verify, restore, list, plan };
if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2), flags = process.argv.slice(2);
  if (cmd === 'snapshot') { const r = snapshot({ withCandles: flags.includes('--with-candles'), withRecorder: flags.includes('--with-recorder') }); console.log(`snapshot ${r.id}: ${r.files} files, ${(r.bytes / 1e6).toFixed(1)} MB (${r.copied} copied, ${r.linked} linked from the previous snapshot)${r.copyTo ? ', second copy: ' + r.copyTo : ', no second copy configured (config.backupCopyTo)'}`); }
  else if (cmd === 'verify') { const f = verify(path.resolve(a)); console.log(f.length ? 'FAULTS:\n' + f.join('\n') : 'snapshot verified: every file matches'); process.exit(f.length ? 1 : 0); }
  else if (cmd === 'restore') { const r = restore(path.resolve(a), path.resolve(b)); console.log(`restored ${r.files} files to ${r.target} and verified them. Next: cd "${path.join(r.target, 'intel')}" && node run.js test`); }
  else if (cmd === 'list') console.log(list().join('\n') || 'no snapshots yet');
  else console.log('usage: node backup/backup.js snapshot [--with-candles] [--with-recorder] | verify <dir> | restore <dir> <target> | list');
}
