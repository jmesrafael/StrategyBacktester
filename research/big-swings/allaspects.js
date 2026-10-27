// allaspects.js — does ANY tuned config beat bb-core on every metric at once? (5 coins, 2.5% compounding)
const fs=require('fs'),E=require('./engine.js'),bb=require('../bb-core-v2/v2-core.js'),{loadCoin}=require('../bb-core-v2/load.js');
const C=['SOL','ZEC','NEAR','ADA','GALA'],Y=[2020,2021,2022,2023,2024,2025,2026],START=1000,RP=0.025;
const g={};const get=c=>g[c]||(g[c]=(()=>{const B=E.load(c);return{B,X:E.base(B)}})());
const sum=T=>T.reduce((a,t)=>a+t.R,0),yr=t=>new Date(t.tExit*1000).getUTCFullYear();
function acct(T){const tr=[...T].sort((a,b)=>a.t-b.t),done=[];for(const x of tr){const eq=START+done.filter(d=>d.tExit<=x.t).reduce((a,d)=>a+d.pnl,0);done.push({tExit:x.tExit,pnl:x.R*RP*eq})}
 done.sort((a,b)=>a.tExit-b.tExit);let eq=START,pk=START,dd=0;for(const d of done){eq+=d.pnl;pk=Math.max(pk,eq);dd=Math.max(dd,(pk-eq)/pk)}return{eq,dd}}
const M=(T)=>{const y=E.yearly(T),a=acct(T);const cy=C.reduce((n,c)=>{const yy=E.yearly(T.filter(t=>t.coin===c));return n+Y.filter(v=>(yy[v]||0)<0).length},0);
 return{R:sum(T),dd:E.maxDD(T),eq:a.eq,ddp:a.dd,yp:Y.filter(v=>(y[v]||0)>0).length,loss:cy,win:T.filter(t=>t.R>0).length/T.length,worstY:Math.min(...Y.map(v=>y[v]||0))}};
const bbT=C.flatMap(c=>{const d=loadCoin(c);return bb.backtest(d.B,{},d.funding).trades.map(t=>({...t,coin:c}))});const B0=M(bbT);
console.log('bb-core',JSON.stringify(B0));
const picks=[];const FAM=[];
for(const n of [10,20,30,55,100])FAM.push(['donchian',{n}]);FAM.push(['ichimoku',{full:false}],['ichimoku',{full:true}]);
for(const [n,min] of [[14,1.0],[14,1.1],[21,1.0]])FAM.push(['vortex',{n,min}]);for(const [n,m] of [[10,2],[10,3],[20,4]])FAM.push(['supertrend',{n,m}]);
for(const [n,m] of [[10,1.5],[20,1.5],[20,2],[20,2.5],[50,3],[30,2]])FAM.push(['keltner',{n,m}]);for(const [n,min] of [[14,20],[14,25],[14,30]])FAM.push(['adx',{n,min}]);
FAM.push(['darvas',{conf:3,look:50}],['darvas',{conf:3,look:20}],['darvas',{conf:5,look:100}]);
let n=0,beatCount={R:0,dd:0,eq:0,ddp:0,yp:0,loss:0},all=[];
for(const [fam,p] of FAM)for(const kInit of [1.5,2,3,4])for(const kTrail of [3,4,5,7,9])for(const trend of [false,true])for(const exitOpp of [true,false]){
 const ex={kInit,kTrail,trend,exitOpp},T=C.flatMap(c=>E.run(get(c).B,get(c).X,fam,p,{coin:c,...ex}));n++;const m=M(T);
 const b={R:m.R>B0.R,dd:m.dd<B0.dd,eq:m.eq>B0.eq,ddp:m.ddp<B0.ddp,yp:m.yp===7,loss:m.loss<=B0.loss};for(const k in b)if(b[k])beatCount[k]++;
 const score=Object.values(b).filter(Boolean).length;all.push({name:`${fam} ${JSON.stringify(p)} ${kInit}/${kTrail}/${trend?'T':'F'}/${exitOpp?'T':'F'}`,m,b,score});}
console.log('configs tried',n,' beat bb-core on: ',JSON.stringify(beatCount));
console.log('beat on ALL 6:',all.filter(x=>x.score===6).length);
all.sort((a,b)=>b.score-a.score||b.m.R-a.m.R);
for(const x of all.slice(0,8))console.log(x.score+'/6',x.name,'R',x.m.R.toFixed(0),'DD',x.m.dd.toFixed(0),'eq$',Math.round(x.m.eq).toLocaleString(),'DD%',(x.m.ddp*100).toFixed(0),'yrs',x.m.yp,'coin-yr losses',x.m.loss,JSON.stringify(x.b));
