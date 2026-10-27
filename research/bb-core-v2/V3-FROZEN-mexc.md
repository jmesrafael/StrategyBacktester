# bb-core vs up to 2 positions per coin — mexc candles, $5 per position

"bb-core ×2 risk" = the same bb-core trades with every trade sized double (R and drawdown exactly double): the honest benchmark, since two positions risk about twice as much.

| coin | | trades | total R | total $ | win rate | max drawdown | return ÷ drawdown | most open | R ≤2023 | R ≥2024 | yrs+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SOL | bb-core | 308 | **+104.5R** | **+$523** | 38.6% | 10.8R | 9.7 | 1 | +76.7 | +27.8 | 7/7 |
|  | bb-core ×2 risk | 308 | **+209.1R** | **+$1,045** | 38.6% | 21.5R | 9.7 | (1 at 2× size) | +153.4 | +55.7 | 7/7 |
|  | **2 positions** | 541 | **+197.5R** | **+$987** | 40.7% | 18.4R | 10.7 | 2 | +143.9 | +53.5 | 6/7 |
| ZEC | bb-core | 301 | **+84.6R** | **+$423** | 38.2% | 17.2R | 4.9 | 1 | +30.0 | +54.5 | 5/7 |
|  | bb-core ×2 risk | 301 | **+169.2R** | **+$846** | 38.2% | 34.5R | 4.9 | (1 at 2× size) | +60.1 | +109.1 | 5/7 |
|  | **2 positions** | 532 | **+154.0R** | **+$770** | 38.5% | 30.5R | 5.1 | 2 | +67.1 | +86.9 | 6/7 |
| NEAR | bb-core | 296 | **+74.1R** | **+$370** | 38.5% | 10.9R | 6.8 | 1 | +37.0 | +37.1 | 7/7 |
|  | bb-core ×2 risk | 296 | **+148.2R** | **+$741** | 38.5% | 21.8R | 6.8 | (1 at 2× size) | +74.0 | +74.2 | 7/7 |
|  | **2 positions** | 520 | **+127.1R** | **+$635** | 39.4% | 19.5R | 6.5 | 2 | +66.7 | +60.4 | 6/7 |
| ADA | bb-core | 295 | **+86.5R** | **+$433** | 36.9% | 12.7R | 6.8 | 1 | +52.6 | +33.9 | 7/7 |
|  | bb-core ×2 risk | 295 | **+173.1R** | **+$865** | 36.9% | 25.4R | 6.8 | (1 at 2× size) | +105.3 | +67.8 | 7/7 |
|  | **2 positions** | 535 | **+129.7R** | **+$648** | 36.8% | 22.2R | 5.8 | 2 | +81.3 | +48.3 | 7/7 |
| GALA | bb-core | 241 | **+85.6R** | **+$428** | 41.1% | 9.9R | 8.7 | 1 | +34.0 | +51.6 | 6/6 |
|  | bb-core ×2 risk | 241 | **+171.1R** | **+$856** | 41.1% | 19.7R | 8.7 | (1 at 2× size) | +68.0 | +103.2 | 6/6 |
|  | **2 positions** | 424 | **+150.9R** | **+$755** | 42.2% | 18.9R | 8.0 | 2 | +64.2 | +86.7 | 6/6 |
| **ALL 5** | bb-core | 1441 | **+435.3R** | **+$2,177** | 38.6% | 28.1R | 15.5 | 5 | +230.3 | +205.0 | 7/7 |
|  | bb-core ×2 risk | 1441 | **+870.6R** | **+$4,353** | 38.6% | 56.3R | 15.5 | (1 at 2× size) | +460.7 | +410.0 | 7/7 |
|  | **2 positions** | 2552 | **+759.1R** | **+$3,795** | 39.4% | 47.8R | 15.9 | 10 | +423.3 | +335.8 | 6/7 |

## Verdict per coin

| coin | extra R vs bb-core | extra R vs ×2 risk | drawdown vs ×2 risk | efficiency (R per 100 position-candles) | beats bb-core? | beats ×2 risk? |
|---|---|---|---|---|---|---|
| SOL | +92.9R | -11.6R | -3.1R | 1.31 → 1.36 | yes | NO |
| ZEC | +69.4R | -15.2R | -4.0R | 1.11 → 1.10 | yes | NO |
| NEAR | +53.0R | -21.1R | -2.3R | 0.93 → 0.87 | yes | NO |
| ADA | +43.1R | -43.4R | -3.2R | 1.07 → 0.87 | yes | NO |
| GALA | +65.4R | -20.2R | -0.8R | 1.26 → 1.23 | yes | NO |
| ALL | +323.8R | -111.5R | -8.5R | 1.13 → 1.08 | yes | NO |

More total R than bb-core on 5 of 5 coins; more than bb-core at double risk on 0 of 5 coins.

## All 5 coins, return per year, R (bb-core → bb-core ×2 → 2 positions)

| | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | total |
|---|---|---|---|---|---|---|---|---|
| R | +2.4 → +4.8 → -2.7 | +101.3 → +202.6 → +179.7 | +66.8 → +133.6 → +121.9 | +59.8 → +119.6 → +124.3 | +77.8 → +155.7 → +140.5 | +78.1 → +156.2 → +104.9 | +49.1 → +98.1 → +90.5 | **+435.3 → +870.6 → +759.1** |
