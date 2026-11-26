const X=require('./xs.js');
const PM=X.panel(X.MAIN),PH=X.panel(X.HOLD),PA=X.panel([...X.MAIN,...X.HOLD]);
const cands=[['resmom',720,24,2],['resmom',720,24,3],['resmom',720,72,3],['resmom',720,168,3],['resmom',336,24,2],['resmom',168,24,2],['mom',720,24,2],['mom',336,24,2],['mom',336,24,3]];
const f=y=>y.map(v=>v.toFixed(0).padStart(4)).join('');
for(const [sig,L,R,N] of cands){
  console.log(sig,L,R,N);
  for(const [nm,P,cm,Nn] of [['MAIN 1x',PM,1,N],['HOLD 1x',PH,1,N],['ALL24 2x',PA,2,N],['ALL24 2x N+2',PA,2,N+2]]){
    const y=X.yearly(X.bt(P,{sig,L,R,N:Nn},cm).periods);console.log('  ',nm.padEnd(13),f(y),'min',Math.min(...y).toFixed(0));}
}
