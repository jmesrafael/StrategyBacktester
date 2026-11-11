// NEWS_BOT=bb|ic|tc node --test news-lab-bots/test/bot-test.js — one generated news lab bot against its ORIGINAL.
// Proves: (1) with no news the copy decides exactly like the original (replay byte-identical; live-path entry identical),
// (2) a vetoing signal gives a news_gate skip, a shrink signal halves the risk, a stale signal is ignored (fail-open),
// (3) paper lock, (4) Telegram never reaches the network, (5) dashboard tag/prefix and the news fields on entry events.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');

const WHICH = process.env.NEWS_BOT || 'bb';
const STRAT = path.join(__dirname, '..', '..', '..');
const B = {
  bb: { out: 'news-bb', orig: path.join(STRAT, 'bb-core'), main: 'lucidio.js', env: 'LUCIDIO', tag: 'bbn' },
  ic: { out: 'news-ic', orig: path.join(STRAT, 'i-core'), main: 'icore.js', env: 'ICORE', tag: 'icn' },
  tc: { out: 'news-tc', orig: path.join(STRAT, 'StrategyBacktester', 'bb-trail'), main: 'icore.js', env: 'ICORE', tag: 'tcn' },
}[WHICH];
const COPY = path.join(__dirname, '..', 'out', B.out);

// isolate both bots from anything on this PC: temp state, no keys, no .env, no Telegram, no dashboard
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'newslab-'));
Object.assign(process.env, { [`${B.env}_STATE_DIR`]: TMP, [`${B.env}_KEYS`]: path.join(TMP, 'no-keys.json'), [`${B.env}_ENV_FILE`]: path.join(TMP, 'no.env'), [`${B.env}_NO_NOTIFY`]: '1', DASHBOARD_ASK_POLL_SEC: '0' });
for (const k of ['DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', `${B.env}_ALLOW_LIVE`]) delete process.env[k];

const orig = require(path.join(B.orig, B.main));
const copy = require(path.join(COPY, B.main));
const load = (dir, coin) => JSON.parse(fs.readFileSync(path.join(dir, 'data', coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
const fresh = () => ({ lastTime: 0, pos: null, realizedR: 0, n: 0, trades: [] });
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];

test(`${B.out}: replay is byte-identical to the original on all 5 coins (gate inert in replay, even with a vetoing signal)`, async () => {
  for (const coin of COINS) {
    const Bars = load(COPY, coin);
    const a = fresh(), b = fresh(), c = fresh();
    await orig.processCoin(coin, Bars, a, orig.paper, { replay: true, acct: { balance: 100 } });
    await copy.processCoin(coin, Bars, b, copy.paper, { replay: true, acct: { balance: 100 } });
    const veto = { updated: Date.now(), coins: { [coin]: { long: { allow: false, reasons: ['x'] }, short: { allow: false, reasons: ['x'] } } } };
    await copy.processCoin(coin, Bars, c, copy.paper, { replay: true, acct: { balance: 100 }, news: veto });
    assert.ok(a.trades.length > 10, `${coin}: original replay produced trades`);
    assert.equal(JSON.stringify(b.trades), JSON.stringify(a.trades), `${coin}: copy (no news) == original`);
    assert.equal(JSON.stringify(c.trades), JSON.stringify(a.trades), `${coin}: copy (veto signal, replay) == original`);
  }
});

// live path: the newest closed candle carries a real signal (taken from the replay), the bot wakes 5 s after the next candle opens
async function liveCase(mod, news, { withNews = true } = {}) {
  const coin = 'SOL', Bars = load(COPY, coin), st0 = fresh();
  await orig.processCoin(coin, Bars, st0, orig.paper, { replay: true, acct: { balance: 100 } });
  const t0 = st0.trades[Math.floor(st0.trades.length / 2)].t0 ?? st0.trades[Math.floor(st0.trades.length / 2)].t;   // a trade mid-history
  const k = Bars.findIndex((b) => b.time === t0);
  assert.ok(k > 500, 'found the entry candle');
  const win = Bars.slice(0, k + 1), now = t0 + 5;
  const seen = { entry: null, skips: [] };
  const hooks = { entry: (i) => { seen.entry = i; }, skip: (i) => { seen.skips.push(i); }, exit: () => {} };
  const st = { lastTime: null, pos: null, realizedR: 0, n: 0, trades: [] };
  const opt = { acct: { balance: 100, totalR: 0, peakR: 0 }, now, nowPx: win[k].open, hooks, save: () => {} };
  if (withNews) opt.news = typeof news === 'function' ? news(now) : news;
  await mod.processCoin(coin, win, st, mod.paper, opt);
  return { seen, st, now };
}
const sigFor = (now, long, short) => ({ updated: now * 1000, coins: { SOL: { long, short } } });

test(`${B.out}: live path with no signal (null) enters exactly like the original, and records 'unavailable'`, async () => {
  const o = await liveCase(orig, null, { withNews: false });
  const c = await liveCase(copy, null);
  assert.ok(o.seen.entry, 'original entered');
  assert.ok(c.seen.entry, 'copy entered');
  for (const k of ['dir', 'fill', 'stop', 'qty', 'riskUsd', 'sigTime']) assert.equal(c.seen.entry[k], o.seen.entry[k], k);
  assert.deepEqual(c.seen.entry.news, { allowed: true, source: 'unavailable', mult: 1, reasons: [] });
  const n = await liveCase(copy, null, { withNews: false });   // no news option at all: gate fully inert
  assert.equal(n.seen.entry.riskUsd, o.seen.entry.riskUsd); assert.equal(n.seen.entry.news, null);
});

test(`${B.out}: a vetoing signal skips with reason news_gate; the other side is not affected`, async () => {
  const o = await liveCase(orig, null, { withNews: false }), dir = o.seen.entry.dir;
  const veto = { allow: false, size: 0, reasons: ['blackout: CPI m/m in 2h'] }, okSide = { allow: true, size: 1, reasons: [] };
  const c = await liveCase(copy, (now) => sigFor(now, dir === 1 ? veto : okSide, dir === 1 ? okSide : veto));
  assert.equal(c.seen.entry, null); assert.equal(c.st.pos, null);
  const s = c.seen.skips.find((x) => x.reason === 'news_gate');
  assert.ok(s, 'news_gate skip emitted'); assert.equal(s.detail, 'news_gate: blackout: CPI m/m in 2h');
  const other = await liveCase(copy, (now) => sigFor(now, dir === 1 ? okSide : veto, dir === 1 ? veto : okSide));
  assert.ok(other.seen.entry, 'opposite side veto does not block this entry');
});

test(`${B.out}: a shrink signal halves the risk; a stale veto is ignored (fail-open)`, async () => {
  const o = await liveCase(orig, null, { withNews: false });
  const half = { allow: true, size: 0.5, reasons: ['BTC -6% in 24h'] };
  const c = await liveCase(copy, (now) => sigFor(now, half, half));
  assert.ok(c.seen.entry); assert.ok(Math.abs(c.seen.entry.riskUsd - o.seen.entry.riskUsd * 0.5) < 1e-9, `risk ${c.seen.entry.riskUsd} vs ${o.seen.entry.riskUsd}`);
  assert.deepEqual(c.seen.entry.news, { allowed: true, source: 'signal', mult: 0.5, reasons: ['BTC -6% in 24h'] });
  const veto = { allow: false, size: 0, reasons: ['x'] };
  const stale = await liveCase(copy, (now) => ({ ...sigFor(now, veto, veto), updated: (now - 7 * 3600) * 1000 }));
  assert.ok(stale.seen.entry, 'stale signal -> fail-open'); assert.equal(stale.seen.entry.riskUsd, o.seen.entry.riskUsd);
});

test(`${B.out}: paper lock holds whatever the flags and environment say`, () => {
  process.env[`${B.env}_ALLOW_LIVE`] = '1'; process.argv.push('--allow-live');
  try { assert.equal(copy.liveAllowed(), false); } finally { process.argv.pop(); delete process.env[`${B.env}_ALLOW_LIVE`]; }
  const cfg = JSON.parse(fs.readFileSync(path.join(COPY, 'bot-config.json'), 'utf8'));
  assert.equal(cfg.mode, 'paper'); assert.equal(cfg.realisticPaper, true); assert.equal(cfg.startBalance, 100);
  const oc = JSON.parse(fs.readFileSync(path.join(B.orig, 'bot-config.json'), 'utf8'));
  assert.deepEqual(cfg.riskTiers, oc.riskTiers, 'same risk steps as the original'); assert.equal(cfg.haltAtR, oc.haltAtR);
  assert.equal(copy.CFG.realisticPaper, true, 'config loads with realisticPaper on');
});

test(`${B.out}: Telegram never reaches the network, even with a token and no NO_NOTIFY`, async () => {
  const tg = require(path.join(COPY, 'telegram.js'));
  const saved = { ...process.env }, realFetch = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return { ok: true, json: async () => ({ ok: true }) }; };
  Object.assign(process.env, { TELEGRAM_BOT_TOKEN: '123456789:' + 'A'.repeat(35), TELEGRAM_CHAT_ID: '1' }); delete process.env[`${B.env}_NO_NOTIFY`];
  try {
    const r = await tg.send('hello'), r2 = await tg.send('<b>x</b>', { html: true }), r3 = await tg.call('getMe', {});
    for (const x of [r, r2, r3]) { assert.equal(x.ok, false); assert.equal(x.skipped, true); }
    assert.equal(calls, 0, 'no HTTP request was made');
  } finally { global.fetch = realFetch; for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
});

test(`${B.out}: dashboard events carry tag ${B.tag}, prefix "${B.tag}|", and the gate decision`, async () => {
  const journal = require(path.join(COPY, 'journal.js')), dp = require(path.join(COPY, 'dashboard-push.js'));
  const half = { allow: true, size: 0.5, reasons: ['BTC -6% in 24h'] };
  const c = await liveCase(copy, (now) => sigFor(now, half, half));
  const rec = journal.entryEvent(c.seen.entry, copy.CFG, 'paper');
  assert.deepEqual(rec.news, { allowed: true, source: 'signal', mult: 0.5, reasons: ['BTC -6% in 24h'] });
  const evs = dp.fromJournal(rec);
  assert.ok(evs.length >= 1);
  for (const e of evs) { assert.equal(e.bot, B.tag); assert.ok(e.event_id.startsWith(B.tag + '|'), e.event_id); }
  const entry = evs.find((e) => e.type === 'entry');
  assert.equal(entry.data.news_gate, 'shrunk'); assert.equal(entry.data.news_reasons, 'BTC -6% in 24h');
  const o = await liveCase(orig, null, { withNews: false }), dir = o.seen.entry.dir;
  const veto = { allow: false, size: 0, reasons: ['market hack: Y $150M'] };
  const v = await liveCase(copy, (now) => sigFor(now, dir === 1 ? veto : half, dir === 1 ? half : veto));
  const skipRec = journal.skipEvent(v.seen.skips.find((x) => x.reason === 'news_gate'), copy.CFG, 'paper');
  const se = dp.fromJournal(skipRec)[0];
  assert.equal(se.bot, B.tag); assert.equal(se.data.decision, 'skipped'); assert.equal(se.data.reason, 'news_gate'); assert.equal(se.data.detail, 'news_gate: market hack: Y $150M');
  assert.deepEqual(dp.leakCheck(JSON.stringify([...evs, se])), [], 'no secrets, paths or IPs in the events');
});
