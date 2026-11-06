// allpairs.js — is "bb-core + a wide-trail (P14) sleeve" a family effect or cherry-picking? Pair bb-core with EVERY P14 (and every P7) strategy.
const fs=require('fs');let T={};for(const f of ['trades.json','trades-hybrid.json'])if(fs.existsSync(f))Object.assign(T,JSON.parse(fs.readFileSync(f)));
function agg(parts){const all=[];for(const[tr,w]of parts)for(const t of tr)all.push([t[2],t[3]*w]);all.sort((a,b)=>a[0]-b[0]);let e=0,p=0,dd=0;for(const[,r]of all){e+=r;p=Math.max(p,e);dd=Math.max(dd,p-e)}return{total:e,dd,rdd:e/dd}}
const med=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
for(const tf of ['4h','1h']){const base=T['bb-core|BBX|'+tf],b0=agg([[base,1]]);
 for(const prof of ['P14','P7']){const rows=Object.keys(T).filter(k=>k.endsWith('|'+prof+'|'+tf)&&!k.startsWith('bb-core')&&!k.startsWith('i-core')&&!k.startsWith('bb-hybrid')&&!k.startsWith('rsi-dip')).map(k=>({k:k.split('|')[0],...agg([[base,.5],[T[k],.5]])}));
  const better=rows.filter(r=>r.rdd>b0.rdd).length,lowerDD=rows.filter(r=>r.dd<b0.dd).length,moreR=rows.filter(r=>r.total>b0.total).length;
  console.log(`${tf} bb-core alone: ${b0.total.toFixed(0)}R DD ${b0.dd.toFixed(1)} R/DD ${b0.rdd.toFixed(1)}`);
  console.log(`  paired with each of ${rows.length} ${prof} strategies at 1/2 risk: higher R/DD in ${better}/${rows.length}, lower DD in ${lowerDD}/${rows.length}, more total R in ${moreR}/${rows.length}; median R ${med(rows.map(r=>r.total)).toFixed(0)}, median DD ${med(rows.map(r=>r.dd)).toFixed(1)}, median R/DD ${med(rows.map(r=>r.rdd)).toFixed(1)} (min ${Math.min(...rows.map(r=>r.rdd)).toFixed(1)}, max ${Math.max(...rows.map(r=>r.rdd)).toFixed(1)})`);}}
