# Reverse engineering: "3M peso trend system" OKX screenshot (Nov 19 2026)

Source: someone else's screenshot of 30 OKX positions, matched against the local candle library (binance-futures 1h).
Scripts: scratchpad find.js / f2.js / f3.js / f4.js (throwaway).

## Facts
- All 30 positions are SHORT. 29 are in profit; TRX is the only loss (-57% ROE).
- The small grey number under the entry price is the mark price. It matches Nov 18 2026 ~12:00 UTC with 0.002% average error over 11 coins.
- ROE / leverage = price move, so the ROE figures carry no extra information. The 3x positions (PUMP, ONDO, ENA, ASTER) match exactly; the 50-100x ones are 2-5% lower, which fits fees and funding.
- No single moment fits all entries (best fit 1.2% error), so entries are staggered per coin.
- Entries sit 1-4% above the prior 20-day low and 8-40% below the Sep/Oct highs. They sell breakdowns, not tops.
- Breakout test (first 1h low below the prior N-day low after Oct 1; median error between entry and break level):
  - N=10: 10.5%
  - N=20: 4.3%
  - **N=30: 2.7%** (best)
  - N=55: 7.4%
- With N=30 the fills land Oct 15-24 for most coins. BCH fills Nov 7 and TRX in mid-Nov.
- Entries are mostly 1-4% above the 30-day-low level. That fits a stop-entry with slippage, an average price built from adds, or a slightly different band (ATR or close-based).
- The SMA50/SMA200 filter was not bearish on most coins at entry, so there is no long-term trend filter.

## Most likely logic
Per-coin Donchian-style breakdown, about 30 days, on a fixed universe of about 30 liquid OKX perps. Short only in this snapshot, all cross margin, sized by volatility (not equal notional). No take-profit; exit by trailing channel or stop. TRX is the newest and still underwater.

## Not determinable from the image
Size, liquidation price and realized PnL are masked. The exit rule cannot be seen: no closed trades are shown.
