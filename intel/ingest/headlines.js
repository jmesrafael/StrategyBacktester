// ingest/headlines.js - the permanent headline archive (spine dataset "headlines").
// Pulse keeps raw stories for 8 days and daily briefs for 60. This job copies every highlight of every brief
// into an append-only log, so the history is never lost. One row per (story id, brief date): how a story's
// label changed from day to day is preserved too.
//
// Three different times are kept apart on every row:
//   event_time      when the thing itself happened. Pulse does not know it, so it is always empty here.
//   published_at    the earliest publication time among the story's sources (from the feeds).
//   first_seen_at   when Pulse first saw the story.
// plus brief_generated_at (when the label on this row was computed) and archived_at (when this archive stored it).
// A label may only be used for a time T if brief_generated_at <= T. That is the no-lookahead rule for headlines.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../lib/spine'), cfg = require('../lib/config'), U = require('../lib/util');

const SCHEMA = { key: 'string', id: 'string', brief_date: 'string', brief_generated_at: 'int', title: 'string', source: 'string?', link: 'string?', category: 'string?', event_time: 'int?',
  published_at: 'int?', first_seen_at: 'int', last_seen_at: 'int?', archived_at: 'int', bias: 'string', strength: 'number', impact: 'bool', story_count: 'int?', score: 'number?', assets: 'json', keywords: 'json',
  seq: 'int', prev_hash: 'string', row_hash: 'string' };

function rowsOfBrief(b, now) {
  const gen = Math.floor(b.generated / 1000);
  return (b.highlights || []).concat(b.pinned || []).filter((h) => h && h.id && h.title).map((h) => {
    const pubs = (h.related || []).map((r) => r.time).filter((t) => Number.isFinite(t) && t > 0);
    return { key: h.id + '|' + b.date, id: h.id, brief_date: b.date, brief_generated_at: gen, title: h.title, source: h.source || null, link: h.link || null, category: h.category || null, event_time: null,
      published_at: pubs.length ? Math.floor(Math.min(...pubs) / 1000) : null, first_seen_at: Math.floor(h.firstSeen / 1000), last_seen_at: h.lastSeen ? Math.floor(h.lastSeen / 1000) : null, archived_at: now,
      bias: h.bias || 'NEUTRAL', strength: Number(h.strength) || 0, impact: !!h.impact, story_count: Number.isFinite(h.count) ? h.count : null, score: Number.isFinite(h.score) ? h.score : null,
      assets: h.assets || [], keywords: h.keywords || [] };
  });
}
function readExisting() {
  const f = path.join(spine.dir('headlines'), 'headlines.jsonl');
  return fs.existsSync(f) ? U.parseJsonl(fs.readFileSync(f, 'utf8')) : [];
}
function missingDays(dates) {
  if (dates.length < 2) return [];
  const have = new Set(dates), out = [];
  for (let t = Date.parse(dates[0]); t <= Date.parse(dates[dates.length - 1]); t += 86400e3) { const d = new Date(t).toISOString().slice(0, 10); if (!have.has(d)) out.push(d); }
  return out;
}

function run(opts = {}) {
  const dir = opts.briefDir || cfg.path(cfg.pulseBriefs), now = opts.now || Math.floor(Date.now() / 1000);
  const existing = readExisting(), broken = spine.chainVerify(existing);
  const checks = [{ name: 'archive intact (hash chain)', ok: broken == null, detail: broken == null ? `${existing.length} stored rows verified` : `row ${broken} was altered or removed: the archive is not appended to until this is resolved (restore from backup)` }];
  let fresh = [], briefs = 0;
  if (broken == null && fs.existsSync(dir)) {
    const have = new Set(existing.map((r) => r.key));
    for (const fn of fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) {
      let b; try { b = JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf8')); } catch (e) { checks.push({ name: 'brief ' + fn, ok: false, detail: 'not valid JSON' }); continue; }
      briefs++;
      for (const r of rowsOfBrief(b, now)) if (!have.has(r.key)) { have.add(r.key); fresh.push(r); }
    }
    fresh.sort((a, b) => a.brief_generated_at - b.brief_generated_at || (a.id < b.id ? -1 : 1));
  }
  checks.push({ name: 'source folder found', ok: fs.existsSync(dir), detail: fs.existsSync(dir) ? `${briefs} briefs read from ${cfg.pulseBriefs}` : 'missing: ' + dir });
  const all = broken == null ? spine.chainAppend(existing, fresh, SCHEMA) : existing;
  const dates = [...new Set(all.map((r) => r.brief_date))].sort(), miss = missingDays(dates);
  return spine.write('headlines', {
    generator: 'ingest/headlines.js', checks,
    source: { kind: 'Pulse daily briefs (crypto-news repo)', path: cfg.pulseBriefs, labels: 'keyword scoring by Pulse (lib/highlights.js), no AI' },
    notes: [`${fresh.length} new rows appended`, `brief dates ${dates[0] || '-'} to ${dates[dates.length - 1] || '-'}`, miss.length ? `MISSING brief dates: ${miss.join(', ')}` : 'no brief date missing inside the range',
      'coverage starts when Pulse began saving briefs; nothing earlier can be recovered with honest first-seen times'],
    files: { 'headlines.jsonl': { rows: all, schema: SCHEMA }, 'coverage.json': { json: { first: dates[0] || null, last: dates[dates.length - 1] || null, dates, missing: miss } } },
  });
}
// labels as they were known at time T: for each story, the row from the latest brief generated at or before T.
// A story first seen before any brief existed has no label until its first brief (returned with late_label: true if includeLate).
function knownAt(rows, T, { includeLate = false } = {}) {
  const best = new Map();
  for (const r of rows) {
    if (r.first_seen_at > T) continue;
    if (r.brief_generated_at <= T) { const p = best.get(r.id); if (!p || p.late_label || r.brief_generated_at > p.brief_generated_at) best.set(r.id, { ...r, late_label: false }); }
    else if (includeLate && !best.has(r.id)) best.set(r.id, { ...r, late_label: true });
  }
  return [...best.values()];
}
module.exports = { run, rowsOfBrief, knownAt, missingDays, SCHEMA };
if (require.main === module) { const m = run(); console.log('headlines:', m.status, '|', m.notes.join(' | ')); process.exit(m.status === 'ok' ? 0 : 1); }
