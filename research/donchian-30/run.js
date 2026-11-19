// Multi-coin Donchian trend portfolio, 7 years. node research/donchian-30/run.js
// Writes results.json + REPORT.md next to this file; prints a compact summary only.
const fs=require('fs'),path=require('path');
const C=require('../../candles/candles.js');
const COINS=['BTC','ETH','SOL','XRP','ADA','DOGE','LINK','AVAX','LTC','BNB','TRX','BCH','AAVE','UNI','NEAR','HBAR','XLM','SUI','1000SHIB','ZEC'];
const START=Date.parse('2019-11-18')/86400000|0, END=Date.parse('2026-11-19')/86400000|0;
const FEE=0.0005, SLIP=0.0005, RISK=0.005, GROSS_CAP=3, ATRN=20, STOPATR=2;

// ---- data: daily bars + daily funding sum
const D={};
for(const c of COINS){const a=C.load(c,'1h');const m=new Map();
  for(const b of a){const d=Math.floor(b[0]/86400);let x=m.get(d);if(!x)m.set(d,[d,b[1],b[2],b[3],b[4]]);else{x[2]=Math.max(x[2],b[2]);x[3]=Math.min(x[3],b[3]);x[4]=b[4]}}
  const bars=[...m.values()].sort((p,q)=>p[0]-q[0]);
  const fm=new Map();try{for(const [t,r] of C.funding(c)){const d=Math.floor(t/86400);fm.set(d,(fm.get(d)||0)+r)}}catch(e){}
  // ATR
  const atr=[];let s=0;for(let i=0;i<bars.length;i++){const b=bars[i],pc=i?bars[i-1][4]:b[4];const tr=Math.max(b[2]-b[3],Math.abs(b[2]-pc),Math.abs(b[3]-pc));s=i<ATRN?(s*i+tr)/(i+1):(s*(ATRN-1)+tr)/ATRN;atr.push(s)}
  D[c]={bars,idx:new Map(bars.map((b,i)=>[b[0],i])),fund:fm,atr};
}
const hh=(bars,i,n)=>{let v=-Infinity;for(let j=i-n;j<i;j++)v=Math.max(v,bars[j][2]);return v};
const ll=(bars,i,n)=>{let v=Infinity;for(let j=i-n;j<i;j++)v=Math.min(v,bars[j][3]);return v};

function run(N,M,side,from=START,to=END){
  let cash=1,pos={},trades=[],eq=[],peak=1,mdd=0;
  for(let d=from;d<to;d++){
    // exits first (positions opened earlier)
    for(const c in pos){const p=pos[c],X=D[c],i=X.idx.get(d);if(i===undefined)continue;const b=X.bars[i];
      p.fund+=(X.fund.get(d)||0)*p.qty*b[1]*(p.dir<0?1:-1);
      const ch=p.dir<0?hh(X.bars,i,M):ll(X.bars,i,M);
      const lvl=p.dir<0?Math.min(p.stop,ch):Math.max(p.stop,ch);
      const hit=p.dir<0?b[2]>=lvl:b[3]<=lvl;
      if(hit){let px=p.dir<0?Math.max(lvl,b[1]):Math.min(lvl,b[1]);px*=1-p.dir*SLIP;
        const pnl=p.dir*(px-p.entry)*p.qty-FEE*p.qty*(px+p.entry)+p.fund;cash+=pnl;
        trades.push({c,dir:p.dir,d0:p.d0,d1:d,R:pnl/p.risk,pnl});delete pos[c]}}
    // MTM equity
    let open=0,gross=0;for(const c in pos){const p=pos[c],X=D[c],i=X.idx.get(d);const px=i===undefined?p.last:X.bars[i][4];p.last=px;open+=p.dir*(px-p.entry)*p.qty+p.fund;gross+=p.qty*px}
    const E=cash+open;eq.push([d,E]);peak=Math.max(peak,E);mdd=Math.max(mdd,1-E/peak);
    // entries (stop orders at channel, filled intraday)
    for(const c of COINS){if(pos[c])continue;const X=D[c],i=X.idx.get(d);if(i===undefined||i<Math.max(N,ATRN)+1)continue;const b=X.bars[i],A=X.atr[i-1];
      for(const dir of side==='both'?[1,-1]:side==='short'?[-1]:[1]){
        const lvl=dir>0?hh(X.bars,i,N):ll(X.bars,i,N);
        if(dir>0?b[2]<=lvl:b[3]>=lvl)continue;
        let px=dir>0?Math.max(lvl,b[1]):Math.min(lvl,b[1]);px*=1+dir*SLIP;
        const stop=px-dir*STOPATR*A,risk=RISK*E,qty=risk/(STOPATR*A);
        if(gross+qty*px>GROSS_CAP*E)continue;
        // same-day stop check (conservative)
        if(dir>0?b[3]<=stop:b[2]>=stop){const ex=stop*(1-dir*SLIP);const pnl=dir*(ex-px)*qty-FEE*qty*(px+ex);cash+=pnl;trades.push({c,dir,d0:d,d1:d,R:pnl/risk,pnl});break}
        pos[c]={dir,entry:px,qty,stop,risk,fund:0,d0:d,last:b[4]};gross+=qty*px;break}}
  }
  const yrs=(to-from)/365.25,E=eq[eq.length-1][1];
  const byYear={};let ye=1;for(const [d,e] of eq){const y=new Date(d*864e5).getUTCFullYear();if(!byYear[y])byYear[y]={s:ye};byYear[y].e=e;ye=e}
  for(const y in byYear)byYear[y]=+((byYear[y].e/byYear[y].s-1)*100).toFixed(1);
  const mon={};let me=1;for(const [d,e] of eq){const k=new Date(d*864e5).toISOString().slice(0,7);if(!mon[k])mon[k]={s:me};mon[k].e=e;me=e}
  const mr=Object.values(mon).map(m=>m.e/m.s-1).filter((x,i)=>i>0);
  const dr=[];for(let i=1;i<eq.length;i++)dr.push(eq[i][1]/eq[i-1][1]-1);
  const mean=dr.reduce((a,b)=>a+b,0)/dr.length,sd=Math.sqrt(dr.reduce((a,b)=>a+(b-mean)**2,0)/dr.length);
  const neg=Math.sqrt(dr.filter(x=>x<0).reduce((a,b)=>a+b*b,0)/dr.length);
  var monthly={posPct:mr.filter(x=>x>0).length/mr.length*100,avg:mr.reduce((a,b)=>a+b,0)/mr.length*100,best:Math.max(...mr)*100,worst:Math.min(...mr)*100,median:[...mr].sort((a,b)=>a-b)[mr.length>>1]*100};
  var sharpe=mean/sd*Math.sqrt(365),sortino=mean/neg*Math.sqrt(365);
  let ls=0,cur=0;for(const x of mr){cur=x<0?cur+1:0;ls=Math.max(ls,cur)}var lossStreak=ls;
  const sum=k=>trades.filter(k).reduce((a,t)=>a+t.R,0);
  const sorted=trades.map(t=>t.R).sort((a,b)=>b-a),totR=sorted.reduce((a,b)=>a+b,0);
  return {N,M,side,final:E,cagr:(Math.pow(Math.max(E,1e-9),1/yrs)-1)*100,mdd:mdd*100,trades:trades.length,
    win:trades.filter(t=>t.R>0).length/trades.length*100,avgR:totR/trades.length,longR:sum(t=>t.dir>0),shortR:sum(t=>t.dir<0),
    monthly,mon:Object.fromEntries(Object.entries(mon).map(([k,m])=>[k,(m.e/m.s-1)*100])),sharpe,sortino,lossStreak,tradeList:trades,top10share:sorted.slice(0,10).reduce((a,b)=>a+b,0)/totR*100,byYear,open:Object.entries(pos).map(([c,p])=>c+(p.dir<0?'-S':'-L')+'@'+(+p.entry.toPrecision(5))+' '+new Date(p.d0*864e5).toISOString().slice(5,10))};
}
module.exports={run};
if(require.main===module){
const res=[];
for(const N of [20,30,55])for(const M of [10,15,20])for(const side of ['both','short','long'])if(M<N)res.push(run(N,M,side));
res.sort((a,b)=>b.cagr/b.mdd-a.cagr/a.mdd);
// out-of-sample: pick on 2019-2023, test 2024-2026
const split=Date.parse('2024-01-01')/86400000|0;
const isr=[];for(const N of [20,30,55])for(const M of [10,15,20])for(const side of ['both','short','long'])if(M<N){const r=run(N,M,side,START,split);isr.push(r)}
isr.sort((a,b)=>b.cagr/b.mdd-a.cagr/a.mdd);const pick=isr[0],oos=run(pick.N,pick.M,pick.side,split,END);
fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({res:res.map(({tradeList,...r})=>r),isPick:{...pick,tradeList:undefined},oos:{...oos,tradeList:undefined}},null,1));
const f=x=>x.toFixed(1);
const yrs=Object.keys(res[0].byYear);
let md='# Donchian-30 multi-coin trend portfolio, 7-year backtest\n\nGenerated by `run.js` (Binance 1h → daily, '+COINS.length+' screenshot coins, Nov 2019 – Nov 2026).\nRules: stop-entry at N-day high/low, exit at M-day opposite channel or 2×ATR20 stop, risk '+RISK*100+'% equity per trade, gross ≤ '+GROSS_CAP+'× equity, fee '+FEE*100+'% + slip '+SLIP*100+'% per side, funding included.\n\n';
md+='| N | M | side | CAGR % | max DD % | CAGR/DD | trades | win % | avg R | long R | short R | top10 % | '+yrs.join(' | ')+' |\n|'+'---|'.repeat(12+yrs.length)+'\n';
for(const r of res)md+=`| ${r.N} | ${r.M} | ${r.side} | ${f(r.cagr)} | ${f(r.mdd)} | ${(r.cagr/r.mdd).toFixed(2)} | ${r.trades} | ${f(r.win)} | ${r.avgR.toFixed(2)} | ${f(r.longR)} | ${f(r.shortR)} | ${f(r.top10share)} | ${yrs.map(y=>r.byYear[y]).join(' | ')} |\n`;
md+=`\n## Out-of-sample\nBest on 2019-2023: N=${pick.N} M=${pick.M} ${pick.side} (CAGR ${f(pick.cagr)}%, DD ${f(pick.mdd)}%). On 2024 – Nov 2026: CAGR ${f(oos.cagr)}%, DD ${f(oos.mdd)}%, ${oos.trades} trades, avg ${oos.avgR.toFixed(2)}R.\n`;
const s30=res.find(r=>r.N===30&&r.M===15&&r.side==='short');md+=`\n## Screenshot check (N=30 M=15 short) open on 2026-11-18\n${s30.open.join(', ')}\n`;
fs.writeFileSync(path.join(__dirname,'REPORT.md'),md);
console.log('cfg        CAGR   DD   C/DD trades avgR  top10% | years');
for(const r of res.slice(0,27))console.log(`${r.N}/${r.M} ${r.side.padEnd(5)} ${f(r.cagr).padStart(6)} ${f(r.mdd).padStart(5)} ${(r.cagr/r.mdd).toFixed(2)} ${String(r.trades).padStart(5)} ${r.avgR.toFixed(2).padStart(5)} ${f(r.top10share).padStart(5)} | ${yrs.map(y=>r.byYear[y]).join(' ')}`);
console.log('OOS pick',pick.N,pick.M,pick.side,'-> 2024-26 CAGR',f(oos.cagr),'DD',f(oos.mdd),'avgR',oos.avgR.toFixed(2));
console.log('30/15 short open now:',s30.open.join(', '));

const full=y=>Object.entries(y).filter(([k])=>k>'2019');
const rank=res.map(r=>({...r,calmar:r.cagr/r.mdd,posY:full(r.byYear).filter(([,v])=>v>0).length,nY:full(r.byYear).length}));
rank.sort((a,b)=>b.sharpe-a.sharpe);
let t='\n## Ranking (by Sharpe)\n\n| # | N/M side | CAGR % | max DD % | CAGR/DD | Sharpe | Sortino | positive years | positive months % | avg month % | median month % | best month % | worst month % | longest losing months | trades | avg R | top10 share % |\n|'+'---|'.repeat(17)+'\n';
rank.forEach((r,i)=>t+=`| ${i+1} | ${r.N}/${r.M} ${r.side} | ${f(r.cagr)} | ${f(r.mdd)} | ${r.calmar.toFixed(2)} | ${r.sharpe.toFixed(2)} | ${r.sortino.toFixed(2)} | ${r.posY}/${r.nY} | ${f(r.monthly.posPct)} | ${f(r.monthly.avg)} | ${f(r.monthly.median)} | ${f(r.monthly.best)} | ${f(r.monthly.worst)} | ${r.lossStreak} | ${r.trades} | ${r.avgR.toFixed(2)} | ${f(r.top10share)} |\n`);
fs.appendFileSync(path.join(__dirname,'REPORT.md'),t);
console.log(t);

let mt='';
for(const r of rank.slice(0,3)){
 mt+='\n## Monthly returns %: '+r.N+'/'+r.M+' '+r.side+' (rank by Sharpe)\n\n| Year | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec | Year |\n|'+'---|'.repeat(14)+'\n';
 for(const y of Object.keys(r.byYear).filter(y=>y>'2019')){const row=[];for(let m=1;m<=12;m++){const v=r.mon[y+'-'+String(m).padStart(2,'0')];row.push(v===undefined?'':(v>=0?'+':'')+v.toFixed(1))}
  mt+='| '+y+' | '+row.join(' | ')+' | **'+(r.byYear[y]>=0?'+':'')+r.byYear[y]+'** |\n'}}
fs.appendFileSync(path.join(__dirname,'REPORT.md'),mt);console.log(mt);

}
