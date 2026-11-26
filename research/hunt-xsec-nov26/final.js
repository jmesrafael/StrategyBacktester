const X=require('./xs.js');
const L=require('../hunt-1h-nov26/lib.js'),{build,strat,mkEx}=require('../hunt-1h-nov26/fam-vol.js');
const PM=X.panel(X.MAIN),PH=X.panel(X.HOLD),PA=X.panel([...X.MAIN,...X.HOLD]);
const f=y=>y.map(v=>v.toFixed(0).padStart(4)).join('');
const cands={A:{mix:[{sig:'mom',L:720},{sig:'fund',L:168,wt:1.5}],R:120,N:3,L:720},
             B:{mix:[{sig:'mom',L:336},{sig:'fund',L:48,wt:1.5}],R:120,N:4,L:720}};
// BB proxies monthly R
const E={kind:'M',bars:192};
function bbm(mult){const r=L.evaluate(strat({len:80,mult,trend:800,minStop:0.3,filt:null},E),mkEx(E),[...L.MAIN,...L.HOLD],1,true);const m={};for(const t of r.trades){const d=new Date(t.tExit*1000);const k=d.getUTCFullYear()*100+d.getUTCMonth()+1;m[k]=(m[k]||0)+t.R;}return m;}
const bb20=bbm(2.0),bb26=bbm(2.6);
function corr(a,b){const ks=Object.keys(a).filter(k=>k in b);const x=ks.map(k=>a[k]),y=ks.map(k=>b[k]);const mx=x.reduce((s,v)=>s+v)/x.length,my=y.reduce((s,v)=>s+v)/y.length;let sxy=0,sxx=0,syy=0;for(let i=0;i<x.length;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)**2;syy+=(y[i]-my)**2;}return sxy/Math.sqrt(sxx*syy);}
for(const [nm,p] of Object.entries(cands)){
  console.log('== cand',nm,JSON.stringify(p.mix),'R',p.R,'N',p.N);
  console.log('years            ',X.YEARS.join('  '));
  for(const [bn,P,cm,pp] of [['MAIN 1x',PM,1,p],['HOLD 1x',PH,1,p],['ALL24 1x N',PA,1,p],['ALL24 2x N',PA,2,p],['ALL24 2x N+2',PA,2,{...p,N:p.N+2}],['ALL24 3x N',PA,3,p]]){
    const r=X.bt(P,pp,cm),y=X.yearly(r.periods);console.log(bn.padEnd(13),f(y),' tot',y.reduce((a,b)=>a+b).toFixed(0),'min',Math.min(...y).toFixed(0));
    if(bn==='MAIN 1x'||bn==='ALL24 2x N'){const s=r.periods.map(q=>q.pnl).sort((a,b)=>b-a);const tot=s.reduce((a,b)=>a+b);console.log('   rebalances',s.length,'ex-best10 total %',((tot-s.slice(0,10).reduce((a,b)=>a+b))*100).toFixed(0),'of',(tot*100).toFixed(0));
      // yearly without best 10
      const top=new Set([...r.periods].sort((a,b)=>b.pnl-a.pnl).slice(0,10));console.log('   yearly ex-best10',f(X.yearly(r.periods.filter(q=>!top.has(q)))));}
    if(bn==='ALL24 1x N'){const m=X.monthly(r.periods);console.log('   corr monthly vs BB-CORE1h(2.0):',corr(m,bb20).toFixed(2),' vs BB-1H-WIDE:',corr(m,bb26).toFixed(2),'months',Object.keys(m).length);}
    if(bn==='MAIN 1x'){const m=X.monthly(r.periods);console.log('   MAIN-book corr vs BB1h:',corr(m,bb20).toFixed(2),corr(m,bb26).toFixed(2));}
  }
  // truncation test
  let bad=0,chk=0;const full=X.bt(PA,p,1,true).dec;const fm=new Map(full);
  for(const cut of [20000,31111,40007,47777,52000,55555]){const Q=X.slicePanel(PA,cut);const d=X.bt(Q,p,1,true).dec;for(const [i,w] of d){chk++;if(fm.get(i)!==w)bad++;}}
  console.log('truncation: checked',chk,'mismatch',bad);
}
