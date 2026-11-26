const X=require('./xs.js');const fs=require('fs');
const P=X.panel(X.MAIN);
const out=[];const sigs=['mom','rev','lowvol','fund','resmom','btcrel'];
const Ls=[24,72,168,336,720,1440],Rs=[24,72,168],Ns=[2,3,4];
for(const sig of sigs)for(const L of Ls)for(const R of Rs)for(const N of Ns){
  const p={sig,L,R,N};const t=Date.now();const r=X.bt(P,p,1);const y=X.yearly(r.periods);
  const is=y.slice(0,4);const row={sig,L,R,N,y,isMin:Math.min(...is),isSum:is.reduce((a,b)=>a+b,0)};out.push(row);
  console.log(sig,L,R,N,y.map(v=>v.toFixed(0)).join(' '),'IS+',is.filter(v=>v>0).length);
}
fs.writeFileSync('scan-main.json',JSON.stringify(out));
