// chosen on test 3 only: the only setting passing test 3 = drop1+add1. fitK on test 3 then judge all 6.
const H=require('./h.js'),X=require('./causalF4.js');
const coins={"bb":["SOL","NEAR","ADA","GALA","ARB","AVAX"],"ic":["SOL","NEAR","ADA","GALA","ETH","BNB"],"tc":["SOL","NEAR","ADA","GALA","ETH","SUI","ARB","BTC"]};
const c={coins,engine:X};const K=H.fitK(c);console.log('K',K.toFixed(3));H.evaluate({...c,K},'F4 drop1+add1 fitK');
