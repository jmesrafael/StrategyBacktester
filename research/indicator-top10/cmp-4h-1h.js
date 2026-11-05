// cmp-4h-1h.js — bb-core 4h (live) vs 1h (x4 lengths), 5 bot coins, ₱63/$, live tiers, ₱3,150 cap.
const fs=require('fs');const {account}=require('./baseline');const BB=require('../../../bb-core/lucidio-core.js');
const FIVE=['SOL','ZEC','NEAR','ADA','GALA'],FX=63,CAP=50*FX,SPLIT=Date.UTC(2023,0,1)/1000,Y26=Date.UTC(2026,0,1)/1000;
const tier=e=>e>=1000*FX?.015:e>=500*FX?.02:.025;
const get=(dir,cfg)=>{const a=[];for(const c of FIVE){const B=JSON.parse(fs.readFileSync(`${dir}/${c}.json`)).map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]}));a.push(...BB.backtest(B,cfg).trades.map(t=>({...t,coin:c})))}return a.sort((a,b)=>a.tExit-b.tExit)};
const S={'4h':get('data4h',{}),'1h':get('data1h',{bbLen:80,maxBars:192,trendLen:800,interval:3600,warmup:802})};
const bal=(tr,start,from=0)=>{let e=start,pk=e,dd=0;for(const t of tr.filter(t=>t.tExit>=from)){e*=1+Math.min(tier(e),CAP/e)*t.R;pk=Math.max(pk,e);dd=Math.min(dd,e/pk-1)}return[e,dd]};
const P=x=>'₱'+Math.round(x).toLocaleString('en-US'),f=(x,d=0)=>x.toFixed(d);
const iv={'4h':4,'1h':1},A={};for(const k in S)A[k]=account(S[k]);
const row=(l,g)=>console.log(`| ${l} | ${g('4h')} | ${g('1h')} |`);
console.log('| | 4h | 1h |\n|---|---|---|');
row('Trades (2020-Nov 2026)',k=>S[k].length);row('Trades per month',k=>f(S[k].length/80.5,1));
row('Average hold',k=>f(S[k].reduce((s,t)=>s+t.bars,0)/S[k].length*iv[k]/24,1)+' days');
row('Win rate',k=>f(A[k].win*100)+'%');row('Avg R per trade',k=>f(A[k].expR,2));row('Total R',k=>f(A[k].totR));row('Profit factor',k=>f(A[k].pf,2));
row('R before 2023 / 2023+',k=>f(account(S[k],.025,0,SPLIT).totR)+' / '+f(account(S[k],.025,SPLIT).totR));
row('Flat 2.5% risk worst drop',k=>f(A[k].mdd*100)+'%');
for(const [l,s] of [['₱1,000',1000],['₱15,750 ($250)',15750]]){row(`Start ${l}: 2020-26 ends`,k=>P(bal(S[k],s)[0]));row(`Start ${l}: worst drop`,k=>f(bal(S[k],s)[1]*100)+'%');}
row('Fresh ₱15,750 on 1 Jan 2026: ends',k=>P(bal(S[k],15750,Y26)[0]));row('  2026 worst drop',k=>f(bal(S[k],15750,Y26)[1]*100)+'%');
const yrs=[2020,2021,2022,2023,2024,2025,2026];console.log('\nR by year\n| Year | 4h | 1h | 1h better? |\n|---|---|---|---|');
for(const y of yrs){const g=k=>S[k].filter(t=>new Date(t.tExit*1000).getUTCFullYear()===y).reduce((s,t)=>s+t.R,0);console.log(`| ${y} | ${f(g('4h'))} | ${f(g('1h'))} | ${g('1h')>g('4h')?'yes':'no'} |`)}
console.log('\nR by coin\n| Coin | 4h | 1h |\n|---|---|---|');for(const c of FIVE){const g=k=>S[k].filter(t=>t.coin===c).reduce((s,t)=>s+t.R,0);console.log(`| ${c} | ${f(g('4h'))} | ${f(g('1h'))} |`)}
const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'];console.log('\n2026 monthly R and trades\n| Month | 4h R | 4h trades | 1h R | 1h trades |\n|---|---|---|---|---|');
for(let m=0;m<11;m++){const g=k=>S[k].filter(t=>t.tExit>=Y26&&new Date(t.tExit*1000).getUTCMonth()===m);console.log(`| ${mn[m]} | ${f(g('4h').reduce((s,t)=>s+t.R,0))} | ${g('4h').length} | ${f(g('1h').reduce((s,t)=>s+t.R,0))} | ${g('1h').length} |`)}
const mon=k=>{const m={};S[k].forEach(t=>{const d=new Date(t.tExit*1000),key=d.getUTCFullYear()*12+d.getUTCMonth();m[key]=(m[key]||0)+t.R});return Object.values(m)};
console.log('\nMonthly R: months negative',...['4h','1h'].map(k=>{const m=mon(k);return k+': '+m.filter(x=>x<0).length+'/'+m.length+', worst '+f(Math.min(...m))+'R, median '+f(m.sort((a,b)=>a-b)[m.length>>1])+'R'}));
