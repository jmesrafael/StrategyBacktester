const L=require('./lib.js');const f=(v,d=3)=>(v>=0?'+':'')+v.toFixed(d);
const five=['SOL','ZEC','NEAR','ADA','GALA'],other=['AVAX','BNB','DOGE','ETH','LINK','LTC','XRP'];
const D5={};for(const c of five)D5[c]={B:L.loadC(L.ROOT+`bb-core/data/${c}.json`),F:L.loadF(L.ROOT+`bb-core/data/funding/${c}.json`)};
const DO={};for(const c of other)DO[c]={B:L.loadC(L.ROOT+`StrategyBacktester/research/big-swings/data/${c}.json`),F:null};
const bt=(D,cs,tr,cost)=>cs.flatMap(c=>L.bb.backtest(D[c].B,{targetR:tr,...(cost?{cost}:{})},D[c].F).trades);
console.log('1) OTHER COINS never used in the BB-Core design (no funding data, same fees/slippage)');
console.log('coin   1:4 expR (n)        A expR (n)       A-1:4');
let ta=[],tb=[];for(const c of other){const a=bt(DO,[c],4),b=bt(DO,[c],0);ta.push(...a);tb.push(...b);const x=L.S(a),y=L.S(b);console.log(c.padEnd(5),f(x.exp).padStart(8),`(${x.n})`.padEnd(7),f(y.exp).padStart(8),`(${y.n})`.padEnd(7),f(y.exp-x.exp));}
{const x=L.S(ta),y=L.S(tb);console.log('ALL 7 ',f(x.exp),`(${x.n})  win ${(x.win*100).toFixed(1)}%  net ${f(x.net,0)}R  DD -${x.dd.toFixed(0)}  |  A ${f(y.exp)} (${y.n}) win ${(y.win*100).toFixed(1)}% net ${f(y.net,0)}R DD -${y.dd.toFixed(0)}`);
 const ya=L.byYear(ta),yb=L.byYear(tb);console.log('by year net R  1:4 vs A: '+Object.keys(ya).sort().map(Y=>`${Y} ${f(ya[Y].reduce((a,t)=>a+t.R,0),0)}/${f((yb[Y]||[]).reduce((a,t)=>a+t.R,0),0)}`).join(' | '));}
console.log('\n2) COST STRESS on the 5 traded coins (fees+slippage multiplied)');
for(const k of [1,2,3]){const base=L.bb.DEFAULTS.cost,c={...base,entryFee:base.entryFee*k,stopFee:base.stopFee*k,timeFee:base.timeFee*k,tpFee:base.tpFee*k,slip:base.slip*k};
 const a=L.S(bt(D5,five,4,c)),b=L.S(bt(D5,five,0,c));console.log(`x${k}:  1:4 expR ${f(a.exp)} net ${f(a.net,0)}R  |  A expR ${f(b.exp)} net ${f(b.net,0)}R  |  A better by ${f(b.exp-a.exp)}R/trade`);}
console.log('\n3) A vs 1:4 by coin and year (net R): how often is A ahead?');
let w=0,n=0;const ys=[2020,2021,2022,2023,2024,2025,2026];
for(const c of five){const a=L.byYear(bt(D5,[c],4)),b=L.byYear(bt(D5,[c],0));let line=c.padEnd(5);for(const Y of ys){const x=(a[Y]||[]).reduce((p,t)=>p+t.R,0),y=(b[Y]||[]).reduce((p,t)=>p+t.R,0);if(!a[Y]&&!b[Y]){line+='    -  ';continue;}n++;if(y>x)w++;line+=(y>x?' A+':' 4-')+String(Math.round(y-x)).padStart(4);}console.log(line);}
console.log(`A ahead in ${w} of ${n} coin-years`);
console.log('\n4) Without GALA (the coin carrying the 2021 spike):');
{const a=L.S(bt(D5,five.filter(c=>c!=='GALA'),4)),b=L.S(bt(D5,five.filter(c=>c!=='GALA'),0));console.log(`1:4 expR ${f(a.exp)} net ${f(a.net,0)}R DD -${a.dd.toFixed(0)}  |  A expR ${f(b.exp)} net ${f(b.net,0)}R DD -${b.dd.toFixed(0)}`);}
console.log('\n5) A with biggest winners removed (top N trades dropped), 5 coins:');
{const a=bt(D5,five,4).map(t=>t.R).sort((x,y)=>y-x),b=bt(D5,five,0).map(t=>t.R).sort((x,y)=>y-x);for(const N of [0,5,10,20]){const A=a.slice(N),B=b.slice(N);console.log(`drop top ${String(N).padStart(2)}:  1:4 exp ${f(A.reduce((p,q)=>p+q)/A.length)}   A exp ${f(B.reduce((p,q)=>p+q)/B.length)}`);}}
console.log('\n6) Bootstrap (trades resampled with replacement, 5 coins): chance A expectancy > 1:4 expectancy');
{const a=bt(D5,five,4).map(t=>t.R),b=bt(D5,five,0).map(t=>t.R);let seed=7;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;const m=(x)=>{let s=0;for(let i=0;i<x.length;i++)s+=x[Math.floor(rnd()*x.length)];return s/x.length;};let win=0;const N=2000,dif=[];for(let k=0;k<N;k++){const d=m(b)-m(a);dif.push(d);if(d>0)win++;}dif.sort((x,y)=>x-y);console.log(`A > 1:4 in ${(100*win/N).toFixed(1)}% of resamples; 95% interval of the difference ${f(dif[50])} to ${f(dif[1949])} R/trade`);}
