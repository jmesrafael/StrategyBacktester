// growth.js — NO $10 cap: 2.5% of the balance on every trade, compounding. (1) one account from ₱10,000 in 2020 to Oct 2026, (2) fresh ₱10,000 each year,
// (3) the three tandems (two ₱10,000 accounts). Also the position size each trade would need, to show where the backtest stops being realistic.
const L=require('./lib.js');const five=['SOL','ZEC','NEAR','ADA','GALA'];const RISK=0.025,START=10000,PHP=58;
const D={};for(const c of five)D[c]={B:L.loadC(L.ROOT+`bb-core/data/${c}.json`),F:L.loadF(L.ROOT+`bb-core/data/funding/${c}.json`),I:L.loadC(L.ROOT+`i-core/data/${c}.json`)};
const tag=(c,t)=>t.map(x=>({...x,coin:c}));
const S3={'BB 1:4':five.flatMap(c=>tag(c,L.bb.backtest(D[c].B,{targetR:4},D[c].F).trades)),'BB no-target':five.flatMap(c=>tag(c,L.bb.backtest(D[c].B,{targetR:0},D[c].F).trades)),'I-Core':five.flatMap(c=>tag(c,L.ic.backtest(D[c].I).trades))};
const peso=v=>{const a=Math.abs(v),s=v<0?'-₱':'₱';return a>=1e9?s+(a/1e9).toFixed(2)+'B':a>=1e6?s+(a/1e6).toFixed(2)+'M':a>=1e3?s+(a/1e3).toFixed(1)+'k':s+Math.round(a);};
const ys=y=>Date.UTC(y,0,1)/1000,Y=[2020,2021,2022,2023,2024,2025,2026];
// accounts = list of trade lists, each its own account; returns balance at each year end, deepest drop, when it happened, and the biggest single position (notional, $)
function run(lists,from=-Infinity,to=Infinity){const bal=lists.map(()=>START),ev=[],risk=new Map();
 lists.forEach((T,j)=>T.forEach((t,k)=>{if(t.t>=from&&t.t<to){ev.push([t.t,1,j,k]);ev.push([t.tExit,0,j,k]);}}));ev.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 let pk=START*lists.length,pkT=null,dd=0,ddFrom=null,ddAt=null,maxNotional=0;const yEnd={};
 for(const[t,typ,j,k]of ev){const T=lists[j][k],key=j+':'+k;
  if(typ===1){const r=bal[j]*RISK;risk.set(key,r);const dist=Math.abs(T.entry-T.stop0??T.stop)/T.entry||null;}
  else{bal[j]+=T.R*risk.get(key);const eq=bal.reduce((a,b)=>a+b,0);if(eq>pk){pk=eq;pkT=t;}if(1-eq/pk>dd){dd=1-eq/pk;ddFrom=pkT;ddAt=t;}yEnd[new Date(t*1000).getUTCFullYear()]=eq;}}
 return {end:bal.reduce((a,b)=>a+b,0),dd,ddFrom,ddAt,yEnd};}
const mo=t=>t?new Date(t*1000).toISOString().slice(0,7):'-';
console.log('1) ONE account, ₱10,000 on Jan 1 2020, 2.5% of the balance per trade, NO cap. Balance at the end of each year:');
console.log('strategy        '+Y.map(y=>String(y).padStart(10)).join('')+'   deepest drop (peak -> bottom)');
for(const[k,t]of Object.entries(S3)){const r=run([t]);console.log(k.padEnd(16)+Y.map(y=>peso(r.yEnd[y]).padStart(10)).join('')+`   ${(r.dd*100).toFixed(0)}% (${mo(r.ddFrom)} -> ${mo(r.ddAt)})`);}
console.log('\n2) FRESH ₱10,000 every Jan 1, no cap: profit made that year (deepest drop inside the year)');
console.log('strategy        '+Y.map(y=>String(y).padStart(16)).join('')+'      sum     w/o 2021');
const yr={};
for(const[k,t]of Object.entries(S3)){yr[k]={};let line=k.padEnd(16),sum=0;for(const y of Y){const r=run([t],ys(y),ys(y+1));yr[k][y]=r;sum+=r.end-START;line+=`${peso(r.end-START)} (${(r.dd*100).toFixed(0)}%)`.padStart(16);}console.log(line+peso(sum).padStart(9)+peso(sum-(yr[k][2021].end-START)).padStart(11));}
console.log('\n3) TANDEMS, two accounts of ₱10,000 (₱20,000), no cap');
console.log('   a) one run from Jan 2020: combined balance at each year end');
const pairs=[['BB no-target','I-Core'],['BB 1:4','I-Core'],['BB 1:4','BB no-target']];
for(const[a,b]of pairs){const r=run([S3[a],S3[b]]);console.log(`   ${(a+' + '+b).padEnd(26)}`+Y.map(y=>peso(r.yEnd[y]).padStart(10)).join('')+`   drop ${(r.dd*100).toFixed(0)}% (${mo(r.ddFrom)} -> ${mo(r.ddAt)})`);}
console.log('   b) fresh ₱20,000 every year: profit that year');
for(const[a,b]of pairs){let line=`   ${(a+' + '+b).padEnd(26)}`,sum=0,s21=0,w=Infinity,ddm=0;for(const y of Y){const r=run([S3[a],S3[b]],ys(y),ys(y+1));const p=r.end-2*START;sum+=p;if(y===2021)s21=p;w=Math.min(w,p);ddm=Math.max(ddm,r.dd);line+=peso(p).padStart(10);}console.log(line+`   sum ${peso(sum)} · w/o 2021 ${peso(sum-s21)} · worst year ${peso(w)} · worst drop in a year ${(ddm*100).toFixed(0)}%`);}
// realism: notional of a 2.5% risk at the median stop distance, at a few balances
console.log('\n4) Where it stops being realistic: position size needed for a 2.5% risk (median stop distance of each strategy)');
for(const[k,t]of Object.entries(S3)){const d=t.map(x=>Math.abs(x.entry-(x.stop0??x.stop))/x.entry).sort((a,b)=>a-b),md=d[d.length>>1];
 console.log(`   ${k.padEnd(14)} median stop ${(md*100).toFixed(1)}% away -> position = 2.5% / ${(md*100).toFixed(1)}% = ${(RISK/md).toFixed(2)}x the balance: `+[1e5,1e6,1e7,1e8].map(b=>`${peso(b)} balance -> $${Math.round(b*RISK/md/PHP).toLocaleString('en-US')} per trade`).join(' · '));}
