/* DraftLine service worker — generated at build time from src/pwa/sw.template.js by
   src/pwa/vitePlugin.js, which fills in the build's file list and version.

   • Install: caches the whole app shell — index.html, every JS / CSS file of this build, the
     icons and manifest, Courier Prime (the script font) and Inter (the UI font), both shipped with
     the build — so DraftLine starts and runs fully offline after one visit.
   • Pages: network first (you get the newest deploy when online), cached index.html offline.
   • Built files (hashed names, never change): cache first.
   • credits.json (About's backers roll): network first, cached copy offline.
   • Google Fonts (only the optional title-page fonts): cached as they're used, served from cache after that.
   • Your scripts never touch this: they live in IndexedDB. Nothing is sent anywhere. */

const VERSION = "537030866d50";
const PRECACHE = [
  "./",
  "./apple-touch-icon.png",
  "./assets/BeatBoard-C_yU070y.js",
  "./assets/BeatBoard-CqKCAXOz.css",
  "./assets/CourierPrime-Bold-CsRXgBhi.ttf",
  "./assets/CourierPrime-BoldItalic-C1DEdWqk.ttf",
  "./assets/CourierPrime-Italic-B-AEgkAt.ttf",
  "./assets/CourierPrime-Regular-DXo6U2x0.ttf",
  "./assets/Cousine-Bold-DYf9Ab59.ttf",
  "./assets/Cousine-BoldItalic-BV0tJ5Lx.ttf",
  "./assets/Cousine-Italic-DPeanP9E.ttf",
  "./assets/Cousine-Regular-BGvNlzBO.ttf",
  "./assets/ExportBibleModal-BRru2D_6.js",
  "./assets/ExportBibleModal-BmO_EhlI.css",
  "./assets/FeedbackModal-C7aOjRCt.js",
  "./assets/FeedbackModal-vQxzuaL8.css",
  "./assets/FormatDoctorModal-BPyzaHM9.css",
  "./assets/FormatDoctorModal-Bdgb5Uaa.js",
  "./assets/HelpModal-CeQaX0wE.css",
  "./assets/HelpModal-CnbnOBZc.js",
  "./assets/ImportModal-Bhf76i3C.css",
  "./assets/ImportModal-COiI6XUH.js",
  "./assets/PlanningWorkspace-BwuwCBnV.js",
  "./assets/PlanningWorkspace-D6H_UmVx.css",
  "./assets/RenameCharacterModal-CWbhiDS6.css",
  "./assets/RenameCharacterModal-CzKmyQN4.js",
  "./assets/SettingsModal-ClB7edHM.js",
  "./assets/SettingsModal-DOkz1RRV.css",
  "./assets/SnapshotCompare-Dy-weC_2.css",
  "./assets/SnapshotCompare-OmFqLn5x.js",
  "./assets/UserGuideModal-BpzC5llS.css",
  "./assets/UserGuideModal-Sp9Qe-pn.js",
  "./assets/compilePdfAsync-CzoxDJrf.js",
  "./assets/docxImport-D3RhAMSd.js",
  "./assets/fonts-D2_4q-e9.js",
  "./assets/formatting-BYoP7DnV.js",
  "./assets/index-CflX4fDe.js",
  "./assets/index-y2_9ePDI.css",
  "./assets/lib-DI1hcji2.js",
  "./assets/pdf.worker-DicYZRyc.js",
  "./assets/printTitle-C1qWomuv.js",
  "./assets/productionEngine-CEuLXwr-.js",
  "./assets/react-DgawKyfb.js",
  "./assets/reports-MFCgiJ2N.js",
  "./assets/rolldown-runtime-BCiCTKAo.js",
  "./assets/scriptDiff.worker-CU0LXjzf.js",
  "./assets/scriptPdf-q1TGHpnk.js",
  "./assets/sluglines-NngmNwiy.js",
  "./assets/titleFonts-CncB-K-b.js",
  "./compare/index.html",
  "./credits.json",
  "./favicon.svg",
  "./features/index.html",
  "./fonts/CourierPrime-OFL.txt",
  "./fonts/Inter-OFL.txt",
  "./fonts/courier-prime-400.woff2",
  "./fonts/courier-prime-700.woff2",
  "./fonts/inter-cyrillic-wght-normal.woff2",
  "./fonts/inter-greek-wght-normal.woff2",
  "./fonts/inter-latin-ext-wght-normal.woff2",
  "./fonts/inter-latin-wght-normal.woff2",
  "./fonts/inter-vietnamese-wght-normal.woff2",
  "./googlee6611a83e80afede.html",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./index.html",
  "./llms.txt",
  "./manifest.json",
  "./og-image.png",
  "./robots.txt",
  "./screenshots/desktop.webp",
  "./screenshots/phone.webp",
  "./sitemap.xml"
]; // paths relative to this file, e.g. "./assets/index-abc123.js"
const SHELL_CACHE = `draftline-shell-${VERSION}`;
const FONT_CACHE = 'draftline-fonts-v1';

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // cache: 'reload' skips the browser's HTTP cache, so a redrawn icon (same file name) is fetched fresh.
    await shell.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })));
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

  // Pages: newest when online, the cached app when offline. Only the app's own page refreshes the
  // cached index.html; other pages (features/, the verification file) are served as they are, and
  // offline from their own precached copy, so opening one never replaces the app shell.
  if (req.mode === 'navigate') {
    const root = new URL('./', self.location.href).pathname;
    const isApp = url.pathname === root || url.pathname === `${root}index.html`;
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const res = await fetch(req);
        if (res.ok && isApp) cache.put('./index.html', res.clone());
        return res;
      } catch {
        if (!isApp) {
          const own = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
          const page = await cache.match(own, { ignoreSearch: true, ignoreVary: true });
          if (page) return page;
        }
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
