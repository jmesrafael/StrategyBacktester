const X=require('./xs.js');const fs=require('fs');
const PM=X.panel(X.MAIN),PH=X.panel(X.HOLD);
const f=y=>y.map(v=>v.toFixed(0).padStart(4)).join('');
const out=[];
for(const a of [{sig:'mom',L:720},{sig:'mom',L:336},{sig:'rev',L:24},{sig:'rev',L:72}])
for(const b of [{sig:'fund',L:168},{sig:'fund',L:72},{sig:'lowvol',L:336},{sig:'lowvol',L:720}])
for(const R of [24,72])for(const N of [2,3])for(const wt of [1,2]){
  const p={mix:[a,{...b,wt}],R,N,L:720};
  const y=X.yearly(X.bt(PM,p,1).periods);const yh=X.yearly(X.bt(PH,p,1).periods);
  const mn=Math.min(...y),mh=Math.min(...yh);
  console.log(a.sig+a.L,b.sig+b.L,'wt',wt,'R',R,'N',N,'MAIN',f(y),'HOLD',f(yh),mn>0&&mh>0?'<<<':'');
  out.push({p,y,yh});
}
fs.writeFileSync('scan3.json',JSON.stringify(out));
