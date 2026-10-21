// Print with a chosen title, so Chrome's "Save as PDF" suggests "<title>.pdf".
//
// Chrome names the PDF after the printed document's title — and, printing from an iframe, often
// after the top-level page's title instead. It reads it when the print dialog opens, and for an
// iframe that happens *after* print() returns. So the title is set on both documents and left set
// until the dialog is over: restored on `afterprint` (from either window), or — should a browser
// never send it — on the next click or key press in the app, which can't happen while the
// (modal) print dialog is still up. Never restored synchronously after print().

/**
 * Set `title` on the page and on the print frame; returns `restore()`, which runs once.
 *   topWindow  — the app's window (its document.title is the tab title)
 *   frameWindow — the hidden frame being printed
 *   onDone     — called once, after the title is back (e.g. remove the frame, return focus)
 */
export function holdPrintTitle({ topWindow, frameWindow, title, onDone }) {
  const topDoc = topWindow.document;
  const saved = topDoc.title;
  topDoc.title = title;
  if (frameWindow?.document) frameWindow.document.title = title;

  let done = false;
  const windows = [topWindow, frameWindow].filter(Boolean);
  const docs = windows.map((w) => w.document).filter(Boolean); // focus may be in either
  const restore = () => {
    if (done) return;
    done = true;
    for (const w of windows) w.removeEventListener('afterprint', restore);
    for (const d of docs) {
      d.removeEventListener('pointerdown', fallback, true);
      d.removeEventListener('keydown', fallback, true);
    }
    // Only if nothing has set a new title meanwhile (e.g. the script was renamed).
    if (topDoc.title === title) topDoc.title = saved;
    onDone?.();
  };
  // After print() returns, the first click / key in the app means the dialog has closed.
  const fallback = () => restore();
  for (const w of windows) w.addEventListener('afterprint', restore);
  const armFallback = () => {
    if (done) return;
    for (const d of docs) {
      d.addEventListener('pointerdown', fallback, true);
      d.addEventListener('keydown', fallback, true);
    }
  };
  return { restore, armFallback, saved };
}
