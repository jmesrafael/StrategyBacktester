'use strict';
const fs=require('fs');
let T={};for(const f of ['trades.json','trades-hybrid.json'])Object.assign(T,JSON.parse(fs.readFileSync(f,'utf8')));
const sum=a=>a.reduce((x,y)=>x+y,0);
function dd(tr){const s=[...tr].sort((a,b)=>a[2]-b[2]);let e=0,p=0,d=0;for(const t of s){e+=t[3];p=Math.max(p,e);d=Math.max(d,p-e);}return d;}
const tf=process.argv[2]||'4h';
const rows=Object.entries(T).filter(([k])=>k.endsWith('|'+tf)).map(([k,tr])=>{
 const R=tr.map(t=>t[3]),tot=sum(R),srt=[...R].sort((a,b)=>b-a),ex=tot-sum(srt.slice(0,10));
 const sh=sum(tr.filter(t=>t[5]===-1).map(t=>t[3]));
 const pre=sum(tr.filter(t=>new Date(t[2]*1000).getUTCFullYear()<2023).map(t=>t[3]));
 return{k,n:tr.length,tot,ex,sh,dd:dd(tr),max:srt[0],pre,post:tot-pre};});
rows.sort((a,b)=>b.ex-a.ex);
console.log('variant | trades | total | ex-best10 | shorts | maxDD | biggest trade R | <2023 | 2023+');
for(const r of rows.slice(0,15))console.log([r.k,r.n,r.tot.toFixed(0),r.ex.toFixed(0),r.sh.toFixed(0),r.dd.toFixed(1),r.max.toFixed(1),r.pre.toFixed(0),r.post.toFixed(0)].join(' | '));
