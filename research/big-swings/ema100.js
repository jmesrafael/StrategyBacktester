// ema100.js — EMA 20/100 cross vs Ichimoku cloud, same engine, same frozen protocol (pick on 2020-22, judge 2023-26, BTC/ETH unseen)
const E=require('./engine.js'),bb=require('../bb-core-v2/v2-core.js'),{loadCoin}=require('../bb-core-v2/load.js');
const C=['SOL','ZEC','NEAR','ADA','GALA'],Y=[2020,2021,2022,2023,2024,2025,2026],f=v=>(v>=0?'+':'')+v.toFixed(0),sum=T=>T.reduce((a,t)=>a+t.R,0),yr=t=>new Date(t.tExit*1000).getUTCFullYear();
const g={};const get=c=>g[c]||(g[c]=(()=>{const B=E.load(c);return{B,X:E.base(B)}})());
const run=(cs,fam,p,ex)=>cs.flatMap(c=>E.run(get(c).B,get(c).X,fam,p,{coin:c,...ex}));
const RP=0.025;function acct(T){const tr=[...T].sort((a,b)=>a.t-b.t),d=[];for(const x of tr){const eq=1000+d.filter(o=>o.te<=x.t).reduce((a,o)=>a+o.p,0);d.push({te:x.tExit,p:x.R*RP*eq})}d.sort((a,b)=>a.te-b.te);let e=1000,pk=1000,dd=0;for(const o of d){e+=o.p;pk=Math.max(pk,e);dd=Math.max(dd,(pk-e)/pk)}return{eq:e,dd}}
const line=(name,T)=>{const y=E.yearly(T),a=acct(T),te=T.filter(t=>yr(t)>=2023),tr=T.filter(t=>yr(t)<=2022);
 const lost=C.reduce((n,c)=>{const yy=E.yearly(T.filter(t=>t.coin===c));return n+Y.filter(v=>(yy[v]||0)<-0.5).length},0);
 console.log(`${name.padEnd(46)} train ${f(sum(tr)).padStart(5)} | test ${f(sum(te)).padStart(5)} | total ${f(sum(T)).padStart(5)} DD ${E.maxDD(T).toFixed(0).padStart(3)}R win ${(100*T.filter(t=>t.R>0).length/T.length).toFixed(0)}% yrs ${Y.filter(v=>(y[v]||0)>0).length}/7 coin-yr lost ${lost} | $${Math.round(a.eq).toLocaleString()} DD ${(a.dd*100).toFixed(0)}% | ${Y.map(v=>f(y[v]||0)).join(' ')}`)};
const bbT=C.flatMap(c=>{const d=loadCoin(c);return bb.backtest(d.B,{},d.funding).trades.map(t=>({...t,coin:c}))});line('bb-core',bbT);
const ex=(kI,kT,tr)=>({kInit:kI,kTrail:kT,trend:tr,exitOpp:false});
console.log('\n-- same exits as the Ichimoku pick (stop 2 ATR, trail 7 ATR, +SMA200) --');
line('Ichimoku cloud',run(C,'ichimoku',{full:false},ex(2,7,true)));
for(const [f1,s1] of [[20,100],[20,50],[50,200],[10,100]])line(`EMA ${f1}/${s1}`,run(C,'emacross',{f:f1,sl:s1},ex(2,7,true)));
console.log('\n-- EMA 20/100 across stop/trail/trend (ranked by TRAIN R/DD only) --');
const rows=[];for(const kI of [1.5,2,3])for(const kT of [4,5,7,9])for(const tr of [false,true]){const T=run(C,'emacross',{f:20,sl:100},ex(kI,kT,tr)),t=T.filter(x=>yr(x)<=2022);rows.push({kI,kT,tr,T,sc:sum(t)/Math.max(10,E.maxDD(t)),gr:[2020,2021,2022].every(v=>(E.yearly(t)[v]||0)>0)})}
rows.sort((a,b)=>b.sc-a.sc);for(const r of rows.slice(0,5))line(`EMA 20/100 stop${r.kI} trail${r.kT} ${r.tr?'+SMA200':'noFilter'}${r.gr?'':' (train not all green)'}`,r.T);
const best=rows[0];const bt=run(['BTC','ETH'],'emacross',{f:20,sl:100},ex(best.kI,best.kT,best.tr));console.log('\nEMA 20/100 best-train pick on unseen BTC+ETH:',f(sum(bt)),'R, years+',(()=>{const y=E.yearly(bt);return Y.filter(v=>(y[v]||0)>0).length})()+'/7');
const it=run(['BTC','ETH'],'ichimoku',{full:false},ex(2,7,true));console.log('Ichimoku on unseen BTC+ETH:',f(sum(it)),'R');
