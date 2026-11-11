// edit(file, [[from, to, expectedCount], ...]) — exact string edits that STOP the build if a pattern is found a different number of times
// (same rule as bb-trail/apply-trail-patch.js). Handles files with CRLF line endings.
'use strict';
const fs = require('fs');
const NL = '\n', CRNL = '\r\n';
let total = 0;
function edit(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes(CRNL);
  for (let [a, b, want] of pairs) {
    if (crlf) { a = a.split(CRNL).join(NL).split(NL).join(CRNL); b = b.split(CRNL).join(NL).split(NL).join(CRNL); }
    const n = s.split(a).length - 1;
    if (n !== want) throw new Error(`${file}: expected ${want} of ${JSON.stringify(a.slice(0, 100))}, found ${n}`);
    s = s.split(a).join(b);
    total += n;
  }
  fs.writeFileSync(file, s);
}
module.exports = { edit, count: () => total };
