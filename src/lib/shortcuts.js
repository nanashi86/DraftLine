// Every keyboard shortcut, in the groups the Keyboard Shortcuts dialog (Ctrl+/) shows.
// One list, so the dialog, the README and the tests can't drift from each other.
// Combos use "Ctrl" / "Alt" / "Shift"; the dialog shows ⌘ / ⌥ / ⇧ on a Mac.

import { ELEMENT_META, ELEMENT_TYPES } from './screenplay.js';
import { STYLES, STYLE_INFO } from './formatting.js';

/**
 * Element bindings: Alt+1 Scene Heading, Alt+2 Format Cue, Alt+3 Action, Alt+4 Character,
 * Alt+5 Parenthetical, Alt+6 Dialogue, Alt+7 Transition, Alt+8 Centered — ELEMENT_TYPES order.
 * The editor, the toolbar dropdown and the shortcuts dialog all read this one list.
 */
export const ELEMENT_SHORTCUTS = ELEMENT_TYPES.map((type, i) => ({
  type,
  label: ELEMENT_META[type].label,
  combo: `Alt+${i + 1}`,
  code: `Digit${i + 1}`,
}));

/** The element type bound to a KeyboardEvent.code ("Digit3" → 'action'), or null. */
export function elementForCode(code) {
  return ELEMENT_SHORTCUTS.find((s) => s.code === code)?.type ?? null;
}

/** "Alt+3" for 'action'. */
export const elementCombo = (type) => ELEMENT_SHORTCUTS.find((s) => s.type === type)?.combo ?? '';

/** Dual dialogue: an action on the current speech (not an element type), on Alt+D. */
export const DUAL_SHORTCUT = { action: 'dual', label: 'Dual Dialogue', combo: 'Alt+D', code: 'KeyD' };

/**
 * The toolbar's Element dropdown, top to bottom: the eight element types with Dual Dialogue
 * right after Dialogue. The Ctrl+/ dialog lists the Elements group in the same order.
 */
export const ELEMENT_MENU = ELEMENT_SHORTCUTS.flatMap((s) => (s.type === 'dialogue' ? [s, DUAL_SHORTCUT] : [s]));

export const SHORTCUT_SECTIONS = [
  {
    title: 'Elements',
    rows: [
      ...ELEMENT_MENU.map((s) => [s.combo, s.label]),
      ['Enter', 'Next element (Scene → Action, Character → Dialogue …)'],
      ['Tab', 'Change type / start a Character cue or Parenthetical'],
      ['Shift+Tab', 'Change type backwards'],
      ['Shift+Enter', 'Line break inside Action or Dialogue'],
    ],
  },
  {
    title: 'Formatting',
    rows: [
      ...STYLES.map((k) => [STYLE_INFO[k].keys, STYLE_INFO[k].label]),
      ['Ctrl+\\', 'Clear formatting'],
    ],
    note: 'Applies to the selection, or to the word at the cursor when nothing is selected.',
  },
  {
    title: 'Script',
    rows: [
      ['Alt+N', 'Margin note for this line (quotes any selected words) — opens the Notes drawer'],
      ['Ctrl+Z', 'Undo'],
      ['Ctrl+Shift+Z', 'Redo'],
      ['Ctrl+Alt+N', 'New script'],
      ['Ctrl+O', 'Open a .fountain, .fdx, .txt or .draftline file'],
      ['Ctrl+S', 'Save now (it also autosaves)'],
      ['Ctrl+P', 'Export Script (PDF)'],
      ['Ctrl+Alt+L', 'Lock / unlock the script — View Only: read, select and copy, no changes'],
    ],
  },
  {
    title: 'Workspace',
    rows: [
      ['Alt+P', 'Projects drawer (switch scripts)'],
      ['Alt+I', 'Story Bible (DNA · Notes)'],
      ['Alt+C', 'Characters (Bios · Dialogue)'],
      ['Alt+S', 'Scenes sidebar'],
      ['Alt+T', 'Characters → Dialogue (every line, one character at a time)'],
      ['Alt+Down', 'Next speech by the filtered character (also ] outside the text)'],
      ['Alt+Up', 'Previous speech by the filtered character (also [ outside the text)'],
      ['Alt+B', 'Cycle Page → Split → Board'],
      ['Ctrl+/', 'Keyboard shortcuts (this list)'],
      ['F1', 'User Guide (also Shift+? outside the script)'],
    ],
  },
];

/** Flat { combo → description } lookup. */
export const SHORTCUTS = Object.fromEntries(SHORTCUT_SECTIONS.flatMap((s) => s.rows));

/** "Ctrl+Shift+X" → ['Ctrl', 'Shift', 'X'] (or ['⌘', '⇧', 'X'] on a Mac). "Ctrl+\" keeps its backslash. */
export function keycaps(combo, mac = false) {
  return combo.split('+').map((k) => (mac ? { Ctrl: '⌘', Alt: '⌥', Shift: '⇧' }[k] || k : k));
}
