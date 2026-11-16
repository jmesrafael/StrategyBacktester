// util.js - small shared helpers. No dependencies outside Node's standard library.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

// ---- statistics (all take plain number arrays) ----
const sum = (a) => { let s = 0; for (const v of a) s += v; return s; };
const mean = (a) => (a.length ? sum(a) / a.length : NaN);
// population standard deviation (divide by n). Used everywhere so every engine agrees.
const sd = (a) => { if (!a.length) return NaN; const m = mean(a); let v = 0; for (const x of a) v += (x - m) ** 2; return Math.sqrt(v / a.length); };
// quantile with linear interpolation between order statistics (q in 0..1)
function quantile(a, q) {
  if (!a.length) return NaN;
  const b = [...a].sort((x, y) => x - y), p = (b.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  return b[lo] + (b[hi] - b[lo]) * (p - lo);
}
const median = (a) => quantile(a, 0.5);
function corr(a, b) {
  const n = Math.min(a.length, b.length); if (n < 3) return null;
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}
const round = (v, d = 4) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(d));

// deterministic random numbers (mulberry32) so every bootstrap and permutation is reproducible
function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- hashing ----
const sha256 = (x) => crypto.createHash('sha256').update(x).digest('hex');
const sha256File = (f) => sha256(fs.readFileSync(f));
// stable JSON: keys sorted, so the same object always gives the same text and hash
function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
}

// ---- CSV (RFC 4180 quoting) ----
const cell = (v) => { if (v == null) return ''; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (rows, fields) => [fields.join(','), ...rows.map((r) => fields.map((f) => cell(r[f])).join(','))].join('\n') + '\n';
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0];
  return rows.slice(1).filter((r) => r.length > 1 || r[0] !== '').map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
}

// ---- JSON lines ----
const toJsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
const parseJsonl = (text) => text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

// ---- time (all engine times are UTC unix seconds) ----
const H = 3600, D = 86400;
const iso = (s) => new Date(s * 1000).toISOString().slice(0, 16).replace('T', ' ');
const day = (s) => new Date(s * 1000).toISOString().slice(0, 10);
const toSec = (x) => (x == null || x === '' ? null : typeof x === 'number' ? (x > 1e11 ? Math.floor(x / 1000) : x) : Math.floor(Date.parse(x) / 1000));

// ---- files ----
const mkdirp = (d) => fs.mkdirSync(d, { recursive: true });
function walk(dir, out = [], base = dir) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, base); else out.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return out.sort();
}
// markdown table from rows: cols = [[header, fn(row)], ...]
const mdTable = (rows, cols) => ['| ' + cols.map((c) => c[0]).join(' | ') + ' |', '|' + cols.map(() => '---').join('|') + '|',
  ...rows.map((r) => '| ' + cols.map((c) => { const v = c[1](r); return v == null ? '-' : String(v).replace(/\|/g, '/'); }).join(' | ') + ' |')].join('\n');
const signed = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : (x >= 0 ? '+' : '') + x.toFixed(d));

module.exports = { sum, mean, sd, quantile, median, corr, round, rng, sha256, sha256File, canonical, toCsv, parseCsv, toJsonl, parseJsonl, H, D, iso, day, toSec, mkdirp, walk, mdTable, signed };
