/* DraftLine service worker — generated at build time from src/pwa/sw.template.js by
   src/pwa/vitePlugin.js, which fills in the build's file list and version.

   • Install: caches the whole app shell — index.html, every JS / CSS file of this build, the
     icons and manifest — plus Courier Prime and Inter (the script and UI fonts) from Google
     Fonts, so DraftLine starts and runs fully offline after one visit.
   • Pages: network first (you get the newest deploy when online), cached index.html offline.
   • Built files (hashed names, never change): cache first.
   • credits.json (About's backers roll): network first, cached copy offline.
   • Google Fonts: cached as they're used (title-page fonts too), served from cache after that.
   • Your scripts never touch this: they live in IndexedDB. Nothing is sent anywhere. */

const VERSION = "9fb105cb3219";
const PRECACHE = [
  "./",
  "./apple-touch-icon.png",
  "./assets/BeatBoard-BIdZb504.js",
  "./assets/BeatBoard-D7X5VAq8.css",
  "./assets/CourierPrime-Bold-CsRXgBhi.ttf",
  "./assets/CourierPrime-BoldItalic-C1DEdWqk.ttf",
  "./assets/CourierPrime-Italic-B-AEgkAt.ttf",
  "./assets/CourierPrime-Regular-DXo6U2x0.ttf",
  "./assets/ExportBibleModal-BuXvh2R6.js",
  "./assets/ExportBibleModal-C9aHjvc7.css",
  "./assets/FeedbackModal-DvyHlrnx.css",
  "./assets/FeedbackModal-nOxG13TJ.js",
  "./assets/FormatDoctorModal-BhyjR28W.js",
  "./assets/FormatDoctorModal-MoqthPTC.css",
  "./assets/HelpModal-C92pUSVN.js",
  "./assets/HelpModal-CeRgXKiy.css",
  "./assets/ImportModal-BB2fU-QF.js",
  "./assets/ImportModal-D6R5UZVT.css",
  "./assets/PlanningWorkspace-Xw1FtPq3.css",
  "./assets/PlanningWorkspace-aWaEO1u5.js",
  "./assets/RenameCharacterModal-DagY3wg-.css",
  "./assets/RenameCharacterModal-DwOON0ia.js",
  "./assets/SnapshotCompare-Bbu1Htu0.js",
  "./assets/SnapshotCompare-Dd53CaHc.css",
  "./assets/UserGuideModal-BVWC8KuI.css",
  "./assets/UserGuideModal-SACQ0_aQ.js",
  "./assets/compilePdfAsync-DLqsFKlp.js",
  "./assets/docxImport-C1nTSu2R.js",
  "./assets/fonts-DoPv2lcE.js",
  "./assets/formatting-BYoP7DnV.js",
  "./assets/fountain-kjFe5YxB.js",
  "./assets/index-6eGQWMZd.css",
  "./assets/index-twaw8lAM.js",
  "./assets/lib-DI1hcji2.js",
  "./assets/pdf.worker-BXY6T4jA.js",
  "./assets/printTitle-C1qWomuv.js",
  "./assets/productionEngine-5P2xLlrk.js",
  "./assets/react-DgawKyfb.js",
  "./assets/reports-BBikfpDb.js",
  "./assets/rolldown-runtime-BCiCTKAo.js",
  "./assets/scriptDiff.worker-CU0LXjzf.js",
  "./assets/scriptPdf-UL91e2-h.js",
  "./assets/sluglines-Clmyn662.js",
  "./assets/titleFonts-CncB-K-b.js",
  "./credits.json",
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

  // credits.json (About → Executive Producers & Patrons): network first, so backers added in a
  // deploy show up while online; offline, the copy cached at install (or last fetched) is used.
  if (url.pathname.endsWith('/credits.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put('./credits.json', res.clone());
        return res;
      } catch {
        return (await cache.match('./credits.json', { ignoreSearch: true, ignoreVary: true })) || Response.error();
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
