// supabase-client.js — thin wrappers around Supabase for DataStore and SettingsSync.
// All calls are fire-and-forget with try/catch so the app works offline.

(function () {
  const { createClient } = window.supabase;
  const sb = createClient(window.SUPA.url, window.SUPA.anonKey);

  // ── DataStore ──────────────────────────────────────────────────────────────
  window.DataStore = {
    async saveRun(record) {
      try {
        const { error } = await sb.from('backtest_runs').insert(record);
        if (error) console.warn('DataStore.saveRun:', error.message);
        return !error;
      } catch (e) { console.warn('DataStore.saveRun:', e.message); return false; }
    },

    async listRuns() {
      try {
        const { data, error } = await sb
          .from('backtest_runs')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) { console.warn('DataStore.listRuns:', error.message); return []; }
        return data || [];
      } catch (e) { console.warn('DataStore.listRuns:', e.message); return []; }
    },

    async deleteRun(id) {
      try {
        const { error } = await sb.from('backtest_runs').delete().eq('id', id);
        if (error) console.warn('DataStore.deleteRun:', error.message);
        return !error;
      } catch (e) { console.warn('DataStore.deleteRun:', e.message); return false; }
    },
  };

  // ── SettingsSync ───────────────────────────────────────────────────────────
  // Mirrors CFG.STORE keys to the app_settings singleton row.
  // Pull on startup; push (debounced) whenever localStorage changes.

  const SYNC_KEYS = new Set(Object.values(CFG.STORE));
  let pushTimer = null;

  // ── save-status emitter (drives the top-bar cloud icon) ──────────────────────
  // 'saved'  = everything mirrored to the cloud
  // 'dirty'  = local change pending the debounced push
  // 'saving' = push in flight
  // 'error'  = last push failed / offline
  let status = 'saved';
  const statusListeners = [];
  function setStatus(s) { status = s; statusListeners.forEach((fn) => fn(s)); }

  const SettingsSync = {
    onStatus(fn) { statusListeners.push(fn); fn(status); },
    getStatus() { return status; },
    // Force an immediate push (cloud icon click) instead of waiting for the debounce.
    saveNow() { clearTimeout(pushTimer); return SettingsSync._push(); },

    async pull() {
      try {
        const { data, error } = await sb
          .from('app_settings')
          .select('data')
          .eq('id', 'global')
          .single();
        if (error || !data) return;
        const remote = data.data || {};
        let changed = false;
        for (const [k, v] of Object.entries(remote)) {
          if (typeof v === 'string' && localStorage.getItem(k) !== v) {
            _origSet(k, v); // bypass the push-trigger — we're pulling, not dirtying
            changed = true;
          }
        }
        // One guarded reload so app.js reads the synced values on next boot.
        if (changed && !sessionStorage.getItem('supa_synced')) {
          sessionStorage.setItem('supa_synced', '1');
          location.reload();
        }
        setStatus('saved');
      } catch (e) { console.warn('SettingsSync.pull:', e.message); setStatus('error'); }
    },

    schedulePush() {
      clearTimeout(pushTimer);
      setStatus('dirty');
      pushTimer = setTimeout(() => SettingsSync._push(), 1200);
    },

    async _push() {
      setStatus('saving');
      const snapshot = {};
      for (const k of SYNC_KEYS) {
        const v = localStorage.getItem(k);
        if (v !== null) snapshot[k] = v;
      }
      try {
        const { error } = await sb.from('app_settings').upsert({
          id: 'global', data: snapshot, updated_at: new Date().toISOString(),
        });
        if (error) { console.warn('SettingsSync._push:', error.message); setStatus('error'); return false; }
        setStatus('saved');
        return true;
      } catch (e) { console.warn('SettingsSync._push:', e.message); setStatus('error'); return false; }
    },
  };

  // Intercept localStorage.setItem for tracked keys. Only schedule a push when the
  // value actually changed, so no-op writes on load don't flip the cloud icon to dirty.
  const _origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    const changed = SYNC_KEYS.has(key) && localStorage.getItem(key) !== value;
    _origSet(key, value);
    if (changed) SettingsSync.schedulePush();
  };

  window.SettingsSync = SettingsSync;

  // Kick off pull immediately (may trigger a single reload if remote differs).
  SettingsSync.pull();
})();
