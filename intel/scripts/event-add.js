#!/usr/bin/env node
'use strict';
// event-add.js: add one event to inputs/owner-tags.csv the safe way (no AI). first_seen_at is set to NOW, so an event added after it
// happened is honestly marked as added late.
// Usage (from intel):
//   node scripts/event-add.js "US PCE (Oct) and Q3 GDP" macro 2026-11-25T13:30Z "exact (release calendar)" "https://source" "note text"
//   args: tag, type (macro|crypto|stocks|politics|strategy), event time (ISO, UTC), precision, source url (or ""), note (or "")
// Rules: commas are replaced by semicolons (the CSV has no quoting); a duplicate tag + time is refused; direction stays blank until the +24 h read.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'inputs', 'owner-tags.csv');
const [tag, type, when, precision = '', url = '', note = ''] = process.argv.slice(2);
if (!tag || !type || !when) { console.error('usage: node scripts/event-add.js "tag" type 2026-11-25T13:30Z "precision" "url" "note"'); process.exit(1); }
const t = Date.parse(when);
if (isNaN(t)) { console.error('bad time: ' + when); process.exit(1); }
const clean = (s) => String(s).replace(/[\r\n]+/g, ' ').replace(/,/g, ';').trim();
const iso = (x) => new Date(x).toISOString().replace('.000Z', 'Z');
const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
if (rows.some((r) => { const c = r.split(','); return c[0].toLowerCase() === tag.toLowerCase() && Date.parse(c[3]) === t; })) { console.error('already in the CSV: ' + tag + ' ' + iso(t)); process.exit(2); }
const nowIso = iso(Date.now());
const late = t < Date.now() ? ' Added AFTER the event (first_seen is the add time).' : ' Added BEFORE the event.';
const row = [clean(tag), clean(type), '', iso(t), t < Date.now() ? '' : iso(t), nowIso, clean(precision), clean(url), (clean(note) + late).trim()].join(',');
fs.appendFileSync(file, row + '\n');
console.log('added: ' + row);
