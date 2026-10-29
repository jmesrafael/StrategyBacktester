// pairs.js — the three possible two-bot tandems, judged on the COMBINED ₱20,000 (two ₱10,000 accounts, 2.5% risk each, $10 cap = ₱580)
const L=require('./lib.js');const five=['SOL','ZEC','NEAR','ADA','GALA'];const RISK=0.025,START=10000,CAP=580;
const D={};for(const c of five)D[c]={B:L.loadC(L.ROOT+`bb-core/data/${c}.json`),F:L.loadF(L.ROOT+`bb-core/data/funding/${c}.json`),I:L.loadC(L.ROOT+`i-core/data/${c}.json`)};
const tag=(c,t)=>t.map(x=>({...x,coin:c}));
const S3={'BB 1:4':five.flatMap(c=>tag(c,L.bb.backtest(D[c].B,{targetR:4},D[c].F).trades)),'BB no-target':five.flatMap(c=>tag(c,L.bb.backtest(D[c].B,{targetR:0},D[c].F).trades)),'I-Core':five.flatMap(c=>tag(c,L.ic.backtest(D[c].I).trades))};
const peso=v=>(v<0?'-₱':'₱')+Math.round(Math.abs(v)).toLocaleString('en-US'),f=(v,d=2)=>(v>=0?'+':'')+v.toFixed(d);
const ys=y=>Date.UTC(y,0,1)/1000,Y=[2020,2021,2022,2023,2024,2025,2026];
// two separate accounts, equity = realized balances summed; tracks the deepest drop of the combined equity and the max risk open at once
function pair(a,b,from,to){const accts=[a,b].map(()=>({bal:START})),ev=[];const risk=new Map();
 [a,b].forEach((T,j)=>T.forEach((t,k)=>{if(t.t>=from&&t.t<to){ev.push([t.t,1,j,k]);ev.push([t.tExit,0,j,k]);}}));ev.sort((x,y)=>x[0]-y[0]||x[1]-y[1]);
 let pk=2*START,dd=0,open=0,maxOpen=0;
 for(const[,typ,j,k]of ev){const T=j?b:a,key=j+':'+k;if(typ===1){const r=Math.min(CAP,accts[j].bal*RISK);risk.set(key,r);open+=r;maxOpen=Math.max(maxOpen,open/(accts[0].bal+accts[1].bal));}
  else{const r=risk.get(key);open-=r;accts[j].bal+=T[k].R*r;const eq=accts[0].bal+accts[1].bal;pk=Math.max(pk,eq);dd=Math.max(dd,1-eq/pk);}}
 return {profit:accts[0].bal+accts[1].bal-2*START,dd,maxOpen};}
const pairs=[['BB no-target','I-Core'],['BB 1:4','I-Core'],['BB 1:4','BB no-target']];
for(const[a,b]of pairs){const A=S3[a],B=S3[b];
 // same-entry overlap: an entry of A on the same coin and the same candle as an entry of B
 const keys=new Set(B.map(t=>t.coin+t.t));const same=A.filter(t=>keys.has(t.coin+t.t)).length;
 const mon={};for(const t of [...A,...B]){const d=new Date(t.tExit*1000),k=d.getUTCFullYear()*100+d.getUTCMonth();mon[k]=(mon[k]||0)+t.R;}
 const ms=Object.values(mon),neg=ms.filter(v=>v<0).length;
 const yr=Y.map(y=>[y,pair(A,B,ys(y),ys(y+1))]);const tot=yr.reduce((p,q)=>p+q[1].profit,0),no21=tot-yr.find(q=>q[0]===2021)[1].profit;
 const worst=yr.reduce((p,q)=>q[1].profit<p[1].profit?q:p),ddw=Math.max(...yr.map(q=>q[1].dd)),mo=Math.max(...yr.map(q=>q[1].maxOpen));
 const ddAvg=yr.reduce((p,q)=>p+q[1].dd,0)/yr.length;
 console.log(`\n=== ${a} + ${b} ===`);
 console.log(`  monthly correlation ${L.corr(L.monthly(A),L.monthly(B)).toFixed(2)} · same entry (coin + candle) on ${same} of ${A.length} ${a} trades (${(100*same/A.length).toFixed(0)}%)`);
 console.log('  by year (₱20k start each year): '+yr.map(([y,r])=>`${y} ${peso(r.profit)} (dd ${(r.dd*100).toFixed(0)}%)`).join(' | '));
 console.log(`  sum ${peso(tot)} · without 2021 ${peso(no21)} · worst year ${worst[0]} ${peso(worst[1].profit)} · deepest drop of the combined ₱20k: ${(ddw*100).toFixed(0)}% (avg yearly ${(ddAvg*100).toFixed(0)}%) · most of the balance at risk at once ${(mo*100).toFixed(1)}%`);
 console.log(`  profit per 1% of worst drop: ${peso(tot/(ddw*100))} · losing months ${neg}/${ms.length} (${(100*neg/ms.length).toFixed(0)}%) · worst month ${f(Math.min(...ms),1)}R`);
}
