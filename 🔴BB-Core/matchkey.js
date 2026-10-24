// matchkey.js - THE match key shared by the bot's journal, the shadow recorder and compare-live-vs-backtest.js:
//   symbol (SOL_USDT), side (LONG | SHORT), signal candle open time in UTC milliseconds.
// trade_id is those three joined with "|". journal.js builds the same string (tests/shadow-test.js proves they never drift apart);
// the recorder and the compare script use this file so nothing has to be matched by hand. Pure functions: no files, no network, no keys.
'use strict';

const sideName = (dir) => (dir === 1 || dir === 'LONG' ? 'LONG' : dir === -1 || dir === 'SHORT' ? 'SHORT' : null);
const symbolOf = (coin) => (String(coin).endsWith('_USDT') ? String(coin) : `${coin}_USDT`);
const tradeId = (symbol, side, sigTimeSec) => `${symbolOf(symbol)}|${sideName(side)}|${Math.round(sigTimeSec) * 1000}`;
// { symbol, side, signal_candle_open_ms } exactly as the journal's match_key
const matchKey = (symbol, side, sigTimeSec) => ({ symbol: symbolOf(symbol), side: sideName(side), signal_candle_open_ms: sigTimeSec == null ? null : Math.round(sigTimeSec) * 1000 });
const parseTradeId = (id) => { const [symbol, side, ms] = String(id).split('|'); return { symbol, side, signal_candle_open_ms: +ms }; };

module.exports = { sideName, symbolOf, tradeId, matchKey, parseTradeId };
