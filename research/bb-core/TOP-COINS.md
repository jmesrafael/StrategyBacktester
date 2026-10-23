# Top coins for BB Breakout (4h, 1:4)

Source: [docs/COIN-REGISTRY-bb-breakout.md](docs/COIN-REGISTRY-bb-breakout.md) plus this folder's own run (Binance to 21 Oct 2026, real fees + funding, $5 risk).
Choosing coins after seeing results is in-sample, so treat the ranking as "best so far", not a promise.

## Tier 1 — the traded set (realistic run done, 7/7 positive years, liquid)

| # | Coin | Avg R | Net (all years) | Max DD | Years + | Why |
|---|---|---|---|---|---|---|
| 1 | **ZEC** | +0.36 | +$592 | −$78 | 7/7 | Never used for tuning, so the cleanest evidence. Weak year: 2023 (+$4). |
| 2 | **SOL** | +0.34 | +$527 | −$64 | 7/7 | Core coin. Best year 2023 (+$165). |
| 3 | **ADA** | +0.33 | +$533 | −$63 | 7/7 | $186M/day volume, 7 years of history. Weak year: 2026 (+$9). |
| 4 | **NEAR** | +0.26 | +$390 | −$55 | 7/7 | Added 2026-10-21. Double costs still positive. |

These four together: all 4 are positive in every year, and their monthly results are only weakly correlated, which is what keeps the drawdown low.

## Tier 2 — use with caution

| Coin | Avg R | Years + | Note |
|---|---|---|---|
| BTC | +0.17 | 5/8 | Weakest edge, most cost-sensitive. Lost 2021 and 2025 (560 days to recover). Diversifier only, smaller size. |
| GALA | +0.36 | 6/6 | Strongest edge, but only 5 years of data and ~$13M/day volume. Runner-up pick. |
| ZIL | +0.25 | 7/7 | Survives 3× costs, but only ~$5M/day, so fills are not trustworthy. |

## Tier 3 — good numbers, still to run with funding (screen only)

DOT (+0.25, 6/7) · XLM (+0.18, 7/7) · AVAX (+0.25, 5/7) · LINK (+0.17, 6/7) · ONE (+0.31, 5/6, since 2021) · SAND (+0.30, 5/6) · ENA / SUI / INJ (short history).

## Do not trade

- **Too illiquid (under ~$30M/day):** GRT, VET, RUNE, ENJ, MANA, 1INCH, ALGO, EGLD, DYDX and others. The backtest fills are not believable.
- **Faded after 2023:** ETH (+0.05), XRP (+0.08), DOGE (+0.07).
- **Loses or flat:** ATOM, APT, ONDO, FIL, LTC, BCH, ETC, XMR, DASH, CRV, THETA.

## Portfolios (registry, realistic, 2020 → Oct 2026)

| Set | Net | Max DD |
|---|---|---|
| SOL + ZEC + NEAR + ADA | +$2,044 | $91 |
| + ZIL | +$2,464 | $130 |
| + BTC | +$2,356 | $119 |
| SOL + ZEC + BTC + NEAR + ADA (this folder's engine) | +$2,348 | $119 |

**Bottom line:** ZEC, SOL, ADA and NEAR are the top four; BTC is the only extra that is liquid enough, and it is the weakest.
