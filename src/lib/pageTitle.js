// The browser tab's title (document.title), which is also what search engines index as the page's
// title. index.html ships SEO_TITLE; the app then names the tab after the open script, except on
// the demo, The Last Ferry: a first visit (and every crawler) opens on it, and "The Last Ferry —
// DraftLine" in a search result says nothing about what DraftLine is.
import { SAMPLE_SCRIPT } from './sampleScript.js';

export const SEO_TITLE = 'DraftLine — Free, Offline-First Screenwriting Software (PWA)';

/** document.title for the open script: "<title> — DraftLine", or SEO_TITLE on the demo. */
export function pageTitle(scriptTitle) {
  const t = String(scriptTitle || '').trim();
  if (t === SAMPLE_SCRIPT.meta.title) return SEO_TITLE;
  return `${t || 'Untitled'} — DraftLine`;
}
