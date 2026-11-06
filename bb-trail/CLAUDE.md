# T-CORE paper lab (formerly BB-Trail, dashboard tag bbtr)

Paper-only bot (bb-core entry, 2 ATR stop, 14 ATR trailing stop), built Nov 6, 2026. Third bot of TRI-CORE (BB-CORE + I-CORE + T-CORE). Dashboard support is deployed (ledger commit 12046bd); installed on the VPS Nov 6, 2026 (service bbtrail, paper only).

- VPS install DONE (Nov 6, 2026). **T-CORE-INSTALL-WHEN-HOME.md** is the record of the steps; do not reinstall. HANDOFF-HOME.md is the older version.
- Going live later: **LIVE-READINESS-TCORE.md** (gates and code changes; plan only, nothing enables live).
- What it is and how to run it: README-TRAIL.md. The install file for the VPS: VPS-TRAIL-INSTALL.md (rebuild with `bash build-trail-bundle.sh`).
- Paper only: never change `mode`, add a key file or touch the live bots (`lucidio`, `icore`). `npm test` must pass before anything is built or installed.
- The files `icore.js`, `journal.js`, `mexc.js`, `dashboard-push.js`, `telegram.js` and `compare-live-vs-backtest.js` are generated from `../../i-core` (the I-Core repo) by `apply-trail-patch.js`: change the patch (and re-run it on a fresh copy), not the generated files, unless you also update the patch.
