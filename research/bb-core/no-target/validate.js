const L=require('./lib.js');
let a=[],b=[];
for(const c of ['SOL','ZEC','NEAR','ADA','GALA']){const B=L.loadC(L.ROOT+`bb-core/data/${c}.json`),F=L.loadF(L.ROOT+`bb-core/data/funding/${c}.json`);
 a.push(...L.bb.backtest(B,{targetR:0},F).trades);b.push(...L.gen(B,L.SIG.bb,{targetR:0},F));}
const x=L.S(a),y=L.S(b);console.log('real engine A:',x.n,x.net.toFixed(2),'R | generic engine bb signal:',y.n,y.net.toFixed(2),'R');
