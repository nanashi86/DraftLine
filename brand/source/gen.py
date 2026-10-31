"""DraftLine brand kit generator: every asset is an SVG with all text outlined, then rendered to PNG.

Run from anywhere (needs Python with fonttools, uharfbuzz and brotli, and Node with Playwright):
    python3 brand/source/gen.py      # writes brand/source/svg/** and brand/source/svg/manifest.json
    node brand/source/render.mjs     # renders every PNG straight into brand/<platform>/ under its final name
Each asset names its own output files (see add()), so a rerun refreshes the whole kit in place,
including brand/X/. Fonts are bundled in brand/source/fonts/ (both SIL Open Font License).

This script makes the logos, the avatars and the minimal banners. The full banners (tagline, pills, one
script page), the Patreon tier cards and post are made by site.mjs, in the website's link-preview style.
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

# =================== AVATARS AND ICONS ===================
# One picture everywhere: the app icon's tile, edge to edge, flat (no gradient or glow), with the D kept
# well inside the circle the platforms crop it to.
add('patreon/patreon-avatar-1024', 1024, 1024, circle_icon(1024))
add('discord/discord-server-icon-1024', 1024, 1024, circle_icon(1024), scales=(0.5, 1))
add('ko-fi/kofi-avatar-1024', 1024, 1024, circle_icon(1024))
add('X/x-avatar-800', 800, 800, circle_icon(800), files=[(1, 'X/x-avatar-800')])

# =================== X: THE LOGO WITH ITS NAME ===================

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
# The logo with the name (light lettering, as in logo/draftline-lockup-for-dark-bg) alone on the ink
# background (#18181b, the same as the full banners), at each platform's size. Each keeps clear of what
# that platform lays over it. The full banners (tagline, pills, script page) are made by site.mjs.
# No Discord server banner here: Discord asks for no logos or text in it (site.mjs makes a text-free one).

def minimal(w, h, lock_h, cx=None, cy=None):
    lk, _ = lockup(w / 2 if cx is None else cx, h / 2 if cy is None else cy, lock_h, TEXT, anchor='middle')
    return lk

# X: the avatar covers the bottom-left and phones crop 60 px top and bottom, so the logo sits a touch high.
add('X/x-header-minimal-1500x500', 1500, 500, minimal(1500, 500, 120, cy=235))
add('patreon/patreon-cover-minimal-1600x400', 1600, 400, minimal(1600, 400, 110), scales=(1, 2))
# Discord profile banner: the avatar overlaps the bottom-left.
add('discord/discord-profile-banner-minimal-680x240', 680, 240, minimal(680, 240, 56, cx=422, cy=105), scales=(1, 2))
add('ko-fi/kofi-cover-minimal-1200x400', 1200, 400, minimal(1200, 400, 96, cy=190), scales=(1, 2))
add('github/github-social-preview-minimal-1280x640', 1280, 640, minimal(1280, 640, 150))
add('github/readme-banner-minimal-1280x320', 1280, 320, minimal(1280, 320, 86), scales=(1, 2))

# =================== write the sources ===================
for path, a in ASSETS.items():
    p = os.path.join(SVG_OUT, path + '.svg'); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8', newline='\n').write(a['svg'])
json.dump({k: {kk: v for kk, v in a.items() if kk != 'svg'} for k, a in ASSETS.items()},
          open(os.path.join(SVG_OUT, 'manifest.json'), 'w'), indent=1)
print(len(ASSETS), 'assets ->', SVG_OUT)
