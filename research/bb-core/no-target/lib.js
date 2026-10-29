'use strict';
const fs=require('fs');
const ROOT = (() => { const r = (process.env.STRAT_ROOT || 'c:/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat'); return (r.endsWith('/') ? r : r + '/') + ''; })();   // STRAT_ROOT = the folder that holds your clones (bb-core, i-core, StrategyBacktester), with forward slashes; default = this PC
const bb=require(ROOT+'bb-core/lucidio-core.js');
const ic=require(ROOT+'i-core/icore-core.js');
const COST=bb.DEFAULTS.cost;
const loadC=(f)=>JSON.parse(fs.readFileSync(f)).map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]}));
const loadF=(f)=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):null;
// generic breakout engine: identical fills/costs/exits to lucidio-core (stop at signal level, optional target, 48-bar time exit, gap skip, 0.3 ATR min stop)
function gen(B,sigFn,o={},funding=null){
  const targetR=o.targetR||0,maxBars=o.maxBars??48,trades=[];let pos=null,pend=null,pendClose=false,lastGap=-1e9,atr=null;const trs=[],closes=[];
  for(let i=0;i<B.length;i++){const c=B[i];
    if(i>0&&c.time-B[i-1].time!==14400)lastGap=i;
    if(pend){const d=pend.dir,fill=c.open*(1+d*COST.slip),dist=Math.abs(fill-pend.stop)/fill;
      if(dist>0&&(d===1?pend.stop<fill:pend.stop>fill))pos={dir:d,stop:pend.stop,entry:fill,i0:i,dist,tp:targetR?fill+d*targetR*Math.abs(fill-pend.stop):null};pend=null;}
    if(pendClose&&pos)ex(c.open*(1-pos.dir*COST.slip),i,COST.timeFee,'time');pendClose=false;
    if(pos){const d=pos.dir;
      if(d===1?c.low<=pos.stop:c.high>=pos.stop)ex((d===1?Math.min(pos.stop,c.open):Math.max(pos.stop,c.open))*(1-d*COST.slip),i,COST.stopFee,'stop');
      else if(pos.tp&&(d===1?c.high>=pos.tp*(1+COST.tpBuf):c.low<=pos.tp*(1-COST.tpBuf)))ex((d===1?Math.max(pos.tp,c.open):Math.min(pos.tp,c.open)),i,COST.tpFee,'target');}
    closes.push(c.close);trs.push(i===0?c.high-c.low:Math.max(c.high-c.low,Math.abs(c.high-B[i-1].close),Math.abs(c.low-B[i-1].close)));
    if(i===13)atr=trs.slice(0,14).reduce((a,b)=>a+b,0)/14;else if(i>=14)atr=(atr*13+trs[i])/14;
    if(pos){if(maxBars>0&&i-pos.i0>=maxBars)pendClose=true;continue;}
    if(i<202||i-lastGap<200)continue;
    const s=sigFn(B,i,atr);if(s&&Math.abs(s.close-s.stop)>=0.3*atr)pend=s;
  }
  return trades;
  function ex(px,i,fee,why){let fr=0;if(funding){const te=B[pos.i0].time,tx=B[i].time+7200;for(const[t,r]of funding){if(t>tx)break;if(t>te)fr+=r;}}
    const R=(pos.dir*(px-pos.entry)/pos.entry-COST.entryFee-fee-pos.dir*fr)/pos.dist;
    trades.push({t:B[pos.i0].time,tExit:B[i].time+14400,dir:pos.dir,R,why,bars:i-pos.i0+1});pos=null;}
}
const sma=(B,i,n)=>{let s=0;for(let j=i-n+1;j<=i;j++)s+=B[j].close;return s/n;};
const SIG={
 bb:(B,i)=>{const c=B[i].close,m=sma(B,i,20);let v=0;for(let j=i-19;j<=i;j++)v+=(B[j].close-m)**2;const sd=Math.sqrt(v/20),t=sma(B,i,200);
   const d=c>m+2*sd?1:c<m-2*sd?-1:0;if(!d||(d===1?c<t:c>t))return null;return {dir:d,stop:m,close:c};},
 donch:(n)=>(B,i)=>{const c=B[i].close,t=sma(B,i,200);let hi=-1e18,lo=1e18;for(let j=i-n;j<i;j++){hi=Math.max(hi,B[j].high);lo=Math.min(lo,B[j].low);}
   const d=c>hi?1:c<lo?-1:0;if(!d||(d===1?c<t:c>t))return null;const mid=(Math.max(hi,B[i].high)+Math.min(lo,B[i].low))/2;return {dir:d,stop:mid,close:c};},
 keltner:(n,k)=>(B,i,atr)=>{const c=B[i].close,t=sma(B,i,200);let e=B[i-100].close;const a=2/(n+1);for(let j=i-99;j<=i;j++)e=a*B[j].close+(1-a)*e;
   const d=c>e+k*atr?1:c<e-k*atr?-1:0;if(!d||(d===1?c<t:c>t))return null;return {dir:d,stop:e,close:c};},
};
function S(t){const n=t.length;if(!n)return null;const w=t.filter(x=>x.R>0),l=t.filter(x=>x.R<=0);const sw=w.reduce((a,x)=>a+x.R,0),sl=l.reduce((a,x)=>a+x.R,0);
 const o=[...t].sort((a,b)=>a.tExit-b.tExit);let eq=0,pk=0,dd=0;for(const x of o){eq+=x.R;pk=Math.max(pk,eq);dd=Math.max(dd,pk-eq);}
 return {n,win:w.length/n,exp:(sw+sl)/n,aw:w.length?sw/w.length:0,al:l.length?sl/l.length:0,net:sw+sl,pf:sl?sw/-sl:Infinity,dd,best:Math.max(...t.map(x=>x.R))};}
const yr=t=>new Date(t.tExit*1000).getUTCFullYear();
const byYear=(t)=>{const y={};for(const x of t){(y[yr(x)]??=[]).push(x);}return y;};
const monthly=(t)=>{const m={};for(const x of t){const d=new Date(x.tExit*1000);const k=d.getUTCFullYear()*100+d.getUTCMonth();m[k]=(m[k]||0)+x.R;}return m;};
function corr(a,b){const ks=[...new Set([...Object.keys(a),...Object.keys(b)])];const x=ks.map(k=>a[k]||0),y=ks.map(k=>b[k]||0);const n=x.length,mx=x.reduce((p,q)=>p+q)/n,my=y.reduce((p,q)=>p+q)/n;let sxy=0,sxx=0,syy=0;for(let i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)**2;syy+=(y[i]-my)**2;}return sxy/Math.sqrt(sxx*syy);}
module.exports={ROOT,bb,ic,loadC,loadF,gen,SIG,S,byYear,monthly,corr,yr};
