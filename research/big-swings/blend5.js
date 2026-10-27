// blend5.js — bb-core + Ichimoku(2/7/+SMA200) on SOL ZEC NEAR ADA GALA: merged account vs separate sub-accounts vs each alone
const E=require('./engine.js'),bb=require('../bb-core-v2/v2-core.js'),{loadCoin}=require('../bb-core-v2/load.js'),fs=require('fs');
const C=['SOL','ZEC','NEAR','ADA','GALA'],Y=[2020,2021,2022,2023,2024,2025,2026],S=1000;
const g={};const get=c=>g[c]||(g[c]=(()=>{const B=E.load(c);return{B,X:E.base(B)}})());
const BB=C.flatMap(c=>{const d=loadCoin(c);return bb.backtest(d.B,{},d.funding).trades.map(t=>({...t,coin:c,src:'bb'}))});
const IC=C.flatMap(c=>E.run(get(c).B,get(c).X,'ichimoku',{full:false},{coin:c,kInit:2,kTrail:7,trend:true,exitOpp:false}).map(t=>({...t,src:'ic'})));
// compounding account over a trade list with per-trade risk rp, start capital s -> list of {te, eq-after} realised events
function acct(T,rp,s){const tr=[...T].sort((a,b)=>a.t-b.t),d=[];for(const x of tr){const eq=s+d.filter(o=>o.te<=x.t).reduce((a,o)=>a+o.p,0);d.push({te:x.tExit,p:x.R*rp*eq})}d.sort((a,b)=>a.te-b.te);return d}
function curve(parts){ // parts: [{d, s}] -> combined realised equity timeline
  const ev=parts.flatMap(({d})=>d).sort((a,b)=>a.te-b.te);let tot=parts.reduce((a,p)=>a+p.s,0),pk=tot,dd=0;const yEnd={};
  for(const o of ev){tot+=o.p;pk=Math.max(pk,tot);dd=Math.max(dd,(pk-tot)/pk);yEnd[new Date(o.te*1000).getUTCFullYear()]=tot}
  let prev=parts.reduce((a,p)=>a+p.s,0);const yr={};for(const y of Y){if(yEnd[y]!==undefined){yr[y]=yEnd[y]/prev-1;prev=yEnd[y]}else yr[y]=0}return{eq:tot,dd,yr}}
const pc=v=>(v>=0?'+':'')+(v*100).toFixed(0)+'%';
const rows=[['bb-core alone, 2.5%',curve([{d:acct(BB,0.025,S),s:S}])],['Ichimoku alone, 2.5%',curve([{d:acct(IC,0.025,S),s:S}])],
 ['MERGED one account, 1.25% per trade each (same total risk budget)',curve([{d:acct([...BB,...IC],0.0125,S),s:S}])],
 ['MERGED one account, 2.5% per trade each (double risk)',curve([{d:acct([...BB,...IC],0.025,S),s:S}])],
 ['SEPARATE sub-accounts 50/50, 2.5% each (never rebalanced)',curve([{d:acct(BB,0.025,S/2),s:S/2},{d:acct(IC,0.025,S/2),s:S/2}])]];
let out=`# bb-core + Ichimoku: merged vs separate (SOL ZEC NEAR ADA GALA, $${S} start, realised equity)\n\n| setup | end equity | max DD | years+ | ${Y.join(' | ')} |\n|---|---|---|---|${Y.map(()=>'---').join('|')}|\n`;
for(const [n,r] of rows)out+=`| ${n} | $${Math.round(r.eq).toLocaleString()} | −${(r.dd*100).toFixed(0)}% | ${Y.filter(y=>r.yr[y]>0).length}/7 | ${Y.map(y=>pc(r.yr[y])).join(' | ')} |\n`;
// overlap / conflict stats on the same coin
let ov=0,opp=0,same=0;for(const a of IC){const hit=BB.filter(b=>b.coin===a.coin&&b.t<a.tExit&&b.tExit>a.t);if(hit.length){ov++;if(hit.some(b=>b.dir!==a.dir))opp++;else same++}}
// correlation of monthly R
const mo=(T)=>{const m={};for(const t of T){const d=new Date(t.tExit*1000),k=d.getUTCFullYear()*12+d.getUTCMonth();m[k]=(m[k]||0)+t.R}return m};const a=mo(BB),b=mo(IC),ks=Object.keys({...a,...b});
const xa=ks.map(k=>a[k]||0),xb=ks.map(k=>b[k]||0),ma=xa.reduce((p,q)=>p+q,0)/ks.length,mb=xb.reduce((p,q)=>p+q,0)/ks.length;
const cor=xa.reduce((s,v,i)=>s+(v-ma)*(xb[i]-mb),0)/Math.sqrt(xa.reduce((s,v)=>s+(v-ma)**2,0)*xb.reduce((s,v)=>s+(v-mb)**2,0));
out+=`\n- Ichimoku trades: ${IC.length}. Overlapping in time with a bb-core trade on the SAME coin: ${ov} (${(100*ov/IC.length).toFixed(0)}%); of those, **opposite direction: ${opp}**, same direction: ${same}.\n- Correlation of monthly R between the two strategies: ${cor.toFixed(2)}.\n`;
fs.writeFileSync('RESULTS-blend5.md',out);console.log(out)
