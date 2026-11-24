#!/usr/bin/env node
'use strict';
// event-scan.js: MANUAL helper (run it on purpose, like a button). Reads the newest Pulse briefs (crypto-news/data/briefs, headlines only,
// public text, nothing about our book) and asks the free models (FreeAPIByMe gateway) which dated events are coming or just happened.
// It writes a REVIEW file: inputs/event-watch/candidates-<date>.md. It never edits owner-tags.csv. The owner (or Claude) checks each
// line against a source and adds the real ones with:  node scripts/event-add.js ...
// The AI text is unverified. Nothing else in intel reads this file. Free quota is small: one run = 1 to a few requests.
// Usage (from intel):  node scripts/event-scan.js [--days 2] [--max 60]
const fs = require('fs');
const path = require('path');
const { chat } = require('./fbm-client');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const days = +arg('days', 2), max = +arg('max', 30);
const dir = path.join(__dirname, '..', '..', '..', 'crypto-news', 'data', 'briefs');
const dates = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')).slice(0, days);
const seen = new Set(), lines = [];
for (const d of dates) {
  const b = JSON.parse(fs.readFileSync(path.join(dir, d + '.json'), 'utf8'));
  for (const x of [...(b.pinned || []), ...(b.highlights || []), ...(b.roundups || [])]) {
    const t = (x.title || '').trim(); if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    lines.push(`- [${d}] ${t}${x.summary ? ' :: ' + String(x.summary).replace(/\s+/g, ' ').slice(0, 90) : ''}`);
  }
}
const items = lines.slice(0, max);
const known = fs.readFileSync(path.join(__dirname, '..', 'inputs', 'owner-tags.csv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map((r) => r.split(',')[0]);

const prompt = `You help a crypto trader keep an event calendar. Below are news headlines (date in brackets).
List events that move crypto markets and have a date or time stated IN THE TEXT: scheduled releases (CPI, PCE, FOMC, jobs), token unlocks, ETF decisions, court dates, index changes, big company events, or a sudden market move that already happened.
Rules: use ONLY the text below; never invent a date; if a time is not stated write null; one line per event; maximum 8 events.
Answer with a JSON array only, no other text. Each item: {"tag":"short name","type":"macro|crypto|stocks|politics","when":"ISO UTC like 2026-11-25T13:30Z or a date or null","what":"one sentence","headline_index":number}

Headlines:
${items.map((l, i) => i + '. ' + l).join('\n')}`;

(async () => {
  const cache = path.join(__dirname, '..', 'inputs', 'event-watch', `candidates-${new Date().toISOString().slice(0, 10)}.md`);
  if (fs.existsSync(cache) && !process.argv.includes('--force')) { console.log('Already scanned today (no quota spent). Use --force to scan again. ' + cache); return; }
  console.log(`headlines: ${items.length} from ${dates.join(', ')}`);
  const log = (m) => console.log('  ' + m);
  const res = await chat({ messages: [{ role: 'user', content: prompt }], maxTokens: 3000, timeoutMs: 90000, maxAttempts: 3, extra: { reasoning: { enabled: false } }, log });
  let arr = [];
  const m = res.text.match(/\[[\s\S]*\]/);
  try { arr = JSON.parse(m ? m[0] : res.text); } catch { arr = null; }
  const today = new Date().toISOString().slice(0, 10);
  const out = [`# Event candidates ${today} (AI-read headlines, UNVERIFIED)`, '',
    `Made by \`node scripts/event-scan.js\` with model \`${res.model}\` (account ${res.account || 'n/a'}) from ${items.length} headlines of ${dates.join(', ')}. The free models cannot browse; they only re-read the headlines. Check every line against a real source before adding it.`,
    'Add a real one: `node scripts/event-add.js "tag" type 2026-11-25T13:30Z "precision" "url" "note"`', ''];
  if (!arr) out.push('The model did not return valid JSON. Raw reply:', '', '```', res.text.slice(0, 3000), '```');
  else {
    out.push('| Tag | Type | When (as stated) | What | Headline | Already in CSV? |', '|---|---|---|---|---|---|');
    for (const e of arr) {
      const tag = String(e.tag || '').replace(/\|/g, '/');
      const dup = known.some((k) => k && (k.toLowerCase().includes(tag.toLowerCase().slice(0, 12)) || tag.toLowerCase().includes(k.toLowerCase().slice(0, 12)))) ? 'maybe' : 'no';
      const h = Number.isInteger(e.headline_index) && items[e.headline_index] ? items[e.headline_index].slice(0, 110).replace(/\|/g, '/') : '';
      out.push(`| ${tag} | ${e.type || ''} | ${e.when || 'not stated'} | ${String(e.what || '').replace(/\|/g, '/')} | ${h} | ${dup} |`);
    }
  }
  out.push('', `Attempts: ${res.tried.map((t) => `${t.model.split('/').pop()} ${t.status} ${(t.ms / 1000).toFixed(1)}s`).join('; ')}`);
  const f = path.join(__dirname, '..', 'inputs', 'event-watch', `candidates-${today}.md`);
  fs.writeFileSync(f, out.join('\n') + '\n');
  console.log('written ' + f);
  console.log(out.slice(4).join('\n'));
})().catch((e) => { console.error('scan failed: ' + e.message); process.exit(1); });
