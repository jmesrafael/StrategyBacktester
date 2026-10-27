# bb-core v2 research — mexc candles, costs x1, coins SOL ZEC NEAR ADA GALA
Baseline = bb-core rules unchanged (market entry at the next open, stop = middle band, 4R target, 48-bar time exit). Exits: stop 781 · time 439 · target 221

## Baseline

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bb-core (baseline) | 1441 | 100% | **+435.3** | +0.302 | 39% | 28.1 | 7/7 | +230.3 | +205.0 | 5/5 | +398.4 |

## A. Break-even stop (market entry, target 4R)
beAtR = how far in profit (in R) before the stop jumps to entry. offset 0.12% = entry + enough to pay the exit fee/slippage. Takes effect from the NEXT candle.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE at 0.5R, offset 0% | 1816 | 100% | **+332.2** | +0.183 | 20% | 26.1 | 7/7 | +165.6 | +166.6 | 5/5 | +285.3 |
| BE at 0.75R, offset 0% | 1655 | 100% | **+332.9** | +0.201 | 25% | 24.4 | 6/7 | +151.0 | +181.9 | 5/5 | +287.7 |
| BE at 1R, offset 0% | 1583 | 100% | **+344.6** | +0.218 | 28% | 24.1 | 7/7 | +161.3 | +183.3 | 5/5 | +305.6 |
| BE at 1.25R, offset 0% | 1531 | 100% | **+362.2** | +0.237 | 30% | 24.5 | 7/7 | +182.0 | +180.2 | 5/5 | +322.3 |
| BE at 1.5R, offset 0% | 1486 | 100% | **+378.9** | +0.255 | 33% | 23.2 | 7/7 | +196.8 | +182.1 | 5/5 | +337.7 |
| BE at 2R, offset 0% | 1462 | 100% | **+380.4** | +0.260 | 35% | 26.3 | 7/7 | +202.7 | +177.7 | 5/5 | +348.1 |
| BE at 2.5R, offset 0% | 1450 | 100% | **+423.8** | +0.292 | 37% | 27.3 | 7/7 | +223.0 | +200.8 | 5/5 | +386.9 |
| BE at 3R, offset 0% | 1445 | 100% | **+425.6** | +0.295 | 38% | 27.6 | 7/7 | +226.1 | +199.4 | 5/5 | +390.6 |
| BE at 0.5R, offset 0.12% | 1834 | 100% | **+315.2** | +0.172 | 35% | 30.9 | 7/7 | +151.0 | +164.3 | 5/5 | +269.8 |
| BE at 0.75R, offset 0.12% | 1666 | 100% | **+319.3** | +0.192 | 35% | 28.3 | 6/7 | +138.2 | +181.1 | 5/5 | +276.9 |
| BE at 1R, offset 0.12% | 1586 | 100% | **+338.3** | +0.213 | 35% | 24.9 | 7/7 | +157.2 | +181.1 | 5/5 | +304.6 |
| BE at 1.25R, offset 0.12% | 1534 | 100% | **+365.5** | +0.238 | 36% | 23.8 | 7/7 | +182.5 | +183.1 | 5/5 | +326.5 |
| BE at 1.5R, offset 0.12% | 1490 | 100% | **+377.8** | +0.254 | 36% | 23.9 | 7/7 | +193.9 | +183.9 | 5/5 | +337.4 |
| BE at 2R, offset 0.12% | 1466 | 100% | **+381.1** | +0.260 | 37% | 26.2 | 7/7 | +202.8 | +178.3 | 5/5 | +349.4 |
| BE at 2.5R, offset 0.12% | 1451 | 100% | **+423.3** | +0.292 | 38% | 27.2 | 7/7 | +221.6 | +201.6 | 5/5 | +386.3 |
| BE at 3R, offset 0.12% | 1445 | 100% | **+426.5** | +0.295 | 38% | 27.5 | 7/7 | +226.7 | +199.8 | 5/5 | +391.5 |

## B. Break-even at 1R vs target size
Does BE change which target is best?

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| target 2R, no BE | 1719 | 100% | **+342.2** | +0.199 | 44% | 23.0 | 6/7 | +199.3 | +142.9 | 5/5 | +304.5 |
| target 2R, BE at 1R (+0.12%) | 1824 | 100% | **+285.7** | +0.157 | 40% | 24.5 | 6/7 | +139.7 | +146.0 | 5/5 | +252.8 |
| target 3R, no BE | 1521 | 100% | **+391.4** | +0.257 | 40% | 25.4 | 7/7 | +198.4 | +193.0 | 5/5 | +354.5 |
| target 3R, BE at 1R (+0.12%) | 1655 | 100% | **+311.4** | +0.188 | 36% | 26.6 | 6/7 | +127.9 | +183.5 | 5/5 | +276.9 |
| target 4R, no BE | 1441 | 100% | **+435.3** | +0.302 | 39% | 28.1 | 7/7 | +230.3 | +205.0 | 5/5 | +398.4 |
| target 4R, BE at 1R (+0.12%) | 1586 | 100% | **+338.3** | +0.213 | 35% | 24.9 | 7/7 | +157.2 | +181.1 | 5/5 | +304.6 |
| target 5R, no BE | 1384 | 100% | **+425.3** | +0.307 | 37% | 27.3 | 6/7 | +229.1 | +196.2 | 5/5 | +388.4 |
| target 5R, BE at 1R (+0.12%) | 1542 | 100% | **+328.3** | +0.213 | 35% | 24.3 | 6/7 | +166.2 | +162.0 | 5/5 | +293.2 |
| target 6R, no BE | 1356 | 100% | **+463.8** | +0.342 | 37% | 26.3 | 6/7 | +238.2 | +225.6 | 5/5 | +426.7 |
| target 6R, BE at 1R (+0.12%) | 1517 | 100% | **+378.5** | +0.250 | 34% | 23.6 | 6/7 | +184.7 | +193.8 | 5/5 | +342.8 |
| target 8R, no BE | 1317 | 100% | **+489.0** | +0.371 | 37% | 26.1 | 6/7 | +257.0 | +232.0 | 5/5 | +451.5 |
| target 8R, BE at 1R (+0.12%) | 1483 | 100% | **+391.4** | +0.264 | 34% | 23.0 | 6/7 | +191.2 | +200.2 | 5/5 | +355.2 |
| target 10R, no BE | 1308 | 100% | **+518.5** | +0.396 | 36% | 26.1 | 6/7 | +270.3 | +248.2 | 5/5 | +480.5 |
| target 10R, BE at 1R (+0.12%) | 1475 | 100% | **+421.9** | +0.286 | 34% | 23.4 | 6/7 | +206.1 | +215.8 | 5/5 | +387.9 |

## B2. Break-even at 1R vs time exit

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| maxBars 24, no BE | 1762 | 100% | **+384.2** | +0.218 | 44% | 32.8 | 7/7 | +218.1 | +166.1 | 5/5 | +336.7 |
| maxBars 24, BE at 1R (+0.12%) | 1842 | 100% | **+320.6** | +0.174 | 40% | 26.9 | 7/7 | +150.5 | +170.1 | 5/5 | +281.9 |
| maxBars 48, no BE | 1441 | 100% | **+435.3** | +0.302 | 39% | 28.1 | 7/7 | +230.3 | +205.0 | 5/5 | +398.4 |
| maxBars 48, BE at 1R (+0.12%) | 1586 | 100% | **+338.3** | +0.213 | 35% | 24.9 | 7/7 | +157.2 | +181.1 | 5/5 | +304.6 |
| maxBars 72, no BE | 1268 | 100% | **+443.3** | +0.350 | 37% | 35.8 | 7/7 | +206.4 | +236.8 | 5/5 | +411.9 |
| maxBars 72, BE at 1R (+0.12%) | 1470 | 100% | **+363.4** | +0.247 | 35% | 26.3 | 7/7 | +176.7 | +186.6 | 5/5 | +331.3 |
| maxBars 96, no BE | 1168 | 100% | **+452.5** | +0.387 | 35% | 29.6 | 7/7 | +235.2 | +217.3 | 5/5 | +424.0 |
| maxBars 96, BE at 1R (+0.12%) | 1401 | 100% | **+372.1** | +0.266 | 34% | 24.3 | 7/7 | +182.4 | +189.8 | 5/5 | +337.0 |

## C. Partial profit and trailing the stop (market entry)
partial = sell part at X R and move the rest to break-even; trail = after BE the stop follows the 20-SMA (only in profit direction).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| partial 50% at 1R + BE rest (4R) | 1579 | 100% | **+277.0** | +0.175 | 56% | 17.7 | 6/7 | +125.6 | +151.3 | 5/5 | +242.3 |
| partial 33% at 1R + BE rest (4R) | 1579 | 100% | **+300.2** | +0.190 | 56% | 19.3 | 6/7 | +137.4 | +162.8 | 5/5 | +266.0 |
| partial 50% at 2R + BE rest (4R) | 1465 | 100% | **+347.2** | +0.237 | 43% | 22.9 | 7/7 | +186.9 | +160.3 | 5/5 | +314.5 |
| partial 33% at 2R + BE rest (4R) | 1465 | 100% | **+360.2** | +0.246 | 43% | 22.9 | 7/7 | +193.8 | +166.4 | 5/5 | +326.4 |
| partial 50% at 3R + BE rest (4R) | 1444 | 100% | **+424.0** | +0.294 | 40% | 23.2 | 7/7 | +224.1 | +200.0 | 5/5 | +387.0 |
| BE 1R + trail 20-SMA, target 4R | 1690 | 100% | **+302.7** | +0.179 | 46% | 27.3 | 7/7 | +140.5 | +162.2 | 5/5 | +267.0 |
| BE 1.5R + trail 20-SMA, target 4R | 1567 | 100% | **+345.2** | +0.220 | 45% | 27.1 | 7/7 | +181.6 | +163.6 | 5/5 | +301.0 |
| BE 1R + trail 20-SMA, target 6R | 1645 | 100% | **+289.3** | +0.176 | 45% | 25.6 | 7/7 | +123.5 | +165.8 | 5/5 | +251.6 |
| BE 1R + trail 20-SMA, target 8R | 1625 | 100% | **+300.2** | +0.185 | 45% | 26.2 | 6/7 | +138.6 | +161.6 | 5/5 | +262.1 |
| BE 1R + trail 20-SMA, target 10R | 1617 | 100% | **+319.5** | +0.198 | 45% | 29.1 | 7/7 | +145.0 | +174.5 | 5/5 | +284.6 |
| BE 2R + trail 20-SMA, target 8R | 1432 | 100% | **+358.3** | +0.250 | 42% | 27.7 | 7/7 | +202.2 | +156.1 | 5/5 | +332.3 |
| partial 50% at 2R + trail, target 8R | 1430 | 100% | **+324.8** | +0.227 | 43% | 25.7 | 7/7 | +175.2 | +149.6 | 5/5 | +292.2 |
| partial 50% at 2R + trail, target 6R | 1456 | 100% | **+320.4** | +0.220 | 43% | 25.7 | 7/7 | +170.8 | +149.6 | 5/5 | +288.9 |
| partial 50% at 1R + trail, target 8R | 1616 | 100% | **+237.8** | +0.147 | 56% | 18.9 | 6/7 | +108.3 | +129.4 | 5/5 | +198.4 |

## D. Limit entry — mid: limit at the midpoint of the signal candle (wicks included)
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 1 candle(s), target entry | 1354 | 57% | **+330.0** | +0.244 | 37% | 27.5 | 6/7 | +165.8 | +164.2 | 5/5 | +302.1 |
| mid, wait 1 candle(s), target signal | 1319 | 57% | **+382.0** | +0.290 | 36% | 26.9 | 6/7 | +195.0 | +187.1 | 5/5 | +355.2 |
| mid, wait 2 candle(s), target entry | 1335 | 65% | **+314.4** | +0.236 | 37% | 34.6 | 6/7 | +186.1 | +128.3 | 5/5 | +288.2 |
| mid, wait 2 candle(s), target signal | 1287 | 65% | **+327.2** | +0.254 | 36% | 33.6 | 6/7 | +185.2 | +142.0 | 5/5 | +300.9 |
| mid, wait 3 candle(s), target entry | 1283 | 67% | **+224.7** | +0.175 | 35% | 30.6 | 6/7 | +131.5 | +93.1 | 5/5 | +198.3 |
| mid, wait 3 candle(s), target signal | 1247 | 67% | **+226.7** | +0.182 | 33% | 32.0 | 6/7 | +133.0 | +93.7 | 4/5 | +200.3 |
| mid, wait 6 candle(s), target entry | 1251 | 74% | **+225.6** | +0.180 | 33% | 32.9 | 5/7 | +157.1 | +68.6 | 5/5 | +198.6 |
| mid, wait 6 candle(s), target signal | 1213 | 74% | **+244.2** | +0.201 | 31% | 30.8 | 5/7 | +170.0 | +74.3 | 4/5 | +216.9 |

## D. Limit entry — 25% pullback from the close, % of the candle range
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rr25, wait 1 candle(s), target entry | 1361 | 55% | **+336.7** | +0.247 | 37% | 30.4 | 6/7 | +186.4 | +150.2 | 5/5 | +313.8 |
| rr25, wait 1 candle(s), target signal | 1324 | 55% | **+384.8** | +0.291 | 36% | 31.3 | 7/7 | +221.7 | +163.1 | 5/5 | +361.6 |
| rr25, wait 2 candle(s), target entry | 1326 | 65% | **+296.0** | +0.223 | 36% | 34.0 | 6/7 | +195.2 | +100.8 | 5/5 | +272.0 |
| rr25, wait 2 candle(s), target signal | 1283 | 65% | **+328.8** | +0.256 | 35% | 34.5 | 7/7 | +204.6 | +124.3 | 5/5 | +304.4 |
| rr25, wait 3 candle(s), target entry | 1310 | 68% | **+218.6** | +0.167 | 34% | 31.0 | 7/7 | +164.1 | +54.5 | 5/5 | +194.5 |
| rr25, wait 3 candle(s), target signal | 1258 | 68% | **+248.0** | +0.197 | 32% | 33.0 | 7/7 | +166.5 | +81.5 | 5/5 | +223.7 |
| rr25, wait 6 candle(s), target entry | 1286 | 75% | **+255.1** | +0.198 | 34% | 29.0 | 7/7 | +165.1 | +90.1 | 5/5 | +230.1 |
| rr25, wait 6 candle(s), target signal | 1231 | 75% | **+293.0** | +0.238 | 32% | 30.6 | 7/7 | +190.6 | +102.4 | 5/5 | +267.9 |

## D. Limit entry — 50% pullback from the close, % of the candle range
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rr50, wait 1 candle(s), target entry | 1089 | 28% | **+221.2** | +0.203 | 35% | 35.7 | 6/7 | +105.1 | +116.1 | 5/5 | +200.4 |
| rr50, wait 1 candle(s), target signal | 1035 | 28% | **+315.5** | +0.305 | 34% | 32.9 | 6/7 | +190.3 | +125.2 | 5/5 | +294.6 |
| rr50, wait 2 candle(s), target entry | 1080 | 40% | **+253.2** | +0.234 | 35% | 47.2 | 5/7 | +156.2 | +96.9 | 5/5 | +226.9 |
| rr50, wait 2 candle(s), target signal | 1027 | 40% | **+304.2** | +0.296 | 32% | 42.7 | 6/7 | +206.8 | +97.4 | 5/5 | +277.6 |
| rr50, wait 3 candle(s), target entry | 1069 | 44% | **+131.2** | +0.123 | 31% | 44.3 | 4/7 | +93.5 | +37.7 | 5/5 | +102.9 |
| rr50, wait 3 candle(s), target signal | 1014 | 45% | **+215.7** | +0.213 | 29% | 43.7 | 5/7 | +150.0 | +65.7 | 5/5 | +187.0 |
| rr50, wait 6 candle(s), target entry | 1087 | 55% | **+85.7** | +0.079 | 29% | 59.6 | 6/7 | +77.3 | +8.4 | 4/5 | +50.4 |
| rr50, wait 6 candle(s), target signal | 1030 | 55% | **+141.5** | +0.137 | 26% | 66.1 | 5/7 | +135.7 | +5.8 | 4/5 | +105.9 |

## D. Limit entry — 25% pullback from the close, % of the close→stop distance
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rd25, wait 1 candle(s), target entry | 1195 | 34% | **+280.1** | +0.234 | 32% | 29.1 | 7/7 | +167.3 | +112.8 | 5/5 | +256.3 |
| rd25, wait 1 candle(s), target signal | 1131 | 34% | **+337.7** | +0.299 | 31% | 29.0 | 7/7 | +218.3 | +119.5 | 5/5 | +313.7 |
| rd25, wait 2 candle(s), target entry | 1225 | 50% | **+277.0** | +0.226 | 33% | 35.3 | 7/7 | +175.7 | +101.3 | 5/5 | +252.3 |
| rd25, wait 2 candle(s), target signal | 1172 | 50% | **+301.4** | +0.257 | 31% | 30.2 | 7/7 | +198.0 | +103.5 | 5/5 | +276.4 |
| rd25, wait 3 candle(s), target entry | 1236 | 59% | **+253.0** | +0.205 | 33% | 29.3 | 7/7 | +151.0 | +102.0 | 5/5 | +228.3 |
| rd25, wait 3 candle(s), target signal | 1185 | 59% | **+278.8** | +0.235 | 31% | 28.4 | 5/7 | +180.1 | +98.8 | 5/5 | +253.9 |
| rd25, wait 6 candle(s), target entry | 1248 | 71% | **+269.9** | +0.216 | 33% | 29.3 | 7/7 | +173.4 | +96.5 | 5/5 | +244.7 |
| rd25, wait 6 candle(s), target signal | 1197 | 71% | **+303.2** | +0.253 | 31% | 31.6 | 7/7 | +211.3 | +91.9 | 5/5 | +277.7 |

## D. Limit entry — 50% pullback from the close, % of the close→stop distance
limitBars = how many candles the order waits. tpAnchor entry = target is 4 × (new entry→stop); signal = target stays at the original price (so the win is bigger than 4R).

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rd50, wait 1 candle(s), target entry | 489 | 9% | **+90.9** | +0.186 | 27% | 24.6 | 5/7 | +52.1 | +38.8 | 5/5 | +73.6 |
| rd50, wait 1 candle(s), target signal | 463 | 9% | **+122.3** | +0.264 | 21% | 29.9 | 4/7 | +103.7 | +18.6 | 5/5 | +104.3 |
| rd50, wait 2 candle(s), target entry | 731 | 21% | **+104.6** | +0.143 | 26% | 33.0 | 5/7 | +80.3 | +24.3 | 4/5 | +79.8 |
| rd50, wait 2 candle(s), target signal | 675 | 21% | **+154.9** | +0.229 | 20% | 42.4 | 5/7 | +127.3 | +27.6 | 5/5 | +129.7 |
| rd50, wait 3 candle(s), target entry | 813 | 28% | **+81.9** | +0.101 | 25% | 48.3 | 6/7 | +87.8 | -5.9 | 5/5 | +54.8 |
| rd50, wait 3 candle(s), target signal | 749 | 28% | **+116.6** | +0.156 | 19% | 49.0 | 4/7 | +118.7 | -2.1 | 5/5 | +89.0 |
| rd50, wait 6 candle(s), target entry | 983 | 44% | **+107.7** | +0.110 | 25% | 43.4 | 6/7 | +98.2 | +9.5 | 5/5 | +75.3 |
| rd50, wait 6 candle(s), target signal | 901 | 44% | **+106.1** | +0.118 | 20% | 58.4 | 5/7 | +122.7 | -16.6 | 4/5 | +73.5 |

### D2. Which signals does a limit order miss? (R of the SAME signals traded at market, baseline rules)
| config | signals matched | market R of signals FILLED | limit R of the same trades | market R of signals MISSED | missed (ran away / expired / other) |
|---|---|---|---|---|---|
| mid, wait 1 | 1277 | +71.1 (595) | +158.5 | +317.8 (682) | 8 / 994 / 0 |
| mid, wait 3 | 1239 | +20.3 (782) | +158.7 | +386.7 (457) | 13 / 628 / 0 |
| rr25, wait 1 | 1267 | -2.2 (624) | +96.6 | +392.5 (643) | 8 / 1106 / 0 |
| rr25, wait 3 | 1256 | -23.0 (829) | +142.5 | +424.3 (427) | 11 / 607 / 0 |
| rr50, wait 1 | 1287 | -45.4 (231) | +20.6 | +465.3 (1056) | 9 / 2704 / 24 |
| rr50, wait 3 | 1237 | -134.0 (476) | +19.7 | +542.7 (761) | 15 / 1300 / 27 |
| rd25, wait 1 | 1273 | +1.7 (489) | +98.0 | +374.8 (784) | 7 / 2336 / 0 |
| rd25, wait 3 | 1215 | -39.8 (725) | +134.8 | +433.5 (490) | 11 / 847 / 0 |
| rd50, wait 1 | 1404 | -61.2 (145) | -10.1 | +483.7 (1259) | 11 / 5015 / 0 |
| rd50, wait 3 | 1290 | -186.1 (377) | -14.4 | +570.9 (913) | 14 / 2038 / 0 |

## D3. Fill model sensitivity (mid, wait 2, target entry)
limitBuf 0 = the order fills as soon as price TOUCHES the level (optimistic); 0.05% = price must trade through (default); 0.15% = harsher.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 2, limitBuf 0% | 1341 | 66% | **+342.4** | +0.255 | 37% | 35.6 | 6/7 | +206.0 | +136.5 | 5/5 | +316.1 |
| mid, wait 2, limitBuf 0.05% | 1335 | 65% | **+314.4** | +0.236 | 37% | 34.6 | 6/7 | +186.1 | +128.3 | 5/5 | +288.2 |
| mid, wait 2, limitBuf 0.15% | 1313 | 63% | **+267.6** | +0.204 | 36% | 34.6 | 7/7 | +168.1 | +99.5 | 5/5 | +241.8 |

## D4. Limit entry that falls back to a MARKET entry if not filled
Order rests limitBars candles; if still unfilled it is bought at the next open (stop and target unchanged). Keeps the price improvement on pullbacks without missing the runaway breakouts, but the late market entries are worse than baseline.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 1 then market, target entry | 1456 | 100% | **+343.1** | +0.236 | 38% | 29.2 | 7/7 | +204.1 | +139.0 | 5/5 | +311.6 |
| mid, wait 1 then market, target signal | 1433 | 100% | **+369.6** | +0.258 | 38% | 29.1 | 6/7 | +220.2 | +149.5 | 5/5 | +338.4 |
| mid, wait 2 then market, target entry | 1457 | 99% | **+301.6** | +0.207 | 39% | 31.4 | 6/7 | +192.2 | +109.4 | 5/5 | +270.4 |
| mid, wait 2 then market, target signal | 1428 | 99% | **+342.7** | +0.240 | 38% | 30.8 | 6/7 | +216.5 | +126.3 | 5/5 | +312.9 |
| mid, wait 3 then market, target entry | 1460 | 99% | **+298.8** | +0.205 | 39% | 30.3 | 6/7 | +192.1 | +106.7 | 5/5 | +270.7 |
| mid, wait 3 then market, target signal | 1424 | 99% | **+322.0** | +0.226 | 37% | 29.2 | 6/7 | +213.8 | +108.2 | 5/5 | +292.4 |
| rr25, wait 1 then market, target entry | 1458 | 100% | **+327.3** | +0.224 | 38% | 29.1 | 6/7 | +197.7 | +129.5 | 5/5 | +297.7 |
| rr25, wait 1 then market, target signal | 1432 | 100% | **+366.7** | +0.256 | 38% | 30.3 | 7/7 | +223.5 | +143.2 | 5/5 | +337.1 |
| rr25, wait 2 then market, target entry | 1461 | 99% | **+305.0** | +0.209 | 39% | 31.5 | 6/7 | +205.6 | +99.3 | 5/5 | +277.1 |
| rr25, wait 2 then market, target signal | 1425 | 99% | **+338.5** | +0.238 | 38% | 30.8 | 7/7 | +218.5 | +120.0 | 5/5 | +310.5 |
| rr25, wait 3 then market, target entry | 1464 | 99% | **+294.1** | +0.201 | 39% | 30.5 | 6/7 | +196.5 | +97.6 | 5/5 | +266.7 |
| rr25, wait 3 then market, target signal | 1422 | 99% | **+326.2** | +0.229 | 38% | 27.6 | 7/7 | +214.2 | +112.0 | 5/5 | +298.7 |
| rd25, wait 1 then market, target entry | 1456 | 100% | **+321.6** | +0.221 | 38% | 28.0 | 7/7 | +193.7 | +127.9 | 5/5 | +291.2 |
| rd25, wait 1 then market, target signal | 1430 | 100% | **+377.6** | +0.264 | 38% | 29.8 | 7/7 | +229.8 | +147.8 | 5/5 | +347.1 |
| rd25, wait 2 then market, target entry | 1461 | 99% | **+310.8** | +0.213 | 39% | 30.2 | 7/7 | +203.7 | +107.1 | 5/5 | +282.3 |
| rd25, wait 2 then market, target signal | 1422 | 99% | **+350.2** | +0.246 | 38% | 31.2 | 7/7 | +218.8 | +131.4 | 5/5 | +321.6 |
| rd25, wait 3 then market, target entry | 1465 | 99% | **+309.9** | +0.212 | 39% | 29.2 | 7/7 | +201.7 | +108.1 | 5/5 | +282.3 |
| rd25, wait 3 then market, target signal | 1419 | 99% | **+344.6** | +0.243 | 38% | 28.5 | 6/7 | +224.2 | +120.4 | 5/5 | +316.9 |
| rd50, wait 1 then market, target entry | 1448 | 100% | **+295.2** | +0.204 | 38% | 33.4 | 7/7 | +180.1 | +115.0 | 5/5 | +258.6 |
| rd50, wait 1 then market, target signal | 1427 | 100% | **+325.3** | +0.228 | 38% | 33.4 | 7/7 | +206.9 | +118.3 | 5/5 | +288.8 |
| rd50, wait 2 then market, target entry | 1456 | 99% | **+260.9** | +0.179 | 39% | 33.0 | 7/7 | +173.0 | +87.9 | 5/5 | +225.6 |
| rd50, wait 2 then market, target signal | 1416 | 99% | **+303.7** | +0.214 | 38% | 34.0 | 6/7 | +204.9 | +98.7 | 5/5 | +268.4 |
| rd50, wait 3 then market, target entry | 1461 | 99% | **+245.8** | +0.168 | 39% | 32.3 | 5/7 | +179.3 | +66.6 | 5/5 | +210.8 |
| rd50, wait 3 then market, target signal | 1411 | 99% | **+275.6** | +0.195 | 37% | 35.3 | 6/7 | +204.6 | +70.9 | 5/5 | +240.5 |

## F. Maximise profit without break-even: target size × time exit (market entry)
CAUTION: the 4R target was already chosen after seeing these years; every extra grid cell here adds more in-sample selection. Look for a broad plateau, not the best single cell.

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| target 4R, maxBars 48 | 1441 | 100% | **+435.3** | +0.302 | 39% | 28.1 | 7/7 | +230.3 | +205.0 | 5/5 | +398.4 |
| target 4R, maxBars 72 | 1268 | 100% | **+443.3** | +0.350 | 37% | 35.8 | 7/7 | +206.4 | +236.8 | 5/5 | +411.9 |
| target 4R, maxBars 96 | 1168 | 100% | **+452.5** | +0.387 | 35% | 29.6 | 7/7 | +235.2 | +217.3 | 5/5 | +424.0 |
| target 4R, maxBars 144 | 1000 | 100% | **+421.4** | +0.421 | 35% | 28.1 | 7/7 | +218.1 | +203.3 | 5/5 | +397.7 |
| target 6R, maxBars 48 | 1356 | 100% | **+463.8** | +0.342 | 37% | 26.3 | 6/7 | +238.2 | +225.6 | 5/5 | +426.7 |
| target 6R, maxBars 72 | 1176 | 100% | **+468.6** | +0.398 | 35% | 30.8 | 6/7 | +241.1 | +227.5 | 5/5 | +437.3 |
| target 6R, maxBars 96 | 1069 | 100% | **+476.8** | +0.446 | 33% | 25.7 | 6/7 | +261.0 | +215.8 | 5/5 | +448.5 |
| target 6R, maxBars 144 | 907 | 100% | **+462.6** | +0.510 | 31% | 18.2 | 6/7 | +246.2 | +216.5 | 5/5 | +439.3 |
| target 8R, maxBars 48 | 1317 | 100% | **+489.0** | +0.371 | 37% | 26.1 | 6/7 | +257.0 | +232.0 | 5/5 | +451.5 |
| target 8R, maxBars 72 | 1136 | 100% | **+502.8** | +0.443 | 34% | 34.0 | 6/7 | +258.0 | +244.8 | 5/5 | +471.3 |
| target 8R, maxBars 96 | 1026 | 100% | **+487.8** | +0.475 | 32% | 24.5 | 6/7 | +260.5 | +227.3 | 5/5 | +459.3 |
| target 8R, maxBars 144 | 873 | 100% | **+484.2** | +0.555 | 30% | 32.4 | 6/7 | +245.9 | +238.3 | 5/5 | +460.5 |
| target 10R, maxBars 48 | 1308 | 100% | **+518.5** | +0.396 | 36% | 26.1 | 6/7 | +270.3 | +248.2 | 5/5 | +480.5 |
| target 10R, maxBars 72 | 1117 | 100% | **+511.8** | +0.458 | 34% | 38.7 | 6/7 | +252.2 | +259.7 | 5/5 | +480.0 |
| target 10R, maxBars 96 | 1006 | 100% | **+481.9** | +0.479 | 32% | 31.9 | 6/7 | +252.8 | +229.1 | 5/5 | +453.2 |
| target 10R, maxBars 144 | 842 | 100% | **+484.5** | +0.575 | 29% | 39.8 | 7/7 | +266.9 | +217.6 | 5/5 | +460.9 |
| target 15R, maxBars 48 | 1286 | 100% | **+532.9** | +0.414 | 36% | 26.1 | 7/7 | +295.1 | +237.8 | 5/5 | +494.4 |
| target 15R, maxBars 72 | 1102 | 100% | **+498.0** | +0.452 | 33% | 40.6 | 7/7 | +271.5 | +226.5 | 5/5 | +465.8 |
| target 15R, maxBars 96 | 988 | 100% | **+483.8** | +0.490 | 31% | 34.8 | 7/7 | +292.8 | +190.9 | 5/5 | +454.6 |
| target 15R, maxBars 144 | 811 | 100% | **+518.4** | +0.639 | 29% | 39.9 | 6/7 | +317.9 | +200.5 | 5/5 | +494.7 |
| target 20R, maxBars 48 | 1282 | 100% | **+512.7** | +0.400 | 36% | 26.1 | 6/7 | +270.6 | +242.1 | 5/5 | +474.4 |
| target 20R, maxBars 72 | 1100 | 100% | **+508.3** | +0.462 | 33% | 40.6 | 6/7 | +273.1 | +235.2 | 5/5 | +475.9 |
| target 20R, maxBars 96 | 985 | 100% | **+485.8** | +0.493 | 31% | 34.8 | 6/7 | +288.1 | +197.8 | 5/5 | +456.5 |
| target 20R, maxBars 144 | 812 | 100% | **+530.0** | +0.653 | 28% | 39.9 | 6/7 | +297.1 | +232.9 | 5/5 | +505.5 |

## E. Combinations

| config | trades | fill% | total R | avg R | win% | maxDD R | yrs+ | R ≤2023 | R ≥2024 | coins+ | R @2x costs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mid, wait 1, target signal | 1319 | 57% | **+382.0** | +0.290 | 36% | 26.9 | 6/7 | +195.0 | +187.1 | 5/5 | +355.2 |
| mid, wait 1, target signal + BE 1R | 1422 | 57% | **+312.3** | +0.220 | 39% | 28.1 | 7/7 | +163.3 | +149.0 | 5/5 | +283.8 |
| mid, wait 1, target signal + target 8R | 1230 | 57% | **+406.6** | +0.331 | 35% | 31.9 | 6/7 | +208.8 | +197.8 | 5/5 | +379.1 |
| mid, wait 1, target signal + target 10R, maxBars 96 | 954 | 57% | **+468.4** | +0.491 | 31% | 31.8 | 6/7 | +258.9 | +209.6 | 5/5 | +447.1 |
| mid, wait 1 then market | 1433 | 100% | **+369.6** | +0.258 | 38% | 29.1 | 6/7 | +220.2 | +149.5 | 5/5 | +338.4 |
| mid, wait 1 then market + BE 1R | 1558 | 99% | **+272.6** | +0.175 | 38% | 26.7 | 7/7 | +163.7 | +108.9 | 5/5 | +241.0 |
| mid, wait 1 then market + target 8R | 1313 | 100% | **+402.7** | +0.307 | 36% | 27.9 | 6/7 | +228.2 | +174.5 | 5/5 | +370.9 |
| mid, wait 1 then market + target 10R, maxBars 96 | 1002 | 100% | **+476.5** | +0.476 | 31% | 32.8 | 6/7 | +247.7 | +228.8 | 5/5 | +452.2 |
| market + target 8R | 1317 | 100% | **+489.0** | +0.371 | 37% | 26.1 | 6/7 | +257.0 | +232.0 | 5/5 | +451.5 |
| market + target 10R, maxBars 96 | 1006 | 100% | **+481.9** | +0.479 | 32% | 31.9 | 6/7 | +252.8 | +229.1 | 5/5 | +453.2 |
