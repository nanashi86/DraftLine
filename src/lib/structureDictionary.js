// Story Glossary (formerly "Structure Dictionary"): the story terms the Story DNA questions
// and Plot Devices refer to — the eight structure terms, Text / Subtext / Context, and the
// plot devices (Foreshadowing, Flashback, Deus ex machina, MacGuffin, Quest, Cliffhanger,
// Red herring, Love triangle), and the Character Roles a bio's Primary Role and Secondary
// Function pick from (Protagonist … Shadow / Mirror), and the Screenplay Format terms (the page's
// elements, (MORE) / (CONT'D), V.O. / O.S., Intercut, Pre-lap, Page Eighths…). The Glossary lists them
// in three sections: Character Roles, Narrative & Dramatic Craft, Screenplay Format (GLOSSARY_SECTIONS).
//
// The wording below is DraftLine's STARTER text — short, conventional definitions. It is
// meant to be replaced by the writer's own reference (a class handout, a book): every
// entry can be edited in the app (Story Bible → DNA → Story Glossary), and edits are kept
// in the library's settings for all projects (the setting key is still
// 'structureDictionary', so earlier wording carries over). `starter: true` marks text that
// hasn't been replaced yet, so the UI can say so.

export const STRUCTURE_DICTIONARY = [
  {
    id: 'protagonist',
    term: 'Protagonist',
    definition: 'The primary driver of the story whose goals and moral choices dictate the plot.',
  },
  {
    id: 'incitingIncident',
    term: 'Inciting Incident',
    definition: 'The event that starts the story: it upsets the protagonist’s normal life and sets the main problem in motion. Without it, nothing that follows would happen.',
  },
  {
    id: 'goal',
    term: 'Goal / Desire',
    definition: 'What the protagonist wants and actively pursues. A clear goal gives the story direction and lets the audience measure progress and setbacks.',
  },
  {
    id: 'flaw',
    term: 'Flaw',
    definition: 'The inner weakness, fear or false belief the protagonist must overcome to get what they want. It is usually the deeper obstacle beneath the outer one.',
  },
  {
    id: 'conflict',
    term: 'Conflict / Obstacle',
    definition: 'The opposition that keeps the protagonist from the goal — why they can’t simply have it. Conflict is what makes a scene dramatic. Robert McKee describes three levels of it, and the six classic types of story analysis fall under them: Inner (against yourself), Personal (against the people closest to you) and the Wider World (against society, nature or anything bigger).',
    // Grouped by `level` (Inner · Personal · Wider World), the same groups as the Conflict picker
    // (CONFLICT_LEVELS in storyDna.js); the terms are the picker's stored values.
    items: [
      { level: 'Inner', term: 'Individual vs. Self', definition: 'Against their own doubts, fears, addictions or divided loyalties.' },
      { level: 'Personal', term: 'Individual vs. Individual', definition: 'Against another person — an antagonist, rival or loved one.' },
      { level: 'Wider World', term: 'Individual vs. Society', definition: 'Against laws, institutions, customs or the community.' },
      { level: 'Wider World', term: 'Individual vs. Nature', definition: 'Against the natural world — storm, sea, wilderness, disease.' },
      { level: 'Wider World', term: 'Individual vs. Technology', definition: 'Against machines, systems or science gone wrong.' },
      { level: 'Wider World', term: 'Individual vs. Supernatural', definition: 'Against forces beyond the natural — gods, ghosts, fate, the spirit world.' },
    ],
  },
  {
    id: 'risingAction',
    term: 'Complications',
    definition: 'What the protagonist does about the problem: a series of attempts, each met by a complication that raises the stakes, building from the inciting incident toward the crisis. Robert McKee calls these progressive complications; classic story analysis calls the stretch rising action. Each one should make things harder than the last, never simply repeat it.',
  },
  {
    id: 'climax',
    term: 'Climax',
    definition: 'The final confrontation and the story’s highest point of tension, where the protagonist makes the decisive choice or action that settles the central conflict, for better or worse. It comes after the crisis, and the theme is revealed here.',
  },
  {
    id: 'fallingAction',
    term: 'Resolution / Falling Action',
    definition: 'What follows the climax: consequences play out, loose ends are tied and we see what has changed. On screen it is short, often a few minutes, which is why screenwriters call it the resolution rather than a whole falling action.',
  },
  {
    id: 'textSubtext',
    term: 'Text / Subtext / Context',
    definition: 'Text is what is literally said or done. Subtext is what is really meant beneath it. Context is the situation that tells the audience how to read the gap between the two.',
    example: 'TEXT — "Can I get you a drink?"\nSUBTEXT — "Please don’t shoot me."\nCONTEXT — the man asking can’t take his eyes off the gun lying on the table between them.',
  },
  {
    id: 'foreshadowing',
    term: 'Foreshadowing',
    definition: 'A hint or setup planted early that pays off later — an image, line or object that prepares the audience for what is coming without giving it away.',
  },
  {
    id: 'flashback',
    term: 'Flashback',
    definition: 'A scene that steps back in time from the story’s present to show an earlier event that explains a character, a relationship or a mystery.',
  },
  {
    id: 'deusExMachina',
    term: 'Deus ex machina',
    definition: '“God from the machine”: a sudden, unforeshadowed rescue, a person, event or coincidence that solves the problem from outside the story’s logic. Something to avoid rather than plan: the protagonist’s own choices stop mattering, and audiences feel cheated. Used knowingly, it can be satire or irony.',
  },
  {
    id: 'macguffin',
    term: 'MacGuffin',
    definition: 'The object, secret or goal everyone is chasing — it drives the plot but matters less in itself than in what the pursuit reveals about the characters. The briefcase, the stolen plans, the letter.',
  },
  {
    id: 'quest',
    term: 'Quest',
    definition: 'A journey toward a clear goal through a series of trials, often with companions and a cost along the way. The outer road mirrors an inner change: the hero who arrives is not the one who set out.',
  },
  {
    id: 'cliffhanger',
    term: 'Cliffhanger',
    definition: 'An ending — of a scene, act or episode — at a moment of unresolved danger or revelation, so the audience has to know what happens next.',
  },
  {
    id: 'redHerring',
    term: 'Red herring',
    definition: 'A deliberate false clue that points the audience (and often the characters) the wrong way — a suspect, object or detail that looks important so the real answer lands as a surprise. Fair red herrings still make sense in hindsight.',
  },
  {
    id: 'loveTriangle',
    term: 'Love triangle',
    definition: 'Three characters bound by competing romantic loyalties — usually one person torn between two others — so every choice of the heart costs someone something.',
  },
  {
    id: 'crisis',
    term: 'All Is Lost / Crisis',
    definition: 'The low point where the protagonist’s plan fails and the goal looks impossible: the moment that shows why everything they tried was not enough. It forces the hardest choice of the story, which the climax then plays out. Save the Cat calls it All Is Lost.',
  },
  {
    id: 'tickingClock',
    term: 'Ticking Clock',
    definition: 'A deadline the audience knows about: the bomb, the wedding on Saturday, the last ferry at midnight. It turns every delay into tension and gives the story a natural end point.',
  },
  {
    id: 'wantNeed',
    term: 'Want vs. Need',
    definition: 'What the protagonist wants is the outer goal they chase; what they need is the inner change their flaw keeps them from. Strong stories pull the two apart, so getting the want means facing the need, or giving one up for the other.',
  },
  {
    id: 'midpoint',
    term: 'Midpoint',
    definition: 'The turn in the middle of the script, around page 55 of 110: a false victory, a false defeat or a revelation that raises the stakes and changes the protagonist’s approach, from reacting to acting.',
  },
  {
    id: 'stakes',
    term: 'Stakes',
    definition: 'What the protagonist stands to lose if they fail, and why the audience should care. Good stakes are personal as well as large, and they rise as the story goes on.',
  },
  {
    id: 'setupPayoff',
    term: 'Setup & Payoff',
    definition: 'Planting something early, an object, a skill, a line, so it can matter later. A setup with no payoff feels like a loose end; a payoff with no setup feels like a cheat. Chekhov’s gun is the classic example: if it’s on the wall in act one, it goes off by act three.',
  },
  {
    id: 'bStory',
    term: 'B-Story',
    definition: 'The second storyline running under the main plot, often a relationship, that carries the theme and helps the protagonist with their inner change. It usually starts once the main story is under way.',
  },
  // ---- Character Roles (Characters → Bios: Primary Role and Secondary Function) ----
  // Protagonist is the first entry above (it's also Story DNA's first question).
  {
    id: 'antagonist',
    term: 'Antagonist',
    definition: 'The primary obstacle or opposing force standing between the protagonist and their goal.',
  },
  {
    id: 'deuteragonist',
    term: 'Deuteragonist',
    definition: 'The second most important character, often acting as a principal partner, rival, or counterweight.',
  },
  {
    id: 'tritagonist',
    term: 'Tritagonist',
    definition: 'The third most significant character, often serving as a catalyst, instigator, or key moral witness.',
  },
  {
    id: 'supportingCharacter',
    term: 'Supporting',
    definition: 'A recurring character who serves the main characters’ stories — revealing, helping or complicating them — without driving the plot themselves.',
  },
  {
    id: 'minorCharacter',
    term: 'Minor / Cameo',
    definition: 'A brief appearance that fills a practical or atmospheric need in a scene; a cameo is often a recognizable face in a small part.',
  },
  {
    id: 'foil',
    term: 'Foil',
    definition: 'A character whose contrasting values, background, or choices highlight and challenge the protagonist’s traits.',
  },
  {
    id: 'catalyst',
    term: 'Catalyst',
    definition: 'A character whose action, death, or arrival triggers the central conflict or forces the protagonist out of the status quo. (In Save the Cat, “Catalyst” is also the name of the inciting event itself; here it means the person behind it.)',
  },
  {
    id: 'mentor',
    term: 'Mentor / Guide',
    definition: 'A figure providing wisdom, instruction, or ethical boundaries to the protagonist.',
  },
  {
    id: 'confidant',
    term: 'Confidant(e)',
    definition: 'A trusted ally who allows the protagonist’s inner thoughts and vulnerabilities to be vocalized.',
  },
  {
    id: 'loveInterest',
    term: 'Love Interest',
    definition: 'The person the protagonist is drawn to romantically; the relationship raises the personal stakes of the plot.',
  },
  {
    id: 'skeptic',
    term: 'Skeptic / Voice of Reason',
    definition: 'The character who doubts, questions or warns — voicing the audience’s objections and testing the protagonist’s resolve.',
  },
  {
    id: 'henchman',
    term: 'Henchman / Enforcer',
    definition: 'The antagonist’s instrument: the muscle or operative who carries out the opposition’s will in person.',
  },
  {
    id: 'thresholdGuardian',
    term: 'Threshold Guardian',
    definition: 'A gatekeeper who blocks the way at a crossing point and must be passed, persuaded or overcome before the story can move forward.',
  },
  {
    id: 'shadow',
    term: 'Shadow / Mirror',
    definition: 'A dark reflection of the protagonist showing the catastrophic outcome of their negative impulses.',
  },

  // ---- Screenplay Format: the page itself (elements, extensions, and the terms writers look up) ----
  {
    id: 'sceneHeading',
    term: 'Scene Heading (Slugline)',
    definition: 'The line that opens every scene, in capitals: INT. or EXT. (inside or outside), the location, then the time of day. A new heading means a new place or a new time.',
    example: 'INT. DINER - NIGHT\nEXT. HARBOR - CONTINUOUS\nINT./EXT. TAXI - MOVING - DAY',
  },
  {
    id: 'action',
    term: 'Action',
    definition: 'What the audience sees and hears, written in the present tense as it happens. Keep paragraphs to three or four lines, and introduce each character in CAPITALS the first time they appear, usually with an age and a quick impression.',
  },
  {
    id: 'characterCue',
    term: 'Character Cue',
    definition: 'The speaker’s name, in capitals, above their lines. Keep it the same all the way through (not MARIE in one scene and MRS. DUVAL in the next), so actors and readers always know who is talking.',
  },
  {
    id: 'dialogue',
    term: 'Dialogue',
    definition: 'What a character says, under their cue in a narrower column. Dialogue never appears without a cue above it; a sound or a line nobody speaks on screen belongs in Action.',
  },
  {
    id: 'parenthetical',
    term: 'Parenthetical (Wryly)',
    definition: 'A short note in parentheses under the cue or between lines: how a line is said (whispering), who it is said to (to Theo), or a small action. Use them sparingly; one never ends a speech or stands without dialogue after it.',
  },
  {
    id: 'extensions',
    term: 'V.O. / O.S. / O.C.',
    definition: 'Cue extensions. (V.O.), voice-over: the speaker is not in the scene, as with narration, a voice on the phone or a thought. (O.S.) or (O.C.), off-screen or off-camera: the speaker is in the scene but out of view, like someone calling from the next room.',
  },
  {
    id: 'contd',
    term: '(CONT’D)',
    definition: 'Two uses. Beside a cue, it marks a character speaking again after only Action interrupted them (many writers now leave this one off). At the top of a page, NAME (CONT’D) carries on a speech split by the page break; DraftLine adds that one for you.',
  },
  {
    id: 'more',
    term: '(MORE)',
    definition: 'Written under the last line of a speech that carries on over the page, paired with NAME (CONT’D) at the top of the next page. DraftLine adds both when a speech splits, and never splits one right after a parenthetical.',
  },
  {
    id: 'dualDialogue',
    term: 'Dual Dialogue',
    definition: 'Two characters talking at the same moment, printed side by side in two columns so the reader takes them in together. In DraftLine, Alt+D on the second speech puts it beside the first.',
  },
  {
    id: 'transition',
    term: 'Transition',
    definition: 'An editing instruction in capitals at the right margin: CUT TO:, DISSOLVE TO:, SMASH CUT TO:, FADE OUT. A new scene heading already implies a cut, so spec scripts use transitions only when the cut itself means something.',
  },
  {
    id: 'beat',
    term: 'Beat',
    definition: 'Two meanings. In a parenthetical, (beat) is a short pause inside a speech. In story talk, a beat is the smallest unit of change: a moment where something shifts between characters.',
  },
  {
    id: 'insert',
    term: 'Insert',
    definition: 'A close view of something the audience must read or see in detail, such as a letter, a phone screen or a clock. Written as INSERT - THE TEXT MESSAGE, followed by BACK TO SCENE when it ends.',
  },
  {
    id: 'intercut',
    term: 'Intercut',
    definition: 'Cutting back and forth between two places that make up one scene, most often a phone call. Set up both locations once, then write INTERCUT - MARIE / THEO instead of a new heading for every line.',
  },
  {
    id: 'montage',
    term: 'Montage / Series of Shots',
    definition: 'A run of short images that compresses time or shows a process: training, a city waking up, a romance in a minute. Written as MONTAGE (or SERIES OF SHOTS) with a short line for each image, then END MONTAGE.',
  },
  {
    id: 'pageMinute',
    term: 'One Page, One Minute',
    definition: 'The rule of thumb that a properly formatted page runs about a minute on screen, which is why the format is fixed: Courier 12 point and standard margins. A 110-page script suggests a film of a little under two hours.',
  },
  {
    id: 'eighths',
    term: 'Page Eighths',
    definition: 'How production measures a scene’s length: each page is divided into eighths, so a scene runs 3/8 or 1 2/8 pages. Schedules and stripboards add these up, and DraftLine shows them in Plan.',
  },
  {
    id: 'prelap',
    term: 'Pre-lap',
    definition: 'Sound from the next scene, usually a line of dialogue, heard before we cut to it. Written as a cue extension, MARIE (PRE-LAP), at the end of the scene before.',
  },
  {
    id: 'spec',
    term: 'Spec Script',
    definition: 'A script written on speculation, unpaid, to sell or to show your writing. Spec scripts leave out camera directions and usually scene numbers; a shooting script adds them once a film is in production. DraftLine’s PDF leaves scene numbers off unless you include them.',
  },
  {
    id: 'super',
    term: 'Super (Superimpose)',
    definition: 'Text laid over the picture: a place, a date, a caption. Written in Action as SUPER: "Port-au-Prince, 1986." At a page break DraftLine keeps a SUPER: line with what follows it.',
  },
];

/** Entries with the writer's own wording laid over the starter text. */
export function mergeDictionary(overrides = {}) {
  return STRUCTURE_DICTIONARY.map((e) => {
    const o = overrides?.[e.id];
    if (!o) return { ...e, starter: true };
    return {
      ...e,
      definition: typeof o.definition === 'string' ? o.definition : e.definition,
      example: typeof o.example === 'string' ? o.example : e.example,
      starter: false,
    };
  });
}

/** Search terms, definitions, examples and sub-items (case- and accent-insensitive). */
export function searchDictionary(entries, query) {
  const fold = (s) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = fold(query.trim());
  if (!q) return entries;
  return entries.filter((e) => [e.term, e.definition, e.example, ...(e.items || []).flatMap((i) => [i.term, i.definition])]
    .some((t) => fold(t).includes(q)));
}

export const dictionaryEntry = (entries, id) => entries.find((e) => e.id === id);

/**
 * The Glossary's two sections, in display order. Character Roles runs in story rank
 * (Protagonist → Minor / Cameo), then the secondary functions A–Z; Narrative &
 * Dramatic Craft is A–Z. Every entry belongs to exactly one section.
 */
export const GLOSSARY_SECTIONS = [
  {
    id: 'roles',
    label: 'Character Roles',
    ids: [
      'protagonist', 'antagonist', 'deuteragonist', 'tritagonist', 'supportingCharacter', 'minorCharacter',
      'catalyst', 'confidant', 'foil', 'henchman', 'loveInterest', 'mentor', 'shadow', 'skeptic', 'thresholdGuardian',
    ],
  },
  {
    id: 'craft',
    label: 'Narrative & Dramatic Craft',
    ids: [
      'crisis', 'bStory', 'cliffhanger', 'climax', 'risingAction', 'conflict', 'deusExMachina', 'flashback', 'flaw', 'foreshadowing',
      'goal', 'incitingIncident', 'loveTriangle', 'macguffin', 'midpoint', 'quest', 'redHerring', 'fallingAction',
      'setupPayoff', 'stakes', 'textSubtext', 'tickingClock', 'wantNeed',
    ],
  },
  {
    // The page's elements in the order they appear on it, then the other terms A–Z.
    id: 'format',
    label: 'Screenplay Format',
    ids: [
      'sceneHeading', 'action', 'characterCue', 'dialogue', 'parenthetical', 'extensions', 'contd', 'more', 'dualDialogue', 'transition',
      'beat', 'insert', 'intercut', 'montage', 'pageMinute', 'eighths', 'prelap', 'spec', 'super',
    ],
  },
];

/**
 * Format Doctor findings → the Screenplay Format term that explains them (the finding's chip in the
 * Format Doctor opens it). Findings with no matching term are left out.
 */
export const FORMAT_TERM_FOR_ISSUE = {
  slugline: 'sceneHeading',
  secondary: 'sceneHeading',
  slugformat: 'sceneHeading',
  slugincomplete: 'sceneHeading',
  'slugline-missing-time': 'sceneHeading',
  cue: 'characterCue',
  orphancue: 'characterCue',
  'duplicate-character-cue': 'characterCue',
  intro: 'action',
  indent: 'action',
  orphan: 'dialogue',
  falsedialogue: 'dialogue',
  orphanparen: 'parenthetical',
  'unclosed-parenthetical': 'parenthetical',
  unspaced: 'super',
};

/** The section an entry is listed under ('roles' | 'craft' | 'format'). */
export const sectionOf = (id) => GLOSSARY_SECTIONS.find((sec) => sec.ids.includes(id))?.id ?? 'craft';

/**
 * What the Glossary shows for a search: each section with its matching entries (in section
 * order) and its full size, so the heading can read "3 of 15". Sections with no match drop out.
 */
export function glossarySections(entries, query = '') {
  const shown = new Set(searchDictionary(entries, query).map((e) => e.id));
  return GLOSSARY_SECTIONS.map((sec) => {
    const all = sec.ids.map((id) => dictionaryEntry(entries, id)).filter(Boolean);
    return { id: sec.id, label: sec.label, total: all.length, entries: all.filter((e) => shown.has(e.id)) };
  }).filter((sec) => sec.entries.length);
}
