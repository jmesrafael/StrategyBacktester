#!/usr/bin/env python3
"""Report index for StrategyBacktester: full-text search over report files (md/txt/json/log).

  python report-index/rq.py update              # (re)index changed files, rewrite INDEX.md
  python report-index/rq.py search "SOL BE stop" [-n 8] [--path bb-core-v2] [--chars 700]
  python report-index/rq.py list [path-substring]
  python report-index/rq.py show <path> [--heading text] [--chars 4000]

Stdlib only. Raw candle/data caches are skipped; only result/report files are indexed.
"""
import argparse, json, os, re, sqlite3, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB = os.path.join(HERE, "reports.db")
INDEX_MD = os.path.join(HERE, "INDEX.md")

SKIP_DIRS = {"node_modules", "graphify-out", "report-index", ".git", ".claude", "supabase", "css", "icons", "js",
             "cache-1m", "data4h", "datafund", "datatf", "data", "data-other-coins", "funding", "db", "scripts", "strategies"}
EXTS = {".md", ".txt", ".json", ".jsonl", ".log"}
MAX_JSON = 3_000_000   # bytes; bigger json files are shape-summarised only
CHUNK = 2500           # target chars per chunk


def iter_files():
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            ext = os.path.splitext(fn)[1].lower()
            if ext not in EXTS or fn in ("package.json", "package-lock.json", "manifest.webmanifest", "CLAUDE.md"):
                continue
            full = os.path.join(dp, fn)
            yield os.path.relpath(full, ROOT).replace("\\", "/"), full


def read(full):
    with open(full, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def split_long(heading, text):
    """Split an oversized section on line boundaries, repeating the table header rows."""
    if len(text) <= CHUNK:
        return [(heading, text)]
    lines, out, cur, size = text.split("\n"), [], [], 0
    hdr = [l for l in lines[:12] if l.startswith("|")][:2]
    for l in lines:
        if size + len(l) > CHUNK and cur:
            out.append((heading, "\n".join(cur)))
            cur, size = (list(hdr) if l.startswith("|") else []), 0
        cur.append(l)
        size += len(l) + 1
    if cur:
        out.append((heading, "\n".join(cur)))
    return out


def chunk_md(text, fallback_title):
    chunks, head, buf = [], fallback_title, []
    for l in text.split("\n"):
        if re.match(r"^#{1,4} ", l):
            if buf:
                chunks += split_long(head, "\n".join(buf).strip())
            head, buf = l.lstrip("# ").strip(), []
        else:
            buf.append(l)
    if buf:
        chunks += split_long(head, "\n".join(buf).strip())
    return [(h, b) for h, b in chunks if b.strip()]


def flatten(o, path="", out=None, depth=0):
    out = [] if out is None else out
    if isinstance(o, dict):
        for k, v in o.items():
            flatten(v, f"{path}.{k}" if path else str(k), out, depth + 1)
    elif isinstance(o, list):
        if o and all(isinstance(x, (dict, list)) for x in o) and len(o) > 12:
            out.append(f"{path}: [{len(o)} items] sample keys: {list(o[0].keys())[:15] if isinstance(o[0], dict) else ''}")
            for i, x in enumerate(o[:2]):
                flatten(x, f"{path}[{i}]", out, depth + 1)
        elif o and all(not isinstance(x, (dict, list)) for x in o) and len(o) > 20:
            out.append(f"{path}: [{len(o)} values] first: {o[:5]}")
        else:
            for i, x in enumerate(o):
                flatten(x, f"{path}[{i}]", out, depth + 1)
    else:
        v = round(o, 4) if isinstance(o, float) else o
        out.append(f"{path}: {v}")
    return out


def chunk_json(rel, full, size):
    if rel.endswith(".jsonl") or size > MAX_JSON:
        with open(full, "r", encoding="utf-8", errors="replace") as f:
            first = [f.readline().strip()[:500] for _ in range(3)]
        n = sum(1 for _ in open(full, "rb"))
        return os.path.basename(rel), [("shape", f"{n} lines, size {size} bytes. First lines:\n" + "\n".join(first))]
    try:
        data = json.loads(read(full))
    except Exception:
        return os.path.basename(rel), chunk_md(read(full)[:200000], os.path.basename(rel))
    lines = flatten(data)
    chunks, cur, sz, head = [], [], 0, None
    for l in lines:
        top = l.split(".")[0].split("[")[0].split(":")[0]
        if (sz + len(l) > CHUNK and cur) or (top != head and sz > 800):
            chunks.append((head, "\n".join(cur)))
            cur, sz = [], 0
        head = top if (not cur or head is None) else head
        cur.append(l)
        sz += len(l) + 1
    if cur:
        chunks.append((head, "\n".join(cur)))
    return os.path.basename(rel), chunks


def title_of(rel, text):
    for l in text.split("\n")[:15]:
        if l.startswith("#"):
            return l.lstrip("# ").strip()[:150]
    for l in text.split("\n"):
        if l.strip():
            return l.strip()[:150]
    return os.path.basename(rel)


def connect():
    db = sqlite3.connect(DB)
    db.execute("create table if not exists files(path text primary key, mtime real, size int, title text, nchunks int)")
    db.execute("create virtual table if not exists chunks using fts5(path unindexed, heading, body, tokenize=\"unicode61 tokenchars '_.%+'\")")
    return db


def update(quiet=False):
    db = connect()
    seen, changed = set(), 0
    for rel, full in iter_files():
        seen.add(rel)
        st = os.stat(full)
        row = db.execute("select mtime,size from files where path=?", (rel,)).fetchone()
        if row and row[0] == st.st_mtime and row[1] == st.st_size:
            continue
        changed += 1
        ext = os.path.splitext(rel)[1].lower()
        if ext in (".json", ".jsonl"):
            title, chunks = chunk_json(rel, full, st.st_size)
            title = title if title else rel
        else:
            text = read(full)
            title = title_of(rel, text)
            chunks = chunk_md(text, title) if ext == ".md" else [(title, b) for _, b in split_long(title, text[:300000])]
        db.execute("delete from chunks where path=?", (rel,))
        db.executemany("insert into chunks(path,heading,body) values(?,?,?)", [(rel, h, b) for h, b in chunks])
        db.execute("insert or replace into files values(?,?,?,?,?)", (rel, st.st_mtime, st.st_size, title, len(chunks)))
    for (p,) in db.execute("select path from files").fetchall():
        if p not in seen:
            db.execute("delete from files where path=?", (p,))
            db.execute("delete from chunks where path=?", (p,))
    db.commit()
    write_index(db)
    n = db.execute("select count(*) from files").fetchone()[0]
    if not quiet:
        print(f"indexed {n} files ({changed} new/changed). INDEX.md rewritten.")


def write_index(db):
    rows = db.execute("select path,title,mtime from files order by path").fetchall()
    out = ["# Report index (auto-generated by rq.py — do not edit)", "",
           "Search instead of reading: `python report-index/rq.py search \"terms\"`. Paths below are relative to StrategyBacktester/.", ""]
    cur = None
    for p, t, m in rows:
        d = os.path.dirname(p) or "."
        if d != cur:
            out += ["", f"## {d}"]
            cur = d
        out.append(f"- {os.path.basename(p)} — {t} ({time.strftime('%Y-%m-%d', time.localtime(m))})")
    with open(INDEX_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")


def fts_query(q):
    toks = re.findall(r"[A-Za-z0-9_.%+-]+", q)
    return " ".join('"' + t.replace('"', "") + '"' for t in toks)


def search(a):
    db = connect()
    sql = ("select path, heading, snippet(chunks,2,'[',']',' … ',40), body from chunks where chunks match ? "
           + ("and path like ? " if a.path else "") + "order by rank limit ?")
    tail = ([f"%{a.path}%"] if a.path else []) + [a.n]
    rows = db.execute(sql, [fts_query(a.query)] + tail).fetchall()
    if not rows:  # AND found nothing: fall back to any-term match, best-ranked first
        rows = db.execute(sql, [fts_query(a.query).replace('" "', '" OR "')] + tail).fetchall()
    for p, h, snip, body in rows:
        print(f"### {p}  §{h}")
        print((body[:a.chars] if a.full else snip.replace("\n", " ")[:a.chars]))
        print()
    # no results hint
    if not db.execute("select 1 from chunks limit 1").fetchone():
        print("index empty — run: python report-index/rq.py update")


def lst(a):
    db = connect()
    for p, t, m, s in db.execute("select path,title,mtime,size from files where path like ? order by path", (f"%{a.sub or ''}%",)):
        print(f"{p} | {t} | {time.strftime('%Y-%m-%d', time.localtime(m))} | {s}B")


def show(a):
    db = connect()
    q = "select heading, body from chunks where path=?" + (" and heading like ?" if a.heading else "")
    args = [a.path] + ([f"%{a.heading}%"] if a.heading else [])
    rows = db.execute(q, args).fetchall()
    if not rows:
        print("no such path/heading (see: rq.py list)")
        return
    used = 0
    for h, b in rows:
        piece = f"## {h}\n{b}\n"
        if used + len(piece) > a.chars:
            print(f"… truncated; raise --chars or use --heading ({len(rows)} chunks total)")
            break
        print(piece)
        used += len(piece)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    u = sp.add_parser("update"); u.add_argument("--quiet", action="store_true")
    s = sp.add_parser("search"); s.add_argument("query"); s.add_argument("-n", type=int, default=8)
    s.add_argument("--path"); s.add_argument("--chars", type=int, default=400); s.add_argument("--full", action="store_true")
    l = sp.add_parser("list"); l.add_argument("sub", nargs="?")
    w = sp.add_parser("show"); w.add_argument("path"); w.add_argument("--heading"); w.add_argument("--chars", type=int, default=4000)
    a = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    {"update": lambda: update(a.quiet), "search": lambda: search(a), "list": lambda: lst(a), "show": lambda: show(a)}[a.cmd]()


if __name__ == "__main__":
    main()
