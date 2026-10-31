// The full banners, in the website's link-preview style (brand/website/site-link-preview-1200x630.png):
// the D tile and DraftLine| wordmark, "Fast, distraction-free screenwriting.", "Always offline-first.
// Always 100% free.", the pills and one white script page, on the ink background with faint ruled lines.
// Also the Patreon tier cards and launch post, and the two text-free images two platforms ask for
// (Discord's server banner, Patreon's current cover). Logos, avatars and minimal banners: gen.py.
//
//   node brand/source/site.mjs            # every image, straight to its place under brand/
//   ONLY=patreon node brand/source/site.mjs   # just the files whose path contains "patreon"
//
// Needs Playwright with Chromium, like render.mjs (PLAYWRIGHT_MODULE / CHROMIUM_PATH override them).
// Fonts come from brand/source/fonts/, so it renders the same on any machine.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // brand/source
const BRAND = dirname(HERE);
const RUST = '#C8553D', INK = '#E9E7E2';
const TILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%"><rect width="512" height="512" rx="106.67" fill="#c8553d"/><path fill="#fff" transform="matrix(0.145833 0 0 -0.145833 167.406 334.552)" d="M1155 594Q1155 406 1088 272.5Q1021 139 895 69.5Q769 0 594 0H123Q99 0 86 8Q73 16 66.5 38Q60 60 60 102Q60 144 66.5 166Q73 188 86 196.5Q99 205 123 205H220V982H123Q99 982 86 990Q73 998 66.5 1020Q60 1042 60 1084Q60 1126 66.5 1148Q73 1170 86 1178.5Q99 1187 123 1187H594Q769 1187 895 1118Q1021 1049 1088 915.5Q1155 782 1155 594ZM470 215H574Q729 215 808 311.5Q887 408 887 594Q887 780 808 876Q729 972 574 972H470Z"/></svg>`;
const font = (family, weight, file, type) => `@font-face{font-family:${family};font-weight:${weight};src:url(data:font/${type};base64,${readFileSync(join(HERE, 'fonts', file)).toString('base64')})}`;
const FONTS = [
  font('CP', 400, 'CourierPrime-Regular.ttf', 'ttf'), font('CP', 700, 'CourierPrime-Bold.ttf', 'ttf'),
  font('Inter', 500, 'Inter-Medium.otf', 'otf'), font('Inter', 600, 'Inter-SemiBold.otf', 'otf'), font('Inter', 700, 'Inter-Bold.otf', 'otf'),
].join('');
const PILLS = ['Works offline', 'Final Draft &amp; Fountain', 'Open-source', 'No account required'];

// Each banner: canvas (CSS px), scales and the files they write, the safe box the copy is fitted into, and
// the page behind it ([left, top, width, rotateDeg], or null). copy: false for the text-free ones.
const BANNERS = [
  // X header: clear of the avatar (bottom-left) and of the 60 px phones crop top and bottom.
  { w: 1500, h: 500, files: ['X/x-header-1500x500.png'], box: [430, 80, 600, 340], page: [1110, 70, 470, 5], pills: true },
  { w: 1280, h: 640, files: ['github/github-social-preview-1280x640.png'], box: [84, 70, 690, 500], page: [830, 96, 540, 5], pills: true },
  { w: 1280, h: 320, files: ['github/readme-banner-1280x320.png', 'github/readme-banner-2560x640.png'], box: [70, 34, 760, 252], page: [930, 40, 420, 4] },
  // Ko-fi: phones crop the sides a little, so nothing sits close to them.
  { w: 1200, h: 400, files: ['ko-fi/kofi-cover-1200x400.png', 'ko-fi/kofi-cover-2400x800.png'], box: [70, 40, 700, 320], page: [820, 48, 460, 5], pills: true },
  // Patreon's 4:1 hero (the Edit Page cover): copy in the centre third, which every crop keeps.
  { w: 1600, h: 400, files: ['patreon/patreon-cover-1600x400.png', 'patreon/patreon-cover-3200x800.png'], box: [540, 40, 520, 320], align: 'center', page: [1170, 46, 460, 5] },
  // Patreon's current cover (2.5:1): the page title and About sit on the left, so no text, the page on the right half.
  { w: 2500, h: 1000, files: ['patreon/patreon-cover-2500x1000.png'], copy: false, page: [1560, 130, 820, 5] },
  { w: 1920, h: 1080, files: ['patreon/patreon-post-1920x1080.png'], box: [140, 250, 980, 580], page: [1250, 200, 820, 5], pills: true,
    h1: 'Now on Patreon.', tag: 'Fast, distraction-free screenwriting. <em>Always 100% free.</em>' },
  // Discord server banner: shown small at the top of the channel list under the server name; Discord asks for
  // no logos or text, and a calm top edge. Just the page.
  { w: 1920, h: 1080, files: ['discord/discord-server-banner-1920x1080.png'], copy: false, page: [700, 190, 760, 5] },
  // Invite background: the invite card covers the middle, so the brand sits top-left.
  { w: 1920, h: 1080, files: ['discord/discord-invite-splash-1920x1080.png'], box: [90, 80, 700, 360], page: [1340, 560, 760, 6] },
  // Profile banner (Nitro): the avatar overlaps the bottom-left; the wordmark and tagline sit right of centre.
  { w: 680, h: 240, files: ['discord/discord-profile-banner-680x240.png', 'discord/discord-profile-banner-1360x480.png'], box: [290, 34, 360, 172], headline: false, page: null },
];

const lockupHtml = `<div class="lockup" id="lock"><span class="tile">${TILE_SVG}</span><span class="word" id="w">DraftLine</span><i class="cursor" id="c"></i></div>`;
const CSS = (w, h) => `${FONTS}
html,body{margin:0}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;color:#f4f4f5;font-family:Inter,system-ui,sans-serif;
  background:repeating-linear-gradient(to bottom,transparent 0 ${h / 20 - 1}px,rgba(255,255,255,.022) ${h / 20 - 1}px ${h / 20}px),#18181b}
.page{position:absolute;box-sizing:border-box;background:#fdfcf8;border-radius:4px;transform-origin:top left;box-shadow:0 28px 70px rgba(0,0,0,.6);color:#1a1a1a;font-family:CP,monospace}
.page p{margin:0 0 1em}.page b{font-weight:700}.page .cue{margin-left:10em;margin-bottom:0}.page .line{margin-left:5.3em}
.caret{display:inline-block;width:2px;height:1.05em;margin-left:2px;vertical-align:-.15em;background:${RUST}}
.copy{position:absolute;transform-origin:top left;width:max-content}
.copy.center{text-align:center}
.lockup{position:relative;height:112px}
.copy.center .lockup{margin:0 auto}
.tile{position:absolute;left:0;top:0;width:112px;height:112px}
.word{position:absolute;font-family:CP;font-weight:700;color:${INK};white-space:nowrap;line-height:1}
.cursor{position:absolute;background:${RUST}}
h1{margin:48px 0 0;font-size:44px;line-height:1.15;font-weight:700;letter-spacing:-.5px;color:#f4f4f5}
.tagline{margin:16px 0 0;font-size:23px;font-weight:500;color:#a1a1aa}
.tagline em{font-style:normal;font-weight:600;color:${RUST}}
.pills{margin-top:30px;display:flex;gap:8px}
.copy.center .pills{justify-content:center}
.pills span{font-size:15px;padding:6px 12px;border:1px solid #3f3f46;border-radius:999px;color:#a1a1aa;white-space:nowrap}`;

const pageHtml = (pg) => (pg ? `<div class="page" style="left:${pg[0]}px;top:${pg[1]}px;width:${pg[2]}px;height:${pg[2] * 1.12}px;padding:${pg[2] * 0.125}px 0 0 ${pg[2] * 0.127}px;font-size:${pg[2] * 0.0288}px;transform:rotate(${pg[3]}deg)">
<p>FADE IN:</p><p><b>INT. WRITERS' ROOM - NIGHT</b></p><p>A blank page. A blinking cursor.<br>Somewhere, a story is waiting.</p>
<p class="cue">WRITER</p><p class="line">Okay. Let's begin.<i class="caret"></i></p></div>` : '');

const bannerHtml = (s) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS(s.w, s.h)}</style></head><body>
${pageHtml(s.page)}
${s.copy === false ? '' : `<div class="copy${s.align === 'center' ? ' center' : ''}" id="copy">
  ${lockupHtml}
  ${s.headline === false ? '' : `<h1>${s.h1 || 'Fast, distraction-free<br>screenwriting.'}</h1>`}
  <p class="tagline">${s.tag || 'Always offline-first. <em>Always 100% free.</em>'}</p>
  ${s.pills ? `<div class="pills">${PILLS.map((p) => `<span>${p}</span>`).join('')}</div>` : ''}
</div>`}</body></html>`;

// Patreon tier cards (460 × 200, shown with the tier's name, price and benefits under it): the logo and the
// tier's name only. Price and benefits stay in Patreon's own text, so the card never goes out of date.
const TIERS = [
  { slug: 'in-the-credits', name: 'In the Credits' },
  { slug: 'writers-room', name: 'The Writers’ Room' },
  { slug: 'executive-producer', name: 'Executive Producer' },
];
const tierHtml = (t) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS(460, 200)}
.lockup{position:absolute;left:28px;top:28px;transform-origin:top left}
.name{position:absolute;left:28px;right:28px;top:86px;font-family:CP;font-weight:700;font-size:38px;line-height:1.05;color:${INK};white-space:nowrap}
.rule{position:absolute;left:28px;top:146px;width:40px;height:3px;background:${RUST}}
</style></head><body>${lockupHtml}<div class="name" id="name">${t.name}</div><div class="rule"></div></body></html>`;

// The lockup, exactly as the approved banners: caps 0.39 of the tile, the word's ink 0.30 tile from it, caps
// centred on the tile; the cursor 0.154 cap wide, 0.158 cap after the e, 0.115 cap above the caps, to 0.167 below.
function placeLockup() {
  const T = 112;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '700 100px CP';
  const size = (0.39 * T) / ctx.measureText('D').actualBoundingBoxAscent * 100;
  ctx.font = `700 ${size}px CP`;
  const m = ctx.measureText('DraftLine');
  const cap = ctx.measureText('D').actualBoundingBoxAscent;
  const w = document.getElementById('w');
  w.style.fontSize = `${size}px`;
  const left = T + 0.30 * T;
  const baselineY = T / 2 + cap / 2;
  w.style.left = `${left}px`;
  w.style.top = '0px';
  const r = w.getBoundingClientRect();
  w.style.top = `${baselineY - ((r.height - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent)}px`;
  const c = document.getElementById('c');
  c.style.width = `${0.154 * cap}px`;
  c.style.left = `${left + m.actualBoundingBoxRight + 0.158 * cap}px`;
  c.style.top = `${baselineY - cap - 0.115 * cap}px`;
  c.style.height = `${cap * 1.282}px`;
  document.getElementById('lock').style.width = `${left + m.actualBoundingBoxRight + 0.158 * cap + 0.154 * cap}px`;
}

const pw = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright');
const browser = await pw.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const only = process.env.ONLY || '';
let n = 0;
async function shoot(html, w, h, scale, file, arrange) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.load('700 50px CP');
    await document.fonts.load('400 15px CP');
    await document.fonts.load('500 15px Inter');
    await document.fonts.ready;
  });
  if (arrange) await page.evaluate(arrange.fn, arrange.arg);
  const out = join(BRAND, file);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  await page.close();
  n += 1;
  console.log(file);
}

for (const s of BANNERS) {
  for (const [i, file] of s.files.entries()) {
    if (!file.includes(only)) continue;
    const arrange = s.copy === false ? null : {
      fn: ([place, box, align]) => {
        new Function(`(${place})()`)();
        // Fit the copy into the safe box: as large as fits, never over 1.6×, centred vertically.
        const copy = document.getElementById('copy');
        const cw = copy.offsetWidth;
        const ch = copy.offsetHeight;
        const k = Math.min(box[2] / cw, box[3] / ch, 1.6);
        copy.style.left = `${align === 'center' ? box[0] + (box[2] - cw * k) / 2 : box[0]}px`;
        copy.style.top = `${box[1] + (box[3] - ch * k) / 2}px`;
        copy.style.transform = `scale(${k})`;
      },
      arg: [placeLockup.toString(), s.box, s.align],
    };
    await shoot(bannerHtml(s), s.w, s.h, i + 1, file, arrange);
  }
}
for (const t of TIERS) {
  for (const scale of [1, 2]) {
    const file = `patreon/patreon-tier-${t.slug}-${460 * scale}x${200 * scale}.png`;
    if (!file.includes(only)) continue;
    await shoot(tierHtml(t), 460, 200, scale, file, {
      fn: (place) => {
        new Function(`(${place})()`)();
        document.getElementById('lock').style.transform = 'scale(.27)'; // measured at full size, then shrunk
        const name = document.getElementById('name');
        let fs = 38;
        while (name.scrollWidth > name.clientWidth && fs > 22) { fs -= 1; name.style.fontSize = `${fs}px`; }
      },
      arg: placeLockup.toString(),
    });
  }
}
await browser.close();
console.log(`${n} images written under ${BRAND}`);
