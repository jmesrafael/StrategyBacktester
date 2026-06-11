#!/usr/bin/env node
// Setup script — provisions Supabase tables + RLS from db/schema.sql.
// Uses Node.js built-in https only — no npm packages required.
// Run: node scripts/setup-supabase.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = 'vkfetsmnlylcsbwxcord';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZmV0c21ubHlsY3Nid3hjb3JkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTEyNjY0NywiZXhwIjoyMDk2NzAyNjQ3fQ.07crSUeF2cFXNPAGhxLtBrm15rEQDAUo2Q63G4dQYhs';

const schemaPath = join(__dirname, '..', 'db', 'schema.sql');
const sql = readFileSync(schemaPath, 'utf8');

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Try Supabase pg-meta admin endpoint (used by the Supabase dashboard itself)
async function tryPgMeta() {
  const url = `https://${PROJECT_REF}.supabase.co/pg/query`;
  const res = await httpsPost(url, { query: sql }, {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey': SERVICE_ROLE_KEY,
  });
  return res;
}

// Fallback: run each statement individually via the REST API rpc endpoint
// (for simple DDL that PostgREST might pass through)
async function tryRestApi(statement) {
  // Supabase REST API allows calling a postgres function; DDL won't work here
  // but we use it to test connectivity at minimum.
  const url = `https://${PROJECT_REF}.supabase.co/rest/v1/`;
  const res = await httpsPost(url + 'rpc/version', {}, {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey': SERVICE_ROLE_KEY,
  });
  return res;
}

console.log('Provisioning Supabase (project: ' + PROJECT_REF + ')…\n');

let success = false;

try {
  process.stdout.write('Trying pg-meta admin endpoint… ');
  const res = await tryPgMeta();
  if (res.status >= 200 && res.status < 300) {
    console.log('✓ Schema applied successfully.');
    success = true;
  } else if (res.status === 404) {
    console.log('endpoint not available (404).');
  } else {
    console.log(`HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  }
} catch (e) {
  console.log(`failed (${e.message})`);
}

if (!success) {
  // Test basic connectivity to Supabase
  try {
    process.stdout.write('Testing REST API connectivity… ');
    const res = await tryRestApi();
    console.log(`status ${res.status} — REST API reachable.`);
  } catch (e) {
    console.log(`failed (${e.message})`);
  }

  console.log('\n─── MANUAL SETUP REQUIRED ─────────────────────────────────────────────');
  console.log('The direct DB provisioning endpoint is unavailable from this network.');
  console.log('Please paste the following SQL into:');
  console.log('  Supabase Dashboard → SQL Editor → New query → Paste → Run\n');
  console.log('─'.repeat(72));
  console.log(sql);
  console.log('─'.repeat(72));
  console.log('\nAfter running the SQL, the app will work immediately.');
  process.exit(1);
}
