// Shared starting material for the Video 2.0 walkthroughs (record-dl08.js … record-dl16.js).
//
// The Last Ferry, extended: the sample's world and cast, long enough for what these videos show —
// twelve scenes across INT/EXT and DAY/NIGHT (the Stripboard's four colours and the Plan filter),
// introductions in the Action for Populate Bio (MARIE, THEO, AUGUSTIN, LENA), a real monologue for
// the Dialogue tab's filter, 20+ speeches, and enough pages for the Scene Board's pacing badges.
import { SAMPLE_SCRIPT } from '../../src/lib/sampleScript.js';

export const TITLE = 'The Last Ferry';
export const AUTHOR = SAMPLE_SCRIPT.meta.author;

const scene = (heading, action, ...speeches) => [
  ['scene', heading],
  ...[].concat(action).map((a) => ['action', a]),
  ...speeches.flatMap(([who, line, paren]) => [['character', who], ...(paren ? [['parenthetical', paren]] : []), ['dialogue', line]]),
];

/** Marie's monologue: well over 60 words, so the Dialogue tab counts it. */
const MONOLOGUE = 'You want to know why I left? Because every morning on that island I woke up as the girl who stayed. '
  + 'Papa\'s boat, Papa\'s debts, Papa\'s name on every door in the harbor. I wrote that letter nine times, Theo. '
  + 'Nine times I told Manman I was going, and nine times I folded it into my coat and went down to the water anyway. '
  + 'This morning I finally got on the boat. Don\'t you dare ask me to get off it.';

export const BLOCKS = [
  ['transition', 'FADE IN:'],
  ...scene('EXT. HARBOR - DAWN',
    ['Fog sits low on the water. Gulls argue over a broken crate.',
      'MARIE (30s), coat buttoned to the throat, drags a suitcase with one bad wheel down the pier.',
      'Behind her, THEO (20s), her brother, jogs to catch up — barefoot, shoes in hand.'],
    ['THEO', 'You were going to leave without saying anything.'],
    ['MARIE', 'I left a letter.'],
    ['THEO', 'Manman can\'t read.', 'quietly']),
  ...scene('INT. FERRY - PASSENGER DECK - CONTINUOUS',
    ['Rows of salt-bleached benches. A radio crackles weather warnings no one listens to.'],
    ['MARIE', 'Sit anywhere. It\'s a two-hour crossing.'],
    ['THEO', 'Then we have two hours.']),
  ...scene('EXT. FERRY - BOW - DAY',
    ['A HORN BLASTS. CAPTAIN AUGUSTIN (60s), weathered as the hull, leans out of the wheelhouse.'],
    ['AUGUSTIN', 'Storm\'s early. We sail anyway.'],
    ['MARIE', 'Like the sea owed him money.'],
    ['THEO', 'He sounds like Papa.']),
  ...scene('INT. FERRY - GALLEY - DAY',
    ['LENA (40s), the cook, sharp-eyed, slides two cups of coffee across a steel counter.'],
    ['LENA', 'Siblings. You fight like it.'],
    ['THEO', 'She\'s running away.'],
    ['MARIE', 'I\'m moving.'],
    ['LENA', 'Same thing, with luggage.']),
  ...scene('EXT. FERRY - STERN - DAY',
    ['The island shrinks behind them. Marie doesn\'t look back. Theo can\'t stop looking.'],
    ['THEO', 'Read me the letter.'],
    ['MARIE', 'No.']),
  ...scene('INT. FERRY - WHEELHOUSE - DAY',
    ['Augustin taps a barometer. The needle drops.'],
    ['AUGUSTIN', 'Lena. Tie everything down.'],
    ['LENA', 'Everything\'s always tied down. That\'s why I\'m still here.']),
  ...scene('EXT. FERRY - BOW - NIGHT',
    ['Rain arrives sideways. The deck lights swing on their wires.'],
    ['THEO', 'Why now? Why today?'],
    ['MARIE', MONOLOGUE]),
  ...scene('INT. FERRY - PASSENGER DECK - NIGHT',
    ['Benches slide. A child\'s shoe skitters past. Theo catches it.'],
    ['THEO', 'We should go back.'],
    ['MARIE', 'There is no back.']),
  ...scene('INT. FERRY - ENGINE ROOM - NIGHT',
    ['Steam and noise. Augustin works a stuck valve with both hands.'],
    ['AUGUSTIN', 'Your father fixed this valve. Twice.'],
    ['THEO', 'Can you?']),
  ...scene('EXT. FERRY - BOW - NIGHT',
    ['Marie unfolds the letter. The rain takes the ink in long grey threads.'],
    ['MARIE', 'It just says I\'m sorry. Nine times.'],
    ['THEO', 'Then say it once. Out loud.']),
  ...scene('EXT. HARBOR - DAWN',
    ['The ferry noses back into the island harbor. Their mother waits on the pier in her nightgown.'],
    ['MARIE', 'Turn us around, he said. So he did.']),
  ...scene('INT. MOTHER\'S KITCHEN - DAY',
    ['Three cups. Theo laughs, and it\'s their father\'s laugh. Marie finally sits.'],
    ['LENA', 'Coffee\'s still hot. Sit.']),
  ['transition', 'FADE OUT.'],
  ['centered', 'THE END'],
];

/** An earlier draft for Snapshot Compare: no galley scene yet, and a softer ending. */
export const EARLIER_DRAFT = BLOCKS
  .filter((b, i, all) => !(i >= all.findIndex((x) => x[1] === 'INT. FERRY - GALLEY - DAY') && i < all.findIndex((x) => x[1] === 'EXT. FERRY - STERN - DAY')))
  .map(([type, text, extra]) => [type, text === 'Then say it once. Out loud.' ? 'Then don\'t read it. Just tell her.' : text, extra]);

/** Story Bible notes: Logline, Tone, Pitch, Timeline, Scratchpad, and a three-act synopsis. */
export const STORY_NOTES = {
  sections: [
    { title: 'Logline', body: 'Two siblings take the last ferry before a storm, and the letter one of them never sent comes with them.' },
    { title: 'Tone', body: 'Quiet, salt-worn, funny in the gaps.' },
    { title: 'Pitch', body: '' },
    { title: 'Timeline', body: '- 1998: Papa\'s boat goes down\n- 2021: Marie writes the first letter' },
    { title: 'Scratchpad', body: '' },
  ],
  synopsis: {
    act1: 'Marie leaves the island before sunrise with one suitcase and a letter she never sent. Theo turns up late, barefoot, and buys a ticket anyway.',
    act2: 'The storm closes in. Captain Augustin refuses to turn back, and refuses to say why.',
    act2b: 'At the bow, soaked, Marie finally says why she left. The engine stalls.',
    act3: 'Theo makes her say it once, out loud. The ferry turns for home.',
  },
};
