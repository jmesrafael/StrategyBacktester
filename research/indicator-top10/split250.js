// split250.js — start capital 250 split equally across bb-core / I-Core / MA Trend vs all 250 in one strategy (7 coins, 4h)
process.env.COINS='SOL,ZEC,NEAR,ADA,GALA,BTC,ETH';
const fs=require('fs');const {cfgRun,COINS}=require('./rstrat.js');
const BB=require('../../../bb-core/lucidio-core.js'),IC=require('../../js/icore-core.js');
const bots=core=>{const all=[];for(const c of COINS){const B=JSON.parse(fs.readFileSync(`data4h/${c}.json`)).map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]}));all.push(...core.backtest(B).trades.map(t=>({...t,coin:c})))}return all};
const S={'bb-core':bots(BB),'I-Core':bots(IC),'MA Trend':cfgRun('SMA','P',[200],true,true,2,14,'close','nextOpen').trades};
const TIERS=[[0,.025],[500,.02],[1000,.015]]; // the live bot's riskTiers (bot-config.json): risk % steps down as the account grows
const riskFlat=()=>.025, riskTier=e=>{let r=TIERS[0][1];for(const [b,x] of TIERS)if(e>=b)r=x;return r};
function sim(names,start,riskFn,from=0,rebal=false){const subs=names.map(n=>({n,e:start/names.length,tr:S[n].filter(t=>t.tExit>=from).sort((a,b)=>a.tExit-b.tExit)}));
  const ev=[];subs.forEach((s,i)=>s.tr.forEach(t=>ev.push([t.tExit,i,t.R])));ev.sort((a,b)=>a[0]-b[0]);let pk=start,dd=0,trough=start;const yrEnd={};let curY=null;
  for(const [tm,i,R] of ev){const y=new Date(tm*1000).getUTCFullYear();
    if(rebal&&curY!==null&&y!==curY){const tot=subs.reduce((s,x)=>s+x.e,0);subs.forEach(s=>s.e=tot/subs.length)}curY=y;
    subs[i].e*=1+riskFn(subs[i].e)*R;const tot=subs.reduce((s,x)=>s+x.e,0);pk=Math.max(pk,tot);dd=Math.min(dd,tot/pk-1);trough=Math.min(trough,tot);yrEnd[y]=tot}
  return{end:subs.reduce((s,x)=>s+x.e,0),dd,trough,yrEnd,parts:subs.map(s=>[s.n,s.e])}}
const combos=[['bb-core'],['I-Core'],['MA Trend'],['bb-core','I-Core','MA Trend'],['bb-core','I-Core'],['bb-core','MA Trend'],['I-Core','MA Trend']];
const T0=Date.UTC(2019,0,1)/1000,T23=Date.UTC(2023,0,1)/1000;
const f=x=>Math.round(x).toLocaleString('en-US');
for(const [lab,rf,from] of [['A) live-bot risk tiers (2.5% <500, 2% <1000, 1.5% above), start 1 Jan 2020, to 5 Nov 2026',riskTier,Date.UTC(2020,0,1)/1000],['B) flat 2.5%, same period',riskFlat,Date.UTC(2020,0,1)/1000],['C) live-bot risk tiers, start 1 Jan 2023 (last 3.8 years)',riskTier,T23]]){
  console.log('\n'+lab);for(const c of combos){const r=sim(c,250,rf,from);console.log(c.join(' + ').padEnd(28),'ends',f(r.end).padStart(14),' x'+(r.end/250).toFixed(1).padStart(10),' worst drop',(r.dd*100).toFixed(0)+'%',' lowest balance',f(r.trough))}}
console.log('\nYear-end balance, tiers, from 1 Jan 2020, start 250 (no rebalancing)');const ys=[2020,2021,2022,2023,2024,2025,2026];console.log(''.padEnd(28),ys.join('       '));
for(const c of combos){const r=sim(c,250,riskTier,Date.UTC(2020,0,1)/1000);console.log(c.join(' + ').padEnd(28),ys.map(y=>f(r.yrEnd[y]||0).padStart(9)).join(' '))}
const r=sim(combos[3],250,riskTier,Date.UTC(2020,0,1)/1000);console.log('\n3-way parts at end:',r.parts.map(p=>p[0]+' '+f(p[1])).join(' | '));
const r2=sim(combos[3],250,riskTier,Date.UTC(2020,0,1)/1000,true);console.log('3-way with yearly rebalance to equal thirds ends',f(r2.end),'worst drop',(r2.dd*100).toFixed(0)+'%');
// ---- D) never risk more than CAP dollars per trade IN TOTAL: each of n sub-accounts is capped at CAP/n, so the split gets no extra dollar risk
for (const CAP of [25, 50, 100]) {
  console.log('\nD) TOTAL risk cap $' + CAP + ' per trade slot (each of n strategies capped at CAP/n), tiers, start 1 Jan 2020, 250 total');
  for (const c of combos) { const n = c.length, r = sim(c, 250, e => Math.min(riskTier(e), (CAP / n) / e), Date.UTC(2020, 0, 1) / 1000);
    console.log(c.join(' + ').padEnd(28), 'ends', f(r.end).padStart(9), ' x' + (r.end / 250).toFixed(0).padStart(5), ' worst drop', (r.dd * 100).toFixed(0) + '%', ' yr-ends', [2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => f(r.yrEnd[y] || 0)).join(' / ')); }
}
