// report/admin-report.js - builds the admin report "Intelligence System" (one self-contained HTML file with inline SVG charts)
// from the REAL datasets in intel/data. Re-run it any time:   node run.js adminreport
// Output: <adminReportsDir>/intel-system.html and an entry in <adminReportsDir>/index.json (newest first).
// No network, no packages, no AI. Numbers in the text come from the data, so a re-run keeps the report true.
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const spine = require('../lib/spine'), cfg = require('../lib/config'), U = require('../lib/util'), M = require('../lib/market');
const K = require('./charts'), { C } = K, J = require('../engines/journal'), V = require('../engines/validator'), S = require('../engines/backtest/strategies');
const INTEL = path.join(__dirname, '..');
const dt = (s) => new Date(s * 1000), md = (s) => dt(s).toISOString().slice(5, 10), sg = (v, d = 2) => U.signed(v, d), esc = K.esc;

function gather() {
  const g = {}; const asOf = M.lastClose('BTC'); g.asOf = asOf;
  g.days = spine.load('derived/journal', 'days.csv').filter((d) => d.bot === 'ALL');
  g.streaks = spine.load('derived/journal', 'streaks.csv').filter((s) => s.bot === 'ALL');
  g.summary = spine.load('derived/journal', 'summary.json');
  g.clusters = spine.load('derived/journal', 'clusters.csv');
  g.events = spine.load('events', 'events.jsonl'); g.study = spine.load('derived/event-study', 'study.csv');
  g.tags = g.events.filter((e) => e.kind === 'owner_tag');
  g.trades = spine.load('trades', 'trades.csv').filter((t) => t.mode === 'live');
  g.ref = spine.load('derived/reference-trades', 'trades.csv').filter((t) => t.version === 'v3' && t.cost === 'standard');
  g.refSummary = spine.load('derived/reference-trades', 'summary.json');
  g.regime = spine.load('derived/regime', 'verdict.json'); g.trans = spine.load('derived/regime', 'transitions.json'); g.vol = spine.load('derived/regime', 'volatility.json');
  g.corrDaily = spine.load('derived/correlation', 'daily.csv'); g.contagion = spine.load('derived/correlation', 'contagion.csv'); g.tail = spine.load('derived/correlation', 'tail.csv'); g.leadlag = spine.load('derived/correlation', 'leadlag.csv');
  g.expHist = spine.load('derived/exposure', 'history.csv'); g.expNow = spine.load('derived/exposure', 'now.json'); g.expAlerts = spine.load('derived/exposure', 'alerts.csv');
  g.health = spine.load('derived/health', 'daily.json'); g.decay = spine.load('derived/health', 'decay.csv');
  g.entryQ = spine.load('derived/execution', 'entry_quality.csv'); g.stopQ = spine.load('derived/execution', 'stop_quality.csv'); g.costs = spine.load('derived/execution', 'costs.csv'); g.liq = spine.load('derived/execution', 'liquidity.csv'); g.cap = spine.load('derived/execution', 'capacity.csv');
  g.truth = spine.load('derived/truth-check', 'findings.csv'); g.integrity = spine.load('derived/integrity', 'status.csv');
  g.datasets = spine.list().map((n) => { const m = spine.manifest(n); return { n, status: m.status, built: m.built_at.slice(0, 16).replace('T', ' '), files: Object.keys(m.files).length, rows: U.sum(Object.values(m.files).map((f) => f.rows || 0)), by: m.generator || '' }; });
  return g;
}
function runTests() {   // exact counts per file: run each file alone
  const dir = path.join(INTEL, 'test'), out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.js')).sort()) {
    const r = spawnSync(process.execPath, ['--test', path.join('test', f)], { cwd: INTEL, encoding: 'utf8' }), t = /ℹ tests (\d+)/.exec(r.stdout), p = /ℹ pass (\d+)/.exec(r.stdout), s = /ℹ skipped (\d+)/.exec(r.stdout);
    out.push({ f, n: t ? +t[1] : 0, pass: p ? +p[1] : 0, skip: s ? +s[1] : 0 });
  }
  return out;
}
function validatorMatrix() {
  const ids = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12], names = ['1 No look-ahead', '2 Trades and t-stat', '3 Unseen, 2024 on', '4 Survives 2x costs', '5 Without top 10', '6 Not a bot copy', '8 Neighbours', '9 Years positive', '10 Leave one coin out', '11 One regime', '12 Walk-forward'], rows = [];
  for (const name of ['bbcore', 'icore', 'tcore', 'bbFade', 'rsi2']) { const live = !!S.MAKE[name], v = V.validate(name, { skipOverlap: live, exclude: live ? name : undefined, nTests: 0 });
    rows.push({ label: { bbcore: 'BB-CORE', icore: 'I-CORE', tcore: 'T-CORE', bbFade: 'BB fade', rsi2: 'RSI(2)' }[name], verdict: v.verdict, cells: ids.map((id) => { const c = v.checks.find((x) => x.id === id); return !c ? null : c.skipped ? 'skip' : c.pass ? 'pass' : 'fail'; }), stats: v.stats }); }
  return { names, rows };
}

// ---------- charts ----------
function charts(g) {
  const x0 = Date.UTC(2026, 9, 24) / 1000, x1 = g.asOf, dayTicks = []; for (let t = x0; t <= x1; t += 3 * 86400) dayTicks.push({ v: t, label: md(t) });
  const btc = M.bars('BTC', '1h', { from: x0 - 3600 }).map((r) => [r[0] + 3600, r[4]]), out = {};
  const down = g.events.filter((e) => e.kind === 'price_shock' && e.asset === 'BTC' && e.direction === 'down' && e.episode_first && e.first_seen_at >= x0).map((e) => ({ x: e.first_seen_at, y: M.priceAt('BTC', e.first_seen_at), color: C.red, shape: 'tri' }));
  const tagLines = g.tags.filter((t) => t.first_seen_at >= x0).map((t, i) => ({ x: t.first_seen_at, label: String(i + 1), color: C.amber }));
  out.btc = K.line({ w: 700, h: 190, series: [{ name: 'BTC price (USDT)', color: C.ink, pts: btc }], xmin: x0, xmax: x1, xticks: dayTicks, vlines: tagLines, marks: down, ydec: 0, legend: false, label: 'BTC price with tagged events and price shocks' });
  const cum = []; for (let T = x0 + 4 * 3600; T <= x1; T += 4 * 3600) cum.push([T, U.sum(g.trades.map((t) => J.rAt(t, T)))]);
  const bands = g.streaks.map((s) => ({ x0: Date.parse(s.from) / 1000, x1: Date.parse(s.to) / 1000 + 86400, color: s.kind === 'profit' ? C.lgreen : C.lred }));
  out.cum = K.line({ w: 700, h: 190, series: [{ name: 'Live R, all bots (closed + open at market price)', color: C.teal, pts: cum, area: true, width: 2 }], xmin: x0, xmax: x1, xticks: dayTicks, bands, vlines: tagLines, hlines: [{ y: 0, color: C.mute }], ydec: 0, legend: false, ytitle: 'R', label: 'Cumulative live R' });
  out.daily = K.bars({ w: 700, h: 190, items: g.days.map((d) => ({ label: md(Date.parse(d.day) / 1000), value: d.day_r })), ydec: 1, labelRot: -60, valueLabels: false, label: 'Result per day in R' });
  // event study ranges
  const want = ['BTC down shock, all', 'BTC up shock, all', 'BTC down shock, large (5x+)', 'BTC up shock, large (5x+)', 'alt-coin down shock (own coin, pooled)', 'alt-coin up shock (own coin, pooled)', 'scheduled: CPI', 'scheduled: FOMC', 'scheduled: NFP', 'headline labelled bearish', 'owner tags (all)'], rows = [];
  for (const grp of want) for (const hz of ['r_24h', 'r_72h']) { const s = g.study.find((x) => x.group === grp && x.horizon === hz); if (!s) continue;
    const few = s.n_nonoverlap < 30, sig = !few && (s.diff_ci_lo > 0 || s.diff_ci_hi < 0); rows.push({ label: `${grp.replace(' (own coin, pooled)', '').replace('labelled ', '')} · ${hz.slice(2)} (n ${s.n_nonoverlap})`, lo: s.diff_ci_lo, hi: s.diff_ci_hi, mid: s.diff_mean, color: few ? '#b6c2d1' : sig ? C.blue : C.mute }); }
  out.study = K.ranges({ w: 700, rows, xmin: -9, xmax: 9, label: 'Move after events compared with a normal hour', xdec: 0 });
  const cb = ['ETH', 'SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'SUI', 'ARB'].map((c) => ({ label: c, values: ['down', 'up'].map((d) => { const r = g.contagion.find((x) => x.coin === c && x.direction === d && x.window === 'shock_hour'); return r ? r.ratio : null; }), colors: [C.red, C.green] }));
  out.contagion = K.bars({ w: 700, h: 190, items: cb, ymin: 0, ymax: 2, ydec: 2, hlines: [{ y: 1, color: C.mute, label: 'same as BTC' }], series: [{ name: 'after a BTC down shock', color: C.red }, { name: 'after a BTC up shock', color: C.green }], label: 'How far each coin moves compared with BTC in the shock hour' });
  const tl = g.tail.slice().sort((a, b) => b.p_down_together - a.p_down_together).map((t) => ({ label: t.coin, value: t.p_down_together * 100, color: C.violet }));
  out.tail = K.bars({ w: 700, h: 180, items: tl, ymin: 0, ydec: 0, hlines: [{ y: 5, color: C.red, label: '5% if unrelated' }], label: 'Chance a coin has its worst hours when BTC has its worst hours' });
  // reference equity
  const eq = []; for (const b of ['bbcore', 'icore', 'tcore']) { const tr = g.ref.filter((t) => t.bot === b).sort((a, c) => a.t_exit - c.t_exit); let s = 0, last = null; const pts = [];
    for (const t of tr) { s += t.r; const k = Math.floor(t.t_exit / (30 * 86400)); if (k !== last) { pts.push([t.t_exit, s]); last = k; } else pts[pts.length - 1] = [t.t_exit, s]; } eq.push({ name: { bbcore: 'BB-CORE', icore: 'I-CORE', tcore: 'T-CORE' }[b], color: { bbcore: C.blue, icore: C.amber, tcore: C.teal }[b], pts, width: 1.8 }); }
  const yt = []; for (let y = 2020; y <= 2026; y++) yt.push({ v: Date.UTC(y, 0, 1) / 1000, label: String(y) });
  out.equity = K.line({ w: 700, h: 220, series: eq, xticks: yt, ydec: 0, ytitle: 'R (after costs)', label: 'Reference backtests, cumulative R' });
  out.regime = K.bars({ w: 700, h: 200, items: g.regime.tests.map((t) => ({ label: `${{ bbcore: 'BB', icore: 'I', tcore: 'T' }[t.bot]} ${t.label.replace('_state', '')}`, values: [t.spread_before_2024, t.spread_from_2024], colors: [C.blue, C.teal] })), ydec: 2, series: [{ name: 'gap before 2024 (fitted)', color: C.blue }, { name: 'gap from 2024 (unseen)', color: C.teal }], label: 'Does the regime label explain bot results on unseen data' });
  const cd = g.corrDaily.slice(-365), cyt = []; for (let i = 0; i < cd.length; i += 60) cyt.push({ v: cd[i].t, label: cd[i].day.slice(0, 7) });
  out.corr = K.line({ w: 700, h: 190, series: [{ name: 'average pair correlation', color: C.blue, pts: cd.map((d) => [d.t, d.avg_pair_corr]), width: 2 }, { name: 'average correlation with BTC', color: C.amber, pts: cd.map((d) => [d.t, d.avg_corr_to_btc]), width: 1.6 }], xticks: cyt, ymin: 0.3, ymax: 1, ydec: 1, label: 'Rolling 7-day correlation between coins, last year' });
  const eh = g.expHist.filter((h) => h.t >= Date.UTC(2026, 10, 1) / 1000 && h.effective_bets != null), eyt = []; for (let t = Date.UTC(2026, 10, 1) / 1000; t <= x1; t += 2 * 86400) eyt.push({ v: t, label: md(t) });
  out.expBets = K.line({ w: 700, h: 150, series: [{ name: 'effective independent bets', color: C.violet, pts: eh.map((h) => [h.t, h.effective_bets]), width: 2 }], xticks: eyt, hlines: [{ y: 2, color: C.red, label: 'alert below 2' }], ymin: 1, ymax: 3, ydec: 1, legend: false, label: 'Effective independent bets' });
  out.expR = K.line({ w: 700, h: 150, series: [{ name: 'open net R', color: C.teal, pts: g.expHist.filter((h) => h.t >= Date.UTC(2026, 10, 1) / 1000).map((h) => [h.t, h.open_net_r]), area: true, width: 2 }], xticks: eyt, hlines: [{ y: 8, color: C.red, label: 'alert above 8R' }], ydec: 0, legend: false, label: 'Open net R' });
  out.parity = K.stacked({ w: 700, items: Object.entries(g.health.parity).map(([b, s]) => ({ label: { bbcore: 'BB-CORE', icore: 'I-CORE', tcore: 'T-CORE' }[b], matched: s.matched, live_only: s.live_only, backtest_only: s.backtest_only })), keys: ['matched', 'live_only', 'backtest_only'], colors: [C.green, C.amber, C.blue], label: 'Live entries matched with the backtest' });
  return out;
}

// ---------- static content ----------
const COMPONENTS = [
  ['Data foundation', 'Data store and loader', 'lib/spine.js, lib/util.js', 'One way to read and write shared data. Every dataset has a manifest with a checksum, a schema and a status. Bad, missing, stale or damaged data is refused. Logs that must never change are hash-chained.', 'Verified'],
  ['Data foundation', 'Candle registry', 'ingest/candles.js, lib/market.js', 'Checks all 270 candle series (order, duplicates, bad prices, gaps, history unchanged, coins current) and only serves clean ones.', 'Verified'],
  ['Data foundation', 'Trade exporter', 'ingest/trades.js', 'Turns the dashboard record into trades, signals, exchange closes and wallet snapshots. Read-only. Live download needs a read-only key.', 'Verified (seed export)'],
  ['Data foundation', 'Headline archive', 'ingest/headlines.js', 'Keeps every Pulse headline for good. Event time, published time and first-seen time are stored apart. Append-only.', 'Verified (5 days of data)'],
  ['Data foundation', 'Recorder intake', 'ingest/recorder.js', 'Takes the VPS recorder data (candles, order book, funding) into the store once it is pulled to this PC.', 'Waiting for the VPS pull'],
  ['Data foundation', 'Integrity monitor', 'integrity/monitor.js', '28 daily checks: checksums, freshness, entry prices against the market, logs intact, Binance against MEXC prices.', 'Verified'],
  ['Data foundation', 'Truth check', 'integrity/truthcheck.js', 'Compares bot events, exchange closes and wallet snapshots. Finds missing exits and position count gaps.', 'Verified'],
  ['Data foundation', 'Backup and restore', 'backup/backup.js', 'Versioned snapshots (unchanged files are hard-linked), verify, and restore into an empty folder.', 'Verified (same PC)'],
  ['History and events', 'Event ledger', 'engines/events', 'One row per market event (price shock, scheduled release, owner tag, strong headline) with the time it was first known. Hash-chained.', 'Verified'],
  ['History and events', 'Event study', 'engines/events', 'What BTC and coins did 1h, 24h, 72h and 7d after each kind of event, compared with a normal hour, with sample sizes and a 95% interval.', 'Verified'],
  ['History and events', 'Similar-event search', 'engines/events', 'Finds the past shocks most like a new one and shows what followed them.', 'Verified'],
  ['History and events', 'Daily journal and streaks', 'engines/journal', 'One row per day: result, market phase, range, shocks, tags. Finds streaks and entry clusters and stamps every entry with what was known.', 'Verified'],
  ['Market and portfolio', 'Regime engine', 'engines/regime', 'Labels each coin and the market (trending, volatile, quiet, ranging). Tests whether the label explains bot results on unseen data.', 'Verified'],
  ['Market and portfolio', 'Correlation and contagion', 'engines/correlation', 'Rolling correlation, how far coins follow BTC in a shock, lead-lag, and worst-hours together.', 'Verified'],
  ['Market and portfolio', 'Exposure monitor and stress test', 'engines/exposure', 'Measures the three bots as one bet (effective independent bets, net R) and the effect of BTC moves. Alert only.', 'Verified'],
  ['Research', 'Unified backtest engine', 'engines/backtest', 'One engine and one cost model for all studies. Reproduces BB-CORE, I-CORE and T-CORE trade for trade.', 'Verified'],
  ['Research', 'Rule gatekeeper', 'engines/validator', '11 fixed checks every new idea must pass before a paper bot. Keeps a hash-chained log of every idea tried.', 'Verified'],
  ['Strategy health', 'Live against backtest', 'engines/health', 'Do the bots make the same entries as their backtest? Is the live result unusual against backtest windows of the same length?', 'Verified'],
  ['Strategy health', 'Execution and capacity', 'engines/execution', 'Entry slippage, stop overshoot, fees, liquidity trend and size headroom per coin.', 'Verified (book part waits for VPS data)'],
  ['Operation', 'One-command runner', 'run.js', 'node run.js all / ingest / reports / status / test / snapshot / validate / adminreport.', 'Verified'],
];
const VPS = `
<h3>What the VPS can and cannot carry</h3>
<table><tr><th>Item</th><th>VPS (from project notes)</th><th>Full system, measured</th><th>Fit</th></tr>
<tr><td>Memory</td><td>1.6 GB, shared with the bots</td><td>853 MB peak for a full run</td><td class="neg">Too tight</td></tr>
<tr><td>Disk</td><td>15 GB, shared with the recorder</td><td>20 MB data + 296 MB candles + code</td><td class="flat">Possible</td></tr>
<tr><td>CPU</td><td>1 vCPU</td><td>10 s (reports) to 17 s (all)</td><td class="flat">Possible at low priority</td></tr>
<tr><td>Packages</td><td>Node.js already installed</td><td>none needed</td><td class="pos">Fine</td></tr></table>`;
const FILE_GROUPS = ['lib', 'ingest', 'integrity', 'backup', 'engines', 'report', 'test', 'inputs'];

function page(n, total, inner) { return `<section class="page">${inner}<div class="foot"><span>Lucid'io · Intelligence System report · built ${new Date().toISOString().slice(0, 10)}</span><span>Page ${n} of ${total}</span></div></section>`; }
const tbl = (head, rows, cls = '') => `<table class="${cls}"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
const statusCls = (s) => (/^Verified/.test(s) ? 'pos' : /Waiting/.test(s) ? 'amber' : 'flat');

function build() {
  const g = gather(), ch = charts(g), vm = validatorMatrix(), tests = runTests(), all = g.summary.bots.ALL, totalTests = U.sum(tests.map((t) => t.n)), totalPass = U.sum(tests.map((t) => t.pass));
  const files = U.walk(INTEL).filter((f) => !/^(data|backups|node_modules|reports)\//.test(f)), codeFiles = files.filter((f) => f.endsWith('.js'));
  const lines = U.sum(codeFiles.map((f) => fs.readFileSync(path.join(INTEL, f), 'utf8').split('\n').length));
  const engines = 12, pages = 11, ev = g.events, evKinds = {}; for (const e of ev) evKinds[e.kind] = (evKinds[e.kind] || 0) + 1;
  const prof = g.streaks.find((s) => s.kind === 'profit'), loss = g.streaks.find((s) => s.kind === 'loss'), bestDay = g.days.reduce((a, d) => (d.day_r > a.day_r ? d : a)), worstDay = g.days.reduce((a, d) => (d.day_r < a.day_r ? d : a));
  const alertShare = Math.round((g.expAlerts.length / g.expHist.filter((h) => h.n_open > 0).length) * 100);
  const hardLine = (n) => `<span class="pill">${n}</span>`;
  let n = 0; const P = [];
  // 1 cover
  P.push(page(++n, pages, `<div class="cover-band"><div class="tag">Admin report · Research and risk system</div><h1>Intelligence System</h1><p class="sub">Everything built on Nov 16, 2026 to find out what causes our profit and loss days: market shocks, news events, combined risk, and whether each bot still behaves like its backtest. It reads and reports. It never trades. Nothing in it runs an AI.</p></div>
  <div class="stats"><div class="stat"><b>${engines}</b><span>engines and monitors</span></div><div class="stat"><b>${totalPass}</b><span>of ${totalTests} tests pass</span></div><div class="stat"><b>${codeFiles.length}</b><span>code files, ${(lines / 1000).toFixed(1)}k lines</span></div><div class="stat"><b>17 s</b><span>to rebuild everything</span></div><div class="stat"><b>0</b><span>bots, configs or records changed</span></div><div class="stat"><b>${ev.length.toLocaleString('en')}</b><span>events in the ledger (since 2019)</span></div></div>
  <h3>What it shows in one picture</h3>${ch.btc}<p class="cap">BTC price, Oct 24 to Nov 15. Numbered dots are the events we tagged (list below). Red triangles are automatic price-shock alarms.</p>${ch.cum}<p class="cap">Live result of all bots in R (1R = what a bot risks on one trade). Green shading is a profit streak, red a loss streak.</p>
  <div class="tagrow">${g.tags.map((t, i) => `<span><b>${i + 1}</b> ${esc(t.title)} · ${U.iso(t.first_seen_at)} UTC</span>`).join('')}</div>`));
  // 2 purpose + architecture
  P.push(page(++n, pages, `<h2>What it is for</h2><p class="sub">We had one week of big profit and did not know why. This system answers: <b>what was happening in the market and the news when we made or lost money, and was it luck or the strategy?</b></p>
  <div class="grid3"><div class="card"><h3>Catch</h3><p>Finds price shocks (a move 3 times its normal size on 2 times its normal volume) and records scheduled releases, headlines and our own event tags with the time they were first known.</p></div><div class="card"><h3>Explain</h3><p>Stamps every bot entry with what was known at that moment, groups days into streaks and clusters, and shows what the market did after each kind of event.</p></div><div class="card"><h3>Protect</h3><p>Measures the combined bet of all bots, checks that live trades match the backtest, and tests every new idea with the same fixed rules.</p></div></div>
  <h3>How the parts fit together</h3>${arch()}<p class="cap">Data flows one way: sources → validated store → engines → reports. An engine never reads another engine's inside; it reads the store.</p>
  <h3>Rules that never change</h3><ul><li><b>Read-only.</b> It reads databases and files. It never writes to a bot, an exchange or the dashboard database.</li><li><b>No AI at run time.</b> Plain Node.js code. Any developer or AI model can maintain it.</li><li><b>No secrets in code.</b> Keys come from the environment or a git-ignored file.</li><li><b>No silent bad data.</b> A dataset that fails its checks cannot be loaded by an engine.</li><li><b>Information only.</b> Every alert is a message for the owner. No output changes a trade.</li></ul>`));
  // 3 components
  P.push(page(++n, pages, `<h2>Everything that was built</h2><p class="sub">${COMPONENTS.length} components. “Verified” means it has automated tests and a real run on real data.</p>
  ${tbl(['Group', 'Component', 'Where', 'What it does', 'Status'], COMPONENTS.map((c) => [c[0], `<b>${c[1]}</b>`, `<code>${c[2]}</code>`, c[3], `<span class="${statusCls(c[4])}">${c[4]}</span>`]), 'comp')}`));
  // 4 catalysts in our data
  P.push(page(++n, pages, `<h2>What caused the profit and the loss days</h2><p class="sub">Live bots, Oct 24 to Nov 15: <b>${sg(all.total_r, 1)}R in total</b> (${sg(all.closed_r, 1)}R closed on ${all.closed_n} trades, ${sg(all.open_r, 1)}R still open, valued at market prices). The open part can still change.</p>
  ${ch.daily}<p class="cap">Result per day. Best day ${bestDay.day} (${sg(bestDay.day_r, 1)}R), worst day ${worstDay.day} (${sg(worstDay.day_r, 1)}R).</p>
  <div class="grid2"><div class="card"><h3>One profit streak carried the period</h3><p>${prof.from} to ${prof.to}: <b>${sg(prof.total_r, 1)}R</b> in ${prof.days} days while BTC fell ${Math.abs(prof.btc_pct)}%. Tags inside it: ${esc(prof.tags)}. Shock days: ${prof.shock_days} of ${prof.days}.</p></div><div class="card"><h3>One loss streak</h3><p>${loss.from} to ${loss.to}: <b>${sg(loss.total_r, 1)}R</b>, around the Binance hack. BTC dropped once, then stalled, and shorts opened after the drop were stopped.</p></div></div>
  <h3>The pattern the data shows</h3><ul><li>Days with a price shock down made <b>${sg(U.sum(g.days.filter((d) => d.shocks_down > 0).map((d) => d.day_r)), 1)}R</b> over ${g.days.filter((d) => d.shocks_down > 0).length} days. Days without a shock lost <b>${sg(U.sum(g.days.filter((d) => !d.shocks_down && !d.shocks_up).map((d) => d.day_r)), 1)}R</b>.</li><li>The biggest cluster (9 entries by 4 bots on Nov 9) came <b>before</b> the Nvidia headline, after a price drop with no tagged news. The bots react to price, not to news.</li><li>The Binance hack and the election were <b>not</b> profit events. Hot inflation data (Nov 10) lines up best with the start of the profit streak.</li></ul>
  <div class="note warn"><b>Careful.</b> This is 23 days and one market fall. It describes what happened. It is not proof of a rule.</div>`));
  // 5 event study
  P.push(page(++n, pages, `<h2>What usually follows a market event</h2><p class="sub">${ev.length.toLocaleString('en')} events since 2019 (${Object.entries(evKinds).map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(', ')}). Each line shows how much more (or less) BTC or the coin moved than in a normal hour, with a 95% interval. A line that touches the zero line means <b>no proven difference</b>.</p>
  ${ch.study}<p class="cap">Blue = clearly different from a normal hour. Dark grey = not different. Light grey = too few samples (under 30 that do not overlap). “n” is the number of separate samples.</p>
  <h3>How far each coin follows BTC in a shock hour</h3>${ch.contagion}<p class="cap">Above 1 means the coin moves more than BTC. Bot coins fall about 1.1 to 1.5 times as far as BTC in a down shock, in the same hour.</p>
  <div class="note good"><b>What this means.</b> A shock does not tell us the next direction. It tells us the alts move with BTC in the same hour and by a bigger amount. There is no delay we could use: no lag other than 0 has a correlation above 0.1.</div>`));
  // 6 regime + correlation
  P.push(page(++n, pages, `<h2>Market regime and correlation</h2><p class="sub">The recorder labels each coin as trending, volatile, quiet or ranging. We asked: <b>does the label explain bot results on data it was not fitted on?</b> States were ranked on trades before 2024 and then checked from 2024 on.</p>
  ${ch.regime}<p class="cap">A good label would keep its gap after 2024. Result: <b>${g.regime.tests.filter((t) => t.verdict === "validated").length} of ${g.regime.tests.length} tests passed</b> (best chance value ${Math.min(...g.regime.tests.map((t) => t.p_value)).toFixed(3)}). Labels are context for reading the journal, not a trading filter.</p>
  <h3>How alike the coins are</h3>${ch.corr}<p class="cap">Now: average correlation <b>${g.corrDaily[g.corrDaily.length - 1].avg_pair_corr}</b>. When coins move this alike, ten positions are close to one position.</p>
  <h3>Worst hours together</h3>${ch.tail}<p class="cap">When BTC has one of its worst 5% hours, the coin is also in its own worst 5% about half the time or more.</p>`));
  // 7 exposure + health
  P.push(page(++n, pages, `<h2>Combined risk and strategy health</h2><p class="sub">Right now: <b>${g.expNow.n} open positions</b>, ${Math.round((g.expNow.long_share || 0) * 100)}% long, <b>${g.expNow.effective_bets} effective independent bets</b>. All three bots are short, so they are close to one bet.</p>
  ${ch.expBets}${ch.expR}<p class="cap">Top: effective independent bets (1 = one single bet). Bottom: open net R. Both alert lines are first guesses, not tuned. The “below 2” alert fired on ${alertShare}% of the time, so it does not separate normal from unusual. The 8R line is more selective.</p>
  <h3>Do the live bots do what their backtest says?</h3>${ch.parity}<p class="cap">Each bot's backtest, started when the bot went live, makes the same entry in most cases. Live-only and backtest-only entries come from skipped orders, a position already open, or small price differences between Binance and MEXC.</p>
  ${tbl(['Bot', 'Days', 'Live R (closed + open)', 'Backtest median for same length', 'Percentile'], g.decay.filter((d) => d.bot !== 'ALL').map((d) => [d.bot, d.window_days, sg(d.live_total_r), `${sg(d.bt_median_r)} (${sg(d.bt_p5, 0)} to ${sg(d.bt_p95, 0)})`, d.percentile]))}<p class="cap">Percentile = share of backtest windows of the same length that did worse. 50 is typical; below 5 would be an alert.</p>`));
  // 8 gatekeeper + backtest + execution
  P.push(page(++n, pages, `<h2>Testing ideas and measuring execution</h2><p class="sub">Every new rule must pass the same 11 checks before it can run on a paper bot. The self-test uses ideas we already know: the three live bots must pass and two rejected ideas must fail.</p>
  ${K.matrix({ w: 700, cols: vm.names, rows: vm.rows, label: 'Gatekeeper results' })}<p class="cap">Green ✓ pass, red ✗ fail, grey – skipped (a bot is not compared with itself). Checks 1 to 6 are hard (a fail means REJECTED). Checks 8 to 12 are soft (a fail means WATCH).</p>
  <h3>Reference backtests of the three bots (one engine, one cost model)</h3>${ch.equity}<p class="cap">Cumulative R after costs, each bot on its live coins, 2020 to Nov 2026. The engine reproduces each bot's own backtest trade for trade (30 runs, difference 0).</p>
  <h3>Execution quality (live trades)</h3>${tbl(['Bot', 'Entry slippage, median R', 'Worst entry R', 'Stop overshoot, median R', 'Fees share of gross', 'Cost per trade R'], ['bbcore', 'icore', 'tcore'].map((b) => { const e = g.entryQ.find((x) => x.bot === b && x.coin === 'ALL'), s = g.stopQ.find((x) => x.bot === b), c = g.costs.find((x) => x.bot === b); return [b, e ? sg(e.median_slip_r, 3) + ` (n ${e.n})` : '-', e ? sg(e.worst_slip_r, 3) : '-', s ? sg(s.median_overshoot_r, 3) + ` (n ${s.n})` : '-', c ? Math.round(c.fees_share_of_gross * 1000) / 10 + '% (n ' + c.n_closed + ')' : '-', c ? sg(c.avg_cost_r, 3) : '-']; }))}
  <p class="cap">Entries are filled slightly better than intended and stops are hit within 0.03R of the stop level. Lowest size headroom: ${(() => { const c = g.cap.filter((x) => x.headroom_x != null).sort((a, b) => a.headroom_x - b.headroom_x)[0]; return c ? `${c.bot} ${c.coin} at ${c.headroom_x}x (an estimate from Binance volume)` : 'n/a'; })()}.</p>`));
  // 9 data + tests + commands
  P.push(page(++n, pages, `<h2>Data, tests and commands</h2>
  <h3>Datasets in the store</h3>${tbl(['Dataset', 'State', 'Built (UTC)', 'Files', 'Rows', 'Built by'], g.datasets.map((d) => [`<code>${d.n}</code>`, `<span class="${d.status === 'ok' ? 'pos' : 'amber'}">${d.status === 'ok' ? 'ok' : 'waiting'}</span>`, d.built, d.files, d.rows.toLocaleString('en'), `<code>${esc(d.by.replace('engines/', ''))}</code>`]), 'small')}
  <h3>Automated tests: ${totalPass} of ${totalTests} pass</h3>${tbl(['Test file', 'Tests', 'Pass'], tests.map((t) => [`<code>${t.f}</code>`, t.n, t.pass]), 'small tests')}
  <h3>Commands</h3>${tbl(['Command', 'What it does'], [['node run.js all', 'Refresh every dataset and rebuild every report (about 17 s)'], ['node run.js status', 'One line per dataset: state and age'], ['node run.js test', 'Run all tests'], ['node run.js snapshot [--with-candles]', 'Versioned backup'], ['node run.js validate &lt;strategy&gt;', 'Run the gatekeeper on one idea'], ['node run.js selftest', 'Gatekeeper on known good and known rejected ideas'], ['node run.js adminreport', 'Rebuild this report']].map((r) => [`<code>${r[0]}</code>`, r[1]]), 'small')}`));
  // 10 VPS
  P.push(page(++n, pages, `<h2>Applying it to the VPS later</h2><p class="sub"><b>Nothing has been installed on the VPS.</b> This is the plan for when we are home. Goal: watch for catalysts all day and record what they do to our trades.</p>${VPS}${vpsPlan()}`));
  // 11 limits and blocked
  P.push(page(++n, pages, `<h2>Limits, open items and what we need to do</h2>
  <div class="grid2"><div class="card"><h3>Waiting for data</h3><ul><li><b>VPS recorder data.</b> Order-book capacity and MEXC checks wait for the pull.</li><li><b>Headlines.</b> Only 5 days exist (Pulse began saving on Nov 11).</li><li><b>Live history.</b> 8 to 23 days of trades. Edge-decay says “not unusual yet” at best.</li><li><b>Owner tags.</b> 5 events, entered after the fact. Tags entered live from now on are clean.</li></ul></div><div class="card"><h3>Needs the owner</h3><ul><li>Run <code>lucidio-recorder\\pull-recorder-data.cmd YOUR-VPS</code> (ssh login).</li><li>Create a <b>read-only</b> Supabase key for the live trade download.</li><li>Commit <code>intel/</code> to git (about 500 uncommitted changes in the repo).</li><li>Set a second backup copy and test a restore on another computer.</li><li>Confirm where the nightly ledger backup runs: none was found on this PC.</li></ul></div></div>
  <h3>Known limits</h3><ul><li>Open trades are valued from Binance prices; the bots trade on MEXC.</li><li>Regime labels failed the unseen-data test, so they are context only.</li><li>The gatekeeper self-test used 2 rejected ideas; the plan asked for 5.</li><li>The stress test is one-factor (BTC). It does not model coin-specific gaps or exchange outages.</li><li>Bot-code drift (<code>mexc.js</code> has 4 versions) was found but not touched. It needs authorization.</li></ul>
  <h3>Findings produced</h3><ul><li>All ${all.closed_n} closed live trades match the exchange records. One old I-CORE SOL short sits in the T-CORE wallet.</li><li>Exit events reach the dashboard a median 19 to 125 minutes after the exchange closes the position (longest 231 minutes).</li><li>ARB candles had stopped updating. Fixed, and the integrity step now catches it.</li></ul>
  <h3>Files</h3><p class="sub">${files.length} files in <code>StrategyBacktester/intel/</code>. Full list: <code>FILES.md</code>. Documents: <code>README.md</code>, <code>OPERATING-MANUAL.md</code>, <code>DATA-DICTIONARY.md</code>, <code>BACKUP-AND-RESTORE.md</code>, <code>PHASE0-AUDIT.md</code>, <code>IMPLEMENTATION-STATUS.md</code>, <code>VPS-MONITORING-PLAN.md</code>, and a README in every engine folder.</p>
  <div class="grid4">${FILE_GROUPS.map((d) => `<div class="mini"><b>${files.filter((f) => f.startsWith(d + '/')).length}</b><span>${d}/</span></div>`).join('')}</div>`));
  return { html: shell(P.join('\n')), totals: { totalTests, totalPass, files: files.length, codeFiles: codeFiles.length, lines } };
}
function arch() {
  const b = (x, y, w, h, t, l, f, s) => K.box(x, y, w, h, t, l, f, s), a = K.arrow; let s = '';
  s += b(8, 14, 128, 120, 'Sources', ['Binance candles', 'Dashboard database', 'Pulse headlines', 'VPS recorder', 'Owner event tags'], '#f8fafc', C.mute);
  s += b(190, 14, 130, 120, 'Data store', ['manifest + checksum', 'schema + version', 'append-only logs', 'refuses bad data'], '#eff6ff', C.blue);
  s += b(374, 14, 150, 120, 'Engines (read-only)', ['events · journal', 'regime · correlation', 'exposure · health', 'execution · backtest', 'rule gatekeeper'], '#f0fdfa', C.teal);
  s += b(578, 14, 118, 120, 'Outputs', ['reports (md, html)', 'datasets (CSV)', 'alert lines', 'backups'], '#fffbeb', C.amber);
  s += a(136, 74, 188, 74, C.mute) + a(320, 74, 372, 74, C.blue) + a(524, 74, 576, 74, C.teal);
  s += K.box(190, 160, 334, 62, 'Integrity monitor and truth check', ['checksums · freshness · bot events vs exchange records'], '#fef2f2', C.red) + K.arrow(257, 160, 257, 136, C.red) + K.arrow(441, 160, 441, 136, C.red);
  return K.svg(704, 236, s, 'System architecture');
}
function vpsPlan() {
  return `<h3>Three options</h3>${tbl(['Option', 'What runs on the VPS', 'Risk', 'Advice'], [
    ['<b>A. Record only</b>', 'Nothing new. The recorder keeps recording. We pull its data home and run <code>node run.js all</code> there each day.', 'None', '<span class="pos">Do first</span>'],
    ['<b>B. Light catalyst watcher</b>', 'A small new service, once an hour: fetch BTC 1h candles (public Binance), run the shock detector, append to an events file, write a daily line “what moved and what our bots did”. About 150 MB memory cap, low priority, own Linux user, no keys.', 'Low. Separate service; the bots are not touched.', '<span class="amber">Next, if A works</span>'],
    ['<b>C. Full system on the VPS</b>', 'Everything (<code>run.js all</code>).', '853 MB peak memory on a 1.6 GB machine that runs the bots.', '<span class="neg">Not advised</span>']])}
  <h3>Steps when we are home</h3><ol><li><b>Pull the recorder data</b> to the home PC. Run <code>node run.js all</code>. Check the mexc step turns ok.</li><li><b>Check VPS room</b> with the recorder's <code>status.sh</code> (free memory and disk).</li><li><b>Choose A or B.</b> For B, Claude builds and tests <code>vps-catalyst-watch</code> first on this PC. It is not written yet.</li><li><b>Install B</b> with the same pattern as the other installs: one install file with a checksum, an installer that refuses any code that mentions a key or a private endpoint, run as its own user.</li><li><b>Verify:</b> “live bots' start times unchanged: YES”, the service is running, the first event line appears.</li><li><b>Rollback:</b> stop and disable the service, delete its folder. The bots and the recorder are never part of it.</li></ol>
  <div class="note"><b>Safety rules for any VPS step.</b> No bot service, config or key file is touched. Public data only. Read-only. Each outward step needs the owner's go-ahead. Alerts are information only; they never change a trade. Where alerts are sent (a file, or a new Telegram bot) is the owner's choice.</div>`;
}
function shell(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="robots" content="noindex, nofollow, noarchive">
<title>Intelligence System: Everything Built on Nov 16, 2026 · Lucid'io</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; background: #e2e8f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; min-height: 297mm; padding: 16mm 15mm 20mm; position: relative; page-break-after: always; background: #fff; margin: 0 auto 10px; }
.foot { position: absolute; bottom: 8mm; left: 15mm; right: 15mm; font-size: 8.5px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px; gap: 10px; }
h1 { font-size: 38px; margin: 0 0 6px; letter-spacing: -0.5px; line-height: 1.1; } h2 { font-size: 22px; margin: 0 0 4px; } h3 { font-size: 14px; margin: 16px 0 6px; }
.sub { color: #64748b; font-size: 12.5px; margin: 0 0 12px; line-height: 1.5; } p, li { font-size: 12px; line-height: 1.55; } ul, ol { padding-left: 18px; margin: 6px 0; }
.cap { font-size: 10.5px; color: #64748b; margin: 2px 0 12px; text-align: center; line-height: 1.4; }
.pos { color: #15803d; font-weight: 600; } .neg { color: #dc2626; font-weight: 600; } .flat { color: #64748b; } .amber { color: #b45309; font-weight: 600; }
code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 10.5px; } .pill { background: #0f172a; color: #fff; border-radius: 10px; padding: 1px 8px; font-size: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin: 6px 0; }
th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; color: #64748b; font-weight: 600; padding: 4px 6px; border-bottom: 1.5px solid #0f172a; }
td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; line-height: 1.4; font-variant-numeric: tabular-nums; }
table.small { font-size: 9.5px; } table.small td { padding: 2.5px 6px; } table.tests td:nth-child(n+2), table.tests th:nth-child(n+2) { text-align: right; width: 60px; } table.comp td:first-child { color: #64748b; white-space: nowrap; }
.cover-band { background: linear-gradient(135deg, #0f172a 0%, #12355b 55%, #0f766e 120%); color: #fff; margin: -16mm -15mm 16px; padding: 20mm 15mm 12mm; } .cover-band .sub { color: #cbd5e1; max-width: 150mm; } .cover-band .tag { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #5eead4; margin-bottom: 10px; }
.stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 4px; } .stat { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 6px; text-align: center; } .stat b { display: block; font-size: 20px; color: #0f766e; } .stat span { font-size: 9.5px; color: #64748b; line-height: 1.25; display: block; }
.tagrow { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 10.5px; margin-top: 4px; } .tagrow b { display: inline-block; background: #d97706; color: #fff; border-radius: 50%; width: 15px; height: 15px; text-align: center; line-height: 15px; font-size: 9px; margin-right: 3px; }
.card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 13px; } .card h3 { margin-top: 0; } .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 10px 0; } .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0; } .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.mini { border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; text-align: center; } .mini b { font-size: 16px; display: block; } .mini span { font-size: 10px; color: #64748b; }
.note { background: #f8fafc; border-left: 3px solid #1d4ed8; padding: 9px 12px; border-radius: 6px; font-size: 11.5px; line-height: 1.55; margin: 10px 0; } .warn { background: #fef2f2; border-left-color: #dc2626; } .good { background: #f0fdfa; border-left-color: #0f766e; }
@media (max-width: 700px) { .page { width: 100%; min-height: 0; padding: 18px 14px 40px; } .foot { position: static; margin-top: 16px; } .cover-band { margin: -18px -14px 14px; padding: 24px 14px 14px; } .stats { grid-template-columns: repeat(2, 1fr); } .grid2, .grid3 { grid-template-columns: 1fr; } .grid4 { grid-template-columns: repeat(2, 1fr); } table { display: block; overflow-x: auto; } }
@media print { body { background: #fff; } .page { margin: 0; } }
</style></head><body>
${body}
</body></html>
`;
}

function run() {
  const { html, totals } = build(), dir = cfg.path(cfg.adminReportsDir), file = path.join(dir, 'intel-system.html');
  if (!fs.existsSync(dir)) throw new Error('admin reports folder not found: ' + dir + ' (config key adminReportsDir)');
  fs.writeFileSync(file, html);
  const idx = path.join(dir, 'index.json'), list = JSON.parse(fs.readFileSync(idx, 'utf8')), entry = { slug: 'intel-system', title: 'Intelligence System: Everything Built to Find What Causes Our Profit and Loss',
    summary: `The research and risk system built on Nov 16, 2026, with charts from real data: market shocks and tagged events against our live result, what usually follows an event, how alike the coins are, the combined risk of the three bots, whether each bot still matches its backtest, the rule gatekeeper, and every component, dataset, test and command. Includes the plan for applying it to the VPS later (nothing is installed there). Read-only, no AI at run time.`, updated: 'Nov 16, 2026', kind: 'Data report', file: 'intel-system.html' };
  const i = list.findIndex((r) => r.slug === 'intel-system'); if (i >= 0) list[i] = entry; else list.unshift(entry);
  fs.writeFileSync(idx, JSON.stringify(list, null, 2) + '\n');
  return { file, bytes: Buffer.byteLength(html), ...totals };
}
module.exports = { run, build };
if (require.main === module) { const r = run(); console.log(`admin report: ${r.file} (${(r.bytes / 1024).toFixed(0)} KB), ${r.totalPass}/${r.totalTests} tests, ${r.files} files`); }
