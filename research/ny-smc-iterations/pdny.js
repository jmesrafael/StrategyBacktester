// pdny.js — previous-day levels in New York time, per 15m bar (causal: only completed earlier days).
// modes: 'nyday'  = previous New York calendar day (00:00–24:00 ET) high/low
//        'nysess' = previous day's NY session (08:30–16:00 ET, v7's session) high/low
//        'utc'    = previous UTC day (what js/smc.js draws; kept for comparison)
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const etCache = new Map();
function et(t) { // → { day: 'YYYY-MM-DD', min: minutes since ET midnight }
  const h = Math.floor(t / 3600);
  let base = etCache.get(h);
  if (!base) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(h * 3600e3)).map((x) => [x.type, x.value]));
    base = { day: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
    etCache.set(h, base);
  }
  return { day: base.day, min: base.min + Math.floor((t % 3600) / 60) };
}
// returns getter (barIdx) → { pdh, pdl } or null, for the bars of D.B
function levels(D, mode = 'nyday') {
  const key = 'pd_' + mode;
  if (D[key]) return D[key];
  const B = D.B, N = B.length, dayOf = new Array(N), days = [], hl = new Map();
  for (let i = 0; i < N; i++) {
    let d;
    if (mode === 'utc') d = String(Math.floor(B[i].time / 86400));
    else { const e = et(B[i].time); d = e.day; if (mode === 'nysess' && !(e.min >= 510 && e.min < 960)) { dayOf[i] = d; if (!hl.has(d)) { hl.set(d, null); days.push(d); } continue; } }
    dayOf[i] = d;
    if (!hl.has(d)) { hl.set(d, null); days.push(d); }
    const cur = hl.get(d);
    hl.set(d, cur ? { hi: Math.max(cur.hi, B[i].high), lo: Math.min(cur.lo, B[i].low) } : { hi: B[i].high, lo: B[i].low });
  }
  // previous day with data (weekends count as days for crypto)
  const prev = new Map(); let last = null;
  for (const d of days) { prev.set(d, last); if (hl.get(d)) last = hl.get(d); }
  const get = (i) => { const p = prev.get(dayOf[i]); return p ? { pdh: p.hi, pdl: p.lo } : null; };
  return (D[key] = get);
}
module.exports = { levels, et };
