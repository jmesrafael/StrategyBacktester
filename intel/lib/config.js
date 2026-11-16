// config.js - reads intel/config.json and resolves its paths. Secrets never live in config.json:
// they come from environment variables or intel/secrets.local.json (ignored by git).
'use strict';
const fs = require('fs'), path = require('path');
const BASE = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(BASE, 'config.json'), 'utf8'));
const p = (rel) => (rel == null ? null : path.resolve(BASE, rel));
function secret(name) {
  if (process.env[name]) return process.env[name];
  const f = path.join(BASE, 'secrets.local.json');
  if (fs.existsSync(f)) { const s = JSON.parse(fs.readFileSync(f, 'utf8')); if (s[name]) return s[name]; }
  return null;
}
module.exports = { ...cfg, BASE, path: p, secret, reportsDir: path.join(BASE, 'reports') };
