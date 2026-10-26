# SOL / ZEC / ADA — BB Breakout, fixed $5 risk vs 5% compounding, targets 1:3 / 1:4 / 1:5

Same engine as rr4.js (close signal -> next-open fill, stop = mid band, 0.04% commission + 0.02% slippage, no funding). Fixed = $5/trade on a flat $1000 notional (no compounding). Compounding = 5% of CURRENT equity risked per trade, starting at $1000, trades taken in time order. Max DD for fixed is in $ off peak closed-trade equity; for compounding it's % off peak equity.

| Coin | Target | Trades | Fixed $5: Total $ | Fixed $5: Max DD $ | Fixed $5: Avg R | Compounding 5%: End equity | Compounding 5%: Multiple | Compounding 5%: Max DD % |
|---|---|---|---|---|---|---|---|---|
| SOL | 1:3 | 327 | +$447 | -$61 | +0.27R | $30984 | 30.98x | 49.1% |
| SOL | 1:4 | 310 | +$565 | -$59 | +0.36R | $79520 | 79.52x | 48.4% |
| SOL | 1:5 | 299 | +$568 | -$56 | +0.38R | $71259 | 71.26x | 47.6% |
| ZEC | 1:3 | 358 | +$495 | -$73 | +0.28R | $42612 | 42.61x | 55.1% |
| ZEC | 1:4 | 333 | +$610 | -$77 | +0.37R | $106716 | 106.72x | 54.8% |
| ZEC | 1:5 | 323 | +$581 | -$77 | +0.36R | $66976 | 66.98x | 54.8% |
| ADA | 1:3 | 349 | +$496 | -$68 | +0.28R | $46171 | 46.17x | 51.3% |
| ADA | 1:4 | 328 | +$560 | -$62 | +0.34R | $70147 | 70.15x | 48.7% |
| ADA | 1:5 | 318 | +$535 | -$65 | +0.34R | $47853 | 47.85x | 48.9% |

## Best target per coin
- **SOL** — fixed $5: best is 1:5 (+$568); 5% compounding: best is 1:4 (79.52x, 48.4% max DD)
- **ZEC** — fixed $5: best is 1:4 (+$610); 5% compounding: best is 1:4 (106.72x, 54.8% max DD)
- **ADA** — fixed $5: best is 1:4 (+$560); 5% compounding: best is 1:4 (70.15x, 48.7% max DD)
