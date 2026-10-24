// Screenplay-aware autocomplete for Scene Headings and Character cues.
// Every suggestion is { label, value, kind } where `value` is the block's full new text.

import { characterName } from './screenplay.js';
import { SLUGLINE_PREFIX_SPACE_RE } from './sluglines.js';

// Offered as suggestions. I/E. is deliberately not offered (it duplicates INT./EXT.),
// but PREFIX_RE below still recognises it when typed by hand.
const PREFIXES = ['INT. ', 'EXT. ', 'INT./EXT. '];
const DEFAULT_TIMES = [
  'DAY', 'NIGHT', 'MORNING', 'AFTERNOON', 'EVENING', 'DAWN', 'DUSK',
  'CONTINUOUS', 'LATER', 'MOMENTS LATER', 'SAME TIME',
];
const EXTENSIONS = ['V.O.', 'O.S.', 'O.C.', "CONT'D"];
// Every INT./EXT. spelling the importer accepts (INT/EXT, EXT/INT., I/E …).
const PREFIX_RE = SLUGLINE_PREFIX_SPACE_RE;
const LIMIT = 8;

export function sceneParts(text) {
  const up = text.toUpperCase();
  const m = up.match(PREFIX_RE);
  if (!m) return { prefix: null, rest: up };
  const rest = up.slice(m[0].length);
  const dash = rest.lastIndexOf(' - ');
  return {
    prefix: m[0],
    rest,
    location: (dash >= 0 ? rest.slice(0, dash) : rest).trim(),
    time: dash >= 0 ? rest.slice(dash + 3).trim() : null,
  };
}

function rank(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
}

function bump(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

/**
 * Most-used first; equal counts go to the one used most recently before the line you're on
 * (`last`: key → index of its latest use above it, -1 if only below), then A–Z.
 */
function rankRecent(counts, last) {
  return [...counts.keys()].sort((a, b) => (counts.get(b) - counts.get(a))
    || ((last.get(b) ?? -1) - (last.get(a) ?? -1))
    || a.localeCompare(b));
}

function sceneSuggestions(block, blocks) {
  const up = block.text.toUpperCase();
  const { prefix, rest } = sceneParts(block.text);

  if (!prefix) {
    const t = up.trimStart();
    return PREFIXES
      .filter((p) => p.startsWith(t) && p !== up)
      .map((p) => ({ label: p.trim(), value: p, kind: 'Prefix' }));
  }

  const locations = new Map();
  const times = new Map();
  const lastLoc = new Map();
  const at = blocks.findIndex((b) => b.id === block.id);
  blocks.forEach((b, i) => {
    if (b.type !== 'scene' || b.id === block.id) return;
    const sp = sceneParts(b.text);
    if (!sp.prefix) return;
    if (sp.location) {
      bump(locations, sp.location);
      if (at < 0 || i < at) lastLoc.set(sp.location, i);
    }
    if (sp.time) bump(times, sp.time);
  });

  const out = [];
  const typed = rest.trim();

  for (const loc of rankRecent(locations, lastLoc)) {
    if (loc.startsWith(typed) && loc !== typed) {
      out.push({ label: loc, value: `${prefix}${loc} - `, kind: 'Location' });
    }
  }

  const dash = rest.lastIndexOf(' - ');
  if (dash >= 0 && rest.slice(0, dash).trim()) {
    const base = rest.slice(0, dash).trimEnd();
    const timeTyped = rest.slice(dash + 3).trim();
    const allTimes = [...rank(times), ...DEFAULT_TIMES.filter((t) => !times.has(t))];
    for (const t of allTimes) {
      if (t.startsWith(timeTyped) && t !== timeTyped) {
        out.push({ label: t, value: `${prefix}${base} - ${t}`, kind: 'Time' });
      }
    }
  }
  return out.slice(0, LIMIT);
}

function characterSuggestions(block, blocks, cast = []) {
  const typed = block.text.toUpperCase().trimStart();
  if (!typed) return [];

  const ext = typed.match(/^(.*?)\s*\(([^)]*)$/);
  if (ext) {
    const [, name, part] = ext;
    if (!name.trim()) return [];
    return EXTENSIONS
      .filter((e) => e.startsWith(part) && e !== part)
      .map((e) => ({ label: `(${e})`, value: `${name.trim()} (${e})`, kind: 'Extension' }));
  }
  if (typed.includes('(')) return [];

  // Who speaks in this scene first (most lines first), then the rest of the script by how often
  // they speak and how recently, then Story Bible characters who haven't spoken yet.
  const at = blocks.findIndex((b) => b.id === block.id);
  let from = 0;
  let to = blocks.length;
  if (at >= 0) {
    for (let i = at; i >= 0; i--) if (blocks[i].type === 'scene') { from = i; break; }
    for (let i = at + 1; i < blocks.length; i++) if (blocks[i].type === 'scene') { to = i; break; }
  }
  const counts = new Map();
  const inScene = new Map();
  const last = new Map();
  blocks.forEach((b, i) => {
    if (b.type !== 'character' || b.id === block.id) return;
    const n = characterName(b.text);
    if (!n) return;
    bump(counts, n);
    if (i >= from && i < to) bump(inScene, n);
    if (at < 0 || i < at) last.set(n, i);
  });
  const t = typed.trim();
  const script = [...counts.keys()].sort((a, b) => ((inScene.get(b) || 0) - (inScene.get(a) || 0))
    || (counts.get(b) - counts.get(a))
    || ((last.get(b) ?? -1) - (last.get(a) ?? -1))
    || a.localeCompare(b));
  const bible = [...new Set(cast.map((n) => characterName(String(n || ''))).filter((n) => n && !counts.has(n)))].sort();
  return [...script.map((n) => [n, 'Character']), ...bible.map((n) => [n, 'Story Bible'])]
    .filter(([n]) => n.startsWith(t) && n !== t)
    .slice(0, LIMIT)
    .map(([n, kind]) => ({ label: n, value: n, kind }));
}

/**
 * Tab in a Scene Heading (no suggestion list open):
 *   'INT. HOUSE'          → { text: 'INT. HOUSE - ' }   on to the time of day (its suggestions open)
 *   'INT. HOUSE - NIGHT'  → { advance: true }           done: a new Action line below
 *   'BACK TO THE HOUSE'   → { advance: true }           a secondary heading is complete as typed
 *   'INT. '               → { stay: true }              nothing to complete yet
 *   ''                    → { convert: 'action' }       an empty line changes type, as before
 */
export function sceneTab(text) {
  if (!text.trim()) return { convert: 'action' };
  const sp = sceneParts(text);
  if (!sp.prefix) return { advance: true };
  if (!sp.location) return { stay: true };
  if (sp.time === null) {
    const base = text.replace(/\s+$/, '').replace(/\s*-$/, '');
    return { text: `${base} - ` };
  }
  return sp.time ? { advance: true } : { stay: true };
}

/** Tab on a named Character cue cycles its extension: none → (O.S.) → (V.O.) → (CONT'D) → none. */
export const EXTENSION_CYCLE = ['O.S.', 'V.O.', "CONT'D"];

export function cycleExtension(text) {
  const dual = /\s*\^\s*$/.test(text) ? ' ^' : '';
  const core = text.replace(/\s*\^\s*$/, '').replace(/\s+$/, '');
  if (!core) return text;
  const m = core.match(/^(.*?)\s*\(([^()]*)\)$/);
  const ext = m ? m[2].trim().toUpperCase().replace('’', "'") : null;
  const i = ext ? EXTENSION_CYCLE.indexOf(ext) : -1;
  if (i < 0) return `${core} (${EXTENSION_CYCLE[0]})${dual}`; // none yet, or another note like (ON PHONE): add the first
  const name = m[1].replace(/\s+$/, '');
  return i === EXTENSION_CYCLE.length - 1 ? `${name}${dual}` : `${name} (${EXTENSION_CYCLE[i + 1]})${dual}`;
}

/**
 * Does accepting a suggestion with `key` move on? A character name, with Enter or Tab, goes
 * straight to its Dialogue line; a scene heading stays put (Tab just completes it).
 */
export const acceptAdvances = (block, key) => key === 'Enter' || (key === 'Tab' && block?.type === 'character');

/** Suggestions for the line being typed. `cast`: Story Bible character names, offered too. */
export function getSuggestions(block, blocks, { cast = [] } = {}) {
  if (!block) return [];
  if (block.type === 'scene') return sceneSuggestions(block, blocks);
  if (block.type === 'character') return characterSuggestions(block, blocks, cast);
  return [];
}
