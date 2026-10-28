#!/usr/bin/env python3
"""PreToolUse nudge: when Read/Grep targets a report file, remind Claude to use the index (never blocks)."""
import json, os, sys

REPORT_EXT = (".md", ".json", ".jsonl", ".txt", ".log")
SKIP = ("cache-1m", "/data", "datafund", "datatf", "node_modules", "graphify-out", "report-index", "CLAUDE.md", "package")
MSG = ("Report files are indexed. Use `python report-index/rq.py search \"terms\" [--path X]` or "
       "`rq.py show <path> --heading H` instead of reading/grepping whole report files "
       "(catalog: report-index/INDEX.md). Read the raw file only if the index lacks what you need.")


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return
    ti = d.get("tool_input", {})
    tool = d.get("tool_name", "")
    target = (ti.get("file_path") or ti.get("path") or "").replace("\\", "/")
    glob = ti.get("glob") or ""
    hit = False
    if tool == "Read":
        hit = (target.lower().endswith(REPORT_EXT) and not any(s in target for s in SKIP)
               and ("/research/" in target or "/LEDGER/" in target)
               and not ti.get("limit") and os.path.exists(target) and os.path.getsize(target) > 3000)
    elif tool == "Grep":
        scoped = "/research" in target or "/LEDGER" in target or target.rstrip("/").endswith("StrategyBacktester") or not target
        hit = scoped and (any(e in glob for e in ("md", "json", "txt", "log")) or ti.get("type") in ("md", "json"))
    if hit:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": MSG}}))


main()
