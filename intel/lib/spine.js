// spine.js - the data spine: the ONLY way engines read and write shared data.
//
// A dataset is a folder under intel/data/<name>/ holding data files and one manifest.json.
// The manifest records: schema and version, where the data came from, which other datasets it was built
// from (lineage), a SHA-256 checksum and row count per file, the checks that ran, and a status.
//
// load() refuses a dataset that is missing, failed its checks, is corrupted (checksum differs), is older
// than the caller allows, or does not match its schema. An engine can therefore never silently read bad data.
'use strict';
const fs = require('fs'), path = require('path');
const U = require('./util');

const ROOT = () => process.env.INTEL_DATA || path.join(__dirname, '..', 'data');
const dir = (name) => path.join(ROOT(), name);

class SpineError extends Error { constructor(code, msg) { super(`[${code}] ${msg}`); this.code = code; } }

// ---- schema: { field: type } with type in string | number | int | bool | json, a trailing ? allows null ----
function checkRow(row, schema, where) {
  for (const [f, t0] of Object.entries(schema)) {
    const opt = t0.endsWith('?'), t = opt ? t0.slice(0, -1) : t0, v = row[f];
    if (v === null || v === undefined || v === '') { if (!opt) throw new SpineError('SCHEMA', `${where}: field "${f}" is empty`); continue; }
    const ok = t === 'string' ? typeof v === 'string' : t === 'number' ? typeof v === 'number' && Number.isFinite(v)
      : t === 'int' ? Number.isInteger(v) : t === 'bool' ? typeof v === 'boolean' : t === 'json' ? true : false;
    if (!ok) throw new SpineError('SCHEMA', `${where}: field "${f}" should be ${t}, got ${JSON.stringify(v)}`);
  }
}
function cast(raw, schema) {       // CSV text -> typed row
  const o = {};
  for (const [f, t0] of Object.entries(schema)) {
    const t = t0.replace('?', ''), v = raw[f];
    if (v === undefined || v === '') { o[f] = null; continue; }
    o[f] = t === 'number' || t === 'int' ? Number(v) : t === 'bool' ? v === 'true' : t === 'json' ? JSON.parse(v) : v;
  }
  return o;
}

// write a dataset. files = { 'name.csv': { rows, schema }, 'name.jsonl': { rows, schema }, 'name.json': { json } }
// Any failed check (or a schema error) makes the status "failed" and the dataset unreadable through load().
function write(name, { schemaVersion = 1, source, inputs = [], files, checks = [], notes = [], generator }) {
  const d = dir(name); U.mkdirp(d);
  const out = {}; let schemaError = null;
  for (const [fn, spec] of Object.entries(files)) {
    let text, rows = null;
    try {
      if (spec.json !== undefined) text = JSON.stringify(spec.json, null, 1) + '\n';
      else {
        spec.rows.forEach((r, i) => checkRow(r, spec.schema, `${name}/${fn} row ${i + 1}`));
        rows = spec.rows.length;
        text = fn.endsWith('.csv') ? U.toCsv(spec.rows, Object.keys(spec.schema)) : U.toJsonl(spec.rows.map((r) => Object.fromEntries(Object.keys(spec.schema).map((k) => [k, r[k] === undefined ? null : r[k]]))));
      }
    } catch (e) { if (!(e instanceof SpineError)) throw e; schemaError = e.message; continue; }
    U.mkdirp(path.dirname(path.join(d, fn)));
    fs.writeFileSync(path.join(d, fn), text);
    out[fn] = { rows, sha256: U.sha256(text), bytes: Buffer.byteLength(text), schema: spec.schema || null };
  }
  if (schemaError) checks = checks.concat({ name: 'schema', ok: false, detail: schemaError });
  const status = checks.every((c) => c.ok) ? 'ok' : 'failed';
  const m = { dataset: name, schema_version: schemaVersion, status, built_at: new Date().toISOString(), generator: generator || null, source: source || null,
    inputs, files: out, checks, notes };
  fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify(m, null, 1) + '\n');
  return m;
}

function manifest(name) {
  const f = path.join(dir(name), 'manifest.json');
  if (!fs.existsSync(f)) throw new SpineError('MISSING', `dataset "${name}" has no manifest (not built yet). Build it first.`);
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new SpineError('CORRUPT', `dataset "${name}": manifest is not valid JSON`); }
}

// read one file of a dataset, fully validated. opts.maxAgeHours rejects stale data.
function load(name, file, opts = {}) {
  const m = manifest(name);
  if (m.status !== 'ok') throw new SpineError('FAILED', `dataset "${name}" failed its checks: ${m.checks.filter((c) => !c.ok).map((c) => c.name + ' (' + c.detail + ')').join('; ')}`);
  if (opts.maxAgeHours != null && (Date.now() - Date.parse(m.built_at)) / 3600e3 > opts.maxAgeHours) throw new SpineError('STALE', `dataset "${name}" was built ${m.built_at}, older than ${opts.maxAgeHours}h`);
  const meta = m.files[file];
  if (!meta) throw new SpineError('MISSING', `dataset "${name}" has no file "${file}"`);
  const f = path.join(dir(name), file);
  if (!fs.existsSync(f)) throw new SpineError('MISSING', `dataset "${name}": file "${file}" is listed but not on disk`);
  const text = fs.readFileSync(f, 'utf8');
  if (U.sha256(text) !== meta.sha256) throw new SpineError('CORRUPT', `dataset "${name}": "${file}" does not match its checksum (changed or damaged after it was built)`);
  if (file.endsWith('.json')) return JSON.parse(text);
  const rows = file.endsWith('.csv') ? U.parseCsv(text).map((r) => cast(r, meta.schema)) : U.parseJsonl(text);
  if (rows.length !== meta.rows) throw new SpineError('CORRUPT', `dataset "${name}": "${file}" has ${rows.length} rows, manifest says ${meta.rows}`);
  rows.forEach((r, i) => checkRow(r, meta.schema, `${name}/${file} row ${i + 1}`));
  return rows;
}

// a reference to put in another dataset's "inputs": which exact build was read
function ref(name) { const m = manifest(name); return { dataset: name, built_at: m.built_at, manifest_sha256: U.sha256(U.canonical(m.files)) }; }
const exists = (name) => fs.existsSync(path.join(dir(name), 'manifest.json'));
function list() {
  const out = [];
  const rec = (d, rel) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { const r = rel ? rel + '/' + e.name : e.name; if (fs.existsSync(path.join(d, e.name, 'manifest.json'))) out.push(r); rec(path.join(d, e.name), r); } };
  rec(ROOT(), ''); return out.sort();
}
// verify every file of a dataset against its manifest without parsing. Returns a list of faults (empty = clean).
function verify(name) {
  let m; try { m = manifest(name); } catch (e) { return [e.message]; }
  const faults = [];
  if (m.status !== 'ok') faults.push(`status is ${m.status}: ${m.checks.filter((c) => !c.ok).map((c) => c.name).join(', ')}`);
  for (const [fn, meta] of Object.entries(m.files)) {
    const f = path.join(dir(name), fn);
    if (!fs.existsSync(f)) faults.push(`${fn}: missing on disk`);
    else if (U.sha256File(f) !== meta.sha256) faults.push(`${fn}: checksum mismatch`);
  }
  return faults;
}

// ---- append-only logs with a hash chain: an old row can never be changed without detection ----
// rows are objects; each stored row gets seq, prev_hash, row_hash = sha256(prev_hash + canonical(row without the hashes)).
const GENESIS = '0'.repeat(64);
// schema (optional) fixes the set of fields, so a row hashes the same before and after it is stored.
const CHAIN = { seq: 'int', prev_hash: 'string', row_hash: 'string' };
function chainAppend(existing, fresh, schema = null) {
  let prev = existing.length ? existing[existing.length - 1].row_hash : GENESIS, seq = existing.length;
  const out = existing.slice();
  for (const r of fresh) { const body = schema ? Object.fromEntries(Object.keys(schema).filter((k) => !(k in CHAIN)).map((k) => [k, r[k] === undefined ? null : r[k]])) : { ...r }; delete body.seq; delete body.prev_hash; delete body.row_hash; const row_hash = U.sha256(prev + U.canonical(body)); out.push({ ...body, seq: ++seq, prev_hash: prev, row_hash }); prev = row_hash; }
  return out;
}
function chainVerify(rows) {       // returns null when intact, else the first broken sequence number
  let prev = GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const body = { ...rows[i] }; delete body.seq; delete body.prev_hash; delete body.row_hash;
    if (rows[i].prev_hash !== prev || rows[i].seq !== i + 1 || U.sha256(prev + U.canonical(body)) !== rows[i].row_hash) return i + 1;
    prev = rows[i].row_hash;
  }
  return null;
}

module.exports = { ROOT, dir, write, load, manifest, ref, exists, list, verify, chainAppend, chainVerify, CHAIN, GENESIS, SpineError, checkRow };
