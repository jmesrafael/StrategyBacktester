"""recon.py - INDEPENDENT reconstruction of the SOL/ZEC trade ledger from raw candles + the README rules.
Written without reading lucidyo-core.js internals: pure Python, no numpy. Usage: python -I recon.py
Rules (README): BB(20,2) population-sd on close; SMA200 trend filter; stop = BB middle at signal close; target = signal close +/- 4*|close-mid|;
skip if |close-mid| < 0.3*ATR14(Wilder, SMA seed); entry = next candle open +/- slippage; stop-first on a touch of both; gaps fill at open;
time exit after 48 candles -> next open; funding every 8h event strictly after entry open and <= exit_candle_open+2h.
"""
import json, os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data'); OUT = os.path.join(HERE, 'out')
COSTS = {
  'free':  dict(ef=0, sf=0, tf=0, pf=0, slip=0, pslip=0, buf=0),
  'base':  dict(ef=.0005, sf=.0005, tf=.0005, pf=.0002, slip=.0002, pslip=0, buf=.0005),
  'harsh': dict(ef=.0008, sf=.0008, tf=.0008, pf=.0008, slip=.0005, pslip=.0005, buf=.0005),
}
def load(c): return json.load(open(os.path.join(D, c + '.json')))
def indicators(rows):
    n = len(rows); cl = [r[4] for r in rows]
    mid = [None]*n; up = [None]*n; lo = [None]*n; sma = [None]*n; atr = [None]*n
    for i in range(n):
        if i >= 19:
            w = cl[i-19:i+1]; m = sum(w)/20; sd = math.sqrt(sum((x-m)**2 for x in w)/20)   # population sd
            mid[i], up[i], lo[i] = m, m+2*sd, m-2*sd
        if i >= 199: sma[i] = sum(cl[i-199:i+1])/200
    tr = [rows[0][2]-rows[0][3]] + [max(rows[i][2]-rows[i][3], abs(rows[i][2]-rows[i-1][4]), abs(rows[i][3]-rows[i-1][4])) for i in range(1, n)]
    a = sum(tr[:14])/14; atr[13] = a
    for i in range(14, n): a = (a*13 + tr[i])/14; atr[i] = a
    return mid, up, lo, sma, atr
def run(rows, cost, funding):
    n = len(rows); mid, up, lo, sma, atr = indicators(rows); k = COSTS[cost]; trades = []
    i = 202   # first signal candle index (README: warm-up 202 candles)
    # signals may be evaluated on candle i only when flat at its close. Walk with explicit "flat from" pointer.
    flat_from = 202
    while True:
        # find next signal candle >= flat_from
        s = None
        for j in range(flat_from, n-1):
            c = rows[j][4]
            if c > up[j] and c > sma[j]: d = 1
            elif c < lo[j] and c < sma[j]: d = -1
            else: continue
            dist = abs(c - mid[j])
            if dist <= 0 or dist < 0.3*atr[j]: continue
            s = (j, d, mid[j], c + d*4*dist); break
        if s is None: break
        j, d, stop, tp = s; e = j+1
        entry = rows[e][1]*(1 + d*k['slip'])
        if not ((stop < entry) if d == 1 else (stop > entry)):
            flat_from = j+1; continue                                  # entry already beyond stop: no trade, keep scanning
        dist = abs(entry-stop)/entry
        exit_i = exit_px = fee = why = None
        t = e
        while t < n:
            if t - e >= 48 and t > e:   # time exit: decided at close of candle e+48, filled at open of e+49
                pass
            if t == e + 49:
                exit_i, exit_px, fee, why = t, rows[t][1]*(1 - d*k['slip']), k['tf'], 'time'; break
            o, h, l = rows[t][1], rows[t][2], rows[t][3]
            if (l <= stop) if d == 1 else (h >= stop):
                p = (min(stop, o) if d == 1 else max(stop, o))*(1 - d*k['slip'])
                exit_i, exit_px, fee, why = t, p, k['sf'], 'stop'; break
            if (h >= tp*(1+k['buf'])) if d == 1 else (l <= tp*(1-k['buf'])):
                p = (max(tp, o) if d == 1 else min(tp, o))*(1 - d*k['pslip'])
                exit_i, exit_px, fee, why = t, p, k['pf'], 'target'; break
            t += 1
        if exit_i is None: break                                        # still open at end of data
        fr = 0.0
        if funding:
            te, tx = rows[e][0], rows[exit_i][0] + 7200
            fr = sum(r for (tt, r) in funding if te < tt <= tx)
        R = (d*(exit_px-entry)/entry - k['ef'] - fee - d*fr)/dist
        trades.append(dict(dir=d, i0=e, i1=exit_i, entry=entry, exit=exit_px, why=why, R=R, sig=j))
        flat_from = exit_i if why != 'time' else exit_i    # flat at the CLOSE of the exit candle -> signal on that candle allowed
        if why == 'time': flat_from = exit_i
    return trades
def main():
    allok = True
    for c in ['SOL', 'ZEC', 'MEXC_SOL', 'MEXC_ZEC']:
        rows = load(c)
        fp = os.path.join(D, 'funding', c + '.json'); F = json.load(open(fp)) if os.path.exists(fp) else None
        if c.startswith('MEXC_'):
            b = json.load(open(os.path.join(D, 'funding', c[5:] + '.json'))); F = [r for r in b if r[0] < F[0][0]] + F
        for cost in ['free', 'base', 'harsh']:
            mine = run(rows, cost, None if cost == 'free' else F)
            core = json.load(open(os.path.join(OUT, f'core-{c}-{cost}.json')))
            ok = len(mine) == len(core); bad = []
            for a, b in zip(mine, core):
                if (a['i0'], a['i1'], a['why'], a['dir']) != (b['i0'], b['i1'], b['why'], b['dir']) or abs(a['R']-b['R']) > 1e-9: bad.append((a, b))
            ok = ok and not bad; allok &= ok
            print(f"{c:9s} {cost:5s} recon={len(mine):4d} core={len(core):4d} sumR recon={sum(t['R'] for t in mine):8.3f} core={sum(t['R'] for t in core):8.3f}  {'MATCH' if ok else 'MISMATCH ' + str(len(bad))}")
            if bad: print('   first diff:', bad[0][0], bad[0][1])
    print('ALL MATCH' if allok else 'DIFFERENCES FOUND'); sys.exit(0 if allok else 1)
if __name__ == '__main__': main()
