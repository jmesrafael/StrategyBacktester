const X=require('./xs.js');const fs=require('fs');
const PM=X.panel(X.MAIN),PH=X.panel(X.HOLD);
const res=[];let n=0;
for(const Lm of [240,336,480,720])for(const Lf of [48,72,120,168])for(const R of [48,72,120,168])for(const N of [2,3,4])for(const wt of [1.5,2,3]){
  const p={mix:[{sig:'mom',L:Lm},{sig:'fund',L:Lf,wt}],R,N,L:720};n++;
  const y=X.yearly(X.bt(PM,p,1).periods),yh=X.yearly(X.bt(PH,p,1).periods);
  res.push({Lm,Lf,R,N,wt,y,yh,mm:Math.min(...y),mh:Math.min(...yh)});
}
fs.writeFileSync('scan4.json',JSON.stringify(res));
res.sort((a,b)=>Math.min(b.mm,b.mh)-Math.min(a.mm,a.mh));
console.log(n,'both7/7:',res.filter(r=>r.mm>0&&r.mh>0).length,'main7/7:',res.filter(r=>r.mm>0).length);
for(const r of res.slice(0,12))console.log(JSON.stringify([r.Lm,r.Lf,r.R,r.N,r.wt]),'M',r.y.map(v=>v.toFixed(0)).join(' '),'H',r.yh.map(v=>v.toFixed(0)).join(' '));
