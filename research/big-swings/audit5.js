const E=require('./engine.js');const C=['SOL','ZEC','NEAR','ADA','GALA'],Y=[2020,2021,2022,2023,2024,2025,2026];
const f=v=>(v>=0?'+':'')+v.toFixed(0),sum=T=>T.reduce((a,t)=>a+t.R,0);
const g={};const get=c=>g[c]||(g[c]=(()=>{const B=E.load(c);return{B,X:E.base(B)}})());
const run=(cs,fam,p,ex)=>cs.flatMap(c=>E.run(get(c).B,get(c).X,fam,p,{coin:c,...ex}));
const pos=T=>{const y=E.yearly(T);return Y.filter(v=>(y[v]||0)>0).length};
const ex={kInit:2,kTrail:7,trend:true,exitOpp:false},fam='ichimoku',p={full:false};
const T=run(C,fam,p,ex);console.log('base',f(sum(T)),pos(T)+'/7');
const c0={...E.COST};E.COST.fee*=2;E.COST.slip*=2;E.COST.fund*=2;const T2=run(C,fam,p,ex);Object.assign(E.COST,c0);console.log('2x cost',f(sum(T2)),pos(T2)+'/7');
E.COST.slip*=3;const T3=run(C,fam,p,ex);Object.assign(E.COST,c0);console.log('3x slip',f(sum(T3)),pos(T3)+'/7');
let bad=0;for(const c of C){const{B}=get(c),cut=B.length-400,B2=B.slice(0,cut);const a=E.run(B,get(c).X,fam,p,{coin:c,...ex}).filter(t=>t.tExit<=B2[cut-1].time);const b=E.run(B2,E.base(B2),fam,p,{coin:c,...ex}).filter(t=>t.tExit<=B2[cut-1].time);if(a.length!==b.length||a.some((t,i)=>t.t!==b[i].t||Math.abs(t.R-b[i].R)>1e-9))bad++}
console.log('lookahead',bad?'FAIL':'ok');
const nb=[];for(const kI of [1.5,2,2.5,3])for(const kT of [5,6,7,9]){const t=run(C,fam,p,{...ex,kInit:kI,kTrail:kT});nb.push(`${kI}/${kT}: ${f(sum(t))}R ${pos(t)}/7 DD${E.maxDD(t).toFixed(0)}`)}console.log('neighbours',nb.join(' ; '));
const nt=run(C,fam,p,{...ex,trend:false});console.log('no SMA filter',f(sum(nt)),pos(nt)+'/7');
const bt=run(['BTC','ETH'],fam,p,ex);console.log('BTC+ETH unseen',f(sum(bt)),pos(bt)+'/7',['BTC','ETH'].map(c=>c+' '+f(sum(bt.filter(t=>t.coin===c)))).join(' '));
const ot=run(['BNB','XRP','DOGE','LINK','LTC','AVAX'],fam,p,ex);console.log('6 other coins',f(sum(ot)),['BNB','XRP','DOGE','LINK','LTC','AVAX'].map(c=>c+' '+f(sum(ot.filter(t=>t.coin===c)))).join(' '));
