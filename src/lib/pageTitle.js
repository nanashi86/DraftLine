// The browser tab's title (document.title), which is also what search engines index as the page's
// title. index.html ships SEO_TITLE; the app then names the tab after the open script, except on
// the demo, The Last Ferry: a first visit (and every crawler) opens on it, and "The Last Ferry —
// DraftLine" in a search result says nothing about what DraftLine is. A first visit now opens on a
// blank, untitled script, so that keeps SEO_TITLE too, until the writer types or names it.
import { SAMPLE_SCRIPT } from './sampleScript.js';
import { isUntitled } from './blankScript.js';

export const SEO_TITLE = 'DraftLine — Fast, Distraction-Free Screenwriting Software (PWA)';

/**
 * document.title for the open script: "<title> — DraftLine", or SEO_TITLE on the demo and on a
 * blank untitled script (blank: nothing written in it yet, lib/blankScript.js scriptIsBlank).
 */
export function pageTitle(scriptTitle, { blank = false } = {}) {
  const t = String(scriptTitle || '').trim();
  if (t === SAMPLE_SCRIPT.meta.title) return SEO_TITLE;
  if (blank && isUntitled(t)) return SEO_TITLE;
  return `${t || 'Untitled'} — DraftLine`;
}
