import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CUE_CARD_DELAY, CUE_CARD_IDLE, bioCard, cueCardReducer, cueCardVisible, findBio, placeCueCard,
} from '../src/lib/cueBio.js';
import { toFountain } from '../src/lib/fountain.js';
import { toFDX } from '../src/lib/fdx.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const marie = { id: 'c1', name: 'Marie', role: 'Protagonist', age: '45', traits: 'Stubborn, funny under pressure.', backstory: 'Left Haiti at ten.' };
const theo = { id: 'c2', name: 'THEO', role: '', age: '', traits: '', backstory: '' };
const cast = [marie, theo];
const run = (events, state = CUE_CARD_IDLE) => events.reduce(cueCardReducer, state);

describe('Cue → bio: name normalization', () => {
  it('ignores extensions, the dual caret, the @ prefix and case', () => {
    for (const cue of ['MARIE', 'MARIE (V.O.)', 'MARIE (O.S.)', "MARIE (CONT'D)", 'MARIE (V.O.) (CONT\'D)', 'MARIE ^', '@marie', '  Marie  ']) {
      assert.equal(findBio(cast, cue)?.id, 'c1', cue);
    }
  });
  it('no bio, no match: other names, empty cues', () => {
    assert.equal(findBio(cast, 'AUGUSTIN'), null);
    assert.equal(findBio(cast, 'MARIELLE'), null, 'whole names only');
    assert.equal(findBio(cast, '(V.O.)'), null);
    assert.equal(findBio([], 'MARIE'), null);
  });
});

describe('Cue → bio: what the card shows', () => {
  it('name, role · age, traits as the summary, a backstory excerpt, and the bio id for Edit in Bios', () => {
    assert.deepEqual(bioCard(marie), {
      id: 'c1', name: 'Marie', meta: 'Protagonist · 45', relationship: '', summary: 'Stubborn, funny under pressure.', excerpt: 'Left Haiti at ten.',
    });
  });
  it('long text is trimmed at a word with an ellipsis', () => {
    const c = bioCard({ ...marie, backstory: 'word '.repeat(80) });
    assert.ok(c.excerpt.length <= 180 && c.excerpt.endsWith('…') && !/\s…$/.test(c.excerpt));
  });
  it('a bio with nothing but a name gets no card (no noise)', () => {
    assert.equal(bioCard(theo), null);
    assert.equal(bioCard(findBio(cast, 'THEO')), null);
    assert.equal(bioCard(null), null);
  });
});

describe('Cue → bio: showing and dismissing', () => {
  it(`hover shows it after the ${CUE_CARD_DELAY}ms delay — not before`, () => {
    const pending = run([{ type: 'enter', cueId: 'b1' }]);
    assert.equal(cueCardVisible(pending), false);
    assert.equal(cueCardVisible(run([{ type: 'timer', cueId: 'b1' }], pending)), true);
    assert.equal(cueCardVisible(run([{ type: 'timer', cueId: 'other' }], pending)), false, 'a stale timer does nothing');
  });
  it('a click shows it at once', () => {
    assert.deepEqual(run([{ type: 'click', cueId: 'b1' }]), { phase: 'open', cueId: 'b1' });
  });
  it('leaving before the delay cancels it; leaving after closes it after a short grace', () => {
    assert.equal(run([{ type: 'enter', cueId: 'b1' }, { type: 'leave' }]).phase, 'idle');
    const closing = run([{ type: 'click', cueId: 'b1' }, { type: 'leave' }]);
    assert.equal(closing.phase, 'closing');
    assert.equal(cueCardVisible(closing), true);
    assert.equal(run([{ type: 'closeTimer' }], closing).phase, 'idle');
  });
  it('moving onto the card keeps it open (to reach Edit in Bios); leaving the card closes it', () => {
    const s = run([{ type: 'click', cueId: 'b1' }, { type: 'leave' }, { type: 'enterCard' }, { type: 'closeTimer' }]);
    assert.equal(s.phase, 'open');
    assert.equal(run([{ type: 'leaveCard' }, { type: 'closeTimer' }], s).phase, 'idle');
  });
  it('Esc, typing, scrolling and blur dismiss it at once', () => {
    for (const type of ['escape', 'typing', 'scroll', 'blur']) {
      assert.deepEqual(run([{ type: 'click', cueId: 'b1' }, { type }]), CUE_CARD_IDLE, type);
    }
  });
});

describe('Cue → bio: placement and safety', () => {
  const view = { left: 0, right: 1000, top: 0, bottom: 800 };
  it('just below the cue — never on top of it — or above when there is no room', () => {
    assert.deepEqual(placeCueCard({ left: 300, right: 360, top: 100, bottom: 116 }, { width: 280, height: 150 }, view), { left: 300, top: 122, placement: 'below' });
    const up = placeCueCard({ left: 300, right: 360, top: 700, bottom: 716 }, { width: 280, height: 150 }, view);
    assert.equal(up.placement, 'above');
    assert.ok(up.top + 150 <= 700);
    assert.equal(placeCueCard({ left: 900, right: 960, top: 100, bottom: 116 }, { width: 280, height: 150 }, view).left, 712, 'kept inside on the right');
  });
  it('floats above the page without taking focus; never printed or exported', () => {
    const css = read('components/CueBioCard.css');
    assert.match(css, /\.cue-card \{[^}]*position: fixed;[^}]*z-index: 50;[^}]*pointer-events: auto;/);
    assert.match(css, /background: rgba\(26, 26, 28, 0\.95\);[^}]*backdrop-filter: blur\(8px\);/);
    assert.match(css, /box-shadow: 0 8px 24px rgba\(0, 0, 0, 0\.4\);/);
    assert.match(css, /@media print \{ \.cue-card \{ display: none !important; \} \}/);
    const jsx = read('components/CueBioCard.jsx');
    assert.match(jsx, /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/, 'clicks on the card never steal the caret');
    assert.ok(!/autoFocus|\.focus\(/.test(jsx), 'never focuses itself');
    assert.ok(!/cue-card|CueBioCard/.test(read('components/PrintView.jsx')));
    const blocks = [{ id: 'c', type: 'character', text: 'MARIE (V.O.)' }, { id: 'd', type: 'dialogue', text: 'Hi.' }];
    assert.ok(!/Stubborn|Protagonist/.test(toFountain({ meta: {}, blocks }) + toFDX({ meta: {}, blocks })));
  });
  it('Edit in Bios opens Characters → Bios with that character’s card open', () => {
    const app = read('App.jsx');
    assert.match(app, /const editBio = useCallback\(\(id\) => \{\s*setCharacterTab\('bios'\);\s*setDock\('characters'\);\s*setRevealBio\(\{ id \}\);/);
    assert.match(app, /<CueBioCard root=\{scrollerEl\} characters=\{characters\} onEdit=\{editBio\}/);
    assert.match(read('components/CharactersDrawer.jsx'), /if \(reveal\?\.id\) \{\s*setOpenId\(reveal\.id\);/);
  });
});
