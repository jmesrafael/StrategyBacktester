// candle-store.js — on-device copy of downloaded candles (IndexedDB).
// A reload or TF switch opens straight from here and only the newest bars are
// fetched on top. Only timeframes enabled in the TF toggle are kept: disabling a
// TF deletes its stored data, so the download stays as light as what you use.

const CandleStore = (() => {
  // 'cr-candles' held MEXC data — a new DB keeps it from mixing with Binance bars.
  const DB = 'cr-candles-binance', OS = 'series';
  try { indexedDB.deleteDatabase('cr-candles'); } catch {}
  const CAP = Math.max(...CFG.MAX_CANDLES.filter((n) => n < CFG.SINCE_2020), CFG.SINCE_MAX_BARS); // newest bars kept per symbol|TF
  let dbp = null;
  let allowed = null; // Set of enabled intervals (null = not set yet → store nothing)

  function open() {
    if (!dbp) {
      dbp = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(OS);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch { resolve(null); } // private mode / storage blocked → in-memory only
      });
    }
    return dbp;
  }

  // Run fn(store) in one transaction; resolves with fn's request result (or null).
  async function tx(mode, fn) {
    const db = await open();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const t = db.transaction(OS, mode);
        const r = fn(t.objectStore(OS));
        t.oncomplete = () => resolve(r ? r.result : null);
        t.onerror = t.onabort = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  const key = (symbol, iv) => `${symbol}|${iv}`;

  // → { data, complete, savedAt } or null
  function get(symbol, iv) {
    return tx('readonly', (s) => s.get(key(symbol, iv)));
  }

  // Save the latest series; older stored bars are kept underneath it when they
  // join up without a gap. `complete` = the series reaches the start of history.
  function save(symbol, iv, data, complete) {
    if (!allowed || !allowed.has(iv) || !data || !data.length) return;
    const sec = intervalToSeconds(iv);
    tx('readwrite', (s) => {
      const k = key(symbol, iv);
      const r = s.get(k);
      r.onsuccess = () => {
        const old = r.result;
        const first = data[0].time;
        let merged = data, done = complete;
        if (old && old.data && old.data.length) {
          const older = old.data.filter((c) => c.time < first);
          if (older.length && first - older[older.length - 1].time <= sec * 1.5) {
            merged = older.concat(data);
            done = complete || !!old.complete;
          }
        }
        if (merged.length > CAP) { merged = merged.slice(merged.length - CAP); done = false; }
        s.put({ data: merged, complete: done, savedAt: Date.now() }, k);
      };
      return r;
    });
  }

  // Enabled TFs changed — remember them and drop stored data for the rest.
  function setTimeframes(ivs) {
    allowed = new Set(ivs);
    tx('readwrite', (s) => {
      const r = s.getAllKeys();
      r.onsuccess = () => {
        for (const k of r.result) {
          const iv = String(k).split('|').pop();
          if (!allowed.has(iv)) s.delete(k);
        }
      };
      return r;
    });
  }

  return { get, save, setTimeframes };
})();
