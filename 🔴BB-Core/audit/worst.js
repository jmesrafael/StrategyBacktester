const {backtest}=require('../lucidio-core.js');const fs=require('fs');
const rd=f=>JSON.parse(fs.readFileSync(__dirname+'/../data/'+f));
const B=rd('MEXC_ZEC.json').map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]}));
const own=rd('funding/MEXC_ZEC.json'),bin=rd('funding/ZEC.json');const F=[...bin.filter(r=>r[0]<own[0][0]),...own];
for(const t of backtest(B,{},F).trades.filter(t=>t.R<-1.3)){const b=B[t.i1];console.log(new Date(t.t*1000).toISOString().slice(0,16),'dir',t.dir,'entry',t.entry.toFixed(2),'stop',t.stop.toFixed(2),'exit',t.exit.toFixed(2),'R',t.R.toFixed(2),'fundR',t.fundR.toFixed(2),t.why,'bars',t.bars,'dist%',(Math.abs(t.entry-t.stop)/t.entry*100).toFixed(2),'bar',b.open,b.high,b.low,b.close);}
