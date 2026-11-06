'use strict';
const fs=require('fs');
let T={};for(const f of ['trades.json','trades-hybrid.json'])Object.assign(T,JSON.parse(fs.readFileSync(f,'utf8')));
const sum=a=>a.reduce((x,y)=>x+y,0);
const tf=process.argv[2]||'4h';
function agg(parts){const all=[];for(const [tr,w] of parts)for(const t of tr)all.push([t[2],t[3]*w,t[5]]);
 all.sort((a,b)=>a[0]-b[0]);let e=0,p=0,d=0;for(const x of all){e+=x[1];p=Math.max(p,e);d=Math.max(d,p-e);}
 const R=all.map(x=>x[1]).sort((a,b)=>b-a),ex=e-sum(R.slice(0,10));
 const sh=sum(all.filter(x=>x[2]===-1).map(x=>x[1]));
 const y=n=>sum(all.filter(x=>new Date(x[0]*1000).getUTCFullYear()===n).map(x=>x[1]));
 return{tot:e,ex,dd:d,max:R[0],sh,y22:y(2022),y23:y(2023)};}
const base=T['bb-core|BBX|'+tf];
const f=a=>[a.tot.toFixed(0),a.ex.toFixed(0),(a.ex/a.tot*100).toFixed(0)+'%',a.dd.toFixed(1),a.max.toFixed(1),a.sh.toFixed(0),a.y22.toFixed(0),a.y23.toFixed(0)].join(' | ');
console.log('portfolio | total | ex-best10 | ex10 as % of total | maxDD | biggest R | shorts | 2022 | 2023');
console.log('bb-core alone | '+f(agg([[base,1]])));
const ks=Object.keys(T).filter(k=>k.endsWith('|'+tf)&&/P14$|P14\|/.test(k)).concat(['bb-hybrid|BBX96|'+tf,'bb-hybrid|BBX192|'+tf,'i-core|P7|'+tf]);
const out=[];
for(const k of ks){if(!T[k])continue;for(const w of [0.5,0.7]){const a=agg([[base,w],[T[k],1-w]]);out.push([k+' @'+w+'/'+(1-w).toFixed(1),a]);}}
out.sort((a,b)=>b[1].ex-a[1].ex);
for(const [n,a] of out.slice(0,12))console.log('bb-core + '+n.replace('|BBX','')+' | '+f(a));
