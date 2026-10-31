# DraftLine brand kit

Built from the app icon (`public/favicon.svg`): the white Courier Prime Bold **D** on the terracotta tile. The wordmark uses the same font (the font DraftLine sets scripts in) and ends in a text-cursor bar. That bar appears only after the full **DraftLine** wordmark, never after a tier name or a headline. Supporting text is Inter, the app's UI font.

**One look everywhere:** the ink background (`#18181B`) with faint ruled lines, never amber; one white script page, never two; and the same words as the website:

> **Fast, distraction-free screenwriting.**
> Always offline-first. **Always 100% free.**
> Works offline · Final Draft & Fountain · Open-source · No account required

The website's link preview (`website/site-link-preview-1200x630.png`, served as `public/og-image.png`) is the reference every banner follows.

## Where each file goes

Every file is named `<platform>-<slot>[-minimal]-<width>x<height>.png` (squares: `-<size>`), at the size the platform asks for. Where there are two sizes, the larger is the same image at 2× for sharp screens: upload either.

| Platform | Slot | File | What the platform asks for |
|---|---|---|---|
| **Patreon** | Cover (current page editor) | `patreon/patreon-cover-2500x1000.png` | 2500×1000, under 3 MB. The page title and About sit on the **left**, so this one has no text: just the page, on the right half |
| | Hero (Edit Page → Basics) | `patreon/patreon-cover-3200x800.png` (or 1600×400) | 1600×400 (4:1). The copy sits in the centre third, which every crop keeps |
| | Profile picture | `patreon/patreon-avatar-1024.png` | 1024×1024, cropped to a circle |
| | Tier images | `patreon/patreon-tier-in-the-credits-*`, `-writers-room-*`, `-executive-producer-*` | 460×200 (2.3:1). The logo and the tier's name only: Patreon shows the price and benefits right under the image, so the card never goes out of date when they change |
| | Launch post | `patreon/patreon-post-1920x1080.png` | 1920×1080 (16:9), how the feed shows post images: "Now on Patreon." |
| **Discord** | Server icon | `discord/discord-server-icon-1024.png` (512 also included) | 512×512 minimum, cropped to a circle |
| | Server banner | `discord/discord-server-banner-1920x1080.png` | 960×540 minimum, 16:9, needs **Boost level 2**. Shown small at the top of the channel list, under the server name: Discord asks for **no logos or text** and a calm top edge, so it's just the script page |
| | Invite background | `discord/discord-invite-splash-1920x1080.png` | 16:9, needs **Boost level 1**. The invite card covers the middle, so the brand sits top-left |
| | Your profile banner | `discord/discord-profile-banner-1360x480.png` (or 680×240) | 680×240 (17:6), **Nitro only**. The wordmark and tagline sit right of centre, clear of your avatar |
| **Ko-fi** | Cover image | `ko-fi/kofi-cover-2400x800.png` (or 1200×400) | 3:1, ideally 1200×400, under 8 MB, PNG or JPG. Phones crop the sides a little; nothing sits near them |
| | Profile picture | `ko-fi/kofi-avatar-1024.png` | Square, cropped to a circle |
| **GitHub** | Social preview (Settings → General) | `github/github-social-preview-1280x640.png` | 1280×640, under 1 MB |
| | README header | `github/readme-banner-2560x640.png` (or 1280×320) | `<img src="brand/github/readme-banner-2560x640.png" width="1280">` |
| **X** | Profile photo | `X/x-avatar-800.png` | 400×400 shown as a circle (made at 800×800), under 2 MB |
| | Header | `X/x-header-1500x500.png` | 1500×500 (3:1), under 2 MB. Everything sits right of the avatar's corner (bottom-left) and inside the phone crop (60 px top and bottom) |
| | Logo with name | `X/draftline-x-full-logo-dark.png` / `-light.png` | Transparent, for dark or light backgrounds (2112×520; the same as `logo/draftline-lockup-for-*-bg@2x.png`) |
| | Logo, vector | `X/draftline-x-full-logo.svg` | One file: the name switches to light or dark with the viewer's setting where SVG styles apply |
| **Website** | Link preview (`og:image` / `twitter:image`) | `website/site-link-preview-1200x630.png`, served from `public/og-image.png` | 1200×630 (1.91:1), the size Facebook, LinkedIn, X, Discord and Slack previews use. Replace `public/og-image.png` (same name and size) to change what links show |

**Minimal versions:** the logo with its name, alone on the same ink background, at the same sizes and safe areas: `X/x-header-minimal-1500x500.png`, `patreon/patreon-cover-minimal-*`, `discord/discord-profile-banner-minimal-*`, `ko-fi/kofi-cover-minimal-*`, `github/github-social-preview-minimal-1280x640.png` and `github/readme-banner-minimal-*`. There's no minimal Discord server banner, since Discord asks for no logos there.

**Avatars and icons** are all the same picture: the app icon's tile, edge to edge and flat (the same terracotta as the app), with the D kept well inside the circle every platform crops it to.

All the PNGs are well under the platform file-size limits (Patreon cover 3 MB, Discord 10 MB, Ko-fi 8 MB, GitHub 1 MB, X 2 MB).

**Retired:** the earlier designs (the amber glow, two script pages, the "100% local" and "Local-First" taglines, colour-coded tiers named Writer / Patron / Beta Tester) are in `_retired/`, kept for reference. Nothing there is in use; delete the folder whenever you like.

## Logo files (`logo/`)

- `draftline-mark.svg` with PNGs at 128, 256, 512 and 1024: the app icon. Use it anywhere a square logo is needed.
- `draftline-icon-round-safe`: the tile filled edge to edge, with the D sized for circle crops. The avatars are this.
- `draftline-lockup-for-dark-bg` / `-for-light-bg`: the tile and the wordmark side by side.
- `draftline-wordmark-for-dark-bg` / `-for-light-bg`: the wordmark on its own.
- `draftline-d-white` / `draftline-d-black`: the D alone, one colour, for stamps, watermarks and embossing.

## Colours (the app's own theme tokens)

| Name | Hex | Used for |
|---|---|---|
| Terracotta (accent) | `#C8553D` | Tile, cursor bar, "Always 100% free.", tier underline |
| Terracotta light | `#E8836B` | Accent text on dark backgrounds |
| Ink background | `#18181B` | Every banner's background |
| Paper | `#FDFCF8` | The script page |
| Text | `#E9E7E2` | Wordmark and tier names on dark backgrounds |
| Headline | `#F4F4F5` | "Fast, distraction-free screenwriting." |
| Muted | `#A1A1AA` | Taglines and pills |

## Fonts

- Courier Prime Bold (wordmark, D, tier names) and Courier Prime Regular (the script page), SIL Open Font License; the license is in `source/fonts/`.
- Inter Medium, SemiBold and Bold (headlines, taglines, pills), SIL Open Font License; the license is in `source/fonts/`.

## Editing or regenerating

Two generators, both writing every PNG straight to its place in this folder under the names above:

- `source/gen.py` + `source/render.mjs`: the logos, the avatars and icons, and the minimal banners. Colours and the D's placement are at the top of `gen.py`. Its editable SVGs go to `source/svg/` (they open in Figma, Illustrator, Inkscape or Affinity).
- `source/site.mjs`: the full banners, the Patreon tier cards and post, and the text-free Discord banner and Patreon cover. Each banner's canvas, safe area and page position is one line in its `BANNERS` list; the tier names are in `TIERS`.

From the repo folder:

```
python3 brand/source/gen.py
node brand/source/render.mjs
node brand/source/site.mjs
```

`ONLY=patreon node brand/source/site.mjs` redoes just the files whose path contains "patreon". The fonts are bundled. You'll need Python with `fonttools`, `uharfbuzz` and `brotli` (`pip install fonttools uharfbuzz brotli`), and Playwright for Node (`npm i -D playwright` then `npx playwright install chromium`).
