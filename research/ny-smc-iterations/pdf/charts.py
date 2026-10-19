"""charts.py — annotated step-by-step charts of real v7 trades (SMC Toolkit style).
render(ex, step, path) draws the trade up to a given step of the system:
  1 swings / trend        2 CHoCH candle        3 FVG            4 entry (limit @ 50%)
  5 stop                  6 target (3R)         7 order lifetime 8 fill + breakeven + 4-candle check
  9 result
Everything comes from real Bybit 15m candles; nothing is hand-drawn.
"""
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

UP, DN = '#26a69a', '#ef5350'
INK, MUTED = '#1f2937', '#6b7280'
ORANGE, BLUE, GREEN, RED, PURPLE = '#f59e0b', '#2563eb', '#16a34a', '#dc2626', '#7c3aed'
plt.rcParams['font.family'] = 'DejaVu Sans'


def load(path):
    return {t['id']: t for t in json.load(open(path))}


def fmt(p):
    return f'{p:,.2f}' if p >= 100 else f'{p:,.3f}'


def window_idx(ex):
    """candle indices (inside the chart window) that fall in the three ET windows on the CHoCH day"""
    ct = ex['candles'][ex['i']['choch']][0]
    out = {'ok': [], 'skip': []}
    for k, c in enumerate(ex['candles']):
        if abs(c[0] - ct) > 9 * 3600:
            continue
        h, m = int(c[5][:2]), int(c[5][3:])
        mins = h * 60 + m
        if 8 * 60 + 30 <= mins < 9 * 60 + 30 or 10 * 60 + 30 <= mins < 11 * 60 + 30:
            out['ok'].append(k)
        elif 9 * 60 + 30 <= mins < 10 * 60 + 30:
            out['skip'].append(k)
    return out


def runs(idx):
    """group sorted indices into contiguous runs -> [(a, b)]"""
    r = []
    for k in idx:
        if r and k == r[-1][1] + 1:
            r[-1][1] = k
        else:
            r.append([k, k])
    return r


def ring(ax, x, y, color, s=900, lw=2.6):
    ax.scatter([x], [y], s=s, facecolors='none', edgecolors=color, linewidths=lw, zorder=8)


def tag(ax, x, y, text, color, dx=0, dy=0, ha='left', va='center', size=8.6, bold=True, arrow=True, bg='white', z=9):
    ax.annotate(text, xy=(x, y), xytext=(x + dx, y + dy), ha=ha, va=va, fontsize=size,
                fontweight='bold' if bold else 'normal', color=color, zorder=z,
                bbox=dict(boxstyle='round,pad=0.3', fc=bg, ec=color, lw=1.2),
                arrowprops=dict(arrowstyle='-|>', color=color, lw=1.4, shrinkA=0, shrinkB=3) if arrow else None)


def render(ex, step, path, size=(8.4, 4.95), dpi=210, title=None):
    C, I, long_ = ex['candles'], ex['i'], ex['long']
    d = 1 if long_ else -1
    x0 = max(0, I['swing'] - 9)
    # per-step frame: zoomed on what the step is about; candles after the decision point stay hidden
    x1 = {1: I['choch'] + 7, 2: I['choch'] + 8, 3: I['fvg3'] + 14, 4: I['fvg3'] + 14, 5: I['fvg3'] + 14, 6: I['fvg3'] + 14,
          7: I['fvg3'] + 14, 8: I['exit'] + 4, 9: I['exit'] + 7}[step]
    # how many candles are visible at this step (no peeking at the future)
    reveal = {1: I['choch'] - 1, 2: I['choch'] + 2, 3: I['fvg3'] + 1, 4: I['fvg3'] + 1, 5: I['fvg3'] + 1,
              6: I['fvg3'] + 1, 7: I['fvg3'] + 1, 8: min(I['exit'], I['fill'] + 8), 9: I['exit'] + 1}[step]
    reveal = min(reveal, len(C) - 1)
    fig, ax = plt.subplots(figsize=size, dpi=dpi)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#fbfbfd')

    # price range (fixed across steps so the pages line up)
    vis = C[x0:min(reveal, x1) + 1]
    lv = [c[3] for c in vis] + [c[2] for c in vis]
    if step >= 3: lv += [ex['fvgTop'], ex['fvgBottom']]
    if step >= 4: lv.append(ex['entry'])
    if step >= 5: lv.append(ex['stop'])
    if step >= 6: lv.append(ex['tp'])
    lo, hi = min(lv), max(lv)
    spread = hi - lo
    lo -= spread * 0.20
    hi += spread * 0.24
    pad = (hi - lo) * 0.05
    ax.set_xlim(x0 - 1, x1 + 21)
    ax.set_ylim(lo - pad, hi + pad)

    # ---- ET windows (shaded) ----
    w = window_idx(ex)
    for a, b in runs(w['ok']):
        if b < x0 or a > x1 + 21:
            continue
        ax.axvspan(a - .5, b + .5, color='#16a34a', alpha=0.07, lw=0, zorder=0)
        ax.text((a + b) / 2, hi + pad * 0.62, 'TRADE', ha='center', va='center', fontsize=7.2, color=GREEN, fontweight='bold', zorder=3)
    for a, b in runs(w['skip']):
        ax.axvspan(a - .5, b + .5, facecolor='#9ca3af', alpha=0.16, lw=0, hatch='///', edgecolor='#9ca3af', zorder=0)
        ax.text((a + b) / 2, hi + pad * 0.62, 'SKIP', ha='center', va='center', fontsize=7.2, color=MUTED, fontweight='bold', zorder=3)

    # ---- FVG box (step 3+) ----
    if step >= 3:
        top, bot = ex['fvgTop'], ex['fvgBottom']
        end = I['fill'] if step >= 8 else I['fvg3'] + 12
        col = UP if long_ else DN
        ax.add_patch(Rectangle((I['fvg1'] - .4, bot), end - I['fvg1'] + .4, top - bot, fc=col, ec=col, alpha=0.20, lw=1, zorder=1))
        ax.add_patch(Rectangle((I['fvg1'] - .4, bot), end - I['fvg1'] + .4, top - bot, fc='none', ec=col, lw=1.2, zorder=2))

    # ---- risk / reward zones (step 5+/6+) ----
    if step >= 5:
        xs, xe = I['fvg3'] + 0.6, (I['exit'] + 1 if step >= 8 else I['fvg3'] + 12)
        ax.add_patch(Rectangle((xs, min(ex['entry'], ex['stop'])), xe - xs, abs(ex['entry'] - ex['stop']), fc=RED, alpha=0.10, lw=0, zorder=0.5))
    if step >= 6:
        ax.add_patch(Rectangle((xs, min(ex['entry'], ex['tp'])), xe - xs, abs(ex['entry'] - ex['tp']), fc=GREEN, alpha=0.09, lw=0, zorder=0.5))

    # ---- candles ----
    for k in range(x0, reveal + 1):
        t, o, h, l, c, lab = C[k]
        col = UP if c >= o else DN
        ax.plot([k, k], [l, h], color=col, lw=1.1, zorder=4, solid_capstyle='butt')
        ax.add_patch(Rectangle((k - 0.34, min(o, c)), 0.68, max(abs(c - o), (hi - lo) * 0.0012), fc=col, ec=col, lw=0.5, zorder=5))

    # ---- hourly time ticks (ET) ----
    ticks = [k for k in range(x0, x1 + 1) if C[k][5].endswith(':30') and k % 1 == 0]
    ax.set_xticks([k - 0.5 for k in ticks])   # tick = the candle's OPEN time
    ax.set_xticklabels([C[k][5] for k in ticks], fontsize=7.2, color=MUTED)
    ax.set_xlabel(f"Time on the chart: New York time (ET)   ·   {ex['day']}", fontsize=8, color=MUTED, labelpad=5)
    ax.yaxis.tick_right()
    ax.tick_params(axis='y', labelsize=7.2, colors=MUTED, length=0)
    ax.tick_params(axis='x', length=2)
    ax.grid(axis='y', color='#e5e7eb', lw=0.6)
    for s in ('top', 'left'):
        ax.spines[s].set_visible(False)
    for s in ('bottom', 'right'):
        ax.spines[s].set_color('#d1d5db')

    xr = x1 + 1.2           # where right-hand labels start
    rng = hi - lo

    # =============== STEP 1: swings + trend ===============
    if step >= 1:
        conf = lambda p: p['i'] + 5 <= min(reveal, I['choch'] - 1)
        for p in ex['swingsHi']:
            if x0 <= p['i'] and conf(p):
                ax.scatter([p['i']], [p['price'] + rng * 0.018], marker='v', s=26, color=BLUE, zorder=6)
        for p in ex['swingsLo']:
            if x0 <= p['i'] and conf(p):
                ax.scatter([p['i']], [p['price'] - rng * 0.018], marker='^', s=26, color=PURPLE, zorder=6)
        # the broken swing
        sp = ex['swingPrice']
        xe_ = I['choch'] + (0.5 if step >= 2 else 3)
        ax.plot([I['swing'], xe_], [sp, sp], color=ORANGE, lw=1.8, ls=(0, (5, 3)), zorder=6)
        if step == 1:
            ring(ax, I['swing'], sp, ORANGE, s=520, lw=2.2)
            word = 'high' if long_ else 'low'
            tag(ax, I['swing'], sp, f'LAST SWING {word.upper()}\n(the line price must close {"above" if long_ else "below"})', ORANGE,
                dx=-1, dy=rng * (0.17 if long_ else -0.17), ha='left', size=8.2)
            trend = 'DOWNTREND = lower highs + lower lows' if long_ else 'UPTREND = higher highs + higher lows'
            ax.text(x0 + 0.3, hi - rng * 0.075, trend, fontsize=8.4, color=MUTED, fontweight='bold', va='top')
            ax.scatter([], [], marker='v', s=26, color=BLUE, label='swing high (5 candles lower on each side)')
            ax.scatter([], [], marker='^', s=26, color=PURPLE, label='swing low (5 candles higher on each side)')
            ax.legend(loc='lower right', fontsize=7.4, frameon=True, framealpha=0.95)

    # =============== STEP 2: CHoCH candle ===============
    if step >= 2:
        k = I['choch']
        t, o, h, l, c, lab = C[k]
        if step == 2:
            ring(ax, k, (h + l) / 2, RED if long_ else RED, s=1500, lw=3)
        ax.text(I['swing'] + (k - I['swing']) / 2, ex['swingPrice'] + rng * (0.012 if long_ else -0.012), 'CHoCH', fontsize=8.5, color=ORANGE,
                fontweight='bold', ha='center', va='bottom' if long_ else 'top', zorder=7)
        if step == 2:
            side = 'ABOVE' if long_ else 'BELOW'
            tag(ax, k, (h if long_ else l), f'CHoCH CANDLE\ncloses {side} the swing line\nat {lab} ET  (inside trade window)', RED, dx=-12, dy=rng * (0.20 if long_ else -0.20), ha='left', size=8.2)
            # ATR bracket on the right
            bx = xr + 0.3
            ax.plot([bx, bx], [l, h], color=BLUE, lw=2.5, zorder=7)
            ax.plot([bx - .4, bx + .4], [l, l], color=BLUE, lw=2.5)
            ax.plot([bx - .4, bx + .4], [h, h], color=BLUE, lw=2.5)
            ax.text(bx + 0.8, (h + l) / 2, f"candle size = {ex['chochRange'] / ex['atrChoch']:.1f} × ATR\nRULE: at least 1.0 × ATR  ✔", fontsize=8, color=BLUE, fontweight='bold', va='center')
            ax.plot([k + .5, bx], [h, h], color=BLUE, lw=0.8, ls=':')
            ax.plot([k + .5, bx], [l, l], color=BLUE, lw=0.8, ls=':')

    # =============== STEP 3: FVG ===============
    if step >= 3:
        ys = ex['fvgTop'] if long_ else ex['fvgBottom']
        if step == 3:
            for n, kk in enumerate((I['fvg1'], I['fvg1'] + 1, I['fvg3']), 1):
                cc = C[kk]
                ax.text(kk, (cc[3] - rng * 0.045) if long_ else (cc[2] + rng * 0.045), str(n), ha='center', va='center', fontsize=10, fontweight='bold', color='white', zorder=9,
                        bbox=dict(boxstyle='circle,pad=0.25', fc=BLUE, ec='none'))
            mid = (ex['fvgTop'] + ex['fvgBottom']) / 2
            tag(ax, I['fvg3'] + 3, mid, 'FVG = THE GAP\nCandle 3 does not overlap candle 1:\n' + ('low of 3 is ABOVE high of 1' if long_ else 'high of 3 is BELOW low of 1') +
                f"\nFirst gap after the CHoCH  ·  size {(ex['fvgTop'] - ex['fvgBottom']) / ex['atrFvg']:.2f} × ATR (rule ≥ 0.20 ✔)", BLUE,
                dx=2.5, dy=rng * (-0.22 if long_ else 0.22), ha='left', size=8)

    # =============== STEP 4: entry ===============
    if step >= 4:
        xs_ = I['fvg1'] - 0.4
        xe_ = I['fill'] + 0.5 if step >= 8 else I['fvg3'] + 12
        ax.plot([xs_, xe_], [ex['entry']] * 2, color=BLUE, lw=2.2, zorder=7)
        ax.text(xr, ex['entry'], f"ENTRY  {fmt(ex['entry'])}", fontsize=8.6, color='white', fontweight='bold', va='center', zorder=9,
                bbox=dict(boxstyle='round,pad=0.3', fc=BLUE, ec='none'))
        if step == 4:
            tag(ax, I['fvg3'] + 6, ex['entry'], 'LIMIT ORDER at the MIDDLE (50%) of the gap\nPlace it and wait. Do NOT chase price.', BLUE,
                dx=-5, dy=rng * (-0.2 if long_ else 0.2), ha='left', size=8.2)

    # =============== STEP 5: stop ===============
    if step >= 5:
        ax.plot([I['fvg3'] + 0.6, (I['exit'] + 1 if step >= 8 else I['fvg3'] + 12)], [ex['stop']] * 2, color=RED, lw=2.2, zorder=7)
        ax.text(xr, ex['stop'], f"STOP  {fmt(ex['stop'])}", fontsize=8.6, color='white', fontweight='bold', va='center', zorder=9, bbox=dict(boxstyle='round,pad=0.3', fc=RED, ec='none'))
        if step == 5:
            ring(ax, I['legX'], ex['legX'], RED, s=620, lw=2.4)
            word = 'LOWEST' if long_ else 'HIGHEST'
            tag(ax, I['legX'], ex['legX'], f'{word} POINT of the move that\nmade the CHoCH (the "bottom")' if long_ else f'{word} POINT of the move that\nmade the CHoCH (the "top")', RED,
                dx=-1.5, dy=rng * (-0.13 if long_ else 0.13), ha='left', size=8.2)
            tag(ax, I['fvg3'] + 6, ex['stop'], 'STOP = just beyond that point (0.02%)\nPrice gets there = idea wrong: lose 1R', RED,
                dx=-1, dy=rng * (0.10 if long_ else -0.10), ha='left', size=8.2)
            # 1R bracket
            bx = xr + 7.2
            ax.plot([bx, bx], [ex['stop'], ex['entry']], color=RED, lw=2.4)
            ax.text(bx + 0.7, (ex['stop'] + ex['entry']) / 2, '1R\nrisk', fontsize=8.5, color=RED, fontweight='bold', va='center')

    # =============== STEP 6: target ===============
    if step >= 6:
        ax.plot([I['fvg3'] + 0.6, (I['exit'] + 1 if step >= 8 else I['fvg3'] + 12)], [ex['tp']] * 2, color=GREEN, lw=2.2, zorder=7)
        ax.text(xr, ex['tp'], f"TARGET  {fmt(ex['tp'])}", fontsize=8.6, color='white', fontweight='bold', va='center', zorder=9, bbox=dict(boxstyle='round,pad=0.3', fc=GREEN, ec='none'))
        if step == 6:
            bx = xr + 7.2
            ax.plot([bx, bx], [ex['entry'], ex['tp']], color=GREEN, lw=2.4)
            ax.text(bx + 0.7, (ex['entry'] + ex['tp']) / 2, '3R\nreward', fontsize=8.5, color=GREEN, fontweight='bold', va='center')
            ax.plot([bx, bx], [ex['stop'], ex['entry']], color=RED, lw=2.4)
            ax.text(bx + 0.7, (ex['stop'] + ex['entry']) / 2, '1R', fontsize=8.5, color=RED, fontweight='bold', va='center')
            tag(ax, I['fvg3'] + 5, ex['tp'], 'TARGET = entry + 3 × (entry − stop)\nRisk \\$10 → win about \\$30', GREEN, dx=-3, dy=rng * (-0.10 if long_ else 0.10), ha='left', size=8.2)

    # =============== STEP 7: order lifetime ===============
    if step == 7:
        yb = ex['entry'] + d * rng * -0.0  # draw bracket near entry
        y = lo + rng * (0.04 if long_ else 0.96)
        a, b = I['fvg3'] + 0.5, I['fvg3'] + 8.5
        ax.annotate('', xy=(b, y), xytext=(a, y), arrowprops=dict(arrowstyle='<->', color=PURPLE, lw=2))
        ax.text((a + b) / 2, y + rng * (0.035 if long_ else -0.035), 'order lives max 8 candles', ha='center', va='bottom' if long_ else 'top', fontsize=8.4, color=PURPLE, fontweight='bold')
        ax.plot([b, b], [lo, hi], color=PURPLE, lw=1.2, ls=(0, (4, 3)))
        ax.text(b + 0.4, ex['entry'] + d * rng * 0.25, 'not filled by here\n→ CANCEL', fontsize=8.2, color=PURPLE, fontweight='bold', va='center')

    # =============== STEP 8: fill, breakeven, 4-candle check ===============
    if step >= 8:
        f = I['fill']
        ring(ax, f, ex['fillPx'], BLUE, s=520, lw=2.6)
        if step == 8:
            tag(ax, f, ex['fillPx'], 'FILLED\nprice came back to your limit', BLUE, dx=-21, dy=rng * (-0.27 if long_ else 0.27), ha='left', size=8.2)
        # +1R line and breakeven move
        ax.plot([f, I['exit'] + 1], [ex['beTrig']] * 2, color=ORANGE, lw=1.6, ls=(0, (5, 3)), zorder=6)
        ax.text(xr, ex['beTrig'], '+1R', fontsize=8.4, color='white', fontweight='bold', va='center', zorder=9, bbox=dict(boxstyle='round,pad=0.25', fc=ORANGE, ec='none'))
        j = next((k for k in range(f, len(C)) if (C[k][2] >= ex['beTrig'] if long_ else C[k][3] <= ex['beTrig'])), None)
        if j is not None and j <= reveal:
            ring(ax, j, ex['beTrig'], ORANGE, s=520, lw=2.4)
            ax.plot([j, I['exit'] + 1], [ex['fillPx']] * 2, color=ORANGE, lw=2.4, zorder=7)
            if step == 8:
                tag(ax, j, ex['beTrig'], 'PRICE REACHED +1R\n→ MOVE STOP TO ENTRY\n(you can no longer lose)', ORANGE, dx=-1.5, dy=rng * (0.17 if long_ else -0.17), ha='right', size=8.2)
            else:
                tag(ax, j, ex['beTrig'], 'at +1R: stop → entry', ORANGE, dx=(3 if long_ else -3), dy=rng * -0.13, ha=('left' if long_ else 'right'), size=7.8)
        # 4 candle check
        c4 = f + 4
        ax.axvline(c4 + 0.5, color=PURPLE, lw=1.2, ls=(0, (4, 3)), zorder=3)
        ax.plot([f + 0.5, c4 + 0.5], [lo + rng * (0.03 if long_ else 0.97)] * 2, color=PURPLE, lw=2.2)
        ax.text(f + 0.5, lo + rng * (0.06 if long_ else 0.94), '4-candle check', fontsize=8.2, color=PURPLE, fontweight='bold', va='bottom' if long_ else 'top')
        q = ex['fillPx'] + d * 0.25 * ex['riskPx']
        ax.plot([f, c4 + 0.5], [q, q], color=PURPLE, lw=1.1, ls=':')
        ax.text(c4 + 0.8, q, '+0.25R', fontsize=7.6, color=PURPLE, va='center', fontweight='bold')
        if step == 8:
            ax.text(c4 + 0.8, ex['fillPx'] + d * rng * -0.12, 'After 4 candles: if price never\nreached +0.25R → pull stop\nin to −0.5R', fontsize=7.6, color=PURPLE, va='center', fontweight='bold')

    # =============== STEP 9: result ===============
    if step >= 9:
        e = I['exit']
        ring(ax, e, ex['exitPx'], GREEN, s=800, lw=3)
        tag(ax, e, ex['exitPx'], f"TARGET HIT  +{ex['R']:.1f}R\n≈ +\\${ex['R'] * 10:.0f} on \\$10 risk", GREEN, dx=-10, dy=rng * (-0.07 if long_ else 0.07), ha='right', size=9)

    if title:
        ax.set_title(title, loc='left', fontsize=10.5, fontweight='bold', color=INK, pad=10)
    fig.subplots_adjust(left=0.02, right=0.94, top=0.93, bottom=0.12)
    fig.savefig(path)
    plt.close(fig)


if __name__ == '__main__':
    import sys
    T = load(sys.argv[1])
    ex = T[sys.argv[2]]
    render(ex, int(sys.argv[3]), sys.argv[4])
