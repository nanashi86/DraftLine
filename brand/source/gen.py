"""DraftLine brand kit generator: every asset is an SVG with all text outlined, then rendered to PNG."""
import json, os
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')

# ---- palette (from DraftLine's own theme tokens) ----
ACCENT = '#c8553d'      # --accent / icon tile
ACCENT_HI = '#e8836b'   # dark-theme caret
INK_BG = '#18181b'      # manifest background / theme
DESK = '#1b1c1f'
TEXT = '#e9e7e2'
MUTED = '#9a9890'
PAPER = '#fdfcf8'
INK = '#141414'
TEAL = '#8fd0d6'
AMBER = '#f59e0b'

FONTS = {
    'cp-bold': os.path.join(HERE, 'fonts/CourierPrime-Bold.ttf'),
    'cp': os.path.join(HERE, 'fonts/CourierPrime-Regular.ttf'),
    'inter': '/usr/share/fonts/opentype/inter/Inter-Medium.otf',
    'inter-semi': '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf',
    'inter-bold': '/usr/share/fonts/opentype/inter/Inter-Bold.otf',
}
_cache = {}

def _font(key):
    if key not in _cache:
        path = FONTS[key]
        tt = TTFont(path)
        blob = hb.Blob.from_file_path(path)
        _cache[key] = (tt, tt.getGlyphSet(), hb.Font(hb.Face(blob)), tt['head'].unitsPerEm)
    return _cache[key]

def measure(key, s, size, tracking=0):
    tt, gs, f, upem = _font(key)
    buf = hb.Buffer(); buf.add_str(s); buf.guess_segment_properties(); hb.shape(f, buf, {'kern': True, 'liga': True})
    adv = sum(p.x_advance for p in buf.glyph_positions)
    return adv * size / upem + tracking * size * (len(buf.glyph_positions) - 1)

def text(key, s, size, x, y, fill, anchor='start', tracking=0, opacity=None):
    """Outlined text as one <path>. tracking is in em."""
    tt, gs, f, upem = _font(key)
    buf = hb.Buffer(); buf.add_str(s); buf.guess_segment_properties(); hb.shape(f, buf, {'kern': True, 'liga': True})
    order = tt.getGlyphOrder()
    w = measure(key, s, size, tracking)
    if anchor == 'middle': x -= w / 2
    elif anchor == 'end': x -= w
    sc = size / upem
    pen = SVGPathPen(gs)
    cx = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        tp = TransformPen(pen, (sc, 0, 0, -sc, x + (cx + pos.x_offset) * sc, y - pos.y_offset * sc))
        gs[name].draw(tp)
        cx += pos.x_advance + tracking * upem
    op = f' opacity="{opacity}"' if opacity is not None else ''
    return f'<path fill="{fill}"{op} d="{pen.getCommands()}"/>', w

def cap_height(key):
    tt = _font(key)[0]
    return tt['OS/2'].sCapHeight / tt['head'].unitsPerEm

# ---- the mark: exactly the app icon (public/favicon.svg) ----
D_PATH = ('M1155 594Q1155 406 1088 272.5Q1021 139 895 69.5Q769 0 594 0H123Q99 0 86 8Q73 16 66.5 38Q60 60 60 102Q60 144 66.5 166Q73 188 86 196.5Q99 205 123 205H220V982H123Q99 982 86 990Q73 998 66.5 1020Q60 1042 60 1084Q60 1126 66.5 1148Q73 1170 86 1178.5Q99 1187 123 1187H594Q769 1187 895 1118Q1021 1049 1088 915.5Q1155 782 1155 594ZM470 215H574Q729 215 808 311.5Q887 408 887 594Q887 780 808 876Q729 972 574 972H470Z')
# D inside the 512 tile: outline centred left-right, and 8 px above true centre top-to-bottom (optical centre).
# Courier Prime Bold D ink: x 60..1155, y 0..1187 font units; at this scale it is 159.7 x 173.1 px.
# (Until Oct 2026 this was 166.46 321.62, which left the D 21 px high and 1 px left.)
D_IN_TILE = 'matrix(0.145833 0 0 -0.145833 167.406 334.552)'

def mark(x, y, size, tile=ACCENT, glyph='#fff', rounded=True):
    s = size / 512
    rx = 106.67 if rounded else 0
    return (f'<g transform="translate({x} {y}) scale({s})">'
            f'<rect width="512" height="512" rx="{rx}" fill="{tile}"/>'
            f'<path fill="{glyph}" transform="{D_IN_TILE}" d="{D_PATH}"/></g>')

def glyph_only(x, y, size, fill):
    """Just the D, same proportions it has in the tile, sized to a size×size box."""
    s = size / 512
    return f'<g transform="translate({x} {y}) scale({s})"><path fill="{fill}" transform="{D_IN_TILE}" d="{D_PATH}"/></g>'

def circle_icon(size):
    """Full-bleed tile for round crops (Discord, Patreon, Ko-fi avatars): the D is kept well inside the circle."""
    g = size * 1.2  # the D's box; its own padding keeps it centred inside the circle
    off = (size - g) / 2
    return (f'<rect width="{size}" height="{size}" fill="{ACCENT}"/>'
            f'<radialGradient id="cg" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#d86a51"/><stop offset="1" stop-color="#b44a34"/></radialGradient>'
            f'<rect width="{size}" height="{size}" fill="url(#cg)"/>'
            + glyph_only(off, off, g, '#fff'))

def wordmark(x, baseline, size, fill=TEXT, caret=ACCENT, anchor='start'):
    """'DraftLine' in Courier Prime Bold followed by a text-cursor bar."""
    w = measure('cp-bold', 'DraftLine', size)
    cw = size * 0.085; gap = size * 0.07
    total = w + gap + cw
    if anchor == 'middle': x -= total / 2
    p, _ = text('cp-bold', 'DraftLine', size, x, baseline, fill)
    ch = cap_height('cp-bold') * size
    bar = f'<rect x="{x + w + gap:.2f}" y="{baseline - ch * 1.12:.2f}" width="{cw:.2f}" height="{ch * 1.30:.2f}" fill="{caret}"/>'
    return p + bar, total

def lockup(x, cy, h, fill=TEXT, caret=ACCENT, anchor='start'):
    """Mark + wordmark on one line, vertically centred on cy. Returns svg, width."""
    size = h * 0.66  # wordmark size so its caps sit at roughly half the tile height
    ww = measure('cp-bold', 'DraftLine', size) + size * 0.155
    gap = h * 0.32
    total = h + gap + ww
    if anchor == 'middle': x -= total / 2
    ch = cap_height('cp-bold') * size
    wm, _ = wordmark(x + h + gap, cy + ch / 2, size, fill, caret)
    return mark(x, cy - h / 2, h) + wm, total

# ---- screenplay page fragment (an original scene, set in the app's own page font) ----
SCENE = [
    ('trans', 'FADE IN:'),
    ('slug', "INT. WRITERS' ROOM - NIGHT"),
    ('action', 'A blank page. A blinking cursor.'),
    ('action', 'Somewhere, a story is waiting.'),
    ('char', 'WRITER'),
    ('dlg', "Okay. Let's begin."),
]

def page(x, y, w, rot=0, scale_text=1.0, lines=SCENE, caret_last=True, opacity=1.0, h=None):
    """A sliver of screenplay page. w is page width; type is 12pt-equivalent for an 8.5in page."""
    fs = w / 8.5 * (12 / 72) * 1.0 * scale_text      # 12pt at page scale
    lh = fs * 1.0 * 1.18                               # line height (Courier ~6 lines/inch)
    left = w * (1.5 / 8.5)
    h = h or w * 0.62
    parts = [f'<rect width="{w}" height="{h}" rx="{w*0.006}" fill="{PAPER}"/>']
    yy = w * 0.11
    for kind, s in lines:
        if kind == 'trans':
            p, _ = text('cp', s, fs, left, yy, INK); yy += lh * 2
        elif kind == 'slug':
            p, _ = text('cp-bold', s, fs, left, yy, INK); yy += lh * 2
        elif kind == 'action':
            p, _ = text('cp', s, fs, left, yy, INK); yy += lh
            if s.endswith('waiting.'): yy += lh
        elif kind == 'char':
            p, _ = text('cp', s, fs, left + w * (2.2 / 8.5), yy, INK); yy += lh
        elif kind == 'dlg':
            p, tw = text('cp', s, fs, left + w * (1.0 / 8.5), yy, INK)
            if caret_last:
                p += f'<rect x="{left + w*(1.0/8.5) + tw + fs*0.15:.2f}" y="{yy - fs*0.78:.2f}" width="{fs*0.12:.2f}" height="{fs*1.0:.2f}" fill="{ACCENT}"/>'
            yy += lh
        parts.append(p)
    tr = f'translate({x} {y}) rotate({rot})'
    return f'<g transform="{tr}" opacity="{opacity}" filter="url(#shadow)">' + ''.join(parts) + '</g>'

def defs():
    return ('<defs>'
            '<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">'
            '<feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.55"/></filter>'
            f'<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{ACCENT}" stop-opacity="0.30"/>'
            f'<stop offset="1" stop-color="{ACCENT}" stop-opacity="0"/></radialGradient>'
            '<linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stop-color="#18181b" stop-opacity="0"/><stop offset="1" stop-color="#18181b" stop-opacity="1"/></linearGradient>'
            '<linearGradient id="fadeR" x1="1" x2="0"><stop offset="0" stop-color="#18181b" stop-opacity="0"/><stop offset="1" stop-color="#18181b" stop-opacity="1"/></linearGradient>'
            '</defs>')

def svg(w, h, body, bg=INK_BG):
    bgr = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            + defs() + bgr + body + '</svg>')

def backdrop(w, h, glow_cx=None, glow_cy=None, glow_r=None):
    gx = w / 2 if glow_cx is None else glow_cx; gy = h / 2 if glow_cy is None else glow_cy
    r = glow_r or max(w, h) * 0.45
    # faint ruled "page lines" texture
    lines = ''.join(f'<rect x="0" y="{y}" width="{w}" height="{max(1, h/400):.2f}" fill="#ffffff" opacity="0.025"/>'
                    for y in range(0, int(h), max(8, int(h / 22))))
    return lines + f'<ellipse cx="{gx}" cy="{gy}" rx="{r}" ry="{r*0.7}" fill="url(#glow)"/>'

ASSETS = {}

def add(path, w, h, body, bg=INK_BG, transparent=False, scales=(1,)):
    ASSETS[path] = {'w': w, 'h': h, 'svg': svg(w, h, body, None if transparent else bg), 'transparent': transparent, 'scales': list(scales)}

# =================== LOGO ===================
add('logo/draftline-mark', 512, 512, mark(0, 0, 512), transparent=True, scales=(0.25, 0.5, 1, 2))
add('logo/draftline-icon-round-safe', 1024, 1024, circle_icon(1024))
g = glyph_only(0, 0, 512, '#fff'); add('logo/draftline-d-white', 512, 512, g, transparent=True)
g = glyph_only(0, 0, 512, INK_BG); add('logo/draftline-d-black', 512, 512, g, transparent=True)

# wordmarks on transparent
wm, ww = wordmark(0, 0, 200)
W = int(ww + 40); H = 240
wm, _ = wordmark(20, 172, 200, TEXT); add('logo/draftline-wordmark-for-dark-bg', W, H, wm, transparent=True, scales=(1, 2))
wm, _ = wordmark(20, 172, 200, INK); add('logo/draftline-wordmark-for-light-bg', W, H, wm, transparent=True, scales=(1, 2))
lk, lw = lockup(0, 0, 200)
W = int(lw + 60); H = 260
lk, _ = lockup(30, 130, 200, TEXT); add('logo/draftline-lockup-for-dark-bg', W, H, lk, transparent=True, scales=(1, 2))
lk, _ = lockup(30, 130, 200, INK); add('logo/draftline-lockup-for-light-bg', W, H, lk, transparent=True, scales=(1, 2))

# =================== shared banner composition ===================
def hero(w, h, tagline, sub=None, lock_h=None, cy=None, pages=True, url=None, sub2=None):
    lock_h = lock_h or h * 0.26
    cy = h * 0.42 if cy is None else cy
    body = backdrop(w, h, w / 2, cy, max(w, h) * 0.42)
    if pages:
        pw = min(h * 1.25, w * 0.28)
        body += page(-pw * 0.16, h * 0.16, pw, rot=-6, opacity=0.92)
        body += page(w - pw * 0.66, h * 0.30, pw, rot=5, opacity=0.92)
    lk, _ = lockup(w / 2, cy, lock_h, anchor='middle'); body += lk
    ty = cy + lock_h * 0.5 + lock_h * 0.48
    ts = lock_h * 0.215
    t, _ = text('inter-semi', tagline, ts, w / 2, ty, TEXT, anchor='middle'); body += t
    if sub:
        t, _ = text('inter', sub, ts * 0.72, w / 2, ty + ts * 1.55, MUTED, anchor='middle', tracking=0.02); body += t
    if url:
        t, _ = text('inter-semi', url, ts * 0.72, w / 2, ty + ts * (3.0 if sub else 1.55), ACCENT_HI, anchor='middle'); body += t
    return body

TAG = 'Fast, distraction-free screenwriting.'
SUB = 'Free in your browser  ·  Works offline  ·  Fountain & Final Draft'
URL = 'nanashi86.github.io/DraftLine'

# =================== PATREON ===================
# Hero/cover 1600x400 (4:1). Everything that matters sits in the centre third, so wide and narrow crops both hold.
add('patreon/patreon-cover-1600x400', 1600, 400, hero(1600, 400, TAG, SUB, lock_h=96, cy=150), scales=(1, 2))
add('patreon/patreon-avatar-1024', 1024, 1024, circle_icon(1024))

def tier(name, color, line):
    w, h = 460, 200
    b = backdrop(w, h, w * 0.85, h * 0.2, 240)
    b += f'<rect x="0" y="0" width="{w}" height="6" fill="{color}"/>'
    b += mark(26, 30, 40)
    t, _ = text('inter-semi', "DRAFTLINE WRITERS' ROOM", 11.5, 78, 55, MUTED, tracking=0.12); b += t
    t, tw = text('cp-bold', name, 46, 26, 128, TEXT); b += t
    b += f'<rect x="{26 + tw + 6}" y="{128 - 34}" width="4" height="40" fill="{color}"/>'
    t, _ = text('inter', line, 14, 26, 166, MUTED); b += t
    return b

add('patreon/patreon-tier-writer-460x200', 460, 200, tier('Writer', ACCENT_HI, 'Back the free screenwriting app.'), scales=(1, 2))
add('patreon/patreon-tier-beta-tester-460x200', 460, 200, tier('Beta Tester', TEAL, 'Try new features before release.'), scales=(1, 2))
add('patreon/patreon-tier-patron-460x200', 460, 200, tier('Patron', AMBER, 'Help shape what DraftLine becomes.'), scales=(1, 2))

# Post image 16:9 for announcements
def post(w=1920, h=1080, title='Now on Patreon', kicker='DRAFTLINE'):
    b = backdrop(w, h, w * 0.3, h * 0.5, 900)
    b += page(w * 0.56, h * 0.14, h * 1.15, rot=5)
    b += mark(150, 330, 150)
    t, _ = text('inter-semi', kicker, 30, 150, 560, ACCENT_HI, tracking=0.18); b += t
    t, _ = text('cp-bold', title, 96, 150, 670, TEXT); b += t
    t, _ = text('inter', TAG, 38, 150, 750, MUTED); b += t
    return b
add('patreon/patreon-post-1920x1080', 1920, 1080, post())

# =================== DISCORD ===================
add('discord/discord-server-icon-1024', 1024, 1024, circle_icon(1024), scales=(0.5, 1))

def discord_banner(w=1920, h=1080):
    # Shown ~240px wide above the channel list with the server name over the top ~20%: big, stacked, low-centre.
    b = backdrop(w, h, w / 2, h * 0.6, 1000)
    b += page(-300, 430, 760, rot=-8, opacity=0.9)
    b += page(w - 470, 560, 760, rot=7, opacity=0.9)
    b += mark(w / 2 - 125, 300, 250)
    wm, _ = wordmark(w / 2, 770, 150, anchor='middle'); b += wm
    t, _ = text('inter-semi', "WRITERS' ROOM", 52, w / 2, 870, MUTED, anchor='middle', tracking=0.3); b += t
    return b
add('discord/discord-server-banner-1920x1080', 1920, 1080, discord_banner())

def invite_splash(w=1920, h=1080):
    # The invite card covers the middle, so the brand lives in the top-left and the pages in the other corners.
    b = backdrop(w, h, w / 2, h / 2, 1200)
    b += page(-160, 560, 900, rot=-8)
    b += page(w - 700, -40, 900, rot=7)
    lk, _ = lockup(90, 120, 96); b += lk
    t, _ = text('inter-semi', TAG, 32, 90, 230, MUTED); b += t
    return b
add('discord/discord-invite-splash-1920x1080', 1920, 1080, invite_splash())

def profile_banner(w=680, h=240):
    # The avatar overlaps the bottom-left, so the lockup sits right of centre.
    b = backdrop(w, h, w * 0.65, h * 0.45, 360)
    b += page(-120, 40, 330, rot=-8, opacity=0.9)
    lk, _ = lockup(w * 0.64, h * 0.42, 62, anchor='middle'); b += lk
    t, _ = text('inter', 'Free screenwriting in your browser', 16, w * 0.64, h * 0.42 + 64, MUTED, anchor='middle'); b += t
    return b
add('discord/discord-profile-banner-680x240', 680, 240, profile_banner(), scales=(1, 2))

# =================== KO-FI ===================
add('ko-fi/kofi-cover-1200x400', 1200, 400, hero(1200, 400, TAG, SUB, lock_h=92, cy=148), scales=(1, 2))
add('ko-fi/kofi-avatar-1024', 1024, 1024, circle_icon(1024))

# =================== GITHUB ===================
add('github/github-social-preview-1280x640', 1280, 640, hero(1280, 640, TAG, SUB, lock_h=140, cy=250, url=URL))
add('github/readme-banner-1280x320', 1280, 320, hero(1280, 320, TAG, SUB, lock_h=78, cy=118), scales=(1, 2))

os.makedirs(OUT, exist_ok=True)
for path, a in ASSETS.items():
    p = os.path.join(OUT, 'svg', path + '.svg'); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w').write(a['svg'])
json.dump({k: {kk: v for kk, v in a.items() if kk != 'svg'} for k, a in ASSETS.items()}, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print(len(ASSETS), 'assets')
