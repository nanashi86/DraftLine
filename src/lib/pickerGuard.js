// Is a native dropdown list open right now? The list of a <select> is drawn by the browser above the
// whole page, so nothing on the page (an ⓘ tooltip, say) can appear over it: a tooltip opened while it
// is showing ends up hidden behind it. Hover tooltips ask this first and stay closed until it shuts.
//
// The browser doesn't say when the list opens or closes, so this follows the events around it:
//   opens  — a mouse press on a <select>, or Space / Enter / Alt+↓ / F4 on a focused one
//   closes — a pick (change), the <select> losing focus, Escape / Enter / Tab, any mouse press
//            elsewhere, or a second press on the same <select> (which toggles its list)
// Re-picking the option that was already chosen fires no change event; the next click or key
// anywhere closes the state then, so at worst hover tooltips wait for that.

const OPEN_KEYS = new Set([' ', 'Enter', 'F4']);
const CLOSE_KEYS = new Set(['Escape', 'Enter', 'Tab']);

const selectOf = (target) => (target && typeof target.closest === 'function' ? target.closest('select') : null);

/** Follow native dropdown lists on `doc`. Returns { isOpen(), close(), dispose() }. */
export function createPickerGuard(doc) {
  let openOn = null; // the <select> whose list is showing

  const onDown = (e) => {
    const sel = selectOf(e.target);
    openOn = sel && sel !== openOn ? sel : null; // a second press on the same one closes it
  };
  const onKey = (e) => {
    const sel = selectOf(e.target);
    if (!sel) return;
    if (openOn === sel && CLOSE_KEYS.has(e.key)) openOn = null;
    else if (OPEN_KEYS.has(e.key) || (e.altKey && e.key === 'ArrowDown')) openOn = sel;
  };
  const shut = (e) => {
    if (!e || selectOf(e.target) === openOn) openOn = null;
  };

  doc.addEventListener('mousedown', onDown, true);
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('change', shut, true);
  doc.addEventListener('focusout', shut, true);

  return {
    isOpen: () => openOn !== null,
    close: () => {
      openOn = null;
    },
    dispose() {
      doc.removeEventListener('mousedown', onDown, true);
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('change', shut, true);
      doc.removeEventListener('focusout', shut, true);
    },
  };
}

let shared = null;
/** True while a native dropdown list is open in this page (one shared guard, made on first use). */
export function nativePickerOpen() {
  if (typeof document === 'undefined') return false;
  shared ??= createPickerGuard(document);
  return shared.isOpen();
}
