// bb1h-robust.js — is the 1h version of bb-core (same logic, 4x lengths) a plateau or a lucky setting? neighbours + slippage stress, 5 bot coins.
const fs=require('fs');const {account}=require('./baseline');const BB=require('../../../bb-core/lucidio-core.js');
const FIVE=['SOL','ZEC','NEAR','ADA','GALA'],FX=63,START=250*FX,CAP=50*FX,SPLIT=Date.UTC(2023,0,1)/1000,Y26=Date.UTC(2026,0,1)/1000;
const D={};for(const c of FIVE)D[c]=JSON.parse(fs.readFileSync(`data1h/${c}.json`)).map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]}));
const tier=e=>e>=1000*FX?.015:e>=500*FX?.02:.025;
const bal=(tr,from)=>{tr=tr.filter(t=>t.tExit>=from).sort((a,b)=>a.tExit-b.tExit);let e=START,pk=e,dd=0;for(const t of tr){e*=1+Math.min(tier(e),CAP/e)*t.R;pk=Math.max(pk,e);dd=Math.min(dd,e/pk-1)}return[e,dd]};
function go(lab,cfg){const all=[];for(const c of FIVE)all.push(...BB.backtest(D[c],{interval:3600,warmup:(cfg.trendLen||800)+2,trendLen:800,...cfg}).trades);
 const a=account(all),tr=account(all,.025,0,SPLIT),te=account(all,.025,SPLIT),[e,dd]=bal(all,0),[e26]=bal(all,Y26),yrs={};all.forEach(t=>{const y=new Date(t.tExit*1000).getUTCFullYear();yrs[y]=(yrs[y]||0)+t.R});
 console.log(`| ${lab} | ${a.n} | ${a.totR.toFixed(0)} | ${a.expR.toFixed(2)} | ${a.pf.toFixed(2)} | ${(a.win*100).toFixed(0)}% | ${tr.totR.toFixed(0)} / ${te.totR.toFixed(0)} | ${[2020,2021,2022,2023,2024,2025,2026].map(y=>(yrs[y]||0).toFixed(0)).join(' / ')} | ₱${Math.round(e).toLocaleString('en-US')} | ${(dd*100).toFixed(0)}% | ₱${Math.round(e26).toLocaleString('en-US')} |`)}
console.log('| config | trades | R | exp R | PF | win | R <2023 / 2023+ | R by year 2020..2026 | ends (cap) | worst drop | 2026 only ends |\n|---|---|---|---|---|---|---|---|---|---|---|');
go('1h bb-core x4 (80/800/192) [base]',{bbLen:80,maxBars:192});
for(const b of [40,60,100,120])go('bbLen '+b,{bbLen:b,maxBars:192});
for(const t of [400,600,1000,1200])go('trendLen '+t,{bbLen:80,maxBars:192,trendLen:t,warmup:t+2});
for(const m of [96,144,288,384])go('maxBars '+m,{bbLen:80,maxBars:m});
go('native 20/200/48 on 1h',{bbLen:20,maxBars:48,trendLen:200,warmup:202});
go('slippage x2 (0.04%)',{bbLen:80,maxBars:192,cost:{slip:.0004}});go('slippage x3 (0.06%)',{bbLen:80,maxBars:192,cost:{slip:.0006}});go('slippage x5 (0.10%)',{bbLen:80,maxBars:192,cost:{slip:.001}});
