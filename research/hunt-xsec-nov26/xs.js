// xs.js - cross-sectional backtester. Units: % of gross notional (gross=1, long leg 0.5 + short leg 0.5), non-compounded.
// Signals computed on closed 1h bar i (close known), fills at open of bar i+1. Cost 0.05% fee + 0.02% slip per side on traded notional.
'use strict';
const C = require('../../candles/candles.js');
const MAIN = ['BTC','ETH','SOL','ADA','XRP','LINK','BNB','DOGE','AVAX','DOT','NEAR','ZEC'];
const HOLD = ['LTC','BCH','TRX','ETC','XLM','ATOM','UNI','FIL','AAVE','ALGO','XTZ','VET'];
const YEARS = [2020,2021,2022,2023,2024,2025,2026];
const T0 = Date.parse('2020-01-01')/1000, IV = 3600;
const raw = {};
function loadCoin(s){ if(raw[s]) return raw[s]; const B=C.load(s,'1h',{from:T0}); const f=C.funding(s); raw[s]={B,f}; return raw[s]; }
// panel over given coins, bars from T0 to last
function panel(coins){
  let tEnd=0; for(const s of coins){const {B}=loadCoin(s); tEnd=Math.max(tEnd,B[B.length-1][0]);}
  const n=Math.floor((tEnd-T0)/IV)+1, P={coins,n,O:{},Cl:{},F:{},time:Float64Array.from({length:n},(_,i)=>T0+i*IV)};
  for(const s of coins){const {B,f}=loadCoin(s);const O=new Float64Array(n).fill(NaN),Cl=new Float64Array(n).fill(NaN),F=new Float64Array(n);
    for(const r of B){const i=(r[0]-T0)/IV; if(i>=0&&i<n){O[i]=r[1];Cl[i]=r[4];}}
    for(const [t,rate] of f){const i=Math.floor((t-T0)/IV); if(i>=0&&i<n)F[i]+=rate;}
    P.O[s]=O;P.Cl[s]=Cl;P.F[s]=F;}
  return P;
}
function slicePanel(P,cut){const Q={coins:P.coins,n:cut,O:{},Cl:{},F:{},time:P.time.slice(0,cut)};for(const s of P.coins){Q.O[s]=P.O[s].slice(0,cut);Q.Cl[s]=P.Cl[s].slice(0,cut);Q.F[s]=P.F[s].slice(0,cut);}return Q;}
const nz=x=>x!==x?NaN:x;
// ---- signals: score(P, s, i, p) -> number (higher = long). all use data <= i
const SIG={
  mom:(P,s,i,p)=>{const c=P.Cl[s];return c[i]/c[i-p.L]-1;},
  rev:(P,s,i,p)=>-(P.Cl[s][i]/P.Cl[s][i-p.L]-1),
  lowvol:(P,s,i,p)=>{const c=P.Cl[s];let a=0,b=0;for(let k=i-p.L+1;k<=i;k++){const r=Math.log(c[k]/c[k-1]);a+=r;b+=r*r;}const m=a/p.L;return -Math.sqrt(Math.max(0,b/p.L-m*m));},
  fund:(P,s,i,p)=>{const f=P.F[s];let a=0;for(let k=i-p.L+1;k<=i;k++)a+=f[k];return -a;}, // long the lowest funding
  // residual momentum vs equal-weight market; beta from 720h hourly returns
  resmom:(P,s,i,p)=>{ // beta-adjusted: ret_L - beta*mkt_L
    const W=p.BW||720,c=P.Cl[s];let sxy=0,sxx=0;const others=P.coins;
    const mk=(k)=>{let a=0,m=0;for(const q of others){const x=P.Cl[q][k]/P.Cl[q][k-1]-1;if(x===x){a+=x;m++;}}return m?a/m:NaN;};
    for(let k=i-W+1;k<=i;k+=1){const x=c[k]/c[k-1]-1,y=mk(k);sxy+=x*y;sxx+=y*y;}
    const beta=sxy/sxx; let mr=0;for(const q of others){const x=P.Cl[q][i]/P.Cl[q][i-p.L]-1;mr+=x;}mr/=others.length;
    return (c[i]/c[i-p.L]-1)-beta*mr;},
  btcrel:(P,s,i,p)=>{const c=P.Cl[s],b=P.Cl.BTC||P.Cl[P.coins[0]];return (c[i]/c[i-p.L])/(b[i]/b[i-p.L])-1;},
};
// decide target weights at bar i. returns {coin:w} or null
function weights(P,i,p){
  const sc=[];for(const s of P.coins){ if(!(P.O[s][i+1]===P.O[s][i+1]) )continue; const lb=Math.max(p.mix?Math.max(...p.mix.map(m=>m.L)):p.L,p.BW||0)+2; if(!(i-lb>=0)||!(P.Cl[s][i-lb]===P.Cl[s][i-lb]))continue; let v; if(p.mix){v=0;for(const m of p.mix){const q=SIG[m.sig](P,s,i,{...p,...m});if(!(q===q)){v=NaN;break;}v=v;m.__t=0;} if(v===v)v=0; } else v=SIG[p.sig](P,s,i,p); if(p.mix){let ok=true;const vs=p.mix.map(m=>{const q=SIG[m.sig](P,s,i,{...p,...m});if(!(q===q))ok=false;return q;});if(ok)sc.push([s,vs]);} else if(v===v)sc.push([s,v]);}
  const N=p.N; if(sc.length<2*N)return null; if(p.mix){const k=p.mix.length;const tot=new Map(sc.map(x=>[x[0],0]));for(let m=0;m<k;m++){const o=[...sc].sort((a,b)=>b[1][m]-a[1][m]);o.forEach((x,r)=>tot.set(x[0],tot.get(x[0])+(p.mix[m].wt||1)*(sc.length-r)));}sc.forEach(x=>x[1]=tot.get(x[0]));} sc.sort((a,b)=>b[1]-a[1]);
  const w={};const lg=sc.slice(0,N),sh=sc.slice(-N);for(const [s] of lg)w[s]=(w[s]||0)+0.5/N;for(const [s] of sh)w[s]=(w[s]||0)-0.5/N;
  if(p.sign===-1){for(const s in w)w[s]=-w[s];}
  return w;
}
// backtest. returns {periods:[{t,pnl}], hourly pnl by bar via periods, decisions}
function bt(P,p,costMul=1,wantDec=false){
  const cost=0.0007*costMul, R=p.R, periods=[], dec=[];
  let cur={}; let i=Math.max(p.mix?Math.max(...p.mix.map(m=>m.L)):p.L,p.BW||0)+3; i=Math.ceil(i/R)*R; // rebalance grid aligned to hour index multiples of R
  for(;i+1<P.n;i+=R){
    const w=weights(P,i,p)||{}; if(wantDec)dec.push([i,JSON.stringify(w)]);
    // turnover vs drifted cur
    let to=0;const keys=new Set([...Object.keys(w),...Object.keys(cur)]);for(const k of keys)to+=Math.abs((w[k]||0)-(cur[k]||0));
    let pnl=-to*cost, E=1, wt={...w};
    const end=Math.min(i+1+R,P.n-1); // hold from open[i+1] to open[end]
    for(let j=i+1;j<end;j++){let g=0,fnd=0;for(const k in wt){const o0=P.O[k][j],o1=P.O[k][j+1];let r=o1/o0-1;if(r!==r)r=0;g+=wt[k]*r;fnd+=wt[k]*P.F[k][j];}
      const inc=E*(g-fnd);pnl+=inc;const d=1+g;for(const k in wt){const o0=P.O[k][j],o1=P.O[k][j+1];let r=o1/o0-1;if(r!==r)r=0;wt[k]=wt[k]*(1+r)/d;}E*=d;}
    // drifted weights relative to capital at end
    cur={};for(const k in wt)cur[k]=wt[k];
    periods.push({t:P.time[i+1],pnl});
  }
  return wantDec?{periods,dec}:{periods};
}
const yr=t=>new Date(t*1000).getUTCFullYear();
function yearly(periods){const y={};for(const q of periods){const k=yr(q.t);y[k]=(y[k]||0)+q.pnl;}return YEARS.map(k=>(y[k]||0)*100);}
function monthly(periods){const m={};for(const q of periods){const d=new Date(q.t*1000);const k=d.getUTCFullYear()*100+d.getUTCMonth()+1;m[k]=(m[k]||0)+q.pnl;}return m;}
module.exports={MAIN,HOLD,YEARS,panel,slicePanel,bt,yearly,monthly,SIG,weights,yr};
