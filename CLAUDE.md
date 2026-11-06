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

## Pending: T-CORE paper lab (formerly BB-Trail, bot tag bbtr; built Nov 6, 2026, VPS install not done yet)

- If the owner asks to install T-CORE / the trail bot, continue the T-CORE install or "do the handoff", read `bb-trail/T-CORE-INSTALL-WHEN-HOME.md` and follow it (step 0 checks whether it is already on the VPS). Paper only; confirm the VPS install with the owner. The dashboard side is already pushed and live (ledger commit 12046bd).
- Going live later: `bb-trail/LIVE-READINESS-TCORE.md` (plan and gates only).
- Names: TRI-CORE = BB-CORE + I-CORE + T-CORE (50/25/25). Report: `../ledger/reports/live-pair-vs-three-bot.html`.
