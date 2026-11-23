// Table Read: what's read aloud, in which voice (pure; components/TableRead.jsx speaks it).
//
// The script is read one element at a time, straight from the editor's blocks: nothing is parsed
// again and nothing is queued ahead, so a 120-page script costs no more than a scene. Each step is
// worked out from the blocks as they are at that moment, so editing while it reads never leaves it
// pointing at something stale.
//
//   Scene headings, Action  → the narrator (when "Read Action & Headings" is on)
//   Dialogue                → the speaking character's voice
//   Parentheticals          → the character's voice, when "Read Parentheticals" is on
//   Character cues          → never spoken (as at a real table read); (V.O.), (O.S.), (CONT'D) only
//                             tell whose line it is
//   Transitions, Format Cues, Centered (THE END), (MORE)/(CONT'D) → layout, never read

import { characterName } from './screenplay.js';

export const RATES = [1, 1.25, 1.5];
export const SCOPES = [
  { id: 'scene', label: 'Scene' },
  { id: 'act', label: 'Act' },
  { id: 'script', label: 'Script' },
];
export const NARRATOR = '__narrator__';
/** Longest piece handed to the speech engine at once (Chrome cuts long utterances off after ~15 s). */
export const CHUNK_CHARS = 200;

// ---- Text as it should be heard -----------------------------------------------------------

const HEADING_PREFIX = [
  [/^(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\s*\/\s*E\.?)\s+/i, 'Interior, exterior. '],
  [/^INT\.?\s+/i, 'Interior. '],
  [/^EXT\.?\s+/i, 'Exterior. '],
  [/^EST\.?\s+/i, 'Establishing. '],
];

/** Scene heading → words: "INT. FERRY - NIGHT" → "Interior. Ferry, night." */
export function headingSpeech(text) {
  let t = String(text || '').trim().replace(/^\./, '').replace(/#[^#]*#\s*$/, '').trim();
  let lead = '';
  for (const [re, words] of HEADING_PREFIX) {
    if (re.test(t)) {
      lead = words;
      t = t.replace(re, '');
      break;
    }
  }
  const body = t.split(/\s+[-–—]+\s+/).map((p) => sentenceCase(p.trim())).filter(Boolean).join(', ');
  return clean(`${lead}${body}${body ? '.' : ''}`);
}

const sentenceCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : s);

/** Plain words: no Fountain/markup symbols, no stage-layout extensions, tidy spacing. */
export function clean(text) {
  return String(text || '')
    .replace(/\((?:MORE|CONT['’]?D|CONTINUED)\)/gi, '')
    .replace(/\[\[[\s\S]*?\]\]/g, '') // Fountain notes
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/[*_~^#|<>]+/g, ' ')
    .replace(/\s*\.{3,}\s*/g, '… ')
    .replace(/\s*-{2,}\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?…])/g, '$1')
    .trim();
}

/** A parenthetical as heard: "(beat)" → "beat". */
export const parentheticalSpeech = (text) => clean(String(text || '').replace(/^\s*\(\s*|\s*\)\s*$/g, ''));

/**
 * Split long text into pieces of at most `max` characters: at sentence ends, then at commas or
 * semicolons, then between words. Short text comes back as one piece.
 */
export function chunkText(text, max = CHUNK_CHARS) {
  const t = String(text || '').trim();
  if (!t) return [];
  if (t.length <= max) return [t];
  const out = [];
  const push = (piece) => {
    const p = piece.trim();
    if (!p) return;
    if (p.length <= max) {
      out.push(p);
      return;
    }
    const byClause = p.split(/(?<=[,;:])\s+/);
    if (byClause.length > 1) {
      pack(byClause, max).forEach((c) => (c.length <= max ? out.push(c) : words(c)));
      return;
    }
    words(p);
  };
  const words = (p) => pack(p.split(/\s+/), max).forEach((c) => {
    if (c.length <= max) out.push(c);
    else for (let i = 0; i < c.length; i += max) out.push(c.slice(i, i + max)); // one enormous "word"
  });
  pack(t.split(/(?<=[.!?…])\s+/), max).forEach(push);
  return out;
}

function pack(parts, max) {
  const out = [];
  let cur = '';
  for (const part of parts) {
    if (!part) continue;
    if (cur && cur.length + 1 + part.length > max) {
      out.push(cur);
      cur = part;
    } else {
      cur = cur ? `${cur} ${part}` : part;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---- What's read, step by step --------------------------------------------------------------

/** The speaking character for the dialogue / parenthetical at `i` (its cue, normalized), or null. */
export function speakerAt(blocks, i) {
  for (let k = i - 1; k >= 0; k--) {
    const t = blocks[k].type;
    if (t === 'character') return characterName(blocks[k].text) || null;
    if (t !== 'dialogue' && t !== 'parenthetical') return null;
  }
  return null;
}

/**
 * What block `i` says aloud, or null when it isn't read with these options:
 * { blockId, index, kind: 'narration' | 'dialogue' | 'parenthetical', voiceKey, text }.
 * voiceKey: NARRATOR or the speaking character's name (as the Characters panel shows it).
 */
export function stepAt(blocks, i, { readAction = true, readParens = false } = {}) {
  const b = blocks[i];
  if (!b) return null;
  let kind = null;
  let text = '';
  let voiceKey = NARRATOR;
  if (b.type === 'scene' && readAction) {
    kind = 'narration';
    text = headingSpeech(b.text);
  } else if (b.type === 'action' && readAction) {
    kind = 'narration';
    text = clean(b.text);
  } else if (b.type === 'dialogue' || (b.type === 'parenthetical' && readParens)) {
    const who = speakerAt(blocks, i);
    kind = b.type;
    text = b.type === 'dialogue' ? clean(b.text) : parentheticalSpeech(b.text);
    if (who) voiceKey = who;
  }
  if (!kind || !/[\p{L}\p{N}]/u.test(text)) return null;
  return { blockId: b.id, index: i, kind, voiceKey, text };
}

/** The next readable step at or after `from` and before `to`, or null. */
export function nextStep(blocks, from, to, opts) {
  for (let i = Math.max(0, from); i < Math.min(to, blocks.length); i++) {
    const s = stepAt(blocks, i, opts);
    if (s) return s;
  }
  return null;
}

/** The last readable step before `before` and at or after `from`, or null. */
export function prevStep(blocks, before, from, opts) {
  for (let i = Math.min(before, blocks.length) - 1; i >= Math.max(0, from); i--) {
    const s = stepAt(blocks, i, opts);
    if (s) return s;
  }
  return null;
}

// ---- Ranges: Scene, Act, Script --------------------------------------------------------------

/** Id of the scene heading block `i` sits under (null before the first heading). */
export function sceneIdAt(blocks, i) {
  for (let k = Math.min(i, blocks.length - 1); k >= 0; k--) if (blocks[k].type === 'scene') return blocks[k].id;
  return null;
}

/**
 * The blocks a scope reads, as ids that survive edits: { startId, endId } where reading starts at
 * startId (null: the top of the script) and stops before endId (null: the end of the script).
 *   scene  — the scene the caret is in, from its heading (before the first heading: the opening)
 *   act    — the act run (lib/sceneActs.js actRunOf) of that scene; null when it has no act
 *   script — the whole script, or from the caret's element with `fromHere`
 * `actRun(sceneId)` → { ids } | null.
 */
export function scopeRange(blocks, { scope, anchorId, fromHere = false, actRun }) {
  const found = anchorId ? blocks.findIndex((b) => b.id === anchorId) : -1;
  const at = Math.max(0, found);
  const headingIds = blocks.filter((b) => b.type === 'scene').map((b) => b.id);
  // No target (the Title Page, nothing chosen yet) or a target that's gone: the first scene. Never a stale one.
  const sceneId = (found >= 0 && sceneIdAt(blocks, at)) || headingIds[0] || null;
  const after = (id) => headingIds[headingIds.indexOf(id) + 1] || null;
  if (scope === 'script') return { startId: fromHere && found >= 0 ? blocks[at].id : null, endId: null };
  if (scope === 'act') {
    const run = sceneId ? actRun?.(sceneId) : null;
    if (!run || !run.ids.length) return null;
    return { startId: run.ids[0], endId: after(run.ids[run.ids.length - 1]) };
  }
  if (!sceneId) return { startId: null, endId: headingIds[0] || null };
  return { startId: sceneId, endId: after(sceneId) };
}

/** A range's current block indices: [start, end). A start that's gone reads from the top. */
export function rangeIndices(blocks, range) {
  if (!range) return [0, 0];
  const s = range.startId ? blocks.findIndex((b) => b.id === range.startId) : 0;
  const e = range.endId ? blocks.findIndex((b) => b.id === range.endId) : blocks.length;
  const start = Math.max(0, s);
  return [start, e < 0 ? blocks.length : Math.max(start, e)];
}

// ---- Voices ----------------------------------------------------------------------------------

/** Voices best for this script's language, on-device ones first. */
export function usableVoices(voices, lang = 'en') {
  const base = String(lang || 'en').slice(0, 2).toLowerCase();
  const list = (voices || []).filter((v) => v && v.voiceURI);
  const same = list.filter((v) => String(v.lang || '').slice(0, 2).toLowerCase() === base);
  const pool = same.length ? same : list;
  return [...pool.filter((v) => v.localService), ...pool.filter((v) => !v.localService)];
}

const FEMALE = /\b(female|woman|zira|hazel|susan|samantha|karen|moira|tessa|fiona|victoria|aria|jenny|sonia|libby|catherine|heera|linda|ava|allison|serena|kate|veena|emma|olivia|michelle|eva|helena|laura|amelie|anna)\b/i;
const MALE = /\b(male|man|david|mark|george|daniel|alex|fred|rishi|guy|ryan|thomas|james|richard|tom|oliver|arthur|aaron|gordon|lee|sean|stefan|paul)\b/i;
/** A best guess at a voice's gender from its name; null when the name says nothing. */
export function voiceGender(v) {
  const n = String(v?.name || '');
  if (/\bfemale\b/i.test(n)) return 'Female';
  if (/\bmale\b/i.test(n)) return 'Male';
  if (FEMALE.test(n)) return 'Female';
  if (MALE.test(n)) return 'Male';
  return null;
}

/** A small pitch change for each reuse of a voice, so two characters sharing it still differ. */
export const REUSE_PITCH = [1, 0.92, 1.08, 0.86, 1.14]; // modest: still the same voice, clearly another person

/** Chrome's Google voices ("Google US English", "Google UK English Female"…): the best-sounding ones it offers. */
export const isGoogleVoice = (v) => /^google\b/i.test(String(v?.name || '')) || /^google\b/i.test(String(v?.voiceURI || ''));

/**
 * Give every speaker a voice.
 *
 *   speakers  — names, most lines first (analyzeScript().characterList order)
 *   voices    — SpeechSynthesisVoice-like { voiceURI, name, lang, localService, default }
 *   overrides — { [name | NARRATOR]: voiceURI } chosen by the writer (kept whenever that voice is here)
 *   genders   — { [name]: 'Male' | 'Female' | … } from Character Bios: a hint, never a rule
 *   online    — false when there's no connection (or an online voice just failed): only on-device
 *               voices are used then, for automatic voices and the writer's choices alike (the
 *               choices themselves are kept, and come back when online again)
 *
 * Automatic voices come from one pool: the Google voices when there are any (they sound best; they're
 * online voices, so the text goes to Google to be spoken), otherwise the on-device voices. Lower-quality
 * voices are never mixed in just to have more distinct ones: with more characters than voices in the
 * pool, voices are reused in the same order, each reuse at a slightly different pitch.
 *
 * Returns { [name | NARRATOR]: { voiceURI, pitch, auto } }; a key is missing when no voice is usable.
 * The narrator takes the pool's voice for the script's language (on-device: the system default); the
 * characters with the most lines get the other voices first, the narrator's voice last.
 */
export function assignVoices({ speakers = [], voices = [], overrides = {}, genders = {}, lang = 'en', online = true }) {
  const all = usableVoices(voices, lang).filter((v) => online || v.localService);
  const byUri = new Map(all.map((v) => [v.voiceURI, v]));
  const google = all.filter(isGoogleVoice);
  const pool = google.length ? google : all.filter((v) => v.localService);
  const out = {};
  const pick = (key) => (overrides[key] && byUri.has(overrides[key]) ? overrides[key] : null);
  const want = String(lang || '').toLowerCase();
  const exact = pool.find((v) => String(v.lang || '').toLowerCase() === want);
  const fallback = google.length ? exact || pool[0] : pool.find((v) => v.default) || exact || pool[0];

  const narr = pick(NARRATOR) || fallback?.voiceURI || null;
  if (narr) out[NARRATOR] = { voiceURI: narr, pitch: 1, auto: !pick(NARRATOR) };

  // Rotation for characters: the pool but the narrator's voice, then the narrator's voice last.
  const rotation = pool.filter((v) => v.voiceURI !== narr);
  if (narr && pool.some((v) => v.voiceURI === narr)) rotation.push(byUri.get(narr));
  const uses = new Map(narr ? [[narr, 1]] : []); // the narrator's voice is in use from the start
  const take = (uri) => {
    const n = uses.get(uri) || 0;
    uses.set(uri, n + 1);
    return REUSE_PITCH[n % REUSE_PITCH.length];
  };
  for (const name of speakers) {
    const chosen = pick(name);
    if (chosen) {
      out[name] = { voiceURI: chosen, pitch: take(chosen), auto: false };
      continue;
    }
    if (!rotation.length) continue;
    const least = Math.min(...rotation.map((v) => uses.get(v.voiceURI) || 0));
    const free = rotation.filter((v) => (uses.get(v.voiceURI) || 0) === least);
    const g = genders[name] === 'Male' || genders[name] === 'Female' ? genders[name] : null;
    const v = (g && free.find((x) => voiceGender(x) === g)) || free[0];
    out[name] = { voiceURI: v.voiceURI, pitch: take(v.voiceURI), auto: true };
  }
  return out;
}

/** A voice's label in the Voices list: "Microsoft Aria (en-US)". */
export const voiceLabel = (v) => `${String(v.name || v.voiceURI).replace(/\s*\(.*?\)\s*$/, '').replace(/\s+-\s+.*$/, '')}${v.lang ? ` (${v.lang})` : ''}`;
