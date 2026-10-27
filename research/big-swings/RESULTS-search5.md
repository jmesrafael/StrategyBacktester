# Tuned on the 5 coins (picked on 2020-22 only, frozen)

bb-core, same 5 coins: total +493R | 2020-22 +227R | 2023-26 +267R | DD 26R

Configs that were green in all 3 train years with >=4/5 coins profitable: 908. Ranked by train R / train DD; top 20 judged on the unseen 2023-26 and on BTC+ETH:

| strategy | stop/trail/trend/exitOpp | train R | train DD | TEST R (23-26) | TEST DD | total R | yrs+ | coins+ (total) | BTC+ETH R | beats bb-core? |
|---|---|---|---|---|---|---|---|---|---|---|
| ichimoku {full:false} | 2/7/T/F | +251 | 17 | +407 | 30 | +658 | 7/7 | 5/5 | +150 | **YES** |
| supertrend {n:10,m:3} | 1.5/4/T/T | +238 | 16 | +113 | 26 | +352 | 6/7 | 5/5 | +168 | no |
| vortex {n:14,min:1} | 2/7/T/F | +217 | 15 | +356 | 38 | +573 | 7/7 | 5/5 | +163 | no |
| supertrend {n:10,m:3} | 1.5/4/T/F | +238 | 17 | +113 | 26 | +351 | 6/7 | 5/5 | +166 | no |
| vortex {n:14,min:1} | 2/5/T/F | +235 | 16 | +160 | 36 | +395 | 7/7 | 5/5 | +164 | no |
| ichimoku {full:true} | 2/7/T/F | +210 | 15 | +195 | 34 | +404 | 7/7 | 5/5 | +108 | no |
| ichimoku {full:false} | 1.5/7/T/F | +322 | 23 | +473 | 39 | +795 | 7/7 | 5/5 | +231 | no |
| ichimoku {full:false} | 3/7/T/F | +163 | 12 | +215 | 17 | +378 | 7/7 | 5/5 | +82 | no |
| adx {n:14,min:20} | 2/4/T/F | +162 | 12 | +45 | 27 | +207 | 6/7 | 5/5 | +30 | no |
| ichimoku {full:false} | 3/5/T/F | +138 | 10 | +107 | 21 | +245 | 7/7 | 5/5 | +111 | no |
| ichimoku {full:false} | 3/4/T/T | +130 | 10 | +49 | 25 | +179 | 7/7 | 5/5 | +96 | no |
| ichimoku {full:true} | 3/7/T/F | +133 | 10 | +125 | 24 | +258 | 7/7 | 5/5 | +51 | no |
| supertrend {n:10,m:3} | 3/4/T/T | +127 | 9 | +80 | 17 | +207 | 7/7 | 5/5 | +88 | no |
| supertrend {n:10,m:3} | 3/4/T/F | +126 | 9 | +79 | 17 | +205 | 7/7 | 5/5 | +87 | no |
| ichimoku {full:false} | 2/5/T/F | +209 | 17 | +164 | 35 | +373 | 7/7 | 5/5 | +175 | no |
| keltner {n:10,m:1.5} | 1.5/7/T/F | +331 | 27 | +581 | 46 | +912 | 7/7 | 5/5 | +297 | no |
| ichimoku {full:false} | 3/5/T/T | +138 | 11 | +118 | 21 | +257 | 7/7 | 5/5 | +116 | no |
| vortex {n:14,min:1} | 1.5/5/T/F | +307 | 25 | +166 | 44 | +473 | 7/7 | 5/5 | +185 | no |
| adx {n:14,min:20} | 2/4/T/T | +143 | 12 | +43 | 25 | +186 | 7/7 | 5/5 | +17 | no |
| ichimoku {full:false} | 2/4/T/F | +194 | 16 | +90 | 35 | +284 | 7/7 | 5/5 | +137 | no |

bb-core 2023-26 DD on these coins: 24R. "beats" = test R > bb-core test R, test DD <= 1.5x bb-core's, 7/7 years.
Winners: 1
