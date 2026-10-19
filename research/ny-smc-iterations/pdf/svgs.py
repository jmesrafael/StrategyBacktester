"""svgs.py — schematic (idealised) vector diagrams for the v7 steps. Writes pdf/svg/*.svg.
Plain ASCII text only (so the same files render in VS Code, browsers and the PDF). Run: python svgs.py
"""
import os
from xml.sax.saxutils import escape

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'svg')
os.makedirs(OUT, exist_ok=True)
UP, DN = '#26a69a', '#ef5350'
INK, MUTED, LINE = '#1f2937', '#6b7280', '#d1d5db'
ORANGE, BLUE, GREEN, RED, PURPLE = '#f59e0b', '#2563eb', '#16a34a', '#dc2626', '#7c3aed'
FONT = 'Arial, Helvetica, sans-serif'


def svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            f'<rect width="{w}" height="{h}" fill="white"/>{body}</svg>')


def T(x, y, s, size=11, fill=INK, weight='normal', anchor='start'):
    lines = s.split('\n')
    return ''.join(f'<text x="{x}" y="{y + i * size * 1.25:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{escape(t)}</text>'
                   for i, t in enumerate(lines))


def R(x, y, w, h, fill='none', stroke='none', sw=1, rx=0, op=1, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-width="{sw}"{d}/>'


def L(x1, y1, x2, y2, stroke=INK, sw=1.5, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{d}/>'


def C(x, y, r, fill='none', stroke=INK, sw=1.5):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def P(points, fill='none', stroke=INK, sw=1.5):
    pts = ' '.join(f'{a},{b}' for a, b in points)
    return f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def PL(points, stroke=INK, sw=1.5):
    pts = ' '.join(f'{a},{b}' for a, b in points)
    return f'<polyline points="{pts}" fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'


def arrow(x1, y1, x2, y2, stroke=INK, sw=1.6):
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    h = 7
    p1 = (x2 - h * math.cos(a - 0.45), y2 - h * math.sin(a - 0.45))
    p2 = (x2 - h * math.cos(a + 0.45), y2 - h * math.sin(a + 0.45))
    return L(x1, y1, x2 - 2 * math.cos(a), y2 - 2 * math.sin(a), stroke, sw) + P([(x2, y2), p1, p2], fill=stroke, stroke=stroke, sw=1)


def check(x, y, s=9, color=GREEN):
    return C(x, y, s + 3, fill=color, stroke=color) + PL([(x - s * .55, y), (x - s * .1, y + s * .5), (x + s * .6, y - s * .5)], stroke='white', sw=2.2)


def cross(x, y, s=9, color=RED):
    return C(x, y, s + 3, fill=color, stroke=color) + PL([(x - s * .45, y - s * .45), (x + s * .45, y + s * .45)], stroke='white', sw=2.2) + PL([(x + s * .45, y - s * .45), (x - s * .45, y + s * .45)], stroke='white', sw=2.2)


def candle(x, wt, bt, bb, wb, w=10, color=None, flip=None):
    """candle with wick top/bottom and body top/bottom, in SVG y (down). flip=(ymid) mirrors vertically."""
    if flip is not None:
        wt, bt, bb, wb = [2 * flip - v for v in (wb, bb, bt, wt)]
    col = color or UP
    return L(x, wt, x, wb, col, 1.4) + R(x - w / 2, bt, w, max(bb - bt, 1.5), fill=col, stroke=col, sw=0.8)


def number(x, y, n, color=BLUE, r=10):
    return C(x, y, r, fill=color, stroke=color) + T(x, y + 4, str(n), 11, 'white', 'bold', 'middle')


def write(name, w, h, body):
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(svg(w, h, body))


# ---------------------------------------------------------------- overview (700 x 150)
def overview():
    b = ''
    groups = [('FIND THE SETUP', 0, 3, '#e0f2fe', BLUE), ('PLAN THE TRADE', 3, 6, '#fee2e2', RED), ('MANAGE IT', 6, 9, '#dcfce7', GREEN)]
    names = ['Swing', 'CHoCH', 'Gap (FVG)', 'Entry', 'Stop', 'Target', 'Cancel rules', 'Manage', 'Review']
    sub = ['last swing\nhigh / low', 'candle closes\nbeyond it', 'first gap after\nthe CHoCH', 'limit order\nat 50% of gap', 'beyond the\nmove extreme', '3 x the risk',
           'when to give up\non the order', 'breakeven +\n4-candle check', 'log every\ntrade']
    cw = 700 / 9
    for g, a, bnd, fill, col in groups:
        b += R(a * cw + 3, 6, (bnd - a) * cw - 6, 138, fill=fill, rx=10)
        b += T((a + bnd) / 2 * cw, 24, g, 10.5, col, 'bold', 'middle')
    for i, (n, s_) in enumerate(zip(names, sub)):
        cx = i * cw + cw / 2
        col = BLUE if i < 3 else RED if i < 6 else GREEN
        b += number(cx, 58, i + 1, col, 15)
        b += T(cx, 94, n, 11.5, INK, 'bold', 'middle')
        b += T(cx, 109, s_, 8.6, MUTED, 'normal', 'middle')
        if i < 8:
            b += arrow(cx + 20, 58, cx + cw - 20, 58, '#9ca3af', 1.4)
    write('overview.svg', 700, 150, b)


# ---------------------------------------------------------------- windows (700 x 200)
def windows():
    b = T(0, 16, 'WHEN: only a CHoCH candle that CLOSES in a green zone counts (New York time, ET)', 12, INK, 'bold')
    x0, x1 = 170, 640
    t0, t1 = 8.5, 16.0
    X = lambda h: x0 + (h - t0) / (t1 - t0) * (x1 - x0)
    y = 44
    b += T(0, y + 25, 'New York time (ET)', 10.5, INK, 'bold')
    b += R(X(8.5), y, X(9.5) - X(8.5), 40, fill=UP, op=0.25, stroke=GREEN)
    b += R(X(9.5), y, X(10.5) - X(9.5), 40, fill='#9ca3af', op=0.25, stroke='#9ca3af')
    b += R(X(10.5), y, X(11.5) - X(10.5), 40, fill=UP, op=0.25, stroke=GREEN)
    b += R(X(11.5), y, X(16) - X(11.5), 40, fill='#f3f4f6', stroke=LINE)
    b += T((X(8.5) + X(9.5)) / 2, y + 24, 'CHoCH OK', 10, GREEN, 'bold', 'middle')
    b += T((X(9.5) + X(10.5)) / 2, y + 24, 'SKIP', 10, MUTED, 'bold', 'middle')
    b += T((X(10.5) + X(11.5)) / 2, y + 24, 'CHoCH OK', 10, GREEN, 'bold', 'middle')
    b += T((X(11.5) + X(16)) / 2, y + 17, 'no NEW setups after 11:30', 10, MUTED, 'normal', 'middle')
    b += T((X(11.5) + X(16)) / 2, y + 31, 'an order already placed can still fill and run', 9, MUTED, 'normal', 'middle')
    for h, lab in [(8.5, '08:30'), (9.5, '09:30'), (10.5, '10:30'), (11.5, '11:30'), (16.0, '16:00')]:
        b += L(X(h), y + 40, X(h), y + 48, INK, 1.2)
        b += T(X(h), y + 62, lab, 10.5, INK, 'bold', 'middle')
    b += T(X(9.5), y + 74, '(NY open)', 8.5, MUTED, 'normal', 'middle')
    b += L(X(16), y - 8, X(16), y + 40, RED, 2.2)
    b += T(X(16), y - 12, '16:00 ET: cancel every unfilled order', 9.5, RED, 'bold', 'end')
    yy = 142
    b += T(0, yy, 'The same moments on a Philippine (PH) clock  (US summer = about Mar-Nov, winter = about Nov-Mar):', 10.5, INK, 'bold')
    rows = [('US summer: +12 h', '', ['20:30', '21:30', '22:30', '23:30', '04:00']),
            ('US winter: +13 h', '', ['21:30', '22:30', '23:30', '00:30', '05:00'])]
    for i, (lab, add, ts) in enumerate(rows):
        yr = yy + 22 + i * 22
        b += T(0, yr, lab, 10.5, MUTED, 'bold')
        for h, t in zip([8.5, 9.5, 10.5, 11.5, 16.0], ts):
            b += T(X(h), yr, t, 11, INK, 'bold', 'middle')
    b += T(X(16) + 22, yy + 22, 'next day', 8.5, MUTED) + T(X(16) + 22, yy + 44, 'next day', 8.5, MUTED)
    write('windows.svg', 700, 200, b)


# ---------------------------------------------------------------- swing (480 x 200)
def swing():
    b = T(0, 14, 'SWING HIGH = a high that is the highest of the 5 candles on each side', 11.5, INK, 'bold')
    oy = 38
    highs = [60, 52, 46, 40, 34, 22, 36, 42, 48, 54, 60]
    x0 = 30
    for i, h in enumerate(highs):
        x = x0 + i * 38
        col = DN if i % 3 == 1 else UP
        b += candle(x, h + oy, h + 6 + oy, h + 26 + oy, h + 32 + oy, 12, col)
    sx = x0 + 5 * 38
    b += C(sx, 22 + oy, 13, stroke=ORANGE, sw=2.5)
    b += L(sx + 13, 22 + oy, x0 + 11 * 38 - 20, 22 + oy, ORANGE, 1.8, '5 3')
    b += T(sx + 20, 17 + oy, 'SWING HIGH', 10.5, ORANGE, 'bold')
    yb = 126 + oy - 8
    b += L(x0, yb, sx - 8, yb, BLUE, 2) + L(sx + 8, yb, x0 + 10 * 38, yb, BLUE, 2)
    for xx in (x0, sx - 8, sx + 8, x0 + 10 * 38):
        b += L(xx, yb - 4, xx, yb + 4, BLUE, 2)
    b += T((x0 + sx - 8) / 2, yb + 18, '5 candles with LOWER highs', 10.5, BLUE, 'bold', 'middle')
    b += T((sx + 8 + x0 + 10 * 38) / 2, yb + 18, '5 candles with LOWER highs', 10.5, BLUE, 'bold', 'middle')
    b += T(240, 192, 'A swing LOW is the mirror image. It is "confirmed" only after the 5 candles after it have printed.', 9.4, MUTED, 'normal', 'middle')
    write('swing.svg', 480, 200, b)


# ---------------------------------------------------------------- choch (480 x 200)
def choch():
    b = ''
    panels = [('COUNTS', GREEN, True, 'closes ABOVE the line,\nbig candle'), ('NO: wick only', RED, False, 'wick pokes above but the\nclose is back below'),
              ('NO: too small', RED, False, 'closes above but the candle\nis smaller than 1 ATR')]
    for k, (title, col, ok, note) in enumerate(panels):
        ox = 6 + k * 158
        b += R(ox, 4, 150, 192, fill='#fbfbfd', stroke=LINE, rx=8)
        b += T(ox + 75, 22, title, 11.5, col, 'bold', 'middle')
        b += L(ox + 8, 78, ox + 142, 78, ORANGE, 1.8, '5 3')
        b += T(ox + 10, 72, 'swing high', 8.5, ORANGE, 'bold')
        for i, (a, c) in enumerate([(86, 100), (92, 106), (98, 112), (104, 118), (108, 122)]):
            b += candle(ox + 18 + i * 17, a - 3, a, c, c + 3, 9, DN)
        x = ox + 118
        if k == 0:
            b += candle(x, 40, 46, 112, 118, 12, UP)
            b += check(ox + 75, 140)
        elif k == 1:
            b += candle(x, 54, 86, 112, 116, 12, DN)
            b += cross(ox + 75, 140)
        else:
            b += candle(x, 64, 70, 78, 80, 12, UP)
            b += L(ox + 140, 44, ox + 140, 100, BLUE, 2) + L(ox + 136, 44, ox + 144, 44, BLUE, 2) + L(ox + 136, 100, ox + 144, 100, BLUE, 2)
            b += T(ox + 136, 112, '1 ATR', 8.5, BLUE, 'bold', 'end')
            b += cross(ox + 75, 140)
        b += T(ox + 75, 166, note, 9.5, INK, 'normal', 'middle')
    write('choch.svg', 480, 200, b)


# ---------------------------------------------------------------- fvg (480 x 200)
def fvg():
    b = ''
    titles = [('BULLISH GAP (for a long)', GREEN), ('BEARISH GAP (for a short)', RED), ('NO GAP: wicks overlap', MUTED)]
    for k, (title, col) in enumerate(titles):
        ox = 6 + k * 158
        b += R(ox, 4, 150, 192, fill='#fbfbfd', stroke=LINE, rx=8)
        b += T(ox + 75, 22, title, 10.5, col, 'bold', 'middle')
        flip = 95 if k == 1 else None
        c1 = dict(wt=108, bt=112, bb=134, wb=140)
        c2 = dict(wt=50, bt=56, bb=112, wb=120)
        c3 = dict(wt=44, bt=48, bb=76, wb=84) if k != 2 else dict(wt=44, bt=48, bb=88, wb=118)
        g_top, g_bot = 108, 84
        colr = UP if k != 1 else DN
        if k == 0 or k == 1:
            yb, yt = (g_bot, g_top) if flip is None else (2 * flip - g_top, 2 * flip - g_bot)
            b += R(ox + 18, yb, 100, yt - yb, fill=colr, op=0.25, stroke=colr, sw=1.2)
        for i, cd in enumerate((c1, c2, c3)):
            x = ox + 32 + i * 34
            b += candle(x, cd['wt'], cd['bt'], cd['bb'], cd['wb'], 14, colr, flip)
            b += number(x, 156, i + 1, BLUE, 9)
        if k == 0:
            b += T(ox + 75, 178, 'low of candle 3 is ABOVE\nhigh of candle 1 = gap', 9.3, INK, 'normal', 'middle')
        elif k == 1:
            b += T(ox + 75, 178, 'high of candle 3 is BELOW\nlow of candle 1 = gap', 9.3, INK, 'normal', 'middle')
        else:
            b += L(ox + 14, 108, ox + 136, 108, RED, 1.2, '3 3')
            b += cross(ox + 120, 36, 7)
            b += T(ox + 75, 178, 'candle 3 dips back to candle 1\n= nothing to trade', 9.3, INK, 'normal', 'middle')
    write('fvg.svg', 480, 200, b)


# ---------------------------------------------------------------- levels (480 x 200)
def levels(focus=None, fname='levels.svg', short=False):
    pale = {'t': '#bbe5c9', 'e': '#bfd2f7', 's': '#f3c1c1'}
    full = {'t': GREEN, 'e': BLUE, 's': RED}
    col = {k: (full[k] if focus in (None, k) else pale[k]) for k in full}
    wd = {k: (3.4 if focus == k else 2.4) for k in full}
    sub = {k: (MUTED if focus in (None, k) else '#b6bcc6') for k in full}
    side = 'a SHORT is shown; a long is the mirror' if short else 'a long is shown; a short is the mirror'
    b = T(0, 14, 'THE PLAN: 3 lines, drawn BEFORE you enter (' + side + ')', 11, INK, 'bold')
    if short:
        sy, ey, ty = 40, 68, 152     # stop above, target 3R below
    else:
        ty, ey, sy = 40, 124, 152    # target 3R above, stop below
    top, bot = min(ty, sy), max(ty, sy)
    b += R(8, min(ty, ey), 142, abs(ey - ty), fill=GREEN, op=0.07) + R(8, min(ey, sy), 142, abs(sy - ey), fill=RED, op=0.12)
    b += R(8, ey - 12, 52, 24, fill=(DN if short else UP), op=0.30, stroke=(DN if short else UP))
    b += T(34, ey - 16 if not short else ey + 24, 'gap (FVG)', 9, (RED if short else GREEN), 'bold', 'middle')
    b += L(8, ty, 150, ty, col['t'], wd['t']) + L(8, ey, 150, ey, col['e'], wd['e']) + L(8, sy, 150, sy, col['s'], wd['s'])
    b += L(84, ey, 84, ty, col['t'], 1.8) + T(90, (ty + ey) / 2 + 4, '3R = +$30', 10.5, col['t'], 'bold')
    b += L(84, ey, 84, sy, col['s'], 1.8) + T(90, (ey + sy) / 2 + 4, '1R = -$10', 10, col['s'], 'bold')
    tt = 'TARGET'
    lab = [(ty, 't', 'TARGET', '= entry - 3 x risk' if short else '= entry + 3 x risk'), (ey, 'e', 'ENTRY (limit order)', '= the middle of the gap'),
           (sy, 's', 'STOP', 'just past the extreme')]
    for y, k, name, note in lab:
        b += T(160, y + 4, name, 11, col[k], 'bold') + T(160, y + 17, note, 9, sub[k])
    b += R(340, 28, 136, 150, fill='#fffbeb', stroke=ORANGE, rx=8)
    b += T(408, 46, 'SIZE THE TRADE', 10.5, ORANGE, 'bold', 'middle')
    b += T(348, 64, 'Position size =\nrisk $ / stop distance', 9.3, INK, 'bold')
    b += T(348, 100, 'Example (ETH long):\nentry 3,914.65\nstop  3,870.07\ndistance 44.58 (1.14%)', 8.8, MUTED)
    b += T(348, 156, '$10 / 44.58 = 0.224 ETH\n(about $878 position)', 9, INK, 'bold')
    write(fname, 480, 200, b)


# ---------------------------------------------------------------- cancel (480 x 200)
def cancel():
    b = T(0, 14, 'CANCEL the limit order (do not enter late) if ANY of these happens first:', 11.5, INK, 'bold')
    cards = [('1', 'Not filled within 8 candles', 'about 2 hours after the gap formed.\nThe pullback never came.'),
             ('2', 'Structure breaks the other way', 'an opposite CHoCH / break appears.\nThe idea is dead.'),
             ('3', 'Price reaches the TARGET first', 'it ran without you.\nNever chase it.'),
             ('4', '16:00 ET (New York close)', 'cancel every unfilled order\nat the end of the NY session.')]
    for i, (n, t, d) in enumerate(cards):
        ox, oy = 4 + (i % 2) * 238, 28 + (i // 2) * 84
        b += R(ox, oy, 230, 76, fill='#faf5ff', stroke=PURPLE, rx=8)
        b += number(ox + 20, oy + 22, n, PURPLE, 11)
        b += T(ox + 38, oy + 26, t, 10.8, PURPLE, 'bold')
        b += T(ox + 14, oy + 46, d, 9.6, INK)
    write('cancel.svg', 480, 200, b)


# ---------------------------------------------------------------- manage (480 x 200)
def manage():
    b = T(0, 14, 'AFTER THE ORDER FILLS: only two stop moves are allowed', 11.5, INK, 'bold')
    b += R(4, 70, 96, 50, fill='#dbeafe', stroke=BLUE, rx=8) + T(52, 92, 'ORDER FILLED', 10.5, BLUE, 'bold', 'middle') + T(52, 106, 'stop 1R away', 9, MUTED, 'normal', 'middle')
    b += arrow(100, 95, 128, 95, '#9ca3af')
    b += R(130, 30, 170, 60, fill='#fff7ed', stroke=ORANGE, rx=8)
    b += T(215, 48, 'A) price reaches +1R', 10.8, ORANGE, 'bold', 'middle') + T(215, 64, 'move the STOP to ENTRY', 10, INK, 'bold', 'middle') + T(215, 78, '(worst case now = about zero)', 9, MUTED, 'normal', 'middle')
    b += R(130, 104, 170, 70, fill='#faf5ff', stroke=PURPLE, rx=8)
    b += T(215, 122, 'B) after 4 candles', 10.8, PURPLE, 'bold', 'middle') + T(215, 137, 'price never got to +0.25R?', 10, INK, 'bold', 'middle') + T(215, 152, 'pull the STOP in to -0.5R', 10, INK, 'bold', 'middle') + T(215, 166, '(cut the weak trade early)', 9, MUTED, 'normal', 'middle')
    b += arrow(300, 60, 330, 52, '#9ca3af') + arrow(300, 76, 330, 104, '#9ca3af') + arrow(300, 139, 330, 150, '#9ca3af')
    b += R(332, 26, 144, 52, fill='#dcfce7', stroke=GREEN, rx=8) + T(404, 46, 'TARGET  +3R', 11, GREEN, 'bold', 'middle') + T(404, 62, 'about +$30', 10, INK, 'normal', 'middle')
    b += R(332, 88, 144, 40, fill='#f3f4f6', stroke='#9ca3af', rx=8) + T(404, 106, 'BREAKEVEN  about 0', 10.5, MUTED, 'bold', 'middle') + T(404, 120, 'stopped at entry', 9, MUTED, 'normal', 'middle')
    b += R(332, 138, 144, 40, fill='#fee2e2', stroke=RED, rx=8) + T(404, 155, 'STOP  -1R or -0.5R', 10.5, RED, 'bold', 'middle') + T(404, 169, '-$10 or -$5', 9.5, INK, 'normal', 'middle')
    b += T(4, 188, 'Never move a stop further away. Never take profit early.', 10, RED, 'bold')
    write('manage.svg', 480, 200, b)


# ---------------------------------------------------------------- outcomes (480 x 200)
def outcomes():
    b = T(0, 14, 'WHAT 154 BACKTESTED TRADES LOOKED LIKE (SOL + ETH, 2023-26, $10 risk)', 11, INK, 'bold')
    data = [('Hit the 3R target', 47, GREEN, '+$30 each'), ('Stopped at breakeven (about $0)', 55, '#9ca3af', 'about $0'), ('Stopped out (-$10 or -$5)', 52, RED, '-$10 / -$5')]
    tot = sum(d[1] for d in data)
    x = 6
    for lab, n, col, sub in data:
        w = n / tot * 468
        b += R(x, 34, w - 3, 46, fill=col, rx=4)
        b += T(x + (w - 3) / 2, 54, f'{n / tot * 100:.0f}%', 16, 'white', 'bold', 'middle')
        b += T(x + (w - 3) / 2, 71, f'{n} trades', 9.5, 'white', 'normal', 'middle')
        b += T(x + (w - 3) / 2, 96, lab, 9.6, col if col != '#9ca3af' else MUTED, 'bold', 'middle')
        x += w
    b += R(6, 112, 468, 78, fill='#f9fafb', stroke=LINE, rx=8)
    b += T(18, 132, 'Roughly 1 trade in 3 reaches the target; the rest are small scratches or losses.', 10.5, INK, 'bold')
    b += T(18, 150, 'Average trade: about +$5.7 at $10 risk (about 4 trades a month across SOL + ETH).', 10, INK)
    b += T(18, 166, 'Longest stretch without a winner: 8 trades in a row. Biggest drawdown about -$57.', 10, RED, 'bold')
    b += T(18, 181, 'These are backtest results on data the rules were tuned on - not a promise.', 9.2, MUTED)
    write('outcomes.svg', 480, 200, b)


for fn in (overview, windows, swing, choch, fvg, levels, cancel, manage, outcomes):
    fn()
levels('e', 'levels-entry.svg')
levels('s', 'levels-stop.svg')
levels('t', 'levels-target.svg')
levels(None, 'levels-short.svg', short=True)
print('wrote', sorted(os.listdir(OUT)))
