# BB-Core vs I-Core: expectancy, edge robustness, best split, one-year odds on $250

Generated 2026-10-28 by `node research/portfolio/stats.mjs` (trades: `node research/portfolio/dump-trades.mjs`). See README.md for how to read it.

```

== BB-Core: n=1510, 229/yr, win 38.8%, avg win 2.34R, avg loss -0.95R
  expectancy 0.327R  sd 1.86R  t=6.8  bootstrap 95% [0.264, 0.404]  P(E<=0)=0.00%
  without best 5/10/20/40 trades: 0.314 / 0.302 / 0.277 / 0.226 R  | best trade 4.1R  | R/yr 75
  2020-22 avg 0.411R (n=552)  2023-26 avg 0.278R (n=958)  median trade -1.00R

== I-Core: n=760, 115/yr, win 31.8%, avg win 4.75R, avg loss -0.95R
  expectancy 0.866R  sd 6.92R  t=3.4  bootstrap 95% [0.507, 1.491]  P(E<=0)=0.00%
  without best 5/10/20/40 trades: 0.425 / 0.231 / 0.040 / -0.143 R  | best trade 128.2R  | R/yr 100
  2020-22 avg 0.924R (n=272)  2023-26 avg 0.833R (n=488)  median trade -1.02R

== monthly R: BB mean 6.17 sd 9.91 (ratio 0.62) | IC mean 8.23 sd 22.82 (ratio 0.36) | correlation 0.18
  best-ratio BB share: as tested 84% | IC edge halved 95% | IC without its 10 best trades (monthly mean 2.17) 101%

== 1 year from $250.39, I-Core as tested
risk | BB/IC | bad year (5th pct) | median end | P(year down) | median worst drop | 95th pct worst drop | P(drop>20%)
0.5% | 100/0 | $293 | $366 | 0.0% | 6% | 11% | 0%
0.5% | 80/20 | $304 | $374 | 0.0% | 5% | 8% | 0%
0.5% | 70/30 | $305 | $375 | 0.0% | 5% | 8% | 0%
0.5% | 50/50 | $302 | $378 | 0.0% | 4% | 7% | 0%
1.0% | 100/0 | $337 | $523 | 0.0% | 12% | 21% | 7%
1.0% | 80/20 | $365 | $547 | 0.0% | 10% | 16% | 1%
1.0% | 70/30 | $365 | $548 | 0.0% | 9% | 15% | 0%
1.0% | 50/50 | $356 | $548 | 0.0% | 8% | 14% | 0%
2.5% | 100/0 | $462 | $1362 | 0.1% | 29% | 46% | 92%
2.5% | 80/20 | $572 | $1537 | 0.0% | 23% | 37% | 72%
2.5% | 70/30 | $573 | $1537 | 0.0% | 22% | 35% | 64%
2.5% | 50/50 | $548 | $1486 | 0.0% | 21% | 33% | 55%

== 1 year from $250.39, I-Core WITHOUT its 10 best trades (big winners do not repeat)
risk | BB/IC | bad year (5th pct) | median end | P(year down) | median worst drop | 95th pct worst drop | P(drop>20%)
0.5% | 100/0 | $293 | $366 | 0.0% | 6% | 11% | 0%
0.5% | 80/20 | $290 | $353 | 0.0% | 5% | 9% | 0%
0.5% | 70/30 | $287 | $347 | 0.0% | 5% | 8% | 0%
0.5% | 50/50 | $276 | $333 | 0.0% | 4% | 7% | 0%
1.0% | 100/0 | $337 | $523 | 0.0% | 12% | 21% | 7%
1.0% | 80/20 | $333 | $492 | 0.0% | 10% | 17% | 2%
1.0% | 70/30 | $326 | $477 | 0.0% | 10% | 16% | 1%
1.0% | 50/50 | $306 | $442 | 0.0% | 8% | 14% | 0%
2.5% | 100/0 | $462 | $1362 | 0.1% | 29% | 46% | 92%
2.5% | 80/20 | $463 | $1213 | 0.0% | 25% | 39% | 81%
2.5% | 70/30 | $445 | $1163 | 0.0% | 23% | 37% | 73%
2.5% | 50/50 | $405 | $1025 | 0.0% | 21% | 34% | 59%
```
