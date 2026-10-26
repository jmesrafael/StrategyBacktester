# Coin registry — BB Breakout 4h, 1:4 (every coin already checked; do not re-run)

Frozen rules: 4h close beyond Bollinger(20,2) with the 200 SMA, stop at the middle band, 1:4 target, 48-bar time exit.
Binance USDT-M futures klines to 20 Oct 2026. Screen costs: 0.04% commission + 0.02% slippage, no funding (`newcoins.js`); realistic run (`near-deep.js`) adds real fees and funding.
Columns: **avgR** = average R per trade, **yrs+** = positive calendar years, **2023→** = avgR from 2023 on, **DD** = max drawdown in R, **$M/d** = Binance 90-day average daily volume.
Liquidity rule: under ~$30M/day the backtest fills are not trustworthy (wicks and slippage), so those are marked ⚠ even when the numbers look great.
All coin choices after seeing results are in-sample; only SOL/ZEC/BTC have a realistic funding run (plus NEAR now).

## A. Traded / approved set (realistic run with fees + funding done)
| Coin | avgR (realistic) | 2023→ | Years | DD | Note |
|---|---|---|---|---|---|
| SOL | +0.35 | +0.32 | 7/7 | $64 (12.8R) | core |
| ZEC | +0.36 | +0.31 | 7/7 | $78 (15.6R) | core |
| BTC | +0.17 | +0.17 | 6/8 | $85 (17R) | weak: lost 2021, 2025 |
| **NEAR** | **+0.26** | **+0.21** | **7/7** | **$55 (11R)** | added 2026-10-21; double costs still +$357 over 6 yrs; 15% hit 4R; losing streak 7 |

SOL+ZEC+BTC+NEAR together (realistic, $5 risk): 1,305 trades, +$1,826, max DD $99 (19.9R); 2023→ +$991. Without NEAR: +$1,436, DD $93 (18.5R), 2023→ +$786.

## B. Strong candidates still to run with funding (next)
| Coin | avgR | 2023→ | Years | DD | $M/d | Note |
|---|---|---|---|---|---|---|
| **ADA** | +0.34 | +0.25 | **7/7** | 12.5R | 186 | best untested-in-depth find; 7 years of history |
| DOT | +0.25 | +0.21 | 6/7 | 11.7R | 57 | lost 2020 only |
| XLM | +0.18 | +0.20 | 7/7 | 10.4R | 66 | low but steady, 7 years |
| AVAX | +0.25 | +0.19 | 5/7 | 11.6R | 132 | 2020, 2026 ≈ flat |
| LINK | +0.17 | +0.13 | 6/7 | 13.1R | 159 | ok |
| ONE | +0.31 | +0.29 | 5/6 | 13.4R | 52 | only since 2021 |
| SAND | +0.30 | +0.18 | 5/6 | 19.9R | 57 | 2026 −12R, losing streak 18 |
| ENA / SUI / INJ | +0.21 / +0.19 / +0.17 | +0.21 / +0.19 / +0.21 | 3/3, 3/4, 3/5 | ~10–15R | 256 / 269 / 61 | short history (2–4 yrs) |

## C. Great numbers but too illiquid ⚠ (do not trade)
GRT (+0.35, $6M/d), ZIL (+0.27, 7/7, $6M/d), VET (+0.27, $9M/d), RUNE (+0.22, 7/7, $7M/d), ENJ (+0.22, $5M/d), MANA (+0.22, $7M/d), 1INCH (+0.21, $2M/d), ALGO (+0.21, $17M/d), EGLD (+0.20, $8M/d), DYDX (+0.20, $5M/d), AXS, ZRX, CHZ.

## D. Middling — positive but thin or faded (low priority)
OP (+0.20, 3/5, $37M), 1000SHIB (+0.19, 5/6), WIF (+0.18, 2/3), ICP (+0.18, 4/5), WLD (+0.17), ARB (+0.16), SEI (+0.15), HBAR (+0.11, 2021 −15R), UNI (+0.13), 1000PEPE (+0.12), AAVE (+0.12), TIA (+0.10), FET (+0.10), HYPE (+0.10, 16 months only), TRX (+0.10, 2022 −15R), BNB (+0.10), TAO (+0.04), NEO (+0.11), YFI (+0.11), XTZ (+0.09).
Faded after 2023 (good before, weak now): ETH (2023→ +0.05), XRP (+0.08), DOGE (+0.07), EGLD (+0.05), AXS (+0.04).

## E. Rejected — loses or flat (try other strategies)
ATOM (−0.01), APT (−0.02), ONDO (−0.02), FIL (2023→ −0.02), LTC (+0.04; 2023→ −0.10), BCH (+0.03; 2023→ −0.05), ETC (2023→ −0.14), XMR (−0.15, 1 of 7 years), DASH (+0.06, DD 40R), CRV (+0.03, DD 39R), SUSHI, SNX, COMP, BAT, IOTA, KAVA, BAND, EOS (delisted May 2025), THETA (+0.05).
Not evaluable: TON (near-zero Binance volume).

## Files
- Data: `data4h/<COIN>.json` (all of the above), `datafund/NEAR.json`, `datafund/SOL|ZEC|BTC|DOGE.json`
- Scripts: `fetch4h-new.js <COINS>`, `near-deep.js <COINS>` (realistic run), scratchpad `newcoins.js` (screen)
- Companion log: `coins-not-for-bb-breakout.md`

---
# Round 3 (2026-10-21) — hunt for a 5th coin, 7/7 positive years and better than BTC

Realistic run (fees + funding, `cand.js`), $5 risk, frozen rules, 1:4. BTC for comparison: +0.17R, 5/7 years, DD 17R, 3x costs +$125.

| Coin | avgR | 2023→ | Years+ | DD | 2x costs | 3x costs | Verdict |
|---|---|---|---|---|---|---|---|
| **ZIL** | **+0.25** | +0.22 | **7/7** | $88 (17.7R) | +$373, 7/7 | **+$325, 7/7** | **Pick for 5th coin** — but Binance 24h volume only ~$5M |
| GALA | +0.36 | +0.33 | 6/6 (starts Sep 2021) | $54 (10.9R) | +$405, 6/6 | +$375, 6/6 | Strongest edge, but only 5 yrs of data and ~$13M/day; runner-up |
| RUNE | +0.21 | +0.20 | 6/7 (2020 −$11) | $86 (17.2R) | 6/7 | 6/7 | Misses 7/7, losing streak 15 |
| XLM | +0.16 | +0.18 | 7/7 | $55 (11R) | 6/7 | 5/7 | Not better than BTC; fails under 2x costs |

5-coin portfolios (realistic, 2020→Oct 2026): SOL+ZEC+NEAR+ADA +$2,044 DD $91 · **+ZIL +$2,464 DD $130** · +BTC +$2,356 DD $119.

## Screened this round (frozen rules, no funding) — do not re-run
Good but no better than above: MATIC/POL (stitched: +0.31R, 2020 partial −3, POL only $21M/d), FTM (+0.36R but 4/6 years, 2025 flat, ~0 volume), SUPER (+0.24R, 3 yrs), IMX, FLOW, STX (+0.20R, 4/4, 3 yrs), OMG (delisted-ish), REEF, APE, CAKE, MKR, DENT, ZEN, HOT.
Middling/weak: RSR, LRC, KSM (6/7, +0.14R), 1000XEC, RENDER, LQTY, JASMY, TRB, QTUM, GMT, ICX, 1000LUNC, ANKR, AR, WAVES, ALPHA, ENS, KNC, CELR, OCEAN, GLM, SKL, ONT, BLZ, S, BAKE.
Rejected (flat/negative): API3, BNX, C98, RLC, PEOPLE, STORJ, MASK, LPT, PERP, NKN, MTL, LDO, OGN, AGLD, XVS.
Not enough data / delisted: LUNA, HNT, TOMO, AUDIO, DODO, CVC, CTK, LIT, SXP (invalid symbol), RNDR (renamed RENDER).
Result: no liquid coin (>$30M/day) with 7/7 years and edge above BTC exists in this universe other than ADA, SOL, ZEC, NEAR (already taken); ZIL is the only extra 7/7 + survives 3x costs, with a thin book.

## Round 3b — ZIL vs GALA vs BTC over the SAME window (20 Sep 2021 → Oct 2026), `cmp5y.js`
GALA +0.36R, +$435, DD $54 (10.9R), 6/6 years, 3x costs +$375 (6/6), monthly corr with 4-coin set 0.20 · ZIL +0.21R, +$286, DD $88 (17.7R), 5/6 years (2021 Sep–Dec −$20), 3x costs +$202 (5/6), corr 0.35 · BTC +0.17R, +$220, DD $85, 4/6 at 3x costs, corr 0.36.
Added to SOL+ZEC+NEAR+ADA: +ZIL +$1,627 DD $130 · +GALA +$1,776 DD $128 · +BTC +$1,561 DD $119 · 4 coins only +$1,341 DD $91 · +ZIL+GALA +$2,062 DD $185. ZIL's "7/7" relies on 2020–21 (before this window). GALA is the better candidate on the common window.

---
# Round 4 (2026-10-26) — hunt for an old (6–7 yr) alt that behaves like SOL/ZEC/NEAR/ADA

Screen only (frozen rules, 0.04% + 0.02% slip, no funding), Binance USDT-M 4h to 26 Oct 2026. Candidates = Binance 2020–21 listings not in any list above. Reference: SOL/ZEC/ADA/NEAR screen at +0.26 to +0.36R.
Only 5 of them have ≥ 6 years of data: IOST (Feb 2020), DEFI (Aug 2020), BAL (Sep 2020), FLM (Sep 2020), BEL (Nov 2020).

| Coin | Start | avgR | 2023→ | Years+ | DD | $M/d | Verdict |
|---|---|---|---|---|---|---|---|
| IOST | 2020-02 | +0.13 | +0.07 | 6/7 | 26R, streak 19 | 46 | Only true 7-yr coin; edge too thin, 2023→ fading |
| DEFI | 2020-08 | +0.16 | +0.14 | 6/6 | 8.2R | ~0 | Clean curve but no volume — not tradable |
| BAL | 2020-09 | +0.11 | +0.10 | 5/6 | 23R | ~0 | 2023 −16R, no volume |
| FLM / BEL | 2020 | +0.03 / +0.06 | −0.03 / 0.00 | 3/6, 4/7 | 26R / 28R | ~0 / 2 | Reject |
| GTC | 2021-06 | +0.19 | +0.20 | 5/6 | 15.7R | 36 | Best of the batch but only 5 yrs; below GALA |
| CELO | 2021-09 | +0.16 | +0.15 | 4/6 | 11.6R | 3 | Illiquid |
| DGB, FXS, ARPA, TLM, DUSK, XEM, STMX, TRU, CHR, LINA, ATA, CTSI, BNT, ACH, NMR, COTI | 2021–23 | +0.00 to +0.15 | — | mostly ≤ 4/6 | — | — | Thin / inconsistent |
| RVN, UNFI, IOTX, ALICE, SFP | 2021 | +0.02 to −0.10 | — | 1–3/6 | up to 64R | — | Rejected (SFP worst, DD 64R) |
| RAY | 2021-08 | +0.32 | — | 1/2 | — | 0 | Delisted-ish, 51 trades |

Result: nothing here is a 5th coin. None reaches the four's edge (+0.26 to +0.36R); the 7-year ones (IOST) are weak and the clean ones (DEFI, GTC) are illiquid or short. Data in `data4h/`.

## Round 4b (2026-10-26) — realistic run (fees + funding) on the liquid Tier 3 coins, `cand.js`, $5 risk
| Coin | avgR | 2023→ | Years+ | DD | 2x costs | 3x costs | $M/d | Verdict |
|---|---|---|---|---|---|---|---|---|
| ADA (ref) | +0.32 | +0.23 | 7/7 | 12.7R | 6/7 | 6/7 | 186 | already in set |
| **XLM** | +0.16 | +0.18 | **7/7** | 11.0R | +$219, 6/7 | +$167, 5/7 | 66 | Only new 7/7; edge half of the four |
| DOT | +0.23 | +0.18 | 6/7 | 13.0R | +$299, 6/7 | +$256, 6/7 | 57 | Loses 2020 only (−$40, listed Aug 2020); best edge of the new ones |
| AVAX | +0.23 | +0.18 | 5/7 | 11.8R | 5/7 | 4/7 | 132 | 2020 and 2026 negative |
| LINK | +0.15 | +0.12 | 6/7 | 14.8R | 6/7 | 4/7 | 159 | Loses 2021; weak |
Funding is a small drag on all (−$21 to −$34). No new coin matches the four on both edge and 7/7.

## Round 4c (2026-10-26) — GALA vs DOT vs XLM, same window (20 Sep 2021 → Oct 2026), `cmp-gala-dot-xlm.js`
Alone: GALA +0.36R, +$435, DD 10.9R, 6/6 yrs, 3x costs 6/6, corr 0.20 · DOT +0.27R, +$342, DD 11.6R, 6/6, 3x 6/6, corr 0.42 · XLM +0.13R, +$167, 4/6 at 2x/3x costs, corr 0.44.
Added to SOL+ZEC+NEAR+ADA (+$1,341, DD $91): +GALA +$1,776 DD $128 · +DOT +$1,684 DD $135 · +XLM +$1,509 DD $114 · +GALA+DOT +$2,118 DD $159.
Note: GALA is not yet in the traded set (still the runner-up, ~$13M/day). DOT's only losing year is 2020 (partial, listed Aug 2020) and is outside this window.
