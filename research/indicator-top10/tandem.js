// tandem.js — top 3 trades of each strategy + equal split of capital across bb-core, I-Core and MA Trend (7 coins, 4h, to 2026-11-05)
process.env.COINS='SOL,ZEC,NEAR,ADA,GALA,BTC,ETH';
const fs=require('fs');const {cfgRun,COINS}=require('./rstrat.js');
const BB=require('../../../bb-core/lucidio-core.js'),IC=require('../../js/icore-core.js');
const bots=core=>{const all=[];for(const c of COINS){const B=JSON.parse(fs.readFileSync(`data4h/${c}.json`)).map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]}));all.push(...core.backtest(B).trades.map(t=>({...t,coin:c})))}return all};
const S={'bb-core':bots(BB),'I-Core':bots(IC),'MA Trend':cfgRun('SMA','P',[200],true,true,2,14,'close','nextOpen').trades};
const d=t=>new Date(t*1000).toISOString().slice(0,10);
console.log('TOP 3 TRADES (R)');for(const [n,tr] of Object.entries(S)){const top=[...tr].sort((a,b)=>b.R-a.R);const tot=tr.reduce((s,t)=>s+t.R,0);const pos=tr.filter(t=>t.R>0).reduce((s,t)=>s+t.R,0);
 console.log(n.padEnd(9),top.slice(0,3).map(t=>`${t.coin} ${t.dir===1?'L':'S'} ${d(t.t)}→${d(t.tExit)} ${t.R.toFixed(1)}R`).join(' | '),'| top3 =',(top.slice(0,3).reduce((s,t)=>s+t.R,0)/tot*100).toFixed(0)+'% of net R, top10 =',(top.slice(0,10).reduce((s,t)=>s+t.R,0)/tot*100).toFixed(0)+'%')}
const RISK=.025,YRS=[2020,2021,2022,2023,2024,2025,2026];
const yr=t=>new Date(t.tExit*1000).getUTCFullYear();
// fresh 10,000 each January, equal split across the chosen strategies; each sub-account compounds its own trades at RISK of its own balance
function fresh(names){const out=[];for(const y of YRS){const subs=names.map(n=>({e:10000/names.length,tr:S[n].filter(t=>yr(t)===y)}));
  const ev=[];subs.forEach((s,i)=>s.tr.forEach(t=>ev.push([t.tExit,i,t.R])));ev.sort((a,b)=>a[0]-b[0]);let pk=10000,dd=0;
  for(const [,i,R] of ev){subs[i].e*=1+RISK*R;const tot=subs.reduce((s,x)=>s+x.e,0);pk=Math.max(pk,tot);dd=Math.min(dd,tot/pk-1)}
  out.push({y,end:subs.reduce((s,x)=>s+x.e,0),dd})}return out}
// one continuous account (never reset), rebalanced to equal parts each 1 Jan
function cont(names){let tot=10000,pk=tot,dd=0;const yrs=[];for(const y of YRS){const subs=names.map(n=>({e:tot/names.length,tr:S[n].filter(t=>yr(t)===y)}));const ev=[];subs.forEach((s,i)=>s.tr.forEach(t=>ev.push([t.tExit,i,t.R])));ev.sort((a,b)=>a[0]-b[0]);const start=tot;
  for(const [,i,R] of ev){subs[i].e*=1+RISK*R;const t2=subs.reduce((s,x)=>s+x.e,0);pk=Math.max(pk,t2);dd=Math.min(dd,t2/pk-1)}tot=subs.reduce((s,x)=>s+x.e,0);yrs.push(tot/start-1)}return{end:tot,dd,yrs}}
const combos=[['bb-core'],['I-Core'],['MA Trend'],['bb-core','I-Core'],['bb-core','MA Trend'],['I-Core','MA Trend'],['bb-core','I-Core','MA Trend']];
console.log('\nFRESH 10,000 EACH JAN @2.5% per strategy account: year-end balance (worst in-year drop)');console.log(''.padEnd(26),YRS.join('      '));
for(const c of combos){const r=fresh(c);console.log(c.join('+').padEnd(26),r.map(x=>(x.end>=1e6?(x.end/1e6).toFixed(2)+'M':String(Math.round(x.end))).padStart(8)+'('+(x.dd*100).toFixed(0)+'%)').join(' '),' sum',Math.round(r.reduce((s,x)=>s+x.end,0)),' yrs>10k',r.filter(x=>x.end>10000).length+'/7',' worst DD',(Math.min(...r.map(x=>x.dd))*100).toFixed(0)+'%')}
console.log('\nONE CONTINUOUS ACCOUNT, rebalanced to equal parts each 1 Jan: yearly return, final x, max DD');
for(const c of combos){const r=cont(c);console.log(c.join('+').padEnd(26),r.yrs.map(x=>((x*100).toFixed(0)+'%').padStart(6)).join(' '),' final x',(r.end/10000).toFixed(1),' maxDD',(r.dd*100).toFixed(0)+'%',' profitable yrs',r.yrs.filter(x=>x>0).length+'/7')}
