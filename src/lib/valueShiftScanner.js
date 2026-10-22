// Scene Board → Analyze Value Shifts: a quick, deterministic read of how each scene's charge turns.
//
// For every scene it reads the Action, Dialogue and Parentheticals, then compares the opening
// quarter of the words with the closing quarter:
//   Opening tone: cooperation, resolution, calm (+) against threats, obstacles, tension (−).
//   Closing tone: the same, plus the outcome beats that end scenes badly — interruptions, weapons,
//                 violence, sudden departures, discoveries — which weigh double there.
// The two signs give one of the four values the Scene Board uses (lib/beats.js VALUE_SHIFTS):
//   '+-' conflict / setback · '-+' win / breakthrough · '++' static positive · '--' static negative
//
// It's a word-level heuristic, so it's a suggestion for the writer to accept or not, never applied
// on its own. `confidence: 'weak'` marks scenes with little to go on (short, or no charged words).

// Word stems: a word matches when it starts with one (so "threat" covers threatens, threatening).
// Stems ending in '$' must match the whole word ("hit$" isn't "history"). Camera words stay out:
// "WIDE SHOT" and "CLOSE ON" aren't violence or intimacy.
const POSITIVE = [
  'laugh', 'smil', 'grin', 'hug$', 'hugs$', 'hugg', 'kiss', 'embrac', 'thank', 'agree', 'help', 'together', 'safe', 'calm', 'peace',
  'relie', 'relax', 'win$', 'wins$', 'won$', 'victor', 'triumph', 'love', 'hope', 'celebrat', 'cheer', 'promis',
  'yes$', 'welcom', 'home', 'gentl', 'warm', 'free$', 'freedom', 'rescu', 'saved$', 'joy', 'nod', 'trust', 'forgiv',
  'heal', 'okay$', 'ok$', 'beautiful', 'glad', 'happy', 'happi', 'proud', 'friend', 'deal$',
  'toast', 'danc', 'sing$', 'sings$', 'singing', 'sang$', 'sunlight', 'sunrise', 'bright', 'reunit', 'yeah$', 'perfect', 'sweet',
  'protect', 'comfort', 'congratul', 'best$', 'better$', 'fine$', 'accept', 'hand in hand',
];
const NEGATIVE = [
  'threat', 'kill', 'dead$', 'death', 'die$', 'dies$', 'dying', 'blood', 'scream', 'fight', 'attack', 'hit$', 'hits$',
  'punch', 'slap', 'crash', 'storm', 'afraid', 'fear', 'panic', 'cry$', 'cries$', 'crying', 'sob$', 'sobs$', 'sobbing', 'hate', 'lie$', 'lies$',
  'lying', 'liar', 'betray', 'refus', 'angry', 'anger', 'rage', 'furious', 'yell', 'shout', 'trap', 'lost$', 'lose$',
  'loses$', 'losing', 'fail', 'alone', 'cold', 'dark', 'wound', 'hurt', 'pain', 'alarm', 'siren', 'danger', 'problem',
  'wrong', 'mistake', 'argu', 'accus', 'demand', 'warn', 'tense', 'tension', 'worr', 'nervous', 'desperat', 'trembl', 'shak',
  'glar', 'grip', 'clench', 'hostil', 'enemy', 'debt', 'owe$', 'owes$', 'owed$', 'broke', 'break$', 'breaks$', 'breaking', 'shatter', 'ruin', 'sick', 'bleed',
  'grief', 'griev', 'funeral', 'mourn', 'regret', 'guilt', 'shame', 'curse', 'damn', 'hell$', 'enough$', 'stop$',
  'leave me', 'get out', 'go away', 'too late', 'police', 'arrest', 'cop$', 'cops$', 'hunt', 'chase', 'run$', 'runs$', 'running',
];
// Outcome beats (weighed double in the closing quarter: these are what turn a scene at its end).
const OUTCOME = [
  // interruptions
  'bursts in', 'burst in', 'bursts through', 'barge', 'interrupt', 'suddenly', 'cut off', 'cuts off', 'without warning',
  // weapons
  'gun', 'pistol', 'rifle', 'revolver', 'shotgun', 'knife', 'blade', 'machete', 'weapon', 'bullet', 'trigger',
  // violence
  'shoot', 'gunshot', 'gunfire', 'stab', 'strangl', 'explod', 'explosion', 'murder', 'slaughter', 'beat him', 'beat her',
  // sudden departures
  'storms out', 'storms off', 'walks out', 'walks away', 'leaves$', 'drives off', 'drives away', 'gone$', 'vanish',
  'disappear', 'slams the door', 'door slams', 'flees', 'fled$', 'abandon',
  // discoveries
  'discover', 'realiz', 'reveal', 'finds out', 'the truth', 'it was you', 'body$', 'corpse',
];
// A negator just before a charged word flips it ("not safe", "never again"); on its own it's a refusal.
const NEGATORS = new Set(['not', 'no', 'never', "don't", 'dont', "can't", 'cant', "won't", 'wont', "didn't", 'didnt', 'nothing', 'nobody', "isn't", "wasn't", 'without']);
const NEGATOR_REACH = 2; // words after a negator that it flips
const STANDALONE_NEGATORS = new Set(['no', 'never', 'nothing', 'nobody']);

const READ_TYPES = new Set(['action', 'dialogue', 'parenthetical']);
const MIN_QUARTER = 6; // words: a short scene's "quarter" is at least this much (and at most half)

const compile = (stems) => stems.map((s) => {
  const whole = s.endsWith('$');
  const words = (whole ? s.slice(0, -1) : s).split(' ');
  return { words, whole };
});
const LEXICON = [
  ...compile(POSITIVE).map((e) => ({ ...e, charge: 1, kind: 'positive' })),
  ...compile(NEGATIVE).map((e) => ({ ...e, charge: -1, kind: 'negative' })),
  ...compile(OUTCOME).map((e) => ({ ...e, charge: -1, kind: 'outcome' })),
].sort((a, b) => b.words.length - a.words.length); // phrases before single words

/** "Don't — he's GONE." → ["don't", "he's", "gone"] */
export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^a-zà-ÿ0-9']+/i)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

function matchAt(tokens, i) {
  for (const e of LEXICON) {
    if (i + e.words.length > tokens.length) continue;
    let ok = true;
    for (let k = 0; k < e.words.length && ok; k++) {
      const t = tokens[i + k];
      const w = e.words[k];
      const last = k === e.words.length - 1;
      ok = last && !e.whole ? t.startsWith(w) : t === w;
    }
    if (ok) return e;
  }
  return null;
}

/**
 * The charge of a run of words: { score, cues: [{ word, charge }] }.
 *   closing: outcome beats count double (they're what an ending turns on).
 */
export function scoreTokens(tokens, { closing = false } = {}) {
  let score = 0;
  const cues = [];
  let flip = 0; // words left that a negator flips
  let pendingNegator = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (NEGATORS.has(t)) {
      if (pendingNegator && STANDALONE_NEGATORS.has(pendingNegator)) {
        score -= 1;
        cues.push({ word: pendingNegator, charge: -1 });
      }
      pendingNegator = t;
      flip = NEGATOR_REACH;
      continue;
    }
    const e = matchAt(tokens, i);
    if (e) {
      let charge = e.charge * (closing && e.kind === 'outcome' ? 2 : 1);
      const negated = flip > 0;
      if (negated) charge = e.kind === 'outcome' ? charge : -charge; // "not a gun" is still a gun
      score += charge;
      const phrase = tokens.slice(i, i + e.words.length).join(' ');
      cues.push({ word: negated ? `${pendingNegator} ${phrase}` : phrase, charge });
      pendingNegator = null;
      flip = 0;
      i += e.words.length - 1;
      continue;
    }
    if (flip > 0 && --flip === 0 && pendingNegator) {
      if (STANDALONE_NEGATORS.has(pendingNegator)) {
        score -= 1;
        cues.push({ word: pendingNegator, charge: -1 });
      }
      pendingNegator = null;
    }
  }
  if (pendingNegator && STANDALONE_NEGATORS.has(pendingNegator)) {
    score -= 1;
    cues.push({ word: pendingNegator, charge: -1 });
  }
  return { score, cues };
}

/** The opening and closing quarters of a scene's words (at least MIN_QUARTER each, never more than half). */
export function quarters(tokens) {
  const n = tokens.length;
  const size = Math.min(Math.ceil(n / 2), Math.max(MIN_QUARTER, Math.ceil(n * 0.25)));
  return { opening: tokens.slice(0, size), closing: tokens.slice(Math.max(0, n - size)) };
}

/**
 * One scene: its elements after the heading → { shift, open, close, openScore, closeScore,
 * confidence, cues: { open, close }, words }.
 *   A neutral opening reads as calm (+): the usual start, before anything disturbs it.
 *   A neutral ending keeps the opening's charge: nothing turned it.
 */
export function scanScene(elements) {
  const text = (elements || []).filter((b) => READ_TYPES.has(b.type)).map((b) => b.text || '').join(' \n ');
  const tokens = tokenize(text);
  const { opening, closing } = quarters(tokens);
  const o = scoreTokens(opening);
  const c = scoreTokens(closing, { closing: true });
  const open = o.score < 0 ? '-' : '+';
  const close = c.score < 0 ? '-' : c.score > 0 ? '+' : open;
  const confidence = tokens.length < MIN_QUARTER * 2 || (!o.cues.length && !c.cues.length) ? 'weak' : 'clear';
  return {
    shift: `${open}${close}`,
    open,
    close,
    openScore: o.score,
    closeScore: c.score,
    confidence,
    cues: { open: o.cues, close: c.cues },
    words: tokens.length,
  };
}

/**
 * Every scene in the script → [{ id, number, heading, ...scanScene() }], in script order.
 * `id` is the scene heading's element id — the `sceneId` a Scene Board card is linked by.
 */
export function scanValueShifts(blocks) {
  const out = [];
  let current = null;
  const flush = () => {
    if (current) out.push({ id: current.id, number: out.length + 1, heading: current.heading, ...scanScene(current.elements) });
  };
  for (const b of blocks || []) {
    if (b.type === 'scene' && String(b.text || '').trim()) {
      flush();
      current = { id: b.id, heading: String(b.text).trim(), elements: [] };
    } else if (current) {
      current.elements.push(b);
    }
  }
  flush();
  return out;
}

/** The cards a set of accepted suggestions changes: Map cardId → shift (cards already at that shift are left out). */
export function shiftsToApply(beats, suggestions, acceptedSceneIds) {
  const bySceneId = new Map(suggestions.map((s) => [s.id, s.shift]));
  const changes = new Map();
  for (const b of beats || []) {
    if (!b.sceneId || !acceptedSceneIds.has(b.sceneId) || !bySceneId.has(b.sceneId)) continue;
    const shift = bySceneId.get(b.sceneId);
    if (b.valueShift !== shift) changes.set(b.id, shift);
  }
  return changes;
}
