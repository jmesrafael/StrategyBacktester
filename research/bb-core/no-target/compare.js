const L=require('./lib.js');const coins=['SOL','ZEC','NEAR','ADA','GALA'];
const D={};for(const c of coins)D[c]={B:L.loadC(L.ROOT+`bb-core/data/${c}.json`),F:L.loadF(L.ROOT+`bb-core/data/funding/${c}.json`)};
const run=(sig,o)=>coins.flatMap(c=>L.gen(D[c].B,sig,o,D[c].F));
const sets={
 'BB 1:4 (current)':coins.flatMap(c=>L.bb.backtest(D[c].B,{targetR:4},D[c].F).trades),
 'BB-A no target':coins.flatMap(c=>L.bb.backtest(D[c].B,{targetR:0},D[c].F).trades),
 'I-Core (current)':coins.flatMap(c=>L.ic.backtest(L.loadC(L.ROOT+`i-core/data/${c}.json`)).trades),
 'Donchian20 no target':run(L.SIG.donch(20),{targetR:0}),
 'Donchian40 no target':run(L.SIG.donch(40),{targetR:0}),
 'Keltner20/2 no target':run(L.SIG.keltner(20,2),{targetR:0}),
 'Donchian20 1:4':run(L.SIG.donch(20),{targetR:4}),
 'Keltner20/2 1:4':run(L.SIG.keltner(20,2),{targetR:4}),
};
const f=(v,d=2)=>(v>=0?'+':'')+v.toFixed(d);
console.log('strategy                  n    win%   expR    avgW   avgL    PF    netR   maxDD  | 2020-23 expR (n) | 2024-26 expR (n)');
for(const[k,t]of Object.entries(sets)){const s=L.S(t),a=L.S(t.filter(x=>L.yr(x)<=2023)),b=L.S(t.filter(x=>L.yr(x)>=2024));
 console.log(k.padEnd(24),String(s.n).padStart(5),(s.win*100).toFixed(1).padStart(5),f(s.exp,3).padStart(7),f(s.aw).padStart(6),f(s.al).padStart(6),s.pf.toFixed(2).padStart(6),f(s.net,0).padStart(7),('-'+s.dd.toFixed(0)).padStart(6),'|',f(a.exp,3),`(${a.n})`,'|',f(b.exp,3),`(${b.n})`);}
const yrs=[2020,2021,2022,2023,2024,2025,2026];
console.log('\nnet R by year');console.log('strategy'.padEnd(24),yrs.join('    '));
for(const[k,t]of Object.entries(sets)){const y=L.byYear(t);console.log(k.padEnd(24),yrs.map(Y=>f((y[Y]||[]).reduce((a,x)=>a+x.R,0),0).padStart(5)).join('   '));}
// the I-Core data may begin later; show its trade counts per coin
console.log('\n=== TANDEMS (equal R risk per trade on both engines, trades pooled) ===');
const combos=[['BB 1:4 (current)','I-Core (current)'],['BB-A no target','I-Core (current)'],['BB-A no target','Donchian20 no target'],['BB-A no target','Donchian20 no target','I-Core (current)'],['BB 1:4 (current)','Donchian20 no target','I-Core (current)']];
const mon={};for(const k of Object.keys(sets))mon[k]=L.monthly(sets[k]);
console.log('monthly-R correlation with I-Core: BB 1:4 '+L.corr(mon['BB 1:4 (current)'],mon['I-Core (current)']).toFixed(2)+' | BB-A '+L.corr(mon['BB-A no target'],mon['I-Core (current)']).toFixed(2)+' | Donchian20 '+L.corr(mon['Donchian20 no target'],mon['I-Core (current)']).toFixed(2)+' | BB-A vs Donchian20 '+L.corr(mon['BB-A no target'],mon['Donchian20 no target']).toFixed(2));
console.log('combo'.padEnd(66),'n    expR    netR   maxDD  netR/DD  worstYear  yrs+');
for(const cb of combos){const t=cb.flatMap(k=>sets[k]);const s=L.S(t),y=L.byYear(t);const ys=Object.entries(y).map(([Y,v])=>[Y,v.reduce((a,x)=>a+x.R,0)]);
 const w=ys.reduce((a,b)=>b[1]<a[1]?b:a);console.log(cb.join(' + ').padEnd(66),String(s.n).padStart(5),f(s.exp,3).padStart(7),f(s.net,0).padStart(7),('-'+s.dd.toFixed(0)).padStart(6),(s.net/s.dd).toFixed(1).padStart(6),(w[0]+' '+f(w[1],0)).padStart(11),ys.filter(z=>z[1]>0).length+'/'+ys.length);}
console.log('\nbest-year share of total R (concentration): ');for(const k of ['BB 1:4 (current)','BB-A no target','I-Core (current)','Donchian20 no target']){const t=sets[k].map(x=>x.R).sort((a,b)=>b-a);const tot=t.reduce((a,b)=>a+b,0);console.log(' ',k.padEnd(24),'top10 trades = '+(100*t.slice(0,10).reduce((a,b)=>a+b,0)/tot).toFixed(0)+'% of net R');}
