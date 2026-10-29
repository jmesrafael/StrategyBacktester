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
function S(t){const n=t.length;if(!n)return null;const w=t.filter(x=>x.R>0),l=t.filter(x=>x.R<=0);const sw=w.reduce((a,x)=>a+x.R,0),sl=l.reduce((a,x)=>a+x.R,0);
 return {n,win:w.length/n,exp:(sw+sl)/n,aw:w.length?sw/w.length:0,al:l.length?sl/l.length:0,net:sw+sl,pf:sl?sw/-sl:Infinity,best:Math.max(...t.map(x=>x.R))};}
const row=(k,s)=>`${String(k).padEnd(7)} ${String(s.n).padStart(4)}  ${(s.win*100).toFixed(1).padStart(5)}%  ${(s.exp>=0?'+':'')+s.exp.toFixed(3)}R  ${('+'+s.aw.toFixed(2)).padStart(6)}R  ${s.al.toFixed(2).padStart(6)}R  ${s.pf.toFixed(2).padStart(5)}  ${((s.net>=0?'+':'')+s.net.toFixed(1)+'R').padStart(8)}  ${('$'+(s.net*5).toFixed(0)).padStart(6)}  ${s.best.toFixed(1).padStart(5)}R`;
const hdr='period  trades  win%    expR     avgWin   avgLoss    PF      netR    $@5R   best';
const res={};
for(const [name,m] of [modes[0],modes[1]]){const all=[];const byCoin={};
 for(const c of coins){const t=sim(data[c].B,data[c].F,m);byCoin[c]=t;all.push(...t);}
 res[name]={all,byCoin};}
for(const [name,{all,byCoin}] of Object.entries(res)){
 console.log('\n### '+name);console.log(hdr);
 const ys=[...new Set(all.map(t=>new Date(t.tExit*1000).getUTCFullYear()))].sort();
 for(const y of ys)console.log(row(y,S(all.filter(t=>new Date(t.tExit*1000).getUTCFullYear()===y))));
 console.log(row('TOTAL',S(all)));
 console.log('-- per coin');for(const c of coins)console.log(row(c,S(byCoin[c])));
 const why={};for(const t of all){why[t.why]??=[];why[t.why].push(t.R);}
 console.log('-- exits: '+Object.entries(why).map(([k,v])=>`${k} ${v.length} (avg ${(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2)}R)`).join(' · '));
}
