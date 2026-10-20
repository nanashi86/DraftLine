// Story Glossary (formerly "Structure Dictionary"): the story terms the Story DNA questions
// and Plot Devices refer to — the eight structure terms, Text / Subtext / Context, and the
// plot devices (Foreshadowing, Flashback, Deus ex machina, MacGuffin, Quest, Cliffhanger,
// Red herring, Love triangle).
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
    definition: 'The main character — the person the story is about. The audience follows their want, their choices and the change (or refusal to change) the story forces on them.',
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
    term: 'Conflict / Debate',
    definition: 'The opposition that keeps the protagonist from the goal — why they can’t simply have it. Conflict is what makes a scene dramatic; it comes in six classic types:',
    items: [
      { term: 'Individual vs. Individual', definition: 'Against another person — an antagonist, rival or loved one.' },
      { term: 'Individual vs. Nature', definition: 'Against the natural world — storm, sea, wilderness, disease.' },
      { term: 'Individual vs. Society', definition: 'Against laws, institutions, customs or the community.' },
      { term: 'Individual vs. Technology', definition: 'Against machines, systems or science gone wrong.' },
      { term: 'Individual vs. Supernatural', definition: 'Against forces beyond the natural — gods, ghosts, fate, the spirit world.' },
      { term: 'Individual vs. Self', definition: 'Against their own doubts, fears, addictions or divided loyalties.' },
    ],
  },
  {
    id: 'risingAction',
    term: 'Rising Action',
    definition: 'What the protagonist does about the problem: the series of attempts, complications and rising stakes that builds from the inciting incident toward the climax.',
  },
  {
    id: 'climax',
    term: 'Climax',
    definition: 'The decisive confrontation and highest point of tension, where the central conflict comes to a head — and where it becomes clear why the earlier efforts were not enough. The theme is revealed here.',
  },
  {
    id: 'fallingAction',
    term: 'Falling Action',
    definition: 'What follows the climax: consequences play out, loose ends are tied and the story settles into its ending — how it ends, and what has changed.',
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
    definition: '“God from the machine”: a sudden, unforeshadowed rescue — a person, event or coincidence that solves the problem from outside the story’s logic. Usually a flaw, because the protagonist’s own choices stop mattering; used knowingly, it can be satire or irony.',
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
