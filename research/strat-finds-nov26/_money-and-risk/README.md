# Max drawdown, profit factor, Sharpe, Sortino, trade counts, yearly PHP 1,000 accounts

- money-scaled.md: the main tables (per-trade risk scaled to the same total as 6 coins).
- money-fullrisk.md: full risk on every coin (much larger drawdowns).
- money.js builds both. Run from research/hunt-money-nov26/: `node money.js` (full risk) or `SCALE6=1 node money.js` (scaled).
