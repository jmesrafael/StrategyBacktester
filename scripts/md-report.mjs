// md-report.mjs — turn study Markdown files (REPORT.md + RESULTS.md) into one admin report page in ledger/reports, in the style of the other reports.
//   node scripts/md-report.mjs <out.html> "<title>" <file1.md> [file2.md ...]
// Handles headings, paragraphs, lists, tables, bold, inline code and links. Negative numbers in table cells are shown red, positive green.
import { readFileSync, writeFileSync } from 'node:fs';
const [out, title, ...files] = process.argv.slice(2);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
const cell = (s) => { const h = inline(s.trim()); const t = s.trim().replace(/\*\*/g, ''); return /^[−-]\d/.test(t) ? `<span class="bad">${h}</span>` : /^\+\d/.test(t) && !/^\+0(\.0+)?%?$/.test(t) ? `<span class="good">${h}</span>` : h; };
function conv(md) {
  const L = md.split(/\r?\n/), o = []; let i = 0, sec = false;
  const open = () => { if (!sec) { o.push('<section>'); sec = true; } };
  while (i < L.length) {
    const l = L[i];
    if (/^# /.test(l)) { i++; continue; }   // page title comes from the CLI
    if (/^## /.test(l)) { if (sec) o.push('</section>'); o.push('<section>'); sec = true; o.push(`<h2>${inline(l.slice(3))}</h2>`); i++; continue; }
    open();
    if (/^#{3,4} /.test(l)) { const n = l.match(/^#+/)[0].length; o.push(`<h${n}>${inline(l.slice(n + 1))}</h${n}>`); i++; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < L.length && /^\|/.test(L[i])) rows.push(L[i++]); const split = (r) => r.replace(/^\||\|$/g, '').split('|');
      o.push('<div class="scroll"><table><tr>' + split(rows[0]).map((c) => `<th>${inline(c.trim())}</th>`).join('') + '</tr>' + rows.slice(2).map((r) => '<tr>' + split(r).map((c) => `<td>${cell(c)}</td>`).join('') + '</tr>').join('') + '</table></div>'); continue; }
    if (/^\s*(-|\d+\.) /.test(l)) { const ord = /^\s*\d+\./.test(l), items = []; while (i < L.length && (/^\s*(-|\d+\.) /.test(L[i]) || (/^\s{2,}\S/.test(L[i]) && items.length))) { if (/^\s*(-|\d+\.) /.test(L[i])) items.push(L[i].replace(/^\s*(-|\d+\.) /, '')); else items[items.length - 1] += ' ' + L[i].trim(); i++; }
      o.push(`<${ord ? 'ol' : 'ul'}>` + items.map((x) => `<li>${inline(x)}</li>`).join('') + `</${ord ? 'ol' : 'ul'}>`); continue; }
    if (/^```/.test(l)) { i++; const b = []; while (i < L.length && !/^```/.test(L[i])) b.push(L[i++]); i++; o.push(`<pre>${esc(b.join('\n'))}</pre>`); continue; }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < L.length && L[i].trim() && !/^(#|\||\s*(-|\d+\.) |```)/.test(L[i])) p.push(L[i++]); o.push(`<p>${inline(p.join(' '))}</p>`);
  }
  if (sec) o.push('</section>');
  return o.join('\n');
}
const body = files.map((f, n) => (n ? '<h1 style="margin-top:40px;font-size:24px">Full tables</h1>\n' : '') + conv(readFileSync(f, 'utf8'))).join('\n');
const css = `:root{--bg:#f6f7f9;--card:#fff;--ink:#111827;--mut:#6b7280;--line:#e5e7eb;--good:#15803d;--bad:#b91c1c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 'Segoe UI',system-ui,Arial,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-right,0px)) 60px max(16px,env(safe-area-inset-left,0px))}
h1{font-size:30px;margin:0 0 6px;line-height:1.2}h2{font-size:22px;margin:0 0 8px;padding-top:6px;border-top:3px solid var(--ink)}h3{font-size:17px;margin:22px 0 8px}h4{font-size:14.5px;margin:16px 0 6px}
p{margin:8px 0}.muted{color:var(--mut)}section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:22px;margin:22px 0}
.scroll{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--mut);padding:7px 9px;border-bottom:2px solid var(--ink);vertical-align:bottom}
td{padding:6px 9px;border-bottom:1px solid var(--line);vertical-align:top}.good{color:var(--good);font-weight:600}.bad{color:var(--bad);font-weight:600}
code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12.5px}pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow-x:auto}ul,ol{padding-left:22px}li{margin:4px 0}
@media (max-width:640px){section{padding:14px}h1{font-size:24px}}`;
writeFileSync(out, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${esc(title)} · Lucid'io</title><style>${css}</style></head><body><div class="wrap">
<h1>${esc(title)}</h1><p class="muted">Research study · Nov 19, 2026 · backtest on Binance 4h candles, Jan 2020 to Nov 2026. Hindsight applies: the rules and coins were chosen on this same history.</p>
${body}
</div></body></html>`);
console.log('wrote', out);
