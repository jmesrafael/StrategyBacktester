const X=require('./xs.js');const fs=require('fs');
const PM=X.panel(X.MAIN),PH=X.panel(X.HOLD);
const out=[];
const grid=[];
for(const sig of ['rev','mom'])for(const L of [6,12,24,48,96])for(const R of [4,8,12,24])for(const N of [2,3,4])grid.push({sig,L,R,N});
for(const sig of ['lowvol','fund'])for(const sign of [1,-1])for(const L of [72,168,336,720])for(const R of [8,24,72])for(const N of [2,3,4])grid.push({sig,L,R,N,sign});
for(const p of grid){
  const y=X.yearly(X.bt(PM,p,1).periods);const is=y.slice(0,4);
  if(Math.min(...is)<=0)continue;
  const yh=X.yearly(X.bt(PH,p,1).periods);
  out.push({p,y,yh});console.log(JSON.stringify(p),y.map(v=>v.toFixed(0)).join(' '),'| HOLD',yh.map(v=>v.toFixed(0)).join(' '));
}
fs.writeFileSync('scan2.json',JSON.stringify(out));console.log('grid',grid.length,'passIS',out.length);
