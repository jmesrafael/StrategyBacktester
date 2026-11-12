## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Report data lookup (use this before opening report files)

Result/report files (md, txt, json, log under `research/`, `LEDGER/`) are indexed in `report-index/`.
Do NOT grep or read whole report files. Query the index instead:

- `python report-index/rq.py search "SOL break-even stop" [-n 8] [--path bb-core-v2] [--chars 700] [--full]`
- `python report-index/rq.py list [path-substring]`
- `python report-index/rq.py show <path> [--heading "A. Break-even"] [--chars 4000]`
- `report-index/INDEX.md` is a one-line-per-file catalog (path, title, date).
- After new reports are generated or edited, run `python report-index/rq.py update` (incremental, <1s).
Raw candle caches (cache-1m, data*, funding) are intentionally not indexed.

## Tested strategies registry (check before testing anything)

- `research/TESTED-STRATEGIES.md` lists every strategy already tested, with its verdict, key numbers, evidence files and lessons. Search it before starting a study; do not re-test what is there. Add a row after every study. It also holds the standard test checklist.

## Local candle library (use before downloading candles)

- `candles/` holds 1m + 1h + 4h candles and funding (Binance USDT-M perps, closed bars only, from each coin's listing) for SOL ADA NEAR GALA ZEC BTC ETH BNB XRP DOGE AVAX LINK DOT SUI.
- Load with `require('<rel>/candles/candles.js').load('SOL','1h')` ('1m' / '4h' too). Refresh with `node candles/update.js` (incremental). Add coins to `candles/coins.json`. Do not write new fetch scripts.
- `candles/binance-futures/1m/*.json` are hard links to `research/orb-universe/data/<COIN>-1m.json` (same data); write them in place, never rename over them.
- Known bad windows (Binance 1m vs 1h disagree, e.g. 2024-10-28 20:00-22:00 UTC all coins): see `candles/README.md`.

## Live coins (Nov 12, 2026: DONE on the VPS, do not redo)

- BB-CORE and I-CORE: SOL, ZEC, NEAR, ADA, GALA. T-CORE: SOL, ZEC, NEAR, ADA, GALA, ETH, SUI. ZEC is back (MEXC cancelled its delisting). ETH and SUI are T-CORE only.
- ARB is on the allowlists but OFF: it fails the owner's stability rule (research/zec-replacement/sui-arb-check.js). Record: `archive-done/DONE-SUI-ARB-LIVE.md`. A coin is added only if it makes that bot steadier (stability over luck): `research/zec-replacement/stability.js`, `candidates-report.js`.

## T-CORE paper lab (formerly BB-Trail, bot tag bbtr; built Nov 6, 2026, INSTALLED on the VPS Nov 6, 2026, service bbtrail)

- Already installed and connected to the dashboard; do not reinstall. Check with `sudo bash /opt/bbtrail/deploy-trail/status.sh [report|compare]`. Plan record: `archive-done/DONE-T-CORE-INSTALL-WHEN-HOME.md`. Paper only.
- Going live later: `bb-trail/LIVE-READINESS-TCORE.md` (plan and gates only).
- Names: TRI-CORE = BB-CORE + I-CORE + T-CORE (50/25/25). Report: `../ledger/reports/live-pair-vs-three-bot.html`.
