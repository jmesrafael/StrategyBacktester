const fs=require('fs');const R = (() => { const r = (process.env.STRAT_ROOT || 'c:/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat'); return (r.endsWith('/') ? r : r + '/') + ''; })();
const files={};
for(const c of ['SOL','ADA','GALA','NEAR','ZEC'])files[c]=R+`bb-core/data/${c}.json`;
for(const c of ['AVAX','BNB','DOGE','ETH','LINK','LTC','XRP'])files[c]=R+`StrategyBacktester/research/big-swings/data/${c}.json`;
const TH=[0.2,0.3,0.5];
function zig(c,th){ // returns list of swings {t,pct}
  let out=[];let hi=c[0][2],lo=c[0][3],dir=0,pivot=c[0][4],pt=c[0][0];
  let ext=c[0][4],et=c[0][0];
  // close-based zigzag
  let last=c[0][4],lt=c[0][0],hiP=last,hiT=lt,loP=last,loT=lt,d=0;
  for(const k of c){const p=k[4],t=k[0];
    if(d>=0){ if(p>hiP){hiP=p;hiT=t;} if(p<=hiP*(1-th)){ if(hiP/loP-1>=th||d===1) out.push({t:hiT,pct:hiP/loP-1}); d=-1;loP=p;loT=t;hiP=p; } }
    if(d<=0){ if(p<loP){loP=p;loT=t;} if(p>=loP*(1+th)&&d===-1){ out.push({t:loT,pct:-(1-loP/hiP)}); d=1;hiP=p;hiT=t;loP=p;} else if(d===0&&p>=loP*(1+th)){d=1;hiP=p;hiT=t;} }
  }
  return out;
}
// simpler robust approach: legs
function legs(c,th){let res=[];let piv=c[0][4],pt=c[0][0],dir=0,ext=piv,et=pt;
  for(const k of c){const p=k[4],t=k[0];
    if(dir===0){ if(p>=piv*(1+th)){dir=1;ext=p;et=t;} else if(p<=piv*(1-th)){dir=-1;ext=p;et=t;} }
    else if(dir===1){ if(p>ext){ext=p;et=t;} else if(p<=ext*(1-th)){res.push({t:et,pct:ext/piv-1});piv=ext;dir=-1;ext=p;et=t;} }
    else { if(p<ext){ext=p;et=t;} else if(p>=ext*(1+th)){res.push({t:et,pct:ext/piv-1});piv=ext;dir=1;ext=p;et=t;} }
  } return res;}
const yr=t=>new Date(t*1000).getUTCFullYear();
const all={};
for(const [coin,f] of Object.entries(files)){
  const c=JSON.parse(fs.readFileSync(f));c.sort((a,b)=>a[0]-b[0]);
  const years={};
  for(const k of c){const y=yr(k[0]);(years[y]??=[0,0]);years[y][0]++;}
  all[coin]={c,years};
}
console.log('coverage');for(const [k,v] of Object.entries(all))console.log(k,Object.entries(v.years).map(([y,[n]])=>y+':'+(n/6).toFixed(0)+'d').join(' '));
for(const th of TH){
  console.log(`\n=== swings >= ${th*100}% (close-to-close, zigzag legs, up or down) — count per calendar year ===`);
  const ys=[2020,2021,2022,2023,2024,2025,2026];
  console.log('coin  '+ys.join('  '));
  const totals={};
  for(const [coin,v] of Object.entries(all)){
    const L=legs(v.c,th);const cnt={};
    for(const l of L){const y=yr(l.t);cnt[y]=(cnt[y]||0)+1;}
    console.log(coin.padEnd(5),ys.map(y=>{const full=(v.years[y]?.[0]||0)>=6*300; return (cnt[y]===undefined&&!v.years[y]?'  -':String(cnt[y]||0).padStart(3))+(full?' ':'*');}).join(' '));
  }
}
// rolling windows: % of 30-day windows with range >= X
console.log('\n=== share of calendar months where high-low range (closes) >= X% ===');
for(const x of [0.2,0.3,0.5]){let row=[];
  for(const [coin,v] of Object.entries(all)){const m={};
    for(const k of v.c){const d=new Date(k[0]*1000);const key=d.getUTCFullYear()*100+d.getUTCMonth();(m[key]??={h:0,l:1e18,n:0});m[key].h=Math.max(m[key].h,k[4]);m[key].l=Math.min(m[key].l,k[4]);m[key].n++;}
    const full=Object.values(m).filter(z=>z.n>=150);const hit=full.filter(z=>z.h/z.l-1>=x).length;row.push(coin+' '+(100*hit/full.length).toFixed(0)+'%');}
  console.log(`>=${x*100}%: `+row.join(' | '));}
