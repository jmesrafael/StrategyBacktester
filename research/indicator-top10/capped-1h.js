// capped-1h.js — realistic account on the 5 bot coins: start $250 (₱15,750 @63), live-bot tiers, ₱3,150 risk cap; 1h candidates vs 4h bb-core/I-Core and 1h-scaled bb-core/I-Core.
process.env.IV='3600';process.env.TREND='800';process.env.DATADIR='data1h';
const fs=require('fs');const {run,CFG}=require('./batch1h.js');const {account}=require('./baseline');
const BB=require('../../../bb-core/lucidio-core.js'),IC=require('../../js/icore-core.js');
const FIVE=['SOL','ZEC','NEAR','ADA','GALA'],ALL=[...FIVE,'BTC','ETH'],FX=63,START=250*FX,CAP=50*FX,IV=3600;
const load=(dir,c)=>JSON.parse(fs.readFileSync(`${dir}/${c}.json`)).map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]}));
const bots=(core,dir,cfg)=>{const a=[];for(const c of ALL)a.push(...core.backtest(load(dir,c),cfg).trades.map(t=>({...t,coin:c})));return a};
const pick=(ind,lab,f,i,t)=>run(ind,CFG.find(c=>c[0]===ind&&c[1]===lab)[2],f,i,t).trades;
const S={'4h bb-core (live)':bots(BB,'data4h',{}),'4h I-Core (live)':bots(IC,'data4h',{}),
 '1h bb-core scaled':bots(BB,'data1h',{bbLen:80,trendLen:800,maxBars:192,interval:3600,warmup:805}),
 '1h I-Core scaled':bots(IC,'data1h',{tenkan:36,kijun:104,senkouB:208,trendLen:800,maxBars:2400,interval:3600,warmup:805,cost:{fund:0.0000125}}),
 '1h TRIX120 zero f1 i2 t30':pick('TRIX','n120zero',true,2,30),'1h MACD 48-104-72 sigpos f1 t30':pick('MACD','48-104-72sigpos',true,2,30),
 '1h MACD 32-68-36 sigpos f1 t30':pick('MACD','32-68-36sigpos',true,2,30),'1h Keltner80x2 f1 t30':pick('Keltner','ema80x2',true,2,30),
 '1h Chandelier200x5 f1 t30':pick('Chandelier','n200x5',true,2,30),'1h Donchian400 f1 t30':pick('Donchian','n400',true,2,30),'1h CKSP 80-2-72 f1 t20':pick('CKSP','80-2-72',true,2,20)};
for(const k in S)S[k]=S[k].filter(t=>FIVE.includes(t.coin));
const tier=e=>e>=1000*FX?.015:e>=500*FX?.02:.025;
function sim(k,from,cap=CAP){const tr=S[k].filter(t=>t.tExit>=from).sort((a,b)=>a.tExit-b.tExit);let e=START,pk=e,dd=0;for(const t of tr){e*=1+Math.min(tier(e),cap/e)*t.R;pk=Math.max(pk,e);dd=Math.min(dd,e/pk-1)}return{end:e,dd}}
const P=x=>'₱'+Math.round(x).toLocaleString('en-US'),Y20=Date.UTC(2020,0,1)/1000,Y23=Date.UTC(2023,0,1)/1000,Y26=Date.UTC(2026,0,1)/1000;
console.log('5 bot coins · start',P(START),'· cap',P(CAP),'\n| strategy | trades | R total | exp R | PF | win | avg hold | 2020-26 ends | worst drop | 2023-26 ends | worst drop | 2026 only | worst drop |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for(const k in S){const a=account(S[k]),A=sim(k,Y20),B=sim(k,Y23),C=sim(k,Y26),iv=k.startsWith('4h')?4:1;const hold=S[k].reduce((s,t)=>s+(t.bars||0),0)/S[k].length*iv/24;
 console.log(`| ${k} | ${a.n} | ${a.totR.toFixed(0)} | ${a.expR.toFixed(2)} | ${a.pf.toFixed(2)} | ${(a.win*100).toFixed(0)}% | ${hold.toFixed(1)}d | ${P(A.end)} | ${(A.dd*100).toFixed(0)}% | ${P(B.end)} | ${(B.dd*100).toFixed(0)}% | ${P(C.end)} | ${(C.dd*100).toFixed(0)}% |`)}
const yrs=[2020,2021,2022,2023,2024,2025,2026];console.log('\nR by year\n| strategy | '+yrs.join(' | ')+' |');
for(const k in S){const m={};S[k].forEach(t=>{const y=new Date(t.tExit*1000).getUTCFullYear();m[y]=(m[y]||0)+t.R});console.log(`| ${k} | ${yrs.map(y=>(m[y]||0).toFixed(0)).join(' | ')} |`)}
console.log('\nBy coin R\n| strategy | '+FIVE.join(' | ')+' |');for(const k in S)console.log(`| ${k} | ${FIVE.map(c=>S[k].filter(t=>t.coin===c).reduce((s,t)=>s+t.R,0).toFixed(0)).join(' | ')} |`);
console.log('\n2026 monthly R (Jan..Nov5) for 1h candidates + 4h bb-core');for(const k in S){const m=Array(11).fill(0);S[k].filter(t=>t.tExit>=Y26).forEach(t=>m[new Date(t.tExit*1000).getUTCMonth()]+=t.R);console.log(k.padEnd(34),m.map(x=>x.toFixed(0).padStart(4)).join(''))}
