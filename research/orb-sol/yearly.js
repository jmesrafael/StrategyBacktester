const {run}=require('./engine');
const C={
 'A 1h NY textbook':{tf:60,session:'ny',orBars:1,stop:'mid',target:2,entry:'close',dir:'both',filters:['vwap','rvol']},
 'A0 1h NY no filter':{tf:60,session:'ny',orBars:1,stop:'mid',target:2,entry:'close',dir:'both',filters:[]},
 'B 4h UTC0 textbook':{tf:240,session:'utc0',orBars:1,stop:'mid',target:2,entry:'close',dir:'both',filters:['vwap','rvol']},
 'C 4h LDN long EMA':{tf:240,session:'ldn',orBars:1,stop:'bar',target:0,entry:'close',dir:'long',filters:['ema']},
 'D 1h UTC0 long narrow (sweep pick)':{tf:60,session:'utc0',orBars:1,stop:'mid',target:0,entry:'close',dir:'long',filters:['vwap','rvol','narrow']},
};
const ddR=a=>{let c=0,p=0,d=0;for(const r of a){c+=r;p=Math.max(p,c);d=Math.max(d,p-c)}return d};
for (const [k,c] of Object.entries(C)){
 const T=run(c).trades;
 console.log(`\n### ${k}`);
 console.log('year | trades | win% | sum R | avg R | ret% (1% risk, compounded within year) | max DD R | max DD % | +months / months | best month R | worst month R');
 const ys=[...new Set(T.map(t=>new Date(t.tExit*1e3).getUTCFullYear()))];
 let posY=0;
 for (const y of ys){
  const a=T.filter(t=>new Date(t.tExit*1e3).getUTCFullYear()===y), R=a.map(t=>t.R);
  const s=R.reduce((x,r)=>x+r,0); if(s>0)posY++;
  let e=1,pk=1,dd=0; for(const r of R){e*=1+0.01*r;pk=Math.max(pk,e);dd=Math.max(dd,1-e/pk)}
  const m={}; a.forEach(t=>{const mo=new Date(t.tExit*1e3).getUTCMonth();m[mo]=(m[mo]||0)+t.R});
  const mv=Object.values(m);
  console.log(`${y} | ${a.length} | ${(a.filter(t=>t.R>0).length/a.length*100).toFixed(0)}% | ${s.toFixed(1)} | ${(s/a.length).toFixed(3)} | ${((e-1)*100).toFixed(1)}% | ${ddR(R).toFixed(1)} | ${(dd*100).toFixed(1)}% | ${mv.filter(x=>x>0).length}/${mv.length} | ${Math.max(...mv).toFixed(1)} | ${Math.min(...mv).toFixed(1)}`);
 }
 // 2026 months
 const a26=T.filter(t=>t.tExit>=1767225600);
 const m26={};a26.forEach(t=>{const d=new Date(t.tExit*1e3);const mo=d.toISOString().slice(0,7);(m26[mo]=m26[mo]||{n:0,R:0,w:0});m26[mo].n++;m26[mo].R+=t.R;if(t.R>0)m26[mo].w++});
 console.log('2026 by month: '+Object.entries(m26).map(([mo,v])=>`${mo.slice(5)}: ${v.R>=0?'+':''}${v.R.toFixed(1)}R (${v.n}t, ${Math.round(v.w/v.n*100)}%)`).join(' | '));
 // big movers removal
 const R=T.map(t=>t.R), tot=R.reduce((x,r)=>x+r,0), sorted=[...R].sort((a,b)=>b-a);
 const rm=n=>{const cut=sorted.slice(0,n).reduce((x,r)=>x+r,0);return (tot-cut)};
 const pct=n=>Math.round(T.length*n);
 console.log(`positive years ${posY}/${ys.length} | total ${tot.toFixed(1)}R | biggest win ${sorted[0].toFixed(2)}R | top-10 winners = ${(sorted.slice(0,10).reduce((x,r)=>x+r,0)).toFixed(1)}R`);
 console.log(`without top 5 winners: ${rm(5).toFixed(1)}R | top 10: ${rm(10).toFixed(1)}R | top 20: ${rm(20).toFixed(1)}R | top 5% (${pct(.05)}): ${rm(pct(.05)).toFixed(1)}R | top 10% (${pct(.1)}): ${rm(pct(.1)).toFixed(1)}R`);
 // capped wins: what if no trade could make more than 2R
 console.log(`all wins capped at 2R: ${R.reduce((x,r)=>x+Math.min(r,2),0).toFixed(1)}R | median trade ${[...R].sort((a,b)=>a-b)[Math.floor(R.length/2)].toFixed(2)}R | share of profit from top 10% trades ${(sorted.slice(0,pct(.1)).reduce((x,r)=>x+r,0)/sorted.filter(r=>r>0).reduce((x,r)=>x+r,0)*100).toFixed(0)}% of gross wins`);
}
