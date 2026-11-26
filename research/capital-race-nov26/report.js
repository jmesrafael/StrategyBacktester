// report.js - results.json -> RESULTS.md + report.html (growth curves, falls, every table). Run after run.js.
'use strict';
const fs = require('fs');
const R = require('./results.json');
const NAME = Object.fromEntries(R.meta.strats.map((s) => [s.id, s.name])), IDS = R.meta.strats.map((s) => s.id);
const PLOT = ['bb1h', 'bb4', 'wide', 'ichi', 'vol'];   // fixed order = fixed colour
const UNI = [['live6', '6 live coins', 'SOL NEAR ADA GALA ZEC ARB'], ['main', '12 main coins', R.meta.universes.main.join(' ')], ['hold', '12 hold-out coins', R.meta.universes.hold.join(' ')], ['all24', 'All 24 coins', 'main + hold-out']];
const money = (v) => (v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(1) + 'k' : Math.round(v).toLocaleString('en-US'));
const P = (v) => '₱' + money(v), pc = (v, d = 0) => (100 * v).toFixed(d) + '%', f2 = (v) => v.toFixed(2);
const rank = (u, fn) => [...IDS].sort((a, b) => fn(R.res[u][b]) - fn(R.res[u][a]));

const head = (u) => ({
  head: ['Rank', 'Strategy', 'Ends with', 'Worst fall', 'Ends with, same worst fall (40%)', 'Middle 12 months', 'Bad 12 months (1 in 10)', 'Profit factor', 'Win rate', 'Sharpe', 'Trades'],
  rows: rank(u, (o) => o.real.end).map((id, i) => { const o = R.res[u][id], r = o.real; return [String(i + 1), NAME[id], P(r.end), pc(r.mdd), P(o.fall40.end), P(o.w.med), P(o.w.p10), f2(r.pf), pc(r.win), f2(r.sharpe), r.taken.toLocaleString('en-US')]; }),
});
const full = (u) => ({
  head: ['Measure', ...rank(u, (o) => o.real.end).map((i) => NAME[i])],
  rows: [['Ends with', (o) => P(o.real.end)], ['Growth per year', (o) => pc(o.real.cagr)], ['Worst fall (open trades, hourly)', (o) => pc(o.real.mdd)], ['Worst fall (closed trades)', (o) => pc(o.real.cdd)], ['Growth per year ÷ worst fall', (o) => o.real.calmar.toFixed(1)],
    ['Sharpe', (o) => f2(o.real.sharpe)], ['Sortino', (o) => f2(o.real.sortino)], ['Profit factor (money)', (o) => f2(o.real.pf)], ['Win rate', (o) => pc(o.real.win)], ['Trades taken', (o) => o.real.taken.toLocaleString('en-US')], ['Skipped (below minimum / no margin)', (o) => String(o.real.skipped)],
    ['Total R (before sizing)', (o) => Math.round(o.R).toLocaleString('en-US')], ['Losing months', (o) => pc(o.real.losingMonths)], ['Worst month', (o) => pc(o.real.worstMonth)], ['Longest time under old high (days)', (o) => Math.round(o.real.underDays).toLocaleString('en-US')],
    ['12-month runs: middle', (o) => P(o.w.med)], ['12-month runs: bad (1 in 10)', (o) => P(o.w.p10)], ['12-month runs: worst', (o) => P(o.w.worst)], ['12-month runs: best', (o) => P(o.w.best)], ['12-month runs ending in profit', (o) => pc(o.w.profitable)], ['12-month runs: middle fall', (o) => pc(o.w.medDD)], ['12-month runs: deepest fall', (o) => pc(o.w.worstDD)],
    ['Start Jan 2024: ends with / fall', (o) => `${P(o.since2024.end)} / ${pc(o.since2024.mdd)}`], ['Start Jan 2026: ends with / fall', (o) => `${P(o.since2026.end)} / ${pc(o.since2026.mdd)}`],
    ['Check: double fees and slippage', (o) => `${P(o.two.end)} / ${pc(o.two.mdd)}`], ['Check: no order minimums', (o) => `${P(o.ideal.end)} / ${pc(o.ideal.mdd)}`], ['Check: size on open-trade value', (o) => `${P(o.equity.end)} / ${pc(o.equity.mdd)}`],
    ['Same worst fall 40%: risk used (x live)', (o) => f2(o.fall40.k)], ['Same worst fall 40%: growth per year', (o) => pc(o.fall40.cagr)],
  ].map(([n, fn]) => [n, ...rank(u, (o) => o.real.end).map((i) => fn(R.res[u][i]))]),
});
const years = (u) => ({ head: ['Strategy', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], rows: rank(u, (o) => o.real.end).map((id) => [NAME[id], ...Object.values(R.res[u][id].years).map((y) => `${P(y.end)} (-${pc(y.mdd)})`)]) });
const summary = { head: ['Strategy', ...UNI.flatMap(([, n]) => [n + ': ends with', 'fall'])], rows: rank('live6', (o) => o.real.end).map((id) => [NAME[id], ...UNI.flatMap(([u]) => [P(R.res[u][id].real.end), pc(R.res[u][id].real.mdd)])]) };
const same = { head: ['Strategy', ...UNI.map(([, n]) => n)], rows: rank('live6', (o) => o.fall40.end).map((id) => [NAME[id], ...UNI.map(([u]) => P(R.res[u][id].fall40.end))]) };
const checks = { head: ['Figure in the repo', 'Quoted: ends / fall / Sharpe', 'This run, same settings'], rows: R.checks.map((c) => [c.name, `${P(c.quoted.end)} / ${pc(c.quoted.dd, 1)} / ${f2(c.quoted.sharpe)}`, `${P(c.here.end)} / ${pc(c.here.dd, 1)} / ${f2(c.here.sharpe)}`]) };

const NOTES = [
  'The quoted "BB-CORE 4H ₱5.03M" is the OLD rule set (2.0σ bands, 48 candles). The live bot runs v4; both are listed.',
  'BB-CORE 1H had already been tested on the 12 hold-out coins; it is included here.',
  'The hold-out coins were not used to tune, BUT ICHI-X4, VOL-MOM-2H and BB-1H-WIDE were kept partly because they did well on them. Their hold-out results are flattered; the BB-CORE, I-CORE and T-CORE ones are not picked that way.',
  'Ending amounts this large are backtest compounding with perfect fills at any size. Compare lines with each other; do not expect them.',
  'The same-fall column uses flat 2.5% risk scaled up or down, with no order minimums, so that the worst fall is 40% for every strategy. It hangs on one worst episode per strategy.',
  'None of these has a clean test on new data: the rules were chosen using this history.',
];
const HOW = `Identical for every strategy: ₱${R.meta.start.toLocaleString('en-US')} start (₱${R.meta.php} per US$), risk 2.5% of balance (2% from a US$500 peak, 1.5% from US$1,000), per-trade risk x 6 / number of coins (same total risk on every coin set), MEXC contract minimums and margin, fee 0.05% + slippage 0.02% per side, real funding, open trades valued every hour, Jan 1, 2020 to Nov 24, 2026. "12 months" = every start month, fresh ₱1,000.`;

const mdT = (t) => ['| ' + t.head.join(' | ') + ' |', '|' + '---|'.repeat(t.head.length), ...t.rows.map((r) => '| ' + r.join(' | ') + ' |'), ''].join('\n');
fs.writeFileSync(__dirname + '/RESULTS.md', ['# Every strategy, one identical setup: ending capital (Nov 26, 2026)', '', HOW, '', ...NOTES.map((n) => '- ' + n), '',
  '## Ending capital and worst fall, all coin sets', '', mdT(summary), '## Ending capital when every strategy takes the same worst fall (40%)', '', mdT(same),
  ...UNI.flatMap(([u, n, c]) => [`## ${n}`, '', c, '', mdT(head(u)), '### Every measure', '', mdT(full(u)), '### Each year: fresh ₱1,000 on Jan 1 (worst fall inside the year)', '', mdT(years(u))]),
  '## Check against the quoted figures', '', mdT(checks), 'Scripts: `run.js` (numbers), `report.js` (this file and `report.html`).', ''].join('\n'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const tbl = (t) => `<div class="scroll"><table><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const det = (h, b) => `<details><summary>${esc(h)}</summary>${b}</details>`;
const curves = Object.fromEntries(UNI.map(([u]) => [u, PLOT.map((id) => ({ id, name: NAME[id], pts: R.res[u][id].curve, falls: R.res[u][id].falls }))]));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capital Race</title><style>
:root{--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e1e0d9;--axis:#c3c2b7;--s0:#2a78d6;--s1:#eb6834;--s2:#1baf7a;--s3:#eda100;--s4:#e87ba4}
@media (prefers-color-scheme:dark){:root{--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;--axis:#383835;--s0:#3987e5;--s1:#d95926;--s2:#199e70;--s3:#c98500;--s4:#d55181}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1120px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin:30px 0 8px}p,li{color:var(--ink2)}
.tabs,.key{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}button{font:inherit;font-size:13px;background:var(--surface);color:var(--ink);border:1px solid var(--grid);border-radius:8px;padding:6px 12px;cursor:pointer}
.tabs button[aria-pressed="true"]{border-color:var(--ink);font-weight:600}.key button[aria-pressed="false"]{opacity:.4}.key i{display:inline-block;width:14px;height:3px;border-radius:2px;margin-right:7px;vertical-align:middle}
.card{background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:10px;position:relative}svg{width:100%;height:auto;display:block}svg text{fill:var(--ink2);font-size:11px}
.gl{stroke:var(--grid)}.line{fill:none;stroke-width:2;stroke-linejoin:round}.cross{stroke:var(--axis)}
.falls{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:10px}.falls figcaption{font-size:13px}figure{margin:0}
#tip{position:fixed;pointer-events:none;background:var(--surface);border:1px solid var(--axis);border-radius:8px;padding:6px 10px;font-size:12px;display:none;white-space:nowrap}#tip i{display:inline-block;width:10px;height:3px;margin-right:6px;vertical-align:middle}
.scroll{overflow-x:auto;border:1px solid var(--grid);border-radius:10px;background:var(--surface);margin:8px 0}table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
th,td{padding:6px 10px;border-bottom:1px solid var(--grid);text-align:right;white-space:nowrap}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2){text-align:left}th{color:var(--ink2)}tr:last-child td{border-bottom:0}details{margin:10px 0}summary{cursor:pointer;font-weight:600}
</style></head><body><main><h1>Every strategy, one identical setup</h1><p>${esc(HOW)}</p><ul>${NOTES.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
<h2>Ending capital and worst fall</h2>${tbl(summary)}<h2>Ending capital when every strategy takes the same worst fall (40%)</h2>${tbl(same)}
<h2>The backtest: growth of ₱1,000</h2><div class="tabs" id="tabs"></div><div class="key" id="key"></div><div class="card"><svg id="eq" viewBox="0 0 1080 430" role="img" aria-label="Account value over time, log scale"></svg></div>
<p>Log scale: each gridline is ten times the one below. Weekly points for the growth line; the fall panels show the deepest hourly fall inside each week. The chart shows the five strategies in your list.</p>
<h2>Fall from the highest point</h2><div class="falls" id="falls"></div>
<div id="sections">${UNI.map(([u, n, c]) => `<section data-u="${u}"><h2>${esc(n)}</h2><p>${esc(c)}</p>${tbl(head(u))}${det('Every measure', tbl(full(u)))}${det('Each year on its own', tbl(years(u)))}</section>`).join('')}</div>
${det('Check: the quoted figures, re-run with their settings', tbl(checks))}</main><div id="tip"></div>
<script>
const D=${JSON.stringify(curves)},U=${JSON.stringify(UNI.map(([u, n]) => [u, n]))},PLOT=${JSON.stringify(PLOT)};let u='live6';const hidden=new Set();
const $=(i)=>document.getElementById(i),col=(id)=>'var(--s'+PLOT.indexOf(id)+')';
const money=(v)=>'₱'+(v>=1e9?(v/1e9).toFixed(1)+'B':v>=1e6?(v/1e6).toFixed(v<1e7?2:1)+'M':v>=1e4?Math.round(v/1e3)+'k':Math.round(v).toLocaleString('en-US'));
const date=(t)=>new Date(t*1000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
function draw(){
  $('tabs').innerHTML=U.map(([k,n])=>'<button data-k="'+k+'" aria-pressed="'+(k===u)+'">'+n+'</button>').join('');
  $('key').innerHTML=D[u].map(s=>'<button data-s="'+s.id+'" aria-pressed="'+!hidden.has(s.id)+'"><i style="background:'+col(s.id)+'"></i>'+s.name+' · '+money(s.pts.at(-1)[1])+'</button>').join('');
  const S=D[u].filter(s=>!hidden.has(s.id)),W=1080,H=430,L=62,Rm=12,T=10,B=26;
  if(!S.length){$('eq').innerHTML='';return}
  const x0=S[0].pts[0][0],x1=S[0].pts.at(-1)[0],vals=S.flatMap(s=>s.pts.map(p=>p[1]));
  const lo=Math.floor(Math.log10(Math.max(1,Math.min(...vals)))),hi=Math.ceil(Math.log10(Math.max(...vals)));
  const X=t=>L+(t-x0)/(x1-x0)*(W-L-Rm),Y=v=>T+(1-(Math.log10(Math.max(v,1))-lo)/(hi-lo))*(H-T-B);
  let g='';for(let e=lo;e<=hi;e++){const y=Y(10**e);g+='<line class="gl" x1="'+L+'" x2="'+(W-Rm)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end">'+money(10**e)+'</text>'}
  for(let yr=2021;yr<=2026;yr++){const x=X(Date.UTC(yr,0,1)/1000);g+='<line class="gl" x1="'+x+'" x2="'+x+'" y1="'+T+'" y2="'+(H-B)+'"/><text x="'+x+'" y="'+(H-8)+'" text-anchor="middle">'+yr+'</text>'}
  g+=S.map(s=>'<path class="line" style="stroke:'+col(s.id)+'" d="'+s.pts.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join('')+'"/>').join('');
  g+='<line class="cross" id="cross" y1="'+T+'" y2="'+(H-B)+'" visibility="hidden"/>';$('eq').innerHTML=g;
  $('eq').onmousemove=e=>{const r=$('eq').getBoundingClientRect(),px=(e.clientX-r.left)/r.width*W,t=x0+(px-L)/(W-L-Rm)*(x1-x0);if(t<x0||t>x1)return leave();
    const i=S[0].pts.reduce((b,p,j)=>Math.abs(p[0]-t)<Math.abs(S[0].pts[b][0]-t)?j:b,0),c=$('cross');c.setAttribute('x1',X(S[0].pts[i][0]));c.setAttribute('x2',X(S[0].pts[i][0]));c.setAttribute('visibility','visible');
    const tip=$('tip');tip.innerHTML='<b>'+date(S[0].pts[i][0])+'</b><br>'+S.map(s=>[s,s.pts[i][1]]).sort((a,b)=>b[1]-a[1]).map(([s,v])=>'<i style="background:'+col(s.id)+'"></i>'+s.name+' '+money(v)).join('<br>');
    tip.style.display='block';tip.style.left=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=Math.min(e.clientY+14,innerHeight-tip.offsetHeight-8)+'px'};
  $('eq').onmouseleave=leave;
  const falls=D[u].map(s=>({s,d:s.falls})),deep=Math.max(...falls.map(f=>Math.max(...f.d.map(p=>p[1]))));
  $('falls').innerHTML=falls.map(({s,d})=>{const w=340,h=110,l=32,fx=t=>l+(t-x0)/(x1-x0)*(w-l-4),fy=v=>6+v/deep*(h-22);
    return '<figure class="card"><figcaption>'+s.name+' · deepest '+Math.round(100*Math.max(...d.map(p=>p[1])))+'%</figcaption><svg viewBox="0 0 '+w+' '+h+'">'+[0,.5,1].map(k=>'<line class="gl" x1="'+l+'" x2="'+(w-4)+'" y1="'+fy(k*deep)+'" y2="'+fy(k*deep)+'"/><text x="'+(l-4)+'" y="'+(fy(k*deep)+4)+'" text-anchor="end">'+(k?'-':'')+Math.round(100*k*deep)+'%</text>').join('')+
    '<path style="fill:'+col(s.id)+'" d="M'+l+' '+fy(0)+d.map(p=>'L'+fx(p[0]).toFixed(1)+' '+fy(p[1]).toFixed(1)).join('')+'L'+(w-4)+' '+fy(0)+'Z"/><text x="'+l+'" y="'+(h-3)+'">2020</text><text x="'+(w-4)+'" y="'+(h-3)+'" text-anchor="end">Nov 2026</text></svg></figure>'}).join('');
  document.querySelectorAll('#sections section').forEach(s=>s.style.display=s.dataset.u===u?'':'none');
}
function leave(){$('tip').style.display='none';const c=$('cross');if(c)c.setAttribute('visibility','hidden')}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.k)u=b.dataset.k;if(b.dataset.s)hidden.has(b.dataset.s)?hidden.delete(b.dataset.s):hidden.add(b.dataset.s);draw()});
draw();
</script></body></html>`;
fs.writeFileSync(__dirname + '/report.html', html);
console.log(mdT(summary)); console.log(mdT(same)); console.log(mdT(head('live6'))); console.log(mdT(head('hold'))); console.log(mdT(years('hold'))); console.log(mdT(checks));
