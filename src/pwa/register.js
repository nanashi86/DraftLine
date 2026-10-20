// Register the service worker (production builds only — in `npm run dev` it would cache
// files that Vite changes on every save). It's served next to index.html, so its scope is
// the app's base path ("/DraftLine/" on GitHub Pages, "/" elsewhere).

export function registerServiceWorker({ base = '/', prod = false, nav = globalThis.navigator, win = globalThis.window } = {}) {
  if (!prod || !nav?.serviceWorker || !win) return false;
  const go = () => nav.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {});
  if (win.document?.readyState === 'complete') go();
  else win.addEventListener('load', go, { once: true });
  return true;
}
