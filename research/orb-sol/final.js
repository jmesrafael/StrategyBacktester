const fs=require('fs'),{run}=require('./engine');
const C={
 'A_1h_NY_textbook':{tf:60,session:'ny',orBars:1,stop:'mid',target:2,entry:'close',dir:'both',filters:['vwap','rvol']},
 'A0_1h_NY_nofilter':{tf:60,session:'ny',orBars:1,stop:'mid',target:2,entry:'close',dir:'both',filters:[]},
 'B_4h_UTC0_textbook':{tf:240,session:'utc0',orBars:1,stop:'mid',target:2,entry:'close',dir:'both',filters:['vwap','rvol']},
 'C_4h_LDN_long_ema':{tf:240,session:'ldn',orBars:1,stop:'bar',target:0,entry:'close',dir:'long',filters:['ema']},
};
const out={};
for (const [k,c] of Object.entries(C)){
 const r=run(c), r2=run({...c,takerFee:0.0008,makerFee:0.0004,slip:0.0005,stopSlip:0.0008});
 const T=r.trades;
 const stopPct=T.reduce((a,t)=>a+Math.abs(t.fill-t.stop)/t.fill,0)/T.length;
 const lev=T.reduce((a,t)=>a+t.lev,0)/T.length;
 const reasons={};T.forEach(t=>reasons[t.reason]=(reasons[t.reason]||0)+1);
 let ls=0,cur=0;T.forEach(t=>{cur=t.R<=0?cur+1:0;ls=Math.max(ls,cur)});
 const since=s=>{const a=T.filter(t=>t.tFill>=s);return {n:a.length,sumR:+a.reduce((x,t)=>x+t.R,0).toFixed(2),win:a.length?+(a.filter(t=>t.R>0).length/a.length).toFixed(2):0}};
 const longs=T.filter(t=>t.long),shorts=T.filter(t=>!t.long);
 const s=a=>({n:a.length,avgR:+(a.reduce((x,t)=>x+t.R,0)/(a.length||1)).toFixed(3)});
 // monthly equity, and share of 12-month windows that lose
 const mon={};T.forEach(t=>{const d=new Date(t.tExit*1e3);const m=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');mon[m]=(mon[m]||0)+t.R});
 const months=Object.keys(mon).sort(); const mv=months.map(m=>mon[m]);
 let neg12=0,w=0;for(let i=11;i<mv.length;i++){w++;if(mv.slice(i-11,i+1).reduce((a,b)=>a+b,0)<0)neg12++}
 out[k]={cfg:c,all:r.all,is:r.is,oos:r.oos,years:r.years,ret:r.retPct,cagr:r.cagr,maxDD:r.maxDD,maxDDR:r.maxDDR,perMonth:r.perMonth,
   doubleCost:{all:r2.all,ret:r2.retPct,maxDD:r2.maxDD},stopPct,lev,reasons,longestLosing:ls,long:s(longs),short:s(shorts),
   last90d:since(Date.now()/1e3-90*86400),last30d:since(Date.now()/1e3-30*86400),neg12m:neg12/w,months:mon,
   curve:T.map(t=>[t.tExit,+t.eq.toFixed(2)]),
   lastTrades:T.slice(-12).map(t=>({sig:new Date(t.sig*1e3).toISOString().slice(0,16),fill:new Date(t.tFill*1e3).toISOString().slice(0,16),exit:new Date(t.tExit*1e3).toISOString().slice(0,16),side:t.long?'L':'S',px:+t.fill.toFixed(2),stop:+t.stop.toFixed(2),out:+t.exit.toFixed(2),why:t.reason,R:+t.R.toFixed(2)}))};
 const o=out[k];
 console.log(`\n## ${k}  ${o.all.n} trades (${o.perMonth.toFixed(1)}/mo) win ${(o.all.win*100).toFixed(0)}% avg ${o.all.avgR.toFixed(3)}R sum ${o.all.sumR.toFixed(1)}R PF ${o.all.pf.toFixed(2)} | 1%-risk equity ${(o.ret*100).toFixed(0)}% CAGR ${(o.cagr*100).toFixed(0)}% DD ${(o.maxDD*100).toFixed(0)}% (${o.maxDDR.toFixed(1)}R) | longest losing ${ls}`);
 console.log(`   IS ${o.is.avgR.toFixed(3)}R  OOS ${o.oos.avgR.toFixed(3)}R | 2x costs: avg ${o.doubleCost.all.avgR.toFixed(3)}R ret ${(o.doubleCost.ret*100).toFixed(0)}% | stop ${(stopPct*100).toFixed(2)}% lev ${lev.toFixed(1)}x | exits ${JSON.stringify(reasons)} | L ${JSON.stringify(o.long)} S ${JSON.stringify(o.short)} | 12m windows losing ${(o.neg12m*100).toFixed(0)}% | last90d ${JSON.stringify(o.last90d)} last30d ${JSON.stringify(o.last30d)}`);
}
fs.writeFileSync('final.json',JSON.stringify(out));
console.log('\nlast trades A:');console.table(out.A_1h_NY_textbook.lastTrades);
