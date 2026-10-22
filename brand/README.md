# DraftLine brand kit

Built from the app icon (`public/favicon.svg`): the white Courier Prime Bold **D** on the terracotta tile. The wordmark uses the same font (the font DraftLine sets scripts in) and ends in a text-cursor bar. Supporting text is Inter, the app's UI font. Every SVG has its text converted to outlines, so it looks the same on any machine.

## Where each file goes

| Platform | Slot | File | Spec it meets |
|---|---|---|---|
| **Patreon** | Profile picture | `patreon/patreon-avatar-1024.png` | 1024×1024, 1:1; the D stays clear of the circle crop |
| | Cover / hero | `patreon/patreon-cover-3200x800.png` (or the 1600×400 version) | 1600×400, 4:1; the key content sits in the centre third, so wide and narrow crops both hold |
| | Tier images | `patreon/patreon-tier-*-920x400.png` | 460×200 (2.3:1); the 920×400 files are the same image at 2× for sharpness |
| | Launch post | `patreon/patreon-post-1920x1080.png` | 16:9, which is how the feed shows post images |
| **Discord** | Server icon | `discord/discord-server-icon-1024.png` (512 also included) | 512×512 minimum, cropped to a circle |
| | Server banner | `discord/discord-server-banner-1920x1080.png` | 16:9 (960×540 minimum, 1920×1080 recommended); needs **Boost level 2**. The top ~20% is left clear for the server name overlay |
| | Invite background | `discord/discord-invite-splash-1920x1080.png` | 16:9; needs **Boost level 1**. The invite card covers the middle, so the brand sits top-left |
| | Your profile banner | `discord/discord-profile-banner-1360x480.png` | 680×240 (5:2), **Nitro only**. The lockup sits right of centre, clear of your avatar |
| **Ko-fi** | Cover image | `ko-fi/kofi-cover-2400x800.png` (or 1200×400) | 3:1, ideally 1200×400, under 8 MB, PNG/JPG, no GIFs |
| | Profile picture | `ko-fi/kofi-avatar-1024.png` | Square, round-crop safe |
| **GitHub** | Social preview (Settings → General) | `github/github-social-preview-1280x640.png` | 1280×640, under 1 MB |
| | README header | `github/readme-banner-2560x640.png` | Use `<img src="brand/github/readme-banner-2560x640.png" width="1280">` |

All the PNGs are well under the platform file-size limits (Discord 10 MB, Ko-fi 8 MB, GitHub 1 MB).

## Logo files (`logo/`)

- `draftline-mark.svg` with PNGs at 128, 256, 512 and 1024: the app icon. Use it anywhere a square logo is needed.
- `draftline-icon-round-safe`: the tile filled edge to edge, with the D sized for circle crops. Use it for avatars.
- `draftline-lockup-for-dark-bg` / `-for-light-bg`: the tile and the wordmark side by side.
- `draftline-wordmark-for-dark-bg` / `-for-light-bg`: the wordmark on its own.
- `draftline-d-white` / `draftline-d-black`: the D alone, one colour, for stamps, watermarks and embossing.

## Colours (the app's own theme tokens)

| Name | Hex | Used for |
|---|---|---|
| Terracotta (accent) | `#C8553D` | Tile, cursor bar |
| Terracotta light | `#E8836B` | Accent text on dark backgrounds |
| Ink background | `#18181B` | Banner backgrounds |
| Paper | `#FDFCF8` | Script pages |
| Text | `#E9E7E2` | Wordmark on dark backgrounds |
| Muted | `#9A9890` | Secondary text |
| Teal | `#8FD0D6` | Beta Tester tier |
| Amber | `#F59E0B` | Patron tier |

## Fonts

- Courier Prime Bold (wordmark and D) and Courier Prime Regular (script pages), SIL Open Font License; the license is in `source/fonts/`.
- Inter (taglines).

## Editing or regenerating

The source SVGs are in `source/svg/` and open in Figma, Illustrator, Inkscape or Affinity. To change wording, edit `source/gen.py` (the tier names and lines, tagline and URL are near the bottom), then run `python3 gen.py` followed by `node render.mjs`. You'll need `fonttools`, `uharfbuzz`, `brotli` and Playwright installed.
