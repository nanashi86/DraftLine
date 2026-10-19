import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AutoTextarea from './AutoTextarea.jsx';
import { placeNote } from '../lib/notePlacement.js';
import { measureTextarea } from '../lib/measure.js';
import { backspaceAt, deleteAt } from '../lib/editing.js';
import {
  ELEMENT_META,
  ENTER_NEXT,
  SHIFT_TAB_NEXT,
  TAB_NEXT,
  isBlank,
  lineIndexOf,
  makeBlock,
  pageLabel,
  toggleDualAt,
  wrapOffsets,
} from '../lib/screenplay.js';
import { elementForCode } from '../lib/shortcuts.js';
import { getSuggestions } from '../lib/autocomplete.js';
import FormattedText from './FormattedText.jsx';
import {
  STYLES, activeStyles, clearMarks, hasMarks, sliceMarks, targetRange, toggleStyle, withMarks,
} from '../lib/formatting.js';
import './Editor.css';

/** Types where a blank block + Enter falls back to Action (Fade In-style escape hatch). */
const ENTER_ESCAPES_TO_ACTION = new Set(['character', 'dialogue', 'parenthetical', 'transition', 'format_cue', 'centered']);
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

function linePxFor(zoom) {
  return Math.max(6, Math.round(16 * zoom));
}

function marginStyle(lines, gaps) {
  if (!lines && !gaps) return undefined;
  return { marginTop: `calc(var(--line) * ${lines} + var(--gap) * ${gaps})` };
}

// ---------------------------------------------------------------------------

/**
 * Margin note: a compact NOTE chip in the page's right margin. Clicking it (or Alt+N) opens
 * the note editor *outside the script text*: in the gutter beside the page when there's
 * room, otherwise just above or below the element — never on top of the line it belongs to
 * (see lib/notePlacement.js). The editor floats in a portal, so it never changes an
 * element's height: notes add nothing to line counts or pagination, and never print.
 */
function NoteFlag({ block, open, onToggle, onChange, onClose }) {
  const text = block.note ?? '';
  const preview = text.trim() ? text.trim().split('\n')[0] : 'Empty note';
  const flagRef = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Place the popover, and keep it placed while the page scrolls or the window resizes.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const flag = flagRef.current;
      const pop = popRef.current;
      const el = flag?.closest('.el');
      const sheet = flag?.closest('.sheet');
      if (!el || !sheet || !pop) return;
      const s = sheet.getBoundingClientRect();
      const page = { left: s.left, right: s.left + s.width, top: s.top, bottom: s.bottom };
      const sc = sheet.closest('.scroller')?.getBoundingClientRect();
      const view = {
        left: Math.max(0, sc?.left ?? 0),
        right: Math.min(window.innerWidth, sc?.right ?? window.innerWidth),
        top: Math.max(0, sc?.top ?? 0),
        bottom: Math.min(window.innerHeight, sc?.bottom ?? window.innerHeight),
      };
      const next = placeNote({
        anchor: el.getBoundingClientRect(), page, view, size: { width: pop.offsetWidth, height: pop.offsetHeight },
      });
      setPos((p) => (p && p.x === next.x && p.y === next.y && p.placement === next.placement ? p : next));
    };
    place();
    const scroller = flagRef.current?.closest('.scroller');
    scroller?.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    const ro = new ResizeObserver(place);
    if (popRef.current) ro.observe(popRef.current);
    const anchorEl = flagRef.current?.closest('.el');
    if (anchorEl) ro.observe(anchorEl); // the line grows or shrinks as you type
    return () => {
      scroller?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
      ro.disconnect();
    };
  }, [open]);

  return (
    <>
      <button
        ref={flagRef}
        type="button"
        className={`note-flag${open ? ' is-open' : ''}`}
        title={`Note: ${preview}  ·  Alt+N`}
        aria-label={`Script note: ${preview}`}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggle(block.id)}
      >
        Note
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          className={`note-pop is-${pos?.placement || 'measuring'}`}
          role="dialog"
          aria-label="Script note"
          style={pos ? { left: pos.x, top: pos.y } : { left: -9999, top: 0 }}
        >
          <header>
            <span>Note</span>
            <button
              type="button"
              className="note-del"
              onClick={() => onChange(block.id, null)}
              title="Delete note"
            >
              Delete
            </button>
          </header>
          <textarea
            autoFocus
            value={text}
            placeholder="Write a note… it stays in the margin and never prints."
            onChange={(e) => onChange(block.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.altKey && e.code === 'KeyN')) {
                e.preventDefault();
                e.stopPropagation();
                onClose(block.id, true);
              }
              e.stopPropagation(); // keep editor/global shortcuts out of the note
            }}
          />
          <footer>Esc to close · never prints · exports as [[ ]] / ScriptNote</footer>
        </div>,
        document.body,
      )}
    </>
  );
}

const Block = memo(function Block({
  block, sceneNumber, isActive, isHighlighted, marginLines, marginGaps,
  register, observe, onText, onKey, onFocusBlock,
  noteOpen, onNoteToggle, onNoteChange, onNoteClose,
}) {
  const setRef = useCallback((el) => register(block.id, el), [register, block.id]);
  const meta = ELEMENT_META[block.type];
  return (
    <div
      ref={observe}
      data-key={observe ? block.id : undefined}
      className={`el el-${block.type}${isActive ? ' is-active' : ''}${isHighlighted ? ' is-highlighted' : ''}${block.note != null ? ' has-note' : ''}${hasMarks(block.marks) ? ' has-fmt' : ''}`}
      style={observe ? marginStyle(marginLines, marginGaps) : undefined}
    >
      {sceneNumber != null && (
        <>
          <span className="scene-no scene-no-left" aria-hidden="true">{sceneNumber}</span>
          <span className="scene-no scene-no-right" aria-hidden="true">{sceneNumber}</span>
        </>
      )}
      {hasMarks(block.marks) && (
        // A textarea can't style part of its text, so a formatted element shows an exact,
        // styled copy of its text laid over the (then transparent) textarea, which keeps
        // the caret, selection and typing. Courier is monospaced in every weight and slant,
        // so both wrap identically.
        <FormattedText className="el-text el-fmt" aria-hidden="true" text={block.text} marks={block.marks} />
      )}
      <AutoTextarea
        ref={setRef}
        className="el-input"
        value={block.text}
        measureKey={block.type}
        snapToLines
        spellCheck
        placeholder={isActive ? meta.label : ''}
        aria-label={meta.label}
        data-id={block.id}
        onChange={(e) => onText(block.id, e.target.value)}
        onKeyDown={(e) => onKey(e, block.id)}
        onFocus={() => onFocusBlock(block.id)}
      />
      {(block.note != null || noteOpen) && onNoteToggle && (
        <NoteFlag block={block} open={noteOpen} onToggle={onNoteToggle} onChange={onNoteChange} onClose={onNoteClose} />
      )}
    </div>
  );
});

const DualRow = memo(function DualRow({
  item, activeId, highlightId, marginLines, marginGaps, register, observe, onText, onKey, onFocusBlock,
  openNoteId, onNoteToggle, onNoteChange, onNoteClose,
}) {
  const col = (bs) => bs.map((b) => (
    <Block
      key={b.id}
      block={b}
      isActive={b.id === activeId}
      isHighlighted={b.id === highlightId}
      register={register}
      onText={onText}
      onKey={onKey}
      onFocusBlock={onFocusBlock}
      noteOpen={b.id === openNoteId}
      onNoteToggle={onNoteToggle}
      onNoteChange={onNoteChange}
      onNoteClose={onNoteClose}
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

export default function Editor({
  ref,
  blocks,
  items,
  layout,
  sceneNumbers,
  activeId,
  highlightId,
  zoom,
  hidden = false,
  onCommit,
  onTextChange,
  onNoteChange,
  onUndo,
  onRedo,
  onActiveChange,
  onMeasure,
  onNotice,
  onFormatState,
}) {
  const blocksRef = useRef(blocks);
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
  const [openNoteId, setOpenNoteId] = useState(null);
  const lastSel = useRef(null); // { id, start, end } of the last selection inside the script
  const lastFmt = useRef('');
  const onFormatStateRef = useRef(onFormatState);

  // ---- Autocomplete ----
  const activeBlock = useMemo(() => blocks.find((b) => b.id === activeId) || null, [blocks, activeId]);
  const suggestions = useMemo(() => {
    if (!activeBlock) return [];
    if (typedIn !== activeBlock.id && activeBlock.text !== '') return [];
    if (dismissed === `${activeBlock.id}:${activeBlock.text}`) return [];
    return getSuggestions(activeBlock, blocks);
  }, [activeBlock, blocks, typedIn, dismissed]);
  const sig = suggestions.map((s) => s.value).join('|');
  const acIndex = acState.sig === sig ? Math.min(acState.index, suggestions.length - 1) : 0;

  useLayoutEffect(() => {
    blocksRef.current = blocks;
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
    };
    // Capture phase: Chrome fires selectionchange at the textarea itself.
    document.addEventListener('selectionchange', onSel, true);
    return () => document.removeEventListener('selectionchange', onSel, true);
  }, [syncFormat]);

  useLayoutEffect(() => syncFormat());

  // Textareas edited while hidden (e.g. via the Tuner in Board view) measure on return.
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

  const register = useCallback((id, el) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);

  const focusNow = useCallback((id, caret) => {
    const el = els.current.get(id);
    if (!el) return;
    el.focus();
    const c = caret === 'end' ? el.value.length : Math.max(0, Math.min(caret, el.value.length));
    el.setSelectionRange(c, c);
  }, []);

  const commit = useCallback((next, focus) => {
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
    focusBlock(id) {
      const el = els.current.get(id);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    },
  }), [setTypeAt, toggleDual, formatAt, onNotice]);

  const handleText = useCallback((id, text) => {
    setTypedIn(id);
    onTextChange(id, text);
  }, [onTextChange]);

  const handleFocus = useCallback((id) => {
    setTypedIn((t) => (t === id ? t : null));
    setOpenNoteId((n) => (n === id ? n : null)); // moving to another line closes an open note
    onActiveChange(id);
  }, [onActiveChange]);

  // ---- Margin notes ----
  const closeNote = useCallback((id, refocus) => {
    setOpenNoteId(null);
    const b = blocksRef.current.find((x) => x.id === id);
    if (b && b.note != null && !b.note.trim()) onNoteChange(id, null); // drop empty notes
    if (refocus) focusNow(id, 'end');
  }, [focusNow, onNoteChange]);

  const toggleNote = useCallback((id) => {
    setOpenNoteId((cur) => {
      if (cur === id) {
        const b = blocksRef.current.find((x) => x.id === id);
        if (b && b.note != null && !b.note.trim()) onNoteChange(id, null);
        return null;
      }
      return id;
    });
  }, [onNoteChange]);

  const changeNote = useCallback((id, note) => {
    onNoteChange(id, note);
    if (note === null) setOpenNoteId(null);
  }, [onNoteChange]);

  const handleKeyDown = useCallback((e, id) => {
    const cur = blocksRef.current;
    const idx = cur.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const b = cur[idx];
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    const { text } = b;
    const mod = e.ctrlKey || e.metaKey;

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
        acceptSuggestion(ac.list[ac.index], e.key === 'Enter');
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
    // Alt+N: add a margin note — or move the selected text into one.
    if (e.altKey && !mod && e.code === 'KeyN') {
      e.preventDefault();
      const selected = text.slice(start, end).trim();
      if (selected) {
        const rest = (text.slice(0, start).replace(/[ \t]+$/, '') + ' ' + text.slice(end).replace(/^[ \t]+/, '')).trim();
        const note = [b.note, selected].filter((n) => n && n.trim()).join('\n');
        commit(splice(cur, idx, 1, { ...b, text: rest, note })); // focus goes to the note popover
        onNotice?.('Selection moved to a margin note');
      } else if (b.note == null) {
        commit(splice(cur, idx, 1, { ...b, note: '' }));
      }
      setOpenNoteId(id);
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

        if (isBlank(text) && ENTER_ESCAPES_TO_ACTION.has(b.type)) {
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
        const nb = tailBlock(ENTER_NEXT[b.type], b, after);
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
  }, [acceptSuggestion, commit, focusNow, formatAt, onNotice, onRedo, onUndo, setTypeAt, toggleDual]);

  // Clicking empty paper focuses the nearest line instead of doing nothing.
  const onSheetMouseDown = (e) => {
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
      className="sheet"
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
              marginLines={pl.marginLines}
              marginGaps={pl.marginGaps}
              register={register}
              observe={observe}
              onText={handleText}
              onKey={handleKeyDown}
              onFocusBlock={handleFocus}
              openNoteId={openNoteId}
              onNoteToggle={toggleNote}
              onNoteChange={changeNote}
              onNoteClose={closeNote}
            />
          );
        }
        const b = it.block;
        return (
          <Block
            key={it.key}
            block={b}
            sceneNumber={sceneNumbers[b.id]}
            isActive={b.id === activeId}
            isHighlighted={b.id === highlightId}
            marginLines={pl.marginLines}
            marginGaps={pl.marginGaps}
            register={register}
            observe={observe}
            onText={handleText}
            onKey={handleKeyDown}
            onFocusBlock={handleFocus}
            noteOpen={b.id === openNoteId}
            onNoteToggle={toggleNote}
            onNoteChange={changeNote}
            onNoteClose={closeNote}
          />
        );
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
