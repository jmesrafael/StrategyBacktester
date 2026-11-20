// responsive-report.mjs — makes the A4-style report pages (backtest-data*.html) readable on a phone WITHOUT touching their print / PDF layout.
//   import { makeResponsive } from './responsive-report.mjs';  html = makeResponsive(html);          (idempotent: running it twice changes nothing)
//   node scripts/responsive-report.mjs <file.html> [more.html ...]                                    patches files in place
// Why: the pages are fixed A4 sheets. On a screen the sheet clips (overflow hidden) any wide table, chart text shrinks to nothing, numbers wrap in the
// middle ("+" on one line, "₱1,011,736" on the next) and the fixed "Download PDF" button covers the headline. This adds, for screens only:
//   - the sheet no longer clips; every table and chart sits in a sideways-scrolling box with a "Swipe sideways" hint when it does not fit
//   - numbers never break across lines; charts keep a readable minimum width; the monthly calendar keeps a readable size
//   - bigger body text and tighter padding on phones; the Download PDF button becomes a normal button at the top
import { readFileSync, writeFileSync } from 'node:fs';

export const RESP_MARK = 'data-responsive-report';

export const RESP_CSS = `/* responsive-layer-start (screens only; print and the PDF are untouched) */
@media screen {
  .page { overflow: visible; }
  .page *, .two > *, .kpis > *, .steps > * { min-width: 0; }
  .tw { max-width: 100%; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
  .swipe { display: none; }
  .tw.ov::-webkit-scrollbar { height: 6px; } .tw.ov::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
  td, th { overflow-wrap: normal; }
  td:not(:first-child) { white-space: nowrap; }
}
@media print { .swipe { display: none !important; } }
@media screen and (max-width: 900px) {
  .swipe { display: block; font-size: 11px; font-weight: 600; color: #475569; text-align: right; margin: 6px 0 3px; letter-spacing: .2px; }
}
@media screen and (max-width: 760px) {
  body { padding: 0 0 20px; }
  .dlbtn { position: static; display: block; margin: 12px 16px 0; text-align: center; box-shadow: none; }
  .page { margin: 0 0 14px; padding: 18px 14px 56px; }
  .cover-band { margin: -18px -14px 16px; padding: 26px 14px 18px; }
  h1 { font-size: 26px; } h2 { font-size: 20px; } h3 { font-size: 15px; }
  p, li { font-size: 14px; } .sub { font-size: 14px; } .note { font-size: 13.5px; } .step p { font-size: 13px; }
  .kpi { padding: 9px 11px; } .kpi .v { font-size: 19px; } .kpi .k { font-size: 10px; }
  .card { padding: 11px 12px; }
  table { font-size: 12.5px; } th { font-size: 10px; padding: 6px 7px; } td { padding: 6px 7px; }
  .tw > table { min-width: 100%; }
  .tw > table.cal { min-width: 540px; } table.cal td, table.cal th { font-size: 10px; padding: 6px 0; }
  .tw > svg { min-width: 560px; display: block; }
  .legend { flex-wrap: wrap; row-gap: 4px; }
  .yhead { flex-wrap: wrap; gap: 4px 10px; }
  div[style*="62px 1fr 190px"] { grid-template-columns: 52px 1fr !important; row-gap: 1px !important; }
  div[style*="62px 1fr 190px"] > :nth-child(3) { grid-column: 1 / -1; text-align: right; }
  .foot { font-size: 9px; }
}
@media screen and (max-width: 560px) {
  .two { grid-template-columns: 1fr !important; }
  .tw > svg { min-width: 500px; }
}
@media screen and (max-width: 420px) {
  .page { padding-left: 12px; padding-right: 12px; } .cover-band { margin-left: -12px; margin-right: -12px; padding-left: 12px; padding-right: 12px; }
  .kpis, .two { gap: 8px; } .kpi .v { font-size: 17px; }
  h1 { font-size: 24px; }
}
/* responsive-layer-end */
`;

export const RESP_JS = `(function () {
  var sel = '.page table, .page svg[viewBox]';
  document.querySelectorAll(sel).forEach(function (el) {
    if (el.parentNode.classList && el.parentNode.classList.contains('tw')) return;
    if (el.closest('svg') !== el && el.tagName.toLowerCase() === 'svg') return;
    if (el.tagName.toLowerCase() === 'svg' && el.getAttribute('width') !== '100%') return;   // charts only, not small icons
    var w = document.createElement('div'); w.className = 'tw'; el.parentNode.insertBefore(w, el); w.appendChild(el);
  });
  function check() {
    document.querySelectorAll('.tw').forEach(function (w) {
      var ov = w.scrollWidth > w.clientWidth + 2; w.classList.toggle('ov', ov);
      var h = w.previousElementSibling, has = h && h.classList && h.classList.contains('swipe');
      if (ov && !has) { h = document.createElement('div'); h.className = 'swipe'; h.textContent = 'Swipe sideways to see more \\u2192'; w.parentNode.insertBefore(h, w); }
      if (!ov && has) h.remove();
    });
  }
  check(); addEventListener('resize', check); addEventListener('load', check);
})();`;

export function makeResponsive(html) {
  // replace an older copy of the layer (so improvements reach pages already patched), then add the current one
  html = html.replace(/\/\* responsive-layer-start[\s\S]*?responsive-layer-end \*\/\n?/, '').replace(/<script data-responsive-report>[\s\S]*?<\/script>/, '');
  html = html.replace(/\n\/\* responsive layer \(screens only[\s\S]*?\n\}\n(?=<\/style>|\n\.dlbtn|$)/, '\n');
  if (!/<meta name="viewport"/i.test(html)) html = html.replace(/<head>/i, '<head><meta name="viewport" content="width=device-width, initial-scale=1">');
  html = html.replace('</style>', RESP_CSS + '</style>');
  html = html.replace('</body>', `<script ${RESP_MARK}>${RESP_JS}</script></body>`);
  return html;
}

if (process.argv[1] && process.argv[1].endsWith('responsive-report.mjs')) {
  for (const f of process.argv.slice(2)) { const a = readFileSync(f, 'utf8'), b = makeResponsive(a); if (a !== b) { writeFileSync(f, b); console.log('patched', f); } else console.log('already', f); }
}
