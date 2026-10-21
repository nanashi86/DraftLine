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

/**
 * Print `html` from its own window — the most reliable way to get "<title>.pdf": the print dialog
 * belongs to a top-level page whose only title is `title`, whatever the app's tab (or installed
 * app window) is called. The window closes itself after printing. Returns the window, or null when
 * the browser blocked the popup (the caller then falls back to printing in place).
 *   openWindow — window.open (injectable for tests)
 */
export function printInNewWindow({ openWindow, html, title, features = 'width=800,height=900' }) {
  let w = null;
  try {
    w = openWindow('', '_blank', features);
  } catch {
    w = null;
  }
  if (!w || !w.document) return null;
  const doc = w.document;
  doc.open();
  doc.write(html);
  doc.close();
  doc.title = title;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      w.close();
    } catch {
      /* already gone */
    }
  };
  w.onafterprint = close;
  let printed = false;
  const go = () => {
    if (printed) return;
    printed = true;
    w.focus();
    w.print();
  };
  // Print once the page (and its styles) has loaded; written documents are often complete already.
  if (doc.readyState === 'complete') setTimeout(go, 50);
  else {
    w.addEventListener?.('load', () => setTimeout(go, 50), { once: true });
    setTimeout(go, 1500); // in case load never fires
  }
  return w;
}
