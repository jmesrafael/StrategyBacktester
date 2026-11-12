const fs=require('fs');
for (const tf of [60,240]) {
  const R=JSON.parse(fs.readFileSync(`sweep-${tf}.json`));
  const name=c=>`${c.session} or${c.orBars} ${c.stop} T${c.target||'eod'} ${c.entry} ${c.dir} [${c.filters.join('+')}]`;
  const f=s=>`${String(s.n).padStart(4)} ${(s.win*100).toFixed(0).padStart(2)}% ${s.avgR.toFixed(3).padStart(6)}R ${s.sumR.toFixed(0).padStart(5)}R`;
  console.log(`\n===== ${tf==60?'1h':'4h'}: ${R.length} configs | positive IS: ${R.filter(r=>r.is.avgR>0).length} | positive OOS: ${R.filter(r=>r.oos.avgR>0).length} | positive both: ${R.filter(r=>r.is.avgR>0&&r.oos.avgR>0).length}`);
  // by session
  for (const s of ['utc0','ldn','ny']) { const a=R.filter(r=>r.cfg.session===s); console.log(`  ${s}: mean OOS avgR ${(a.reduce((x,r)=>x+r.oos.avgR,0)/a.length).toFixed(3)}, share OOS>0 ${(a.filter(r=>r.oos.avgR>0).length/a.length*100).toFixed(0)}%`);}
  const fk=r=>r.cfg.filters.join('+')||'none';
  const byF={}; for (const r of R){(byF[fk(r)]=byF[fk(r)]||[]).push(r)}
  for (const [k,a] of Object.entries(byF)) console.log(`  filter ${k.padEnd(16)} mean IS ${(a.reduce((x,r)=>x+r.is.avgR,0)/a.length).toFixed(3)} OOS ${(a.reduce((x,r)=>x+r.oos.avgR,0)/a.length).toFixed(3)}`);
  const ok=R.filter(r=>r.is.n>=80);
  ok.forEach(r=>r.score=r.is.avgR*Math.sqrt(r.is.n));
  ok.sort((a,b)=>b.score-a.score);
  console.log('  TOP 15 by IN-SAMPLE score -> their OUT-OF-SAMPLE        IS: n win avg sum   | OOS: n win avg sum | DD%  /mo');
  for (const r of ok.slice(0,15)) console.log('  '+name(r.cfg).padEnd(52),f(r.is),'|',f(r.oos),'|',(r.maxDD*100).toFixed(0).padStart(3)+'%',r.perMonth.toFixed(1));
  const top50=ok.slice(0,50); console.log(`  of IS top-50: ${top50.filter(r=>r.oos.avgR>0).length} positive OOS; mean OOS avgR ${(top50.reduce((x,r)=>x+r.oos.avgR,0)/50).toFixed(3)}`);
}
