// Characters → Bios → Populate Bio: a character's age, gender and first physical description, read from the
// line that introduces them in the Action, the way scripts do it:
//
//   …landing squarely in front of MARJORIE (30s)--warm-dark skin, in a blue and white server's outfit.
//   → age "30s" · description "warm-dark skin, in a blue and white server's outfit"
//   NEWS REPORTER (40s)--fills the frame. She's a striking woman…   → age "40s" · gender "Female"
//
// Deterministic and non-destructive: a field is filled only while it's blank, so running it again
// changes nothing, and anything you typed is never touched. Pure functions, unit-tested.

import { addCharacter } from './bible.js';
import { stripInline } from './formatting.js';

/** Longest description taken from an introduction (characters); longer ones end at a comma. */
export const INTRO_DESCRIPTION_MAX = 100;

// What can sit in the parentheses: 30s · 40 · 10 · early 30s · late 20s · mid-40s · 50-something ·
// mid 40s · 30ish · teens · late teens. Never (V.O.), (O.S.), (CONT'D) or other words.
const AGE = String.raw`(?:(?:early|mid|late)[\s-]?)?(?:\d{1,3}\s?'?s?(?:\s?-\s?something|ish)?|teens)`;
// An introduction: a name in capitals (one or more words), then the age in parentheses.
const NAME = String.raw`\p{Lu}[\p{Lu}\p{N}'’.\-]*(?:\s+\p{Lu}[\p{Lu}\p{N}'’.\-]*)*`;
const INTRO = new RegExp(String.raw`(?<![\p{L}\p{N}'’])(${NAME})\s*\((${AGE})\)`, 'gu');
/** Where the next introduction starts (to end a description before it). */
const INTRO_START = new RegExp(String.raw`(?<![\p{L}\p{N}'’])${NAME}\s*\(${AGE}\)`, 'u');

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const key = (name) => clean(String(name || '')).toUpperCase();

// A comma phrase starting with one of these ends the description: a clause about what they do.
const CLAUSE_WORDS = new Set(['who', 'whose', 'which', 'that', 'while', 'when', 'as', 'and', 'but', 'then', 'before', 'after', 'until', 'where']);

/**
 * The text right after an introduction's ")" → its first descriptive clause. A description follows
 * "--", an em / en dash, a comma or a colon; with none ("MARIE (30s) drags a suitcase") there isn't
 * one. It ends at "--", an em / en dash, ";", the end of a sentence, or the next introduction; a
 * later comma phrase that starts with a present-tense verb ("…, drags a suitcase") or a clause word
 * ("…, who freezes") ends it too, so it stays a description. At most INTRO_DESCRIPTION_MAX
 * characters, cut back to the last comma (or word) if longer. Leading / trailing punctuation trimmed.
 */
export function introDescription(after) {
  const raw = String(after || '');
  if (!/^\s*(?:--|[—–,:])/.test(raw)) return '';
  let t = raw.replace(/^[\s,:;.\-–—]+/, '');
  const next = t.search(INTRO_START);
  if (next >= 0) t = t.slice(0, next);
  const stop = t.search(/--|[—–]|;|[.!?](?=\s|$)/);
  if (stop >= 0) t = t.slice(0, stop);
  const parts = t.split(',');
  // The first phrase is action, not appearance, when it's a verb and its object: "fills the frame",
  // "stares at the door", "drags a suitcase". ("freckles across her nose", "jeans and a hoodie" stay.)
  if (/^[a-z]{3,}s\s+(?:the|a|an|his|her|their|its|at|into|through|up|down|out|over|past|off)\b/.test(parts[0].trim()) && !/^\S+ss\s/.test(parts[0].trim())) return '';
  const kept = [parts[0]];
  for (const p of parts.slice(1)) {
    const first = p.trim().split(/\s+/)[0] || '';
    // "drags", "jogs", "leans" — a verb taking over from the description. ("carrying", "in", "her" stay.)
    if (/^[a-z]{3,}s$/.test(first) && !/ss$/.test(first)) break;
    if (CLAUSE_WORDS.has(first.toLowerCase())) break;
    kept.push(p);
  }
  t = clean(kept.join(','));
  if (t.length > INTRO_DESCRIPTION_MAX) {
    const cut = t.slice(0, INTRO_DESCRIPTION_MAX);
    const comma = cut.lastIndexOf(',');
    t = comma > 20 ? cut.slice(0, comma) : cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : INTRO_DESCRIPTION_MAX);
  }
  return t.replace(/^[\s,:;.\-–—"“”']+|[\s,:;\-–—"“”']+$/g, '');
}

// ---- Gender from the introduction ----------------------------------------------------------

const FEMALE = /\b(?:she|her|hers|woman|girl|female|actress|waitress|sister|mother|daughter)\b/i;
const MALE = /\b(?:he|him|his|man|boy|male|actor|waiter|brother|father|son)\b/i;
const SENTENCE_END = /[.!?](?=\s|$)/g;

/**
 * The words that can tell an introduction's gender: from the name to the end of the sentence after
 * the introduction ("NEWS REPORTER (40s)--fills the frame. She's a striking woman…"), stopping
 * before another character's introduction.
 */
export function introWindow(text, start, end) {
  let stop = text.length;
  const next = text.slice(end).search(INTRO_START);
  if (next >= 0) stop = end + next;
  SENTENCE_END.lastIndex = end;
  let found = 0;
  for (let m = SENTENCE_END.exec(text); m && m.index < stop; m = SENTENCE_END.exec(text)) {
    found += 1;
    if (found === 2) {
      stop = m.index + 1;
      break;
    }
  }
  return text.slice(start, stop);
}

/**
 * "Female" or "Male" when the introduction's words point one way only (she / her / woman / mother…,
 * he / his / man / brother…); '' when there's nothing, or both (conflicting signals are left to you).
 * They / them / their alone never set a gender: in Action they're far more often plural.
 */
export function introGender(windowText) {
  const t = String(windowText || '');
  const f = FEMALE.test(t);
  const m = MALE.test(t);
  if (f === m) return '';
  return f ? 'Female' : 'Male';
}

/**
 * Every character introduction in the script's Action, first one per name, in script order:
 * [{ name: "MARJORIE", age: "30s", gender: "", description: "warm-dark skin, …", blockId }].
 */
export function findIntroductions(blocks) {
  const seen = new Set();
  const out = [];
  for (const b of blocks || []) {
    if (b.type !== 'action' || !b.text) continue;
    const text = stripInline(b.text);
    for (const m of text.matchAll(INTRO)) {
      const name = clean(m[1]).replace(/^[.\-'’]+|[.\-'’]+$/g, '');
      if (!name || (name.match(/\p{L}/gu) || []).length < 2 || seen.has(key(name))) continue;
      seen.add(key(name));
      const end = m.index + m[0].length;
      out.push({
        name, age: clean(m[2]), gender: introGender(introWindow(text, m.index, end)), description: introDescription(text.slice(end)), blockId: b.id,
      });
    }
  }
  return out;
}

/**
 * Does an introduction's name refer to this character? The same name, or the name as its first or
 * last word(s): "CAPTAIN AUGUSTIN" is AUGUSTIN, "TONY CINEUS" is TONY.
 */
export function introMatches(introName, name) {
  const a = key(introName);
  const b = key(name).replace(/\s*\(.*$/, '');
  if (!a || !b) return false;
  return a === b || a.endsWith(` ${b}`) || a.startsWith(`${b} `);
}

const blank = (v) => !String(v ?? '').trim();

/**
 * Populate Bio: fill blank Age / Timeline, Gender and Physical Description fields from the introductions.
 *   characters — the bios; speakers — names that speak in the script (cue names)
 * A speaking character introduced in the Action who has no bio yet gets one. Fields that already
 * hold something (text, or a Gender you picked) are never changed, so running it twice gives the
 * same result.
 * Returns { list, filled: [{ name, fields: ['age', 'gender', 'description'] }], created: [names] };
 * `list` is the same array when nothing changed.
 */
export function populateBiosFromIntros(characters, blocks, speakers = []) {
  const intros = findIntroductions(blocks);
  const introFor = (name) => intros.find((it) => introMatches(it.name, name)) || null;
  let list = characters || [];
  const filled = [];
  const created = [];

  list = list.map((c) => {
    const it = introFor(c.name);
    if (!it) return c;
    const patch = {};
    if (blank(c.age) && it.age) patch.age = it.age;
    if (blank(c.gender) && it.gender) patch.gender = it.gender;
    if (blank(c.description) && it.description) patch.description = it.description;
    const fields = Object.keys(patch);
    if (!fields.length) return c;
    filled.push({ name: c.name, fields });
    return { ...c, ...patch };
  });

  // New bios in the order the script introduces them.
  const have = new Set(list.map((c) => key(c.name)));
  const order = (name) => intros.findIndex((it) => introMatches(it.name, name));
  const newcomers = speakers.filter((n) => n && !have.has(key(n)) && order(n) >= 0).sort((a, b) => order(a) - order(b));
  for (const name of newcomers) {
    if (have.has(key(name))) continue;
    const it = introFor(name);
    if (!it.age && !it.gender && !it.description) continue;
    const fields = {
      name, ...(it.age ? { age: it.age } : {}), ...(it.gender ? { gender: it.gender } : {}), ...(it.description ? { description: it.description } : {}),
    };
    list = addCharacter(list, fields).list;
    have.add(key(name));
    created.push(name);
    filled.push({ name, fields: Object.keys(fields).filter((k) => k !== 'name') });
  }

  return { list: filled.length ? list : characters, filled, created };
}

const bios = (n) => `${n} ${n === 1 ? 'bio' : 'bios'}`;
const FIELD_WORDS = { age: 'age', gender: 'gender', description: 'description' };
/** ['age', 'gender', 'description'] → "age, gender and description". */
const listWords = (keys) => {
  const w = ['age', 'gender', 'description'].filter((k) => keys.has(k)).map((k) => FIELD_WORDS[k]);
  return w.length < 2 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
};
/**
 * The line Populate Bio reports, with what it filled: "Added 3 bios (age, gender and description)",
 * "Filled 2 bios (gender)", "Filled 2 bios and added 1 (age and description)", or
 * "No new ages, genders or descriptions found in the script".
 */
export function populateSummary({ filled, created }) {
  if (!filled.length) return 'No new ages, genders or descriptions found in the script';
  const updated = filled.length - created.length;
  const what = !created.length ? `Filled ${bios(updated)}`
    : !updated ? `Added ${bios(created.length)}`
      : `Filled ${bios(updated)} and added ${created.length}`;
  const kinds = listWords(new Set(filled.flatMap((f) => f.fields || [])));
  return kinds ? `${what} (${kinds})` : what;
}
