// One definition of "what counts as a scene heading", shared by the text importer,
// the Fountain reader, autocomplete and the Format Doctor.
//
// Accepts INT. / EXT. / EST. and every interior–exterior combination, with or without
// periods and with any slash spacing: INT./EXT., EXT./INT., INT/EXT., EXT/INT.,
// INT/EXT, EXT/INT, I/E., I/E, E/I — optionally preceded by a scene number.
//
// Every check looks at the plain text: formatting markup (<u>…</u>, _…_, **…** …) is ignored, so
// "<u>FLASHBACK</u> - CROIX-DES-BOSSALES - NIGHT" reads the same as the bare line.

import { stripInline } from './formatting.js';

const COMBO = String.raw`(?:INT|EXT)\.?\s*\/\s*(?:INT|EXT)\.?|I\s*\/\s*E\.?|E\s*\/\s*I\.?`;
const SINGLE = String.raw`INT\.?|EXT\.?|EST\.?`;
export const SLUGLINE_PREFIX = `(?:${COMBO}|${SINGLE})`;

/** Prefix followed by whitespace (for splitting "INT. KITCHEN - NIGHT" into parts). */
export const SLUGLINE_PREFIX_SPACE_RE = new RegExp(`^${SLUGLINE_PREFIX}\\s+`, 'i');

const SLUGLINE_RE = new RegExp(
  `^(?:\\d+[A-Z]?[.)]?\\s+)?${SLUGLINE_PREFIX}(?=[\\s.\\-–—:]|$)`,
  'i',
);

/** True for "INT. KITCHEN - NIGHT", "ext/int car", "12 I/E. TRUCK - DAY", ".FLASHBACK" … */
export function isSlugline(text) {
  const t = stripInline(text || '').trim();
  return SLUGLINE_RE.test(t) || (/^\.[A-Za-z0-9]/.test(t) && !t.startsWith('..'));
}

export const TIME_OF_DAY = [
  'DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'AFTERNOON', 'EVENING', 'SUNSET', 'SUNRISE',
  'CONTINUOUS', 'LATER', 'MOMENTS LATER', 'SAME TIME', 'MAGIC HOUR',
];
const TIME_RE = new RegExp(`\\s[-–—]\\s*(?:${TIME_OF_DAY.join('|')})\\s*$`, 'i');

/** "BACK ALLEY - NIGHT": a location with a time-of-day suffix but no INT./EXT. */
export function hasTimeOfDaySuffix(text) {
  return TIME_RE.test(stripInline(text || '').trim());
}

const isAllCaps = (t) => /\p{L}/u.test(t) && t === t.toUpperCase();

/**
 * Secondary (return) scene headings: BACK TO THE CINEUS RESIDENCE, LATER, MOMENTS LATER,
 * RESUME…, CONTINUOUS, SAME. All caps, one line, no shouted punctuation and not ending
 * in a colon (so "BACK TO:" can't pass for one).
 */
const SECONDARY_RE = /^(?:BACK TO|MOMENTS LATER|LATER|RESUME|CONTINUOUS|SAME)\b/;
export function isSecondarySlugline(text) {
  const t = stripInline(text || '').trim();
  return t.length <= 80 && !t.includes('\n') && isAllCaps(t) && SECONDARY_RE.test(t) && !/[!?,;:]$/.test(t);
}

/** An all-caps "LOCATION - NIGHT" line with no INT./EXT. (e.g. "FLASHBACK - CROIX-DES-BOSSALES - NIGHT"). */
export function isUnprefixedSlugline(text) {
  const t = stripInline(text || '').trim();
  return t.length <= 80 && !t.includes('\n') && isAllCaps(t) && hasTimeOfDaySuffix(t) && !isOnScreenText(t);
}

/** Anything the importer should treat as a scene heading. */
export function isSceneHeadingLine(text) {
  return isSlugline(text) || isSecondarySlugline(text) || isUnprefixedSlugline(text);
}

/** Act markers that shouldn't become script text: "ACT 1", "ACT ONE", "ACT 1[b]", "END OF ACT TWO". */
export function isActBreak(text) {
  const t = (text || '').trim();
  const m = t.match(/^(?:END\s+OF\s+)?ACT\s+(\d+|[IVX]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT)\b(.*)$/i);
  if (!m) return false;
  const rest = m[2].trim();
  return rest === ''
    || /^[[(][^\])]*[\])]$/.test(rest) // ACT 1[b], ACT 2 (cont.)
    || (t === t.toUpperCase() && /^[-–—:.]/.test(rest)); // ACT ONE: THE ARRIVAL
}

/** On-screen text directions (never a character cue): SUPER:, TITLE:, CARD:, INSERT: … */
export function isOnScreenText(text) {
  return /^(?:SUPER(?:IMPOSE)?|TITLE(?: CARD)?|CARD|INSERT|CHYRON|LEGEND|SUBTITLE|ON SCREEN|TEXT ON SCREEN)\s*:/i
    .test(stripInline(text || '').trim());
}

/**
 * Format cues — language, sequence and technical directions that sit flush left:
 *   IN CREOLE WITH ENGLISH SUBTITLES:   BEGIN FLASHBACK   END MONTAGE   SUPER: PARIS, 1942
 * BEGIN / END lines must be all caps (so "End of the line, she says." stays Action).
 */
export function isFormatCue(text) {
  const t = stripInline(text || '').trim();
  if (!t || t.includes('\n') || t.length > 80) return false;
  if (/^IN [A-Z][A-Z\s'’-]*? WITH (?:ENGLISH )?SUBTITLES[.:]?$/i.test(t)) return true;
  if (/^(?:BEGIN|END)\s+[A-Z][A-Z\s'’/-]*[.:]?$/.test(t) && !isActBreak(t)) return true;
  return isOnScreenText(t);
}

// ---- Character cues vs. character introductions ----------------------------------------
//
// "MARIE (V.O.)" is a cue; "FITO (10)--copper skin, bare feet" is Action introducing Fito.
// A cue is a short, all-caps name standing alone, optionally followed by standard
// extensions. It never holds an age or other numbers in parentheses, dashes or em-dashes,
// or sentence punctuation. Hyphenated names (JEAN-CLAUDE) are still cues.

const DASHES = /--|—|–|\s-\s|\s-$|^-/;

/** "(V.O.)", "(O.S.)", "(CONT'D)", "(INTO PHONE)" — but not "(10)", "(30s)" or "(late 40s)". */
export function isCueExtension(paren) {
  const inner = paren.replace(/^\(|\)$/g, '').trim();
  return !!inner && !/\d/.test(inner) && inner.split(/\s+/).length <= 4 && /^[\p{L}.,'’ /-]+$/u.test(inner);
}

/** The shape of a character cue (classification against sluglines etc. is the caller's job). */
export function isCueShaped(text) {
  let t = stripInline(text || '').trim();
  if (!t || t.includes('\n')) return false;
  if (t.startsWith('@')) return true; // Fountain's forced character
  t = t.replace(/\s*\^\s*$/, ''); // dual-dialogue caret
  if (DASHES.test(t)) return false;
  const parens = t.match(/\([^)]*\)/g) || [];
  if (!parens.every(isCueExtension)) return false;
  if (/[()]/.test(t.replace(/\([^)]*\)/g, ''))) return false; // unbalanced
  const name = t.replace(/\([^)]*\)/g, '').trim();
  if (!name || !/\p{L}/u.test(name) || name !== name.toUpperCase()) return false;
  if (/[,;:!?"“”]/.test(name)) return false;
  // A trailing period only after an honorific or initial: "DR.", "J.J."
  if (/\.$/.test(name) && !/(?:^|\s)(?:MR|MRS|MS|DR|ST|JR|SR|[A-Z](?:\.[A-Z])*)\.$/.test(name)) return false;
  return name.split(/\s+/).length <= 4;
}

/**
 * The line after a would-be cue reads as more description, not speech: it starts in lower
 * case ("FITO (10)" / "copper skin, bare feet…"). A line starting "--" is left as dialogue
 * (it's also how an interrupted speech resumes); Format Doctor flags it as False Dialogue.
 */
export function startsLikeProse(next) {
  const t = stripInline(next || '').trim();
  return /^\p{Ll}/u.test(t);
}

/** "THE END" (optionally after "FADE OUT." on the same line), on a line of its own. */
export const END_RE = /^(?:(FADE OUT\.?)\s+)?(THE END\.?)$/i;
export function isEndMarker(text) {
  return END_RE.test(stripInline(text || '').trim());
}
