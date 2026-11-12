const fs=require('fs');
const COINS=['SOL','BTC','ETH','XRP'];
const key=c=>`${c.session} or${c.orBars} ${c.stop} T${c.target||'eod'} ${c.entry} ${c.dir} [${c.filters.join('+')}]`;
for (const tf of [60,240]) {
  const S={}; for (const k of COINS) S[k]=JSON.parse(fs.readFileSync(k==='SOL'?`sweep-${tf}.json`:`sweep-${k}-${tf}.json`));
  console.log(`\n================ ${tf==60?'1h':'4h'} ================`);
  // per coin: share of configs positive, best IS->OOS survival
  for (const k of COINS){const R=S[k];const ok=R.filter(r=>r.is.n>=60).map(r=>({...r,sc:r.is.avgR*Math.sqrt(r.is.n)})).sort((a,b)=>b.sc-a.sc).slice(0,50);
    const sess={};for(const s of ['utc0','ldn','ny']){const a=R.filter(r=>r.cfg.session===s);sess[s]=(a.reduce((x,r)=>x+r.oos.avgR,0)/a.length).toFixed(3)}
    console.log(`${k}: configs OOS>0 ${(R.filter(r=>r.oos.avgR>0).length/R.length*100).toFixed(0)}% | both IS&OOS>0 ${(R.filter(r=>r.is.avgR>0&&r.oos.avgR>0).length/R.length*100).toFixed(0)}% | IS top-50 -> ${ok.filter(r=>r.oos.avgR>0).length}/50 positive OOS, mean OOS ${(ok.reduce((x,r)=>x+r.oos.avgR,0)/50).toFixed(3)} | mean OOS by session ${JSON.stringify(sess)}`)}
  // pooled: rank by IS across ALL coins (selection never sees 2024+), report OOS per coin
  const n=S.SOL.length, pooled=[];
  for (let i=0;i<n;i++){const rows=COINS.map(k=>S[k][i]);
    const isN=rows.reduce((a,r)=>a+r.is.n,0), isS=rows.reduce((a,r)=>a+r.is.sumR,0), oosN=rows.reduce((a,r)=>a+r.oos.n,0), oosS=rows.reduce((a,r)=>a+r.oos.sumR,0);
    pooled.push({cfg:rows[0].cfg,rows,isAvg:isS/isN,isN,oosAvg:oosS/oosN,oosN,minIS:Math.min(...rows.map(r=>r.is.avgR)),sc:(isS/isN)*Math.sqrt(isN),posIS:rows.filter(r=>r.is.avgR>0).length,posOOS:rows.filter(r=>r.oos.avgR>0).length})}
  pooled.sort((a,b)=>b.sc-a.sc);
  console.log(`\nPOOLED top 15 chosen on IS (2020-23, all 4 coins) -> OOS 2024-26   [per-coin OOS avgR SOL BTC ETH XRP]`);
  for (const p of pooled.slice(0,15)) console.log(key(p.cfg).padEnd(46),`IS ${p.isAvg.toFixed(3)} (${p.isN}) ${p.posIS}/4 | OOS ${p.oosAvg.toFixed(3)} (${p.oosN}) ${p.posOOS}/4 |`,p.rows.map(r=>r.oos.avgR.toFixed(2).padStart(5)).join(' '));
  const t50=pooled.slice(0,50);console.log(`pooled IS top-50: ${t50.filter(p=>p.oosAvg>0).length}/50 positive pooled OOS, mean ${(t50.reduce((x,p)=>x+p.oosAvg,0)/50).toFixed(3)}; positive OOS on all 4 coins: ${t50.filter(p=>p.posOOS===4).length}`);
  // leave-one-coin-out: pick best on IS of 3 coins, test on 4th coin OOS (fully unseen coin + period)
  console.log('\nLeave-one-coin-out (pick on other 3 coins IS, test held-out coin):');
  for (const hold of COINS){const others=COINS.filter(c=>c!==hold);
    const sc=[];for(let i=0;i<n;i++){const rows=others.map(k=>S[k][i]);const N=rows.reduce((a,r)=>a+r.is.n,0),s=rows.reduce((a,r)=>a+r.is.sumR,0);sc.push({i,v:N>=150?(s/N)*Math.sqrt(N):-1e9})}
    sc.sort((a,b)=>b.v-a.v);const top=sc.slice(0,20).map(x=>S[hold][x.i]);
    const b=top[0];console.log(`  ${hold}: best pick ${key(b.cfg)} -> ${hold} IS ${b.is.avgR.toFixed(3)} OOS ${b.oos.avgR.toFixed(3)} (${b.oos.n}) | top-20 picks on ${hold}: OOS mean ${(top.reduce((x,r)=>x+r.oos.avgR,0)/20).toFixed(3)}, ${top.filter(r=>r.oos.avgR>0).length}/20 positive`)}
  // most robust: positive IS AND OOS on all 4 coins
  const rob=pooled.filter(p=>p.rows.every(r=>r.is.avgR>0&&r.oos.avgR>0&&r.all.n>=60)).sort((a,b)=>b.oosAvg-a.oosAvg);
  console.log(`\nConfigs positive in BOTH halves on ALL 4 coins: ${rob.length} of ${n} (chance level if no edge ~ ${(n*Math.pow(0.25,4)).toFixed(0)} at 25% each)`);
  for (const p of rob.slice(0,12)) console.log('  '+key(p.cfg).padEnd(46),`IS ${p.isAvg.toFixed(3)} OOS ${p.oosAvg.toFixed(3)} n ${p.isN+p.oosN} |`,p.rows.map(r=>r.all.avgR.toFixed(2)).join(' '));
}
