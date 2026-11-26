# make_folders.py: builds strategies/<NN-name>/SUMMARY.md for each strategy tested in this hunt and copies its result files there.
# Numbers are copied from the result files listed in each folder (validate.txt, hold-*.txt, compare3.md, ...).
import os, shutil
os.chdir(os.path.dirname(os.path.abspath(__file__)))
S = 'strategies'
os.makedirs(S, exist_ok=True)
HEAD = '| Test | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Max DD | Result |\n|---|---|---|---|---|---|---|---|---|---|---|\n'


def peso(c, f, avg, wy, wf, wm, tpm, wr):
    return ('| Compounding Jan 2020 to Nov 2026 | Worst fall | Average year (fresh 1,000 each Jan) | Worst year | Worst fall inside a year | Worst month | Trades / month | Win rate |\n'
            '|---|---|---|---|---|---|---|---|\n'
            f'| {c} | {f} | {avg} | {wy} | {wf} | {wm} | {tpm} | {wr} |')


def w(folder, title, status, rules, rows, peso_txt, verdict, files, notes=''):
    d = os.path.join(S, folder)
    os.makedirs(d, exist_ok=True)
    t = f'# {title}\n\n**Status:** {status}\n\n## Rules\n{rules}\n'
    if rows:
        t += '\n## R per year (1R = the stop distance; 1x = real costs)\n' + HEAD
        for r in rows:
            t += '| ' + ' | '.join(str(x) for x in r) + ' |\n'
    if peso_txt:
        t += '\n## PHP 1,000 (live coins SOL NEAR ADA GALA ZEC ARB, live risk steps 2.5% / 2% / 1.5%)\n' + peso_txt + '\n'
    t += f'\n## Verdict\n{verdict}\n'
    if notes:
        t += f'\n## Notes\n{notes}\n'
    t += '\n## Files in this folder\n' + '\n'.join(f'- `{f}`' for f in files)
    t += '\n\nThese are copies. The scripts are two folders up (`../../`) and share `lib.js`; re-running one rewrites its output there.\n'
    open(os.path.join(d, 'SUMMARY.md'), 'w', encoding='utf-8').write(t)
    for f in files:
        if os.path.exists(f):
            shutil.copy2(f, d)


w('01-BB-1H-WIDE', 'BB-1H-WIDE (1h, Bollinger 80 / 2.6 sigma)',
  'LEAD, best overall. Paper-test next to `bb1h`; judge on candles after 2026-11-25.',
  '- 1h close above the upper Bollinger band (80, **2.6 sigma**) and above SMA(800): long. Mirror for shorts.\n'
  '- Decide on the closed bar, fill at the next open.\n'
  '- Stop = middle band at entry, fixed. Skip the trade if the stop is closer than 0.3 ATR(14).\n'
  '- Exit at the stop or after 192 bars (8 days).',
  [['Main 12, 1x', 89, 324, 184, 172, 116, 126, 145, 1157, 67, 'PASS 7/7'],
   ['Main 12, 3x costs', 70, 304, 157, 118, 84, 97, 107, 936, 75, 'PASS 7/7'],
   ['Hold-out 12, 1x', 68, 164, 59, 48, 117, 6, 30, 492, 81, 'PASS 7/7'],
   ['Hold-out 12, 2x', 59, 153, 46, 25, 101, -7, 10, 386, 87, 'FAIL 6/7'],
   ['All 24, 3x costs', 119, 447, 189, 120, 169, 76, 97, 1218, 163, 'PASS 7/7']],
  peso('4.4M', '-27%', '+416%', '+75% (2020, from March)', '-42%', '-28%', 16, '39%'),
  '- The only candidate positive every year on coins it never saw (hold-out) and on 24 coins at 3x costs.\n'
  '- Smallest drawdowns of the Bollinger versions. Earns less than BB-CORE 1h.\n'
  '- Same signals as BB-CORE 1h (86% trade overlap, monthly correlation 0.96): run one, not both.',
  ['validate.txt', 'hold-vol.txt', 'months.md', 'pesos.md', 'compare3.md', 'REPORT.md'],
  '- Look-ahead audit: 0 mismatches in 960 checks.\n'
  '- Plateau: bands 60-120 long, 2.2-2.6 sigma, SMA 800, 192-bar exit are all 7/7 on both baskets.\n'
  '- Weak spot: hold-out 2025 was only +6R. Profit per trade fell from 0.31R (2020-23) to 0.19R (2024-26).\n'
  '- Best coins (7/7 each, hindsight): SOL VET ADA ZEC LINK XTZ. Avoid TRX ATOM LTC AAVE.')

w('02-BB-CORE-1h', 'BB-CORE 1h (1h, Bollinger 80 / 2.0 sigma, the `bb1h` paper bot)',
  'PAPER (`bb1h`). Highest returns, fails the hold-out test.',
  '- Same as BB-1H-WIDE but with 2.0 sigma bands: 1h close outside Bollinger(80, 2.0) with SMA(800).\n'
  '- Stop = middle band, 192-bar time exit.',
  [['Main 12, 1x', 163, 391, 240, 170, 201, 169, 260, 1594, 89, 'PASS 7/7'],
   ['Main 12, 3x costs', 132, 358, 195, 86, 150, 121, 193, 1235, 119, 'PASS 7/7'],
   ['Hold-out 12, 1x', 97, 164, 146, 34, 142, -44, 51, 590, 100, 'FAIL 6/7'],
   ['Hold-out 12, 2x', 83, 147, 125, -3, 115, -69, 20, 419, 124, 'FAIL 5/7'],
   ['All 24, 3x costs', 202, 488, 299, 47, 239, 28, 182, 1485, 219, 'PASS 7/7']],
  peso('33.9M', '-39%', '+646%', '+147%', '-58% (2023)', '-38%', 22, '36%'),
  '- Most money of all: best year in 5 of 7 and the biggest compounding result.\n'
  '- Bigger falls than BB-1H-WIDE, and it lost 2025 on unseen coins: the edge depends more on which coins it trades.',
  ['months-core1h.md', 'compare3.md', 'validate.txt'])

w('03-BB-CORE-4h-live', 'BB-CORE 4h (the live bot)', 'LIVE (`bbcore`). Reference for comparison.',
  '- 4h close outside Bollinger(20, 2.0) with SMA(200). Stop = middle band (skip if < 0.3 ATR), 48-candle time exit.',
  [],
  peso('4.9M', '-38%', '+433%', '+105%', '-56% (2026)', '-48% (Oct 2026)', 19, '37%'),
  '- Middle on return and the worst on risk of the three Bollinger bots here: deepest single month (-48%).\n'
  '- The 1h versions beat it in most years (BB-CORE 1h in 6 of 7, BB-1H-WIDE in 5).\n'
  '- Earlier study: +594R, 7/7 years on 4h (`research/strat-hunt-nov6/REPORT.md`). Not tested on the hold-out coins in this study.',
  ['compare3.md'])

w('04-BB-CORE-1h-hold32d', 'BB-CORE 1h with a 32-day hold (bb-hybrid BBX192)',
  'INFO. Robust on the hold-out coins, but weaker than BB-1H-WIDE.',
  '- BB-CORE 1h entry (80 / 2.0 sigma, SMA 800), middle-band stop, time exit after 768 bars (32 days) instead of 192.',
  [['Main 12, 1x', 124, 617, 121, 60, 393, 145, 214, 1676, 163, 'PASS 7/7'],
   ['Main 12, 2x', '', '', '', '', '', '', '', '', '', 'PASS 7/7 (worst +39)'],
   ['Hold-out 12, 1x', '', '', '', '', '', '', '', '', '', 'PASS 7/7 (worst +4, 12/12 coins)'],
   ['Hold-out 12, 2x', '', '', '', '', '', '', '', '', '', 'FAIL 6/7 (worst -9)']],
  '', '- Passes the hold-out test like BB-1H-WIDE, but return/drawdown is much lower (10.3 vs 17.4) and the drawdown is 2.4x bigger (163R vs 67R).',
  ['strict-baseline.txt', 'baseline.txt'])

w('05-BB-20ATR-trail', 'Bollinger 80 / 2.6 sigma + 20 ATR trailing stop', 'REJECTED (fails hold-out).',
  '- BB-1H-WIDE entry and middle-band first stop, then a 20 x ATR(14) trailing stop, no time exit.',
  [['Main 12, 1x', 114, 663, 153, 172, 246, 393, 123, 1863, 78, 'PASS 7/7'],
   ['Main 12, 2x', 107, 655, 144, 151, 233, 379, 108, '', '', 'PASS 7/7'],
   ['Hold-out 12, 1x', 31, 225, 51, 43, 312, -28, -34, 599, 113, 'FAIL 5/7']],
  '', '- Best main-coin numbers of the whole hunt (in-sample leader), but it loses 2025 and 2026 on unseen coins. Profit comes from a few huge trend trades; longs carry it.',
  ['fam-vol-results.txt', 'hold-vol.txt'])

w('06-MACD-trend', 'MACD x8 signal cross + SMA 1200 (trend-family leader)', 'REJECTED (fails hold-out).',
  '- MACD(96, 208, 72) line crosses its signal line, only with the SMA(1200) trend. 4 x ATR initial stop, exit on the opposite cross.',
  [['Main 12, 1x', 107, 312, 160, 150, 76, 101, 74, 980, 67, 'PASS 7/7'],
   ['Hold-out 12, 1x', 105, 193, 116, 66, 132, -23, -34, 555, 125, 'FAIL 5/7'],
   ['Hold-out 12, 2x', 99, 184, 104, 47, 117, -39, -58, 455, 148, 'FAIL 5/7']],
  '', '- All 12 neighbour settings were 7/7 on the main coins, yet each tested one loses 2025-26 on unseen coins. Monthly correlation with BB-1H-WIDE 0.68.',
  ['fam-trend-results.txt', 'hold-trend.txt'])

w('07-Keltner-EMA-trend', 'Keltner breakout and EMA 50/200 cross (trend family)', 'REJECTED (fail hold-out).',
  '- Keltner(50 or 200, 3.5 x ATR) close breakout, 3-4 x ATR stop with an 18-22 x ATR trail.\n'
  '- EMA 50/200 cross with efficiency ratio > 0.2, 4 x ATR stop, 22 x ATR trail.',
  [['Keltner 50, main 1x', 232, 712, 38, 353, 324, 150, 138, 1946, 129, 'PASS 7/7'],
   ['Keltner 50, hold-out 1x', 9, 142, -25, 171, 396, -131, 43, 604, 233, 'FAIL 5/7'],
   ['Keltner 200, hold-out 1x', -19, 241, 40, 103, 336, -112, -58, 530, 231, 'FAIL 4/7'],
   ['EMA, main 1x', 63, 484, 77, 172, 182, 123, 45, 1147, 84, 'PASS 7/7'],
   ['EMA, hold-out 1x', 18, 90, -9, 45, 223, -139, 3, 231, 200, 'FAIL 5/7']],
  '', '- Big main-coin profits driven by 2021 and the alt runs; large losses in 2025 on unseen coins.',
  ['fam-trend-results.txt', 'hold-trend.txt'])

w('08-baseline-27-strategies', 'Baseline: 27 strat-hunt strategies scaled to 1h', 'INFO.',
  '- The 27 indicator strategies from `research/strat-hunt-nov6` (RSI, StochRSI, CCI, AO, Elder, Fisher, KST, Heikin-Ashi, EMA ribbon, Ichimoku, VWAP, OBV, Donchian, fractal, BB variants, mean reversion), periods x4 and ATR multiples x2 for 1h.',
  [], '',
  '- 40 of 55 variants are 7/7 on the 12 main coins: "every year positive" alone is easy in 2020-26.\n'
  '- On the hold-out coins only one stays 7/7 (BB-CORE 1h with a 32-day hold, folder 04).\n'
  '- Mean reversion (z-score, RSI(2), BB fade) loses in almost every year.',
  ['baseline.txt', 'strict-baseline.txt'])
print('ok')
