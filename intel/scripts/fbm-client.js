'use strict';
// fbm-client.js: tiny client for the FreeAPIByMe gateway (free OpenRouter models, several accounts behind one fbm_ key).
// Used ONLY by manual helper scripts (event-scan.js). Nothing in intel's data or reports depends on it. No AI at runtime in the pipeline.
// Key: env FBM_API_KEY / FBM_BASE_URL, else the crypto-news/.env file. The key is never printed.
//
// Strategy (what to do when a free model times out or is throttled):
//  1. Each request names one model and lists the others in "models". The gateway (lib/gateway.js, per-account fallback) then tries the
//     other models on the SAME account first and moves to the next account only when all of them failed. The old gateway forwards
//     "models" to OpenRouter, which also falls back inside the account, so this works on both versions.
//  2. If the whole request fails (503, timeout, or an empty reply, which thinking models give when max_tokens is small), the client
//     moves on to the next model as the main one, waits a little, and tries again. Max 'rounds' passes over the list.
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const env = { FBM_API_KEY: process.env.FBM_API_KEY, FBM_BASE_URL: process.env.FBM_BASE_URL };
  if (env.FBM_API_KEY && env.FBM_BASE_URL) return env;
  const f = path.join(__dirname, '..', '..', '..', 'crypto-news', '.env');
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*(FBM_API_KEY|FBM_BASE_URL)\s*=\s*(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// Models that answered with real text in the Nov 24 test (non-thinking first). Thinking models can return empty text on a small token budget.
const PREFERRED = [
  'inclusionai/ling-3.2-flash:free', 'particle-ai/particle-1:free', 'baidu/ernie-5.5-flash-preview:free', 'nvidia/nemotron-3.5-super-vl:free',
  'recursive/flint-v1.0:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'dots-studio/dots-3-note-preview:free',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listModels(env) {
  const r = await fetch(env.FBM_BASE_URL.replace(/\/+$/, '') + '/models', { headers: { Authorization: 'Bearer ' + env.FBM_API_KEY }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('models list HTTP ' + r.status);
  return ((await r.json()).data || []).map((m) => m.id);
}

async function chat({ messages, maxTokens = 900, temperature = 0.2, timeoutMs = 60000, rounds = 1, maxAttempts = 3, extra = {}, models, log = () => {} }) {
  const env = loadEnv();
  if (!env.FBM_API_KEY || !env.FBM_BASE_URL) throw new Error('FBM_API_KEY / FBM_BASE_URL not found (env or crypto-news/.env)');
  let list = models;
  if (!list) { try { const live = new Set(await listModels(env)); list = PREFERRED.filter((m) => live.has(m)); } catch (e) { log('model list failed: ' + e.message); } if (!list || !list.length) list = PREFERRED; }
  const tried = [];
  let attempts = 0;
  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < list.length; i++) {
      // OpenRouter accepts at most 3 entries in "models", so send the next two models after this one (wrapping round the list)
      const main = list[i], rest = [list[(i + 1) % list.length], list[(i + 2) % list.length]].filter((m, k, a) => m !== main && a.indexOf(m) === k);
      if (attempts >= maxAttempts) break;                 // free quota is small: never burn more than maxAttempts calls per run
      attempts++;
      const t0 = Date.now();
      try {
        const r = await fetch(env.FBM_BASE_URL.replace(/\/+$/, '') + '/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.FBM_API_KEY },
          body: JSON.stringify({ model: main, models: rest, messages, max_tokens: maxTokens, temperature, ...extra }), signal: AbortSignal.timeout(timeoutMs),
        });
        const raw = await r.text();
        let j = null; try { j = JSON.parse(raw); } catch {}
        const text = j && j.choices && j.choices[0] && j.choices[0].message && (j.choices[0].message.content || '').trim();
        const used = (j && j.model) || r.headers.get('x-freeapibyme-model') || main;
        tried.push({ round, model: main, used, status: r.status, ms: Date.now() - t0, ok: !!text });
        const why = (!r.ok || !text) ? ' ' + String((j && j.error && (j.error.message || JSON.stringify(j.error))) || (j && j.choices && j.choices[0] && JSON.stringify({ finish: j.choices[0].finish_reason, reasoning: !!(j.choices[0].message || {}).reasoning })) || raw).replace(/\s+/g, ' ').slice(0, 140) : '';
        log(`round ${round} ${main}: HTTP ${r.status} ${((Date.now() - t0) / 1000).toFixed(1)}s ${text ? 'ok (' + used + ')' : 'no text'}${why}`);
        if (r.status === 400 && !/reasoning/i.test(why)) throw Object.assign(new Error('request rejected (HTTP 400):' + why), { fatal: true });   // a bad request fails on every model: stop, do not burn quota
        if (r.ok && text) return { text, model: used, account: r.headers.get('x-freeapibyme-account'), tried };
        if (r.status === 503) await sleep(3000);          // no account free right now: give the cooldowns a moment
      } catch (e) {
        if (e.fatal) throw e;
        tried.push({ round, model: main, status: e.name === 'TimeoutError' ? 'timeout' : 'error', ms: Date.now() - t0, ok: false });
        log(`round ${round} ${main}: ${e.name === 'TimeoutError' ? 'timeout after ' + timeoutMs / 1000 + 's' : e.message}`);
      }
    }
    if (round < rounds && attempts < maxAttempts) await sleep(8000);
  }
  const err = new Error('all free models failed: ' + tried.map((t) => `${t.model.split('/').pop()}=${t.status}`).join(', ')); err.tried = tried; throw err;
}

module.exports = { chat, listModels, loadEnv, PREFERRED };
