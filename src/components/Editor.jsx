import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';
import { hasNote } from '../lib/editorialNotes.js';
import { linePxFor } from '../lib/zoom.js';
import { lockedKeyAction } from '../lib/lock.js';
import { revealAndPulse } from '../lib/reveal.js';
import { measureTextarea } from '../lib/measure.js';
import { backspaceAt, backspaceStepBack, deleteAt } from '../lib/editing.js';
import {
  ELEMENT_META,
  SHIFT_TAB_NEXT,
  TAB_NEXT,
  enterFlow,
  enterNextType,
  isBlank,
  lineIndexOf,
  makeBlock,
  opensParenthetical,
  pageLabel,
  toggleDualAt,
  wrapOffsets,
} from '../lib/screenplay.js';
import { elementForCode } from '../lib/shortcuts.js';
import { acceptAdvances, cycleExtension, getSuggestions, sceneTab } from '../lib/autocomplete.js';
import FormattedText from './FormattedText.jsx';
import {
  STYLES, activeStyles, clearMarks, hasMarks, sliceMarks, targetRange, toggleStyle, withMarks,
} from '../lib/formatting.js';
import './Editor.css';

/** Types where a blank block + Enter falls back to Action (Fade In-style escape hatch). */
/** Types that allow a soft line break with Shift+Enter. */
const SOFT_BREAK_TYPES = new Set(['action', 'dialogue']);

function splice(arr, idx, remove, ...items) {
  const copy = arr.slice();
  copy.splice(idx, remove, ...items);
  return copy;
}

function convert(block, type) {
  let { text } = block;
  if (type === 'parenthetical' && text.trim() === '') text = '()';
  else if (block.type === 'parenthetical' && text.trim() === '()') text = '';
  const next = { ...block, type, text };
  if (type !== 'character') delete next.dual;
  return next;
}

/**
 * Screen pixels per screenplay line at a zoom level, rounded to a whole pixel.
 * Browsers snap textarea heights to whole pixels, so a fractional line height
 * (e.g. 14.4px at 90%) would slowly drift text off the page grid.
 */
/** `block` with `text` and the formatting of [from, to) of the original — the half a split keeps. */
function withPart(block, text, from, to) {
  return withMarks({ ...block, text }, sliceMarks(block.marks, from, to));
}

/** A new element holding the tail of `src` (`text` is a suffix of src.text), keeping its formatting. */
function tailBlock(type, src, text) {
  const m = sliceMarks(src.marks, src.text.length - text.length);
  return makeBlock(type, text, m ? { marks: m } : null);
}

const NO_STYLES = { b: false, i: false, u: false, s: false };

/** Which styles the selection (or the word under a bare caret) has. */
function formatStateAt(block, start, end) {
  const r = block && targetRange(block.text, start, end);
  return r ? activeStyles(block.marks, r[0], r[1]) : NO_STYLES;
}

/** Ctrl/Cmd shortcuts → formatting command. */
function formatKey(e) {
  if (e.altKey) return null;
  if (e.code === 'Backslash' && !e.shiftKey) return 'clear';
  if (e.shiftKey) return e.code === 'KeyX' ? 's' : null;
  return { KeyB: 'b', KeyI: 'i', KeyU: 'u' }[e.code] || null;
}

/**
 * The visual line (0-based) the caret is on in a textarea, as the browser wraps it: a hidden copy
 * of the text up to the caret, in the same box and font, and where its end lands. (The arithmetic
 * wrap model can differ from the browser by a word near a line end; page seams must not.)
 */
function caretLine(ta, pos) {
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

function marginStyle(lines, gaps) {
  if (!lines && !gaps) return undefined;
  return { marginTop: `calc(var(--line) * ${lines} + var(--gap) * ${gaps})` };
}

// ---------------------------------------------------------------------------

/**
 * Editorial margin notes, in the page's *left* margin (past the scene number), so they never
 * touch the script text: a small marker on annotated lines, and — on hover — a faint ＋ to add
 * one. Either opens the Notes drawer (Alt+N too; right-click works as well). Absolutely
 * positioned, so they add nothing to line counts or pagination, and never print.
 */
function NoteMarker({ block, open, onOpen }) {
  const noted = hasNote(block);
  const text = noted ? block.note.trim() : '';
  const preview = noted ? (text ? text.split('\n')[0] : 'Empty note') : '';
  const open_ = (e) => {
    e.preventDefault();
    onOpen(block.id);
  };
  return (
    <button
      type="button"
      className={noted ? `note-mark${open ? ' is-open' : ''}` : 'note-add'}
      title={noted ? `Note: ${preview}  ·  Alt+N` : 'Add a margin note  ·  Alt+N'}
      aria-label={noted ? `Margin note: ${preview}` : 'Add a margin note'}
      aria-expanded={noted ? open : undefined}
      tabIndex={noted ? 0 : -1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={open_}
      onContextMenu={open_}
    >
      {noted ? (
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1.5h8a.5.5 0 0 1 .5.5v5.6a.5.5 0 0 1-.15.35L7.95 10.35a.5.5 0 0 1-.35.15H2a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" /><path d="M7.5 10.4V8a.5.5 0 0 1 .5-.5h2.4" fill="none" /></svg>
      ) : '+'}
    </button>
  );
}

/**
 * Page seams (screenplay.js paginate): a speech split across a page shows "(MORE)" under its last
 * line on the first page and "NAME (CONT'D)" over the rest on the next. Both are drawn here, never
 * written into the script. A dialogue element split mid-paragraph is shown as two clipped views of
 * the same text — each a real, editable textarea — one per page; the caret hands over between them
 * as it crosses the seam (see routeCaret in Editor).
 */
function seamClip(piece) {
  return {
    clip: { height: `calc(var(--line) * ${piece.to - piece.from})`, overflow: 'hidden' },
    body: piece.from ? { marginTop: `calc(var(--line) * ${-piece.from})` } : undefined,
  };
}

/**
 * Find & Replace highlights: a copy of the element's text laid over it, transparent but for the
 * matches (the current one stronger). Same font and width as the textarea, so they line up —
 * and inside each page-seam view, so a match in a split speech shows on the right page.
 */
function FindMarks({ text, hits }) {
  const out = [];
  let at = 0;
  hits.forEach(([s, e, current], k) => {
    if (s > at) out.push(text.slice(at, s));
    out.push(<mark key={k} className={current ? 'is-current' : undefined}>{text.slice(s, e)}</mark>);
    at = e;
  });
  if (at < text.length) out.push(text.slice(at));
  return <div className="el-text el-find" aria-hidden="true">{out}</div>;
}

const Block = memo(function Block({
  block, sceneNumber, isActive, isHighlighted, isDim, isDense, marginLines, marginGaps,
  register, observe, onText, onKey, onFocusBlock,
  noteOpen, onOpenNote, locked = false,
  piece = null, split = false, partIndex = 0, hits = null,
}) {
  const setRef = useCallback((el) => register(block.id, el, partIndex), [register, block.id, partIndex]);
  const meta = ELEMENT_META[block.type];
  const primary = partIndex === 0;
  const { clip, body } = split ? seamClip(piece) : {};
  return (
    <div
      className={`el el-${block.type}${isActive ? ' is-active' : ''}${isHighlighted ? ' is-highlighted' : ''}${isDim ? ' is-dim' : ''}${isDense ? ' is-dense' : ''}${hasNote(block) ? ' has-note' : ''}${noteOpen ? ' is-note-open' : ''}${hasMarks(block.marks) ? ' has-fmt' : ''}${split ? ' is-split' : ''}`}
      style={observe || !primary ? marginStyle(marginLines, marginGaps) : undefined}
    >
      {piece?.cont ? <div className="el-seam el-contd" aria-hidden="true">{piece.cont}</div> : null}
      {sceneNumber != null && (
        <>
          <span className="scene-no scene-no-left" aria-hidden="true">{sceneNumber}</span>
          <span className="scene-no scene-no-right" aria-hidden="true">{sceneNumber}</span>
        </>
      )}
      <div className="el-clip" style={clip}>
        <div
          className="el-body"
          ref={primary ? observe : undefined}
          data-key={primary && observe ? block.id : undefined}
          style={body}
        >
          {hasMarks(block.marks) && (
            // A textarea can't style part of its text, so a formatted element shows an exact,
            // styled copy of its text laid over the (then transparent) textarea, which keeps
            // the caret, selection and typing. Courier is monospaced in every weight and slant,
            // so both wrap identically.
            <FormattedText className="el-text el-fmt" aria-hidden="true" text={block.text} marks={block.marks} />
          )}
          {hits && <FindMarks text={block.text} hits={hits} />}
          <AutoTextarea
            ref={setRef}
            className="el-input"
            value={block.text}
            measureKey={block.type}
            snapToLines
            spellCheck={meta.spellcheck}
            autoCorrect={meta.spellcheck ? 'on' : 'off'}
            placeholder={isActive && !locked && primary ? meta.label : ''}
            readOnly={locked}
            aria-label={meta.label}
            aria-hidden={primary ? undefined : 'true'}
            tabIndex={primary ? undefined : -1}
            data-id={block.id}
            data-part={split ? partIndex : undefined}
            data-from={split ? piece.from : undefined}
            data-to={split ? piece.to : undefined}
            onChange={(e) => onText(block.id, e.target.value)}
            onKeyDown={(e) => onKey(e, block.id)}
            onFocus={() => onFocusBlock(block.id)}
          />
        </div>
      </div>
      {piece?.more ? <div className="el-seam el-more" aria-hidden="true">(MORE)</div> : null}
      {onOpenNote && primary && <NoteMarker block={block} open={noteOpen} onOpen={onOpenNote} />}
    </div>
  );
});

const DualRow = memo(function DualRow({
  item, activeId, highlightId, spotlight, dense, marginLines, marginGaps, register, observe, onText, onKey, onFocusBlock,
  openNoteId, onOpenNote, locked, findHits = null,
}) {
  const col = (bs) => bs.map((b) => (
    <Block
      key={b.id}
      block={b}
      isActive={b.id === activeId}
      isHighlighted={b.id === highlightId}
      isDim={!!spotlight && !spotlight.has(b.id)}
      isDense={!!dense && dense.has(b.id)}
      hits={findHits?.get(b.id) || null}
      register={register}
      onText={onText}
      onKey={onKey}
      onFocusBlock={onFocusBlock}
      noteOpen={b.id === openNoteId}
      onOpenNote={onOpenNote}
      locked={locked}
    />
  ));
  return (
    <div ref={observe} data-key={item.key} className="dual-row" style={marginStyle(marginLines, marginGaps)}>
      <span className="dual-tag" aria-hidden="true">DUAL</span>
      <div className="dual-col">{col(item.left)}</div>
      <div className="dual-col">{col(item.right)}</div>
    </div>
  );
});

function Suggestions({ anchorId, els, sheetRef, list, index, onPick, onHover }) {
  const boxRef = useRef(null);
  useLayoutEffect(() => {
    const el = els.current.get(anchorId);
    const box = boxRef.current;
    const sheet = sheetRef.current;
    if (!el || !box || !sheet) return;
    const r = el.getBoundingClientRect();
    const s = sheet.getBoundingClientRect();
    box.style.top = `${r.bottom - s.top + 4}px`;
    box.style.left = `${r.left - s.left}px`;
  });
  return (
    <div ref={boxRef} className="ac" role="listbox" aria-label="Suggestions">
      {list.map((s, i) => (
        <div
          key={s.value}
          role="option"
          aria-selected={i === index}
          className={`ac-item${i === index ? ' is-sel' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(s, false);
          }}
          onMouseEnter={() => onHover(i)}
        >
          <span className="ac-label">{s.label}</span>
          <span className="ac-kind">{s.kind}</span>
        </div>
      ))}
      <div className="ac-hint">
        <kbd>↵</kbd>/<kbd>Tab</kbd> accept · <kbd>Esc</kbd> dismiss
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const NO_CAST = [];

export default function Editor({
  ref,
  blocks,
  items,
  layout,
  sceneNumbers,
  activeId,
  highlightId,
  cast = NO_CAST, // Story Bible character names, offered by Character autocomplete
  findHits = null, // Find & Replace: Map id → [[start, end, isCurrent]] (lib/findReplace.js hitsById)
  dense = null, // Density Mode: Set of dense action block ids to mark in the gutter (lib/pacing.js)
  spotlight = null, // Set of block ids to keep bright (Characters → Dialogue filter); the rest dim
  zoom,
  hidden = false,
  onCommit,
  onTextChange,
  openNoteId = null, // the element whose note is open in the Notes drawer
  onOpenNote, // (id, { quote }) → open (or start) that element's note in the drawer
  onUndo,
  onRedo,
  onActiveChange,
  onMeasure,
  onNotice,
  onFormatState,
  locked = false, // View Only (lib/lock.js): read, select, copy and scroll — no changes
  onLockedEdit, // a change was tried while locked (the app says how to unlock)
}) {
  const blocksRef = useRef(blocks);
  const lockedRef = useRef(locked);
  const onLockedEditRef = useRef(onLockedEdit);
  const els = useRef(new Map());
  const sheetRef = useRef(null);
  const pendingFocus = useRef(null);
  const zoomRef = useRef(zoom);
  const onMeasureRef = useRef(onMeasure);
  const roRef = useRef(null);
  const acRef = useRef({ list: [], index: 0, blockId: null });

  const [typedIn, setTypedIn] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const [acState, setAcState] = useState({ sig: '', index: 0 });
  const lastSel = useRef(null); // { id, start, end } of the last selection inside the script
  // The second (third…) view of a split element (page seams), by `${id}#${part}`; see register.
  const partEls = useRef(new Map());
  const partFocusLost = useRef(null);
  const pointerDown = useRef(false); // while a click or drag is placing the caret, don't route it
  const lastFmt = useRef('');
  const onFormatStateRef = useRef(onFormatState);

  // ---- Autocomplete ----
  const activeBlock = useMemo(() => blocks.find((b) => b.id === activeId) || null, [blocks, activeId]);
  const suggestions = useMemo(() => {
    if (!activeBlock || locked) return [];
    if (typedIn !== activeBlock.id && activeBlock.text !== '') return [];
    if (dismissed === `${activeBlock.id}:${activeBlock.text}`) return [];
    return getSuggestions(activeBlock, blocks, { cast });
  }, [activeBlock, blocks, typedIn, dismissed, locked, cast]);
  const sig = suggestions.map((s) => s.value).join('|');
  const acIndex = acState.sig === sig ? Math.min(acState.index, suggestions.length - 1) : 0;

  useLayoutEffect(() => {
    blocksRef.current = blocks;
    lockedRef.current = locked;
    onLockedEditRef.current = onLockedEdit;
    zoomRef.current = zoom;
    onMeasureRef.current = onMeasure;
    onFormatStateRef.current = onFormatState;
    acRef.current = { list: suggestions, index: acIndex, blockId: activeBlock?.id ?? null, sig };
  });

  // Apply a caret request after the DOM reflects the latest block structure.
  useLayoutEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    const el = els.current.get(p.id);
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
    const c = p.caret === 'end' ? el.value.length : Math.min(p.caret, el.value.length);
    const e2 = p.selEnd != null ? Math.min(p.selEnd, el.value.length) : c;
    el.setSelectionRange(c, e2);
  });

  /**
   * A split dialogue element is two (or more) clipped views of one text. When the caret sits on a
   * line outside the view that has focus, move focus — same selection — to the view showing it.
   */
  const routeCaret = useCallback((el) => {
    if (pointerDown.current || !el?.dataset || el.dataset.to == null || !sheetRef.current?.contains(el)) return;
    const id = el.dataset.id;
    const b = blocksRef.current.find((x) => x.id === id);
    if (!b) return;
    const caret = el.selectionDirection === 'backward' ? el.selectionStart : el.selectionEnd;
    const line = caretLine(el, caret);
    const inView = (v, l) => l >= Number(v.dataset.from) && l < Number(v.dataset.to);
    if (inView(el, line)) return;
    const views = [els.current.get(id), ...[1, 2, 3, 4].map((i) => partEls.current.get(`${id}#${i}`))].filter(Boolean);
    const target = views.find((v) => v.dataset.to != null && inView(v, line));
    if (!target || target === el) return;
    const { selectionStart: a, selectionEnd: z, selectionDirection: dir } = el;
    target.focus({ preventScroll: true });
    target.setSelectionRange(a, z, dir);
    target.closest('.el')?.scrollIntoView({ block: 'nearest' });
  }, []);

  // ---- Formatting: report which styles the selection has (drives the toolbar's B I U S) ----
  const syncFormat = useCallback(() => {
    const sel = lastSel.current;
    const b = sel && blocksRef.current.find((x) => x.id === sel.id);
    const st = b ? formatStateAt(b, sel.start, sel.end) : NO_STYLES;
    const key = STYLES.filter((k) => st[k]).join('');
    if (key !== lastFmt.current) {
      lastFmt.current = key;
      onFormatStateRef.current?.(st);
    }
  }, []);

  useEffect(() => {
    const onSel = () => {
      const el = document.activeElement;
      if (!el?.classList?.contains('el-input') || !sheetRef.current?.contains(el)) return;
      lastSel.current = { id: el.dataset.id, start: el.selectionStart, end: el.selectionEnd };
      syncFormat();
      routeCaret(el);
    };
    // Capture phase: Chrome fires selectionchange at the textarea itself.
    document.addEventListener('selectionchange', onSel, true);
    // A click sets the caret on mouseup; route only once it has landed.
    // Left button only: a right-click keeps the caret and focus exactly where the browser put them,
    // so its spelling suggestions apply to the word under the pointer.
    const onDown = (e) => {
      if (e.button === 0 && sheetRef.current?.contains(e.target)) pointerDown.current = true;
    };
    const onUp = (e) => {
      if (e.button !== 0 || !pointerDown.current) return;
      pointerDown.current = false;
      setTimeout(() => routeCaret(document.activeElement), 0);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('mouseup', onUp, true);
    return () => {
      document.removeEventListener('selectionchange', onSel, true);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('mouseup', onUp, true);
    };
  }, [syncFormat, routeCaret]);

  // After every render: a seam that moved (or closed) may have left the caret outside the view
  // that has focus — or taken that view away.
  useLayoutEffect(() => {
    const lost = partFocusLost.current;
    if (lost) {
      partFocusLost.current = null;
      const el = els.current.get(lost.id);
      if (el) {
        el.focus({ preventScroll: true });
        el.setSelectionRange(lost.start, lost.end, lost.dir);
      }
    }
    routeCaret(document.activeElement);
  });

  useLayoutEffect(() => syncFormat());

  // Textareas edited while hidden (e.g. via the Dialogue panel in Board view) measure on return.
  useLayoutEffect(() => {
    if (hidden) return;
    sheetRef.current?.querySelectorAll('textarea[data-stale]').forEach((el) => measureTextarea(el, true));
  }, [hidden]);

  // ---- Line measurement: each row reports its height in screenplay lines ----
  const observe = useCallback((el) => {
    if (!el) return undefined;
    if (!roRef.current) {
      roRef.current = new ResizeObserver((entries) => {
        const linePx = linePxFor(zoomRef.current);
        const changes = {};
        for (const en of entries) {
          const key = en.target.dataset.key;
          if (!key) continue;
          const h = en.borderBoxSize?.[0]?.blockSize ?? en.target.offsetHeight;
          if (h === 0) continue; // editor hidden (Board view): keep the last measurement
          changes[key] = Math.max(1, Math.round(h / linePx));
        }
        onMeasureRef.current?.(changes);
      });
    }
    const ro = roRef.current;
    ro.observe(el);
    return () => ro.unobserve(el);
  }, []);

  // Element textareas by block id. The second (third…) view of a split element is kept apart, in
  // partEls, so focusing a block always means its first view; routeCaret moves on from there.
  const register = useCallback((id, el, part = 0) => {
    if (!part) {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
      return;
    }
    const key = `${id}#${part}`;
    if (el) {
      partEls.current.set(key, el);
      return;
    }
    // A seam view going away (the split closed up) while it had the caret: hand it back.
    const old = partEls.current.get(key);
    if (old && document.activeElement === old) {
      partFocusLost.current = { id, start: old.selectionStart, end: old.selectionEnd, dir: old.selectionDirection };
    }
    partEls.current.delete(key);
  }, []);

  const focusNow = useCallback((id, caret) => {
    const el = els.current.get(id);
    if (!el) return;
    el.focus();
    const c = caret === 'end' ? el.value.length : Math.max(0, Math.min(caret, el.value.length));
    el.setSelectionRange(c, c);
  }, []);

  const commit = useCallback((next, focus) => {
    if (lockedRef.current) {
      onLockedEditRef.current?.();
      return;
    }
    if (focus) pendingFocus.current = focus;
    onCommit(next);
  }, [onCommit]);

  const setTypeAt = useCallback((idx, type, caret) => {
    const cur = blocksRef.current;
    const b = cur[idx];
    if (!b || b.type === type) return;
    const nb = convert(b, type);
    const c = nb.text === '()' ? 1 : (caret ?? 'end');
    commit(splice(cur, idx, 1, nb), { id: b.id, caret: c });
  }, [commit]);

  const toggleDual = useCallback((id) => {
    if (lockedRef.current) {
      onLockedEditRef.current?.();
      return;
    }
    const cur = blocksRef.current;
    const idx = cur.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const res = toggleDualAt(cur, idx);
    if (res.error) {
      onNotice?.(res.error);
      return;
    }
    const el = els.current.get(id);
    commit(res.blocks, { id, caret: el ? el.selectionStart : 'end' });
    onNotice?.(res.paired ? 'Dual dialogue on' : 'Dual dialogue off');
  }, [commit, onNotice]);

  /**
   * Ctrl+B / I / U, Ctrl+Shift+X, Ctrl+\ and the toolbar: toggle a style (or clear all of
   * them) on the selection, or on the word under a bare caret. The selection is kept.
   */
  const formatAt = useCallback((id, start, end, style) => {
    if (lockedRef.current) {
      onLockedEditRef.current?.();
      return;
    }
    const cur = blocksRef.current;
    const idx = cur.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const b = cur[idx];
    const r = targetRange(b.text, start, end);
    if (!r) {
      onNotice?.('Select some text (or put the cursor in a word) to format it');
      return;
    }
    const marks = style === 'clear' ? clearMarks(b.marks, r[0], r[1]) : toggleStyle(b.marks, style, r[0], r[1]).marks;
    commit(splice(cur, idx, 1, withMarks(b, marks)), { id, caret: start, selEnd: end });
  }, [commit, onNotice]);

  const acceptSuggestion = useCallback((s, advance) => {
    const cur = blocksRef.current;
    const id = acRef.current.blockId;
    const idx = cur.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const b = cur[idx];
    const updated = { ...b, text: s.value };
    if (advance && b.type === 'character') {
      const next = cur[idx + 1];
      if (next && (next.type === 'dialogue' || next.type === 'parenthetical')) {
        commit(splice(cur, idx, 1, updated), { id: next.id, caret: next.type === 'parenthetical' ? 1 : 'end' });
      } else {
        const d = makeBlock('dialogue');
        commit(splice(cur, idx, 1, updated, d), { id: d.id, caret: 0 });
      }
      return;
    }
    commit(splice(cur, idx, 1, updated), { id: b.id, caret: 'end' });
  }, [commit]);

  useImperativeHandle(ref, () => ({
    setType(id, type) {
      const idx = blocksRef.current.findIndex((b) => b.id === id);
      if (idx >= 0) setTypeAt(idx, type);
    },
    toggleDual,
    format(style) {
      const sel = lastSel.current;
      if (sel && blocksRef.current.some((b) => b.id === sel.id)) formatAt(sel.id, sel.start, sel.end, style);
      else onNotice?.('Click into the script and select some text to format it');
    },
    /** Scroll element `id` into view without moving focus (the Notes drawer keeps it). */
    revealBlock(id) {
      els.current.get(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    /** Scroll element `id` to the middle of the view and pulse it (Density jumps). No focus change. */
    pulseBlock(id) {
      return revealAndPulse(els.current.get(id)?.closest('.el') || null);
    },
    /** Scroll the current Find match into view (on the page piece that shows it), without taking focus. */
    revealFind() {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const marks = [...sheet.querySelectorAll('.el-find mark.is-current')];
      const shown = marks.find((m) => {
        const r = m.getBoundingClientRect();
        const c = m.closest('.el-clip').getBoundingClientRect();
        return r.top >= c.top - 1 && r.bottom <= c.bottom + 1;
      }) || marks[0];
      if (!shown) return;
      const scroller = sheet.closest('.scroller') || sheet.parentElement;
      const r = shown.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      if (r.top < s.top + 72 || r.bottom > s.bottom - 48) {
        scroller.scrollTo({ top: scroller.scrollTop + (r.top - s.top) - s.height / 3, behavior: 'smooth' });
      }
    },
    /** Put the cursor in element `id` (at its end; `{ at: 'start' }` for its start), scrolling it to the
     *  middle unless `{ scroll: false }` — an import puts it on page 1 without moving the page. */
    /** Put the cursor in element `id` with [start, end) selected (Find: Esc leaves the match selected). */
    focusRange(id, start, end) {
      const el = els.current.get(id);
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(start, end);
    },
    focusBlock(id, { scroll = true, at = 'end' } = {}) {
      const el = els.current.get(id);
      if (!el) return;
      if (scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
      const pos = at === 'start' ? 0 : el.value.length;
      el.setSelectionRange(pos, pos);
    },
  }), [setTypeAt, toggleDual, formatAt, onNotice]);

  const handleText = useCallback((id, text) => {
    if (lockedRef.current) return; // read-only textareas don't fire this; belt and braces
    setTypedIn(id);
    onTextChange(id, text);
  }, [onTextChange]);

  const handleFocus = useCallback((id) => {
    setTypedIn((t) => (t === id ? t : null));
    onActiveChange(id);
  }, [onActiveChange]);

  const handleKeyDown = useCallback((e, id) => {
    const cur = blocksRef.current;
    const idx = cur.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const b = cur[idx];
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    const { text } = b;
    const mod = e.ctrlKey || e.metaKey;

    // View Only: only line-to-line movement and the margin note get past here.
    if (lockedRef.current) {
      const act = lockedKeyAction(e);
      if (act === 'native') return;
      if (act === 'blocked') {
        e.preventDefault();
        if (!e.repeat) onLockedEditRef.current?.();
        return;
      }
    }

    // History
    if (mod && !e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) onRedo(); else onUndo();
      return;
    }
    if (mod && !e.altKey && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      onRedo();
      return;
    }
    // Ctrl/Cmd+B · I · U, Ctrl+Shift+X (strikethrough), Ctrl+\ (clear formatting)
    if (mod) {
      const style = formatKey(e);
      if (style) {
        e.preventDefault();
        formatAt(id, start, end, style);
        return;
      }
    }

    // Autocomplete dropdown has first claim on navigation keys.
    const ac = acRef.current;
    if (ac.list.length && ac.blockId === id && !mod && !e.altKey) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = ac.list.length;
        const i = (ac.index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        setAcState({ sig: ac.sig, index: i });
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        // A character name moves on to its Dialogue line (Enter or Tab); a heading stays put on Tab.
        acceptSuggestion(ac.list[ac.index], acceptAdvances(b, e.key));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setDismissed(`${id}:${text}`);
        return;
      }
    }

    // Alt+1…8: set the element type directly (bindings: ELEMENT_SHORTCUTS in shortcuts.js)
    const altType = e.altKey && !mod ? elementForCode(e.code) : null;
    if (altType) {
      e.preventDefault();
      setTypeAt(idx, altType, start);
      return;
    }
    // Alt+N: open this line's margin note in the Notes drawer (starting one if needed). A selection
    // is quoted into the note — the script text itself is never changed.
    if (e.altKey && !mod && e.code === 'KeyN') {
      e.preventDefault();
      onOpenNote?.(id, { quote: text.slice(start, end) });
      return;
    }

    // "(" at the start of an empty Dialogue line: it's a Parenthetical — "()" with the caret inside.
    if (!mod && !e.altKey && opensParenthetical(b, e.key) && start === end) {
      e.preventDefault();
      commit(splice(cur, idx, 1, { ...b, type: 'parenthetical', text: '()' }), { id: b.id, caret: 1 });
      return;
    }

    // Alt+D: dual dialogue
    if (e.altKey && !mod && e.code === 'KeyD') {
      e.preventDefault();
      toggleDual(id);
      return;
    }

    switch (e.key) {
      case 'Enter': {
        if (e.shiftKey && SOFT_BREAK_TYPES.has(b.type)) return; // native soft break
        e.preventDefault();
        if (e.nativeEvent.isComposing) return;

        if (enterFlow(b).convertTo) { // an empty Dialogue / Character … line steps out to Action
          setTypeAt(idx, 'action', 0);
          return;
        }

        let s = start;
        let en = end;
        if (b.type === 'parenthetical' && text.endsWith(')') && s === en && s === text.length - 1) {
          s = en = text.length;
        }
        if (s === 0 && en === 0 && text.length > 0) {
          commit(splice(cur, idx, 0, makeBlock('action')), { id: b.id, caret: 0 });
          return;
        }

        const before = text.slice(0, s).replace(/[ \t]+$/, '');
        const after = text.slice(en).replace(/^[ \t]+/, '');
        const nb = tailBlock(enterNextType(b, after), b, after);
        commit(splice(cur, idx, 1, withPart(b, before, 0, before.length), nb), { id: nb.id, caret: 0 });
        return;
      }

      case 'Tab': {
        e.preventDefault();
        if (e.shiftKey) {
          setTypeAt(idx, SHIFT_TAB_NEXT[b.type], start);
          return;
        }
        const blank = isBlank(text);
        // Scene Heading: on to the time of day ("INT. HOUSE" → "INT. HOUSE - ", its list opens),
        // and once complete, down to a new Action line.
        if (!blank && b.type === 'scene') {
          const st = sceneTab(text);
          if (st.text !== undefined) {
            commit(splice(cur, idx, 1, { ...b, text: st.text }), { id: b.id, caret: st.text.length });
            setTypedIn(b.id);
          } else if (st.advance) {
            const nb = makeBlock('action');
            commit(splice(cur, idx, 1, b, nb), { id: nb.id, caret: 0 });
          }
          return;
        }
        // Character cue: cycle the extension — (O.S.) → (V.O.) → (CONT'D) → none.
        if (!blank && b.type === 'character') {
          const next = cycleExtension(text);
          commit(splice(cur, idx, 1, { ...b, text: next }), { id: b.id, caret: next.replace(/\s*\^\s*$/, '').length });
          return;
        }
        if (!blank && b.type === 'action') {
          const before = text.slice(0, start).replace(/\s+$/, '');
          const after = text.slice(end).replace(/^\s+/, '');
          const cue = makeBlock('character');
          const tail = after ? [tailBlock('action', b, after)] : [];
          commit(splice(cur, idx, 1, withPart(b, before, 0, before.length), cue, ...tail), { id: cue.id, caret: 0 });
          return;
        }
        if (!blank && b.type === 'dialogue') {
          const before = text.slice(0, start).replace(/\s+$/, '');
          const after = text.slice(end).replace(/^\s+/, '');
          const paren = makeBlock('parenthetical', '()');
          const tail = after ? [tailBlock('dialogue', b, after)] : [];
          if (before === '') {
            commit(splice(cur, idx, 1, paren, { ...b, text: after }), { id: paren.id, caret: 1 });
          } else {
            commit(splice(cur, idx, 1, withPart(b, before, 0, before.length), paren, ...tail), { id: paren.id, caret: 1 });
          }
          return;
        }
        setTypeAt(idx, TAB_NEXT[b.type], start);
        return;
      }

      case 'Backspace': {
        if (b.type === 'parenthetical' && text === '()' && start === 1 && end === 1) {
          e.preventDefault();
          setTypeAt(idx, 'dialogue', 0);
          return;
        }
        // An empty Character / Dialogue / … line steps back to Action before anything is deleted.
        {
          const step = backspaceStepBack(b, start, end);
          if (step) {
            e.preventDefault();
            setTypeAt(idx, step, 0);
            return;
          }
        }
        {
          const r = backspaceAt(cur, idx, start, end);
          if (r) {
            e.preventDefault();
            commit(r.blocks, r.focus);
          }
        }
        return;
      }

      case 'Delete': {
        const r = deleteAt(cur, idx, start, end);
        if (r) {
          e.preventDefault();
          commit(r.blocks, r.focus);
        }
        return;
      }

      case 'ArrowUp':
      case 'ArrowDown': {
        if (e.shiftKey || e.altKey || mod || start !== end) return;
        const meta = ELEMENT_META[b.type];
        const lines = wrapOffsets(text, meta.cpl);
        const li = lineIndexOf(lines, start);
        const visualCol = meta.indent + (start - lines[li][0]);
        const up = e.key === 'ArrowUp';
        if (up && li === 0 && idx > 0) {
          e.preventDefault();
          const prev = cur[idx - 1];
          const pm = ELEMENT_META[prev.type];
          const pl = wrapOffsets(prev.text, pm.cpl);
          const [ls, le] = pl[pl.length - 1];
          focusNow(prev.id, Math.min(ls + Math.max(0, visualCol - pm.indent), le));
        } else if (!up && li === lines.length - 1 && idx < cur.length - 1) {
          e.preventDefault();
          const next = cur[idx + 1];
          const nm = ELEMENT_META[next.type];
          const [ls, le] = wrapOffsets(next.text, nm.cpl)[0];
          focusNow(next.id, Math.min(ls + Math.max(0, visualCol - nm.indent), le));
        }
        return;
      }

      default:
    }
  }, [acceptSuggestion, commit, focusNow, formatAt, onOpenNote, onRedo, onUndo, setTypeAt, toggleDual]);

  // Clicking empty paper focuses the nearest line instead of doing nothing.
  const onSheetMouseDown = (e) => {
    // Left button only: a right-click (or middle-click) is never cancelled or redirected here, so
    // the browser's own context menu — spelling suggestions, Add to dictionary — always opens.
    if (e.button !== 0) return;
    if (!e.target.classList.contains('page-card') && e.target !== sheetRef.current) return;
    e.preventDefault();
    let best = null;
    let bestDist = Infinity;
    for (const [id, el] of els.current) {
      const r = el.getBoundingClientRect();
      const d = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    if (best) focusNow(best, 'end');
  };

  const { place, pageCount } = layout;

  return (
    <div
      ref={sheetRef}
      className={`sheet${locked ? ' is-locked' : ''}`}
      data-locked={locked ? 'true' : 'false'}
      aria-readonly={locked}
      style={{
        '--in': `${linePxFor(zoom) * 6}px`,
        height: `calc(${pageCount} * (var(--in) * 11 + var(--gap)) - var(--gap))`,
      }}
      onMouseDown={onSheetMouseDown}
    >
      {Array.from({ length: pageCount }, (_, p) => (
        <div
          key={p}
          className="page-card"
          style={{ top: `calc(${p} * (var(--in) * 11 + var(--gap)))` }}
        >
          {p > 0 && <span className="page-no">{pageLabel(p)}</span>}
        </div>
      ))}

      {items.map((it, k) => {
        const pl = place[k] || { marginLines: 0, marginGaps: 0 };
        if (it.kind === 'dual') {
          return (
            <DualRow
              key={it.key}
              item={it}
              activeId={activeId}
              highlightId={highlightId}
              spotlight={spotlight}
              dense={dense}
              marginLines={pl.marginLines}
              marginGaps={pl.marginGaps}
              register={register}
              observe={observe}
              onText={handleText}
              onKey={handleKeyDown}
              onFocusBlock={handleFocus}
              openNoteId={openNoteId}
              onOpenNote={onOpenNote}
              locked={locked}
              findHits={findHits}
            />
          );
        }
        const b = it.block;
        // At a page seam an element comes in pieces (one per page); the first keeps the element's
        // key, so its textarea is never remounted while a seam opens or closes around it.
        const pieces = pl.pieces || [null];
        const split = pieces.length > 1;
        return pieces.map((pc, i) => (
          <Block
            key={i === 0 ? it.key : `${it.key}#${i}`}
            block={b}
            sceneNumber={i === 0 ? sceneNumbers[b.id] : undefined}
            isActive={b.id === activeId}
            isHighlighted={b.id === highlightId}
            isDim={!!spotlight && !spotlight.has(b.id)}
            isDense={!!dense && dense.has(b.id)}
            marginLines={pc ? pc.marginLines : pl.marginLines}
            marginGaps={pc ? pc.marginGaps : pl.marginGaps}
            register={register}
            observe={i === 0 ? observe : undefined}
            onText={handleText}
            onKey={handleKeyDown}
            onFocusBlock={handleFocus}
            noteOpen={b.id === openNoteId}
            onOpenNote={onOpenNote}
            locked={locked}
            piece={pc}
            split={split}
            partIndex={i}
            hits={findHits?.get(b.id) || null}
          />
        ));
      })}

      {suggestions.length > 0 && activeBlock && (
        <Suggestions
          anchorId={activeBlock.id}
          els={els}
          sheetRef={sheetRef}
          list={suggestions}
          index={acIndex}
          onPick={acceptSuggestion}
          onHover={(i) => setAcState({ sig, index: i })}
        />
      )}
    </div>
  );
}
