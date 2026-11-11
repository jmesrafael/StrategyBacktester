// The edits every news lab bot gets, on top of its own paper build (see news-bb.js / news-ic.js / news-tc.js):
//   - the news gate in processCoin, right after the opt.blocked check (veto -> skip 'news_gate'; allow -> risk x size), INERT in replay and when no news is passed
//   - the signal fetched ONCE per run before the coin loop and passed to processCoin like `blocked`
//   - the gate decision recorded on every entry (journal + dashboard)
//   - Telegram disabled in the code (send and call never reach the network, whatever the environment holds)
'use strict';
const { edit } = require('./edit.js');

function applyGate({ main, codeFilesFrom, codeFilesTo, mk, coreFrom, coreTo }) {
  edit(main, [
    ["const tg = require('./telegram.js');",
     "const tg = require('./telegram.js');\nconst newsgate = require('./newsgate.js');   // NEWS LAB: the news gate (vetoes or shrinks new entries; fail-open, never opens a trade)", 1],
    ['indicators: indAt(i), reason, detail });\n        if (!opt.replay && now - next.time > CFG.maxEntryDelaySec) {',
     'indicators: indAt(i), reason, detail });\n' +
     "        const ng = opt.replay || !('news' in opt) ? null : newsgate.decide(opt.news, coin, sig.dir, now * 1000);   // NEWS LAB: inert in replay / backtest parity and when no news option is passed\n" +
     '        if (!opt.replay && now - next.time > CFG.maxEntryDelaySec) {', 1],
    ['        else if (opt.blocked) { ev.push(`${tag} skipped: ${opt.blocked}`); skip(\'blocked\', opt.blocked); }\n        else {\n          const r = await exec.enter(coin, { ...sig, refOpen: fillPx, t0: next.time, sigTime: c.time, riskUsd: riskFor(acct), st, save: opt.save || (() => {}) });',
     '        else if (opt.blocked) { ev.push(`${tag} skipped: ${opt.blocked}`); skip(\'blocked\', opt.blocked); }\n' +
     '        else if (ng && ng.veto) { ev.push(`${tag} skipped: news gate (${ng.reason})`); skip(\'news_gate\', `news_gate: ${ng.reason}`); }   // NEWS LAB\n' +
     '        else {\n          const r = await exec.enter(coin, { ...sig, refOpen: fillPx, t0: next.time, sigTime: c.time, riskUsd: riskFor(acct) * (ng ? ng.mult : 1), st, save: opt.save || (() => {}) });   // NEWS LAB: risk x the gate\'s size (1 unless it shrinks)', 1],
    ["            emit('entry', { symbol: SYM, coin, dir: p.dir, sigTime: c.time,",
     "            emit('entry', { news: ng ? { allowed: !ng.veto, source: ng.source, mult: ng.mult, reasons: ng.reasons } : null, symbol: SYM, coin, dir: p.dir, sigTime: c.time,", 1],
    ['  for (const coin of runCoins) {\n    const c = (run.coins[coin] = {});',
     "  // NEWS LAB: the news signal, fetched ONCE per run. null (unreachable, stale, bad) = entries are not gated this run (fail-open).\n" +
     "  const newsSignal = await newsgate.fetchSignal();\n" +
     "  run.news = newsSignal ? { updated: newsSignal.updated, blackout: !!newsSignal.blackout } : { unavailable: true };\n" +
     "  if (!newsSignal) event('warn', 'news', 'news signal unavailable this run: new entries are not gated (fail-open)');\n" +
     '  for (const coin of runCoins) {\n    const c = (run.coins[coin] = {});', 1],
    ['blocked, save: () => saveState(state), hooks });', 'blocked, news: newsSignal, save: () => saveState(state), hooks });', 1],
  ]);
  edit('journal.js', [
    ['    costs: i.costs,\n  };\n}\nfunction exitEvent', '    costs: i.costs,\n    news: i.news ?? null,   // NEWS LAB: the gate\'s decision for this entry { allowed, source, mult, reasons }\n  };\n}\nfunction exitEvent', 1],
    [codeFilesFrom, codeFilesTo, 1],
  ]);
  edit('dashboard-push.js', [
    [mk[0], mk[1], 1],
    ['costs_kind: strN(rec.costs && rec.costs.kind, 20) };',
     "costs_kind: strN(rec.costs && rec.costs.kind, 20),\n      // NEWS LAB: what the news gate said at entry ('allowed' | 'shrunk' | 'unavailable') and why\n" +
     "      news_gate: rec.news ? (rec.news.source !== 'signal' ? 'unavailable' : rec.news.mult < 1 ? 'shrunk' : 'allowed') : null, news_reasons: rec.news && Array.isArray(rec.news.reasons) && rec.news.reasons.length ? strN(rec.news.reasons.join('; '), 200) : null };", 1],
  ]);
  edit('telegram.js', [
    ['async function call(method, body, { fetchImpl = fetch, timeoutMs = 8000, token = creds().token } = {}) {\n',
     "async function call(method, body, { fetchImpl = fetch, timeoutMs = 8000, token = creds().token } = {}) {\n  return { ok: false, skipped: true, error: 'news lab: Telegram is disabled in this build' };   // NEWS LAB: never reaches Telegram\n", 1],
    ['async function send(text, opt = {}) {\n',
     "async function send(text, opt = {}) {\n  return { ok: false, skipped: true, error: 'news lab: Telegram is disabled in this build' };   // NEWS LAB: never sends, whatever the environment holds\n", 1],
    [coreFrom, coreTo, 1],
  ]);
}

module.exports = { applyGate };
