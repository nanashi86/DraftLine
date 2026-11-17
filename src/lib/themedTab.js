/**
 * Opens one of the website pages (Philosophy, Features, Compare) in a new tab that is already the page's
 * colour. A new tab is otherwise blank in the browser's own colour (black in a dark browser) until the page
 * arrives, so Editorial Light flashed black first. The tab starts as a same-origin blank page painted in the
 * theme's background, then loads the page in place; the browser keeps that colour on screen until the page
 * draws. Ctrl, ⌘, Shift and middle clicks keep the link's own behaviour.
 */
export const PAGE_BACKGROUND = { light: '#f4f0e8', dark: '#1c1d20' }; // --bg on features/, compare/, philosophy/

export function openInThemedTab(event, url, doc = document, win = window) {
  if (!event || event.defaultPrevented || event.button !== 0) return false;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
  const light = doc.documentElement.getAttribute('data-theme') === 'light';
  let tab;
  try { tab = win.open('', '_blank'); } catch { tab = null; }
  if (!tab) return false; // blocked: let the link open the page as usual
  event.preventDefault();
  try {
    const bg = light ? PAGE_BACKGROUND.light : PAGE_BACKGROUND.dark;
    tab.document.open();
    tab.document.write(`<!doctype html><meta name="color-scheme" content="${light ? 'light' : 'dark'}">`
      + `<style>html,body{margin:0;height:100%;background:${bg}}</style>`);
    tab.document.close();
  } catch { /* still loads the page, just without the colour */ }
  try { tab.opener = null; } catch { /* the page can't reach back into DraftLine either way */ }
  tab.location.replace(url);
  return true;
}
