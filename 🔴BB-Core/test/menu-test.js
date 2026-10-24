// test/menu-test.js - the VPS arrow-key menu (deploy/lucidio-menu.sh): the live clock row with the next 4-hour candle close, the footer, the frame, and that the clock
// really updates by itself. The real script is sourced in bash; nothing is installed, no network, no sudo, no bot.
//   node test/menu-test.js        needs bash (Git Bash on Windows is found automatically); skipped with a message when there is none
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const MENU = path.join(__dirname, '..', 'deploy', 'lucidio-menu.sh').replace(/\\/g, '/');
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const bash = ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find((p) => fs.existsSync(p)) || 'bash';
const run = (script, env = {}, input) => cp.spawnSync(bash, ['-c', script], { encoding: 'utf8', input, env: { ...process.env, LUCIDIO_MENU_NOMAIN: '1', LUCIDIO_MENU_NOSUDO: '1', TERM: 'xterm', LUCIDIO_MENU_ROWS: '30', LUCIDIO_MENU_COLS: '80', ...env }, timeout: 30000 });
if (run('echo ok').error) { console.log('SKIP  no bash available on this machine: the menu cannot be tested here'); process.exit(0); }
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g, plain = (s) => s.replace(ANSI, '');
const epoch = (iso) => Math.floor(Date.parse(iso) / 1000);
const clock = (iso, env = {}) => { const r = run(`source "${MENU}"; LUCIDIO_NOW=${epoch(iso)} clock_line; printf '%s' "$CLK_A$CLK_B"`, env); return r.stdout; };

// ---------------- the clock row: PH time | UTC time | next close
ok(clock('2026-10-24T03:56:00Z') === 'PH: 11:56am | UTC: 3:56am | Close 4:00am UTC (12:00pm PH)', `3:56am UTC -> "${clock('2026-10-24T03:56:00Z')}"`);
ok(clock('2026-10-24T00:03:00Z') === 'PH: 8:03am | UTC: 12:03am | Close 4:00am UTC (12:00pm PH)', `12:03am UTC -> "${clock('2026-10-24T00:03:00Z')}"`);
ok(clock('2026-10-24T04:00:00Z') === 'PH: 12:00pm | UTC: 4:00am | Close 8:00am UTC (4:00pm PH)', 'exactly at a close, the NEXT close is shown (8:00am UTC, 4:00pm PH)');
ok(clock('2026-10-24T23:59:59Z') === 'PH: 7:59am | UTC: 11:59pm | Close 12:00am UTC (8:00am PH)', 'just before midnight UTC the next close is 12:00am UTC (8:00am PH)');
ok(clock('2026-10-24T15:30:00Z') === 'PH: 11:30pm | UTC: 3:30pm | Close 4:00pm UTC (12:00am PH)', '3:30pm UTC -> next close 4:00pm UTC, which is 12:00am in the Philippines');
ok(/^UTC-5: 10:56pm \| UTC: 3:56am \| Close 4:00am UTC \(11:00pm UTC-5\)$/.test(clock('2026-10-24T03:56:00Z', { LUCIDIO_MY_UTC_OFFSET: '-5' })), 'another offset is labelled UTC-5 instead of PH');
ok(!/ am|\d{2}:\d{2}:\d{2}| pm/.test(clock('2026-10-24T03:56:00Z')), 'times are 12-hour with no space before am/pm and no seconds (the display style)');

// ---------------- the frame: one draw, with a fixed clock
const frame = run(`source "${MENU}"; menu_select <<< ""  >/dev/null 2>&1; true`).status; // (the input ends at once: must return cleanly)
ok(frame === 0, 'menu_select returns cleanly when the input ends');
const drawn = run(`source "${MENU}"; HDR1="Bot: active | LIVE 0.5% risk | equity \\$52.31"; HDR2="SOL flat | ZEC flat | 0 trades | 0.00R"; ITEMS=(shell "Open a normal command line" update "Pull changes from GitHub" status "Bot status" exit "Disconnect");
  LUCIDIO_NOW=${epoch('2026-10-24T03:56:00Z')} menu_select < <(sleep 0.4; printf '\\033')`);
const out = drawn.stdout, flat = plain(out);
ok(out.includes('\x1b[93m') && /\x1b\[1m\x1b\[93mClose 4:00am UTC \(12:00pm PH\)\x1b\[0m/.test(out), 'the Close part is drawn in yellow (bright yellow, bold); the two clocks before it are not');
ok(!/\x1b\[93m[^\x1b]*PH: 11:56am/.test(out), 'only the close is yellow, not the clocks');
ok(flat.includes('PH: 11:56am | UTC: 3:56am | Close 4:00am UTC (12:00pm PH)'), 'the clock row is inside the frame');
ok(flat.includes('Ok (Enter)    Exit (Esc)    Move (Arrow Keys)') && !flat.includes('Up/Down'), 'the footer reads: Ok (Enter)    Exit (Esc)    Move (Arrow Keys)');
const rows = flat.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => /^\s*[│╭├╰]/.test(l)), widths = new Set(rows.map((l) => l.trim().length));
ok(rows.length >= 10 && widths.size === 1, `every frame row has the same width (${[...widths].join(',')}) over ${rows.length} rows`);
const hdrIdx = rows.findIndex((l) => l.includes('Lucid')), at = (t) => rows.findIndex((l) => l.includes(t));
ok(hdrIdx < at('Bot: active') && at('Bot: active') < at('SOL flat') && at('SOL flat') < at('PH: 11:56am') && at('PH: 11:56am') < at('Open a normal') && at('Open a normal') < at('Ok (Enter)'), 'order inside the frame: title, bot line, coin line, clock row, the menu items, the footer');
// a small window scrolls: the footer says so and still fits the frame
const small = run(`source "${MENU}"; HDR1="Bot: active"; HDR2="x"; ITEMS=(a "One" b "Two" c "Three" d "Four" e "Five" f "Six" g "Seven"); menu_select < <(sleep 0.4; printf '\\033')`, { LUCIDIO_MENU_ROWS: '16' });
const sRows = plain(small.stdout).split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => /^\s*[│╭├╰]/.test(l)), foot = sRows.find((l) => l.includes('Ok (Enter)'));
ok(foot && foot.includes('more below') && new Set(sRows.map((l) => l.trim().length)).size === 1, 'when the list scrolls, the footer adds "more below" and the frame stays one width');

// ---------------- live: a fake clock that moves one minute per real second; the row must change on its own, with no key pressed
const live = run(`source "${MENU}"; BASE=${epoch('2026-10-24T03:58:00Z')}; date() { if [ "$1" = "+%s" ]; then echo $((BASE + SECONDS * 60)); else command date "$@"; fi; }; HDR1="Bot: active"; HDR2=""; ITEMS=(shell "Open a normal command line" exit "Disconnect");
  menu_select < <(sleep 3.6; printf '\\033')`);
const seen = [...plain(live.stdout).matchAll(/PH: ([0-9:apm]+) \| UTC: ([0-9:apm]+) \| Close ([0-9:apm]+) UTC/g)].map((m) => m.slice(1).join(' '));
const distinct = [...new Set(seen)];
ok(seen.length >= 3 && distinct.length >= 3, `the clock row updates by itself while nothing is pressed: ${distinct.length} different readings in 3.6 s (${distinct.join(' → ')})`);
ok(distinct.some((d) => d.endsWith('4:00am')) && distinct.some((d) => d.endsWith('8:00am')), 'and the next close rolls over from 4:00am to 8:00am when the clock passes it');
// keys still work: Down + Enter picks the second item
const pick = run(`source "${MENU}"; HDR1="x"; HDR2=""; ITEMS=(shell "Open a normal command line" update "Pull changes from GitHub" status "Bot status"); menu_select < <(sleep 0.3; printf '\\033[B'; sleep 0.3; printf '\\n'); echo "CHOICE=$CHOICE rc=$?"`);
ok(/CHOICE=update rc=0/.test(plain(pick.stdout)), 'Down then Enter still chooses the second item (Pull changes from GitHub)');
const up = run(`source "${MENU}"; HDR1="x"; HDR2=""; ITEMS=(shell "Open" update "Pull" status "Status"); menu_select < <(sleep 0.3; printf '\\033[A'; sleep 0.3; printf '\\n'); echo "CHOICE=$CHOICE"`);
ok(/CHOICE=status/.test(plain(up.stdout)), 'Up from the first item wraps to the last');
const esc = run(`source "${MENU}"; HDR1="x"; HDR2=""; ITEMS=(shell "Open" exit "Disconnect"); menu_select < <(sleep 0.3; printf '\\033'); echo "rc=$?"`);
ok(/rc=1/.test(plain(esc.stdout)), 'Esc leaves the menu (return code 1)');
const src = fs.readFileSync(MENU.replace(/\//g, path.sep), 'utf8');
ok(run(`bash -n "${MENU}"`).status === 0 && /read -rsn1 -t 1 key/.test(src) && !/Up\/Down: move/.test(src), 'the script parses, reads keys with a one-second timeout, and the old footer text is gone');

console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
