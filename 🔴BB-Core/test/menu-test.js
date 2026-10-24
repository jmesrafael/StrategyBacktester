// test/menu-test.js - the VPS arrow-key menu (deploy/lucidio-menu.sh), final design (design/menu-design.html): logo, status / account / clock / candle-close rows with a
// countdown bar, grouped items, selection bar, key hints, the fallbacks for small windows, the live clock, the header states and the "Trading details" screen.
// The real script is sourced in bash; nothing is installed, no network, no sudo, no bot.
//   node test/menu-test.js        needs bash (Git Bash on Windows is found automatically); skipped with a message when there is none
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const MENU = path.join(__dirname, '..', 'deploy', 'lucidio-menu.sh').replace(/\\/g, '/');
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const bash = ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find((p) => fs.existsSync(p)) || 'bash';
const run = (script, env = {}) => cp.spawnSync(bash, ['-c', script], { encoding: 'utf8', env: { ...process.env, LUCIDIO_MENU_NOMAIN: '1', LUCIDIO_MENU_NOSUDO: '1', TERM: 'xterm', LUCIDIO_MENU_ROWS: '40', LUCIDIO_MENU_COLS: '80', ...env }, timeout: 40000 });
if (run('echo ok').error) { console.log('SKIP  no bash available on this machine: the menu cannot be tested here'); process.exit(0); }
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g, plain = (s) => s.replace(ANSI, '');
const epoch = (iso) => Math.floor(Date.parse(iso) / 1000);
const ESC = String.fromCharCode(92) + '033';           // the text \033 for printf
const ITEMS = 'ITEMS=(shell "Open a normal command line" update "Pull changes from GitHub" status "Bot status" balance "Account balance" trades "Trades and skipped signals" details "Trading details" equity "Equity over time" check "Health check" log "Recent log" follow "Live log  (Ctrl+C to stop)" server "Server health and installed code" tg "Send a Telegram test message" kill "Kill switch  (on / off)" restart "Restart the bot" exit "Disconnect")';
const HDR = 'ST_WORD="Bot is active"; ST_CLS=green; STATS=("0 trades" "0.00R"); ACC="Account (Live): \\$52.31 (0.5% Risk)"';
const NOW = epoch('2026-10-24T03:56:00Z');
const drawAt = (env = {}, keys = `sleep 0.4; printf '${ESC}'`, pre = '') => run(`source "${MENU}"; ${HDR}; ${ITEMS}; ${pre} LUCIDIO_NOW=${NOW} menu_select < <(${keys})`, env).stdout;
const boxLines = (out) => plain(out).split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => /^\s*[│╭├╰|+]/.test(l));
const w = (l) => Array.from(l.trim()).length;
const clk = (iso, env = {}) => run(`source "${MENU}"; LUCIDIO_NOW=${epoch(iso)} clock_rows; printf '%s|%s|%s|%s|%s|%s' "$CLK_LBL" "$CLK_LOC" "$CLK_UTC" "$CLOSE_TXT" "$CLOSE_CD" "$BAR_FILLED"`, env).stdout;

// ---------------- the clock rows and the countdown
ok(clk('2026-10-24T03:56:00Z') === 'PH|11:56am|3:56am|Candle Close 4:00am UTC (12:00pm PH)|0h 04m|12', `3:56am UTC -> ${clk('2026-10-24T03:56:00Z')}`);
ok(clk('2026-10-24T00:03:00Z') === 'PH|8:03am|12:03am|Candle Close 4:00am UTC (12:00pm PH)|3h 57m|0', `12:03am UTC: 3h 57m left, bar empty -> ${clk('2026-10-24T00:03:00Z')}`);
ok(clk('2026-10-24T02:00:00Z') === 'PH|10:00am|2:00am|Candle Close 4:00am UTC (12:00pm PH)|2h 00m|6', 'half way through the candle: 2h 00m left, bar half full (6 of 12)');
ok(clk('2026-10-24T08:00:00Z') === 'PH|4:00pm|8:00am|Candle Close 12:00pm UTC (8:00pm PH)|4h 00m|0', 'exactly at a close, the NEXT close is shown (12:00pm UTC, 8:00pm PH), 4h 00m left');
ok(clk('2026-10-24T23:59:59Z') === 'PH|7:59am|11:59pm|Candle Close 12:00am UTC (8:00am PH)|0h 00m|12', 'just before midnight UTC: next close 12:00am UTC (8:00am PH)');
ok(/^UTC-5\|10:56pm\|3:56am\|Candle Close 4:00am UTC \(11:00pm UTC-5\)/.test(clk('2026-10-24T03:56:00Z', { LUCIDIO_MY_UTC_OFFSET: '-5' })), 'another offset is labelled UTC-5 instead of PH');

// ---------------- the full frame (tall window): the design
const full = drawAt(), L = boxLines(full), P = L.map((l) => l.trim());
const at = (t) => P.findIndex((l) => l.includes(t));
ok(P.some((l) => l.includes('██║     ██║   ██║██║     ██║██║  ██║  ╚╝ ╚═╝ █████╗')) && at('by: Bugimann') > 0, 'tall window: the 6-row logo and "by: Bugimann" are shown');
ok(at('Bot is active') > at('by: Bugimann') && at('Account (Live): $52.31 (0.5% Risk)') === at('Bot is active') + 1 && at('PH 11:56am │ UTC 3:56am') === at('Bot is active') + 2 && at('Candle Close 4:00am UTC (12:00pm PH)') === at('Bot is active') + 3, 'rows in order: status, account, clock, candle close');
ok(/│ Bot is active │ 0 trades │ 0.00R +│$/.test(L.find((l) => l.includes('Bot is active'))) && /Candle Close 4:00am UTC \(12:00pm PH\) +━{12} 0h 04m │$/.test(L.find((l) => l.includes('Candle Close'))), 'status row "Bot is active │ 0 trades │ 0.00R"; candle row has the bar and "0h 04m" right-aligned');
ok(P.filter((l) => l.startsWith('├')).length === 5, 'rules: under the header, one in front of each of the 3 groups, and one before the key hints');
const items = ['Open a normal command line', 'Pull changes from GitHub', 'Bot status', 'Account balance', 'Trades and skipped signals', 'Trading details', 'Equity over time', 'Health check', 'Recent log', 'Live log  (Ctrl+C to stop)', 'Server health and installed code', 'Send a Telegram test message', 'Kill switch  (on / off)', 'Restart the bot', 'Disconnect'];
const idx = items.map((t) => at(t)); const ruleAt = P.map((l, i) => (l.startsWith('├') ? i : -1)).filter((i) => i >= 0);
ok(idx.every((i) => i > 0) && idx.join() === [...idx].sort((a, b) => a - b).join() && ruleAt[1] === idx[0] - 1 && ruleAt[2] === idx[2] - 1 && ruleAt[3] === idx[12] - 1, 'groups: Tools (command line, pull), Monitor (status ... Telegram test), Control (kill switch, restart, disconnect), each started by a rule');
ok(!/MEXC|SOL|ZEC/.test(plain(full)), 'the main screen shows no "MEXC" and no coin names');
ok(plain(full).includes('Account balance') && plain(full).includes('Trading details') && !plain(full).includes('MEXC account balance'), 'the items are "Account balance" and the new "Trading details"');
ok(P.some((l) => l.includes('↑↓ Move    Enter Ok    Esc Exit')) && !plain(full).includes('Up/Down'), 'footer: ↑↓ Move    Enter Ok    Esc Exit');
const foot = L.find((l) => l.includes('Enter Ok')), left = foot.indexOf('│') + 2, text = '↑↓ Move    Enter Ok    Esc Exit';
ok(Math.abs((foot.indexOf(text) - left) - (foot.lastIndexOf('│') - 2 - (foot.indexOf(text) + text.length))) <= 1, 'the key hints are centred in the frame');
ok(new Set(L.map(w)).size === 1, `every frame row is the same width (${[...new Set(L.map(w))].join(',')}) over ${L.length} rows`);
ok(/\x1b\[1m\x1b\[38;2;253;228;8mCandle Close 4:00am UTC \(12:00pm PH\)/.test(full) && /\x1b\[1m\x1b\[38;2;253;228;8m━{12}/.test(full), 'candle close text and the filled bar are yellow (#FDE408, bold)');
ok(/\x1b\[1m\x1b\[48;2;22;198;12m\x1b\[38;2;6;36;10m▶ Open a normal command line {10,}/.test(full), 'the selected row is a full-width green bar with a ▶ (dark text on #16C60C)');
ok((full.match(/\x1b\[38;2;231;72;86m(Kill switch|Restart the bot|Disconnect)/g) || []).length === 3, 'the three Control items are red when not selected');
ok(/\x1b\[38;2;155;255;138m██/.test(full) && /\x1b\[38;2;16;165;8m█/.test(full) && /\x1b\[38;2;11;92;7m[╗╔╝╚║═]/.test(full), 'the logo fades from light to dark green row by row, with darker shadow strokes');
const killSel = drawAt({}, `sleep 0.3; for i in 1 2 3 4 5 6 7 8 9 10 11 12; do printf '${ESC}[B'; done; sleep 0.3; printf '${ESC}'`);
ok(/\x1b\[1m\x1b\[48;2;231;72;86m\x1b\[38;2;26;3;6m▶ Kill switch/.test(killSel), 'moving down 12 rows: the Kill switch bar is red');

// ---------------- the status colours and the header rows
const st = (cls, word) => drawAt({}, `sleep 0.3; printf '${ESC}'`, `ST_WORD="${word}"; ST_CLS=${cls};`);
ok(/\x1b\[38;2;231;72;86mBot is stopped/.test(st('red', 'Bot is stopped')) && /\x1b\[1m\x1b\[38;2;253;228;8mKill switch is on/.test(st('yellow', 'Kill switch is on')) && /\x1b\[1m\x1b\[38;2;22;198;12mBot is active/.test(full), 'status word colours: stopped red, kill switch on yellow, active green');
const app = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-app-')); fs.mkdirSync(path.join(app, 'journal')); fs.mkdirSync(path.join(app, 'state'));
const hdr = (sys, extra = '') => run(`source "${MENU}"; APP="${app.replace(/\\/g, '/')}"; systemctl() { echo ${sys}; }; refresh_header; printf '%s|%s|%s|%s' "$ST_WORD" "$ST_CLS" "\${STATS[*]}" "$ACC"; ${extra}`).stdout;
ok(hdr('active') === 'Bot state unknown|yellow||Account: not available' || hdr('active').startsWith('Bot is active|green|'), 'no files yet: the header has less in it, and nothing breaks');
fs.writeFileSync(path.join(app, 'bot-config.json'), '{"mode":"live","riskPct":0.005}'); fs.writeFileSync(path.join(app, 'journal', 'snapshots.jsonl'), JSON.stringify({ equity: 52.31 }) + '\n');
fs.writeFileSync(path.join(app, 'state', 'state.json'), JSON.stringify({ totalR: 2.5, coins: { SOL: { n: 1, trades: [] }, ZEC: { n: 2, trades: [] } } }));
ok(hdr('active') === 'Bot is active|green|3 trades 2.50R|Account (Live): $52.31 (0.5% Risk)', `header from the bot's files: ${hdr('active')}`);
fs.writeFileSync(path.join(app, 'state', 'state.json'), JSON.stringify({ totalR: 0, coins: { SOL: { n: 1, trades: [] }, ZEC: { n: 0, trades: [] } } }));
ok(hdr('active').includes('|1 trade 0.00R|'), 'singular: "1 trade"');
fs.writeFileSync(path.join(app, 'STOP'), '');
ok(hdr('active').startsWith('Kill switch is on|yellow|'), 'the STOP file (kill switch) shows "Kill switch is on" in yellow');
ok(hdr('inactive').startsWith('Bot is stopped|red|') && hdr('failed').startsWith('Bot is stopped|red|'), 'a service that is not running shows "Bot is stopped" in red (even with the kill switch on)');
fs.unlinkSync(path.join(app, 'STOP')); fs.writeFileSync(path.join(app, 'journal', 'snapshots.jsonl'), ''); fs.writeFileSync(path.join(app, 'bot-config.json'), '{"mode":"paper","riskPct":0.01}');
ok(hdr('active').endsWith('Account (Paper): n/a (1.0% Risk)'), 'no equity snapshot yet: "n/a"; paper mode and 1.0% risk are shown');

// ---------------- the window sizes: logo, then text title, then a scrolling list
const frame = (rows, cols = 80, env = {}) => boxLines(drawAt({ LUCIDIO_MENU_ROWS: String(rows), LUCIDIO_MENU_COLS: String(cols), ...env }));
const f37 = frame(37), f36 = frame(36), f30 = frame(30), f27 = frame(27), f26 = frame(26), f22 = frame(22), f18 = frame(18);
ok(f37.some((l) => l.includes('by: Bugimann')) && !f37.some((l) => l.includes('more below')) && f37.filter((l) => l.trim().startsWith('├')).length === 5, 'a 37-row window: the logo and all 15 items in their three groups');
ok(f36.some((l) => l.includes('by: Bugimann')) && f30.some((l) => l.includes('by: Bugimann')) && f27.some((l) => l.includes('by: Bugimann')) && !f26.some((l) => l.includes('by: Bugimann')) && f26.some((l) => l.includes("Lucid'io Bot")), 'windows of 27 to 36 rows keep the logo; 26 or fewer rows show the text title');
ok(f30.some((l) => l.includes('more below')) && f30.some((l) => l.includes('▶')) && f30.filter((l) => l.includes('█')).length >= 5, 'a default 30-row window: the logo, a scrolling list with the selection visible, the footer says more below');
ok(f26.filter((l) => l.trim().startsWith('├')).length === 3 && f26.some((l) => l.includes('▶')), 'a 26-row window: text title and a flat scrolling list');
ok(f22.some((l) => l.includes('more below')) && f22.filter((l) => l.trim().startsWith('├')).length === 3 && f22.some((l) => l.includes('▶')), 'a 22-row window: a flat scrolling list, the footer says "more below", the selection is visible');
ok([f37, f36, f30, f22, f18].every((f) => new Set(f.map(w)).size === 1), 'every frame row has one width in every window size');
ok([[40, 37], [37, 37], [36, 36], [30, 30], [27, 27], [26, 26], [24, 24], [22, 22], [18, 18]].every(([r]) => { const f = frame(r); return f.length <= r - 1; }), 'the frame is never taller than the window (rows - 1) for 40, 37, 36, 30, 24, 22 and 18 rows');
ok(frame(40, 60).some((l) => l.includes('by: Bugimann')) && !frame(40, 56).some((l) => l.includes('by: Bugimann')) && frame(40, 56).some((l) => l.includes("Lucid'io Bot")), 'the logo needs a frame 56 wide (a 58-column window); narrower: text title');
ok(!frame(40, 80, { LUCIDIO_MENU_LOGO: 'off' }).some((l) => l.includes('by: Bugimann')), 'LUCIDIO_MENU_LOGO=off never shows the logo');
const ascii = drawAt({ LUCIDIO_MENU_ASCII: '1' }); const al = plain(ascii).split(/\r?\n/).filter((l) => /^\s*[|+]/.test(l));
ok(al.length > 10 && al.every((l) => /^[\x20-\x7e]*$/.test(l)) && al.some((l) => l.includes('> Open a normal command line')) && al.some((l) => l.includes('Up/Down Move')) && !al.some((l) => l.includes('by: Bugimann')), 'ASCII mode (also used on a terminal that is not UTF-8): plain + - | > only, no logo');
const c16 = drawAt({ LUCIDIO_MENU_COLOR: '16' }); ok(!c16.includes('38;2;') && !c16.includes('48;2;') && c16.includes('\x1b[1;93mCandle Close') && c16.includes('\x1b[1;30;102m'), 'LUCIDIO_MENU_COLOR=16: only 16-colour codes (for a terminal without 24-bit colour)');

// ---------------- live clock + keys
const live = run(`source "${MENU}"; ${HDR}; BASE=${epoch('2026-10-24T03:58:00Z')}; date() { if [ "$1" = "+%s" ]; then echo $((BASE + SECONDS * 60)); else command date "$@"; fi; }; ITEMS=(shell "Open a normal command line" exit "Disconnect");
  menu_select < <(sleep 3.6; printf '${ESC}')`).stdout;
const seen = [...plain(live).matchAll(/PH ([0-9:apm]+) │ UTC ([0-9:apm]+)/g)].map((m) => m[1] + ' ' + m[2]), cl = [...plain(live).matchAll(/Candle Close ([0-9:apm]+) UTC/g)].map((m) => m[1]), cd = [...plain(live).matchAll(/ (\dh \d\dm) │/g)].map((m) => m[1]);
ok(new Set(seen).size >= 3, `the clock updates by itself while nothing is pressed: ${[...new Set(seen)].join(' → ')}`);
ok(cl.includes('4:00am') && cl.includes('8:00am') && new Set(cd).size >= 3, `the next close rolls from 4:00am to 8:00am when the clock passes it, and the countdown moves (${[...new Set(cd)].join(', ')})`);
const key = (seq, tail = '') => plain(run(`source "${MENU}"; ${HDR}; ITEMS=(shell "Open" update "Pull" status "Status"); menu_select < <(sleep 0.3; ${seq}); echo "CHOICE=$CHOICE rc=$?"${tail}`).stdout);
ok(/CHOICE=update rc=0/.test(key(`printf '${ESC}[B'; sleep 0.3; printf '\\n'`)), 'Down then Enter chooses the second item');
ok(/CHOICE=status/.test(key(`printf '${ESC}[A'; sleep 0.3; printf '\\n'`)), 'Up from the first item wraps to the last');
ok(/CHOICE=update/.test(key(`printf 'j'; sleep 0.3; printf '\\n'`)), 'j / k work like the arrow keys');
ok(/rc=1/.test(key(`printf '${ESC}'`)) && /rc=1/.test(key(`printf 'q'`)), 'Esc and q leave the menu (return code 1)');

// ---------------- the Trading details screen (the per-coin numbers live here, not on the main screen)
const dapp = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-details-')); fs.mkdirSync(path.join(dapp, 'state'));
const t0 = epoch('2026-10-20T08:00:00Z');
fs.writeFileSync(path.join(dapp, 'state', 'state.json'), JSON.stringify({ mode: 'live', balance: 52.31, totalR: 0.5, peakR: 1.5, coins: {
  SOL: { lastTime: t0 + 4 * 14400, pos: null, trades: [{ dir: 1, t: t0, tExit: t0 + 14400 * 3, entry: 100, exit: 104, why: 'target', R: 1.5, usd: 1.5 }, { dir: -1, t: t0 + 14400 * 5, tExit: t0 + 14400 * 6, entry: 100, exit: 101, why: 'stop', R: -1, usd: -1 }] },
  ZEC: { lastTime: t0 + 4 * 14400, pos: { dir: 1, entry: 50, stop: 48, tp: 58, t0: t0 + 14400 * 6 }, trades: [] } } }));
const det = plain(run(`source "${MENU}"; APP="${dapp.replace(/\\/g, '/')}"; act_details`).stdout);
ok(det.includes('SOL: 2 trades | 1 win / 1 loss (50%) | +0.50R | $0.50 | average +0.25R'), 'Trading details: SOL has 2 trades, 1 win / 1 loss (50%), +0.50R, $0.50');
ok(det.includes('ZEC: 0 trades | 0 wins / 0 losses | +0.00R | $0.00') && det.includes('OPEN LONG entry 50.0000 stop 48.0000 target 58.0000 since Oct 21, 2026 8:00am UTC'), 'Trading details: ZEC has no trades and shows its open LONG with entry, stop and target');
ok(det.includes('flat (no open trade)') && det.includes('LONG ') && det.includes('target') && det.includes('+1.50R') && det.includes('-1.00R') && /Oct 2\d, 2026 \d{1,2}:\d\d[ap]m UTC/.test(det), 'Trading details: SOL is flat, the last trades are listed with exit reason, R and a 12-hour UTC time');
ok(det.includes('All coins: 2 trades | 1 win (50%) | +0.50R | $0.50') && det.includes('Mode LIVE | balance $52.31 | total +0.50R | below best point 1.0R'), 'Trading details: the totals line and the mode / balance line');
ok(plain(run(`source "${MENU}"; APP="/nonexistent/none"; act_details`).stdout).includes('No trading state yet.'), 'Trading details without a state file: a plain message');
ok(plain(run(`source "${MENU}"; APP="${dapp.replace(/\\/g, '/')}"; run_action details`).stdout).includes('All coins: 2 trades') && run(`source "${MENU}"; run_action nonsense; echo rc=$?`).stdout.includes('rc=2'), 'the action is wired (run_action details; --action details) and an unknown action is still refused');

// ---------------- the script itself
const src = fs.readFileSync(MENU.replace(/\//g, path.sep), 'utf8');
ok(/balance "Account balance"/.test(src) && /details "Trading details"/.test(src) && !/MEXC account balance/.test(src) && !/head_line "Account balance \(MEXC/.test(src), 'main menu list: "Account balance" (no MEXC in its name or its heading) and "Trading details"');
ok(run(`bash -n "${MENU}"`).status === 0 && /read -rsn1 -t 1 key/.test(src), 'the script parses and reads keys with a one-second timeout (the live redraw)');

// ---------- the update progress display ----------
const pgr = run(`source "${MENU}"; pg_init; PG_N=0; PG_TOTAL=3; pg_step "Switching to the new code" sleep 0.2; pg_step "Building" bash -c 'echo oops; exit 3'; echo "rc=$?"; pg_step "Last" true; pg_done`).stdout;
ok(/\[1\/3\] Switching to the new code \.\.\.\n\s+ok \(\d+s\)/.test(pgr) && /\[2\/3\] Building \.\.\.\n\s+FAILED/.test(pgr) && /rc=3/.test(pgr) && /\[3\/3\] Last/.test(pgr), 'update progress without a terminal: plain numbered lines, the failing step is FAILED and its exit code survives');
const pgt = plain(run(`source "${MENU}"; pg_init; PG_TTY=1; PG_N=0; PG_TOTAL=2; pg_step "Safety test: selftest" sleep 0.5; pg_step "Building the bundle" bash -c 'exit 1'; pg_done`).stdout);
ok(/✔ Safety test: selftest\s+\d+s/.test(pgt) && /✘ Building the bundle FAILED/.test(pgt), 'update progress on a terminal: a tick for a finished step, a cross for a failed one');
ok(/█/.test(pgt) && /100%/.test(pgt), 'the progress bar is drawn and ends at 100%');
const pgc = run(`source "${MENU}"; pg_init; PG_TTY=1; PG_N=0; PG_TOTAL=2; pg_step "x" sleep 0.4`).stdout;
ok(/\x1b\[38;2;22;198;12m/.test(pgc) && /\x1b\[1m\x1b\[38;2;253;228;8m/.test(pgc) && /\x1b\[\?25l/.test(pgc) && /\x1b\[\?25h/.test(pgc), 'the bar uses the menu colours (green done, yellow sweep) and the cursor is hidden while it runs and shown again');
const pga = plain(run(`source "${MENU}"; pg_init; PG_TTY=1; PG_N=0; PG_TOTAL=1; pg_step "Plain step" true; pg_done`, { LUCIDIO_MENU_ASCII: '1' }).stdout);
ok(/OK Plain step/.test(pga) && /#{30} 100%/.test(pga) && !/[█✔]/.test(pga), 'ASCII terminals get OK and # instead of the tick and the block characters');
const upd = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'lucidio-menu.sh'), 'utf8');
ok(/pg_step "Safety test: \$t"/.test(upd) && /pg_step "Installing/.test(upd) && /pg_step "Building the bundle/.test(upd) && /setup-vps\.sh/.test(upd) && /rollback\.sh/.test(upd), 'the update still tests, builds, installs and can roll back (the progress display only wraps those steps)');

console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
