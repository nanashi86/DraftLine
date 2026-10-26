"""DraftLine brand kit generator: every asset is an SVG with all text outlined, then rendered to PNG.

Run from anywhere (needs Python with fonttools, uharfbuzz and brotli, and Node with Playwright):
    python3 brand/source/gen.py      # writes brand/source/svg/** and brand/source/svg/manifest.json
    node brand/source/render.mjs     # renders every PNG straight into brand/<platform>/ under its final name
Each asset names its own output files (see add()), so a rerun refreshes the whole kit in place,
including brand/X/. Fonts are bundled in brand/source/fonts/ (both SIL Open Font License).
"""
import json, os, re, sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))       # brand/source
SVG_OUT = os.path.join(HERE, 'svg')                      # editable sources + manifest.json

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
    'inter': os.path.join(HERE, 'fonts/Inter-Medium.otf'),
    'inter-semi': os.path.join(HERE, 'fonts/Inter-SemiBold.otf'),
    'inter-bold': os.path.join(HERE, 'fonts/Inter-Bold.otf'),
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

def png_name(path, scale):
    """Default PNG name: a size in the name tracks the scale (cover-1600x400 @2x -> cover-3200x800,
    icon-1024 @0.5 -> icon-512); otherwise @2x is appended."""
    m = re.search(r'-(\d+)x(\d+)$', path)
    if m:
        return path[:m.start()] + f'-{round(int(m[1]) * scale)}x{round(int(m[2]) * scale)}'
    m = re.search(r'-(\d+)$', path)
    if m:
        return path[:m.start()] + f'-{round(int(m[1]) * scale)}'
    return path if scale == 1 else f'{path}@{scale:g}x'

def add(path, w, h, body, bg=INK_BG, transparent=False, scales=(1,), files=None, publish_svg=None, raw=None):
    """One asset. path: its source SVG, brand/source/svg/<path>.svg.
    files: [(scale, 'folder/name')] PNGs to write under brand/ (default: one per scale, named by png_name).
    publish_svg: also copy the SVG to brand/<publish_svg>.svg (vector deliverables).
    raw: use this SVG text as is instead of wrapping body."""
    files = files if files is not None else [(s, png_name(path, s)) for s in scales]
    ASSETS[path] = {'w': w, 'h': h, 'svg': raw or svg(w, h, body, None if transparent else bg), 'transparent': transparent,
                    'files': [[s, f + '.png'] for s, f in files], 'publish_svg': publish_svg + '.svg' if publish_svg else None}

# =================== LOGO ===================
add('logo/draftline-mark', 512, 512, mark(0, 0, 512), transparent=True, publish_svg='logo/draftline-mark',
    files=[(s, f'logo/draftline-mark-{round(512 * s)}') for s in (0.25, 0.5, 1, 2)])
add('logo/draftline-icon-round-safe', 1024, 1024, circle_icon(1024), publish_svg='logo/draftline-icon-round-safe',
    files=[(1, 'logo/draftline-icon-round-safe-1024')])
g = glyph_only(0, 0, 512, '#fff')
add('logo/draftline-d-white', 512, 512, g, transparent=True, publish_svg='logo/draftline-d-white', files=[(1, 'logo/draftline-d-white-512')])
g = glyph_only(0, 0, 512, INK_BG)
add('logo/draftline-d-black', 512, 512, g, transparent=True, publish_svg='logo/draftline-d-black', files=[(1, 'logo/draftline-d-black-512')])

# wordmarks on transparent
wm, ww = wordmark(0, 0, 200)
W = int(ww + 40); H = 240
wm, _ = wordmark(20, 172, 200, TEXT); add('logo/draftline-wordmark-for-dark-bg', W, H, wm, transparent=True, scales=(1, 2), publish_svg='logo/draftline-wordmark-for-dark-bg')
wm, _ = wordmark(20, 172, 200, INK); add('logo/draftline-wordmark-for-light-bg', W, H, wm, transparent=True, scales=(1, 2), publish_svg='logo/draftline-wordmark-for-light-bg')
lk, lw = lockup(0, 0, 200)
W = int(lw + 60); H = 260
lk, _ = lockup(30, 130, 200, TEXT); add('logo/draftline-lockup-for-dark-bg', W, H, lk, transparent=True, scales=(1, 2), publish_svg='logo/draftline-lockup-for-dark-bg')
lk, _ = lockup(30, 130, 200, INK); add('logo/draftline-lockup-for-light-bg', W, H, lk, transparent=True, scales=(1, 2), publish_svg='logo/draftline-lockup-for-light-bg')

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
SUB = 'Local-First  ·  Works Offline  ·  Fountain & Final Draft'
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

# =================== X (TWITTER) ===================
# Profile photo: 400x400 shown as a circle (2 MB max); made at 800 for sharp retina display.
# Header: 1500x500 (3:1). The avatar covers roughly the bottom-left 400x200, and phones crop the top and
# bottom, so everything that matters sits in x >= 440 and y 110..400.
LUCIDE = {  # Lucide line icons (24 px grid, 2 px stroke), the app's icon set: no emoji anywhere.
    'coffee': ['M10 2v2', 'M14 2v2', 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1', 'M6 2v2'],
    'heart': ['M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5'],
    'message-circle': ['M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719'],
    'code-xml': ['m18 16 4-4-4-4', 'm6 8-4 4 4 4', 'm14.5 4-5 16'],
}

def icon(name, x, y, size, color):
    paths = ''.join(f'<path d="{d}"/>' for d in LUCIDE[name])
    return (f'<g transform="translate({x:.2f} {y:.2f}) scale({size / 24:.4f})" fill="none" stroke="{color}" '
            f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{paths}</g>')

def noir_defs(w, h):
    """The app's Film Noir look: Venetian-blind slats at -28 deg (lib/noir.js), a vignette and 35 mm grain."""
    return (
        '<defs>'
        # light through the blinds, on the backdrop
        '<pattern id="shafts" patternUnits="userSpaceOnUse" width="52" height="52" patternTransform="rotate(-28)">'
        '<rect width="52" height="30" fill="#fff" opacity="0.045"/></pattern>'
        '<linearGradient id="shaftfade" x1="1" y1="0" x2="0.2" y2="1">'
        '<stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        '<mask id="shaftmask"><rect width="100%" height="100%" fill="url(#shaftfade)"/></mask>'
        # the blind's shadow, across the page
        '<pattern id="slats" patternUnits="userSpaceOnUse" width="52" height="52" patternTransform="rotate(-34)">'
        '<rect y="34" width="52" height="18" fill="#000" opacity="0.13"/></pattern>'
        '<radialGradient id="vignette" cx="50%" cy="50%" r="75%">'
        '<stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>'
        '<filter id="grain" x="0" y="0" width="100%" height="100%">'
        '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>'
        '<feColorMatrix type="saturate" values="0"/></filter>'
        '</defs>')

def noir_page(x, y, w, rot):
    """A screenplay page lying in the blinds' light: the page() fragment with slat shadows across it."""
    g = page(x, y, w, rot=rot)
    h = w * 0.62
    return g[:-len('</g>')] + f'<rect width="{w}" height="{h:.2f}" fill="url(#slats)"/></g>'

def pill(x, y, name, label, size=15):
    """A community badge: line icon + label in a dark capsule. Returns svg, width."""
    lw = measure('inter-semi', label, size)
    w = 16 + 18 + 9 + lw + 18
    b = (f'<rect x="{x:.2f}" y="{y}" width="{w:.2f}" height="40" rx="20" fill="#222327" stroke="#3a3b42"/>'
         + icon(name, x + 16, y + 11, 18, ACCENT_HI))
    t, _ = text('inter-semi', label, size, x + 16 + 18 + 9, y + 25.5, TEXT)
    return b + t, w

def x_banner(w=1500, h=500):
    cx = 700                                              # content column, left of centre to balance the page
    b = noir_defs(w, h)
    b += f'<rect width="{w}" height="{h}" fill="url(#shafts)" mask="url(#shaftmask)"/>'
    b += f'<ellipse cx="{cx}" cy="210" rx="560" ry="300" fill="url(#glow)" opacity="0.8"/>'
    b += noir_page(w - 430, 64, 560, rot=6)
    lk, _ = lockup(cx, 168, 92, anchor='middle'); b += lk
    t, _ = text('inter-semi', 'Fast, distraction-free screenwriting.', 30, cx, 268, TEXT, anchor='middle'); b += t
    t, _ = text('inter', '100% local, open-source.', 22, cx, 304, MUTED, anchor='middle', tracking=0.01); b += t
    pills = [('coffee', 'Ko-fi'), ('heart', 'Patreon'), ('message-circle', 'Discord'), ('code-xml', 'GitHub')]
    widths = [pill(0, 0, n, l)[1] for n, l in pills]
    gap = 12
    x = cx - (sum(widths) + gap * (len(pills) - 1)) / 2
    for (n, l), pw in zip(pills, widths):
        p, _ = pill(x, 348, n, l); b += p; x += pw + gap
    b += f'<rect width="{w}" height="{h}" fill="url(#vignette)"/>'
    b += f'<rect width="{w}" height="{h}" filter="url(#grain)" opacity="0.05"/>'
    return b

def x_avatar(size=800):
    """The app icon, centred on the dark ground with room to spare inside X's circular crop."""
    tile = size * 0.6
    b = f'<ellipse cx="{size / 2}" cy="{size / 2}" rx="{size * 0.5}" ry="{size * 0.5}" fill="url(#glow)" opacity="0.7"/>'
    return b + mark((size - tile) / 2, (size - tile) / 2, tile)

add('X/x-avatar', 800, 800, x_avatar(800), files=[(1, 'X/x-avatar')])
add('X/x-banner', 1500, 500, x_banner(), files=[(1, 'X/x-banner')])
# The same tagline header as Patreon, Ko-fi and GitHub, sized for X: everything sits in x 501..999 and y 130..315,
# clear of the avatar (bottom-left, x < 440) and inside the phone crop (60 px top and bottom).
add('X/x-banner-tagline', 1500, 500, hero(1500, 500, TAG, SUB, lock_h=100, cy=180), files=[(1, 'X/x-banner-tagline')])

lk, lw = lockup(0, 0, 200)
W = int(lw + 60); H = 260
lk, _ = lockup(30, 130, 200, TEXT)
add('X/draftline-x-full-logo-dark', W, H, lk, transparent=True, files=[(2, 'X/draftline-x-full-logo-dark')])
lk, _ = lockup(30, 130, 200, INK)
add('X/draftline-x-full-logo-light', W, H, lk, transparent=True, files=[(2, 'X/draftline-x-full-logo-light')])
# One vector for both: the wordmark follows the viewer's light / dark setting where SVG styles apply.
lk, _ = lockup(30, 130, 200, TEXT)
adaptive = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
            '<title>DraftLine</title>'
            f'<style>.ink{{fill:{INK}}}@media (prefers-color-scheme: dark){{.ink{{fill:{TEXT}}}}}</style>'
            + lk.replace(f'fill="{TEXT}"', 'class="ink"') + '</svg>\n')
add('X/draftline-x-full-logo', W, H, None, raw=adaptive, files=[], publish_svg='X/draftline-x-full-logo')

# =================== MINIMAL BANNERS ===================
# The logo with the name (light lettering, as in logo/draftline-lockup-for-dark-bg) alone on solid black,
# at each platform's banner size. Each one keeps clear of what that platform lays over its banner.
BLACK = '#000000'

def minimal(w, h, lock_h, cx=None, cy=None):
    lk, _ = lockup(w / 2 if cx is None else cx, h / 2 if cy is None else cy, lock_h, TEXT, anchor='middle')
    return lk

# X: the avatar covers the bottom-left and phones crop 60 px top and bottom, so the logo sits a touch high.
add('X/x-banner-minimal', 1500, 500, minimal(1500, 500, 120, cy=235), bg=BLACK, files=[(1, 'X/x-banner-minimal')])
add('patreon/patreon-cover-minimal-1600x400', 1600, 400, minimal(1600, 400, 110), bg=BLACK, scales=(1, 2))
# Discord server banner: shown small under the server name, which covers the top ~20%.
add('discord/discord-server-banner-minimal-1920x1080', 1920, 1080, minimal(1920, 1080, 200, cy=600), bg=BLACK)
# Discord profile banner: the avatar overlaps the bottom-left.
add('discord/discord-profile-banner-minimal-680x240', 680, 240, minimal(680, 240, 56, cx=422, cy=105), bg=BLACK, scales=(1, 2))
add('ko-fi/kofi-cover-minimal-1200x400', 1200, 400, minimal(1200, 400, 96, cy=190), bg=BLACK, scales=(1, 2))
add('github/github-social-preview-minimal-1280x640', 1280, 640, minimal(1280, 640, 150), bg=BLACK)
add('github/readme-banner-minimal-1280x320', 1280, 320, minimal(1280, 320, 86), bg=BLACK, scales=(1, 2))

# =================== write the sources ===================
for path, a in ASSETS.items():
    p = os.path.join(SVG_OUT, path + '.svg'); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8', newline='\n').write(a['svg'])
json.dump({k: {kk: v for kk, v in a.items() if kk != 'svg'} for k, a in ASSETS.items()},
          open(os.path.join(SVG_OUT, 'manifest.json'), 'w'), indent=1)
print(len(ASSETS), 'assets ->', SVG_OUT)
