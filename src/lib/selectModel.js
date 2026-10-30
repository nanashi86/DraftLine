// The list logic behind components/Select.jsx (DraftLine's own dropdown, used in place of the
// browser's <select>, whose open list is drawn by the operating system and can't be styled).
//
// Options come in as a list of items, each either an option or a group of options:
//   { value, label, hint?, style?, disabled?, checked?, muted? }
//   { group: 'Inner Conflict', options: [ …options ] }
// `checked` marks an option as on even when it isn't the value (Element ▾'s Dual Dialogue toggle);
// `muted` draws it (and the closed control, when it's the value) in the muted colour ("Choose…").

/** Every option in display order, with its index and the label of the group it sits in. */
export function flattenOptions(items = []) {
  const flat = [];
  for (const it of items) {
    if (it && Array.isArray(it.options)) {
      for (const o of it.options) flat.push({ ...o, group: it.group, index: flat.length });
    } else if (it) {
      flat.push({ ...it, group: null, index: flat.length });
    }
  }
  return flat;
}

/** The index of the option whose value is `value` (-1 if none). */
export const selectedIndex = (flat, value) => flat.findIndex((o) => o.value === value);

/** The next enabled option from `from` in direction `dir` (+1 / -1), stopping at the ends. */
export function stepIndex(flat, from, dir) {
  for (let i = from + dir; i >= 0 && i < flat.length; i += dir) if (!flat[i].disabled) return i;
  return from;
}

/** The first (dir +1) or last (dir -1) enabled option, or -1. */
export function edgeIndex(flat, dir) {
  const order = dir > 0 ? flat : [...flat].reverse();
  const hit = order.find((o) => !o.disabled);
  return hit ? hit.index : -1;
}

/** Where the list opens: on the selected option if there is one, else the first enabled one. */
export function openIndex(flat, value) {
  const i = selectedIndex(flat, value);
  return i >= 0 && !flat[i].disabled ? i : edgeIndex(flat, 1);
}

const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Type-to-jump: the next enabled option after `from` whose label starts with `query` (wrapping
 * around), case- and accent-insensitive. Typing one letter repeatedly cycles through the options
 * that start with it. Returns `from` when nothing matches.
 */
export function typeaheadIndex(flat, query, from) {
  const q = fold(query);
  if (!q || !flat.length) return from;
  const same = q.length > 1 && [...q].every((c) => c === q[0]);
  const needle = same ? q[0] : q;
  const start = q.length > 1 && !same ? Math.max(from, 0) : from + 1; // a longer query may stay put
  for (let k = 0; k < flat.length; k++) {
    const i = (((start + k) % flat.length) + flat.length) % flat.length;
    if (!flat[i].disabled && fold(flat[i].label).replace(/^[^\p{L}\p{N}]+/u, '').startsWith(needle)) return i;
  }
  return from;
}

/**
 * Where the open list goes: below the control if it fits, otherwise above (whichever side has more
 * room), never past the window. trigger — the control's rect; listHeight — the list's natural height.
 * Returns { left, top, minWidth, maxHeight, placement }.
 */
export function placeList(trigger, listHeight, view, { gap = 4, margin = 8, maxHeight = 360 } = {}) {
  const below = view.height - trigger.bottom - gap - margin;
  const above = trigger.top - gap - margin;
  const want = Math.min(listHeight, maxHeight);
  const down = want <= below || below >= above;
  const room = Math.max(120, Math.min(maxHeight, down ? below : above));
  const height = Math.min(want, room);
  const minWidth = trigger.right - trigger.left;
  const left = Math.max(margin, Math.min(trigger.left, view.width - margin - minWidth));
  return {
    left,
    top: down ? trigger.bottom + gap : trigger.top - gap - height,
    minWidth,
    maxHeight: room,
    placement: down ? 'below' : 'above',
  };
}
