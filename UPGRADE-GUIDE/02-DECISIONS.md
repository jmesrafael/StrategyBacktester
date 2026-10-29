# The 6 decisions only you can make

Answer these before anything is deployed. Each has my recommendation and why; the numbers come from `StrategyBacktester/research/bb-core/no-target/RESULTS.md`. Reply with e.g. "D1 yes, D2 B, D3 500, D4 Saturday 04:00 PH window, D5 A, D6 leave".

---

## D1. Make the strategy change and start a new measurement window?

Removing the 1:4 target changes how BB-Core trades. On Oct 26 you set a rule: do not change risk or coins before Feb 2027, or the live sample restarts. This change restarts it.

| | |
|---|---|
| **For** | Expectancy +0.33R to +0.45R per trade; better on all 7 coins never used in the design (+0.16R to +0.32R); best tandem with I-Core (+0.51R to +0.60R); stays ahead at 3x costs |
| **Against** | On your 5 coins alone it is ahead in only 19 of 34 coin-years; without its 10 best trades it equals 1:4; it is lumpier (35% of profit from 10 trades) |

**Recommendation: yes.** The evidence points the right way and the downside is a lumpier version of a strategy that is already working. Accept that the live record starts again: **the new measurement window starts on the deploy date**, and the judging numbers become: average +0.35R, win rate about 36%, about 18 trades a month, worst drop about 23R.

## D2. Switch on the risk steps (2.5% / 2.0% / 1.5%) in which bot?

| Option | BB-Core | I-Core |
|---|---|---|
| **A** | steps on | steps on (jumps to 2.5% if it is below that today) |
| **B (my recommendation)** | steps on | keep today's risk for the first month, then decide |
| **C** | keep today's flat risk | keep today's flat risk |

Why B: BB-Core is at 2.5% on the VPS according to the Oct 26 docs (I confirm the real value in Phase 2), so the steps only change what happens as it grows. I-Core is a different animal: it has the highest expectancy but 74% of its profit comes from 10 trades, and its worst backtest drop is 30R. At 2.5% that is roughly a 50% drawdown on the sub-account; at 0.5% it is about 14%. I read I-Core's real current setting in Phase 2 and show it to you before you choose.

**Important, built into the procedure:** the new code switches the steps on by itself if the server's config does not say otherwise. So Phase 3 pins `riskTiers: []` first, and the upgrade changes nothing about risk until Phase 7.

## D3. The per-trade dollar cap

Today the cap is $10 per trade. The cap only starts to bite once an account passes about $400 (at 2.5%) and then it silently shrinks your risk.

| Option | Effect |
|---|---|
| Keep $10 | Safest; compounding stops around $400 per bot |
| **$500 (my recommendation)** | The highest value the setting accepts. With the steps on it bites only past about $33,000 per bot (1.5% of that is $500; about ₱1.9M at ₱58 per dollar), which is also roughly where fills on GALA and ZEC stop matching the backtest |
| 0 = no cap | Positions grow without limit with the account; past about ₱1-5M the backtest numbers are not realistic |

Recommendation: **$500**. It also protects against a wrong balance reading from MEXC, which a percentage rule alone would obey.

## D4. When

The upgrade can run **with trades open**. The only constraint is the 4-hour candle clock (see `06-COMMANDS.md`): start 30 to 90 minutes after a close, so you are at least 2.5 hours from the next one. Then Phases 5 and 6 each wait for one full candle close.

- Pick a window where **you can look at the MEXC app** twice: before and after.
- Do **not** do Phase 7 (new risk) on the same day as the restart. One clean 4h cycle first; the next day is better.

My suggestion: BB-Core in one window, I-Core in the next window (4 hours later or next day), the risk switch the day after.

## D5. How I get to the VPS

Option A (I run it with an SSH key you add) or B (you paste the commands). Details in `01-WHO-DOES-WHAT.md`. Recommendation: **A** for reading and checking, and you decide per restart whether I run it or you do.

## D6. The parts that are NOT in this upgrade

Leave these as they are unless you say otherwise:

- **Supabase fee migration 10% to 20%** (`20261114000000_fee_20`): needs investor notice and a terms version. Separate decision. Recommendation: **leave**.
- **Supabase profile migrations** (steps 14-16): re-run the check file when convenient. Recommendation: **leave** for now.
- **I-Core dashboard push** and **data collectors** (`PENDING-UPGRADE.md` rows 5 and 6): I will only *check* the collectors in Phase 2, not change them.
- **Coins**, **mode (paper/live)**, **MEXC keys**: untouched.
