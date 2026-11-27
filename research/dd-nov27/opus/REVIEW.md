# Independent review of Family B rule S8 (Opus, Nov 27 2026)

S8 = new order x0.5 when same-side open trades across BB-CORE + I-CORE + T-CORE > 8. Live US$600, cap US$500, engine `causalO.js`
(= `../causalB.js` with only require paths changed and an option `heatNoPend`). Harness: `review.js`, `placebo.js`, `flat85.js`, results `out-*.json`.

## 1. Reproduction (own harness, rules 1-4 recomputed)
| run | end US$ (% base) | fall | fresh-2024 CAGR / fall | 2x cost end / fall | 12m smaller fall | R1-R4 |
|---|---|---|---|---|---|---|
| BASE | 782,730 | 43.7 | 396.8 / 49.1 | 714,731 / 44.2 | - | - |
| S8 (bots bb,ic,tc) | 692,294 (88.4%) | 40.0 | 378.9 / 36.7 | 632,687 / 41.4 | 71/71 | pass all |
| S8 bots tc,ic,bb | 683,385 (87.3%) | 40.0 | 364.5 / 36.5 | 626,742 / 41.4 | 71/71 | pass all |
| S8 coins reversed | 694,039 (88.7%) | 40.0 | 372.2 / 37.1 | 633,283 / 41.4 | 71/71 | pass all |
| S8 no same-close orders | 725,217 (92.7%) | 40.2 | 388.0 / 36.9 | 661,392 / 42.0 | 71/71 | pass all |
| COMBO S8 + fall throttle (>=15% below peak x0.75) | 624,564 (79.8%) | 38.3 | 307.8 / 34.6 | 517,982 / 39.3 | 71/71 | FAIL R1, R2 |

S8 numbers reproduce exactly. 1,611 of 3,789 trades (42%) are halved: S8 is not a rare brake, it binds often.

## 2. Look-ahead / ordering
No look-ahead found: heat uses positions already filled, original stops, and orders decided at the same close (known at that moment).
Ordering does matter for *which* bot gets halved (same count, 1,611, in all 6 bot orders), not for the fall: all 6 orders give fall 40.03%,
end 676,182-699,523 (86.4-89.4% of base; all clear the 85% line, the worst by 1.4 pts). Removing same-close orders entirely
(`heatNoPend`, order-independent) is *better*: 92.7% of base, fall 40.2%. So the effect is not an artefact of bot order.

## 3. Is it more than a smaller size? (controls, not tuning)
- Flat x0.85 on every trade: end 693,680 (same as S8), full fall **39.2%** (better than S8's 40.0), but fresh-2024 CAGR 336.3% (84.8%, fails R2) and fall 43.8% vs S8 36.7%.
- Random x0.5 on 42.5% of trades (20 seeds): median end 618,642, median fall 38.4%.
- 71 twelve-month windows vs flat x0.85: S8 smaller fall in 64, higher return in 56, both in 51 (windows overlap; about 6 independent years).
Reading: on the full 2020-2026 worst fall S8 is no better than a blind 15% size cut; its edge is in 2024+ and in most 12-month windows.
R4 (71/71) is not discriminating: any size cut passes it. Rule 5 in shuf.js froze S8's multipliers, so it only tests "smaller average size".

## 4. Live implementation
The bots are three processes, separate MEXC sub-accounts and Linux users; they share only `/var/lib/lucidio-wallets/wallets.json`
(root timer, every 5 min, equity only). S8 needs each wallet's open-position count by side (long/short, excluding trades already
exiting) added to that export, read at entry with the same staleness fallback as shared sizing (missing/stale -> x1 or x0.5, decide
before). The 5-min lag means other bots' same-close orders are not seen: that is the `heatNoPend` variant, which also passes 1-4.

## Verdict
A weak but real lead, not noise and not proof: shadow-test S8 in its implementable form (heatNoPend) as log-only (record "would halve")
for months before any size change. The S8 + fall-throttle combination fails rules 1 and 2: drop it.
