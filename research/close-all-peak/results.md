# Close-all-when-open-profit-is-big (account level, 4h closes)

Rule: if total open R across the bot >= N at a 4h close, close every open trade there. N=none is the bot as it runs now.

## T-CORE (SOL ZEC NEAR ADA GALA ETH SUI ARB), 1150 trades

| Close-all trigger | Total R | vs now | Worst drop R | Total ÷ drop | Without best 10 | Times it fired | Years better than now (of 7) |
|---|---|---|---|---|---|---|---|
| never (current) | +1105.0 | — | 30.9 | 35.7 | +391.3 | — | — |
| ≥ +20R open | +454.6 | -650.4 | 29.7 | 15.3 | +289.9 | 43 | 2 |
| ≥ +15R open | +409.2 | -695.8 | 22.7 | 18.1 | +287.3 | 56 | 2 |
| ≥ +12R open | +318.9 | -786.1 | 22.5 | 14.2 | +210.9 | 63 | 1 |
| ≥ +10R open | +352.4 | -752.5 | 21.4 | 16.4 | +254.4 | 76 | 2 |
| ≥ +8R open | +349.2 | -755.8 | 26.6 | 13.1 | +256.2 | 93 | 2 |
| ≥ +6R open | +319.7 | -785.3 | 26.7 | 12.0 | +219.6 | 111 | 2 |
| ≥ +4R open | +256.7 | -848.3 | 26.7 | 9.6 | +164.3 | 148 | 2 |

## BB-CORE (SOL ZEC NEAR ADA GALA ARB), 1708 trades

| Close-all trigger | Total R | vs now | Worst drop R | Total ÷ drop | Without best 10 | Times it fired | Years better than now (of 7) |
|---|---|---|---|---|---|---|---|
| never (current) | +707.5 | — | 27.0 | 26.2 | +496.4 | — | — |
| ≥ +20R open | +699.0 | -8.5 | 27.9 | 25.1 | +542.9 | 32 | 5 |
| ≥ +15R open | +606.0 | -101.5 | 27.9 | 21.7 | +490.8 | 46 | 2 |
| ≥ +12R open | +579.5 | -128.0 | 26.1 | 22.2 | +471.8 | 69 | 3 |
| ≥ +10R open | +513.1 | -194.4 | 28.9 | 17.7 | +415.3 | 91 | 2 |
| ≥ +8R open | +452.9 | -254.6 | 34.3 | 13.2 | +364.1 | 111 | 1 |
| ≥ +6R open | +407.2 | -300.3 | 44.4 | 9.2 | +331.6 | 154 | 1 |
| ≥ +4R open | +338.9 | -368.6 | 35.1 | 9.6 | +273.5 | 206 | 1 |

## I-CORE (SOL ZEC NEAR ADA GALA), 816 trades

| Close-all trigger | Total R | vs now | Worst drop R | Total ÷ drop | Without best 10 | Times it fired | Years better than now (of 7) |
|---|---|---|---|---|---|---|---|
| never (current) | +806.1 | — | 27.6 | 29.2 | +251.9 | — | — |
| ≥ +20R open | +447.9 | -358.1 | 27.6 | 16.2 | +276.5 | 29 | 2 |
| ≥ +15R open | +484.2 | -321.9 | 27.6 | 17.6 | +343.4 | 51 | 2 |
| ≥ +12R open | +381.4 | -424.7 | 27.6 | 13.8 | +267.2 | 59 | 2 |
| ≥ +10R open | +347.3 | -458.7 | 27.6 | 12.6 | +244.3 | 69 | 2 |
| ≥ +8R open | +297.0 | -509.0 | 20.4 | 14.5 | +205.5 | 79 | 1 |
| ≥ +6R open | +268.5 | -537.6 | 19.7 | 13.6 | +190.4 | 97 | 2 |
| ≥ +4R open | +239.5 | -566.5 | 17.4 | 13.8 | +168.1 | 126 | 0 |


## Live check (Supabase wallet_snapshots + closed_trades, Nov 24 2026)

| | Peak Nov 21 06:00 UTC | Now Nov 24 ~09:00 UTC |
|---|---|---|
| Total equity (3 bots) | 869.7 | 752.6 (includes 15.6 deposited Nov 21 16:45) |
| Open profit (unrealized) | +268.2 | +94.7 |
| Open positions | 18 (BB 6, I 4, T 8) | 11 (BB 1, I 3, T 7) |

Closed since the peak: 8 trades, +55.5 USDT realized. Net equity change since the peak, deposits removed: about -133 USDT. Closing everything at the peak would have locked about +268 (less roughly 3-5 USDT exit fees) and the later bounce would not have touched it. That is hindsight: the peak is only known afterwards.
