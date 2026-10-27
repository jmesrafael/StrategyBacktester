# Audit of the bb-core beaters — BTC+ETH+SOL, $5 risk per trade

bb-core: +242R, DD 27R, 7/7 years

## keltner {n:20,m:2} stop1.5ATR trail5ATR +SMA200

- all: 636 trades, win 30%, **+477R = +2387$**, DD 32R ($160), 7/7 yrs; years: 2020 +124 | 2021 +135 | 2022 +13 | 2023 +102 | 2024 +61 | 2025 +19 | 2026 +21
- BTC: 226 trades, +172R ($+861), DD 17R, 6/7 yrs; +70 +30 +5 +48 +23 -5 +0
- ETH: 206 trades, +169R ($+844), DD 15R, 7/7 yrs; +55 +31 +12 +16 +35 +16 +5
- SOL: 204 trades, +137R ($+683), DD 18R, 5/7 yrs; -0 +75 -4 +38 +3 +8 +16
- 2x all costs: +411R (7/7 yrs); 3x slippage only: +459R (7/7)
- position size: notional = 32x the $ you risk (median); so $5 risk = ~$158 notional, tightest 10% of cases 58x
- look-ahead truncation test: ok
- neighbours (stop/trail ATR): 1.5/4: +346R 7/7 ; 1.5/5: +477R 7/7 ; 1.5/6: +480R 7/7 ; 1.5/7: +479R 7/7 ; 2/4: +276R 7/7 ; 2/5: +368R 7/7 ; 2/6: +374R 7/7 ; 2/7: +373R 6/7 ; 2.5/4: +218R 7/7 ; 2.5/5: +291R 7/7 ; 2.5/6: +295R 7/7 ; 2.5/7: +299R 7/7
- blended with bb-core: +720R, DD 54R, 7/7 yrs

## keltner {n:10,m:1.5} stop1.5ATR trail5ATR

- all: 860 trades, win 29%, **+496R = +2480$**, DD 40R ($200), 7/7 yrs; years: 2020 +119 | 2021 +121 | 2022 +33 | 2023 +102 | 2024 +67 | 2025 +13 | 2026 +39
- BTC: 319 trades, +173R ($+864), DD 16R, 6/7 yrs; +71 +18 +11 +43 +17 -4 +16
- ETH: 294 trades, +154R ($+769), DD 21R, 6/7 yrs; +48 +33 +7 +16 +37 +14 -1
- SOL: 247 trades, +169R ($+847), DD 12R, 6/7 yrs; -0 +71 +15 +43 +13 +4 +25
- 2x all costs: +405R (6/7 yrs); 3x slippage only: +471R (7/7)
- position size: notional = 32x the $ you risk (median); so $5 risk = ~$158 notional, tightest 10% of cases 58x
- look-ahead truncation test: ok
- neighbours (stop/trail ATR): 1.5/4: +351R 7/7 ; 1.5/5: +496R 7/7 ; 1.5/6: +504R 6/7 ; 1.5/7: +470R 6/7 ; 2/4: +267R 7/7 ; 2/5: +375R 7/7 ; 2/6: +383R 6/7 ; 2/7: +380R 6/7 ; 2.5/4: +227R 7/7 ; 2.5/5: +303R 7/7 ; 2.5/6: +319R 6/7 ; 2.5/7: +311R 6/7
- blended with bb-core: +738R, DD 52R, 7/7 yrs

## donchian {n:20} stop1.5ATR trail5ATR +SMA200

- all: 855 trades, win 28%, **+519R = +2596$**, DD 49R ($243), 7/7 yrs; years: 2020 +129 | 2021 +124 | 2022 +35 | 2023 +109 | 2024 +50 | 2025 +17 | 2026 +52
- BTC: 298 trades, +174R ($+868), DD 16R, 5/7 yrs; +68 +23 -0 +51 +20 -6 +15
- ETH: 283 trades, +196R ($+979), DD 19R, 7/7 yrs; +62 +31 +21 +13 +29 +21 +20
- SOL: 274 trades, +150R ($+749), DD 20R, 6/7 yrs; -1 +70 +15 +45 +1 +3 +17
- 2x all costs: +428R (7/7 yrs); 3x slippage only: +494R (7/7)
- position size: notional = 32x the $ you risk (median); so $5 risk = ~$158 notional, tightest 10% of cases 58x
- look-ahead truncation test: ok
- neighbours (stop/trail ATR): 1.5/4: +377R 7/7 ; 1.5/5: +519R 7/7 ; 1.5/6: +525R 6/7 ; 1.5/7: +533R 6/7 ; 2/4: +281R 7/7 ; 2/5: +390R 7/7 ; 2/6: +401R 7/7 ; 2/7: +402R 6/7 ; 2.5/4: +229R 7/7 ; 2.5/5: +299R 7/7 ; 2.5/6: +309R 7/7 ; 2.5/7: +303R 7/7
- blended with bb-core: +761R, DD 61R, 7/7 yrs

## donchian {n:30} stop1.5ATR trail5ATR +SMA200

- all: 740 trades, win 28%, **+484R = +2421$**, DD 39R ($193), 7/7 yrs; years: 2020 +130 | 2021 +129 | 2022 +16 | 2023 +113 | 2024 +43 | 2025 +18 | 2026 +32
- BTC: 264 trades, +163R ($+817), DD 27R, 6/7 yrs; +64 +25 +0 +54 +19 -11 +10
- ETH: 238 trades, +175R ($+876), DD 19R, 7/7 yrs; +65 +31 +7 +14 +33 +22 +4
- SOL: 238 trades, +146R ($+728), DD 14R, 6/7 yrs; +1 +73 +9 +46 -9 +8 +18
- 2x all costs: +406R (7/7 yrs); 3x slippage only: +463R (7/7)
- position size: notional = 32x the $ you risk (median); so $5 risk = ~$158 notional, tightest 10% of cases 58x
- look-ahead truncation test: ok
- neighbours (stop/trail ATR): 1.5/4: +345R 7/7 ; 1.5/5: +484R 7/7 ; 1.5/6: +505R 7/7 ; 1.5/7: +495R 6/7 ; 2/4: +266R 7/7 ; 2/5: +371R 7/7 ; 2/6: +393R 7/7 ; 2/7: +381R 7/7 ; 2.5/4: +214R 7/7 ; 2.5/5: +287R 7/7 ; 2.5/6: +303R 7/7 ; 2.5/7: +301R 7/7
- blended with bb-core: +727R, DD 51R, 7/7 yrs

