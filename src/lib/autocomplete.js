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
  for (const b of blocks) {
    if (b.type !== 'scene' || b.id === block.id) continue;
    const sp = sceneParts(b.text);
    if (!sp.prefix) continue;
    if (sp.location) bump(locations, sp.location);
    if (sp.time) bump(times, sp.time);
  }

  const out = [];
  const typed = rest.trim();

  for (const loc of rank(locations)) {
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

function characterSuggestions(block, blocks) {
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

  const counts = new Map();
  for (const b of blocks) {
    if (b.type !== 'character' || b.id === block.id) continue;
    const n = characterName(b.text);
    if (n) bump(counts, n);
  }
  const t = typed.trim();
  return rank(counts)
    .filter((n) => n.startsWith(t) && n !== t)
    .slice(0, LIMIT)
    .map((n) => ({ label: n, value: n, kind: 'Character' }));
}

export function getSuggestions(block, blocks) {
  if (!block) return [];
  if (block.type === 'scene') return sceneSuggestions(block, blocks);
  if (block.type === 'character') return characterSuggestions(block, blocks);
  return [];
}
