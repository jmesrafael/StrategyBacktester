// bb1h-1000.js — 1h bb-core (x4 lengths), 5 bot coins only, start ₱1,000 on 1 Jan 2020; live tiers (thresholds in pesos @63), ₱3,150 cap per trade. Year + month tables.
const fs=require('fs');const BB=require('../../../bb-core/lucidio-core.js');
const FIVE=['SOL','ZEC','NEAR','ADA','GALA'],FX=63,START=1000,CAP=50*FX;
const tier=e=>e>=1000*FX?.015:e>=500*FX?.02:.025;
const get=(dir,cfg)=>{const a=[];for(const c of FIVE){const B=JSON.parse(fs.readFileSync(`${dir}/${c}.json`)).map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]}));a.push(...BB.backtest(B,cfg).trades.map(t=>({...t,coin:c})))}return a.sort((a,b)=>a.tExit-b.tExit)};
const T1=get('data1h',{bbLen:80,maxBars:192,trendLen:800,interval:3600,warmup:802}),T4=get('data4h',{});
const P=x=>'₱'+Math.round(x).toLocaleString('en-US');
function run(tr){let e=START,pk=e;const m={},y={},mt={},dd={};let worst=0;
 for(const t of tr){const d=new Date(t.tExit*1000),Y=d.getUTCFullYear(),M=d.getUTCMonth(),k=Y+'-'+M;const e0=e;e*=1+Math.min(tier(e),CAP/e)*t.R;pk=Math.max(pk,e);worst=Math.min(worst,e/pk-1);
  m[k]=m[k]||{s:e0,n:0,R:0};m[k].e=e;m[k].n++;m[k].R+=t.R;y[Y]=y[Y]||{s:e0,n:0,R:0};y[Y].e=e;y[Y].n++;y[Y].R+=t.R}
 return{m,y,end:e,worst}}
const A=run(T1),B=run(T4);
console.log(`1h bb-core · 5 coins (SOL ZEC NEAR ADA GALA) · start ${P(START)} · ${T1.length} trades · ends ${P(A.end)} · worst drop ${(A.worst*100).toFixed(0)}%  (4h bb-core same start: ${P(B.end)}, ${(B.worst*100).toFixed(0)}%)\n`);
console.log('| Year | Trades | R | Start | End | Gain | 4h bb-core end |\n|---|---|---|---|---|---|---|');
for(const Y of [2020,2021,2022,2023,2024,2025,2026]){const a=A.y[Y],b=B.y[Y];console.log(`| ${Y}${Y===2026?' (to Nov 5)':''} | ${a.n} | ${a.R.toFixed(0)} | ${P(a.s)} | ${P(a.e)} | ${((a.e/a.s-1)*100).toFixed(0)}% | ${P(b.e)} |`)}
const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
console.log('\nMonth-end balance (₱) and monthly R · trades\n| Year | '+mn.join(' | ')+' |\n|---|'+mn.map(()=>'---|').join(''));
let last=START;for(const Y of [2020,2021,2022,2023,2024,2025,2026]){const cells=[];for(let M=0;M<12;M++){const x=A.m[Y+'-'+M];if(x){last=x.e;cells.push(`${Math.round(x.e).toLocaleString('en-US')}<br>${x.R>=0?'+':''}${x.R.toFixed(0)}R · ${x.n}`)}else cells.push(Y===2026&&M>10||(Y===2020&&M<0)?'':`${Math.round(last).toLocaleString('en-US')}<br>0R · 0`)}console.log(`| ${Y} | ${cells.join(' | ')} |`)}
console.log('\n2026 month-by-month\n| Month | Trades | R | Start | End | Change |\n|---|---|---|---|---|---|');for(let M=0;M<11;M++){const x=A.m['2026-'+M];if(x)console.log(`| ${mn[M]}${M===10?' (to 5th)':''} | ${x.n} | ${x.R.toFixed(0)} | ${P(x.s)} | ${P(x.e)} | ${((x.e/x.s-1)*100).toFixed(0)}% |`)}
const neg=Object.values(A.m).filter(x=>x.e<x.s).length;console.log('\nmonths with a loss:',neg,'of',Object.keys(A.m).length);
