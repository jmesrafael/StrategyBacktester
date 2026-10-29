'use strict';
const fs=require('fs'),path=require('path');
const BB = (() => { const r = (process.env.STRAT_ROOT || 'c:/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat'); return (r.endsWith('/') ? r : r + '/') + 'bb-core/'; })();
const {signalFrom,stats,DEFAULTS}=require(BB+'lucidio-core.js');
const cost=DEFAULTS.cost;
// mode: {target:R|0, maxBars, trail:'none'|'mid'|'atr'|'chand', k, be:R(breakeven trigger)}
function sim(B,funding,m){
  const cfg={...DEFAULTS};const trades=[];const closes=[],trs=[];let atr=null,pos=null,pend=null,pendClose=false,lastGap=-1e9;
  const sma=(i,n)=>{let s=0;for(let j=i-n+1;j<=i;j++)s+=B[j].close;return s/n;};
  for(let i=0;i<B.length;i++){const c=B[i];
    if(i>0&&c.time-B[i-1].time!==14400)lastGap=i;
    if(pend){const d=pend.dir,fill=c.open*(1+d*cost.slip),dist=Math.abs(fill-pend.stop)/fill;
      if(dist>0&&(d===1?pend.stop<fill:pend.stop>fill))pos={...pend,entry:fill,i0:i,dist,stop0:pend.stop,best:fill,tp:m.target?fill+d*m.target*Math.abs(fill-pend.stop):null};pend=null;}
    if(pendClose&&pos)exit(c.open*(1-pos.dir*cost.slip),i,cost.timeFee,'time');pendClose=false;
    if(pos){const d=pos.dir;
      if(d===1?c.low<=pos.stop:c.high>=pos.stop)exit((d===1?Math.min(pos.stop,c.open):Math.max(pos.stop,c.open))*(1-d*cost.slip),i,cost.stopFee,pos.stop===pos.stop0?'stop':'trail');
      else if(pos.tp&&(d===1?c.high>=pos.tp*(1+cost.tpBuf):c.low<=pos.tp*(1-cost.tpBuf)))exit((d===1?Math.max(pos.tp,c.open):Math.min(pos.tp,c.open))*(1-d*cost.tpSlip),i,cost.tpFee,'target');
    }
    closes.push(c.close);trs.push(i===0?c.high-c.low:Math.max(c.high-c.low,Math.abs(c.high-B[i-1].close),Math.abs(c.low-B[i-1].close)));
    if(i===13)atr=trs.slice(0,14).reduce((a,b)=>a+b,0)/14;else if(i>=14)atr=(atr*13+trs[i])/14;
    if(pos){
      const d=pos.dir;pos.best=d===1?Math.max(pos.best,c.high):Math.min(pos.best,c.low);
      let ns=pos.stop;
      if(m.trail==='mid'&&i>=20){const mid=sma(i,20);ns=d===1?Math.max(ns,mid):Math.min(ns,mid);}
      if(m.trail==='sma'&&i>=m.n){const s=sma(i,m.n);ns=d===1?Math.max(ns,s):Math.min(ns,s);}
      if(m.trail==='chand'){const t=pos.best-d*m.k*atr;ns=d===1?Math.max(ns,t):Math.min(ns,t);}
      if(m.be&&d*(pos.best-pos.entry)/pos.entry>=m.be*pos.dist){const be=pos.entry*(1+d*0.001);ns=d===1?Math.max(ns,be):Math.min(ns,be);}
      if(d===1?ns<c.close:ns>c.close)pos.stop=ns; // only move if it stays on the safe side of price
      if(m.maxBars>0&&i-pos.i0>=m.maxBars)pendClose=true;continue;}
    if(i<cfg.warmup)continue;
    if(i-lastGap<200)continue;
    const s=signalFrom(closes,atr,{...cfg,targetR:4});
    if(s)pend={...s};
  }
  if(pos){ // close at last close, mark to market
    const c=B[B.length-1];exit(c.close,B.length-1,cost.timeFee,'end');}
  return trades;
  function exit(px,i,fee,why){let fr=0;if(funding){const te=B[pos.i0].time,tx=B[i].time+7200;for(const[t,r]of funding){if(t>tx)break;if(t>te)fr+=r;}}
    const R=(pos.dir*(px-pos.entry)/pos.entry-cost.entryFee-fee-pos.dir*fr)/pos.dist;
    trades.push({dir:pos.dir,t:B[pos.i0].t||B[pos.i0].time,tExit:B[i].time+14400,R,why,bars:i-pos.i0+1});pos=null;}
}
const coins=['SOL','ZEC','NEAR','ADA','GALA'];
const data={};
for(const c of coins){data[c]={B:JSON.parse(fs.readFileSync(BB+`data/${c}.json`)).map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]})),F:JSON.parse(fs.readFileSync(BB+`data/funding/${c}.json`))};}
const modes=[
 ['BASE  4R target, 48 bar cap',{target:4,maxBars:48,trail:'none'}],
 ['A  no target, 48 bar cap (stop only)',{target:0,maxBars:48,trail:'none'}],
 ['B  trail mid-band, no cap',{target:0,maxBars:0,trail:'mid'}],
 ['C  trail mid-band, 120 bar cap',{target:0,maxBars:120,trail:'mid'}],
 ['D  trail SMA50, no cap',{target:0,maxBars:0,trail:'sma',n:50}],
 ['E  chandelier 3xATR, no cap',{target:0,maxBars:0,trail:'chand',k:3}],
 ['F  chandelier 4xATR, no cap',{target:0,maxBars:0,trail:'chand',k:4}],
 ['G  chandelier 5xATR, no cap',{target:0,maxBars:0,trail:'chand',k:5}],
 ['H  mid-band stop, BE@2R, chand 4xATR',{target:0,maxBars:0,trail:'chand',k:4,be:2}],
 ['I  hybrid: 4R cap removed, 8R target + mid trail',{target:8,maxBars:0,trail:'mid'}],
];
const RISK=5;
const fmt=v=>(v<0?'-$':'+$')+Math.abs(v).toFixed(0);
for(const [name,m] of modes){
  const all=[];const per=[];
  for(const c of coins){const t=sim(data[c].B,data[c].F,m);t.sort((a,b)=>a.tExit-b.tExit);all.push(...t);const s=stats(t,RISK);per.push(c+' '+fmt(s.net));}
  all.sort((a,b)=>a.tExit-b.tExit);const s=stats(all,RISK);
  const ys=Object.keys(s.years).sort();
  const big=all.filter(t=>t.R>=8).length, best=Math.max(...all.map(t=>t.R));
  console.log(`\n${name}\n  n=${s.n} net ${fmt(s.net)} avgR ${s.avgR.toFixed(2)} win ${(s.winRate*100).toFixed(0)}% PF ${s.pf.toFixed(2)} maxDD ${fmt(-s.maxDD)} (${(s.maxDD/RISK).toFixed(0)}R) avgBars ${(all.reduce((a,t)=>a+t.bars,0)/all.length).toFixed(0)} | trades>=8R: ${big}, best ${best.toFixed(1)}R`);
  console.log('  '+per.join(' | '));
  console.log('  '+ys.map(y=>y+' '+fmt(s.years[y].net)).join(' | '));
}
