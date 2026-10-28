// split.cjs — BB-Core / I-Core capital split at 0.5%, 1% and 2.5% risk: same engine, data and accounting as research/big-swings/blend5.js
// (realised, compounding, separate sub-accounts); only the split and risk levels differ. Start = $250.39 (MEXC 2026-10-28 + the $200 added).
//   node research/portfolio/split.cjs
const path = require('path'), R = path.join(__dirname, '..');
process.chdir(path.join(R, 'big-swings'));
const E=require(path.join(R, 'big-swings/engine.js')),bb=require(path.join(R, 'bb-core-v2/v2-core.js')),{loadCoin}=require(path.join(R, 'bb-core-v2/load.js'));
const C=['SOL','ZEC','NEAR','ADA','GALA'],Y=[2020,2021,2022,2023,2024,2025,2026],S=250.39;
const BB=C.flatMap(c=>{const d=loadCoin(c);return bb.backtest(d.B,{},d.funding).trades.map(t=>({...t,coin:c}))});
const IC=C.flatMap(c=>{const B=E.load(c);return E.run(B,E.base(B),'ichimoku',{full:false},{coin:c,kInit:2,kTrail:7,trend:true,exitOpp:false})});
function acct(T,rp,s){const tr=[...T].sort((a,b)=>a.t-b.t),d=[];for(const x of tr){const eq=s+d.filter(o=>o.te<=x.t).reduce((a,o)=>a+o.p,0);d.push({te:x.tExit,p:x.R*rp*eq})}d.sort((a,b)=>a.te-b.te);return d}
function curve(parts){const ev=parts.flatMap(({d})=>d).sort((a,b)=>a.te-b.te);let tot=parts.reduce((a,p)=>a+p.s,0),pk=tot,dd=0;const yEnd={};
 for(const o of ev){tot+=o.p;pk=Math.max(pk,tot);dd=Math.max(dd,(pk-tot)/pk);yEnd[new Date(o.te*1000).getUTCFullYear()]=tot}
 let prev=parts.reduce((a,p)=>a+p.s,0);const yr={};for(const y of Y){if(yEnd[y]!==undefined){yr[y]=yEnd[y]/prev-1;prev=yEnd[y]}else yr[y]=0}return{eq:tot,dd,yr}}
// worst DD over any 1-year start (realised), the more relevant number for a new account
function worstYearDD(parts){const ev=parts.flatMap(({d})=>d).sort((a,b)=>a.te-b.te);return ev}
console.log('BB trades',BB.length,'IC trades',IC.length);
console.log('risk | BB/IC split | BB $ / IC $ | max DD | worst year | median year | 2026 YTD');
for(const rp of [0.005,0.01,0.025]) for(const w of [1,0.9,0.8,0.7,0.6,0.5]){
 const parts=[];if(w>0)parts.push({d:acct(BB,rp,S*w),s:S*w});if(w<1)parts.push({d:acct(IC,rp,S*(1-w)),s:S*(1-w)});
 const r=curve(parts),ys=Y.slice(0,6).map(y=>r.yr[y]).sort((a,b)=>a-b);
 console.log(`${(rp*100).toFixed(1)}% | ${Math.round(w*100)}/${Math.round((1-w)*100)} | $${(S*w).toFixed(0)} / $${(S*(1-w)).toFixed(0)} | -${(r.dd*100).toFixed(0)}% | ${(ys[0]*100).toFixed(0)}% | ${(((ys[2]+ys[3])/2)*100).toFixed(0)}% | ${(r.yr[2026]*100).toFixed(0)}%`);}
