# bb-core v2 research — binance candles, costs x1, coins SOL ZEC NEAR ADA GALA
Baseline = bb-core rules unchanged (market entry at the next open, stop = middle band, 4R target, 48-bar time exit). Exits: target 242 · time 453 · stop 815

## Baseline

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bb-core (baseline) | 1510 | 100% | **+493.2** | +0.327 | 39% | 25.6 | 7/7 | +287.9 | +205.3 | 5/5 | +454.4 |

## A. Break-even stop (market entry, target 4R)
beAtR = how far in profit (in R) before the stop jumps to entry. offset 0.12% = entry + enough to pay the exit fee/slippage. Takes effect from the NEXT candle.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE at 0.5R, offset 0% | 1932 | 100% | **+336.6** | +0.174 | 19% | 32.2 | 7/7 | +168.1 | +168.5 | 5/5 | +287.4 |
| BE at 0.75R, offset 0% | 1738 | 100% | **+355.5** | +0.205 | 24% | 30.2 | 7/7 | +177.1 | +178.4 | 5/5 | +306.2 |
| BE at 1R, offset 0% | 1653 | 100% | **+379.7** | +0.230 | 28% | 24.7 | 7/7 | +199.2 | +180.5 | 5/5 | +333.0 |
| BE at 1.25R, offset 0% | 1600 | 100% | **+403.1** | +0.252 | 30% | 24.9 | 7/7 | +218.7 | +184.4 | 5/5 | +361.6 |
| BE at 1.5R, offset 0% | 1563 | 100% | **+404.6** | +0.259 | 32% | 25.3 | 7/7 | +220.8 | +183.8 | 5/5 | +369.5 |
| BE at 2R, offset 0% | 1532 | 100% | **+430.8** | +0.281 | 35% | 25.9 | 7/7 | +244.6 | +186.2 | 5/5 | +399.7 |
| BE at 2.5R, offset 0% | 1519 | 100% | **+484.8** | +0.319 | 37% | 24.6 | 7/7 | +280.3 | +204.5 | 5/5 | +444.9 |
| BE at 3R, offset 0% | 1514 | 100% | **+490.4** | +0.324 | 38% | 24.3 | 7/7 | +286.4 | +204.0 | 5/5 | +455.6 |
| BE at 0.5R, offset 0.12% | 1957 | 100% | **+321.9** | +0.164 | 33% | 29.7 | 7/7 | +157.9 | +164.0 | 5/5 | +271.5 |
| BE at 0.75R, offset 0.12% | 1751 | 100% | **+349.1** | +0.199 | 34% | 29.3 | 7/7 | +171.5 | +177.7 | 5/5 | +296.9 |
| BE at 1R, offset 0.12% | 1657 | 100% | **+381.9** | +0.230 | 35% | 24.1 | 7/7 | +200.0 | +181.9 | 5/5 | +331.8 |
| BE at 1.25R, offset 0.12% | 1602 | 100% | **+408.6** | +0.255 | 36% | 23.9 | 7/7 | +224.0 | +184.6 | 5/5 | +369.0 |
| BE at 1.5R, offset 0.12% | 1563 | 100% | **+411.6** | +0.263 | 36% | 24.9 | 7/7 | +225.0 | +186.6 | 5/5 | +376.3 |
| BE at 2R, offset 0.12% | 1532 | 100% | **+431.7** | +0.282 | 37% | 25.7 | 7/7 | +244.0 | +187.6 | 5/5 | +400.5 |
| BE at 2.5R, offset 0.12% | 1519 | 100% | **+483.5** | +0.318 | 38% | 25.3 | 7/7 | +278.2 | +205.2 | 5/5 | +443.6 |
| BE at 3R, offset 0.12% | 1514 | 100% | **+488.1** | +0.322 | 39% | 25.3 | 7/7 | +283.8 | +204.3 | 5/5 | +453.2 |

## B. Break-even at 1R vs target size
Does BE change which target is best?

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| target 2R, no BE | 1810 | 100% | **+370.2** | +0.205 | 44% | 24.7 | 7/7 | +228.3 | +141.9 | 5/5 | +330.4 |
| target 2R, BE at 1R (+0.12%) | 1918 | 100% | **+309.7** | +0.161 | 41% | 24.9 | 7/7 | +172.5 | +137.2 | 5/5 | +258.5 |
| target 3R, no BE | 1601 | 100% | **+414.6** | +0.259 | 40% | 26.1 | 7/7 | +228.7 | +185.9 | 5/5 | +375.9 |
| target 3R, BE at 1R (+0.12%) | 1738 | 100% | **+345.5** | +0.199 | 36% | 24.4 | 7/7 | +161.1 | +184.4 | 5/5 | +294.5 |
| target 4R, no BE | 1510 | 100% | **+493.2** | +0.327 | 39% | 25.6 | 7/7 | +287.9 | +205.3 | 5/5 | +454.4 |
| target 4R, BE at 1R (+0.12%) | 1657 | 100% | **+381.9** | +0.230 | 35% | 24.1 | 7/7 | +200.0 | +181.9 | 5/5 | +331.8 |
| target 5R, no BE | 1453 | 100% | **+484.7** | +0.334 | 37% | 25.2 | 7/7 | +290.1 | +194.7 | 5/5 | +446.0 |
| target 5R, BE at 1R (+0.12%) | 1609 | 100% | **+367.7** | +0.229 | 34% | 25.4 | 7/7 | +208.8 | +158.8 | 5/5 | +317.7 |
| target 6R, no BE | 1415 | 100% | **+521.4** | +0.368 | 37% | 24.2 | 7/7 | +305.4 | +216.0 | 5/5 | +482.4 |
| target 6R, BE at 1R (+0.12%) | 1579 | 100% | **+417.4** | +0.264 | 34% | 24.7 | 7/7 | +233.2 | +184.1 | 5/5 | +367.2 |
| target 8R, no BE | 1376 | 100% | **+542.5** | +0.394 | 37% | 23.2 | 7/7 | +318.0 | +224.5 | 5/5 | +503.1 |
| target 8R, BE at 1R (+0.12%) | 1545 | 100% | **+416.5** | +0.270 | 34% | 24.0 | 7/7 | +231.2 | +185.3 | 5/5 | +366.1 |
| target 10R, no BE | 1365 | 100% | **+582.1** | +0.426 | 37% | 22.2 | 7/7 | +339.5 | +242.6 | 5/5 | +542.2 |
| target 10R, BE at 1R (+0.12%) | 1535 | 100% | **+447.2** | +0.291 | 34% | 23.4 | 7/7 | +240.1 | +207.0 | 5/5 | +396.3 |

## B2. Break-even at 1R vs time exit

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| maxBars 24, no BE | 1846 | 100% | **+403.1** | +0.218 | 43% | 37.1 | 7/7 | +245.6 | +157.5 | 5/5 | +353.4 |
| maxBars 24, BE at 1R (+0.12%) | 1926 | 100% | **+356.8** | +0.185 | 39% | 27.0 | 7/7 | +190.0 | +166.8 | 5/5 | +295.7 |
| maxBars 48, no BE | 1510 | 100% | **+493.2** | +0.327 | 39% | 25.6 | 7/7 | +287.9 | +205.3 | 5/5 | +454.4 |
| maxBars 48, BE at 1R (+0.12%) | 1657 | 100% | **+381.9** | +0.230 | 35% | 24.1 | 7/7 | +200.0 | +181.9 | 5/5 | +331.8 |
| maxBars 72, no BE | 1331 | 100% | **+510.4** | +0.383 | 38% | 29.3 | 7/7 | +273.4 | +237.0 | 5/5 | +477.2 |
| maxBars 72, BE at 1R (+0.12%) | 1542 | 100% | **+402.8** | +0.261 | 35% | 26.4 | 7/7 | +213.8 | +189.0 | 5/5 | +359.2 |
| maxBars 96, no BE | 1235 | 100% | **+514.6** | +0.417 | 36% | 25.9 | 7/7 | +294.4 | +220.2 | 5/5 | +484.3 |
| maxBars 96, BE at 1R (+0.12%) | 1475 | 100% | **+402.3** | +0.273 | 33% | 21.6 | 7/7 | +224.1 | +178.2 | 5/5 | +360.4 |

## C. Partial profit and trailing the stop (market entry)
partial = sell part at X R and move the rest to break-even; trail = after BE the stop follows the 20-SMA (only in profit direction).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| partial 50% at 1R + BE rest (4R) | 1657 | 100% | **+302.2** | +0.182 | 56% | 18.4 | 7/7 | +162.3 | +139.9 | 5/5 | +262.6 |
| partial 33% at 1R + BE rest (4R) | 1657 | 100% | **+327.4** | +0.198 | 56% | 20.7 | 7/7 | +174.6 | +152.8 | 5/5 | +285.4 |
| partial 50% at 2R + BE rest (4R) | 1531 | 100% | **+393.1** | +0.257 | 44% | 25.0 | 7/7 | +229.4 | +163.7 | 5/5 | +356.3 |
| partial 33% at 2R + BE rest (4R) | 1531 | 100% | **+408.1** | +0.267 | 44% | 24.5 | 7/7 | +236.3 | +171.8 | 5/5 | +370.6 |
| partial 50% at 3R + BE rest (4R) | 1514 | 100% | **+477.4** | +0.315 | 40% | 24.7 | 7/7 | +277.2 | +200.1 | 5/5 | +438.6 |
| BE 1R + trail 20-SMA, target 4R | 1766 | 100% | **+338.4** | +0.192 | 46% | 29.2 | 7/7 | +180.6 | +157.8 | 5/5 | +283.1 |
| BE 1.5R + trail 20-SMA, target 4R | 1646 | 100% | **+375.2** | +0.228 | 45% | 30.8 | 7/7 | +216.0 | +159.3 | 5/5 | +333.3 |
| BE 1R + trail 20-SMA, target 6R | 1713 | 100% | **+327.5** | +0.191 | 45% | 27.3 | 7/7 | +170.4 | +157.1 | 5/5 | +271.7 |
| BE 1R + trail 20-SMA, target 8R | 1697 | 100% | **+318.8** | +0.188 | 45% | 26.4 | 7/7 | +171.2 | +147.5 | 5/5 | +262.5 |
| BE 1R + trail 20-SMA, target 10R | 1689 | 100% | **+336.0** | +0.199 | 45% | 24.4 | 7/7 | +168.4 | +167.6 | 5/5 | +279.4 |
| BE 2R + trail 20-SMA, target 8R | 1503 | 100% | **+390.0** | +0.259 | 43% | 31.5 | 7/7 | +239.2 | +150.8 | 5/5 | +351.2 |
| partial 50% at 2R + trail, target 8R | 1502 | 100% | **+355.6** | +0.237 | 44% | 29.2 | 7/7 | +208.8 | +146.8 | 5/5 | +315.2 |
| partial 50% at 2R + trail, target 6R | 1525 | 100% | **+368.5** | +0.242 | 43% | 29.1 | 7/7 | +218.7 | +149.8 | 5/5 | +327.9 |
| partial 50% at 1R + trail, target 8R | 1697 | 100% | **+248.5** | +0.146 | 56% | 22.7 | 7/7 | +134.4 | +114.1 | 5/5 | +205.1 |

## D. Limit entry — mid: limit at the midpoint of the signal candle (wicks included)
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 1 candle(s), target entry | 1417 | 58% | **+416.9** | +0.294 | 38% | 29.0 | 7/7 | +244.7 | +172.2 | 5/5 | +388.0 |
| mid, wait 1 candle(s), target signal | 1381 | 58% | **+467.4** | +0.338 | 37% | 26.9 | 7/7 | +288.4 | +179.0 | 5/5 | +439.4 |
| mid, wait 2 candle(s), target entry | 1402 | 66% | **+374.1** | +0.267 | 37% | 34.9 | 7/7 | +247.8 | +126.2 | 5/5 | +347.3 |
| mid, wait 2 candle(s), target signal | 1356 | 66% | **+402.8** | +0.297 | 36% | 32.8 | 7/7 | +267.8 | +135.0 | 5/5 | +375.2 |
| mid, wait 3 candle(s), target entry | 1342 | 67% | **+261.9** | +0.195 | 35% | 29.2 | 6/7 | +189.6 | +72.3 | 5/5 | +235.3 |
| mid, wait 3 candle(s), target signal | 1307 | 67% | **+292.9** | +0.224 | 34% | 30.6 | 7/7 | +216.3 | +76.7 | 5/5 | +265.3 |
| mid, wait 6 candle(s), target entry | 1315 | 74% | **+252.4** | +0.192 | 34% | 36.8 | 6/7 | +189.6 | +62.7 | 5/5 | +224.9 |
| mid, wait 6 candle(s), target signal | 1273 | 74% | **+296.3** | +0.233 | 32% | 36.9 | 6/7 | +230.6 | +65.7 | 5/5 | +267.8 |

## D. Limit entry — 25% pullback from the close, % of the candle range
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rr25, wait 1 candle(s), target entry | 1429 | 55% | **+383.7** | +0.269 | 37% | 28.8 | 7/7 | +232.6 | +151.1 | 5/5 | +359.8 |
| rr25, wait 1 candle(s), target signal | 1389 | 55% | **+459.7** | +0.331 | 37% | 30.9 | 7/7 | +286.7 | +173.0 | 5/5 | +435.7 |
| rr25, wait 2 candle(s), target entry | 1404 | 65% | **+324.8** | +0.231 | 36% | 31.3 | 7/7 | +228.1 | +96.7 | 5/5 | +299.3 |
| rr25, wait 2 candle(s), target signal | 1350 | 65% | **+392.0** | +0.290 | 35% | 30.2 | 7/7 | +275.1 | +116.9 | 5/5 | +366.1 |
| rr25, wait 3 candle(s), target entry | 1374 | 67% | **+228.2** | +0.166 | 33% | 31.5 | 6/7 | +181.7 | +46.5 | 5/5 | +202.8 |
| rr25, wait 3 candle(s), target signal | 1318 | 68% | **+288.5** | +0.219 | 32% | 33.1 | 7/7 | +215.8 | +72.7 | 5/5 | +263.1 |
| rr25, wait 6 candle(s), target entry | 1353 | 75% | **+262.1** | +0.194 | 33% | 29.5 | 7/7 | +177.8 | +84.3 | 5/5 | +235.7 |
| rr25, wait 6 candle(s), target signal | 1294 | 76% | **+325.2** | +0.251 | 32% | 33.1 | 7/7 | +234.3 | +90.8 | 5/5 | +298.7 |

## D. Limit entry — 50% pullback from the close, % of the candle range
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rr50, wait 1 candle(s), target entry | 1140 | 28% | **+249.0** | +0.218 | 35% | 30.7 | 7/7 | +147.3 | +101.8 | 5/5 | +227.3 |
| rr50, wait 1 candle(s), target signal | 1082 | 28% | **+346.9** | +0.321 | 34% | 32.5 | 7/7 | +229.2 | +117.7 | 5/5 | +325.0 |
| rr50, wait 2 candle(s), target entry | 1138 | 40% | **+271.1** | +0.238 | 35% | 47.8 | 5/7 | +197.5 | +73.6 | 5/5 | +243.3 |
| rr50, wait 2 candle(s), target signal | 1080 | 39% | **+304.6** | +0.282 | 32% | 41.7 | 5/7 | +257.5 | +47.1 | 5/5 | +276.1 |
| rr50, wait 3 candle(s), target entry | 1125 | 45% | **+181.8** | +0.162 | 32% | 42.1 | 5/7 | +149.5 | +32.3 | 5/5 | +151.2 |
| rr50, wait 3 candle(s), target signal | 1052 | 44% | **+211.0** | +0.201 | 29% | 48.2 | 5/7 | +174.8 | +36.2 | 5/5 | +179.8 |
| rr50, wait 6 candle(s), target entry | 1141 | 55% | **+112.6** | +0.099 | 30% | 52.6 | 5/7 | +112.1 | +0.4 | 5/5 | +73.7 |
| rr50, wait 6 candle(s), target signal | 1081 | 55% | **+131.3** | +0.121 | 25% | 67.4 | 5/7 | +157.4 | -26.1 | 4/5 | +91.9 |

## D. Limit entry — 25% pullback from the close, % of the close→stop distance
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rd25, wait 1 candle(s), target entry | 1268 | 34% | **+314.0** | +0.248 | 32% | 35.0 | 7/7 | +222.3 | +91.7 | 5/5 | +288.8 |
| rd25, wait 1 candle(s), target signal | 1204 | 34% | **+387.4** | +0.322 | 31% | 31.8 | 7/7 | +287.2 | +100.2 | 5/5 | +361.9 |
| rd25, wait 2 candle(s), target entry | 1298 | 52% | **+343.6** | +0.265 | 34% | 34.4 | 7/7 | +240.0 | +103.5 | 5/5 | +317.7 |
| rd25, wait 2 candle(s), target signal | 1235 | 51% | **+385.5** | +0.312 | 32% | 30.8 | 7/7 | +273.5 | +112.0 | 5/5 | +359.2 |
| rd25, wait 3 candle(s), target entry | 1318 | 60% | **+290.2** | +0.220 | 32% | 28.9 | 6/7 | +204.5 | +85.7 | 5/5 | +264.0 |
| rd25, wait 3 candle(s), target signal | 1252 | 60% | **+332.8** | +0.266 | 31% | 31.8 | 6/7 | +250.9 | +81.9 | 5/5 | +306.4 |
| rd25, wait 6 candle(s), target entry | 1325 | 72% | **+314.1** | +0.237 | 33% | 29.9 | 7/7 | +213.1 | +100.9 | 5/5 | +287.4 |
| rd25, wait 6 candle(s), target signal | 1260 | 71% | **+355.0** | +0.282 | 31% | 28.8 | 6/7 | +255.2 | +99.8 | 5/5 | +328.1 |

## D. Limit entry — 50% pullback from the close, % of the close→stop distance
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rd50, wait 1 candle(s), target entry | 530 | 9% | **+107.2** | +0.202 | 27% | 23.8 | 5/7 | +77.0 | +30.2 | 5/5 | +88.4 |
| rd50, wait 1 candle(s), target signal | 500 | 9% | **+151.3** | +0.303 | 21% | 32.3 | 5/7 | +131.2 | +20.1 | 5/5 | +131.8 |
| rd50, wait 2 candle(s), target entry | 798 | 22% | **+133.1** | +0.167 | 26% | 36.1 | 3/7 | +132.5 | +0.6 | 4/5 | +106.4 |
| rd50, wait 2 candle(s), target signal | 732 | 21% | **+172.4** | +0.235 | 20% | 44.7 | 4/7 | +181.5 | -9.1 | 5/5 | +145.1 |
| rd50, wait 3 candle(s), target entry | 877 | 29% | **+78.7** | +0.090 | 25% | 63.7 | 5/7 | +118.9 | -40.2 | 4/5 | +49.4 |
| rd50, wait 3 candle(s), target signal | 804 | 29% | **+80.8** | +0.100 | 19% | 65.6 | 4/7 | +131.2 | -50.4 | 5/5 | +50.7 |
| rd50, wait 6 candle(s), target entry | 1045 | 45% | **+98.2** | +0.094 | 25% | 52.6 | 5/7 | +112.4 | -14.1 | 4/5 | +64.2 |
| rd50, wait 6 candle(s), target signal | 955 | 45% | **+103.0** | +0.108 | 19% | 73.1 | 5/7 | +152.9 | -49.9 | 5/5 | +68.6 |

### D2. Which signals does a limit order miss? (R of the SAME signals traded at market, baseline rules)
| config | signals matched | market R of signals FILLED | limit R of the same trades | market R of signals MISSED | missed (ran away / expired / other) |
|---|---|---|---|---|---|
| mid, wait 1 | 1337 | +109.2 (637) | +219.4 | +348.4 (700) | 7 / 1015 / 0 |
| mid, wait 3 | 1292 | +27.9 (824) | +194.4 | +423.2 (468) | 13 / 639 / 0 |
| rr25, wait 1 | 1320 | +31.5 (652) | +140.1 | +427.1 (668) | 9 / 1161 / 0 |
| rr25, wait 3 | 1300 | -16.8 (851) | +151.0 | +457.8 (449) | 13 / 651 / 0 |
| rr50, wait 1 | 1337 | -27.3 (245) | +44.9 | +505.6 (1092) | 10 / 2852 / 30 |
| rr50, wait 3 | 1289 | -153.3 (500) | +34.1 | +600.9 (789) | 16 / 1350 / 31 |
| rd25, wait 1 | 1331 | +35.8 (527) | +147.5 | +413.6 (804) | 9 / 2422 / 0 |
| rd25, wait 3 | 1268 | -3.7 (764) | +172.4 | +450.4 (504) | 12 / 856 / 0 |
| rd50, wait 1 | 1475 | -48.7 (162) | +12.8 | +526.8 (1313) | 12 / 5250 / 0 |
| rd50, wait 3 | 1347 | -196.9 (412) | -5.8 | +624.1 (935) | 17 / 2090 / 0 |

## D3. Fill model sensitivity (mid, wait 2, target entry)
limitBuf 0 = the order fills as soon as price TOUCHES the level (optimistic); 0.05% = price must trade through (default); 0.15% = harsher.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 2, limitBuf 0% | 1411 | 67% | **+384.5** | +0.273 | 37% | 33.9 | 7/7 | +251.7 | +132.9 | 5/5 | +357.7 |
| mid, wait 2, limitBuf 0.05% | 1402 | 66% | **+374.1** | +0.267 | 37% | 34.9 | 7/7 | +247.8 | +126.2 | 5/5 | +347.3 |
| mid, wait 2, limitBuf 0.15% | 1381 | 64% | **+323.5** | +0.234 | 36% | 34.0 | 7/7 | +225.4 | +98.1 | 5/5 | +297.0 |

## D4. Limit entry that falls back to a MARKET entry if not filled
Order rests limitBars candles; if still unfilled it is bought at the next open (stop and target unchanged). Keeps the price improvement on pullbacks without missing the runaway breakouts, but the late market entries are worse than baseline.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 1 then market, target entry | 1527 | 100% | **+385.8** | +0.253 | 38% | 31.7 | 7/7 | +246.9 | +138.9 | 5/5 | +353.7 |
| mid, wait 1 then market, target signal | 1501 | 100% | **+428.5** | +0.286 | 38% | 28.6 | 7/7 | +284.4 | +144.2 | 5/5 | +396.0 |
| mid, wait 2 then market, target entry | 1525 | 99% | **+348.5** | +0.229 | 39% | 34.0 | 7/7 | +238.8 | +109.6 | 5/5 | +317.7 |
| mid, wait 2 then market, target signal | 1494 | 99% | **+395.2** | +0.265 | 38% | 30.9 | 7/7 | +278.2 | +117.0 | 5/5 | +363.9 |
| mid, wait 3 then market, target entry | 1531 | 99% | **+341.3** | +0.223 | 38% | 32.8 | 7/7 | +237.4 | +103.9 | 5/5 | +310.7 |
| mid, wait 3 then market, target signal | 1492 | 99% | **+381.8** | +0.256 | 38% | 28.1 | 7/7 | +280.8 | +101.0 | 5/5 | +350.7 |
| rr25, wait 1 then market, target entry | 1533 | 100% | **+375.0** | +0.245 | 38% | 28.6 | 7/7 | +249.6 | +125.4 | 5/5 | +343.9 |
| rr25, wait 1 then market, target signal | 1500 | 100% | **+432.6** | +0.288 | 38% | 28.6 | 7/7 | +294.8 | +137.8 | 5/5 | +401.8 |
| rr25, wait 2 then market, target entry | 1533 | 99% | **+326.8** | +0.213 | 39% | 31.0 | 7/7 | +233.8 | +93.0 | 5/5 | +297.4 |
| rr25, wait 2 then market, target signal | 1491 | 99% | **+393.1** | +0.264 | 38% | 31.0 | 7/7 | +278.5 | +114.6 | 5/5 | +363.7 |
| rr25, wait 3 then market, target entry | 1538 | 99% | **+325.1** | +0.211 | 39% | 30.0 | 7/7 | +226.8 | +98.3 | 5/5 | +296.2 |
| rr25, wait 3 then market, target signal | 1489 | 99% | **+393.0** | +0.264 | 38% | 29.1 | 7/7 | +283.8 | +109.1 | 5/5 | +364.2 |
| rd25, wait 1 then market, target entry | 1531 | 100% | **+365.0** | +0.238 | 38% | 29.6 | 7/7 | +242.3 | +122.7 | 5/5 | +333.4 |
| rd25, wait 1 then market, target signal | 1499 | 100% | **+435.6** | +0.291 | 37% | 28.6 | 7/7 | +288.2 | +147.4 | 5/5 | +404.0 |
| rd25, wait 2 then market, target entry | 1534 | 99% | **+333.2** | +0.217 | 39% | 31.8 | 7/7 | +234.4 | +98.8 | 5/5 | +303.5 |
| rd25, wait 2 then market, target signal | 1490 | 99% | **+412.8** | +0.277 | 38% | 30.7 | 7/7 | +282.0 | +130.9 | 5/5 | +383.1 |
| rd25, wait 3 then market, target entry | 1542 | 99% | **+339.6** | +0.220 | 39% | 30.8 | 7/7 | +231.1 | +108.5 | 5/5 | +310.6 |
| rd25, wait 3 then market, target signal | 1488 | 99% | **+416.9** | +0.280 | 38% | 28.7 | 7/7 | +289.1 | +127.8 | 5/5 | +387.9 |
| rd50, wait 1 then market, target entry | 1520 | 100% | **+347.4** | +0.229 | 38% | 31.5 | 7/7 | +239.8 | +107.6 | 5/5 | +309.0 |
| rd50, wait 1 then market, target signal | 1495 | 100% | **+389.2** | +0.260 | 38% | 31.0 | 7/7 | +278.3 | +110.9 | 5/5 | +351.0 |
| rd50, wait 2 then market, target entry | 1526 | 99% | **+318.0** | +0.208 | 39% | 34.1 | 6/7 | +237.0 | +81.0 | 5/5 | +281.0 |
| rd50, wait 2 then market, target signal | 1482 | 99% | **+361.5** | +0.244 | 38% | 33.6 | 6/7 | +275.1 | +86.4 | 5/5 | +324.6 |
| rd50, wait 3 then market, target entry | 1534 | 99% | **+297.2** | +0.194 | 39% | 30.8 | 6/7 | +237.3 | +59.8 | 5/5 | +260.5 |
| rd50, wait 3 then market, target signal | 1477 | 99% | **+333.6** | +0.226 | 37% | 37.3 | 6/7 | +272.4 | +61.2 | 5/5 | +296.9 |

## F. Maximise profit without break-even: target size × time exit (market entry)
CAUTION: the 4R target was already chosen after seeing these years; every extra grid cell here adds more in-sample selection. Look for a broad plateau, not the best single cell.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| target 4R, maxBars 48 | 1510 | 100% | **+493.2** | +0.327 | 39% | 25.6 | 7/7 | +287.9 | +205.3 | 5/5 | +454.4 |
| target 4R, maxBars 72 | 1331 | 100% | **+510.4** | +0.383 | 38% | 29.3 | 7/7 | +273.4 | +237.0 | 5/5 | +477.2 |
| target 4R, maxBars 96 | 1235 | 100% | **+514.6** | +0.417 | 36% | 25.9 | 7/7 | +294.4 | +220.2 | 5/5 | +484.3 |
| target 4R, maxBars 144 | 1054 | 100% | **+454.0** | +0.431 | 35% | 26.8 | 7/7 | +258.5 | +195.6 | 5/5 | +429.5 |
| target 6R, maxBars 48 | 1415 | 100% | **+521.4** | +0.368 | 37% | 24.2 | 7/7 | +305.4 | +216.0 | 5/5 | +482.4 |
| target 6R, maxBars 72 | 1234 | 100% | **+513.2** | +0.416 | 35% | 28.2 | 7/7 | +298.6 | +214.6 | 5/5 | +480.2 |
| target 6R, maxBars 96 | 1123 | 100% | **+518.1** | +0.461 | 33% | 26.0 | 7/7 | +307.5 | +210.6 | 5/5 | +488.1 |
| target 6R, maxBars 144 | 962 | 100% | **+500.3** | +0.520 | 31% | 19.0 | 7/7 | +302.3 | +198.0 | 5/5 | +475.2 |
| target 8R, maxBars 48 | 1376 | 100% | **+542.5** | +0.394 | 37% | 23.2 | 7/7 | +318.0 | +224.5 | 5/5 | +503.1 |
| target 8R, maxBars 72 | 1188 | 100% | **+551.8** | +0.464 | 35% | 28.5 | 7/7 | +321.3 | +230.5 | 5/5 | +518.7 |
| target 8R, maxBars 96 | 1078 | 100% | **+527.0** | +0.489 | 32% | 21.8 | 7/7 | +310.8 | +216.2 | 5/5 | +497.0 |
| target 8R, maxBars 144 | 918 | 100% | **+521.5** | +0.568 | 30% | 19.8 | 7/7 | +304.7 | +216.8 | 5/5 | +496.5 |
| target 10R, maxBars 48 | 1365 | 100% | **+582.1** | +0.426 | 37% | 22.2 | 7/7 | +339.5 | +242.6 | 5/5 | +542.2 |
| target 10R, maxBars 72 | 1167 | 100% | **+580.2** | +0.497 | 34% | 34.1 | 7/7 | +332.1 | +248.1 | 5/5 | +546.7 |
| target 10R, maxBars 96 | 1057 | 100% | **+560.8** | +0.531 | 32% | 27.7 | 7/7 | +334.2 | +226.6 | 5/5 | +530.5 |
| target 10R, maxBars 144 | 885 | 100% | **+527.9** | +0.596 | 29% | 25.7 | 7/7 | +330.5 | +197.3 | 5/5 | +503.1 |
| target 15R, maxBars 48 | 1338 | 100% | **+572.3** | +0.428 | 36% | 23.2 | 7/7 | +341.3 | +231.0 | 5/5 | +532.1 |
| target 15R, maxBars 72 | 1148 | 100% | **+546.0** | +0.476 | 33% | 35.0 | 7/7 | +331.6 | +214.4 | 5/5 | +512.3 |
| target 15R, maxBars 96 | 1030 | 100% | **+549.3** | +0.533 | 31% | 29.9 | 7/7 | +359.0 | +190.3 | 5/5 | +518.7 |
| target 15R, maxBars 144 | 847 | 100% | **+517.9** | +0.611 | 28% | 32.8 | 7/7 | +337.3 | +180.5 | 5/5 | +493.1 |
| target 20R, maxBars 48 | 1333 | 100% | **+567.2** | +0.425 | 36% | 23.2 | 7/7 | +332.7 | +234.5 | 5/5 | +527.1 |
| target 20R, maxBars 72 | 1143 | 100% | **+552.0** | +0.483 | 33% | 35.0 | 7/7 | +327.3 | +224.7 | 5/5 | +518.1 |
| target 20R, maxBars 96 | 1024 | 100% | **+553.0** | +0.540 | 31% | 29.9 | 7/7 | +354.4 | +198.6 | 5/5 | +522.3 |
| target 20R, maxBars 144 | 843 | 100% | **+552.3** | +0.655 | 28% | 32.8 | 7/7 | +343.7 | +208.5 | 5/5 | +527.2 |

## E. Combinations

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 1, target signal | 1381 | 58% | **+467.4** | +0.338 | 37% | 26.9 | 7/7 | +288.4 | +179.0 | 5/5 | +439.4 |
| mid, wait 1, target signal + BE 1R | 1497 | 58% | **+338.2** | +0.226 | 39% | 24.3 | 7/7 | +194.0 | +144.2 | 5/5 | +305.1 |
| mid, wait 1, target signal + target 8R | 1290 | 58% | **+468.1** | +0.363 | 36% | 29.6 | 7/7 | +267.4 | +200.7 | 5/5 | +439.2 |
| mid, wait 1, target signal + target 10R, maxBars 96 | 1003 | 58% | **+560.1** | +0.558 | 31% | 27.5 | 7/7 | +366.4 | +193.7 | 5/5 | +537.5 |
| mid, wait 1 then market | 1501 | 100% | **+428.5** | +0.286 | 38% | 28.6 | 7/7 | +284.4 | +144.2 | 5/5 | +396.0 |
| mid, wait 1 then market + BE 1R | 1633 | 99% | **+296.5** | +0.182 | 38% | 25.6 | 7/7 | +190.2 | +106.4 | 5/5 | +258.5 |
| mid, wait 1 then market + target 8R | 1372 | 100% | **+469.6** | +0.342 | 36% | 28.4 | 7/7 | +300.9 | +168.7 | 5/5 | +436.4 |
| mid, wait 1 then market + target 10R, maxBars 96 | 1054 | 100% | **+563.5** | +0.535 | 31% | 29.4 | 7/7 | +349.2 | +214.3 | 5/5 | +538.0 |
| market + target 8R | 1376 | 100% | **+542.5** | +0.394 | 37% | 23.2 | 7/7 | +318.0 | +224.5 | 5/5 | +503.1 |
| market + target 10R, maxBars 96 | 1057 | 100% | **+560.8** | +0.531 | 32% | 27.7 | 7/7 | +334.2 | +226.6 | 5/5 | +530.5 |
