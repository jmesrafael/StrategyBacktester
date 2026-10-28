# One month on $251 at 2.5% risk: any month vs a month that starts with straight losses

Generated 2026-10-28 by `node research/portfolio/month.mjs` (trades: `node research/portfolio/dump-trades.mjs`). See README.md for how to read it.

```

A. Every real month 2020-2026, replayed on your $251  (78 months)
  ended up 76% · bad (1 in 20) $208 · typical $287 · good (1 in 20) $484 · worst $185 · best $592
  biggest dip inside the month: typical 11% · 1 in 20 26% · worst 28%

   …only months that STARTED with 3+ straight losses  (14 months)
  ended up 57% · bad (1 in 20) $193 · typical $267 · good (1 in 20) $422 · worst $193 · best $422
  biggest dip inside the month: typical 14% · 1 in 20 28% · worst 28%

   …only months that STARTED with 5+ straight losses  (10 months)
  ended up 60% · bad (1 in 20) $193 · typical $285 · good (1 in 20) $422 · worst $193 · best $422
  biggest dip inside the month: typical 14% · 1 in 20 28% · worst 28%

   …only months that STARTED with 7+ straight losses  (9 months)
  ended up 56% · bad (1 in 20) $193 · typical $273 · good (1 in 20) $372 · worst $193 · best $372
  biggest dip inside the month: typical 14% · 1 in 20 28% · worst 28%

B. Forced bad start: first 3 trades all losses, rest of a real month  (20000 months)
  ended up 64% · bad (1 in 20) $203 · typical $273 · good (1 in 20) $428 · worst $182 · best $549
  biggest dip inside the month: typical 12% · 1 in 20 26% · worst 33%

B. Forced bad start: first 5 trades all losses, rest of a real month  (20000 months)
  ended up 60% · bad (1 in 20) $198 · typical $263 · good (1 in 20) $395 · worst $178 · best $470
  biggest dip inside the month: typical 13% · 1 in 20 26% · worst 35%

B. Forced bad start: first 8 trades all losses, rest of a real month  (20000 months)
  ended up 44% · bad (1 in 20) $187 · typical $243 · good (1 in 20) $354 · worst $171 · best $430
  biggest dip inside the month: typical 16% · 1 in 20 27% · worst 39%

C. Real months 2023-2026 only (weaker years)  (45 months)
  ended up 73% · bad (1 in 20) $208 · typical $285 · good (1 in 20) $484 · worst $193 · best $592
  biggest dip inside the month: typical 13% · 1 in 20 26% · worst 28%

trades per month: median 30 (both bots) · cost of straight losses from $251 at 2.5%: 3 → -18, 5 → -30, 8 → -46
```
