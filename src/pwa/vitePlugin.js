// Vite plugin: writes sw.js into the build from src/pwa/sw.template.js, with
//   • PRECACHE — every file of this build (index.html, hashed JS / CSS, public icons,
//     manifest), as "./path" relative to the service worker
//   • VERSION — a hash of that list, so each deploy installs a fresh worker and drops the
//     old cache, while an unchanged build keeps the cache it has.
// The worker is only registered in production builds (src/pwa/register.js).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const CORE_FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700;800&display=swap';

const TEMPLATE = new URL('./sw.template.js', import.meta.url);

/** Files in public/ (relative paths), which Vite copies into the build as they are. */
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
export function buildServiceWorker(files, template = readFileSync(TEMPLATE, 'utf8')) {
  // index.html is always there (Vite writes it after this hook runs), so it's listed explicitly.
  const names = [...new Set([...files, 'index.html'])].filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort();
  const list = ['./', ...names.map((f) => `./${f}`)];
  const version = createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 12);
  const source = template
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace('__PRECACHE__', JSON.stringify(list, null, 2))
    .replace('__CORE_FONTS_CSS__', JSON.stringify(CORE_FONTS_CSS));
  return { source, version, list };
}

export default function draftlinePwa() {
  let publicDir = 'public';
  return {
    name: 'draftline-pwa',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const files = [...Object.keys(bundle), ...publicFiles(publicDir)];
      const { source } = buildServiceWorker(files);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
