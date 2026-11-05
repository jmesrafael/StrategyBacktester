// capped-b2.js — realistic account: start $250 (₱15,750 @63), live-bot risk tiers, TOTAL risk cap $50/trade slot, 5 bot coins only; candidates from batch2 vs bb-core / I-Core.
process.env.COINS='SOL,ZEC,NEAR,ADA,GALA,BTC,ETH';
const fs=require('fs');const {run,CFG}=require('./batch2.js');const {account}=require('./baseline');const {COINS}=require('./rstrat.js');
const BB=require('../../../bb-core/lucidio-core.js'),IC=require('../../js/icore-core.js');
const FIVE=['SOL','ZEC','NEAR','ADA','GALA'],FX=63,START=250*FX,CAP=50*FX;
const bots=core=>{const all=[];for(const c of COINS){const B=JSON.parse(fs.readFileSync(`data4h/${c}.json`)).map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]}));all.push(...core.backtest(B).trades.map(t=>({...t,coin:c})))}return all};
const pick=(ind,lab,filt,kI,kT)=>{const [,, args]=CFG.find(c=>c[0]===ind&&c[1]===lab);return run(ind,args,filt,kI,kT).trades};
const S={'bb-core':bots(BB),'I-Core':bots(IC),
 'CKSP 10-1-9':pick('CKSP','10-1-9',true,2,14),'Donchian 20':pick('Donchian','n20',true,2,14),'Keltner 20x2':pick('Keltner','ema20x2',true,2,14),
 'TRIX 30 zero':pick('TRIX','n30zero',true,2,14),'MACD 8-17-9':pick('MACD','8-17-9sig',true,2,14),'MA Trend SMA200':null};
const {cfgRun}=require('./rstrat.js');S['MA Trend SMA200']=cfgRun('SMA','P',[200],true,true,2,14,'close','nextOpen').trades;
for(const k in S)S[k]=S[k].filter(t=>FIVE.includes(t.coin));
const tier=e=>e>=1000*FX?.015:e>=500*FX?.02:.025;
function sim(names,from){const n=names.length,subs=names.map(k=>({e:START/n,tr:S[k].filter(t=>t.tExit>=from)}));const ev=[];subs.forEach((s,i)=>s.tr.forEach(t=>ev.push([t.tExit,i,t.R])));ev.sort((a,b)=>a[0]-b[0]);
 let pk=START,dd=0;const ye={};for(const [tm,i,R] of ev){const e=subs[i].e;subs[i].e*=1+Math.min(tier(e),CAP/n/e)*R;const t=subs.reduce((s,x)=>s+x.e,0);pk=Math.max(pk,t);dd=Math.min(dd,t/pk-1);ye[new Date(tm*1000).getUTCFullYear()]=t}
 return{end:subs.reduce((s,x)=>s+x.e,0),dd,ye}}
const P=x=>'₱'+Math.round(x).toLocaleString('en-US');
const Y20=Date.UTC(2020,0,1)/1000,Y23=Date.UTC(2023,0,1)/1000,Y26=Date.UTC(2026,0,1)/1000;
console.log('5 bot coins, start',P(START),'cap',P(CAP),'\n| strategy | trades | R total | PF | win | 2020-26 ends | worst drop | 2023-26 ends | worst drop | 2026 only ends | worst drop |');
const row=(lab,c)=>{const t=c.flatMap(k=>S[k]);const a=account(c.length===1?S[c[0]]:t);const A=sim(c,Y20),B=sim(c,Y23),Cc=sim(c,Y26);
 console.log(`| ${lab} | ${t.length} | ${a.totR.toFixed(0)} | ${a.pf.toFixed(2)} | ${(a.win*100).toFixed(0)}% | ${P(A.end)} | ${(A.dd*100).toFixed(0)}% | ${P(B.end)} | ${(B.dd*100).toFixed(0)}% | ${P(Cc.end)} | ${(Cc.dd*100).toFixed(0)}% |`);return A};
for(const k of Object.keys(S))row(k,[k]);
console.log('\nPairs/trios (equal split):');
const out={};
for(const x of ['CKSP 10-1-9','Donchian 20','Keltner 20x2','TRIX 30 zero','MACD 8-17-9','MA Trend SMA200']){row('bb-core + '+x,['bb-core',x]);row('I-Core + '+x,['I-Core',x])}
row('bb-core + I-Core',['bb-core','I-Core']);
row('bb-core + I-Core + CKSP',['bb-core','I-Core','CKSP 10-1-9']);
row('bb-core + Keltner + TRIX',['bb-core','Keltner 20x2','TRIX 30 zero']);
console.log('\nBy year R (sum) per strategy:');const yrs=[2020,2021,2022,2023,2024,2025,2026];console.log('| strategy | '+yrs.join(' | ')+' |');
for(const k of Object.keys(S)){const m={};S[k].forEach(t=>{const y=new Date(t.tExit*1000).getUTCFullYear();m[y]=(m[y]||0)+t.R});console.log(`| ${k} | ${yrs.map(y=>(m[y]||0).toFixed(0)).join(' | ')} |`)}
