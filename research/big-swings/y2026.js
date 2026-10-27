const E=require('./engine.js'),bb=require('../bb-core-v2/v2-core.js'),{loadCoin}=require('../bb-core-v2/load.js');
const C=['SOL','ZEC','NEAR','ADA','GALA'],START=3000,RP=0.025,T0=Date.UTC(2026,0,1)/1000,MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'];
const g={};const get=c=>g[c]||(g[c]=(()=>{const B=E.load(c);return{B,X:E.base(B)}})());
const sets={Ichimoku:C.flatMap(c=>E.run(get(c).B,get(c).X,'ichimoku',{full:false},{coin:c,kInit:2,kTrail:7,trend:true,exitOpp:false})),
 'bb-core':C.flatMap(c=>{const d=loadCoin(c);return bb.backtest(d.B,{},d.funding).trades.map(t=>({...t,coin:c}))})};
const fmt=v=>'₱'+Math.round(v).toLocaleString('en-US');
for(const [n,all] of Object.entries(sets)){
 const T=all.filter(t=>t.t>=T0).sort((a,b)=>a.t-b.t),d=[];
 for(const x of T){const eq=START+d.filter(o=>o.te<=x.t).reduce((a,o)=>a+o.p,0);d.push({te:x.tExit,p:x.R*RP*eq,x,risk:RP*eq})}
 d.sort((a,b)=>a.te-b.te);let eq=START,pk=START,dd=0,low=START;const me={};
 for(const o of d){eq+=o.p;pk=Math.max(pk,eq);dd=Math.max(dd,(pk-eq)/pk);low=Math.min(low,eq);me[new Date(o.te*1000).getUTCMonth()]=eq}
 const w=T.filter(t=>t.R>0).length;
 console.log(`\n== ${n}: ₱3,000 on 1 Jan 2026, 2.5% risk/trade (gross, before the 20% fee) ==`);
 console.log(`trades ${T.length} (opened in 2026), wins ${w}, losses ${T.length-w}, win ${(100*w/T.length).toFixed(0)}%, total R ${T.reduce((a,t)=>a+t.R,0).toFixed(1)}`);
 console.log(`END ${fmt(eq)}  (${((eq/START-1)*100).toFixed(0)}%)  profit ${fmt(eq-START)}  worst drop ${(dd*100).toFixed(0)}%  lowest balance ${fmt(low)}  still open at end: ${all.filter(t=>t.t>=T0).length-T.length}`);
 let prev=START;const row=[];for(let m=0;m<10;m++){if(me[m]!==undefined){row.push(`${MN[m]} ${fmt(me[m])} (${((me[m]/prev-1)*100>=0?'+':'')}${((me[m]/prev-1)*100).toFixed(0)}%)`);prev=me[m]}else row.push(`${MN[m]} ${fmt(prev)} (0%)`)}
 console.log(row.join(' | '));
 if(n==='Ichimoku')for(const o of d)console.log(' ',o.x.coin,o.x.dir===1?'LONG ':'SHORT',new Date(o.x.t*1000).toISOString().slice(0,10),'->',new Date(o.x.tExit*1000).toISOString().slice(0,10),'R',o.x.R.toFixed(1).padStart(6),'risk',fmt(o.risk),'P/L',(o.p>=0?'+':'')+fmt(o.p));
}
