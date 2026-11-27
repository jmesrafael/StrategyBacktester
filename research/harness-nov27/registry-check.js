// node registry-check.js <keyword...> : rows of TESTED-STRATEGIES.md matching ALL keywords (case-insensitive).
// Exit 1 if a REJECTED row matches, 2 on bad usage.
'use strict';
const fs = require('fs'), path = require('path');
const kw = process.argv.slice(2).map((s) => s.toLowerCase());
if (!kw.length) { console.error('usage: node registry-check.js <keyword...>'); process.exit(2); }
const rows = fs.readFileSync(path.join(__dirname, '..', 'TESTED-STRATEGIES.md'), 'utf8').split('\n').filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l));
let rejected = false, hits = 0;
for (const l of rows) {
  if (!kw.every((k) => l.toLowerCase().includes(k))) continue;
  hits++;
  const c = l.split('|').slice(1, -1).map((s) => s.trim());
  const verdict = c.find((x) => /^(LIVE|PAPER|LEAD|REJECTED|INFO|UNPROVEN)/i.test(x)) || '?';
  const ev = [...new Set((l.match(/`[^`]*[\/.][^`]*`/g) || []).map((s) => s.replace(/`/g, '')))];
  if (/^REJECTED/i.test(verdict)) rejected = true;
  console.log(`- ${(/^\d{4}-/.test(c[0]) ? c[0] + ' ' + c[1] : c[0]).replace(/\*\*/g, '').slice(0, 110)}\n    verdict: ${verdict.slice(0, 140)}\n    evidence: ${ev.join(', ') || 'n/a'}`);
}
console.log(`${hits} matching row(s)${rejected ? '; REJECTED match -> exit 1' : ''}`);
process.exit(rejected ? 1 : 0);
