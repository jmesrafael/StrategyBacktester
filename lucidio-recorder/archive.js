// archive.js - the recorder's files. Plain JSON lines, one folder per kind of data, readable by anything (and by research code with zlib for the .gz ones):
//   candles/<SYMBOL>/<tf>/YYYY-MM.jsonl[.gz]   [time, open, high, low, close, volume] per line, closed candles only, tf = 1m | 1h | 4h
//   funding/<SYMBOL>.jsonl                      [settleTime(ms), rate, cycleHours] per line: what MEXC really charged
//   book/<SYMBOL>/YYYY-MM-DD.jsonl[.gz]         one snapshot every 5 minutes: spread, depth, adverse slippage of a buy and a sell at each size, the funding rate at that moment
//   regime/hourly.jsonl                         the regime of every coin and of the market, once an hour
//   summary/*.json                              slippage.json (read by the paper bot), regime.json, status.json
// Finished months / days are gzipped. Nothing is ever deleted. Appends only: a crash can at worst leave one torn last line, which readers skip.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const STEP = { '1m': 60, '1h': 3600, '4h': 14400 };
const monthOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 7), dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

function parseLines(text) { const out = []; for (const l of text.split('\n')) { if (!l) continue; try { out.push(JSON.parse(l)); } catch { /* a torn line */ } } return out; }
function readFileLines(file) {
  try { if (file.endsWith('.gz')) return parseLines(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')); return parseLines(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
const listSorted = (dir, re) => { try { return fs.readdirSync(dir).filter((f) => re.test(f)).sort(); } catch { return []; } };
// a day or month may exist twice (raw and gz) for a moment while rotating: the raw one wins
const uniqueByStem = (files) => { const m = new Map(); for (const f of files) { const stem = f.replace(/\.gz$/, ''); if (!m.has(stem) || !f.endsWith('.gz')) m.set(stem, f); } return [...m.values()].sort(); };

function createArchive(root) {
  const lastT = new Map();                       // "SYM|tf" -> newest stored candle time
  const mk = (...p) => { const d = path.join(root, ...p); fs.mkdirSync(d, { recursive: true, mode: 0o755 }); return d; };
  const append = (file, lines) => { fs.appendFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n'); };

  const candleDir = (sym, tf) => path.join(root, 'candles', sym, tf);
  function newestCandle(sym, tf) {
    const k = `${sym}|${tf}`;
    if (lastT.has(k)) return lastT.get(k);
    const files = uniqueByStem(listSorted(candleDir(sym, tf), /^\d{4}-\d{2}\.jsonl(\.gz)?$/));
    let t = null;
    for (let i = files.length - 1; i >= 0 && t == null; i--) { const rows = readFileLines(path.join(candleDir(sym, tf), files[i])); if (rows.length) t = rows[rows.length - 1][0]; }
    lastT.set(k, t); return t;
  }

  return {
    root,
    // store closed candles newer than the newest one already stored. Returns how many were written.
    appendCandles(sym, tf, rows) {
      let last = newestCandle(sym, tf), n = 0;
      const fresh = rows.filter((c) => Number.isFinite(c[0]) && (last == null || c[0] > last)).sort((a, b) => a[0] - b[0]);
      const byMonth = new Map();
      for (const c of fresh) { const m = monthOf(c[0]); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(c); }
      for (const [m, list] of byMonth) { append(path.join(mk('candles', sym, tf), `${m}.jsonl`), list); n += list.length; last = list[list.length - 1][0]; }
      if (n) lastT.set(`${sym}|${tf}`, last);
      return n;
    },
    newestCandle,
    // the newest n candles (reads back month by month)
    readCandles(sym, tf, n) {
      const files = uniqueByStem(listSorted(candleDir(sym, tf), /^\d{4}-\d{2}\.jsonl(\.gz)?$/)), out = [];
      for (let i = files.length - 1; i >= 0 && out.length < n; i--) out.unshift(...readFileLines(path.join(candleDir(sym, tf), files[i])));
      return out.slice(-n);
    },
    appendFunding(sym, rows) {
      const file = path.join(mk('funding'), `${sym}.jsonl`), have = new Set(readFileLines(file).map((r) => r[0]));
      const fresh = rows.filter((r) => Number.isFinite(+r.settleTime) && !have.has(+r.settleTime)).sort((a, b) => a.settleTime - b.settleTime).map((r) => [+r.settleTime, +r.fundingRate, +r.collectCycle || 8]);
      if (fresh.length) append(file, fresh);
      return fresh.length;
    },
    readFunding(sym) { return readFileLines(path.join(root, 'funding', `${sym}.jsonl`)); },
    appendBook(sym, snap) { append(path.join(mk('book', sym), `${dayOf(snap.t)}.jsonl`), [snap]); },
    // every snapshot since sinceMs
    readBook(sym, sinceMs) {
      const dir = path.join(root, 'book', sym), from = dayOf(sinceMs), out = [];
      for (const f of uniqueByStem(listSorted(dir, /^\d{4}-\d{2}-\d{2}\.jsonl(\.gz)?$/))) { if (f.slice(0, 10) < from) continue; for (const s of readFileLines(path.join(dir, f))) if (s.t >= sinceMs) out.push(s); }
      return out;
    },
    appendRegime(rec) { append(path.join(mk('regime'), 'hourly.jsonl'), [rec]); },
    writeSummary(name, obj) { const dir = mk('summary'), tmp = path.join(dir, name + '.tmp'); fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o644 }); fs.renameSync(tmp, path.join(dir, name)); },
    readSummary(name) { try { return JSON.parse(fs.readFileSync(path.join(root, 'summary', name), 'utf8')); } catch { return null; } },

    // gzip every finished candle month and every book day older than yesterday. Safe to run any time: it never touches the file being appended to.
    rotate(nowMs = Date.now()) {
      let done = 0;
      const gz = (file) => { try { const tmp = file + '.gz.tmp'; fs.writeFileSync(tmp, zlib.gzipSync(fs.readFileSync(file), { level: 9 })); fs.renameSync(tmp, file + '.gz'); fs.unlinkSync(file); done++; } catch { /* try again next time */ } };
      const thisMonth = new Date(nowMs).toISOString().slice(0, 7), cutoff = dayOf(nowMs - 2 * 86400000);
      const sub = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } };
      for (const sym of sub(path.join(root, 'candles'))) for (const tf of sub(path.join(root, 'candles', sym)))
        for (const f of listSorted(candleDir(sym, tf), /^\d{4}-\d{2}\.jsonl$/)) if (f.slice(0, 7) < thisMonth) gz(path.join(candleDir(sym, tf), f));
      for (const sym of sub(path.join(root, 'book'))) for (const f of listSorted(path.join(root, 'book', sym), /^\d{4}-\d{2}-\d{2}\.jsonl$/)) if (f.slice(0, 10) < cutoff) gz(path.join(root, 'book', sym, f));
      return done;
    },
    // size on disk and the first day recorded (for the dashboard's health line)
    footprint() {
      let bytes = 0, first = null;
      const walk = (d) => { let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of ents) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { try { const st = fs.statSync(p); bytes += st.size; if (first == null || st.birthtimeMs < first) first = st.birthtimeMs || st.mtimeMs; } catch {} } } };
      walk(root);
      return { mb: Math.round(bytes / 1048576 * 10) / 10, first_ms: first };
    },
  };
}

// holes in a run of candles: how many expected steps are missing between the first and last (pure; tested)
function holesIn(rows, step) { let h = 0; for (let i = 1; i < rows.length; i++) { const gap = rows[i][0] - rows[i - 1][0]; if (gap > step) h += Math.round(gap / step) - 1; } return h; }

module.exports = { createArchive, holesIn, STEP, monthOf, dayOf };
