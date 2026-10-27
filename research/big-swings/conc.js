const E=require('./engine.js');const C=['SOL','ZEC','NEAR','ADA','GALA'],Y=[2020,2021,2022,2023,2024,2025,2026];
const T=C.flatMap(c=>{const B=E.load(c);return E.run(B,E.base(B),'ichimoku',{full:false},{coin:c,kInit:2,kTrail:7,trend:true,exitOpp:false})});
const s=[...T].sort((a,b)=>b.R-a.R),tot=T.reduce((a,t)=>a+t.R,0),f=v=>(v>=0?'+':'')+v.toFixed(0);
console.log('total',f(tot),'top trades:');for(const t of s.slice(0,8))console.log(' ',t.coin,new Date(t.t*1000).toISOString().slice(0,10),'->',new Date(t.tExit*1000).toISOString().slice(0,10),'R',t.R.toFixed(1),'dir',t.dir,'bars',t.bars);
for(const k of [1,3,5,10,20])console.log(`without top ${k}: ${f(tot-s.slice(0,k).reduce((a,t)=>a+t.R,0))}R`);
const rest=T.filter(t=>t!==s[0]);const y=E.yearly(rest);console.log('without the single best trade, years:',Y.map(v=>v+' '+f(y[v]||0)).join(' | '),' yrs+',Y.filter(v=>(y[v]||0)>0).length+'/7',' DD',E.maxDD(rest).toFixed(0));
const top10=s.slice(0,10).reduce((a,t)=>a+t.R,0);console.log('top 10 trades =',(100*top10/tot).toFixed(0)+'% of all profit (of',T.length,'trades)');
