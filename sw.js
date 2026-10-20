// sw.js — service worker for the installable app.
// • App files (same origin): network-first, so code edits show up on the next
//   load; the cached copy is only used when offline.
// • Versioned CDN libraries + fonts: stale-while-revalidate.
// • Market data (Binance futures API) and Supabase: never cached here (the
//   app keeps its own copy in IndexedDB and has an offline sample-data fallback).

const CACHE = 'replay-game-v5';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/config.js', 'js/supabase-config.js', 'js/binance.js', 'js/candle-store.js',
  'js/api.js', 'js/indicators.js', 'js/chart.js',
  'js/indicators-ui.js', 'js/replay.js', 'js/drawings.js', 'js/fvg.js', 'js/smc.js', 'js/bbx.js', 'js/trade-sim.js',
  'js/strategy.js', 'js/data-page.js', 'js/supabase-client.js', 'js/app.js', 'js/mobile.js',
  'strategies/registry.js', 'strategies/ema-rsi-divergence-strategy.js', 'strategies/ny-smc-v7-strategy.js', 'strategies/bb-breakout-strategy.js', 'strategies/fvg-pullback-strategy.js',
  'strategies/emacross-strategy.js', 'strategies/rsi-strategy.js', 'strategies/htf-trend-atr-strategy.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
const CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com',
  'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin && url.pathname.startsWith('/mexc/')) return;

  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
  }
  // everything else (Binance, Supabase) goes straight to the network
});
