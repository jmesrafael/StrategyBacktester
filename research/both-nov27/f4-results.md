# F4 coins results (Nov 27, 2026)

Scores (2020-23 single-coin per bot, flat; cagr/fall): see score-*.out. ARB and SUI have no 2020-22 data (ARB from 2023-03, SUI 2023-05): unscorable, kept as live, cannot be chosen on test 3. Baseline reproduces via causalF4.js (183.0/43.7 ... 177.3/49.2).

```
0/6 baseline via causalF4              .183.0/43.7  .396.8/49.1  .503.0/54.1  .640.9/53.0  .179.3/44.2  .177.3/49.2
drop1 {"bb":["SOL","NEAR","ADA","GALA","ARB"],"ic":["SOL","NEAR","ADA","GALA","ETH"],"tc":["SOL","NEAR","ADA","GALA","ETH","SUI","ARB"]}
0/6 F4 drop1                           .162.4/36.0  .188.9/52.2  .473.1/49.5  .275.2/56.2  .157.0/36.5  .152.9/38.7
drop2 {"bb":["SOL","ADA","GALA","ARB"],"ic":["SOL","ADA","GALA","ETH"],"tc":["SOL","NEAR","ADA","GALA","SUI","ARB"]}
0/6 F4 drop2                           .148.7/31.7  .142.3/49.4  .380.6/43.5  .196.4/53.2  .143.0/34.2  .138.3/35.5
add1 {"bb":["SOL","ZEC","NEAR","ADA","GALA","ARB","AVAX"],"ic":["SOL","ZEC","NEAR","ADA","GALA","ETH","BNB"],"tc":["SOL","ZEC","NEAR","ADA","GALA","ETH","SUI","ARB","BTC"]}
4/6 F4 add1                            Y193.9/41.3  Y421.8/47.8  .779.2/58.1  .686.9/59.6  Y190.0/41.4  Y188.7/40.2
add2 {"bb":["SOL","ZEC","NEAR","ADA","GALA","ARB","AVAX","DOGE"],"ic":["SOL","ZEC","NEAR","ADA","GALA","ETH","BNB","BTC"],"tc":["SOL","ZEC","NEAR","ADA","GALA","ETH","SUI","ARB","BTC","AVAX"]}
3/6 F4 add2                            Y203.9/39.8  .514.5/51.0  .1117.8/67.4  .840.0/64.4  Y200.7/40.3  Y200.0/37.2
add3 {"bb":["SOL","ZEC","NEAR","ADA","GALA","ARB","AVAX","DOGE","DOT"],"ic":["SOL","ZEC","NEAR","ADA","GALA","ETH","BNB","BTC","AVAX"],"tc":["SOL","ZEC","NEAR","ADA","GALA","ETH","SUI","ARB","BTC","AVAX","BNB"]}
3/6 F4 add3                            Y206.0/42.1  .485.9/54.8  .1187.0/72.3  .699.2/73.9  Y202.6/42.4  Y202.2/40.2
drop1+add1 {"bb":["SOL","NEAR","ADA","GALA","ARB","AVAX"],"ic":["SOL","NEAR","ADA","GALA","ETH","BNB"],"tc":["SOL","NEAR","ADA","GALA","ETH","SUI","ARB","BTC"]}
1/6 F4 drop1+add1                      .177.7/38.3  .213.7/56.3  Y744.3/51.2  .320.7/63.2  .172.4/38.7  .170.1/41.5
drop2+add2 {"bb":["SOL","ADA","GALA","ARB","AVAX","DOGE"],"ic":["SOL","ADA","GALA","ETH","BNB","BTC"],"tc":["SOL","NEAR","ADA","GALA","SUI","ARB","BTC","AVAX"]}
3/6 F4 drop2+add2                      Y184.2/35.0  .228.0/50.3  .920.5/57.2  .320.5/65.2  Y180.1/38.3  Y179.3/35.9
drop2+add3 {"bb":["SOL","ADA","GALA","ARB","AVAX","DOGE","DOT"],"ic":["SOL","ADA","GALA","ETH","BNB","BTC","AVAX"],"tc":["SOL","NEAR","ADA","GALA","SUI","ARB","BTC","AVAX","BNB"]}
3/6 F4 drop2+add3                      Y188.7/36.2  .213.6/55.7  .1018.5/61.3  .275.2/74.8  Y184.5/36.9  Y183.9/36.0

fitK on chosen:
K 1.027
1/6 F4 drop1+add1 fitK  .178.4/39.0  .222.9/57.2  Y774.9/52.1  .328.9/64.3  .173.6/39.6  .171.6/42.2
```

Verdict: no 6/6. Test 3 chooses drop1+add1 (only setting with test-3 pass), but it fails the unseen 2024-26 (growth 320 vs 641, fall 63) and fresh-2024. add1 passes 4/6 but fails test 3 and 4. Coin changes on 2020-23 do not transfer: FAIL.
