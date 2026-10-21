import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CUE_CARD_DELAY, CUE_CARD_GRACE, CUE_CARD_IDLE, bioCard, cueCardReducer, cueCardVisible, findBio, placeCueCard,
} from '../lib/cueBio.js';
import './CueBioCard.css';

/**
 * A floating bio card for character cues in the script. Hover a cue (300 ms) or click it: if the
 * character has a bio in Characters → Bios, a card shows beside the cue with name, role · age,
 * traits and a backstory excerpt, and "Edit in Bios →". It never takes focus, so typing,
 * selecting and moving the caret work as usual; it closes when the pointer leaves, on Esc,
 * on typing and on scroll. It lives outside the page, so print and exports never see it.
 *
 * root — ref to the scrolling script pane (events are delegated from there).
 */
export default function CueBioCard({ root, characters, onEdit, disabled = false }) {
  const [state, dispatch] = useReducer(cueCardReducer, CUE_CARD_IDLE);
  const [pos, setPos] = useState(null);
  const cardRef = useRef(null);
  const timers = useRef({ open: 0, close: 0 });
  const charsRef = useRef(characters);
  useEffect(() => {
    charsRef.current = characters;
  }, [characters]);

  const cueEl = (id) => root.current?.querySelector(`.el-character .el-input[data-id="${CSS.escape(id)}"]`);
  const visible = !disabled && cueCardVisible(state);
  const cue = visible ? cueEl(state.cueId) : null;
  const cueText = cue ? cue.value : null;
  const card = useMemo(() => (cueText == null ? null : bioCard(findBio(characters, cueText))), [characters, cueText]);

  // Pointer, click, typing and scroll in the script pane.
  useEffect(() => {
    const el = root.current;
    if (!el || disabled) return undefined;
    const t = timers.current;
    const cueOf = (target) => target?.closest?.('.el-character')?.querySelector('.el-input') || null;
    const hasBio = (input) => !!bioCard(findBio(charsRef.current, input.value));
    const onOver = (e) => {
      const input = cueOf(e.target);
      if (!input || !hasBio(input)) return;
      clearTimeout(t.close);
      const id = input.dataset.id;
      dispatch({ type: 'enter', cueId: id });
      clearTimeout(t.open);
      t.open = setTimeout(() => dispatch({ type: 'timer', cueId: id }), CUE_CARD_DELAY);
    };
    const onOut = (e) => {
      const from = e.target?.closest?.('.el-character');
      if (!from || from.contains(e.relatedTarget) || cardRef.current?.contains(e.relatedTarget)) return;
      clearTimeout(t.open);
      dispatch({ type: 'leave' });
      clearTimeout(t.close);
      t.close = setTimeout(() => dispatch({ type: 'closeTimer' }), CUE_CARD_GRACE);
    };
    const onClick = (e) => {
      const input = cueOf(e.target);
      if (input && hasBio(input)) dispatch({ type: 'click', cueId: input.dataset.id });
    };
    const onInput = () => dispatch({ type: 'typing' });
    const onScroll = () => dispatch({ type: 'scroll' });
    el.addEventListener('mouseover', onOver);
    el.addEventListener('mouseout', onOut);
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(t.open);
      clearTimeout(t.close);
      el.removeEventListener('mouseover', onOver);
      el.removeEventListener('mouseout', onOut);
      el.removeEventListener('click', onClick);
      el.removeEventListener('input', onInput);
      el.removeEventListener('scroll', onScroll);
    };
  }, [root, disabled]);

  // Esc closes it (before anything else handles Esc); so does the window losing focus.
  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: 'escape' });
      }
    };
    const onBlur = () => dispatch({ type: 'blur' });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [visible]);

  // Place it beside the cue's words, inside the script pane.
  useLayoutEffect(() => {
    if (!cue || !card || !cardRef.current) return;
    const r = cue.getBoundingClientRect();
    const words = Math.min(r.width, cue.value.length * parseFloat(getComputedStyle(cue).fontSize) * 0.6 + 4);
    const v = root.current.getBoundingClientRect();
    const next = placeCueCard(
      { left: r.left, right: r.left + words, top: r.top, bottom: r.bottom },
      { width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight },
      { left: v.left, right: v.right, top: v.top, bottom: v.bottom },
    );
    setPos((p) => (p && p.left === next.left && p.top === next.top ? p : next));
  }, [cue, card, root]);

  if (!card) return null;
  return createPortal(
    <div
      ref={cardRef}
      className={`cue-card is-${pos?.placement || 'measuring'}`}
      role="dialog"
      aria-label={`${card.name} — character bio`}
      data-cue={state.cueId}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
      onMouseEnter={() => {
        clearTimeout(timers.current.close);
        dispatch({ type: 'enterCard' });
      }}
      onMouseLeave={() => {
        dispatch({ type: 'leaveCard' });
        clearTimeout(timers.current.close);
        timers.current.close = setTimeout(() => dispatch({ type: 'closeTimer' }), CUE_CARD_GRACE);
      }}
      onMouseDown={(e) => e.preventDefault()} // never pull focus (or the caret) out of the script
    >
      <div className="cue-card-name">{card.name}</div>
      {card.meta && <div className="cue-card-meta">{card.meta}</div>}
      {card.relationship && <div className="cue-card-meta cue-card-rel">{card.relationship}</div>}
      {card.summary && <p className="cue-card-summary">{card.summary}</p>}
      {card.excerpt && <p className="cue-card-excerpt">{card.excerpt}</p>}
      <button
        type="button"
        className="cue-card-edit"
        onClick={() => {
          dispatch({ type: 'escape' });
          onEdit(card.id);
        }}
      >
        Edit in Bios →
      </button>
    </div>,
    document.body,
  );
}
