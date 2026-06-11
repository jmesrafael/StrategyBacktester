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

  const SettingsSync = {
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
          if (v !== null && v !== undefined && localStorage.getItem(k) !== v) {
            localStorage.setItem(k, v);
            changed = true;
          }
        }
        // One guarded reload so app.js reads the synced values on next boot.
        if (changed && !sessionStorage.getItem('supa_synced')) {
          sessionStorage.setItem('supa_synced', '1');
          location.reload();
        }
      } catch (e) { console.warn('SettingsSync.pull:', e.message); }
    },

    schedulePush() {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => SettingsSync._push(), 1200);
    },

    async _push() {
      const snapshot = {};
      for (const k of SYNC_KEYS) {
        const v = localStorage.getItem(k);
        if (v !== null) snapshot[k] = v;
      }
      try {
        const { error } = await sb.from('app_settings').upsert({
          id: 'global', data: snapshot, updated_at: new Date().toISOString(),
        });
        if (error) console.warn('SettingsSync._push:', error.message);
      } catch (e) { console.warn('SettingsSync._push:', e.message); }
    },
  };

  // Intercept localStorage.setItem for tracked keys.
  const _origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    if (SYNC_KEYS.has(key)) SettingsSync.schedulePush();
  };

  window.SettingsSync = SettingsSync;

  // Kick off pull immediately (may trigger a single reload if remote differs).
  SettingsSync.pull();
})();
