// Which wrapped line of a script textarea the cursor is on (Editor.jsx routes split dialogue by
// it; the phone element bar keeps that line above the keyboard).

/**
 * The visual line (0-based) the caret is on in a textarea, as the browser wraps it: a hidden copy
 * of the text up to the caret, in the same box and font, and where its end lands. (The arithmetic
 * wrap model can differ from the browser by a word near a line end; page seams must not.)
 */
export function caretLine(ta, pos) {
  const mirror = document.createElement('div');
  const cs = getComputedStyle(ta);
  mirror.className = 'el-text';
  Object.assign(mirror.style, {
    position: 'absolute', visibility: 'hidden', top: '0', left: '0', width: `${ta.clientWidth}px`,
    textTransform: cs.textTransform, textAlign: cs.textAlign, fontWeight: cs.fontWeight,
  });
  mirror.textContent = ta.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = ta.value.slice(pos, pos + 1) || '\u200b';
  mirror.appendChild(mark);
  ta.parentElement.appendChild(mirror);
  const line = Math.round(mark.offsetTop / (parseFloat(cs.lineHeight) || 1));
  mirror.remove();
  return Math.max(0, line);
}
