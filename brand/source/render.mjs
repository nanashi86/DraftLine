// Renders the brand kit: every SVG that gen.py wrote to brand/source/svg/ becomes the PNGs listed in
// svg/manifest.json, written straight to their final paths under brand/ (brand/X/x-banner.png, ...).
// Vector deliverables (logo/*.svg, X/draftline-x-full-logo.svg) are copied out too.
//
//   python3 brand/source/gen.py && node brand/source/render.mjs
//
// Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
// PLAYWRIGHT_MODULE / CHROMIUM_PATH override where they come from.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // brand/source
const BRAND = dirname(HERE); // brand
const SVG = join(HERE, 'svg');
const man = JSON.parse(readFileSync(join(SVG, 'manifest.json'), 'utf8'));

const pw = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright');
const browser = await pw.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let pngs = 0;
for (const [path, a] of Object.entries(man)) {
  const src = join(SVG, `${path}.svg`);
  if (a.publish_svg) {
    mkdirSync(dirname(join(BRAND, a.publish_svg)), { recursive: true });
    copyFileSync(src, join(BRAND, a.publish_svg));
  }
  if (!a.files.length) continue;
  const svg = readFileSync(src, 'utf8');
  for (const [scale, file] of a.files) {
    const ctx = await browser.newContext({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: scale });
    const page = await ctx.newPage();
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    const out = join(BRAND, file);
    mkdirSync(dirname(out), { recursive: true });
    await page.locator('svg').first().screenshot({ path: out, omitBackground: a.transparent });
    await ctx.close();
    pngs += 1;
  }
}
await browser.close();
console.log(`${pngs} PNGs written under ${BRAND}`);
