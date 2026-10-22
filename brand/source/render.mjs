import { chromium } from '/tmp/claude-0/pw/node_modules/playwright/index.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const OUT = new URL('./out/', import.meta.url).pathname;
const man = JSON.parse(readFileSync(OUT + 'manifest.json', 'utf8'));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [path, a] of Object.entries(man)) {
  const svg = readFileSync(`${OUT}svg/${path}.svg`, 'utf8');
  for (const s of a.scales) {
    const ctx = await b.newContext({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: s });
    const p = await ctx.newPage();
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    // name: explicit pixel size wins (cover-1600x400 @2x → cover-3200x800)
    let name = path;
    const m = path.match(/(\d+)x(\d+)$/);
    if (s !== 1) name = m ? path.replace(/\d+x\d+$/, `${a.w * s}x${a.h * s}`) : (path.match(/-(\d+)$/) ? path.replace(/-(\d+)$/, `-${a.w * s}`) : `${path}@${s}x`);
    else if (!m && !/-\d+$/.test(path)) name = `${path}`;
    const file = `${OUT}png/${name}.png`;
    mkdirSync(dirname(file), { recursive: true });
    await p.locator('svg').screenshot({ path: file, omitBackground: a.transparent });
    await ctx.close();
  }
}
await b.close();
console.log('done');
