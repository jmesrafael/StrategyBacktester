# News lab bots (BB-CORE, I-CORE, T-CORE + news gate), PAPER ONLY

Three paper bots built from FRESH copies of the originals plus exact-match patches. The originals are only read.

| bot | built from | patch | tag | service |
|---|---|---|---|---|
| news-bb | `D:\testing\Strat\bb-core` (4h) + `bb-core-1h/realpaper.js` | `patches/news-bb.js` | `bbn` | `newsbb` |
| news-ic | `D:\testing\Strat\i-core` + `bb-trail/realpaper.js` | `patches/news-ic.js` | `icn` | `newsic` |
| news-tc | `StrategyBacktester/bb-trail` (T-CORE paper lab) | `patches/news-tc.js` | `tcn` | `newstc` |

Every bot also gets `patches/gate.js`:
- `processCoin`: after the `opt.blocked` check, `else if (ng && ng.veto)` -> skip reason `news_gate` (detail `news_gate: <reasons>`); otherwise `riskUsd: riskFor(acct) * ng.mult`. The gate is **inert** in replay and when no `news` option is passed (proved byte-identical by the tests).
- `runOnce`: the signal is fetched ONCE per run (`newsgate.fetchSignal()`, 8 s timeout) and passed as `opt.news`, like `blocked`.
- Every entry records `news: { allowed, source, mult, reasons }` (journal) -> dashboard entry data `news_gate` ('allowed' | 'shrunk' | 'unavailable') and `news_reasons`.
- `telegram.js`: `send()` and `call()` return `{ ok:false, skipped:true }` before any network code.

`newsgate.js` is FAIL-OPEN: no signal, older than 6 h, malformed, unknown coin -> `{ veto:false, mult:1, source:'unavailable' }`.

## Commands

```
node news-lab-bots/build.js                    # regenerate out/news-bb, out/news-ic, out/news-tc from fresh copies
node --test news-lab-bots/test/newsgate-test.js
NEWS_BOT=bb node --test news-lab-bots/test/bot-test.js      # bb | ic | tc
node news-lab-bots/test/run-original-suites.js              # each original's own tests vs a temp copy of the original
bash news-lab-bots/build-news-lab.sh                        # build + test + dist/newslab.tar.gz + NEWS-LAB-INSTALL.md
```

Edit `patches/`, never `out/` (generated). Install on the VPS: `NEWS-LAB-INSTALL.md` (ledger with tags bbn/icn/tcn deployed FIRST).
