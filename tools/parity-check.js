// tools/parity-check.js — guards the invariant "backtest == replay" for EVERY strategy.
//
// The backtest (StrategyMode.simulate) and the live replay (processCandle + TradeSim) are
// two execution paths that now share one decision core (evalStrategyCandle in js/strategy.js).
// This tool proves they still agree: for each registered strategy it runs BOTH over the SAME
// candles (full history, default params) and asserts an identical trade sequence + net P&L.
//
//   npm run parity                 # ETHUSDT 240, 1000 bars
//   SYM=BTCUSDT IV=60 BARS=1500 npm run parity
//
// Requires Google Chrome installed (driven headless via playwright-core) and network access
// to fetch candles. Exit code is non-zero if ANY strategy diverges — wire it into CI / run it
// after adding a strategy.
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright-core');

const SYM = process.env.SYM || 'ETHUSDT';
const IV = process.env.IV || '240';
const BARS = process.env.BARS || '1000';
const PORT = 8137;
const URL = `http://localhost:${PORT}/index.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1) serve the static app
  const server = spawn(process.execPath, ['.serve.js'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await sleep(1200);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(([sym, iv, bars]) => {
    const S = {
      'cr.symbol': sym, 'cr.interval': iv, 'cr.maxCandles': bars,
      'cr.replayMode': 'candle',
      'cr.stratInputs': '{}',   // force pure default params (no saved overrides)
      'cr.tradeSim': JSON.stringify({ startBalance: 10000, sizePct: 25, commissionPct: 0.05, slippagePct: 0.01 }),
    };
    for (const k in S) localStorage.setItem(k, S[k]);
  }, [SYM, IV, BARS]);

  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { return typeof ChartView !== 'undefined' && ChartView.getCandleSeries().data().length > 50; }
    catch (e) { return false; }
  }, { timeout: 30000 });
  await sleep(600);

  const ids = await page.evaluate(() => (window.STRATEGY_REGISTRY || []).map((s) => ({ id: s.id, label: s.label })));

  const CFG = { startBalance: 10000, sizePct: 25, commissionPct: 0.05, slippagePct: 0.01 };
  const results = [];

  for (const { id, label } of ids) {
    let r;
    try {
      // Fresh page state per strategy (avoids any cross-strategy replay residue).
      await page.evaluate(() => location.reload());
      await page.waitForFunction(() => {
        try { return typeof ChartView !== 'undefined' && ChartView.getCandleSeries().data().length > 50; }
        catch (e) { return false; }
      }, { timeout: 30000 });
      await sleep(400);

      r = await page.evaluate(({ id, cfg }) => {
        const setVal = (s, v) => { const e = document.querySelector(s); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } };
        document.getElementById('strategyBtn').click();
        const row = [...document.querySelectorAll('.sg-strat-row')].find((x) => x.dataset.id === id);
        if (!row) return { error: 'no registry row' };
        row.click();
        const o = document.querySelector('.sg-modal-overlay'); if (o) o.style.display = 'grid';
        document.querySelector('.sg-tab-btn[data-tab="replay"]').click();
        setVal('.sg-range-num', '99'); setVal('.sg-range-unit', 'years');
        document.querySelector('.sg-start-btn').click();   // → enterReplayMode (cut at start)
        if (typeof Replay === 'undefined' || !Replay.full || !Replay.full.length) return { error: 'replay did not start' };

        // CANONICAL backtest over the exact candles the replay will reveal.
        const strat = window.__STRATEGIES[id];
        const prms = {}; Object.entries(strat.params || {}).forEach(([k, d]) => { prms[k] = d.default; });
        const canon = StrategyMode.simulate(strat, prms, Replay.full, cfg);
        const cTrades = canon.trades.map((t) => ({ side: t.side, usd: +t.usd.toFixed(4) }));
        const canonNet = +(canon.finalBalance - cfg.startBalance).toFixed(2);

        // REPLAY: drive candle-by-candle, capture each closed trade, force-close at end.
        Replay.setMode('candle');
        const startBal = TradeSim.getAccount().balance;
        const rTrades = []; const orig = TradeSim.close;
        TradeSim.close = function (p) {
          const a = TradeSim.getAccount(); const had = !!a.position; const b0 = a.balance; const side = a.position;
          orig.call(TradeSim, p);
          if (had) rTrades.push({ side, usd: +(TradeSim.getAccount().balance - b0).toFixed(4) });
        };
        let g = 0; while (!Replay.state().atEnd && g++ < 500000) Replay.step();
        const openAtEnd = !!TradeSim.getAccount().position;
        if (openAtEnd) TradeSim.close();
        const replayNet = +(TradeSim.getAccount().balance - startBal).toFixed(2);
        TradeSim.close = orig;

        let firstMismatch = null;
        const n = Math.max(cTrades.length, rTrades.length);
        for (let k = 0; k < n; k++) {
          const a = cTrades[k], b = rTrades[k];
          if (!a || !b || a.side !== b.side || Math.abs(a.usd - b.usd) > 0.01) {
            firstMismatch = { k, canon: a || null, replay: b || null }; break;
          }
        }
        return {
          bars: Replay.full.length,
          canonTrades: cTrades.length, replayTrades: rTrades.length,
          canonNet, replayNet, netDelta: +(replayNet - canonNet).toFixed(2),
          openAtEnd, firstMismatch,
          canonTail: cTrades.slice(-3), replayTail: rTrades.slice(-3),
        };
      }, { id, cfg: CFG });
    } catch (e) {
      r = { error: e.message };
    }
    const pass = r && !r.error && r.firstMismatch == null && r.canonTrades === r.replayTrades && Math.abs(r.netDelta) <= 0.01;
    results.push({ id, label, pass, r });
    await sleep(150);
  }

  // ---- report ----
  console.log(`\nParity check — ${SYM} ${IV}  (backtest vs replay, full history, default params)\n`);
  let failed = 0;
  for (const { id, label, pass, r } of results) {
    if (!pass) failed++;
    const tag = pass ? 'PASS' : 'FAIL';
    if (r.error) { console.log(`  [${tag}] ${label.padEnd(40)} ERROR: ${r.error}`); continue; }
    console.log(`  [${tag}] ${label.padEnd(40)} trades ${r.canonTrades}/${r.replayTrades}  net $${r.canonNet}/$${r.replayNet} (Δ ${r.netDelta})`);
    if (!pass && r.firstMismatch) {
      const m = r.firstMismatch;
      console.log(`         first mismatch @#${m.k}: backtest=${JSON.stringify(m.canon)} replay=${JSON.stringify(m.replay)}`);
      console.log(`         backtest tail: ${JSON.stringify(r.canonTail)}`);
      console.log(`         replay   tail: ${JSON.stringify(r.replayTail)}  openAtEnd=${r.openAtEnd}`);
    }
  }
  console.log(`\n${results.length - failed}/${results.length} strategies in parity.` + (pageErrors.length ? `  (page errors: ${pageErrors.length})` : ''));

  await browser.close();
  server.kill();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
