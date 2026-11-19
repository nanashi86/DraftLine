// Vite plugin: writes sw.js into the build from src/pwa/sw.template.js, with
//   • PRECACHE — every file the build wrote to disk (index.html, hashed JS / CSS, public icons,
//     manifest, the fonts in public/fonts/), as "./path" relative to the service worker
//   • VERSION — a hash of CACHE_REVISION, that list and each file's contents, so any changed
//     file (including a redrawn icon that keeps its name) installs a fresh worker and drops
//     the old cache, while an unchanged build keeps the cache it has.
//     Bump CACHE_REVISION to force every installed copy to refresh.
// The worker is only registered in production builds (src/pwa/register.js).

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/** r2: the edge-to-edge maskable icon (icon-maskable-512.png) and manifest icon purposes.
 *  r3: every icon redrawn with the D optically centred (Oct 2026). */
export const CACHE_REVISION = 3;

const TEMPLATE = new URL('./sw.template.js', import.meta.url);

/** Every file under `dir`, as paths relative to it ("assets/index-abc.js"). */
function publicFiles(dir) {
  try {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? publicFiles(p).map((f) => `${name}/${f}`) : [name];
    });
  } catch {
    return [];
  }
}

/** The service worker's source for a list of build files. Pure, so it's unit-tested. */
/**
 * Build files the site never serves, so they must never be precached: one 404 makes cache.addAll()
 * reject the whole install, and the browser then drops the service worker (no offline, and Chrome
 * uninstalls the app). CNAME is GitHub Pages' custom-domain setting, read by GitHub and answered
 * with a 404; dot-files and dot-folders (.nojekyll, .well-known/…) are hidden by Pages' default build.
 */
export const isServed = (f) => f !== 'CNAME' && !f.split('/').some((part) => part.startsWith('.'));

/**
 * Served, but not worth keeping offline in every installed copy: the Welcome page's editor screenshots
 * (about 165 KB each). Offline, the Welcome page still opens from its precached HTML, just without them.
 */
export const isWebOnly = (f) => /^welcome\/[^/]+\.(webp|png|jpe?g)$/.test(f);

export function buildServiceWorker(files, template = readFileSync(TEMPLATE, 'utf8'), contents = {}) {
  // index.html is always there (Vite writes it after this hook runs), so it's listed explicitly.
  const names = [...new Set([...files, 'index.html'])].filter((f) => f !== 'sw.js' && !f.endsWith('.map') && isServed(f) && !isWebOnly(f)).sort();
  const list = ['./', ...names.map((f) => `./${f}`)];
  const h = createHash('sha256').update(`r${CACHE_REVISION}\n${list.join('\n')}`);
  for (const f of names) if (contents[f] !== undefined) h.update(`\n${f}:`).update(contents[f]);
  const version = h.digest('hex').slice(0, 12);
  const source = template
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace('__PRECACHE__', JSON.stringify(list, null, 2));
  return { source, version, list };
}

/**
 * Writes sw.js once the build is on disk, listing the files that were actually written.
 * (Not from generateBundle: the bundle's file names there aren't final. Vite can still rewrite a
 * chunk after that hook, which changes its hash and name, e.g. HelpModal-BKHMJujr.js became
 * HelpModal-rFO86vws.js, and one missing file makes cache.addAll() reject the whole install.)
 */
export default function draftlinePwa() {
  return {
    name: 'draftline-pwa',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir;
      if (!dir) return;
      const files = publicFiles(dir).filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const contents = {};
      for (const f of files) contents[f] = readFileSync(join(dir, f));
      const { source } = buildServiceWorker(files, undefined, contents);
      writeFileSync(join(dir, 'sw.js'), source);
    },
  };
}
