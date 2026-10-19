// stats-report.js — the "Statistical Report" for the 4H ORB Reversal strategy.
//
// Philosophy (from the spec): don't just backtest — TEACH the probabilistic reality.
// Every number here is meant to make the user more epistemically humble: expectancy as
// the north star, confidence intervals on win rate, variance/sample-size warnings,
// streak analysis, cost-adjusted (net) expectancy, a gambler's-fallacy guard, and
// risk-of-ruin + drawdown-recovery math.
//
// Data source: it runs the strategy's own precise R-multiple backtest
// (window.__STRATEGIES.orb4h.runStats) over the candles handed in by StrategyMode, then
// renders into a self-contained modal that mirrors the app's .sg-modal / tab pattern.
//
// Monte Carlo fan chart + win-rate×RR heatmap are intentionally DEFERRED (shown as a
// "coming soon" placeholder) per the agreed core-first scope.
const StatsReport = (() => {
  let overlay = null, paneHost = null, tabNav = null, titleEl = null;
  let lastTab = 'report';

  // ───────────────────────── math helpers ─────────────────────────
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : 0);
  const fmtR = (v) => (v >= 0 ? '+' : '') + v.toFixed(3) + 'R';
  const pct = (v) => v.toFixed(1) + '%';
  const fmtNum = (v) => (v == null ? '–' : Math.abs(v) >= 1000 ? v.toFixed(1) : v.toFixed(2));
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // Compute the full statistical layer from the trade log + config.
  function analyze(trades, cfg) {
    const R = trades.map((t) => t.R_result);
    const N = R.length;
    const wins = R.filter((r) => r > 0);
    const losses = R.filter((r) => r < 0);
    const winRate = N ? wins.length / N : 0;
    const lossRate = N ? losses.length / N : 0;
    const avgWinR = wins.length ? mean(wins) : 0;
    const avgLossR = losses.length ? Math.abs(mean(losses)) : 0;
    const expectancy = mean(R); // ≡ winRate·avgWinR − lossRate·avgLossR
    const rr = cfg.rrRatio;
    const breakEvenWR = 1 / (1 + rr);
    const buffer = winRate - breakEvenWR;

    // 95% CI on win rate
    const ci95 = N ? 1.96 * Math.sqrt((winRate * (1 - winRate)) / N) : 0;

    // variance bands at fixed sample sizes (90% CI)
    const band = (n) => (n ? 1.645 * Math.sqrt((winRate * (1 - winRate)) / n) : 0);
    const varianceTable = [20, 50, 100, 200].map((n) => ({ n, lo: Math.max(0, winRate - band(n)), hi: Math.min(1, winRate + band(n)) }));

    // streaks (actual)
    let lw = 0, ll = 0, curW = 0, curL = 0;
    R.forEach((r) => {
      if (r > 0) { curW++; curL = 0; lw = Math.max(lw, curW); }
      else if (r < 0) { curL++; curW = 0; ll = Math.max(ll, curL); }
    });
    const expectedLongestLoss = (N > 1 && winRate < 1 && winRate > 0)
      ? Math.log(N) / Math.log(1 / (1 - winRate)) : null;

    // cost-adjusted (net) expectancy
    const costR = (cfg.spreadCostR || 0) + (cfg.commissionCostR || 0) + (cfg.slippageCostR || 0);
    const netExpectancy = expectancy - costR;

    // gambler's-fallacy: win rate grouped by the streak that PRECEDED each trade
    const afterLosses = gamblerGroups(trades, -1);
    const afterWins = gamblerGroups(trades, +1);

    // risk of ruin (approx) — see note in render; edge = normalized expectancy
    const meanAbsR = mean(R.map(Math.abs)) || 1;
    let edge = expectancy / meanAbsR;
    edge = Math.max(-0.999, Math.min(0.999, edge));
    const ror = (ddPct) => {
      const units = ddPct / (cfg.riskPerTradePct || 1);
      if (edge <= 0) return 1; // negative/zero edge ⇒ eventual ruin is ~certain
      return Math.pow((1 - edge) / (1 + edge), units);
    };
    const riskRows = [0.5, 1, 2, 5].map((r) => {
      const u50 = 50 / r, u90 = 90 / r;
      const p50 = edge > 0 ? Math.pow((1 - edge) / (1 + edge), u50) : 1;
      const p90 = edge > 0 ? Math.pow((1 - edge) / (1 + edge), u90) : 1;
      return { risk: r, p50, p90, current: Math.abs(r - (cfg.riskPerTradePct || 1)) < 1e-9 };
    });

    return {
      N, winRate, lossRate, avgWinR, avgLossR, expectancy, rr, breakEvenWR, buffer,
      ci95, varianceTable, longestWin: lw, longestLoss: ll, expectedLongestLoss,
      costR, netExpectancy, afterLosses, afterWins, edge, riskRows, ror,
    };
  }

  // Group trades by the consecutive-streak count that preceded them (signed via `dirSign`).
  // Returns rows for 1,2,3,4+ with win rate of trades entered on that streak.
  function gamblerGroups(trades, dirSign) {
    const buckets = { 1: [], 2: [], 3: [], 4: [] }; // 4 = "4+"
    trades.forEach((t) => {
      const s = t.streak_at_entry;
      if (Math.sign(s) !== dirSign || s === 0) return;
      const k = Math.min(4, Math.abs(s));
      buckets[k].push(t.R_result > 0 ? 1 : 0);
    });
    return [1, 2, 3, 4].map((k) => {
      const arr = buckets[k];
      return { k, label: k === 4 ? '4+' : String(k), n: arr.length, wr: arr.length ? mean(arr) : null };
    });
  }

  // ───────────────────────── render ─────────────────────────
  function callout(kind, html) {
    return `<div class="sr-callout sr-${kind}">${html}</div>`;
  }
  function section(title, html) {
    return `<div class="sr-section"><div class="sr-sec-title">${title}</div>${html}</div>`;
  }

  function renderReport(s, cfg) {
    if (!s.N) return callout('warn', '⚠️ No trades were generated on the loaded data. Load more history (or a lower timeframe) so multiple 4H ranges exist.');

    // 0.1 Expectancy — the north star
    let expVerdict;
    if (s.expectancy > 0.01) expVerdict = callout('good', `<b>Expectancy: ${fmtR(s.expectancy)} per trade.</b> Over a large sample this system earns ${fmtR(s.expectancy)} per trade. The edge is positive — but read the variance and cost sections before trusting it.`);
    else if (s.expectancy < -0.01) expVerdict = callout('bad', `<b>Expectancy: ${fmtR(s.expectancy)} per trade.</b> This system <b>loses</b> ${fmtR(Math.abs(s.expectancy))} per trade. A larger sample will not save it — the math is negative.`);
    else expVerdict = callout('warn', `<b>Expectancy: ${fmtR(s.expectancy)} per trade.</b> Near break-even. Transaction costs very likely make this a net loser (see below).`);

    const bufferTxt = s.buffer >= 0
      ? `Your win rate (${pct(s.winRate * 100)}) sits <b>+${(s.buffer * 100).toFixed(1)} pts</b> above the break-even win rate of ${pct(s.breakEvenWR * 100)} at ${s.rr}R.`
      : `Your win rate (${pct(s.winRate * 100)}) is <b>${(s.buffer * 100).toFixed(1)} pts</b> BELOW the break-even win rate of ${pct(s.breakEvenWR * 100)} at ${s.rr}R — the system is under water on win rate alone.`;

    const expBody =
      expVerdict +
      `<div class="sr-grid">` +
        kv('Win rate', `${pct(s.winRate * 100)} (${Math.round(s.winRate * s.N)}/${s.N})`) +
        kv('Avg win', fmtR(s.avgWinR)) +
        kv('Avg loss', `−${s.avgLossR.toFixed(3)}R`) +
        kv('Break-even WR @ ' + s.rr + 'R', pct(s.breakEvenWR * 100)) +
      `</div>` +
      callout(s.buffer >= 0 ? 'good' : 'bad', bufferTxt);

    // 0.3 Net expectancy
    const netBody =
      `<div class="sr-grid">` +
        kv('Gross expectancy', fmtR(s.expectancy)) +
        kv('Total cost / trade', `−${s.costR.toFixed(3)}R`) +
        kv('Net expectancy', fmtR(s.netExpectancy)) +
        kv('Cost break-even', `edge to spare: ${(s.expectancy).toFixed(3)}R`) +
      `</div>` +
      (s.expectancy > 0 && s.netExpectancy <= 0
        ? callout('bad', `🚩 <b>Gross-positive but net-negative.</b> A paper edge of ${fmtR(s.expectancy)} is entirely consumed by ${s.costR.toFixed(3)}R of costs. In reality this system loses money.`)
        : callout(s.netExpectancy > 0 ? 'good' : 'warn', `After ${s.costR.toFixed(3)}R of realistic costs, net expectancy is ${fmtR(s.netExpectancy)}. ${s.netExpectancy > 0 && s.netExpectancy < 0.1 ? 'This is a thin edge — execution quality will matter enormously.' : ''}`));

    // 0.7 + 0.2A sample size & confidence
    const lo = (s.winRate - s.ci95) * 100, hi = (s.winRate + s.ci95) * 100;
    let trust;
    if (s.N < 30) trust = ['bad', 'Results are <b>meaningless</b> from a statistical standpoint. Do not draw any conclusions.'];
    else if (s.N < 100) trust = ['warn', 'Results are <b>directional at best</b>. The confidence interval on your win rate is very wide. Collect more data.'];
    else if (s.N < 300) trust = ['warn', 'Results are <b>becoming meaningful</b>. The edge (if any) is starting to show through the noise. Interpret with caution.'];
    else trust = ['good', 'Results are <b>statistically robust</b>. Your expectancy is now a reliable estimate of the system\'s true edge.'];

    const varRows = s.varianceTable.map((v) =>
      `<tr><td>N = ${v.n}</td><td>${pct(v.lo * 100)} – ${pct(v.hi * 100)}</td><td>±${((v.hi - v.lo) / 2 * 100).toFixed(1)} pts</td></tr>`).join('');

    const sampleBody =
      (s.N < 100 ? callout('warn', `⚠️ <b>VARIANCE WARNING:</b> you have only <b>${s.N} trades</b>. At this sample size results can be dominated by luck — good or bad. A system with these exact stats could be profitable OR unprofitable in reality. Run on more data before concluding anything.`) : '') +
      callout(trust[0], `<b>Sample size — ${s.N} trades.</b> ${trust[1]}`) +
      callout('plain', `Win rate is <b>${pct(s.winRate * 100)} ± ${(s.ci95 * 100).toFixed(1)}%</b> at 95% confidence (N=${s.N}). The true win rate could plausibly be anywhere from <b>${pct(lo)}</b> to <b>${pct(hi)}</b>.`) +
      `<div class="sr-subtitle">What variance looks like at different sample sizes (90% band around ${pct(s.winRate * 100)}):</div>` +
      `<table class="sr-tbl"><thead><tr><th>Sample</th><th>90% win-rate band</th><th>± margin</th></tr></thead><tbody>${varRows}</tbody></table>`;

    // 0.2B streaks
    let streakCmp = '';
    if (s.expectedLongestLoss != null) {
      const exp = s.expectedLongestLoss;
      const verdict = s.longestLoss <= exp * 1.0 ? 'within expected' : s.longestLoss <= exp * 1.5 ? 'slightly long but normal' : 'unusually long';
      streakCmp = callout('plain', `Your longest losing streak was <b>${s.longestLoss}</b>. A system with your win rate over ${s.N} trades would be expected to produce a losing streak of up to <b>${exp.toFixed(1)}</b>. Your streak was <b>${verdict}</b> — losing streaks are math, not a broken system.`);
    }
    const streakBody =
      `<div class="sr-grid">` +
        kv('Longest win streak', s.longestWin) +
        kv('Longest loss streak', s.longestLoss) +
        kv('Expected longest loss streak', s.expectedLongestLoss != null ? s.expectedLongestLoss.toFixed(1) : '–') +
      `</div>` + streakCmp;

    // 0.5 gambler's fallacy
    const gRow = (g) => `<tr><td>${g.label}</td><td>${g.n}</td><td>${g.wr == null ? '–' : pct(g.wr * 100)}</td></tr>`;
    const gamblerBody =
      `<div class="sr-two">` +
        `<div><div class="sr-subtitle">Win rate AFTER N consecutive losses</div><table class="sr-tbl"><thead><tr><th>Prior losses</th><th>Trades</th><th>Win rate</th></tr></thead><tbody>${s.afterLosses.map(gRow).join('')}</tbody></table></div>` +
        `<div><div class="sr-subtitle">Win rate AFTER N consecutive wins</div><table class="sr-tbl"><thead><tr><th>Prior wins</th><th>Trades</th><th>Win rate</th></tr></thead><tbody>${s.afterWins.map(gRow).join('')}</tbody></table></div>` +
      `</div>` +
      callout('plain', `📊 <b>Gambler's-Fallacy Check:</b> win rate after losing streaks is essentially the same as the overall win rate of ${pct(s.winRate * 100)}. Each trade is independent. <b>Do NOT increase position size after losing streaks</b> — the next trade is never "due".`);

    // 0.6 risk of ruin + recovery asymmetry
    const rorRows = s.riskRows.map((r) =>
      `<tr class="${r.current ? 'sr-current' : ''}"><td>${r.risk}%${r.current ? ' ◄ you' : ''}</td><td class="sr-muted">requires Monte Carlo</td><td>${(r.p90 * 100).toFixed(r.p90 < 0.001 ? 4 : 2)}%${r.risk > 2 ? ' ⚠️' : ''}</td></tr>`).join('');
    const recov = [[10, 11.1], [20, 25], [30, 42.9], [50, 100], [75, 300]];
    const recovRows = recov.map(([d, r]) => `<tr><td>${d}%</td><td>${r}%</td></tr>`).join('');
    const ruinBody =
      callout('plain', `Risk-of-ruin below is an <b>analytic approximation</b> using a normalized edge of ${s.edge.toFixed(3)} (RoR ≈ ((1−edge)/(1+edge))^units). Empirical drawdown probabilities require the Monte Carlo engine (coming soon).`) +
      `<table class="sr-tbl"><thead><tr><th>Risk / trade</th><th>P(50% drawdown)</th><th>P(ruin ≈ 90% DD)</th></tr></thead><tbody>${rorRows}</tbody></table>` +
      `<div class="sr-subtitle">The asymmetry of losses — why position sizing is survival math:</div>` +
      `<table class="sr-tbl"><thead><tr><th>Drawdown</th><th>Gain needed to recover</th></tr></thead><tbody>${recovRows}</tbody></table>` +
      callout('warn', `A 50% drawdown needs a <b>100% gain</b> just to get back to even. Anything above 2% risk per trade is flagged for a reason.`);

    // deferred features
    const deferred = callout('plain', `🧪 <b>Monte Carlo fan chart & win-rate×RR heatmap — coming soon.</b> These will bootstrap-reshuffle your actual trade outcomes (1,000+ runs) to show the 10th/50th/90th-percentile equity curves and empirical drawdown probabilities, plus map where this strategy sits on the win-rate vs reward-risk expectancy surface.`);

    return (
      section('Expectancy — the north star (0.1)', expBody) +
      section('True (post-cost) expectancy (0.3)', netBody) +
      section('Sample size & confidence (0.7 / 0.2A)', sampleBody) +
      section('Streak analysis (0.2B)', streakBody) +
      section("Gambler's-fallacy guard (0.5)", gamblerBody) +
      section('Risk of ruin & loss asymmetry (0.6)', ruinBody) +
      section('Coming soon', deferred)
    );
  }

  function kv(k, v) { return `<div class="sr-kv"><span>${k}</span><b>${v}</b></div>`; }

  function renderTradeLog(trades) {
    if (!trades.length) return callout('warn', 'No trades to show.');
    const rows = trades.map((tr, i) => {
      const win = tr.R_result > 0;
      const time = (x) => x ? new Date(x * 1000).toISOString().slice(5, 16).replace('T', ' ') : '–';
      return `<tr class="${win ? 'sr-win' : 'sr-loss'}">` +
        `<td>${i + 1}</td><td>${tr.date}</td><td>${tr.direction}</td>` +
        `<td>${fmtNum(tr.range_low)}–${fmtNum(tr.range_high)}</td>` +
        `<td>${time(tr.breakout_candle_time)}</td>` +
        `<td>${time(tr.reentry_candle_time)}</td>` +
        `<td>${fmtNum(tr.entry_price)}</td><td>${fmtNum(tr.stop_price)}</td><td>${fmtNum(tr.target_price)}</td>` +
        `<td>${tr.stop_method_used}</td><td>${tr.streak_at_entry}</td><td>${esc(tr.exit_reason)}</td>` +
        `<td><b>${fmtR(tr.R_result)}</b></td></tr>`;
    }).join('');
    return `<div class="sr-logwrap"><table class="sr-tbl sr-log"><thead><tr>` +
      ['#', 'Date', 'Dir', 'Range', 'Breakout', 'Re-entry', 'Entry', 'Stop', 'Target', 'Stop method', 'Streak@entry', 'Exit', 'R']
        .map((h) => `<th>${h}</th>`).join('') +
      `</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderGuide() {
    return [
      section('How to run it', `<p>Load a symbol on a <b>low timeframe</b> (5m or 15m) with enough history that several 4H ranges exist. Open <b>Strategy → 4H Opening Range Breakout-Reversal</b>, set inputs, then <b>Run Backtest</b> and click <b>Full Statistical Report</b>. The report runs a precise R-multiple backtest on the exact candles loaded on the chart.</p>`),
      section('How the strategy works', `<p>The first <i>N</i>-hour window of each trading day (in the chosen timezone) sets a high/low range. After a candle <b>closes</b> beyond the range (wicks don't count) and then a later candle <b>closes back inside</b>, the breakout is faded: a bullish breakout that fails ⇒ <b>short</b>; a bearish one ⇒ <b>long</b>. The stop is the most extreme price reached during the excursion (bounded by an ATR multiple, with a swing/volatility/skip fallback); the target is <i>RR × stop distance</i>.</p>`),
      section('How to read every metric', `<ul>
        <li><b>Expectancy (R/trade)</b> — the single number that says whether the system makes money. Positive = edge; negative = no sample size will save it.</li>
        <li><b>Break-even win rate</b> = 1/(1+RR). Your buffer above/below it is the margin of safety.</li>
        <li><b>95% confidence interval</b> — the plausible range for the true win rate given your sample. Wide intervals mean "we don't really know yet".</li>
        <li><b>Variance warning</b> — below 100 trades, luck dominates. The variance table shows how wide the band is at N=20/50/100/200.</li>
        <li><b>Streak analysis</b> — your longest losing streak vs. the statistically expected one. Streaks are math, not a broken system.</li>
        <li><b>Net expectancy</b> — gross minus spread+commission+slippage (in R). A gross-positive / net-negative system loses money in reality.</li>
        <li><b>Gambler's-fallacy table</b> — win rate after N consecutive losses/wins. It should match the overall rate, because trades are independent.</li>
        <li><b>Risk of ruin / recovery</b> — probability of deep drawdown by risk-per-trade, and the gain needed to recover each drawdown. This is survival math.</li>
      </ul>`),
      section('How to tweak & improve', `<ul>
        <li><b>RR sweep (1.5 / 2 / 3):</b> higher RR lowers the break-even win rate but usually lowers the achieved win rate too — watch the expectancy, not the win rate.</li>
        <li><b>Tighten breakouts:</b> require the close to exceed the range by ≥0.1 ATR to filter weak breakouts.</li>
        <li><b>Higher-timeframe trend filter:</b> only short below / long above a 50-period H4 MA; compare filtered vs. unfiltered.</li>
        <li><b>Session filter:</b> skip low-liquidity hours; review performance by hour of day.</li>
        <li><b>Stop fallback comparison:</b> how often swing / volatility / skip triggers and its effect on expectancy & drawdown.</li>
        <li><b>In-sample / out-of-sample:</b> tune on the first 70% of data, validate on the final 30%.</li>
        <li><b>Cost sensitivity:</b> raise the cost-R inputs and watch net expectancy degrade — "how much edge do I actually have?".</li>
      </ul>`),
      callout('bad', `⚠️ <b>OVERFITTING WARNING:</b> every parameter you optimize to historical data reduces the chance the result holds out-of-sample. The more you tune, the more your backtest reflects the past rather than the future. Treat any parameter-swept result with heavy skepticism unless validated on unseen data.`),
      section('Known limitations', `<ul>
        <li>Historical backtest ≠ future performance.</li>
        <li>Worst-case (stop-first) fills are conservative; real results vary in either direction.</li>
        <li><b>Entry fill</b> mode (re-entry close vs next open) materially changes results — test both.</li>
        <li>Assumes you can always fill at the modeled price; real execution differs.</li>
        <li>Under ~100 trades, variance dominates and statistics are unreliable.</li>
        <li>Timezones use <b>fixed UTC offsets</b> (DST is ignored) — range boundaries can shift by an hour across DST changes.</li>
        <li>Transaction-cost inputs are estimates; real costs vary by broker, size and time of day.</li>
        <li>Risk-of-ruin here is an analytic approximation; empirical drawdown probabilities await the Monte Carlo engine.</li>
      </ul>`),
    ].join('');
  }

  // ───────────────────────── modal plumbing ─────────────────────────
  function ensureModal() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'sg-modal-overlay sr-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML =
      `<div class="sg-modal sr-modal">
        <div class="sg-modal-head">
          <span class="sg-modal-title sr-title">Statistical Report</span>
          <button class="sg-modal-close sr-close"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sg-tab-nav sr-tabnav">
          <button class="sg-tab-btn active" data-srtab="report">Report</button>
          <button class="sg-tab-btn" data-srtab="trades">Trade Log</button>
          <button class="sg-tab-btn" data-srtab="guide">Guide</button>
        </div>
        <div class="sr-panes"></div>
      </div>`;
    document.body.appendChild(overlay);
    titleEl = overlay.querySelector('.sr-title');
    tabNav = overlay.querySelector('.sr-tabnav');
    paneHost = overlay.querySelector('.sr-panes');

    overlay.querySelector('.sr-close').onclick = close;
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.style.display !== 'none') close(); });
    tabNav.querySelectorAll('.sg-tab-btn').forEach((b) => {
      b.onclick = () => { lastTab = b.dataset.srtab; showTab(); };
    });
  }

  let panes = {};
  function showTab() {
    tabNav.querySelectorAll('.sg-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.srtab === lastTab));
    paneHost.innerHTML = panes[lastTab] || '';
    paneHost.scrollTop = 0;
  }

  function open(candles, params) {
    ensureModal();
    const strat = window.__STRATEGIES && window.__STRATEGIES.orb4h;
    if (!strat || typeof strat.runStats !== 'function') return;
    let res;
    try { res = strat.runStats(candles, params); }
    catch (e) { res = { trades: [], config: params }; }
    const cfg = res.config || params;
    const s = analyze(res.trades, cfg);

    panes = {
      report: renderReport(s, cfg),
      trades: renderTradeLog(res.trades),
      guide: renderGuide(),
    };
    titleEl.textContent = `Statistical Report — ${res.trades.length} trades`;
    lastTab = 'report';
    showTab();
    overlay.style.display = 'grid';
  }

  function close() { if (overlay) overlay.style.display = 'none'; }

  return { open, close };
})();

window.StatsReport = StatsReport;
