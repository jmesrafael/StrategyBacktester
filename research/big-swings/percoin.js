const E=require('./engine.js'),bb=require('../bb-core-v2/v2-core.js'),{loadCoin}=require('../bb-core-v2/load.js'),fs=require('fs');
const C=['BTC','ETH','SOL'],Y=[2020,2021,2022,2023,2024,2025,2026],f=v=>(v>=0?'+':'')+v.toFixed(0),RISK=5;
const L=c=>{const B=E.load(c);return{B,X:E.base(B)}};
const streak=T=>{let m=0,s=0;for(const t of [...T].sort((a,b)=>a.tExit-b.tExit)){s=t.R<=0?s+1:0;m=Math.max(m,s)}return m};
const worstYr=y=>Math.min(...Y.map(v=>y[v]||0));
let o=`# Per-coin results ($${RISK} risked per trade; R = one risk unit)\n\n`;
const sets={
 'bb-core (4h BB breakout, 1:4)':c=>{let d;try{d=loadCoin(c)}catch(e){d={B:L(c).B,funding:null}}return bb.backtest(d.B,{},d.funding).trades},
 'Keltner 20/2, 5-ATR trail, +SMA200':c=>E.run(L(c).B,L(c).X,'keltner',{n:20,m:2},{coin:c,kInit:5,kTrail:5,trend:true}),
 'Donchian 20, 5-ATR trail, +SMA200':c=>E.run(L(c).B,L(c).X,'donchian',{n:20},{coin:c,kInit:5,kTrail:5,trend:true}),
};
for(const [name,fn] of Object.entries(sets)){
 o+=`## ${name}\n\n| coin | trades | win% | total R | total $ | max DD (R / $) | longest losing streak | worst year R | yrs+ | ${Y.join(' | ')} |\n|---|---|---|---|---|---|---|---|---|${Y.map(()=>'---').join('|')}|\n`;
 let all=[];
 for(const c of [...C,'ALL']){
  const T=c==='ALL'?all:fn(c); if(c!=='ALL')all.push(...T);
  const y=E.yearly(T),R=T.reduce((a,t)=>a+t.R,0),dd=E.maxDD(T);
  o+=`| ${c} | ${T.length} | ${(100*T.filter(t=>t.R>0).length/T.length).toFixed(0)}% | ${f(R)} | ${R>=0?'+':'−'}$${Math.abs(Math.round(R*RISK)).toLocaleString()} | ${dd.toFixed(1)}R / $${Math.round(dd*RISK)} | ${streak(T)} | ${f(worstYr(y))} | ${Y.filter(v=>(y[v]||0)>0).length}/7 | ${Y.map(v=>f(y[v]||0)).join(' | ')} |\n`;
 }
 o+='\n';
}
fs.writeFileSync('RESULTS-percoin.md',o);console.log(o)
