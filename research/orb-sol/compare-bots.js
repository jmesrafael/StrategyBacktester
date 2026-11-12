// G vs the live bots (backtest trades from ../zec-replacement-2/trades-fill.json), same coins, same window.
const fs=require('fs'),{run}=require('./engine');
const BT=JSON.parse(fs.readFileSync('../zec-replacement-2/trades-fill.json'));
const KEEP=['SOL','NEAR','ADA','GALA'];
const T0=Date.UTC(2020,9,20)/1000, T1=Date.UTC(2026,10,11)/1000;
const G={tf:240,session:'ldn',orBars:1,stop:'mid',target:3,entry:'close',dir:'long',filters:['vwap','rvol','pd']};
const bots={
 'BB-CORE':KEEP.flatMap(c=>BT[c+'|BB-CORE']),
 'I-CORE':KEEP.flatMap(c=>BT[c+'|I-CORE']),
 'T-CORE':[...KEEP,'ETH'].flatMap(c=>BT[c+'|T-CORE']),
 'G (ORB)':KEEP.flatMap(c=>run({...G,coin:c}).trades.map(t=>({tExit:t.tExit,R:t.R}))),
};
for(const k in bots) bots[k]=bots[k].filter(t=>t.tExit>=T0&&t.tExit<T1).sort((a,b)=>a.tExit-b.tExit);
const mk=t=>{const d=new Date(t*1e3);return d.getUTCFullYear()*12+d.getUTCMonth()};
const m0=mk(T0),m1=mk(T1-1),NM=m1-m0+1;
const monthly=tr=>{const M=new Array(NM).fill(0);tr.forEach(t=>M[mk(t.tExit)-m0]+=t.R);return M};
const dd=tr=>{let e=0,p=0,d=0;tr.forEach(t=>{e+=t.R;p=Math.max(p,e);d=Math.max(d,p-e)});return d};
const M=Object.fromEntries(Object.entries(bots).map(([k,v])=>[k,monthly(v)]));
const years=[...new Set([...Array(NM)].map((_,i)=>Math.floor((m0+i)/12)))];
const ysum=(Mx,y)=>Mx.reduce((a,v,i)=>Math.floor((m0+i)/12)===y?a+v:a,0);
const r=x=>(x>=0?'+':'')+x.toFixed(1);
console.log('Window Oct 20 2020 - Nov 10 2026. R = risk units, each bot 1R per trade on its own coins.\n');
console.log('YEARLY R    '+Object.keys(bots).map(k=>k.padStart(10)).join(''));
for(const y of years) console.log(String(y).padEnd(12)+Object.keys(bots).map(k=>r(ysum(M[k],y)).padStart(10)).join(''));
console.log('TOTAL       '+Object.keys(bots).map(k=>r(M[k].reduce((a,b)=>a+b,0)).padStart(10)).join(''));
console.log('trades      '+Object.keys(bots).map(k=>String(bots[k].length).padStart(10)).join(''));
console.log('win %       '+Object.keys(bots).map(k=>((bots[k].filter(t=>t.R>0).length/bots[k].length*100).toFixed(0)+'%').padStart(10)).join(''));
console.log('avg R/trade '+Object.keys(bots).map(k=>(bots[k].reduce((a,t)=>a+t.R,0)/bots[k].length).toFixed(3).padStart(10)).join(''));
console.log('max DD (R)  '+Object.keys(bots).map(k=>dd(bots[k]).toFixed(1).padStart(10)).join(''));
console.log('+months     '+Object.keys(bots).map(k=>(M[k].filter(v=>v>0).length+'/'+NM).padStart(10)).join(''));
console.log('+years      '+Object.keys(bots).map(k=>(years.filter(y=>ysum(M[k],y)>0).length+'/'+years.length).padStart(10)).join(''));
// correlation & bad-month help
const corr=(x,y)=>{const n=x.length,mx=x.reduce((a,b)=>a+b)/n,my=y.reduce((a,b)=>a+b)/n;let s=0,a=0,b=0;for(let i=0;i<n;i++){s+=(x[i]-mx)*(y[i]-my);a+=(x[i]-mx)**2;b+=(y[i]-my)**2}return s/Math.sqrt(a*b)};
const TRI=M['BB-CORE'].map((v,i)=>0.5*v+0.25*M['I-CORE'][i]+0.25*M['T-CORE'][i]);
console.log('\nMonthly correlation of G with: BB-CORE '+corr(M['G (ORB)'],M['BB-CORE']).toFixed(2)+', I-CORE '+corr(M['G (ORB)'],M['I-CORE']).toFixed(2)+', T-CORE '+corr(M['G (ORB)'],M['T-CORE']).toFixed(2)+', TRI-CORE '+corr(M['G (ORB)'],TRI).toFixed(2));
const bad=TRI.map((v,i)=>[v,M['G (ORB)'][i]]).filter(x=>x[0]<0);
console.log(`TRI-CORE losing months: ${bad.length}. G in those months: positive ${bad.filter(x=>x[1]>0).length}, total ${r(bad.reduce((a,x)=>a+x[1],0))}R (TRI-CORE lost ${r(bad.reduce((a,x)=>a+x[0],0))}R weighted)`);
const good=TRI.map((v,i)=>[v,M['G (ORB)'][i]]).filter(x=>x[0]>0);
console.log(`TRI-CORE winning months: ${good.length}. G in those months: total ${r(good.reduce((a,x)=>a+x[1],0))}R`);
// combined account: % of equity per month at 1% risk per trade per sleeve (no compounding)
const combo=(w)=>{const P=[...Array(NM)].map((_,i)=>w.bb*M['BB-CORE'][i]+w.ic*M['I-CORE'][i]+w.tc*M['T-CORE'][i]+w.g*M['G (ORB)'][i]);let e=0,p=0,d=0,worst=0;P.forEach(v=>{e+=v;p=Math.max(p,e);d=Math.max(d,p-e);worst=Math.min(worst,v)});
  const yr=years.map(y=>P.reduce((a,v,i)=>Math.floor((m0+i)/12)===y?a+v:a,0));return {tot:e,dd:d,pos:P.filter(v=>v>0).length,worst,yr,rdd:e/d}};
console.log('\nCOMBINED ACCOUNT (% of equity, 1% risk per trade inside each sleeve, simple sum, month-end)');
for(const [nm,w] of [['TRI-CORE 50/25/25',{bb:.5,ic:.25,tc:.25,g:0}],['TRI-CORE + G 40/20/20/20',{bb:.4,ic:.2,tc:.2,g:.2}],['TRI-CORE 50/25/25 + G on top 15%',{bb:.5,ic:.25,tc:.25,g:.15}],['G alone 100%',{bb:0,ic:0,tc:0,g:1}]]){
  const c=combo(w);console.log(nm.padEnd(34),'total',r(c.tot)+'%','| month-end DD',c.dd.toFixed(1)+'%','| return/DD',c.rdd.toFixed(1),'| +months',c.pos+'/'+NM,'| worst month',c.worst.toFixed(1)+'% | years',c.yr.map((v,i)=>String(years[i]).slice(2)+':'+r(v)).join(' '))}
// monthly grid for G and TRI-CORE (weighted R)
const grid=(name,Mx)=>{console.log(`\nMONTHLY R: ${name}\nyear    Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec |  year`);
  for(const y of years){let row=String(y).padEnd(5);for(let mo=0;mo<12;mo++){const i=y*12+mo-m0;row+=(i>=0&&i<NM?r(Mx[i]):'').padStart(6)}console.log(row+' | '+r(ysum(Mx,y)).padStart(6))}};
grid('G (ORB) on SOL+NEAR+ADA+GALA',M['G (ORB)']);
grid('TRI-CORE (0.5 BB + 0.25 I + 0.25 T)',TRI);
// running catch-up: cumulative R at each year end
console.log('\nCUMULATIVE R at year end   '+Object.keys(bots).join(' | '));
for(const y of years){const i=Math.min(NM-1,(y+1)*12-1-m0);console.log(String(y).padEnd(27)+Object.keys(bots).map(k=>r(M[k].slice(0,i+1).reduce((a,b)=>a+b,0)).padStart(9)).join(' | '))}
