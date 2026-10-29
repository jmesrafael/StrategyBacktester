// tiers.js — risk that steps DOWN as the account grows, no $ cap: 2.5% below $500, 2.0% from $500, 1.5% from $1,000 (₱58 per $).
// mode 'now'  = tier from the CURRENT balance (risk goes back up if the balance falls below a step)
// mode 'peak' = tier from the HIGHEST balance so far (a step down is permanent: risk never rises during a drawdown)
// compared with flat 2.5% no cap and flat 2.5% with the bot's $10 cap. Start ₱10,000 (~$172) on Jan 1 2020.
const L=require('./lib.js');const five=['SOL','ZEC','NEAR','ADA','GALA'];const PHP=58,START=10000;
const D={};for(const c of five)D[c]={B:L.loadC(L.ROOT+`bb-core/data/${c}.json`),F:L.loadF(L.ROOT+`bb-core/data/funding/${c}.json`),I:L.loadC(L.ROOT+`i-core/data/${c}.json`)};
const S3={'BB 1:4':five.flatMap(c=>L.bb.backtest(D[c].B,{targetR:4},D[c].F).trades),'BB no-target':five.flatMap(c=>L.bb.backtest(D[c].B,{targetR:0},D[c].F).trades),'I-Core':five.flatMap(c=>L.ic.backtest(D[c].I).trades)};
const tier=(usd)=>usd<500?0.025:usd<1000?0.02:0.015;
const RULES={
 'flat 2.5%, $10 cap (bot today)':(bal)=>Math.min(10*PHP,bal*0.025),
 'flat 2.5%, no cap':(bal)=>bal*0.025,
 'tiers 2.5/2.0/1.5 on balance':(bal)=>bal*tier(bal/PHP),
 'tiers 2.5/2.0/1.5 on peak':(bal,pk)=>bal*tier(pk/PHP),
};
const peso=v=>{const a=Math.abs(v),s=v<0?'-₱':'₱';return a>=1e9?s+(a/1e9).toFixed(2)+'B':a>=1e6?s+(a/1e6).toFixed(2)+'M':a>=1e3?s+(a/1e3).toFixed(1)+'k':s+Math.round(a);};
const Y=[2020,2021,2022,2023,2024,2025,2026];
function run(lists,rule){const bal=lists.map(()=>START),pkA=lists.map(()=>START),ev=[],risk=new Map();
 lists.forEach((T,j)=>T.forEach((t,k)=>{ev.push([t.t,1,j,k]);ev.push([t.tExit,0,j,k]);}));ev.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 let pk=START*lists.length,dd=0,ddPk=0,ddLow=0;const yEnd={},ddY={};let yPk={};
 for(const[t,typ,j,k]of ev){const key=j+':'+k;
  if(typ===1)risk.set(key,rule(bal[j],pkA[j]));
  else{bal[j]+=lists[j][k].R*risk.get(key);pkA[j]=Math.max(pkA[j],bal[j]);const eq=bal.reduce((a,b)=>a+b,0),y=new Date(t*1000).getUTCFullYear();
   if(eq>pk)pk=eq;if(1-eq/pk>dd){dd=1-eq/pk;ddPk=pk;ddLow=eq;}yEnd[y]=eq;yPk[y]=Math.max(yPk[y]||0,eq);ddY[y]=Math.max(ddY[y]||0,1-eq/Math.max(yPk[y],pk));}}
 return {end:bal.reduce((a,b)=>a+b,0),dd,ddPk,ddLow,yEnd,ddY};}
for(const[k,t]of Object.entries(S3)){console.log(`\n=== ${k}: one ₱10,000 account from Jan 2020 ===`);
 console.log('rule'.padEnd(32)+Y.map(y=>String(y).padStart(9)).join('')+'   deepest drop            worst drop in ₱');
 for(const[r,fn]of Object.entries(RULES)){const x=run([t],fn);console.log(r.padEnd(32)+Y.map(y=>peso(x.yEnd[y]).padStart(9)).join('')+`   ${(x.dd*100).toFixed(0).padStart(3)}%  ${peso(x.ddPk)} -> ${peso(x.ddLow)}`.padEnd(30)+`  ${peso(x.ddLow-x.ddPk)}`);}}
console.log('\n=== TANDEMS: two ₱10,000 accounts, each with its own tiers ===');
for(const[a,b]of [['BB no-target','I-Core'],['BB 1:4','I-Core'],['BB 1:4','BB no-target']]){console.log(`\n${a} + ${b}`);
 for(const r of ['flat 2.5%, $10 cap (bot today)','flat 2.5%, no cap','tiers 2.5/2.0/1.5 on peak']){const x=run([S3[a],S3[b]],RULES[r]);console.log('  '+r.padEnd(30)+Y.map(y=>peso(x.yEnd[y]).padStart(9)).join('')+`   drop ${(x.dd*100).toFixed(0)}% (${peso(x.ddPk)} -> ${peso(x.ddLow)})`);}}
console.log('\nWhen the steps happen (BB no-target, tiers on peak): first time above $500 / $1,000:');
{const t=[...S3['BB no-target']];const ev=[];t.forEach((x,k)=>{ev.push([x.t,1,k]);ev.push([x.tExit,0,k]);});ev.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let bal=START,pk=START;const r=new Map();let s1=null,s2=null;
 for(const[tm,typ,k]of ev){if(typ===1)r.set(k,bal*tier(pk/PHP));else{bal+=t[k].R*r.get(k);pk=Math.max(pk,bal);if(!s1&&bal/PHP>=500)s1=tm;if(!s2&&bal/PHP>=1000)s2=tm;}}
 console.log('  $500 (₱29k) reached '+new Date(s1*1000).toISOString().slice(0,10)+' · $1,000 (₱58k) reached '+new Date(s2*1000).toISOString().slice(0,10));}
