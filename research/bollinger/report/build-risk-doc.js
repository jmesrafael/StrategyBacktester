// build-risk-doc.js — "BB Breakout - Risks and How We Prevent Them" PDF: every risk of running the BB Breakout bot with real money on MEXC
// (strategy, money, execution, exchange, security, operations, legal), how each is prevented, kill-switch limits, checklists and playbook.
// Numbers are taken from the research in this folder (bb-deep.js, near-deep.js, live-parity.js, mexc-check.js, results of 2026-10-21).
// usage: node build-risk-doc.js [--shots]   -> ../../../PDF/<title>.pdf
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PDF_DIR = path.resolve(__dirname, '../../../PDF');
const TITLE = 'BB Breakout - Risks and How We Prevent Them - Live Bot on MEXC';
const C = { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#8a897f', grid: '#e1e0d9', axis: '#c3c2b7', neutral: '#f0efec',
  blue: '#2a78d6', blueD: '#1c5cab', red: '#e34948', redD: '#b8302f', amber: '#c28a00', green: '#1baf7a', greenD: '#12805a' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------------------------------------------------------------- the risk register
// L = likelihood 1–5 (1 rare … 5 certain), I = impact 1–5 (1 trivial … 5 severe)
const CATS = [
 { id: 'S', name: 'Strategy and market risks', intro: 'Risks that come from the strategy itself and from how markets behave. None of these can be removed — only sized and planned for.', risks: [
  { id: 'S1', t: 'Live results weaker than the backtest', L: 5, I: 3,
    what: 'The 5 coins were chosen after seeing they did well. Picking coins blind with pre-2023 data, the average coin earned only +0.09R per trade from 2023 on, versus about +0.3R for SOL and ZEC. Expect live profit to be lower than the reports.',
    prevent: ['Plan with +0.1R to +0.2R per trade, not +0.3R.', 'Start at $1–2 risk; scale up only after 6–12 months of live results.', 'Judge live results against the expected ranges on page {NORMAL}, not against the backtest totals.'] },
  { id: 'S2', t: 'The edge fades or stops working', L: 3, I: 4,
    what: 'Edges decay. On other coins it already happened (ETH, DOGE, XRP faded after 2023). ADA is near break-even in 2026; ZEC made only +$0.86 (at $1 risk) in all of 2023; SOL+ZEC went from +0.40R per trade before 2023 to +0.32R after.',
    prevent: ['Monthly review: rolling 12-month result per coin.', 'Pause a coin if its last 100 trades average below 0R, or its 12-month result is negative.', 'Never re-tune rules on recent losses (that is fitting to noise).'] },
  { id: 'S3', t: 'Long losing streaks', L: 5, I: 2,
    what: 'Certain to happen. Longest in 6.6 years: 9 in a row on one coin (ZEC, ADA, GALA), 12 for SOL+ZEC together, 20 for all 5 coins. SOL+ZEC had 5+ losses in a row about every 3.6 months and 8+ about once a year.',
    prevent: ['Fixed small risk per trade so a 12-loss streak costs about −12R ($12 at $1 risk).', 'Expect it; do not switch the bot off or change size during a streak.', 'Kill switch is set far beyond the worst streak (page {KILL}).'] },
  { id: 'S4', t: 'Deep and slow drawdowns', L: 4, I: 3,
    what: 'Worst fall from a high: SOL+ZEC −14.6R, all 5 coins −25.6R. Recovery took a median of about 9 trades (~1 month) but up to 218 days (Oct 2022 → Jun 2023). Roughly 1 month in 3 is a loss even when the strategy works.',
    prevent: ['Capital sized to absorb 2× the worst drawdown.', 'Warning and stop levels set in advance (page {KILL}).', 'Evaluate on 6–12 months, never on one bad month.'] },
  { id: 'S5', t: 'Choppy, directionless markets', L: 4, I: 2,
    what: 'Most losing streaks happen in sideways markets: price breaks out of the band, then falls back to the middle band. Late 2022, early 2023 and December 2025 were the worst periods.',
    prevent: ['Trading two (later five) coins spreads it out.', 'Filters were tested (whipsaw skip, break-even stops, loss-streak throttle) and all made results worse, so the rules accept chop rather than fight it.'] },
  { id: 'S6', t: 'Crash, gap or extreme candle', L: 2, I: 3,
    what: 'A sudden crash (like FTX in Nov 2022) can push price through the stop before it fills, so one loss is bigger than −1R. Worst single loss in the backtest: about −1.19R.',
    prevent: ['Stops are stop-market orders that always fill.', 'Risk per trade kept small so a −2R or −3R outlier is survivable.', 'Cross margin with spare balance so a spike cannot liquidate the position before the stop.'] },
  { id: 'S7', t: 'Coins losing together (correlation)', L: 4, I: 3,
    what: 'Crypto coins move together. With 5 coins, 20 losses in a row happened in only 19 days (Oct–Nov 2022). Up to 3 trades were open at the same time.',
    prevent: ['Account-level kill switch on the combined balance, not per coin only.', 'Cap on how many trades can be open at once.', 'Add coins one at a time.'] },
  { id: 'S8', t: 'Backtest bias / overfitting', L: 3, I: 3,
    what: 'Rules were tuned on 2019–2022 BTC, ETH and SOL, so SOL’s early years are in-sample. A backtest can look better than reality if rules are fitted to the past.',
    prevent: ['Rules frozen since 20 Oct 2026; tested on 2023+ data and on coins never used for tuning.', 'No-look-ahead test: 0 mismatches in ~160,000 orders; independent bot replay matched SOL and ZEC trade for trade.', 'Live trades compared with the backtest replay every week.'] },
  { id: 'S9', t: 'Funding fee spikes', L: 2, I: 1,
    what: 'Longs pay funding every 8 hours when rates are positive. Over 6.6 years funding cost −8.6R against +224.8R profit on SOL+ZEC; worst single trade −0.76R.',
    prevent: ['Funding logged per trade.', 'Alert if the rate stays above 0.1% per 8 hours for several days.', 'Even 10× the historical funding would have left the strategy clearly profitable.'] },
  { id: 'S10', t: 'Trading costs rise', L: 2, I: 2,
    what: 'Your MEXC rates (ZEC 0%, SOL ~0.01%) can change. Results are not very sensitive: doubling fees and slippage keeps about 90% of the profit; 0.08% fees + 0.05% slippage still made +41% on SOL+ZEC in 2026 at $5 risk.',
    prevent: ['Bot reads the fee rate from the API at start-up and logs it.', 'Monthly check of fees actually paid versus expected.'] },
 ] },
 { id: 'M', name: 'Money and position-size risks', intro: 'Risks that come from how much is put in and how big each trade is. These are fully in our control.', risks: [
  { id: 'M1', t: 'Risk per trade too big for the account', L: 3, I: 5,
    what: '$5 risk on a $100 coin is 5% per trade. Starting at the worst moment, ZEC’s $100 would have dropped to about $22 before recovering. A bigger risk turns normal streaks into account-breaking losses.',
    prevent: ['Start at $1–2 risk per trade on $100 per coin.', 'Raise risk only by the written rule on page {KILL} (after months of matching results).', 'Never above 5% of a coin’s starting balance per trade.'] },
  { id: 'M2', t: 'Order size rounding on MEXC', L: 5, I: 2,
    what: 'MEXC trades SOL and ZEC in steps of about $11–13. At $1 risk a position is only $15–21, so real risk per trade swings between about $0.50 and $1.70.',
    prevent: ['Use $2+ risk so rounding matters less.', 'Bot logs the real risk of every trade after rounding.', 'Skip a trade if rounding pushes risk above 1.5× the target.'] },
  { id: 'M3', t: 'Liquidation before the stop', L: 1, I: 5,
    what: 'With too little margin or too much leverage, the exchange can close the position before the stop is reached and take the margin.',
    prevent: ['Cross margin with the full $100 per coin behind positions of about $15–130.', 'Leverage setting low; bot checks the liquidation price is far beyond the stop before every entry.'] },
  { id: 'M4', t: 'Changing size on emotion', L: 3, I: 4,
    what: 'Raising risk after wins (“it works!”) or after losses (“win it back faster”) is the most common way traders turn a working strategy into a loss.',
    prevent: ['Risk is a setting in a config file, changed only at the monthly review, by the written rule.', 'Every change is logged with a date and reason.'] },
  { id: 'M5', t: 'Running costs bigger than profit', L: 3, I: 2,
    what: 'At $1 risk, SOL+ZEC made about +$32 a year in the backtest. A rented server at about $5/month (~$60/year) would cost more than that.',
    prevent: ['Start on a free option (home PC that stays on, or a free-tier server).', 'Move to a paid server only when the profit at the chosen risk clearly covers it.'] },
  { id: 'M6', t: 'Needing the money during a drawdown', L: 2, I: 4,
    what: 'Withdrawing in the middle of a drawdown locks in the loss and misses the recovery (recovery can take months).',
    prevent: ['Only put in money that can stay untouched for 12 months.', 'Keep savings off the exchange.'] },
 ] },
 { id: 'E', name: 'Execution and technical risks', intro: 'Risks from the bot, the server and the connection to the exchange. Most are prevented by how the bot is written; all are tested in practice mode and the small live phase.', risks: [
  { id: 'E1', t: 'Late entry', L: 3, I: 2,
    what: 'The bot reacts seconds or minutes after the 4h candle closes and price has already moved, so the entry is worse than planned.',
    prevent: ['Always-on machine with an accurate clock; runs a few seconds after each close (00, 04, 08, 12, 16, 20 UTC).', 'Skip if price has moved more than ¼ of the stop distance from the open, or already passed the stop or target.', 'Each trade logs planned vs actual entry so the cost of lateness is measured.'] },
  { id: 'E2', t: 'Missed signal (bot or internet down)', L: 3, I: 2,
    what: 'A restart, power cut or internet loss at the candle close means a signal is missed or acted on very late.',
    prevent: ['On restart the bot acts only on signals less than 15 minutes old.', 'Daily “still alive” message; alert if no heartbeat.', 'Open trades stay protected because stop and target sit on MEXC.'] },
  { id: 'E3', t: 'Stop or target not placed after entry', L: 2, I: 5,
    what: 'The worst technical failure: the entry fills but the stop order fails, leaving a position with no protection.',
    prevent: ['Stop and target placed immediately after the fill, then read back from MEXC to confirm they exist.', 'Retry; if still missing after a few seconds, close the position at market and send an alert.', 'Checked again at every 4h run.'] },
  { id: 'E4', t: 'Duplicate orders', L: 2, I: 4,
    what: 'A retry or restart sends the same order twice, opening two positions instead of one.',
    prevent: ['Before any action the bot reads MEXC’s actual positions and open orders; it never trusts its own memory alone.', 'Unique order IDs per signal so MEXC rejects repeats.', 'One position per coin maximum, enforced in code.'] },
  { id: 'E5', t: 'Order rejected', L: 3, I: 2,
    what: 'Size below minimum, wrong position mode (MEXC error 7002), leverage or margin mismatch, insufficient balance.',
    prevent: ['Start-up check of position mode (one-way), margin type and leverage.', 'Every rejection logged with the exchange message and sent as an alert.'] },
  { id: 'E6', t: 'Bad candle data', L: 2, I: 3,
    what: 'Acting on a candle that has not closed yet, a missing candle, or a wrong price from the API can create a false signal.',
    prevent: ['Only fully closed candles are used (the forming one is dropped).', 'Gap and sanity checks before deciding; skip the run if data looks wrong.'] },
  { id: 'E7', t: 'Clock or time-zone mistakes', L: 2, I: 2,
    what: 'A wrong clock or time zone makes the bot check at the wrong time or misread which candle closed.',
    prevent: ['All times in UTC.', 'Clock synced automatically; bot compares its time with MEXC server time at start-up.'] },
  { id: 'E8', t: 'Stop slippage', L: 3, I: 2,
    what: 'In fast markets a stop-market order fills past the stop price. Normal slippage is already in the backtest; spikes are rarer and bigger.',
    prevent: ['Logged per trade (planned vs actual exit).', 'Risk per trade small enough that a −1.5R loss is fine.'] },
  { id: 'E9', t: '8-day time exit not executed', L: 2, I: 1,
    what: 'If the bot is down when a trade reaches 48 candles, the position stays open longer than the rules say.',
    prevent: ['Stop and target still protect it on MEXC.', 'On restart the bot closes any trade older than 48 candles immediately.'] },
  { id: 'E10', t: 'Partial fills and API timeouts', L: 2, I: 2,
    what: 'An order only partly fills, or the API does not answer in time, so the bot does not know the true position.',
    prevent: ['After every order the bot reads back the real position size and sizes stop/target to it.', 'Timeouts retried with backoff; rate limits respected.'] },
  { id: 'E11', t: 'Bot logic differs from the backtest', L: 2, I: 3,
    what: 'A bug makes the live bot take different trades than the tested strategy.',
    prevent: ['Bot reuses the same calculation as the tested backtest.', 'Practice mode for 1–2 weeks: every signal compared with the backtest replay.', 'Weekly live-vs-replay check during the live phase.'] },
  { id: 'E12', t: 'Software or server breaks', L: 2, I: 2,
    what: 'A library update, full disk, crashed process or power cut stops the bot silently.',
    prevent: ['Library versions pinned; updates tested in practice mode first.', 'Process auto-restarts; heartbeat alert if silent.'] },
 ] },
 { id: 'X', name: 'Exchange risks (MEXC)', intro: 'Risks from depending on one exchange. Some can only be limited by keeping exposure small.', risks: [
  { id: 'X1', t: 'MEXC turns the futures API off again', L: 2, I: 3,
    what: 'MEXC’s futures order API was “under maintenance” from July 2022 until 31 March 2026. It could happen again.',
    prevent: ['Open trades stay protected by stop and target on MEXC.', 'Bot code written on a common library so it can move to Binance or Bybit by changing settings.'] },
  { id: 'X2', t: 'Outage or maintenance', L: 3, I: 2,
    what: 'MEXC had a futures maintenance window on 25 June 2026. During an outage no new trades and no time exits happen.',
    prevent: ['Bot retries after the outage and re-checks every open position.', 'Stop and target already on the exchange.'] },
  { id: 'X3', t: 'Exchange freeze or failure', L: 1, I: 5,
    what: 'An exchange can freeze withdrawals, restrict an account or fail (it has happened to large exchanges).',
    prevent: ['Keep only the trading capital on MEXC, never savings.', 'Withdraw profits regularly.'] },
  { id: 'X4', t: 'MEXC prices differ from Binance', L: 5, I: 1,
    what: 'All long-history research uses Binance candles. On MEXC’s own candles: 97% (SOL) and 94% (ZEC) of trades start on the same candle; in 2026, 41 of 42 per coin, with final balances within a few cents.',
    prevent: ['Bot trades on MEXC candles (the same exchange it orders on).', 'Weekly replay uses MEXC candles.'] },
  { id: 'X5', t: 'Contract changes or delisting', L: 2, I: 2,
    what: 'MEXC can change minimum size, leverage limits or delist a contract (EOS was delisted from Binance in 2025).',
    prevent: ['Contract details read from the API at start-up; bot stops trading a coin if they change unexpectedly.'] },
  { id: 'X6', t: 'Account or region restrictions', L: 2, I: 3,
    what: 'KYC requirements, country restrictions or API permission changes can block trading.',
    prevent: ['Complete KYC before going live.', 'Confirm the exchange is allowed in your country.'] },
 ] },
 { id: 'C', name: 'Security risks', intro: 'Risks of someone else getting access to the account or the bot.', risks: [
  { id: 'C1', t: 'API key leaked', L: 2, I: 4,
    what: 'Someone with the key could trade the account (e.g. to move prices or burn fees).',
    prevent: ['Key has trading permission only, withdrawals OFF.', 'Locked to the server’s IP address.', 'Stored only in a local .env file on the bot machine, never in code, chat, screenshots or git.'] },
  { id: 'C2', t: 'Exchange account taken over', L: 1, I: 5,
    what: 'Stolen password or email gives full control, including withdrawals.',
    prevent: ['Strong unique password, authenticator-app 2FA, withdrawal whitelist, anti-phishing code on MEXC.'] },
  { id: 'C3', t: 'Malicious software or fake tools', L: 1, I: 4,
    what: 'Unofficial “MEXC SDKs that bypass maintenance” and similar tools exist; installing them can steal keys.',
    prevent: ['Only well-known open-source libraries, pinned versions.', 'No third-party bot services holding the keys.'] },
  { id: 'C4', t: 'Phishing', L: 2, I: 4,
    what: 'Fake emails or sites asking you to log in or “verify” the API key.',
    prevent: ['Only log in through a saved bookmark; MEXC anti-phishing code checked on every email.'] },
 ] },
 { id: 'O', name: 'Human and operational risks', intro: 'Usually the biggest risks of all: what we do while the bot runs.', risks: [
  { id: 'O1', t: 'Turning the bot off in the middle of a drawdown', L: 4, I: 4,
    what: 'Stopping after a losing streak locks in the loss and misses the recovery — the streak is when the strategy is most likely about to pay back.',
    prevent: ['Stop only by the written kill-switch rule (page {KILL}), never by feeling.', 'Re-read the “normal ranges” on page {NORMAL} before any decision.'] },
  { id: 'O2', t: 'Manual interference', L: 3, I: 3,
    what: 'Closing winners early, moving stops, or taking extra trades by hand breaks the tested rules (the biggest profits come from trades held 6–8 days).',
    prevent: ['No manual trading on the bot account.', 'Every manual action logged and reviewed.'] },
  { id: 'O3', t: 'Silent failure nobody notices', L: 3, I: 3,
    what: 'The bot stops trading or trades wrongly for days without anyone looking.',
    prevent: ['Telegram message on every entry, exit and error, plus a daily heartbeat.', 'Weekly 10-minute check (page {MONITOR}).'] },
  { id: 'O4', t: 'Changing the rules after losses', L: 3, I: 3,
    what: 'Adjusting settings after a bad month fits the strategy to noise and usually makes it worse.',
    prevent: ['Rules frozen. Any change is tested on history first, then run in practice mode before it touches money.'] },
  { id: 'O5', t: 'Scaling up too fast', L: 3, I: 4,
    what: 'Adding coins, family money or bigger risk before the live track record exists multiplies any problem not yet found.',
    prevent: ['Phases with entry rules (page {PHASES}): own money first, family only after 3–6 matching months.'] },
 ] },
 { id: 'L', name: 'Legal, tax and family risks', intro: 'Risks outside the market and the code.', risks: [
  { id: 'L1', t: 'Managing other people’s money', L: 2, I: 5,
    what: 'Pooling and trading other people’s money for a fee usually needs a licence from the securities regulator.',
    prevent: ['Family uses their own exchange accounts and their own trade-only API keys; money never pooled.', 'No fees at first; check local rules before taking any share of profits.'] },
  { id: 'L2', t: 'Taxes', L: 3, I: 2,
    what: 'Trading profits can be taxable.',
    prevent: ['The bot journal keeps every trade, fee and funding payment for tax records.', 'Check local tax rules.'] },
  { id: 'L3', t: 'Family expectations', L: 3, I: 4,
    what: 'Family members who expected steady profits may react badly to a normal drawdown.',
    prevent: ['Show them the drawdown and streak numbers before they join; no promises of returns.', 'Written one-page agreement and monthly report from the journal.'] },
 ] },
];
const ALL = CATS.flatMap((c) => c.risks.map((r) => ({ ...r, cat: c.id })));
const score = (r) => r.L * r.I;
const level = (r) => (score(r) >= 15 ? ['High', C.redD, '#fbe3e2'] : score(r) >= 8 ? ['Medium', '#8a6200', '#fbf0d6'] : ['Low', C.greenD, '#dff3ea']);
const LW = ['', 'Rare', 'Unlikely', 'Possible', 'Likely', 'Certain'], IW = ['', 'Trivial', 'Minor', 'Moderate', 'Major', 'Severe'];

// ---------------------------------------------------------------- svg: risk matrix
function matrix(w = 680, h = 430) {
  const L = 90, T = 20, R = 10, B = 60, cw = (w - L - R) / 5, ch = (h - T - B) / 5;
  let g = `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">`;
  for (let l = 1; l <= 5; l++) for (let i = 1; i <= 5; i++) {
    const s = l * i, fill = s >= 15 ? '#f6c9c8' : s >= 8 ? '#f6e3b4' : '#cdebdd', x = L + (i - 1) * cw, y = T + (5 - l) * ch;
    g += `<rect x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" rx="5" fill="${fill}"/>`;
    const ids = ALL.filter((r) => r.L === l && r.I === i).map((r) => r.id);
    ids.forEach((id, k) => { const per = 4, row = Math.floor(k / per), col = k % per, bx = x + 8 + col * ((cw - 14) / per), by = y + 10 + row * 22;
      g += `<rect x="${bx}" y="${by}" width="${(cw - 14) / per - 4}" height="17" rx="4" fill="#fff" stroke="${C.axis}"/><text x="${bx + ((cw - 14) / per - 4) / 2}" y="${by + 11}" font-size="10.5" font-weight="700" text-anchor="middle" fill="${C.ink}">${id}</text>`; });
  }
  for (let l = 1; l <= 5; l++) g += `<text x="${L - 8}" y="${T + (5 - l) * ch + ch / 2 + 4}" font-size="10.5" text-anchor="end" fill="${C.ink2}">${LW[l]}</text>`;
  for (let i = 1; i <= 5; i++) g += `<text x="${L + (i - 1) * cw + cw / 2}" y="${h - B + 18}" font-size="10.5" text-anchor="middle" fill="${C.ink2}">${IW[i]}</text>`;
  g += `<text x="${L + (w - L - R) / 2}" y="${h - 12}" font-size="11" font-weight="700" text-anchor="middle" fill="${C.ink}">Impact if it happens →</text>`;
  g += `<text transform="translate(16 ${T + (h - T - B) / 2}) rotate(-90)" font-size="11" font-weight="700" text-anchor="middle" fill="${C.ink}">How likely →</text>`;
  return g + '</svg>';
}
// drawdown ladder: normal / warning / stop
function ladder(w = 680, h = 120) {
  const L = 20, R = 20, max = 32, xs = (v) => L + v / max * (w - L - R), y = 34, bh = 26;
  let g = `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">`;
  const seg = (a, b, fill, label) => `<rect x="${xs(a)}" y="${y}" width="${xs(b) - xs(a)}" height="${bh}" fill="${fill}"/><text x="${(xs(a) + xs(b)) / 2}" y="${y + 17}" font-size="11" font-weight="700" text-anchor="middle" fill="${C.ink}">${label}</text>`;
  g += seg(0, 15, '#cdebdd', 'Normal — keep going') + seg(15, 22, '#f6e3b4', 'Warning — review') + seg(22, 29, '#f6c9c8', 'Danger zone') + seg(29, 32, C.red, '');
  g += `<text x="${(xs(29) + xs(32)) / 2}" y="${y + 17}" font-size="11" font-weight="800" text-anchor="middle" fill="#fff">STOP</text>`;
  for (const v of [0, 5, 10, 15, 22, 29]) g += `<line x1="${xs(v)}" y1="${y + bh}" x2="${xs(v)}" y2="${y + bh + 6}" stroke="${C.ink2}"/><text x="${xs(v)}" y="${y + bh + 18}" font-size="10" text-anchor="middle" fill="${C.ink2}">−${v}R</text>`;
  g += `<line x1="${xs(14.6)}" y1="${y - 8}" x2="${xs(14.6)}" y2="${y + bh}" stroke="${C.ink}" stroke-dasharray="3 2"/><text x="${xs(14.6)}" y="${y - 12}" font-size="10" font-weight="700" text-anchor="middle" fill="${C.ink}">worst in 6.6 years: −14.6R</text>`;
  return g + `<text x="${L}" y="${h - 4}" font-size="9.5" fill="${C.muted}">SOL + ZEC drop from the account’s highest balance, in R (1R = your risk per trade: $1, $2 or $5).</text></svg>`;
}

// ---------------------------------------------------------------- pages
const pages = []; let pn = 0;
const page = (body, cls = '') => { pn++; pages.push(`<section class="page ${cls}">${body}<div class="foot"><span>${esc(TITLE)}</span><span>Page ${pn}</span></div></section>`); };
const pill = (r) => { const [t, col, bg] = level(r); return `<span class="pill" style="color:${col};background:${bg}">${t}</span>`; };
const riskCard = (r) => `<div class="risk"><div class="rh"><span class="rid">${r.id}</span><span class="rt">${esc(r.t)}</span>${pill(r)}<span class="li">Likelihood: <b>${LW[r.L]}</b> · Impact: <b>${IW[r.I]}</b></span></div>
<div class="rb"><div class="what"><div class="lab">What could happen</div>${esc(r.what)}</div><div class="prev"><div class="lab">How we prevent it</div><ul>${r.prevent.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div></div></div>`;

// 1. cover + summary
const top = [...ALL].sort((a, b) => score(b) - score(a) || b.I - a.I).slice(0, 10);
page(`<div class="kicker">Risk document · BB Breakout 4h · SOL + ZEC on MEXC · ${new Date().toISOString().slice(0, 10)}</div>
<h1>Running the BB Breakout bot with real money:<br><span>every risk we know of, and how each one is prevented</span></h1>
<p class="lead">This document lists ${ALL.length} risks in 7 groups — from the strategy itself to the bot, the exchange, security, our own behaviour and family money. For each: what could happen, how likely it is, how bad it would be, and the safeguard. It ends with the hard limits (kill switch), what “normal” looks like, the launch checklist and what to do when something goes wrong.</p>
<div class="cols2"><div class="card"><h3>The plan this document covers</h3><ul class="tight">
<li><b>Strategy:</b> BB Breakout on 4h candles — close outside Bollinger (20, 2) in the direction of the 200 average; stop at the middle band; target 4× the stop distance; close after 8 days.</li>
<li><b>Coins:</b> SOL and ZEC first; NEAR, ADA, GALA later.</li>
<li><b>Exchange:</b> MEXC USDT-M perpetual futures, bot via the official API.</li>
<li><b>Money:</b> $100 per coin. Risk per trade starts at <b>$1–2</b>; $5 only after the live record matches the backtest.</li>
<li><b>Bot:</b> stop and target placed on MEXC right after every entry and never moved.</li></ul></div>
<div class="card"><h3>The 10 most important risks</h3><table class="t mini"><tr><th>ID</th><th>Risk</th><th>Level</th></tr>
${top.map((r) => `<tr><td><b>${r.id}</b></td><td>${esc(r.t)}</td><td>${pill(r)}</td></tr>`).join('')}</table></div></div>
<div class="card sum"><h3>In one paragraph</h3><p>The strategy will have losing streaks (up to ~12 in a row on SOL+ZEC), losing months (about 1 in 3) and drawdowns that take weeks or months to recover — these are certain, not failures. The real dangers are things we control: risking too much per trade, a position left without its stop, switching the bot off in the middle of a drawdown, scaling up before a live record exists, and exchange/API problems. Each has a safeguard below, and the kill switch on page {KILL} decides when to stop — not emotion.</p></div>`, 'cover');

// 2. how to read + matrix
page(`<h2>Risk map</h2><p class="sub">Each box is one risk, placed by how likely it is and how bad it would be. Red = handle first, yellow = watch, green = minor. Risk IDs match the pages that follow.</p>
<div class="card">${matrix(760, 470)}</div><div class="cols3">
<div class="card"><h3>How to read the levels</h3><table class="t mini"><tr><th>Level</th><th>Meaning</th></tr>
<tr><td><span class="pill" style="color:${C.redD};background:#fbe3e2">High</span></td><td>Likely and/or severe. Has a hard rule or an automatic safeguard.</td></tr>
<tr><td><span class="pill" style="color:#8a6200;background:#fbf0d6">Medium</span></td><td>Will happen sometimes or hurts moderately. Monitored and reviewed.</td></tr>
<tr><td><span class="pill" style="color:${C.greenD};background:#dff3ea">Low</span></td><td>Rare or small. Logged; no special action.</td></tr></table></div>
<div class="card"><h3>Groups</h3><table class="t mini"><tr><th>Group</th><th>Risks</th><th>High</th></tr>
${CATS.map((c) => `<tr><td><b>${c.id}</b> · ${esc(c.name)}</td><td>${c.risks.length}</td><td>${c.risks.filter((r) => score(r) >= 15).length}</td></tr>`).join('')}
<tr class="tot"><td><b>Total</b></td><td><b>${ALL.length}</b></td><td><b>${ALL.filter((r) => score(r) >= 15).length}</b></td></tr></table></div>
<div class="card"><h3>Words used</h3><ul class="tight small"><li><b>R</b> = one unit of risk per trade ($1 at $1 risk, $5 at $5 risk). A normal loss is about −1R; a target hit is about +4R.</li>
<li><b>Drawdown</b> = fall from the highest balance so far to a later low.</li><li><b>Losing streak</b> = losing trades in a row.</li><li><b>Kill switch</b> = the pre-agreed point where the bot is stopped.</li></ul></div></div>`);

// 3+. register pages (packed)
const reg = []; let cur = [], h = 0; const HMAX = 7;  // cards per page; a group heading counts as ~half a card
const est = (r) => 1 + (r.prevent.length > 3 || r.what.length > 260 ? 0.15 : 0);
for (const c of CATS) {
  const head = { head: c }; if (h + 0.5 + est(c.risks[0]) > HMAX) { reg.push(cur); cur = []; h = 0; } cur.push(head); h += 0.5;
  for (const r of c.risks) { const e = est(r); if (h + e > HMAX) { reg.push(cur); cur = [{ head: c, cont: true }]; h = 0.3; } cur.push(r); h += e; }
}
if (cur.length) reg.push(cur);
for (const blk of reg) page(blk.map((x) => x.head ? `<div class="cath"><h2>${x.head.id} · ${esc(x.head.name)}${x.cont ? ' <span class="cont">(continued)</span>' : ''}</h2>${x.cont ? '' : `<p class="sub">${esc(x.head.intro)}</p>`}</div>` : riskCard(x)).join(''));

// kill switch & limits
const KILLP = pn + 1;
page(`<h2>Hard limits and the kill switch</h2><p class="sub">Decided now, in calm conditions, so no decision has to be made in the middle of a losing streak. Numbers for SOL + ZEC; R = risk per trade.</p>
<div class="card">${ladder()}</div>
<div class="cols2"><div class="card"><h3>Account limits (SOL + ZEC together)</h3><table class="t mini"><tr><th>Measure</th><th>History (6.6 yrs)</th><th>Warning → review</th><th>Stop the bot</th></tr>
<tr><td>Drop from highest balance</td><td>−14.6R</td><td>−15R</td><td><b>−29R</b> (2× worst)</td></tr>
<tr><td>Losing trades in a row</td><td>12</td><td>13</td><td><b>18</b></td></tr>
<tr><td>Result over any 12 weeks</td><td>worst −6.9R</td><td>below −7R</td><td>below −12R</td></tr>
<tr><td>Result over any 26 weeks</td><td>never below −0.6R (2023+)</td><td>below 0R</td><td>below −8R</td></tr>
<tr><td>Single-trade loss</td><td>worst −1.19R</td><td>below −1.5R</td><td>below −3R (investigate)</td></tr></table>
<p class="note">At $2 risk: stop at −$58 on $200. At $5 risk: stop at −$145 — which is why $5 is not the starting size.</p></div>
<div class="card"><h3>Per-coin and bot limits</h3><table class="t mini"><tr><th>Rule</th><th>Limit</th></tr>
<tr><td>Pause one coin if its drop from high exceeds</td><td>SOL −19R · ZEC −23R (1.5× its worst)</td></tr>
<tr><td>Pause one coin if last 100 trades average</td><td>below 0R</td></tr>
<tr><td>Max open trades per coin</td><td>1</td></tr>
<tr><td>Max total risk open at once</td><td>2R (SOL + ZEC); 5R later with 5 coins</td></tr>
<tr><td>Max risk per trade</td><td>5% of that coin’s starting balance</td></tr>
<tr><td>Stop/target not confirmed on MEXC</td><td>close the position immediately</td></tr>
<tr><td>Unknown API errors in one day</td><td>3 → bot pauses and alerts</td></tr>
<tr><td>Rounded risk above target</td><td>&gt; 1.5× → skip trade</td></tr></table></div></div>
<div class="card"><h3>When can risk go up?</h3><p>Only at a monthly review, and only if all are true: at least 3 months live (≈ 25+ trades per coin); live trades match the backtest replay (same signals, slippage within expectations); the account is within the normal zone; and the step is small ($1 → $2 → $3 → $5, at least a month apart). After any kill-switch stop, risk goes back to $1.</p></div>`);

// what normal looks like
page(`<h2>What “normal” looks like</h2><p class="sub">Use these before reacting to any result. Everything inside these ranges happened while the strategy was working. SOL + ZEC, in R.</p>
<div class="cols2"><div class="card"><h3>Expected result after… (simulation of 2023+ trades)</h3><table class="t mini"><tr><th>Period</th><th>~Trades</th><th>Bad (5%)</th><th>Typical</th><th>Good (95%)</th><th>Chance negative</th></tr>
<tr><td>4 weeks</td><td>8</td><td>−5.2R</td><td>+1.9R</td><td>+11.7R</td><td><b>35%</b></td></tr>
<tr><td>8 weeks</td><td>15</td><td>−6.0R</td><td>+4.5R</td><td>+17.8R</td><td>26%</td></tr>
<tr><td>12 weeks</td><td>23</td><td>−6.7R</td><td>+6.9R</td><td>+23.2R</td><td>21%</td></tr>
<tr><td>6 months</td><td>50</td><td>−4.9R</td><td>+15.5R</td><td>+38.5R</td><td>11%</td></tr>
<tr><td>1 year</td><td>100</td><td>+1.6R</td><td>+31.0R</td><td>+62.7R</td><td>4%</td></tr></table>
<p class="note">Below the “Bad (5%)” column for the period = warning: check execution first, then the market.</p></div>
<div class="card"><h3>Losing streaks — how often (SOL + ZEC)</h3><table class="t mini"><tr><th>Streak</th><th>Happened</th><th>About every</th></tr>
<tr><td>5+ losses in a row</td><td>22×</td><td>3.6 months</td></tr><tr><td>7+</td><td>10×</td><td>8 months</td></tr><tr><td>8+</td><td>7×</td><td>11 months</td></tr><tr><td>10+</td><td>2×</td><td>3.3 years</td></tr></table>
<h3 style="margin-top:8px">Recovery after a streak of 5+</h3><p>Typical: <b>9 trades / about 1 month</b>. Fastest: 2 trades / 3 days. Slowest: 62 trades / 218 days (Oct 2022 → Jun 2023).</p></div></div>
<div class="cols2"><div class="card"><h3>Other normal facts</h3><ul class="tight">
<li>Win rate about <b>39%</b> — most trades lose about −1R; about 1 in 6 hits the +4R target.</li>
<li>About <b>1 month in 3</b> is a loss; 15 of 46 months since 2023.</li>
<li>Average trade lasts about 4 days; the most profitable ones run the full 8 days.</li>
<li>Funding costs about 0.01–0.05R per trade; occasionally up to 0.76R on a long hold.</li></ul></div>
<div class="card"><h3>Signs something is actually wrong</h3><ul class="tight">
<li>Live trades do not match the replay (missing, extra or different trades).</li>
<li>Entries or stops consistently filling far from planned prices.</li>
<li>A position without its stop or target, even once.</li>
<li>Results below the “Bad (5%)” range for 12 weeks or more.</li>
<li>Any limit on page {KILL} reached.</li></ul></div></div>`);

// monitoring routine
page(`<h2>Monitoring routine</h2><p class="sub">Most of the work is automatic. The human part takes about 10 minutes a week and 30 minutes a month.</p>
<table class="t"><tr><th>When</th><th>Who / what</th><th>Check</th><th>Action if not OK</th></tr>
<tr><td><b>Every trade</b></td><td>Bot → Telegram</td><td>Entry price, stop, target, size, real risk after rounding; stop and target confirmed on MEXC</td><td>Bot closes the position if protection is missing; alert</td></tr>
<tr><td><b>Every 4 hours</b></td><td>Bot</td><td>Candle closed and valid; positions and orders on MEXC match the bot’s records; 8-day exits due</td><td>Fix the mismatch from MEXC’s state; alert</td></tr>
<tr><td><b>Daily</b></td><td>Bot → Telegram</td><td>“Still alive” heartbeat: balance, open trades, drawdown from high, errors today</td><td>No heartbeat by noon → check the machine</td></tr>
<tr><td><b>Weekly (10 min)</b></td><td>You (+ Claude replay)</td><td>Replay the same MEXC candles and compare trade by trade: missed/extra trades, entry and exit slippage, fees, funding</td><td>Any unexplained difference → pause new entries until explained</td></tr>
<tr><td><b>Monthly (30 min)</b></td><td>You</td><td>Result vs the “normal” table (page {NORMAL}); drawdown vs limits (page {KILL}); fees paid; per-coin 12-month result; risk-increase rule</td><td>Warning zone → keep size, review; stop zone → kill switch</td></tr>
<tr><td><b>Quarterly</b></td><td>You</td><td>Is the edge still there? Rolling 100-trade average per coin; decide adding coins or raising risk</td><td>Pause coins below 0R</td></tr></table>
<div class="cols2"><div class="card"><h3>What the bot journal records (every trade)</h3><ul class="tight small">
<li>Signal candle, direction, planned entry/stop/target</li><li>Actual entry fill, size after rounding, real risk in $</li><li>Stop/target order IDs and confirmation time</li>
<li>Exit reason (stop, target, 8-day), exit fill, slippage</li><li>Fees, funding payments, result in $ and R</li><li>Any errors, retries and restarts</li></ul></div>
<div class="card"><h3>Alerts that must reach your phone</h3><ul class="tight small"><li>Position without stop/target (and that it was closed)</li><li>Kill-switch or warning level reached</li>
<li>Order rejected / unknown API error</li><li>No heartbeat</li><li>Coin contract or fee changed</li><li>MEXC maintenance announced</li></ul></div></div>`);

// launch checklist + phases
page(`<h2>Before real money: launch checklist and phases</h2>
<div class="cols2"><div class="card"><h3>Checklist — every box ticked before phase 2</h3><table class="t mini check">
${['MEXC account: KYC done, authenticator 2FA, withdrawal whitelist, anti-phishing code',
  'API key: trading only, withdrawals OFF, locked to the bot machine’s IP, stored only in local .env',
  'Futures settings: one-way position mode, cross margin, low leverage; fee rate read from the API',
  'API test: open 1 ZEC contract, place stop + target, read them back, close — all by script',
  'Bot decides only on closed MEXC 4h candles, UTC clock synced',
  'Stop + target placed and confirmed after every fill; auto-close if missing (tested by forcing a failure)',
  'Restart test: kill the bot with an open trade → it recovers the state from MEXC with no duplicates',
  'Journal, Telegram alerts and daily heartbeat working',
  'Kill-switch and limit values from page {KILL} entered in the config',
  'Practice mode ran 1–2 weeks; every signal matched the backtest replay',
  'Capital on MEXC = only the trading money ($100 per coin); savings elsewhere',
  'Written plan: risk size, kill switch, review dates'].map((x) => `<tr><td class="box">☐</td><td>${esc(x)}</td></tr>`).join('')}</table></div>
<div class="card"><h3>Phases</h3><table class="t mini"><tr><th>Phase</th><th>What</th><th>Move on when</th></tr>
<tr><td><b>1. Practice</b><br>1–2 weeks</td><td>Bot live on MEXC data, no orders; logs what it would do</td><td>All signals match the replay; no bot errors</td></tr>
<tr><td><b>2. Small live</b><br>3 months</td><td>SOL + ZEC, $100 each, $1–2 risk</td><td>Live trades match the replay; slippage within expectations; within normal ranges</td></tr>
<tr><td><b>3. Full size</b></td><td>Step risk up to $5 (monthly steps)</td><td>3+ months clean at each step</td></tr>
<tr><td><b>4. More coins</b></td><td>Add NEAR, ADA, GALA one at a time</td><td>6+ months clean on SOL + ZEC</td></tr>
<tr><td><b>5. Family</b></td><td>Own accounts, own trade-only keys, small risk, no fees</td><td>3–6 months of your own live record shown to them</td></tr></table>
<p class="note">Any kill-switch stop sends the plan back to phase 2 at $1 risk after the cause is understood.</p></div></div>`);

// incident playbook
const play = [
  ['Position has no stop or target', 'Bot closes it at market automatically. You: confirm on MEXC app it is closed; read the error; do not restart new entries until the cause is fixed.'],
  ['Bot stopped / no heartbeat', 'Open trades are still protected on MEXC. Restart the bot; it rebuilds state from MEXC and closes any trade older than 8 days. Check the journal for missed signals.'],
  ['MEXC down or in maintenance', 'Do nothing manually. Stops and targets stay on the exchange. After it is back, the bot re-checks every position.'],
  ['MEXC disables the futures API', 'Existing trades finish via their stop/target. Stop new entries. Decide whether to move the bot to Binance or Bybit (settings change + new practice week).'],
  ['Warning level reached (page {KILL})', 'Keep the bot running at the same size. Check execution (replay match, slippage) first. Write down what the market is doing. No rule changes.'],
  ['Kill switch reached', 'Bot stops opening trades; open trades finish normally. Full review: replay match, costs, market regime. Restart only at $1 risk, and only if execution was correct.'],
  ['Live trades differ from replay', 'Pause new entries. Find the cause (data, timing, rounding, bug). Fix, test in practice mode, then resume.'],
  ['API key may be exposed', 'Delete the key on MEXC immediately (open trades keep their stop/target). Create a new key with the same limits; check the account history.'],
  ['Unexpected big loss on one trade', 'Check whether it was a gap past the stop (normal in crashes) or an execution problem (late, wrong size, missing stop). Log it.'],
  ['You feel like switching it off', 'Re-read page {NORMAL}. If no limit on page {KILL} is reached and execution matches the replay, the bot keeps running.'],
];
page(`<h2>Incident playbook — if this happens, do this</h2><p class="sub">Written in advance so every problem has a calm, pre-decided answer.</p>
<table class="t play"><tr><th style="width:26%">Situation</th><th>What to do</th></tr>${play.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join('')}</table>
<div class="card sum" style="margin-top:10px"><h3>The three rules that matter most</h3><ol class="tight"><li><b>Never a position without its stop.</b> The bot closes anything unprotected.</li>
<li><b>Never change size or rules because of how a week felt.</b> Only the monthly review, only by the written rules.</li>
<li><b>Stop only at the kill switch.</b> Everything before it is normal for this strategy.</li></ol></div>
<p class="note">Sources: research/bollinger — bb-deep.js and near-deep.js (realistic costs incl. funding), live-parity.js (no look-ahead, bot replay), mexc-check.js (MEXC vs Binance), 2026 MEXC-candle simulation (21 Oct 2026). MEXC API status: official futures API changelog (maintenance ended 31 Mar 2026). This is a planning document, not financial advice; past results do not guarantee future results.</p>`);

// ---------------------------------------------------------------- html → pdf
const css = `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; } html, body { margin: 0; background: #e9e8e4; color: ${C.ink}; font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; padding: 13mm 13mm 14mm; background: ${C.surface}; margin: 8px auto; position: relative; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 25px; margin: 6px 0 10px; line-height: 1.2; } h1 span { font-size: 16px; font-weight: 500; color: ${C.ink2}; }
h2 { font-size: 18px; margin: 0 0 3px; } h3 { font-size: 11.5px; margin: 0 0 5px; }
.kicker { font-size: 10px; letter-spacing: .07em; text-transform: uppercase; color: ${C.muted}; font-weight: 700; }
.lead { font-size: 11.5px; line-height: 1.55; color: ${C.ink2}; margin: 0 0 10px; }
.sub { font-size: 10px; color: ${C.ink2}; margin: 0 0 7px; line-height: 1.45; } p { font-size: 10px; line-height: 1.5; margin: 0 0 4px; }
.note { font-size: 8.8px; color: ${C.muted}; margin-top: 5px; line-height: 1.4; }
.card { background: #fff; border: 1px solid ${C.grid}; border-radius: 8px; padding: 9px 11px; margin-bottom: 8px; } .card.sum { background: #f5f8fd; border-color: #cfdcf0; }
.cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; } .cols3 { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 9px; }
ul.tight, ol.tight { margin: 2px 0; padding-left: 16px; font-size: 10px; line-height: 1.5; } ul.tight li, ol.tight li { margin-bottom: 2px; } ul.small { font-size: 9.4px; }
table.t { width: 100%; border-collapse: collapse; font-size: 9.8px; } table.t th { font-size: 8.8px; color: ${C.ink2}; text-align: left; font-weight: 700; padding: 4px 5px; border-bottom: 1px solid ${C.axis}; vertical-align: bottom; }
table.t td { padding: 4px 5px; border-bottom: 1px solid ${C.grid}; vertical-align: top; line-height: 1.4; } table.mini { font-size: 9.4px; } table.mini td { padding: 3px 5px; }
tr.tot td { background: #f4f3ef; border-top: 1px solid ${C.axis}; }
table.check td.box { width: 18px; font-size: 13px; color: ${C.ink2}; } table.play td { font-size: 10px; padding: 6px 6px; }
.pill { display: inline-block; font-size: 8.6px; font-weight: 800; border-radius: 99px; padding: 1px 8px; letter-spacing: .03em; white-space: nowrap; }
.cath { margin: 2px 0 5px; } .cath h2 { font-size: 15.5px; } .cont { font-size: 11px; font-weight: 500; color: ${C.muted}; }
.risk { background: #fff; border: 1px solid ${C.grid}; border-radius: 8px; margin-bottom: 7px; overflow: hidden; break-inside: avoid; }
.rh { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f7f6f3; border-bottom: 1px solid ${C.grid}; }
.rid { font-size: 10px; font-weight: 800; background: ${C.ink}; color: #fff; border-radius: 5px; padding: 1px 6px; } .rt { font-size: 11.5px; font-weight: 700; flex: 1; }
.li { font-size: 8.8px; color: ${C.ink2}; white-space: nowrap; }
.rb { display: grid; grid-template-columns: 1fr 1.05fr; gap: 12px; padding: 7px 10px 6px; font-size: 9.7px; line-height: 1.48; }
.lab { font-size: 8.4px; text-transform: uppercase; letter-spacing: .05em; font-weight: 800; color: ${C.muted}; margin-bottom: 2px; }
.prev ul { margin: 0; padding-left: 14px; } .prev li { margin-bottom: 2px; } .prev .lab { color: ${C.greenD}; }
.foot { position: absolute; bottom: 6mm; left: 13mm; right: 13mm; display: flex; justify-content: space-between; font-size: 8.3px; color: ${C.muted}; }
@media print { body { background: #fff; } .page { margin: 0; } }`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(TITLE)}</title><style>${css}</style>
<script>addEventListener('DOMContentLoaded',()=>{const m=location.hash.match(/p(\\d+)/);if(m){const n=+m[1];document.querySelectorAll('.page').forEach((p,i)=>{if(i!==n-1)p.style.display='none';else p.style.margin='0';});document.body.style.background='#fff';}});</script></head>
<body>${pages.join('\n')}</body></html>`.replace(/\{KILL\}/g, KILLP).replace(/\{NORMAL\}/g, KILLP + 1).replace(/\{MONITOR\}/g, KILLP + 2).replace(/\{PHASES\}/g, KILLP + 3);
fs.mkdirSync(PDF_DIR, { recursive: true });
const htmlPath = path.join(__dirname, 'risk-doc.html'), pdfPath = path.join(PDF_DIR, TITLE + '.pdf');
fs.writeFileSync(htmlPath, html);
const url = 'file:///' + htmlPath.replace(/\\/g, '/');
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', `--print-to-pdf=${pdfPath}`, url], { stdio: 'ignore' });
console.error('pages:', pages.length, '→', pdfPath);
if (process.argv.includes('--shots')) {
  const dir = process.env.SHOTS_DIR || path.join(__dirname, 'shots-risk'); fs.mkdirSync(dir, { recursive: true });
  for (let n = 1; n <= pages.length; n++) execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=794,1123', `--screenshot=${path.join(dir, `r${n}.png`)}`, `${url}#p${n}`], { stdio: 'ignore' });
  console.error('shots in', dir);
}
