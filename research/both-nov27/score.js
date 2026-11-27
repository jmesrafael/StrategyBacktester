// F4 step 1: score each coin on 2020-23 ONLY (single-coin inside each bot, flat). No later data.
const X=require('./causalF4.js');const C=require('../../candles/candles.js');
const POOL=['BTC','ETH','BNB','XRP','DOGE','LINK','AVAX','DOT','LTC','BCH','TRX','ATOM','UNI','AAVE','SOL','ZEC','NEAR','ADA','GALA','ARB','SUI','ETC','XLM','XMR','DASH','ALGO','EGLD','RUNE','SNX','CRV','SAND','MANA','AXS','HBAR','THETA','VET'];
const out={};
for(const bot of ['bb','ic','tc']){out[bot]={};for(const c of POOL){
 const r=X.run({mode:'flat',start:1000,from:X.T0,to:X.CUT,weights:{[bot]:1},coins:{[bot]:[c]}});const s=X.stats(r);
 const f=C.load(c,'4h')[0][0];
 out[bot][c]={cagr:s.cagr,dd:s.dd,n:r.trades.length,score:s.dd>0?s.cagr/s.dd:0,first:new Date(f*1000).toISOString().slice(0,7)};}}
require('fs').writeFileSync('score.json',JSON.stringify(out));
for(const bot in out){console.log('== '+bot);Object.entries(out[bot]).sort((a,b)=>b[1].score-a[1].score).forEach(([c,v])=>console.log(c.padEnd(6),(100*v.cagr).toFixed(0).padStart(6),(100*v.dd).toFixed(0).padStart(4),String(v.n).padStart(4),v.score.toFixed(2),v.first));}
