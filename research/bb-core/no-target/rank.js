// rank.js — BB 1:4 vs BB no-target (A) vs I-Core: yearly peso results at 2.5% risk, robustness without the best years, and every tandem of two.
const L=require('./lib.js');const five=['SOL','ZEC','NEAR','ADA','GALA'],other=['AVAX','BNB','DOGE','ETH','LINK','LTC','XRP'];
const RISK=0.025,START=10000,CAP=+(process.env.CAP||Infinity);   // CAP = the bots' maxRiskUsd in pesos ($10 x ~58 = 580)
const D={};for(const c of five)D[c]={B:L.loadC(L.ROOT+`bb-core/data/${c}.json`),F:L.loadF(L.ROOT+`bb-core/data/funding/${c}.json`),I:L.loadC(L.ROOT+`i-core/data/${c}.json`)};
const S3={
 'BB 1:4':five.flatMap(c=>L.bb.backtest(D[c].B,{targetR:4},D[c].F).trades),
 'BB no-target':five.flatMap(c=>L.bb.backtest(D[c].B,{targetR:0},D[c].F).trades),
 'I-Core':five.flatMap(c=>L.ic.backtest(D[c].I).trades),
};
const f=(v,d=2)=>(v>=0?'+':'')+v.toFixed(d),peso=v=>(v<0?'-₱':'₱')+Math.round(Math.abs(v)).toLocaleString('en-US');
// compounding account: risk 2.5% of the REALIZED balance at entry, PnL booked at exit; exits before entries on the same timestamp
function account(trades,start,from=-Infinity,to=Infinity){
  const ev=[];trades.forEach((t,k)=>{if(t.t>=from&&t.t<to){ev.push([t.t,1,k]);ev.push([t.tExit,0,k]);}});ev.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let bal=start,pk=start,dd=0;const risk={};
  for(const[,typ,k]of ev){if(typ===1)risk[k]=Math.min(CAP,bal*RISK);else{bal+=trades[k].R*risk[k];pk=Math.max(pk,bal);dd=Math.max(dd,1-bal/pk);}}
  return {end:bal,dd};
}
const Y=[2020,2021,2022,2023,2024,2025,2026],ys=y=>Date.UTC(y,0,1)/1000;
console.log(`A) ₱${START.toLocaleString()} fresh at the start of EACH year, ${RISK*100}% risk per trade (compounding inside the year), trades by ENTRY year`);
console.log('strategy        '+Y.map(y=>String(y).padStart(17)).join(''));
const yearly={};
for(const[k,t]of Object.entries(S3)){yearly[k]={};let line=k.padEnd(16);for(const y of Y){const a=account(t,START,ys(y),ys(y+1));yearly[k][y]=a;line+=(peso(a.end-START)+' ('+(a.dd*100).toFixed(0)+'%dd)').padStart(17);}console.log(line);}
console.log('(₱ = profit on the ₱10,000 that year; dd = deepest drop from the peak inside that year. 2020 partial for every coin, 2026 to late Oct; I-Core needs 205 candles of warm-up)');
console.log('\nB) R per trade and robustness');
console.log('strategy        trades  win%   expR   avgWin  avgLoss  netR   maxDD_R | best year      | w/o best year expR  | w/o best 2 years expR | w/o top10 trades expR | top10 = % of profit | worst year R');
const ry={};
for(const[k,t]of Object.entries(S3)){const s=L.S(t),by=L.byYear(t),yr=Object.entries(by).map(([y,v])=>[+y,v.reduce((a,x)=>a+x.R,0),v.length]).sort((a,b)=>b[1]-a[1]);ry[k]=yr;
 const ex1=t.filter(x=>L.yr(x)!==yr[0][0]),ex2=t.filter(x=>L.yr(x)!==yr[0][0]&&L.yr(x)!==yr[1][0]);const Rs=t.map(x=>x.R).sort((a,b)=>b-a),tot=Rs.reduce((a,b)=>a+b,0),r10=Rs.slice(10);
 const worst=yr[yr.length-1];
 console.log(k.padEnd(16),String(s.n).padStart(5),(s.win*100).toFixed(1).padStart(6),f(s.exp,3).padStart(7),f(s.aw).padStart(7),f(s.al).padStart(8),f(s.net,0).padStart(6),('-'+s.dd.toFixed(0)).padStart(7),'|',`${yr[0][0]} ${f(yr[0][1],0)}R`.padEnd(14),'|',f(L.S(ex1).exp,3).padStart(10),`(${f(L.S(ex1).net,0)}R)`.padEnd(9),'|',f(L.S(ex2).exp,3).padStart(10),`(${f(L.S(ex2).net,0)}R)`.padEnd(11),'|',f(r10.reduce((a,b)=>a+b,0)/r10.length,3).padStart(12),'          |',(100*Rs.slice(0,10).reduce((a,b)=>a+b,0)/tot).toFixed(0).padStart(6)+'%','            |',`${worst[0]} ${f(worst[1],0)}R`);}
console.log('\nC) Whole period on ONE ₱10,000 account from 2020, 2.5% risk compounding (shows what drawdowns feel like in %)');
for(const[k,t]of Object.entries(S3)){const a=account(t,START);console.log(k.padEnd(16),'end',peso(a.end).padStart(14),' max drop from peak',(a.dd*100).toFixed(1)+'%');}
console.log('\nD) Seven coins never used to design any of the three (AVAX BNB DOGE ETH LINK LTC XRP; no funding data)');
{const O={};for(const c of other)O[c]=L.loadC(L.ROOT+`StrategyBacktester/research/big-swings/data/${c}.json`);
 const o3={'BB 1:4':other.flatMap(c=>L.bb.backtest(O[c],{targetR:4}).trades),'BB no-target':other.flatMap(c=>L.bb.backtest(O[c],{targetR:0}).trades),'I-Core':other.flatMap(c=>L.ic.backtest(O[c]).trades)};
 for(const[k,t]of Object.entries(o3)){const s=L.S(t),by=L.byYear(t),neg=Object.values(by).filter(v=>v.reduce((a,x)=>a+x.R,0)<0).length;const pc=other.map(c=>{const tt=(k==='I-Core'?L.ic.backtest(O[c]).trades:L.bb.backtest(O[c],{targetR:k==='BB 1:4'?4:0}).trades);return L.S(tt).exp>0?1:0}).reduce((a,b)=>a+b,0);
  console.log(k.padEnd(16),`expR ${f(s.exp,3)}  net ${f(s.net,0)}R  maxDD -${s.dd.toFixed(0)}R  win ${(s.win*100).toFixed(0)}%  losing years ${neg}/${Object.keys(by).length}  coins positive ${pc}/7`);}}
console.log('\nE) TANDEMS: two bots, ₱10,000 each (₱20,000 total), 2.5% risk each, results by entry year');
const mon={};for(const k of Object.keys(S3))mon[k]=L.monthly(S3[k]);
const pairs=[['BB no-target','I-Core'],['BB 1:4','I-Core'],['BB 1:4','BB no-target']];
console.log('pair                       corr  '+Y.map(y=>String(y).padStart(10)).join('')+'   total ₱ (sum of years)  worst year  pooled expR  pooled DD_R | w/o best year ₱');
for(const[a,b]of pairs){let line=`${a} + ${b}`.padEnd(26)+L.corr(mon[a],mon[b]).toFixed(2).padStart(5)+'  ';const vals=[];
 for(const y of Y){const v=(yearly[a][y].end-START)+(yearly[b][y].end-START);vals.push([y,v]);line+=peso(v).padStart(10);}
 const tot=vals.reduce((p,q)=>p+q[1],0),worst=vals.reduce((p,q)=>q[1]<p[1]?q:p),best=vals.reduce((p,q)=>q[1]>p[1]?q:p),pool=L.S([...S3[a],...S3[b]]);
 console.log(line+'   '+peso(tot).padStart(12)+'           '+(worst[0]+' '+peso(worst[1])).padEnd(12)+f(pool.exp,3).padStart(8)+('-'+pool.dd.toFixed(0)).padStart(11)+'      | '+peso(tot-best[1])+` (no ${best[0]})`);}
console.log('(BB 1:4 + BB no-target is shown only for completeness: same signal, same coins, they would take the same entries)');
