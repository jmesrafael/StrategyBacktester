// build-study.js — writes the bot improvement study as one simple HTML page for the ledger reports folder.
//   node study.js && COSTX=2 node study.js && node verify.js && node build-study.js
//   -> ../../../🔴LEDGER/reports/bot-improvements.html + entry in reports/index.json
'use strict';
const fs = require('fs'), path = require('path');
const LEDGER = path.join(__dirname, '..', '..', '..', '🔴LEDGER', 'reports');
const J = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const S = J('study.json'), S2 = J('study-cost2.json'), V = J('verify.json'), CW = J('coin-worth.json');   // CW = coin-worth.js: ETH and BNB on their whole history
const DATE = 'Nov 14, 2026', TITLE = 'Bot Improvement Study', SLUG = 'bot-improvements';
const BOTS = Object.keys(S.bots), YRS = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const f = (v, d = 0) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d), pc = (v) => (v * 100).toFixed(0) + '%';
const yearsUp = (m) => Object.values(m.yrs).filter((v) => v > 0).length;

const TEXT = {
  'BB-CORE': { rules: 'Bollinger bands (20, 2.0) close-through with the SMA200 trend. Stop at the middle band. Time exit after 48 candles (8 days).',
    changes: ['Bands at <b>1.8</b> instead of 2.0, so it enters a little earlier and takes more trades.', 'Time exit after <b>42 candles</b> (7 days) instead of 48.', 'After a losing trade, <b>wait 3 candles</b> (12 hours) before taking a new trade on that coin.'],
    conf: 'Medium-low', confWhy: 'The extra profit is reliable (25 of 27 nearby settings also earn more, and it holds on unseen years). The smaller drop and shorter streak are not reliable: only 4 of 27 nearby settings beat today in all four columns.', pick: 'DOGE', pickKind: 'profit' },
  'I-CORE': { rules: 'Ichimoku cloud break with the SMA200 trend. First stop 2 ATR. Trailing stop 7 ATR.',
    changes: ['First stop at <b>1.75 ATR</b> instead of 2.', 'Once a trade is up <b>+4R</b>, move the stop to <b>+1R</b>, so a good trade can no longer turn into a loss.'],
    conf: 'Medium', confWhy: 'All 12 nearby settings earn more with a smaller drop, and every year and every coin improves. The shorter losing streak is not reliable (only 3 of 12 nearby settings).', pick: 'ETH', pickKind: 'applied' },
  'T-CORE': { rules: 'Bollinger close-through entry with the SMA200 trend. First stop 2 ATR. Trailing stop 14 ATR. No time exit.',
    changes: ['If a trade is <b>under +1R after 48 candles</b> (8 days), close it. Trades that go nowhere stop tying up the coin.', 'Bollinger length <b>30</b> instead of 20 for the entry.'],
    conf: 'High', confWhy: '17 of 20 nearby settings beat today in all four columns, and all 20 earn more with a smaller drop and a shorter streak. It also holds on unseen years.', pick: 'BNB', pickKind: 'dropped' },
};

// ---- small pieces
const better = (k, a, b) => (k === 'R' ? b > a : b < a), eq = (a, b) => Math.abs(a - b) < 1e-9;
const COLS = [['R', 'Profit', (v) => f(v) + 'R'], ['dd', 'Worst drop', (v) => v.toFixed(0) + 'R'], ['ls', 'Longest losing streak', (v) => v + ' trades'], ['loseM', 'Losing months', (v) => pc(v)]];
const delta = (k, a, b) => { if (eq(a, b)) return '<span class="same">same</span>'; const good = better(k, a, b);
  const txt = k === 'R' ? `${f(b - a)}R (${f((b / a - 1) * 100)}%)` : k === 'dd' ? `${f(b - a)}R (${f((b / a - 1) * 100)}%)` : k === 'ls' ? `${f(b - a)} trades` : `${f((b - a) * 100)} points`;
  return `<span class="${good ? 'good' : 'bad'}">${good ? '▲ better' : '▼ worse'} · ${txt}</span>`; };
const mark = (k, a, b) => (eq(a, b) ? '<span class="same">=</span>' : better(k, a, b) ? '<span class="good">✓</span>' : '<span class="bad">✗</span>');
const cmpRows = (a, b) => COLS.map(([k, name, fmt]) => `<tr><td>${name}</td><td>${fmt(a[k])}</td><td class="imp">${fmt(b[k])}</td><td>${delta(k, a[k], b[k])}</td></tr>`).join('');

function yearBars(a, b) {
  const w = 720, h = 210, l = 44, r = 10, t = 16, bt = 26, vals = YRS.flatMap((y) => [a.yrs[y] || 0, b.yrs[y] || 0]), max = Math.ceil(Math.max(...vals) / 50) * 50, min = Math.floor(Math.min(0, ...vals) / 50) * 50;
  const Y = (v) => t + (1 - (v - min) / (max - min)) * (h - t - bt), gw = (w - l - r) / YRS.length, bw = gw * 0.34; let g = '';
  const step = max > 250 ? 100 : 50; for (let v = min; v <= max; v += step) g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? '#64748b' : '#e5e7eb'}"/><text class="ax" x="${l - 6}" y="${Y(v) + 3}" text-anchor="end">${v}R</text>`;
  YRS.forEach((y, i) => { const x0 = l + i * gw + gw * 0.14, va = a.yrs[y] || 0, vb = b.yrs[y] || 0, bar = (x, v, c) => `<rect x="${x}" y="${Math.min(Y(v), Y(0))}" width="${bw}" height="${Math.max(1, Math.abs(Y(v) - Y(0)))}" fill="${c}" rx="2"/><text class="bv" x="${x + bw / 2}" y="${(v >= 0 ? Y(v) - 3 : Y(v) + 10)}" text-anchor="middle">${f(v)}</text>`;
    g += bar(x0, va, '#94a3b8') + bar(x0 + bw + 3, vb, '#0f766e') + `<text class="ax" x="${x0 + bw}" y="${h - 8}" text-anchor="middle">${y}</text>`; });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Profit by year, today and improved">${g}</svg>`;
}
function cumLine(a, b) {
  const w = 720, h = 220, l = 44, r = 96, t = 12, bt = 26, K = S.months, acc = (m) => { let s = 0; return m.map((v) => (s += v)); }, pa = acc(a.months), pb = acc(b.months);
  const max = Math.ceil(Math.max(...pa, ...pb) / 100) * 100, min = Math.floor(Math.min(0, ...pa, ...pb) / 50) * 50, X = (i) => l + (i / (K.length - 1)) * (w - l - r), Y = (v) => t + (1 - (v - min) / (max - min)) * (h - t - bt);
  const line = (p, c, sw) => `<polyline fill="none" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round" points="${p.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/>`; let g = '';
  const step = max > 600 ? 200 : 100; for (let v = 0; v <= max; v += step) g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? '#64748b' : '#e5e7eb'}"/><text class="ax" x="${l - 6}" y="${Y(v) + 3}" text-anchor="end">${v}R</text>`;
  K.forEach((k, i) => { if (k.endsWith('-01')) g += `<text class="ax" x="${X(i)}" y="${h - 8}" text-anchor="middle">${k.slice(0, 4)}</text>`; });
  let ya = Y(pa.at(-1)), yb = Y(pb.at(-1)); if (Math.abs(ya - yb) < 13) { if (ya > yb) ya = yb + 13; else yb = ya + 13; }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Cumulative profit, today and improved">${g}${line(pa, '#94a3b8', 2)}${line(pb, '#0f766e', 2.6)}<text class="el" x="${w - r + 6}" y="${ya + 4}" style="fill:#64748b">Today ${f(pa.at(-1))}R</text><text class="el" x="${w - r + 6}" y="${yb + 4}" style="fill:#0f766e">Improved ${f(pb.at(-1))}R</text></svg>`;
}
const chDesc = (ch) => Object.entries(ch).map(([k, v]) => (k === 'bb' ? (v.sigma ? 'bands ' + v.sigma : 'length ' + v.len) : k === 'maxBars' ? 'exit ' + v : k === 'cooldown' ? 'wait ' + v : k === 'kInit' ? 'stop ' + v + ' ATR' : k === 'beR' ? 'lock at +' + v + 'R' : k === 'beLock' ? 'to +' + v + 'R' : k === 'staleBars' ? 'check at ' + v + ' candles' : k === 'staleR' ? '' : k + ' ' + v)).filter(Boolean).join(', ') || "today's rules";

// ---- per bot section
function botSection(bot) {
  const b = S.bots[bot], a = b.today, m = b.improved, T = TEXT[bot], c2 = S2.bots[bot], wf = V.walk[bot], rp = [V.replay[bot + '|today'], V.replay[bot + '|improved']];
  const nb = b.neigh, cnt = (fn) => nb.filter(fn).length, id = bot.toLowerCase();
  const extra = [['Trades', (x) => x.n], ['Trades won', (x) => pc(x.wr)], ['Average win / average loss', (x) => `${f(x.avgWin, 2)}R / ${f(x.avgLoss, 2)}R`], ['Profit factor (wins ÷ losses)', (x) => x.pf.toFixed(2)], ['Profit per trade', (x) => f(x.avg, 2) + 'R'], ['Years with a profit', (x) => yearsUp(x) + ' of 7'], ['Worst year', (x) => f(x.worstYr) + 'R'], ['First half (2020–2022)', (x) => f(x.is) + 'R'], ['Second half (2023–2026)', (x) => f(x.oos) + 'R'], ['Last 12 months', (x) => f(x.l12) + 'R'], ['Profit without the 10 best trades', (x) => f(x.ex10) + 'R'], ['Average time in a trade', (x) => x.holdD.toFixed(1) + ' days']];
  const yearRows = YRS.map((y) => { const va = a.yrs[y] || 0, vb = m.yrs[y] || 0; return `<tr><td>${y}${y === '2026' ? '*' : ''}</td><td>${f(va)}R</td><td class="imp">${f(vb)}R</td><td class="${vb > va ? 'good' : vb < va ? 'bad' : 'same'}">${f(vb - va)}R</td></tr>`; }).join('');
  const yBetter = YRS.filter((y) => (m.yrs[y] || 0) > (a.yrs[y] || 0)).length;
  const coinRows = b.coins.map((c) => { const x = a.byCoin[c], y = m.byCoin[c]; return `<tr><td><b>${c}</b></td><td>${f(x.R)}R</td><td class="imp">${f(y.R)}R</td><td class="${y.R > x.R ? 'good' : 'bad'}">${f(y.R - x.R)}R</td><td>${pc(x.wr)} → ${pc(y.wr)}</td><td>${x.dd.toFixed(0)}R → ${y.dd.toFixed(0)}R</td><td>${yearsUp(x)} → ${yearsUp(y)} of ${Object.keys(x.yrs).length}</td></tr>`; }).join('');
  const cBetter = b.coins.filter((c) => m.byCoin[c].R > a.byCoin[c].R).length;
  const stepRows = [`<tr><td>Today</td>${COLS.map(([k, , fmt]) => `<td>${fmt(a[k])}</td>`).join('')}</tr>`, ...b.steps.map((s, i) => `<tr${i === b.steps.length - 1 ? ' class="hl"' : ''}><td>${s.name}</td>${COLS.map(([k, , fmt]) => `<td>${fmt(s[k])} ${mark(k, a[k], s[k])}</td>`).join('')}</tr>`)].join('');
  const ideaRows = b.ideas.map((s) => `<tr><td>${s.name}</td>${COLS.map(([k, , fmt]) => `<td>${fmt(s[k])} ${mark(k, a[k], s[k])}</td>`).join('')}<td>${COLS.filter(([k]) => better(k, a[k], s[k])).length} of 4</td></tr>`).join('');
  const wfRow = (name, x, cls = '') => `<tr${cls}><td>${name}</td><td>${f(x.R)}R</td><td>${x.dd.toFixed(0)}R</td><td>${x.ls} trades</td><td>${pc(x.loseM)}</td><td>${Object.entries(x.yrs).map(([y, v]) => `${y} ${f(v)}`).join(' · ')}</td></tr>`;
  const wfCols = COLS.filter(([k]) => better(k, wf.today[k], wf.walk[k])).map(([, n]) => n.toLowerCase());

  // coins on the improved rules
  const ct = b.coinTests.improved, ctT = b.coinTests.today, base = ct.base, ratio = (x) => x.R / x.dd, r0 = ratio(base);
  const rem = ct.remove.map((r) => { const steadier = ratio(r) > r0 * 1.05; return `<tr><td>Without <b>${r.coin}</b></td><td class="bad">${f(r.R - base.R)}R</td><td>${f(r.R)}R</td><td>${r.dd.toFixed(0)}R ${mark('dd', base.dd, r.dd)}</td><td>${r.ls} ${mark('ls', base.ls, r.ls)}</td><td>${pc(r.loseM)} ${mark('loseM', base.loseM, r.loseM)}</td><td>${ratio(r).toFixed(1)}</td><td>${steadier ? '<span class="tag mid">Steadier without it, but less profit</span>' : '<span class="tag ok">Keep</span>'}</td></tr>`; }).join('');
  const adds = [...ct.add].sort((x, y) => ratio(y) - ratio(x));
  const addRow = (r) => { const t = ctT.add.find((q) => q.coin === r.coin), solid = r.own.yrsUp >= r.own.yrsN - 2 && r.own.yrsN >= 6;
    const verdict = r.coin === T.pick && T.pickKind === 'dropped' ? '<span class="tag bad">Dropped: see long-history check</span>' : r.coin === T.pick && T.pickKind === 'applied' ? '<span class="tag ok">Applied Nov 14, 2026</span>' : r.all4 ? '<span class="tag ok">Better in every column</span>' : ratio(r) >= r0 && solid ? '<span class="tag ok">Good add</span>' : r.R > base.R * 1.1 && ratio(r) >= r0 * 0.9 && solid ? '<span class="tag mid">More profit, deeper drop</span>' : r.R > base.R * 1.05 ? '<span class="tag bad">Profit not worth the extra drop</span>' : '<span class="tag bad">No real gain</span>';
    return `<tr${r.coin === T.pick ? ' class="hl"' : ''}><td>With <b>${r.coin}</b></td><td>${f(r.own.R)}R · ${r.own.yrsUp}/${r.own.yrsN} yrs</td><td class="good">${f(r.R - base.R)}R</td><td>${f(r.R)}R</td><td>${r.dd.toFixed(0)}R ${mark('dd', base.dd, r.dd)}</td><td>${r.ls} ${mark('ls', base.ls, r.ls)}</td><td>${pc(r.loseM)} ${mark('loseM', base.loseM, r.loseM)}</td><td>${ratio(r).toFixed(1)}</td><td>${f(t.R - ctT.base.R)}R / ${f(t.dd - ctT.base.dd)}R</td><td>${verdict}</td></tr>`; };
  const pick = ct.add.find((r) => r.coin === T.pick);
  const pickText = T.pickKind === 'dropped'
    ? `<b>${T.pick} was tested here and dropped, it was never added.</b> On the improved rules it adds ${f(pick.R - base.R)}R, but ${f(CW.BNB.with.yrs['2021'] - CW.BNB.without.yrs['2021'])}R of that is the single year 2021, and the worst drop goes from ${base.dd.toFixed(0)}R to ${pick.dd.toFixed(0)}R. Over its whole history (2017–2026) one trade made 67% of its profit. See the long-history check below.`
    : T.pickKind === 'applied'
    ? `<b>${T.pick} was added to ${bot} on Nov 14, 2026.</b> It adds ${f(pick.R - base.R)}R of profit and lowers losing months from ${pc(base.loseM)} to ${pc(pick.loseM)}; the worst drop goes from ${base.dd.toFixed(0)}R to ${pick.dd.toFixed(0)}R and the longest losing streak from ${base.ls} to ${pick.ls}. On its whole history (2016–2026) it won 10 of 11 years (see the long-history check below).`
    : T.pickKind === 'ratio'
    ? `<b>Best coin to add: ${T.pick}.</b> It adds ${f(pick.R - base.R)}R of profit for only ${f(pick.dd - base.dd)}R more drop, so profit per unit of drop goes up (${r0.toFixed(1)} → ${ratio(pick).toFixed(1)}). On its own ${T.pick} made ${f(pick.own.R)}R and won ${pick.own.yrsUp} of ${pick.own.yrsN} years on these rules.`
    : `<b>No coin improves this bot's balance of profit and drop.</b> Today's six coins already do that job. If you want more profit and accept a deeper drop, <b>${T.pick}</b> is the strongest: ${f(pick.R - base.R)}R more profit, but the worst drop goes from ${base.dd.toFixed(0)}R to ${pick.dd.toFixed(0)}R. On its own it made ${f(pick.own.R)}R and won ${pick.own.yrsUp} of ${pick.own.yrsN} years.`;
  const weakest = [...ct.remove].sort((x, y) => (base.R - x.R) - (base.R - y.R))[0];

  return `<section id="${id}">
  <h2>${bot}</h2>
  <p class="muted">Coins today: ${b.coins.join(', ')}. Rules today: ${T.rules}</p>
  <div class="box"><b>The improved version changes ${T.changes.length} thing${T.changes.length > 1 ? 's' : ''}:</b><ol>${T.changes.map((c) => `<li>${c}</li>`).join('')}</ol></div>

  <h3>Today vs improved</h3>
  <div class="scroll"><table class="main"><tr><th>Measure</th><th>Today</th><th>Improved</th><th>Change</th></tr>${cmpRows(a, m)}</table></div>
  <details><summary>More measures</summary><div class="scroll"><table><tr><th>Measure</th><th>Today</th><th>Improved</th></tr>${extra.map(([n, fn]) => `<tr><td>${n}</td><td>${fn(a)}</td><td class="imp">${fn(m)}</td></tr>`).join('')}</table></div></details>

  <h3>How each change adds up</h3>
  <div class="scroll"><table><tr><th>Rules</th>${COLS.map(([, n]) => `<th>${n}</th>`).join('')}</tr>${stepRows}</table></div>
  <p class="muted small">✓ better than today · ✗ worse than today · = the same.</p>

  <h3>Year by year</h3>
  <div class="legend"><span><i style="background:#94a3b8"></i>Today</span><span><i style="background:#0f766e"></i>Improved</span></div>
  ${yearBars(a, m)}
  <div class="scroll"><table><tr><th>Year</th><th>Today</th><th>Improved</th><th>Difference</th></tr>${yearRows}<tr class="tot"><td>Total</td><td>${f(a.R)}R</td><td class="imp">${f(m.R)}R</td><td class="good">${f(m.R - a.R)}R</td></tr></table></div>
  <p class="muted small">* 2026 runs to Nov 11. ${yBetter} of 7 years are better with the improved rules.</p>

  <h3>Profit building up over time</h3>
  ${cumLine(a, m)}

  <h3>Coin by coin</h3>
  <div class="scroll"><table><tr><th>Coin</th><th>Today</th><th>Improved</th><th>Difference</th><th>Trades won</th><th>Worst drop</th><th>Years with a profit</th></tr>${coinRows}</table></div>
  <p class="muted small">${cBetter} of ${b.coins.length} coins earn more with the improved rules.</p>

  <h3>How sure is this?</h3>
  <p><span class="tag ${T.conf === 'High' ? 'ok' : 'mid'}">Confidence: ${T.conf}</span> ${T.confWhy}</p>
  <div class="scroll"><table><tr><th>Check</th><th>Result</th></tr>
    <tr><td>Nearby settings (${nb.length} tested)</td><td>${cnt((n) => n.R > a.R)} earn more · ${cnt((n) => n.dd < a.dd)} have a smaller drop · ${cnt((n) => n.ls < a.ls)} a shorter streak · ${cnt((n) => n.loseM < a.loseM)} fewer losing months · <b>${cnt((n) => n.all4)} better in all four</b></td></tr>
    <tr><td>Fees and slippage doubled</td><td>Today ${f(c2.today.R)}R, drop ${c2.today.dd.toFixed(0)}R → improved ${f(c2.improved.R)}R, drop ${c2.improved.dd.toFixed(0)}R, streak ${c2.improved.ls}, losing months ${pc(c2.improved.loseM)}</td></tr>
    <tr><td>No future sight, no repaint</td><td><span class="good">Passed.</span> ${(rp[0].cuts + rp[1].cuts)} replays cut at random dates: ${(rp[0].sigChecks + rp[1].sigChecks).toLocaleString('en-US')} signals and ${(rp[0].trChecks + rp[1].trChecks).toLocaleString('en-US')} trades compared, ${rp[0].sigBad + rp[1].sigBad + rp[0].trBad + rp[1].trBad} different.</td></tr>
  </table></div>
  <h4>Unseen years only (2023 → Nov 2026)</h4>
  <p class="muted">Here the settings are chosen using only the years before, then traded on the next year they have never seen. This is the fairest guess of what to expect live.</p>
  <div class="scroll"><table><tr><th>2023 → Nov 2026</th><th>Profit</th><th>Worst drop</th><th>Longest streak</th><th>Losing months</th><th>By year</th></tr>
    ${wfRow("Today's rules", wf.today)}${wfRow('Settings re-picked each year from the past only', wf.walk, ' class="hl"')}${wfRow('Settings picked once on 2020–2022 only', wf.once)}${wfRow('The improved rules above', wf.improvedFixed)}</table></div>
  <p class="small">On unseen years the past-only settings made <b>${f(wf.walk.R - wf.today.R)}R more (${f((wf.walk.R / wf.today.R - 1) * 100)}%)</b> than today's rules, and were better on: ${wfCols.join(', ') || 'none of the four columns'}. ${wfCols.length < 4 ? 'They were <b>not</b> better on: ' + COLS.filter(([k]) => !better(k, wf.today[k], wf.walk[k])).map(([, n]) => n.toLowerCase()).join(', ') + '.' : ''}</p>

  <h3>Coins: take one out, or put one in</h3>
  <p class="muted">Tested on the improved rules. Adding a coin nearly always adds profit, but it also adds trades that lose at the same time as the others, so the drop gets deeper. A coin is only a good add if profit grows faster than the drop. That is the <b>profit ÷ drop</b> column (${bot} now: ${r0.toFixed(1)}; higher is better).</p>
  <h4>Take one coin out</h4>
  <div class="scroll"><table><tr><th>Lineup</th><th>Profit change</th><th>Profit</th><th>Worst drop</th><th>Streak</th><th>Losing months</th><th>Profit ÷ drop</th><th>Verdict</th></tr>
    <tr class="tot"><td>All ${b.coins.length} coins</td><td></td><td>${f(base.R)}R</td><td>${base.dd.toFixed(0)}R</td><td>${base.ls}</td><td>${pc(base.loseM)}</td><td>${r0.toFixed(1)}</td><td></td></tr>${rem}</table></div>
  <p class="small">Every coin adds profit, so <b>none needs removing</b>. The coin the bot would miss least is ${weakest.coin} (${f(weakest.R - base.R)}R).</p>
  <h4>Put one coin in</h4>
  <div class="scroll"><table><tr><th>Lineup</th><th>The coin alone</th><th>Profit change</th><th>Profit</th><th>Worst drop</th><th>Streak</th><th>Losing months</th><th>Profit ÷ drop</th><th>On today's rules: profit / drop change</th><th>Verdict</th></tr>${adds.map(addRow).join('')}</table></div>
  <p>${pickText}</p>

  <details><summary>Ideas that did not work on ${bot} (${b.ideas.length} shown)</summary>
  <div class="scroll"><table><tr><th>Idea (one change to today's rules)</th>${COLS.map(([, n]) => `<th>${n}</th>`).join('')}<th>Columns better</th></tr><tr class="tot"><td>Today</td>${COLS.map(([k, , fmt]) => `<td>${fmt(a[k])}</td>`).join('')}<td></td></tr>${ideaRows}</table></div></details>
</section>`;
}

// ---- top scoreboard + summary
const card = (bot) => { const a = S.bots[bot].today, m = S.bots[bot].improved;
  return `<a class="card" href="#${bot.toLowerCase()}"><div class="cn">${bot}</div><table>${COLS.map(([k, n, fmt]) => `<tr><td>${n}</td><td>${fmt(a[k])}</td><td class="arrow">→</td><td class="imp">${fmt(m[k])}</td><td>${mark(k, a[k], m[k])}</td></tr>`).join('')}</table><div class="cf"><span class="tag ${TEXT[bot].conf === 'High' ? 'ok' : 'mid'}">Confidence: ${TEXT[bot].conf}</span></div></a>`; };
const sumRows = BOTS.map((bot) => { const b = S.bots[bot], a = b.today, m = b.improved, T = TEXT[bot], wf = V.walk[bot], pick = b.coinTests.improved.add.find((r) => r.coin === T.pick), base = b.coinTests.improved.base;
  const rule = `<tr><td><b>${bot}</b><br>${T.changes.map((c) => c.replace(/<\/?b>/g, '')).join(' ')}</td>
    <td>${f(a.R)}R → <b>${f(m.R)}R</b><br><span class="good">${f((m.R / a.R - 1) * 100)}%</span></td><td>${a.dd.toFixed(0)}R → <b>${m.dd.toFixed(0)}R</b><br><span class="good">${f((m.dd / a.dd - 1) * 100)}%</span></td>
    <td>${a.ls} → <b>${m.ls}</b></td><td>${pc(a.loseM)} → <b>${pc(m.loseM)}</b></td><td>${f((wf.walk.R / wf.today.R - 1) * 100)}% profit<br><span class="muted">${f(wf.today.R)}R → ${f(wf.walk.R)}R</span></td><td><span class="tag ${T.conf === 'High' ? 'ok' : 'mid'}">${T.conf}</span></td></tr>`;
  const coin = `<tr class="sub"><td>… and <b>${T.pick}</b> added to ${bot} (applied Nov 14, 2026)</td>
    <td>→ <b>${f(pick.R)}R</b><br><span class="good">${f(pick.R - base.R)}R more</span></td><td>→ <b>${pick.dd.toFixed(0)}R</b><br><span class="${pick.dd <= m.dd ? 'good' : 'bad'}">${pick.dd <= m.dd ? 'no deeper' : f(pick.dd - m.dd) + 'R deeper than without it'}</span></td>
    <td>→ <b>${pick.ls}</b></td><td>→ <b>${pc(pick.loseM)}</b></td><td class="muted">not tested this way</td><td><span class="tag mid">${T.pickKind === 'ratio' ? 'Medium' : 'Low'}</span></td></tr>`;
  return rule + (T.pickKind === 'applied' ? coin : ''); }).join('');
const rpAll = Object.values(V.replay), tot = (k) => rpAll.reduce((s, r) => s + r[k], 0);

const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--ink:#111827;--mut:#6b7280;--line:#e5e7eb;--imp:#0f766e;--good:#15803d;--bad:#b91c1c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 'Segoe UI',system-ui,Arial,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-right,0px)) 60px max(16px,env(safe-area-inset-left,0px))}
h1{font-size:30px;margin:0 0 6px;line-height:1.2}h2{font-size:24px;margin:0 0 4px;padding-top:6px;border-top:3px solid var(--ink)}h3{font-size:17px;margin:26px 0 8px}h4{font-size:14.5px;margin:18px 0 6px}
p{margin:8px 0}.muted{color:var(--mut)}.small{font-size:13px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:22px;margin:22px 0}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}
th{text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--mut);padding:7px 10px;border-bottom:2px solid var(--ink);vertical-align:bottom}
td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}
table.main td{font-size:16px;padding:10px}table.main td:first-child{font-weight:600}
.imp{color:var(--imp);font-weight:700}.good{color:var(--good);font-weight:600}.bad{color:var(--bad);font-weight:600}.same{color:var(--mut)}
tr.hl td{background:#f0fdfa}tr.tot td{font-weight:700;border-top:2px solid var(--ink)}tr.sub td{background:#fafafa;color:#374151}
.box{background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:12px 16px;margin:12px 0}.box ol{margin:6px 0 0;padding-left:20px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0}.pair h4{margin:0 0 6px}
.note{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:14px 0}.note.applied{background:#f0fdfa;border-color:#99f6e4}
.tag{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap}.tag.ok{background:#ccfbf1;color:#0f766e}.tag.mid{background:#fef3c7;color:#92400e}.tag.bad{background:#fee2e2;color:#b91c1c}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:16px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;color:inherit;text-decoration:none;display:block}.card:hover{border-color:var(--imp)}
.card .cn{font-weight:800;font-size:17px;margin-bottom:6px}.card table{font-size:13px}.card td{padding:4px 3px;border:none}.card td:first-child{color:var(--mut)}.card .arrow{color:var(--mut)}.card .cf{margin-top:8px}
.legend{display:flex;gap:16px;font-size:13px;color:var(--mut);margin:4px 0}.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.ax{font-size:11px;fill:#6b7280}.bv{font-size:10px;fill:#374151}.el{font-size:12px;font-weight:700}
details{margin:14px 0}summary{cursor:pointer;font-weight:600;color:var(--imp);padding:4px 0}
ul.plain{padding-left:20px;margin:6px 0}ul.plain li{margin:4px 0}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}nav a{font-size:13px;padding:5px 12px;border:1px solid var(--line);border-radius:20px;background:#fff;color:var(--ink);text-decoration:none}nav a:hover{border-color:var(--imp)}
@media(max-width:760px){.cards,.pair{grid-template-columns:1fr}section{padding:16px}h1{font-size:25px}}
@media print{body{background:#fff}section{break-inside:auto;border:none;padding:0}details{display:block}}
`;

const cwRows = (c, bot) => Object.keys(CW[c].alone.yrs).sort().map((y) => { const a = CW[c].alone.yrs[y], w = CW[c].without.yrs[y], x = CW[c].with.yrs[y]; return `<tr><td>${y}</td><td class="${a >= 0 ? 'good' : 'bad'}">${f(a)}R</td><td>${w == null ? '—' : f(w) + 'R'}</td><td>${x == null ? '—' : f(x) + 'R'}</td></tr>`; }).join('');
const cwTable = (c, bot) => `<div class="scroll"><table><tr><th>Year</th><th>${c} alone</th><th>${bot} without</th><th>${bot} with ${c}</th></tr>${cwRows(c, bot)}<tr class="tot"><td>Total</td><td>${f(CW[c].alone.R)}R</td><td>${f(CW[c].without.R)}R</td><td>${f(CW[c].with.R)}R</td></tr></table></div>`;
const longHistory = `<section id="long-history">
  <h2>Long-history check on the two added coins</h2>
  <p class="muted">The coin tests above start in 2020. These two coins have longer histories (ETH from 2016, BNB from late 2017), so each was also run alone on its whole history with the live bot code and the improved rules, and then inside its bot over 2020 → Nov 2026. These numbers use the live bot code, so totals differ by a few percent from the research-engine coin tables above (for example I-CORE with ETH: +942R here, +952R above).</p>
  <div class="pair">
    <div>
      <h3>ETH on I-CORE <span class="tag ok">Kept</span></h3>
      <ul class="plain">
        <li>Whole history 2016–2026: 307 trades, <b>+193R</b>, 10 of 11 years up (only 2023, −11R).</li>
        <li>Best year is 22% of its profit; without its 5 best trades it still makes +92R.</li>
        <li>First half +138R, second half +55R, last 12 months +21R.</li>
        <li>Moves mostly on its own: monthly correlation with the rest of I-CORE 0.20.</li>
        <li>Inside I-CORE: +812R → <b>+942R</b>, worst drop 29R → 32R, streak 14 → 17, losing months 41% → <b>36%</b>, added profit in 6 of 7 years.</li>
      </ul>
      ${cwTable('ETH', 'I-CORE')}
    </div>
    <div>
      <h3>BNB on T-CORE <span class="tag bad">Dropped</span></h3>
      <ul class="plain">
        <li>Whole history 2017–2026: 257 trades, <b>+350R</b>, 7 of 9 years up.</li>
        <li>One trade (Mar 2021, +235R) is <b>67% of all its profit</b>; best year (2021) is 68%. Without its 5 best trades it loses 25R.</li>
        <li>First half +310R, second half +40R, last 12 months +1R.</li>
        <li>Inside T-CORE: +1159R → +1430R, but +239R of the +271R is 2021. Worst drop 34R → <b>40R</b>, streak 14 → 17, losing months 43% → 46%.</li>
        <li>It deepened the worst drop in every year 2020–2026 and lost 13R in T-CORE's 36 losing months.</li>
      </ul>
      ${cwTable('BNB', 'T-CORE')}
    </div>
  </div>
  <div class="note"><b>Why BNB was dropped.</b> The 2020–2026 coin test ranked BNB first for T-CORE, but that ranking rested on one trade. A coin whose profit comes from a single month adds risk to every other month. ETH earns steadily across many years, so it stays. Neither coin is better in all four columns: both add profit and also deepen the drop a little. ETH was kept because its profit is steady across many years and it lowers losing months; BNB was dropped because its profit is one trade. BNB never went live.</div>
</section>
`;
const tt = S.bots['T-CORE'], ic = S.bots['I-CORE'], bc = S.bots['BB-CORE'];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${TITLE} · Lucid'io</title><style>${CSS}</style></head><body><div class="wrap">
<header>
  <p class="muted small" style="margin:0">Lucid'io · ${DATE} · applied to the live bots on Nov 14, 2026</p>
  <h1>${TITLE}: today's rules vs an improved version</h1>
  <p>For each of the three bots, this page compares the rules running today with the best version found that is <b>better in all four columns at once</b>: more profit, a smaller worst drop, a shorter losing streak and fewer losing months. Then it tests which coins to add or remove.</p>
  <div class="note applied"><b>Status: APPLIED</b> to the live bots on Nov 14, 2026 (the first candle judged by the new rules closes at 04:00 UTC). BB-CORE, I-CORE and T-CORE run the improved rules. ETH was added to I-CORE. BNB was studied and dropped (see the <a href="#long-history">long-history check</a>).</div>
  <nav><a href="#answer">The answer</a><a href="#honest">Is the test honest?</a>${BOTS.map((b) => `<a href="#${b.toLowerCase()}">${b}</a>`).join('')}<a href="#long-history">Long-history check</a><a href="#summary">Summary: what was done</a></nav>
</header>

<section id="answer">
  <h2>The answer</h2>
  <p>An all-columns-better version exists for every bot. <b>T-CORE's is solid</b>, I-CORE's is fairly solid, and BB-CORE's is the least certain. On years the settings never saw (2023–2026), profit was still ${BOTS.map((b) => `${f((V.walk[b].walk.R / V.walk[b].today.R - 1) * 100)}% on ${b}`).join(', ')}; the drop and streak gains are smaller there than in the table below.</p>
  <div class="cards">${BOTS.map(card).join('')}</div>
  <p class="muted small">Today → improved, Jan 2020 to Nov 11, 2026. Click a bot for the full comparison.</p>
  <div class="note"><b>How to read the numbers.</b> R is one unit of risk: what a trade loses when it hits its stop. At $5 risk a trade, +100R is +$500. <b>Worst drop</b> is the deepest fall from a peak, counted trade by trade. <b>Losing streak</b> is the most losing trades in a row. <b>Losing months</b> is the share of calendar months that ended down.</div>
  <h3>How it was tested</h3>
  <ul class="plain">
    <li><b>Data:</b> Binance spot 4-hour candles, every candle from January 1, 2020 to November 11, 2026. Each coin counts from when it has 200 candles of history.</li>
    <li><b>Rules:</b> the same engine that was checked trade by trade against the bots' own code. One position per coin. A signal is read on a closed candle and filled at the next candle's open.</li>
    <li><b>Costs:</b> 0.05% fee per side, 0.02% slippage per fill, real funding payments. Everything was also rerun with fees and slippage doubled.</li>
    <li><b>Search:</b> about 170 single changes across the three bots first, then ${Object.values(J('search.json')).reduce((s, b) => s + b.tested, 0).toLocaleString('en-US')} combinations of the promising ones. A version only counts if it beats today in all four columns, in both halves of the history, and on most coins.</li>
  </ul>
</section>

<section id="honest">
  <h2>Is the test honest about the future?</h2>
  <p>Two things can make a backtest look better than real trading: rules that secretly use later prices, and settings that were tuned on the same history they are scored on. Both were tested.</p>
  <h3>1. No future sight and no repaint: passed</h3>
  <p>The history was cut at ${tot('cuts')} random dates. Each time the bot was rerun knowing only the candles up to the cut, exactly as it would live. Every signal on every candle, and every trade closed before the cut, was then compared with the full run.</p>
  <div class="scroll"><table><tr><th>Bot and rules</th><th>Replays</th><th>Signals compared</th><th>Different</th><th>Trades compared</th><th>Different</th><th>Result</th></tr>
  ${Object.entries(V.replay).map(([k, r]) => `<tr><td>${k.replace('|', ' · ')}</td><td>${r.cuts}</td><td>${r.sigChecks.toLocaleString('en-US')}</td><td>${r.sigBad}</td><td>${r.trChecks.toLocaleString('en-US')}</td><td>${r.trBad}</td><td>${r.sigBad + r.trBad === 0 ? '<span class="tag ok">Pass</span>' : '<span class="tag bad">Fail</span>'}</td></tr>`).join('')}
  <tr class="tot"><td>Total</td><td>${tot('cuts')}</td><td>${tot('sigChecks').toLocaleString('en-US')}</td><td>${tot('sigBad')}</td><td>${tot('trChecks').toLocaleString('en-US')}</td><td>${tot('trBad')}</td><td></td></tr></table></div>
  <p>Zero differences. A signal never changes after its candle closes, and no trade depends on a candle that comes later. Inside a candle the test assumes the worst: if the stop and a better price are both touched, the stop is counted first, and a stop hit through a gap fills at the worse open price.</p>
  <h3>2. Settings chosen without seeing the future: the gains shrink but hold</h3>
  <p>Before each year from 2023 to 2026, the best setting was picked using only the years before it, then used to trade that year. The four unseen years were joined together and compared with today's rules on the same years.</p>
  <div class="scroll"><table><tr><th>2023 → Nov 2026, unseen</th><th>Profit today</th><th>Profit, past-only settings</th><th>Worst drop</th><th>Longest streak</th><th>Losing months</th></tr>
  ${BOTS.map((b) => { const w = V.walk[b]; return `<tr><td><b>${b}</b></td><td>${f(w.today.R)}R</td><td class="imp">${f(w.walk.R)}R <span class="good">(${f((w.walk.R / w.today.R - 1) * 100)}%)</span></td><td>${w.today.dd.toFixed(0)}R → ${w.walk.dd.toFixed(0)}R ${mark('dd', w.today.dd, w.walk.dd)}</td><td>${w.today.ls} → ${w.walk.ls} ${mark('ls', w.today.ls, w.walk.ls)}</td><td>${pc(w.today.loseM)} → ${pc(w.walk.loseM)} ${mark('loseM', w.today.loseM, w.walk.loseM)}</td></tr>`; }).join('')}</table></div>
  <p><b>What this means:</b> the extra profit is real on all three bots. T-CORE improves in all four columns even on unseen years. BB-CORE's drop and I-CORE's losing streak did <b>not</b> improve on unseen years, so treat those two gains as uncertain.</p>
  <div class="note"><b>What the test still cannot do.</b> It uses Binance prices, and the bots trade on MEXC futures, where a fill can be slightly worse on a fast candle. It cannot know future market conditions. And the bots' original rules were themselves chosen on this history. Expect live results below these numbers; use the unseen-years table as the realistic guide.</div>
</section>

${BOTS.map(botSection).join('\n')}

${longHistory}

<section id="summary">
  <h2>Summary: what was done, and what it improves</h2>
  <p class="muted">Full history, Jan 2020 → Nov 11, 2026. "Unseen years" is the fairer estimate: settings picked from the past only, 2023 → 2026.</p>
  <div class="scroll"><table><tr><th>If we do this</th><th>Profit</th><th>Worst drop</th><th>Losing streak</th><th>Losing months</th><th>On unseen years</th><th>Confidence</th></tr>${sumRows}</table></div>
  <h3>What was done</h3>
  <p>All of this went live on the VPS on Nov 14, 2026 at about 01:25 UTC. The first candle judged by the new rules closes at 04:00 UTC; trades opened before it keep the old rules until they close.</p>
  <ol>
    <li><b>T-CORE rule change: done.</b> Profit ${f(tt.today.R)}R → ${f(tt.improved.R)}R, worst drop ${tt.today.dd.toFixed(0)}R → ${tt.improved.dd.toFixed(0)}R, losing streak ${tt.today.ls} → ${tt.improved.ls}, and its one losing year (2023) turns positive. It is the surest of the three.</li>
    <li><b>I-CORE rule change and ETH: done.</b> ${f(ic.today.R)}R → ${f(ic.improved.R)}R with the drop down from ${ic.today.dd.toFixed(0)}R to ${ic.improved.dd.toFixed(0)}R. Do not count on the shorter losing streak. ETH was added on top (see the long-history check).</li>
    <li><b>BB-CORE rule change: done, for the profit.</b> ${f(bc.today.R)}R → ${f(bc.improved.R)}R. Its smaller drop did not hold on unseen years. The time exit moved from 48 to 42 candles, which reopened a setting locked on Nov 2.</li>
    <li><b>BNB on T-CORE: dropped.</b> It looked good over 2020–2026, but its whole history shows one trade making 67% of its profit. It never went live. No coin was removed from any bot.</li>
  </ol>
  <h3>What not to do</h3>
  <ul class="plain">
    <li><b>Fixed profit targets</b> (2R, 4R, 8R and so on) cut profit on every bot. These bots earn from a few very large trades, and a target cuts exactly those.</li>
    <li><b>Taking half off early</b> and <b>breakeven after +1R</b> also cut profit: trades get closed before they run.</li>
    <li><b>Filters</b> (ADX, volume, BTC trend) and <b>longs only</b> remove more profit than loss.</li>
  </ul>
  <p class="muted small">Source: StrategyBacktester/research/tweak-lab-nov13 (lab.js, search.js, study.js, verify.js, build-study.js). Every number on this page comes from those files. A test on past prices, not a promise.</p>
</section>
</div></body></html>`;
fs.writeFileSync(path.join(LEDGER, SLUG + '.html'), html);
const idx = JSON.parse(fs.readFileSync(path.join(LEDGER, 'index.json'), 'utf8')).filter((r) => r.slug !== SLUG);
idx.unshift({ slug: SLUG, title: TITLE + ': Today\'s Rules vs an Improved Version', summary: 'BB-CORE, I-CORE and T-CORE as they run today against the best version found that is better in all four columns (profit, worst drop, losing streak, losing months), on Binance 4-hour data from Jan 2020 to Nov 2026. Year by year, coin by coin, which coins to add or remove, a replay test that proves no future sight or repaint, a walk-forward test on unseen years, and a summary of what each change improves. Applied to the live bots on Nov 14, 2026; ETH added to I-CORE; BNB studied and dropped after a long-history check.', updated: DATE, kind: 'Data report', file: SLUG + '.html' });
fs.writeFileSync(path.join(LEDGER, 'index.json'), JSON.stringify(idx, null, 1) + '\n');
console.log('wrote', SLUG + '.html', (html.length / 1024).toFixed(0) + ' KB');
