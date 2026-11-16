/* DraftLine service worker — generated at build time from src/pwa/sw.template.js by
   src/pwa/vitePlugin.js, which fills in the build's file list and version.

   • Install: caches the whole app shell — index.html, every JS / CSS file of this build, the
     icons and manifest, Courier Prime (the script font) and Inter (the UI font), both shipped with
     the build — so DraftLine starts and runs fully offline after one visit.
   • Pages: network first (you get the newest deploy when online; the app's page is always
     revalidated, never taken from the browser's 10-minute HTTP cache), cached index.html offline.
   • Built files (hashed names, never change): cache first.
   • credits.json (About's backers roll): network first, cached copy offline.
   • Google Fonts (only the optional title-page fonts): cached as they're used, served from cache after that.
   • Your scripts never touch this: they live in IndexedDB. Nothing is sent anywhere. */

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__; // paths relative to this file, e.g. "./assets/index-abc123.js"
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
        // The app's page always asks the server ("no-cache": a quick check, a full download only
        // when it changed). GitHub Pages lets browsers keep it for 10 minutes, and a copy from
        // before a deploy points at built files that deploy removed: a blank screen.
        const res = await (isApp ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req));
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
