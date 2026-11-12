const fs=require('fs'),{run}=require('./engine');
const COINS=(process.argv[2]||'SOL,BTC,ETH,XRP').split(','), OUTF=process.argv[3]||'deep.json';
const SET={
 'A 1h NY textbook ORB':{tf:60,session:'ny',orBars:1,stop:'mid',target:2,entry:'close',dir:'both',filters:['vwap','rvol']},
 'B 4h UTC0 textbook ORB':{tf:240,session:'utc0',orBars:1,stop:'mid',target:2,entry:'close',dir:'both',filters:['vwap','rvol']},
 'D 1h UTC0 long narrow (SOL pick)':{tf:60,session:'utc0',orBars:1,stop:'mid',target:0,entry:'close',dir:'long',filters:['vwap','rvol','narrow']},
 'E 1h UTC0 both vwap+rvol (all-4 robust)':{tf:60,session:'utc0',orBars:1,stop:'bar',target:0,entry:'close',dir:'both',filters:['vwap','rvol']},
 'F 1h UTC0 long vwap+rvol+ema (pooled pick)':{tf:60,session:'utc0',orBars:1,stop:'bar',target:0,entry:'close',dir:'long',filters:['vwap','rvol','ema']},
 'G 4h LDN long T3 vwap+rvol+pd (all-4 robust)':{tf:240,session:'ldn',orBars:1,stop:'mid',target:3,entry:'close',dir:'long',filters:['vwap','rvol','pd']},
};
const res={};
for (const coin of COINS) for (const [name,c] of Object.entries(SET)) {
  const r=run({...c,coin}), r2=run({...c,coin,takerFee:0.0008,makerFee:0.0004,slip:0.0005,stopSlip:0.0008});
  const T=r.trades, R=T.map(t=>t.R), sorted=[...R].sort((a,b)=>b-a), tot=R.reduce((a,b)=>a+b,0);
  const years={}; T.forEach(t=>{const y=new Date(t.tExit*1e3).getUTCFullYear();(years[y]=years[y]||[]).push(t)});
  const yr=Object.fromEntries(Object.entries(years).map(([y,a])=>{const m={};a.forEach(t=>{const mo=new Date(t.tExit*1e3).getUTCMonth();m[mo]=(m[mo]||0)+t.R});let e=1,pk=1,dd=0;for(const t of a){e*=1+0.01*t.R;pk=Math.max(pk,e);dd=Math.max(dd,1-e/pk)}
    return [y,{n:a.length,win:a.filter(t=>t.R>0).length/a.length,R:a.reduce((x,t)=>x+t.R,0),ret:e-1,dd,pm:Object.values(m).filter(v=>v>0).length,m:Object.keys(m).length}]}));
  const months=Object.values(yr).reduce((a,y)=>[a[0]+y.pm,a[1]+y.m],[0,0]);
  (res[name]=res[name]||{})[coin]={n:T.length,perMo:r.perMonth,win:r.all.win,avg:r.all.avgR,sum:tot,is:r.is.avgR,oos:r.oos.avgR,dd:r.maxDD,ret:r.retPct,cagr:r.cagr,
    posY:Object.values(yr).filter(y=>y.R>0).length,nY:Object.keys(yr).length,months,y2026:yr[2026]||{n:0,R:0,ret:0,win:0,dd:0,pm:0,m:0},
    noTop10:tot-sorted.slice(0,10).reduce((a,b)=>a+b,0),noTop5pct:tot-sorted.slice(0,Math.round(T.length*.05)).reduce((a,b)=>a+b,0),cost2:r2.all.avgR,yr};
}
fs.writeFileSync(OUTF,JSON.stringify(res));
for (const [name,byC] of Object.entries(res)) {
  console.log(`\n### ${name}`);
  console.log('coin | trades (/mo) | win | avg R | sum R | IS/OOS | +years | +months | 1%-risk total (CAGR) | max DD | 2026: R, ret, win, +mo | w/o top10 | w/o top5% | avg R @2x cost');
  for (const [k,v] of Object.entries(byC)) console.log(`${k} | ${v.n} (${v.perMo.toFixed(1)}) | ${(v.win*100).toFixed(0)}% | ${v.avg.toFixed(3)} | ${v.sum.toFixed(1)} | ${v.is.toFixed(2)}/${v.oos.toFixed(2)} | ${v.posY}/${v.nY} | ${v.months[0]}/${v.months[1]} | ${(v.ret*100).toFixed(0)}% (${(v.cagr*100).toFixed(0)}%) | ${(v.dd*100).toFixed(0)}% | ${v.y2026.R.toFixed(1)}R ${(v.y2026.ret*100).toFixed(0)}% ${(v.y2026.win*100).toFixed(0)}% ${v.y2026.pm}/${v.y2026.m} | ${v.noTop10.toFixed(1)} | ${v.noTop5pct.toFixed(1)} | ${v.cost2.toFixed(3)}`);
  console.log('  yearly R:  '+Object.entries(byC).map(([k,v])=>k+' '+Object.entries(v.yr).map(([y,x])=>y.slice(2)+':'+(x.R>=0?'+':'')+x.R.toFixed(0)).join(' ')).join('  |  '));
}
