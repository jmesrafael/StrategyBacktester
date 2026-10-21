"""build_pdf.py — builds the NY SMC v7 trading-system steps PDF (DRAFT).
usage:  python build_pdf.py <trades.json> <outdir>
  trades.json : from `node ../export-examples.js trades.json`
Real candles (Bybit 15m) are drawn by charts.py; schematic diagrams are the SVGs in ./svg (svgs.py) embedded as vectors.
"""
import os
import sys

import matplotlib
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg

import charts

HERE = os.path.dirname(os.path.abspath(__file__))
TRADES, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
IMG = os.path.join(OUT, 'img')
os.makedirs(IMG, exist_ok=True)
PDF_PATH = os.path.join(OUT, '..', '..', '..', 'PDF', 'NY SMC v7 - Trading System Steps (Draft).pdf')

# ---- fonts (DejaVu ships with matplotlib: has check marks, arrows, >=, x ...) ----
fdir = os.path.join(os.path.dirname(matplotlib.__file__), 'mpl-data', 'fonts', 'ttf')
pdfmetrics.registerFont(TTFont('DV', os.path.join(fdir, 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DV-B', os.path.join(fdir, 'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFont(TTFont('DV-I', os.path.join(fdir, 'DejaVuSans-Oblique.ttf')))
pdfmetrics.registerFontFamily('DV', normal='DV', bold='DV-B', italic='DV-I', boldItalic='DV-B')

W, H = 792, 612
M = 30
INK, MUTED = colors.HexColor('#1f2937'), colors.HexColor('#6b7280')
BLUE, GREEN, RED, ORANGE, PURPLE = [colors.HexColor(x) for x in ('#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed')]
LIGHT = colors.HexColor('#f3f4f6')

ST = {
    'body': ParagraphStyle('body', fontName='DV', fontSize=9.2, leading=12.4, textColor=INK),
    'small': ParagraphStyle('small', fontName='DV', fontSize=8, leading=10.5, textColor=MUTED),
    'cap': ParagraphStyle('cap', fontName='DV-I', fontSize=7.8, leading=10, textColor=MUTED),
    'big': ParagraphStyle('big', fontName='DV', fontSize=12, leading=17, textColor=INK),
}

trades = charts.load(TRADES)
EX, EX_SHORT = trades['ETH-120'], trades['ETH-92']
STEP_PNG = {}
for k in range(1, 10):
    STEP_PNG[k] = os.path.join(IMG, f'eth120-{k}.png')
    charts.render(EX, k, STEP_PNG[k])
SHORT_PNG = os.path.join(IMG, 'eth92-9.png')
charts.render(EX_SHORT, 9, SHORT_PNG)
HERO_PNG = os.path.join(IMG, 'eth120-hero.png')
charts.render(EX, 9, HERO_PNG, size=(8.4, 5.0))

c = canvas.Canvas(PDF_PATH, pagesize=(W, H))
c.setTitle('NY SMC v7 - Trading System Steps (DRAFT)')
c.setAuthor('Strategy Backtester research')
c.setSubject('CHoCH to FVG limit entry, SOL and ETH 15m, New York morning')
page_no = [0]


def footer(label='DRAFT 1 - for review'):
    page_no[0] += 1
    c.setFont('DV', 7.5)
    c.setFillColor(MUTED)
    c.drawString(M, 16, f'NY SMC v7 - trading system steps   |   {label}   |   SOL / ETH perpetual, 15m   |   not financial advice')
    c.drawRightString(W - M, 16, f'{page_no[0]}')


def para_h(text, style, w):
    p = Paragraph(text, style)
    _, h = p.wrap(w, 1000)
    return p, h


def draw_svg(name, x, ytop, w):
    d = svg2rlg(os.path.join(HERE, 'svg', name))
    s = w / d.width
    d.scale(s, s)
    h = d.height * s
    renderPDF.draw(d, c, x, ytop - h)
    return ytop - h


def image(path, x, ytop, w):
    ir = ImageReader(path)
    iw, ih = ir.getSize()
    h = w * ih / iw
    c.drawImage(ir, x, ytop - h, width=w, height=h, mask='auto')
    return ytop - h


def box(x, ytop, w, title, color, items, numbered=False, fill=None, fs=None):
    """titled rounded box with bullet / numbered items; returns the bottom y"""
    st = ParagraphStyle('i', parent=ST['body'], fontSize=fs or 9.2, leading=(fs or 9.2) * 1.36, leftIndent=13, bulletIndent=0, spaceAfter=3)
    paras, total = [], 0
    for i, t in enumerate(items, 1):
        p = Paragraph(t, st, bulletText=(f'{i}.' if numbered else '•'))
        _, h = p.wrap(w - 24, 1000)
        paras.append((p, h))
        total += h + 3
    hh = 24 + total + 4
    c.setFillColor(fill or colors.white)
    c.setStrokeColor(color)
    c.setLineWidth(1.4)
    c.roundRect(x, ytop - hh, w, hh, 7, fill=1, stroke=1)
    c.setFillColor(color)
    c.roundRect(x, ytop - 19, w, 19, 7, fill=1, stroke=0)
    c.rect(x, ytop - 19, w, 8, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont('DV-B', 8.8)
    c.drawString(x + 9, ytop - 13, title)
    y = ytop - 24
    for p, h in paras:
        p.drawOn(c, x + 10, y - h)
        y -= h + 3
    return ytop - hh


def header(n, title, sub=None):
    c.setFillColor(colors.HexColor('#0f172a'))
    c.rect(0, H - 44, W, 44, fill=1, stroke=0)
    if n:
        c.setFillColor(BLUE if n <= 3 else RED if n <= 6 else GREEN)
        c.circle(M + 14, H - 22, 14, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont('DV-B', 15)
        c.drawCentredString(M + 14, H - 27, str(n))
        tx = M + 38
    else:
        tx = M
    c.setFillColor(colors.white)
    c.setFont('DV-B', 17)
    c.drawString(tx, H - 28, title)
    if n:
        # progress dots
        for i in range(1, 10):
            cx = W - M - (9 - i) * 17
            c.setFillColor(BLUE if i <= 3 else RED if i <= 6 else GREEN)
            c.setFillAlpha(1 if i == n else 0.35)
            c.circle(cx, H - 22, 5.2 if i == n else 3.8, fill=1, stroke=0)
        c.setFillAlpha(1)
    elif sub:
        c.setFont('DV', 9)
        c.setFillColor(colors.HexColor('#cbd5e1'))
        c.drawRightString(W - M, H - 27, sub)


def step_page(n, title, svg, do, rule, dont, caption, png=None, extra=None):
    header(n, title)
    png = png or STEP_PNG[n]
    LW = 492
    y = image(png, M, H - 54, LW)
    c.setFont('DV-I', 7.6)
    c.setFillColor(MUTED)
    c.drawString(M, y - 9, caption)
    draw_svg(svg, M + 4, y - 14, LW - 8)
    x = M + LW + 16
    w = W - M - x
    yy = H - 54
    yy = box(x, yy, w, 'WHAT TO DO', BLUE, do, numbered=True, fill=colors.HexColor('#f8fbff')) - 8
    yy = box(x, yy, w, 'THE RULE (all must be true)', ORANGE, rule, fill=colors.HexColor('#fffbeb')) - 8
    yy = box(x, yy, w, "DON'T", RED, dont, fill=colors.HexColor('#fff7f7')) - 8
    if extra:
        box(x, yy, w, extra[0], PURPLE, extra[1], fill=colors.HexColor('#faf5ff'))
    footer()
    c.showPage()


# =============================================================== PAGE 1: cover
c.setFillColor(colors.HexColor('#0f172a'))
c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(colors.HexColor('#38bdf8'))
c.setFont('DV-B', 10)
c.drawString(M + 4, H - 52, 'TRADING SYSTEM STEPS  |  DRAFT 1 FOR REVIEW')
c.setFillColor(colors.white)
c.setFont('DV-B', 34)
c.drawString(M + 4, H - 100, 'NY SMC v7')
c.setFont('DV-B', 19)
c.drawString(M + 4, H - 130, 'CHoCH  ->  Gap (FVG)  ->  limit entry')
c.setFont('DV', 11.5)
c.setFillColor(colors.HexColor('#cbd5e1'))
for i, t in enumerate(['A rule-based New York morning setup for SOL and ETH perpetual futures,',
                       'shown step by step on real candles, with circles, lines and labels.']):
    c.drawString(M + 4, H - 156 - i * 16, t)
image(HERO_PNG, M, H - 196, 492)
# right panel: facts
x0 = M + 492 + 18
wp = W - M - x0
c.setFillColor(colors.white)
c.roundRect(x0, 40, wp, H - 90 - 0, 10, fill=1, stroke=0)
yy = H - 62
c.setFillColor(INK)
c.setFont('DV-B', 11)
c.drawString(x0 + 12, yy, 'THE SYSTEM IN ONE SENTENCE')
p, h = para_h('In the first hours of New York trading, wait for price to <b>break the last swing with a strong candle</b>, then '
              '<b>buy (or sell) the pullback</b> into the first gap, with a fixed stop and a <b>3x target</b>.', ST['body'], wp - 24)
p.drawOn(c, x0 + 12, yy - 8 - h)
yy -= h + 26
facts = [('Markets', 'SOLUSDT, ETHUSDT perpetuals'), ('Chart', '15-minute candles'), ('When', '08:30-09:30 + 10:30-11:30 ET'),
         ('Order', 'limit order at 50% of the gap'), ('Reward : risk', '3 : 1  (target = 3 x risk)'), ('Risk per trade', 'one fixed small amount'),
         ('Trades', 'about 4 a month (both coins)'), ('Typical hold', 'about 4 hours (median)')]
c.setFont('DV-B', 8.5)
for k, v in facts:
    c.setFillColor(MUTED)
    c.setFont('DV-B', 8)
    c.drawString(x0 + 12, yy, k.upper())
    c.setFillColor(INK)
    c.setFont('DV', 9.4)
    c.drawString(x0 + 12, yy - 12, v)
    yy -= 30
# status
c.setFillColor(colors.HexColor('#fef3c7'))
c.setStrokeColor(ORANGE)
c.roundRect(x0 + 8, 52, wp - 16, 96, 8, fill=1, stroke=1)
c.setFillColor(colors.HexColor('#92400e'))
c.setFont('DV-B', 9)
c.drawString(x0 + 18, 134, 'STATUS: BACKTESTED, NOT PROVEN')
p, h = para_h('Profitable in 2023-26 backtests and better than random entries, but it <b>lost money in 2021-23</b>. '
              'Treat it as a candidate: <b>paper trade 40 trades first</b>, then start tiny.', ParagraphStyle('s', parent=ST['body'], fontSize=8.4, leading=11, textColor=colors.HexColor('#78350f')), wp - 36)
p.drawOn(c, x0 + 18, 126 - h)
c.setFillColor(colors.HexColor('#94a3b8'))
c.setFont('DV', 7.5)
c.drawString(M + 4, 24, 'Charts: real Bybit 15m candles, drawn in the style of the app\'s SMC Toolkit. Example trade: ETHUSDT, Fri 26 Sep 2025 (long, +3R). Not financial advice.')
page_no[0] += 1
c.showPage()

# =============================================================== PAGE 2: at a glance
header(0, 'The system at a glance', 'NY SMC v7 | SOL / ETH | 15m')
y = draw_svg('overview.svg', M, H - 58, W - 2 * M)
y = draw_svg('windows.svg', M + 6, y - 8, W - 2 * M - 12)
colw = (W - 2 * M - 20) / 3
yb = y - 12
facts = [('BLUE: FIND THE SETUP', BLUE, ['Mark the last <b>swing</b> (5 candles each side).', 'A candle <b>closes beyond</b> it = <b>CHoCH</b> (big candle, right time).',
                                        'Mark the <b>first gap</b> (FVG) after it.']),
         ('RED: PLAN THE TRADE', RED, ['<b>Limit order</b> in the middle of the gap.', '<b>Stop</b> just past the extreme of the move.', '<b>Target</b> = 3 x the risk. Size = risk $ / stop distance.']),
         ('GREEN: MANAGE IT', GREEN, ['<b>Cancel</b> the order if it is stale or wrong.', 'At <b>+1R</b> move the stop to entry; no follow-through after 4 candles: stop to -0.5R.', '<b>Log</b> every trade, win or lose.'])]
for i, (t, col, it) in enumerate(facts):
    box(M + i * (colw + 10), yb, colw, t, col, it, fs=9)
footer()
c.showPage()

# =============================================================== STEP PAGES
CAP = 'Real trade: ETHUSDT perp, 15m, long, Fri 26 Sep 2025 (+3R). Times on the chart are New York time (ET).'
step_page(1, 'Find the trend and the last swing', 'swing.svg',
          ['Open a <b>15-minute</b> chart of SOLUSDT or ETHUSDT (perpetual). Show New York time, or know your offset (page 2).',
           'Look at the hours before the NY open: for a <b>LONG</b> you want a <b>downtrend</b> (lower highs, lower lows). For a SHORT, the opposite.',
           'Find the <b>last swing high</b> (long) or swing low (short): the extreme of 5 candles on each side.',
           'Draw a horizontal line at its price. This is <b>"the line to beat"</b>.'],
          ['The swing is <b>confirmed</b>: the 5 candles after it have already printed.', 'The app\'s <b>SMC Toolkit</b> marks swings and CHoCH lines for you.'],
          ['Use a tiny wiggle inside a sideways range.', 'Use a swing that is not confirmed yet.', 'Trade before you have the line drawn.'], CAP)
step_page(2, 'Wait for the CHoCH candle', 'choch.svg',
          ['Wait for a candle that <b>CLOSES beyond the line</b>: above it for a long, below it for a short.',
           'Check the <b>clock</b>: the candle must close between <b>08:30-09:30</b> or <b>10:30-11:30 ET</b>. The 09:30-10:30 open hour is skipped.',
           'Check the <b>size</b>: its high-low must be at least <b>1 x ATR(14)</b> (one average candle).',
           'All three true: go to step 3. Any false: <b>no trade</b>, wait for the next one.'],
          ['Close beyond the line (a wick does not count).', 'Closes inside the green windows.', 'Candle range >= 1.0 x ATR(14).'],
          ['Enter on this candle or chase it.', 'Count a wick that closed back inside.', 'Trade signals from 09:30-10:30 ET (they lost money in testing).'], CAP)
step_page(3, 'Mark the first gap (FVG)', 'fvg.svg',
          ['Look at the CHoCH candle and the candles right after it (up to <b>10 candles</b>).',
           'Find the <b>first</b> 3-candle gap in your direction. Long: low of candle 3 is <b>above</b> the high of candle 1. Short: high of 3 <b>below</b> the low of 1.',
           'Draw a box from the high of candle 1 to the low of candle 3.',
           'The box must be at least <b>0.2 x ATR</b> tall (not a sliver).'],
          ['The gap is the FIRST one after the CHoCH.', 'It appears within 10 candles of the CHoCH.', 'Height >= 0.2 x ATR. No gap = <b>no trade</b>.'],
          ['Use an old gap from earlier in the day.', 'Use "gaps" where the wicks still overlap.', 'Trade without a gap because the candle "looked strong".'], CAP)
step_page(4, 'Place the limit order at 50%', 'levels-entry.svg',
          ['Work out the middle of the box: <b>(top + bottom) / 2</b>.',
           'As soon as candle 3 has closed, place a <b>LIMIT order</b> at that price: buy for a long, sell for a short.',
           'Then wait. Price has to come back to you. If it does not, the order simply expires (step 7).'],
          ['Entry = exactly the middle of the gap.', 'It is a <b>limit</b> order, placed after candle 3 closes.'],
          ['Buy at market or chase price.', 'Move the order closer "so it fills".', 'Worry about the clock: the fill itself can happen any time before 16:00 ET.'], CAP)
step_page(5, 'Set the stop', 'levels-stop.svg',
          ['Find the <b>lowest low</b> (long) or highest high (short) between the swing line and the CHoCH candle: the extreme of that move.',
           'Stop = that price <b>0.02% beyond</b> it (below for a long, above for a short).',
           'Measure the distance entry to stop. If it is more than <b>4 x ATR</b>, skip the trade.',
           'Set the stop order at the same time as the entry.'],
          ['Stop sits just beyond the extreme of the CHoCH move.', 'Stop distance <= 4 x ATR(14).'],
          ['Put the stop closer to "risk less".', 'Move it further away later.', 'Trade without a stop.'], CAP)
step_page(6, 'Set the target and size the trade', 'levels-target.svg',
          ['<b>Target = entry + 3 x (entry - stop)</b> for a long. For a short, entry - 3 x (stop - entry).',
           'Position size = <b>risk $ / stop distance</b>. Example (ETH): $10 / 44.58 = 0.224 ETH.',
           'The same small amount is risked on every trade, so a stop-out always costs 1R and a target wins 3R.',
           'Place the target order together with the stop.'],
          ['Reward is exactly 3 x the risk.', 'Risk per trade is the same fixed amount (1% of the account or less).'],
          ['Pick a bigger size because you feel sure.', 'Pull the target closer to "get paid sooner".', 'Risk more after a losing streak.'], CAP,
          extra=('WHY 3 : 1?', ['Only about 1 trade in 3 reaches the target, but each win pays three times a loss.']))
step_page(7, 'Know when to cancel', 'cancel.svg',
          ['Once the limit order is in, keep watching these four triggers.',
           'If <b>any</b> happens before the order fills: <b>cancel it</b> and wait for the next setup.',
           'A cancelled order is a normal outcome, not a failure. Writing it down is part of the job.'],
          ['Not filled within <b>8 candles</b>.', 'An <b>opposite</b> CHoCH / structure break appears.', 'Price <b>reaches the target</b> without filling you.', 'It is <b>16:00 ET</b>.'],
          ['Leave a stale order sitting overnight.', 'Re-enter at market after a cancel.', 'Trade two setups on one coin at the same time.'], CAP)
step_page(8, 'After the fill: manage it', 'manage.svg',
          ['Your order is filled and your stop and target are in. Now <b>do nothing</b> except two stop moves.',
           'At <b>+1R</b>: move the stop to your <b>entry</b>. The trade can no longer lose much.',
           'After <b>4 candles</b>: if price never got to +0.25R, pull the stop in to <b>-0.5R</b>.',
           'Otherwise leave it alone until the stop or the target is hit.'],
          ['Two stop moves only: +1R to entry, and the 4-candle check.', 'The target stays at 3R.'],
          ['Widen a stop or remove it.', 'Take profit early or move the target.', 'Add to the position.'], CAP)
step_page(9, 'Review: the result and the log', 'outcomes.svg',
          ['The trade ends one of three ways: <b>target (+3R)</b>, <b>breakeven (about 0)</b>, or <b>stopped out</b> (-1R or -0.5R).',
           'Write one line in your log: date, coin, long/short, CHoCH time (ET), entry, stop, target, result in R.',
           'Take a screenshot of the chart. Note anything you broke the rules on.',
           'Count your trades. The plan is to log <b>40 paper trades</b> before real money.'],
          ['Every trade is logged, including cancelled and skipped setups.'],
          ['Judge the system on one or two trades.', 'Change a rule because of a loss.', 'Skip logging the bad ones.'], 'Result of the example trade: target hit, +3.0R (about +$30 on $10 risk).')

# =============================================================== short mirror page
header(0, 'Shorts are the mirror image', 'same rules, flipped')
y = image(SHORT_PNG, M, H - 54, 492)
c.setFont('DV-I', 7.6)
c.setFillColor(MUTED)
c.drawString(M, y - 9, 'Real trade: ETHUSDT perp, 15m, SHORT, Sun 11 Aug 2024, CHoCH at 10:45 ET (+3R). New York time.')
draw_svg('levels-short.svg', M + 4, y - 14, 484)
x = M + 492 + 16
w = W - M - x
rows = [['', 'LONG', 'SHORT'], ['Trend before', 'downtrend', 'uptrend'], ['Line to beat', 'last swing high', 'last swing low'], ['CHoCH candle', 'closes above', 'closes below'],
        ['Gap (FVG)', 'low of 3 above\nhigh of 1', 'high of 3 below\nlow of 1'], ['Entry', 'limit BUY at 50%', 'limit SELL at 50%'], ['Stop', 'below the low\nof the move', 'above the high\nof the move'],
        ['Target', 'above: entry + 3R', 'below: entry - 3R'], ['+1R / 4-candle', 'same', 'same']]
tb = Table([[Paragraph(str(v).replace('\n', '<br/>'), ParagraphStyle('t', parent=ST['body'], fontSize=8.4, leading=10.6, fontName='DV-B' if (i == 0 or j == 0) else 'DV', textColor=(colors.white if i == 0 else INK))) for j, v in enumerate(r)] for i, r in enumerate(rows)],
           colWidths=[w * 0.30, w * 0.35, w * 0.35])
tb.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white), ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
                        ('BACKGROUND', (1, 1), (1, -1), colors.HexColor('#ecfdf5')), ('BACKGROUND', (2, 1), (2, -1), colors.HexColor('#fef2f2')), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
tw, th = tb.wrap(w, 1000)
tb.drawOn(c, x, H - 54 - th)
box(x, H - 54 - th - 12, w, 'REMEMBER', ORANGE, ['Every rule on pages 3-10 applies unchanged: windows, candle size, gap size, 8-candle expiry, 16:00 ET.', 'Both directions made money in the 3-year test (longs +$499, shorts +$376 at $10 risk), but SOL shorts made only +$2 in the last year, so do not expect them to be equal.'], fill=colors.HexColor('#fffbeb'))
footer()
c.showPage()

# =============================================================== DO / DON'T
header(0, 'Must do  /  Must not do', 'the whole system on one page')
half = (W - 2 * M - 16) / 2
do = ['Trade only <b>SOLUSDT and ETHUSDT</b>, on the <b>15-minute</b> chart.', 'Count a CHoCH only if it <b>closes</b> in <b>08:30-09:30 or 10:30-11:30 ET</b>.',
      'Require a <b>big candle</b> (>= 1 ATR) and a <b>real gap</b> (>= 0.2 ATR).', 'Use a <b>limit order at 50%</b> of the gap, with stop and target placed at once.',
      'Risk the <b>same small amount</b> every trade (1% or less; less while testing).', '<b>Cancel</b> after 8 candles / opposite break / target first / 16:00 ET.',
      'Move the stop to entry at <b>+1R</b>; pull it to <b>-0.5R</b> after 4 weak candles.', '<b>Log every setup</b>, including the ones you skipped, and why.',
      '<b>Paper trade 40 trades</b> before any real money.']
dont = ['Buy or sell at market, or chase after the CHoCH candle.', 'Count wicks or small candles as a CHoCH.', 'Take signals from the <b>09:30-10:30 ET</b> hour.',
        '<b>Widen or remove a stop.</b> Ever.', 'Take profit early or drag the target closer.', 'Add to a loser, or double up after a loss.',
        'Use these exact settings on <b>BTC, DOGE, XRP or others</b> (they lost in testing).', 'Hold more than <b>one trade per coin</b> at a time.',
        'Raise your size because of a winning streak.', 'Risk money you cannot afford to lose.']
b1 = box(M, H - 58, half, 'MUST DO', GREEN, do, numbered=True, fill=colors.HexColor('#f0fdf4'), fs=12)
b2 = box(M + half + 16, H - 58, half, 'MUST NOT DO', RED, dont, numbered=True, fill=colors.HexColor('#fef2f2'), fs=12)
footer()
c.showPage()

# =============================================================== CHECKLIST
header(0, 'Printable checklist', 'tick every box before you trade')
cw3 = (W - 2 * M - 24) / 3
cols = [('1  BEFORE THE NY SESSION', BLUE, ['SOLUSDT or ETHUSDT, <b>15m</b> chart', 'Clock set to New York time (or I know my offset)', 'Alert set for <b>08:30 ET</b>', 'Risk amount decided (same every trade)',
                                           'No open trade on this coin', 'Log sheet ready']),
        ('2  SIGNAL APPEARS', RED, ['Last swing high/low marked (5 candles each side)', 'Candle <b>closed</b> beyond it', 'Closed in <b>08:30-09:30</b> or <b>10:30-11:30 ET</b>', 'Candle range >= <b>1 ATR</b>',
                                    'First gap within <b>10 candles</b>', 'Gap height >= <b>0.2 ATR</b>', 'Entry = <b>50%</b> of the gap', 'Stop beyond the move extreme (+0.02%)', 'Stop distance <= <b>4 ATR</b>',
                                    'Target = entry +/- <b>3 x risk</b>', 'Size = risk $ / stop distance', 'Limit + stop + target all placed']),
        ('3  AFTER THAT', GREEN, ['Cancel if: <b>8 candles</b> / opposite break / target first / <b>16:00 ET</b>', 'At <b>+1R</b>: stop to entry', '4 candles, never +0.25R: stop to <b>-0.5R</b>', 'No other stop moves, no early exits',
                                  'Screenshot saved', 'Result written in R', 'Rules broken? Write down which'])]
for i, (t, col, items) in enumerate(cols):
    x = M + i * (cw3 + 12)
    ytop = H - 58
    n_h = sum(Paragraph(it, ParagraphStyle('k', parent=ST['body'], fontSize=9.2, leading=12), ).wrap(cw3 - 36, 500)[1] + 7 for it in items)
    hh = 26 + n_h + 4
    c.setStrokeColor(col)
    c.setFillColor(colors.white)
    c.setLineWidth(1.4)
    c.roundRect(x, ytop - hh, cw3, hh, 7, fill=1, stroke=1)
    c.setFillColor(col)
    c.roundRect(x, ytop - 20, cw3, 20, 7, fill=1, stroke=0)
    c.rect(x, ytop - 20, cw3, 9, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont('DV-B', 9)
    c.drawString(x + 9, ytop - 14, t)
    yy = ytop - 30
    for it in items:
        p = Paragraph(it, ParagraphStyle('k', parent=ST['body'], fontSize=9.2, leading=12))
        _, h = p.wrap(cw3 - 36, 500)
        c.setStrokeColor(col)
        c.setLineWidth(1.3)
        c.setFillColor(colors.white)
        c.rect(x + 9, yy - 10, 10, 10, fill=1, stroke=1)
        p.drawOn(c, x + 25, yy - h + 1)
        yy -= h + 7
draw_svg('windows.svg', M + 6, 232, W - 2 * M - 12)
footer()
c.showPage()

# =============================================================== STATUS
header(0, 'What this is, and what it is not', 'read before risking money')
half = (W - 2 * M - 16) / 2
ev = ['<b>Backtest, Oct 2023 - Oct 2026</b>, SOL + ETH at $10 risk: about <b>+$815 to +$876</b> (154 trades, 26 of 37 months profitable, about +$22-24 a month).',
      '<b>Random entries</b> with the same exits lost about $55 over the same period: the profit is not just the exit rules.',
      'Re-checking exits on <b>1-minute candles</b> and with worst-case ordering kept 92-94% of the profit.']
risk = ['It <b>lost money in Oct 2021 - Oct 2023</b> (SOL -$145, ETH about breakeven). The edge may depend on the 2023-26 market.',
        'The rules were chosen from about 200 tests on the same data, so the results are optimistic.',
        'It was weaker on BTC, DOGE and XRP. Only trade SOL and ETH.',
        'Funding fees, real-time fills and slippage on stops are not fully tested.',
        'Expect long dry spells: the longest run without a winner was <b>8 trades</b> (about 2 months).']
yb1 = box(M, H - 58, half, 'WHAT THE TESTS SHOWED', GREEN, ev, fill=colors.HexColor('#f0fdf4'), fs=10.4)
yb2 = box(M + half + 16, H - 58, half, 'WHAT STILL WORRIES US', RED, risk, fill=colors.HexColor('#fef2f2'), fs=10.4)
yb = min(yb1, yb2)
box(M, yb - 14, W - 2 * M, 'THE PLAN BEFORE REAL MONEY', ORANGE, ['<b>Paper trade 40 trades</b> (about 9-10 months at 4 a month) with this checklist. Use the app\'s replay with the <b>NY SMC v7</b> strategy to practise.',
                                                                'If the paper results are clearly worse than the tests, stop. If they hold up, start with <b>0.25-0.5% risk</b> per trade, not 1%.',
                                                                '<b>Next in this PDF (after you approve this draft):</b> about 10 real winning examples each for SOL and ETH in this same style, app screenshots of the indicator, and a trade-log sheet.'],
    numbered=True, fill=colors.HexColor('#fffbeb'), fs=10.4)
footer()
c.showPage()
c.save()
print('wrote', PDF_PATH, page_no[0], 'pages')
