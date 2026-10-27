const E=require('./engine.js'),bb=require('../bb-core-v2/v2-core.js'),fs=require('fs');
const C=['BTC','ETH','SOL'],Y=[2020,2021,2022,2023,2024,2025,2026],f=v=>(v>=0?'+':'')+v.toFixed(0);
const L=c=>{const B=E.load(c);return{B,X:E.base(B)}};
const bbT=C.flatMap(c=>bb.backtest(L(c).B,{},null).trades);
let o='# Blend: bb-core + new swing strategy (BTC+ETH+SOL, R per year)\n\n| set | total R | DD | '+Y.join(' | ')+' |\n|---|---|---|'+Y.map(()=>'---').join('|')+'|\n';
const row=(n,T)=>{const y=E.yearly(T);o+=`| ${n} | ${f(T.reduce((a,t)=>a+t.R,0))} | ${E.maxDD(T).toFixed(0)} | ${Y.map(v=>f(y[v]||0)).join(' | ')} |\n`};
const K=C.flatMap(c=>E.run(L(c).B,L(c).X,'keltner',{n:20,m:2},{coin:c,kInit:5,kTrail:5,trend:true}));
const D=C.flatMap(c=>E.run(L(c).B,L(c).X,'donchian',{n:20},{coin:c,kInit:5,kTrail:5,trend:true}));
row('bb-core',bbT);row('Keltner 20/2 trail5 +SMA200',K);row('Donchian 20 trail5 +SMA200',D);
row('bb-core + Keltner',[...bbT,...K]);row('bb-core + Donchian',[...bbT,...D]);row('all three',[...bbT,...K,...D]);
fs.writeFileSync('RESULTS-blend.md',o);console.log(o)
