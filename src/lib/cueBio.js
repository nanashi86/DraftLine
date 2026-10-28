// Character-cue bio card: hover (300 ms) or click a character cue in the script to see that
// character's bio from Characters → Bios. Only characters with a bio get a card.

import { characterName } from './screenplay.js';
import { normalizeCharacter, roleSummary } from './bible.js';

export const CUE_CARD_DELAY = 300; // ms of hovering before the card appears
export const CUE_CARD_GRACE = 160; // ms to move the pointer from the cue onto the card

/** The bio for a cue ("MARIE (V.O.)", "MARIE (CONT'D) ^", "@marie") — matched on the bare name. */
export function findBio(characters, cueText) {
  const name = characterName(cueText || '');
  if (!name) return null;
  return (characters || []).find((c) => characterName(c.name || '') === name) || null;
}

const clip = (text, n) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), n * 0.6)).replace(/[\s,;:.–—-]+$/, '')}…`;
};

/**
 * What the card shows, or null when the bio has nothing beyond a name (no card — no noise):
 * { id, name, meta ("Deuteragonist (Foil) · 45 · Male"), relationship, summary (traits), excerpt (backstory) }.
 */
export function bioCard(raw) {
  if (!raw) return null;
  const c = normalizeCharacter(raw); // older bios had one free-text `role`
  const meta = [roleSummary(c), c.age, c.gender].map((s) => String(s || '').trim()).filter(Boolean).join(' · ');
  const relationship = clip(c.relationship, 120);
  const summary = clip(c.traits, 140);
  const excerpt = clip(c.backstory, 180);
  if (!meta && !relationship && !summary && !excerpt) return null;
  return { id: c.id, name: String(c.name || '').trim(), meta, relationship, summary, excerpt };
}

/**
 * The card's show / hide behaviour as a small state machine, so it's testable without a browser.
 * state: { phase: 'idle' | 'pending' | 'open' | 'closing', cueId }
 *   enter (pointer onto a cue) → pending; timer (after CUE_CARD_DELAY) → open
 *   click on a cue → open at once
 *   leave (pointer off the cue, not onto the card) / leaveCard → closing; closeTimer → idle
 *   enterCard while closing → open again (you can reach its button)
 *   escape · typing · scroll · blur → idle
 */
export const CUE_CARD_IDLE = { phase: 'idle', cueId: null };

export function cueCardReducer(state, event) {
  switch (event.type) {
    case 'enter':
      if ((state.phase === 'open' || state.phase === 'closing') && state.cueId === event.cueId) return { phase: 'open', cueId: event.cueId };
      return { phase: 'pending', cueId: event.cueId };
    case 'timer':
      return state.phase === 'pending' && state.cueId === event.cueId ? { phase: 'open', cueId: event.cueId } : state;
    case 'click':
      return { phase: 'open', cueId: event.cueId };
    case 'leave':
      if (state.phase === 'pending') return CUE_CARD_IDLE;
      return state.phase === 'open' ? { ...state, phase: 'closing' } : state;
    case 'enterCard':
      return state.phase === 'closing' || state.phase === 'open' ? { ...state, phase: 'open' } : state;
    case 'leaveCard':
      return state.phase === 'open' ? { ...state, phase: 'closing' } : state;
    case 'closeTimer':
      return state.phase === 'closing' ? CUE_CARD_IDLE : state;
    case 'escape':
    case 'typing':
    case 'scroll':
    case 'blur':
      return CUE_CARD_IDLE;
    default:
      return state;
  }
}

export const cueCardVisible = (state) => state.phase === 'open' || state.phase === 'closing';

/** Where the card goes: just below the cue (above if there's no room), kept inside the view. */
export function placeCueCard(anchor, size, view, gap = 6, margin = 8) {
  const left = Math.max(view.left + margin, Math.min(anchor.left, view.right - margin - size.width));
  const below = anchor.bottom + gap;
  const fitsBelow = below + size.height <= view.bottom - margin;
  const top = fitsBelow ? below : Math.max(view.top + margin, anchor.top - gap - size.height);
  return { left: Math.round(left), top: Math.round(top), placement: fitsBelow ? 'below' : 'above' };
}
