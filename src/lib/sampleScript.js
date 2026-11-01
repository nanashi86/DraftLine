// The Last Ferry: the sample script (File ▾ → Sample…, or the sample hint on a first visit). A
// short two-hander that shows the editor at work: dual dialogue, a V.O., parentheticals, a transition.
// It comes with a Story Bible (logline, tone, synopsis), Scene Board cards (lib/beats.js
// sampleBeats) and one earlier draft in Snapshots to compare against.
// [type, text, extra?] tuples — converted to blocks with ids at load time.

export const SAMPLE_SCRIPT = {
  meta: {
    title: 'The Last Ferry',
    credit: 'Written by',
    author: '', // empty on purpose: Chili Palmer shows faintly as the placeholder, and nothing is ever remembered
    basedOn: '',
    draftVersion: 'First Draft',
    draftDate: '',
    contact: '',
    titleFont: 'courier-prime',
    titleSize: 32,
    titleBold: true,
  },
  blocks: [
    ['transition', 'FADE IN:'],
    ['scene', 'EXT. HARBOR - DAWN'],
    ['action', 'Mist over black water. A rusted ferry, the SAINTE-ROSE, idles against the pier. Gulls argue over nothing.'],
    ['action', 'MARIE (30s), coat buttoned to the throat, drags a suitcase with one bad wheel down the planks.'],
    ['action', 'Behind her, THEO (20s), her brother, jogs to catch up — barefoot, shoes in hand.'],
    ['character', 'THEO'],
    ['dialogue', "You said six. It's not even five-thirty."],
    ['character', 'MARIE'],
    ['dialogue', "I said be here by six. I didn't say I'd wait."],
    ['character', 'THEO'],
    ['parenthetical', '(catching his breath)'],
    ['dialogue', "That's the same thing."],
    ['character', 'MARIE'],
    ['dialogue', 'It has never once been the same thing.'],
    ['action', 'A HORN BLASTS from the ferry. CAPTAIN AUGUSTIN (60s), weathered as the hull, leans over the rail.'],
    ['character', 'AUGUSTIN'],
    ['dialogue', "Last crossing before the storm. Tickets or goodbyes — pick one, I don't have time for both."],

    ['scene', 'INT. FERRY - PASSENGER DECK - CONTINUOUS'],
    ['action', 'Rows of bolted benches. A radio crackles weather warnings in two languages. Marie takes the window. Theo drops beside her, too close.'],
    ['character', 'THEO'],
    ['dialogue', "You didn't tell Manman you were leaving."],
    ['character', 'MARIE'],
    ['parenthetical', '(not looking at him)'],
    ['dialogue', 'I left a letter.'],
    ['character', 'THEO'],
    ['dialogue', "She can't read your handwriting. Nobody can."],
    ['character', 'MARIE'],
    ['dialogue', "Then you'll read it to her."],
    ['action', 'Theo opens his mouth. Closes it. Outside, the pier slides away.'],
    ['character', 'AUGUSTIN (V.O.)'],
    ['parenthetical', '(over loudspeaker)'],
    ['dialogue', "Life vests are under the seats. If you need one, you've already made a mistake."],

    ['scene', 'EXT. FERRY - BOW - LATER'],
    ['action', 'Wind now. Real wind. Marie grips the rail. The island behind them is a gray thumbprint.'],
    ['action', 'Augustin joins her, lighting a cigarette that refuses to stay lit.'],
    ['character', 'AUGUSTIN'],
    ['dialogue', 'Your father used to stand right there. Same face. Like the sea owed him money.'],
    ['character', 'MARIE'],
    ['dialogue', 'Did it?'],
    ['character', 'AUGUSTIN'],
    ['dialogue', 'Everybody thinks so. Nobody ever collects.'],
    ['action', 'Theo appears in the doorway behind them, holding the letter. Unfolded.'],
    ['character', 'THEO'],
    ['dialogue', '"Don\'t come after me." That\'s it? Six years and that\'s the whole letter?'],
    ['character', 'MARIE'],
    ['parenthetical', '(quiet)'],
    ['dialogue', "It was the only line I didn't cross out."],

    ['scene', 'INT. FERRY - WHEELHOUSE - NIGHT'],
    ['action', 'Rain hammers the glass. Augustin fights the wheel. Theo braces against the chart table.'],
    ['character', 'AUGUSTIN'],
    ['dialogue', "You want to know why she's running? Ask her what's on the other side."],
    ['character', 'THEO'],
    ['dialogue', "I'm asking you."],
    ['character', 'AUGUSTIN'],
    ['dialogue', "Nothing. That's the point. Nothing she has to be."],
    ['action', "Marie stands in the hatch, soaked. She's heard every word."],
    ['character', 'MARIE'],
    ['dialogue', 'Turn us around.'],
    ['character', 'AUGUSTIN'],
    ['dialogue', 'In this?'],
    ['character', 'THEO', { dual: true }],
    ['dialogue', 'Are you out of your mind?'],
    ['character', 'MARIE'],
    ['dialogue', 'You said it yourself. Tickets or goodbyes.'],
    ['parenthetical', '(to Theo)'],
    ['dialogue', 'I never said mine.'],
    ['action', "Theo looks at her a long moment. Then he laughs — and it's their father's laugh."],
    ['transition', 'CUT TO BLACK.'],
  ],
};

/** The sample's Story Bible notes: written for this script, so the Bible has something to show. */
export const SAMPLE_STORY_NOTES = {
  sections: [
    { title: 'Logline', body: 'Before a storm, a woman slips onto the last ferry off her island, and the brother she left a one-line goodbye for gets on board too.' },
    { title: 'Tone', body: 'Quiet, salt-worn, funny in the gaps.' },
    { title: 'Pitch', body: '' },
    { title: 'Timeline', body: '' },
    { title: 'Scratchpad', body: '' },
  ],
  synopsis: {
    act1: 'Marie slips away before dawn with one suitcase and a letter for Manman. Theo catches her at the pier, barefoot, and Captain Augustin forces the choice: tickets or goodbyes.',
    act2: 'On the crossing, Augustin sees their father in Marie. Theo reads the letter: one line, "Don\'t come after me."',
    act2b: 'The storm hits. In the wheelhouse, Augustin tells Theo what Marie is running toward: nothing she has to be.',
    act3: 'Marie asks Augustin to turn the ferry around. Theo laughs, and it\'s their father\'s laugh.',
  },
};

/** The earlier draft kept in the sample's Snapshots: no loudspeaker V.O. yet, and a flatter ending. */
export const SAMPLE_EARLIER_LABEL = 'First pass';
export function sampleEarlierDraft() {
  const out = [];
  const blocks = SAMPLE_SCRIPT.blocks;
  for (let i = 0; i < blocks.length; i += 1) {
    const [type, text] = blocks[i];
    if (type === 'character' && text === 'AUGUSTIN (V.O.)') {
      i += 2; // the loudspeaker line and its parenthetical came later
      continue;
    }
    if (text === "Theo looks at her a long moment. Then he laughs — and it's their father's laugh.") {
      out.push(['action', 'Theo says nothing. Outside, the ferry begins to turn.']);
      continue;
    }
    out.push(blocks[i]);
  }
  return out;
}
