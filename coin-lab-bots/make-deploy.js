// make-deploy.js — derives the coin lab's deploy files from the news lab's (same isolation, same checks), minus the news gate.
//   node coin-lab-bots/make-deploy.js   ->  coin-lab-bots/deploy/{coinbb,cointc}.service, install-coin-lab.sh, status.sh, build-coin-lab.sh, COIN-LAB-INSTALL.template.md
// Every replacement must be found, or this stops (so a change in the news lab files is noticed).
'use strict';
const fs = require('fs'), path = require('path');
const N = path.join(__dirname, '..', 'news-lab-bots'), O = path.join(__dirname);
fs.mkdirSync(path.join(O, 'deploy'), { recursive: true });
function tr(src, pairs) {
  let s = fs.readFileSync(path.join(N, src), 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(`${src}: not found: ${a.slice(0, 90)}`); s = s.split(a).join(b); }
  return s;
}
const ISO = '-/opt/newsbb -/opt/newsic -/opt/newstc -/var/lib/newsbb -/var/lib/newsic -/var/lib/newstc -/etc/newsbb.env -/etc/newsic.env -/etc/newstc.env';
// --- services
const bbSvc = tr('deploy/newsbb.service', [
  ['# BB-CORE NEWS LAB PAPER bot (simulated money, no orders, no Telegram) with the NEWS GATE, next to the live bots, sharing nothing with them.', '# BB-CORE COIN LAB PAPER bot on ARB (simulated money, no orders, no Telegram), next to the live bots, sharing nothing with them.'],
  ['Installed by deploy/install-news-lab.sh. Its own user, code in /opt/newsbb (owned by root), data in /var/lib/newsbb. Dashboard tag: bbn.', 'Installed by deploy/install-coin-lab.sh. Its own user, code in /opt/coinbb (owned by root), data in /var/lib/coinbb. Dashboard tag: cbb.'],
  ['sudo systemctl status newsbb      sudo journalctl -u newsbb -f      sudo bash /opt/newsbb/deploy/status.sh', 'sudo systemctl status coinbb      sudo journalctl -u coinbb -f      sudo bash /opt/coinbb/deploy/status.sh coinbb'],
  ['Description=BB-CORE NEWS LAB PAPER bot with news gate (simulated, no orders, no Telegram)', 'Description=BB-CORE COIN LAB PAPER bot on ARB (simulated, no orders, no Telegram)'],
  ['# the news gate signal (fail-open: unreachable or stale = entries are not gated)\nEnvironment=NEWS_SIGNAL_URL=https://cryptobai.vercel.app/api/signal\n', ''],
  ['reports as its own bot (bbn)', 'reports as its own bot (cbb)'],
  ['/etc/newsbb.env (root only)', '/etc/coinbb.env (root only)'], ['EnvironmentFile=-/etc/newsbb.env', 'EnvironmentFile=-/etc/coinbb.env'],
  ['User=newsbb\nGroup=newsbb\nWorkingDirectory=/opt/newsbb\nExecStart=/usr/bin/node /opt/newsbb/lucidio.js loop', 'User=coinbb\nGroup=coinbb\nWorkingDirectory=/opt/coinbb\nExecStart=/usr/bin/node /opt/coinbb/lucidio.js loop'],
  ['SyslogIdentifier=newsbb', 'SyslogIdentifier=coinbb'],
  ['LUCIDIO_STATE_DIR=/var/lib/newsbb', 'LUCIDIO_STATE_DIR=/var/lib/coinbb'], ['LUCIDIO_KEYS=/var/lib/newsbb/no-keys.json', 'LUCIDIO_KEYS=/var/lib/coinbb/no-keys.json'], ['LUCIDIO_ENV_FILE=/var/lib/newsbb/no-env-file', 'LUCIDIO_ENV_FILE=/var/lib/coinbb/no-env-file'],
  ['ReadWritePaths=/var/lib/newsbb', 'ReadWritePaths=/var/lib/coinbb'],
  ['-/var/backups -/opt/newsic -/opt/newstc -/var/lib/newsic -/var/lib/newstc -/etc/newsic.env -/etc/newstc.env', '-/var/backups ' + ISO + ' -/opt/cointc -/var/lib/cointc -/etc/cointc.env'],
]);
fs.writeFileSync(path.join(O, 'deploy', 'coinbb.service'), bbSvc);
const tcSrc = fs.readFileSync(path.join(N, 'deploy', 'newstc.service'), 'utf8').replace(/\r\n/g, '\n');
let tcSvc = tcSrc;
const tcPairs = [
  [/T-CORE NEWS LAB PAPER bot[^\n]*with the NEWS GATE[^\n]*/, '# T-CORE COIN LAB PAPER bot on SUI + ARB (simulated money, no orders, no Telegram), next to the live bots, sharing nothing with them.'],
  [/^Description=.*$/m, 'Description=T-CORE COIN LAB PAPER bot on SUI + ARB (simulated, no orders, no Telegram)'],
  [/# the news gate signal[^\n]*\nEnvironment=NEWS_SIGNAL_URL=[^\n]*\n/, ''],
  [/newstc/g, 'cointc'], [/\btcn\b/g, 'ctc'], [/install-news-lab\.sh/g, 'install-coin-lab.sh'],
  [/-\/var\/backups[^\n]*/, null],
];
for (const [re, to] of tcPairs) { if (!re.test(tcSvc)) throw new Error('newstc.service: not found ' + re); if (to !== null) tcSvc = tcSvc.replace(re, to); }
tcSvc = tcSvc.replace(/^(InaccessiblePaths=.*-\/var\/backups)[^\n]*$/m, (m, a) => a + ' ' + ISO + ' -/opt/coinbb -/var/lib/coinbb -/etc/coinbb.env');
if (/news/i.test(tcSvc.replace(/-\/(opt|var\/lib|etc)\/news(bb|ic|tc)(\.env)?/g, ''))) throw new Error('cointc.service still mentions news: ' + tcSvc.match(/.*news.*/i));
fs.writeFileSync(path.join(O, 'deploy', 'cointc.service'), tcSvc);
if (/news/i.test(bbSvc.replace(/-\/(opt|var\/lib|etc)\/news(bb|ic|tc)(\.env)?/g, ''))) throw new Error('coinbb.service still mentions news: ' + bbSvc.match(/.*news.*/i));
// --- status.sh
let st = fs.readFileSync(path.join(N, 'deploy', 'status.sh'), 'utf8').replace(/\r\n/g, '\n');
st = st.replace(/newsbb\|newsic\|newstc/g, 'coinbb|cointc').replace(/newsbb newsic newstc/g, 'coinbb cointc').replace(/news lab/gi, 'coin lab').replace(/\bnews(bb|tc)\b/g, 'coin$1').replace(/\bnewsic\b/g, '');
fs.writeFileSync(path.join(O, 'deploy', 'status.sh'), st);
console.log('status.sh mentions of news left:', (st.match(/news/gi) || []).length);
console.log('wrote deploy/coinbb.service, deploy/cointc.service, deploy/status.sh');
