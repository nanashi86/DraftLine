/* DraftLine service worker — generated at build time from src/pwa/sw.template.js by
   src/pwa/vitePlugin.js, which fills in the build's file list and version.

   • Install: caches the whole app shell — index.html, every JS / CSS file of this build, the
     icons and manifest — plus Courier Prime and Inter (the script and UI fonts) from Google
     Fonts, so DraftLine starts and runs fully offline after one visit.
   • Pages: network first (you get the newest deploy when online), cached index.html offline.
   • Built files (hashed names, never change): cache first.
   • Google Fonts: cached as they're used (title-page fonts too), served from cache after that.
   • Your scripts never touch this: they live in IndexedDB. Nothing is sent anywhere. */

const VERSION = "65e5e2e9d785";
const PRECACHE = [
  "./",
  "./apple-touch-icon.png",
  "./assets/BeatBoard-BoghXSai.js",
  "./assets/BeatBoard-D7X5VAq8.css",
  "./assets/ExportBibleModal-C9aHjvc7.css",
  "./assets/ExportBibleModal-CB8BhpF1.js",
  "./assets/FormatDoctorModal-BJL8Li-2.css",
  "./assets/FormatDoctorModal-CKY7-cTN.js",
  "./assets/HelpModal-BuvkQD7S.css",
  "./assets/HelpModal-Cth2e5Da.js",
  "./assets/HelpModal-DzRa5qO9.js",
  "./assets/ImportModal-B_K8OSBY.js",
  "./assets/ImportModal-D6R5UZVT.css",
  "./assets/PlanningWorkspace-sup1MTJn.css",
  "./assets/PlanningWorkspace-y7swEEod.js",
  "./assets/RenameCharacterModal-B1CF8jOI.js",
  "./assets/RenameCharacterModal-DagY3wg-.css",
  "./assets/UserGuideModal-BVWC8KuI.css",
  "./assets/UserGuideModal-BqnefTAL.js",
  "./assets/docxImport-DxWB3r58.js",
  "./assets/formatting-CXVlQ9TD.js",
  "./assets/index-Co3RUHJy.css",
  "./assets/index-PKL_y7at.js",
  "./assets/lib-DI1hcji2.js",
  "./assets/printTitle-C1qWomuv.js",
  "./assets/productionEngine-DTht7u5U.js",
  "./assets/react-DgawKyfb.js",
  "./assets/rolldown-runtime-BCiCTKAo.js",
  "./assets/sluglines-C2ChrzlQ.js",
  "./assets/titleFonts-CncB-K-b.js",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./index.html",
  "./manifest.json"
]; // paths relative to this file, e.g. "./assets/index-abc123.js"
const CORE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700;800&display=swap";
const SHELL_CACHE = `draftline-shell-${VERSION}`;
const FONT_CACHE = 'draftline-fonts-v1';

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

async function cacheFonts(cssUrl) {
  const cache = await caches.open(FONT_CACHE);
  const res = await fetch(cssUrl, { mode: 'cors' });
  if (!res.ok) return;
  await cache.put(cssUrl, res.clone());
  const css = await res.text();
  // The CSS points at the font files for this browser; fetch and keep them all.
  const files = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
  await Promise.all(files.map((u) => fetch(u, { mode: 'cors' }).then((r) => (r.ok ? cache.put(u, r) : null)).catch(() => null)));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // cache: 'reload' skips the browser's HTTP cache, so a redrawn icon (same file name) is fetched fresh.
    await shell.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })));
    // Fonts are a bonus: offline still works (with fallback fonts) if they can't be fetched now.
    await cacheFonts(CORE_FONTS_CSS).catch(() => null);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('draftline-shell-') && n !== SHELL_CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache first, filled in as fonts are used.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pages: newest when online, the cached app when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch {
        return (await cache.match('./index.html', { ignoreVary: true })) || (await cache.match('./', { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }

  // Built files and icons: cache first (hashed names never change), network as a fallback.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // ignoreVary: module scripts and crossorigin stylesheets are requested with an Origin
    // header the precache didn't send; servers that answer "Vary: Origin" would otherwise
    // make every offline lookup miss. Built files have unique hashed names, so it's safe.
    const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && url.pathname.includes('/assets/')) cache.put(req, res.clone());
    return res;
  })());
});
