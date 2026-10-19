import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFountain, toFountain } from '../src/lib/fountain.js';
import { toFDX } from '../src/lib/fdx.js';
import { parseTextScript } from '../src/lib/textScriptParser.js';
import { extractNotes } from '../src/lib/notes.js';
import { buildItems, paginate } from '../src/lib/screenplay.js';

const script = [
  { type: 'scene', text: 'INT. FERRY - NIGHT', note: 'Night shoot — budget?' },
  { type: 'action', text: 'Rain hammers the glass.\nThe hull groans.', note: 'Too long?\nTrim the second line' },
  { type: 'character', text: 'MARIE', note: 'Cast: Lyra' },
  { type: 'parenthetical', text: '(quiet)' },
  { type: 'dialogue', text: 'Turn us around.', note: 'Read flatter' },
  { type: 'transition', text: 'CUT TO:', note: 'Smash?' },
];
const shape = (bs) => bs.map((b) => `${b.type}|${b.text}|${b.note || ''}`);

describe('margin notes', () => {
  it('extracts [[notes]] from text', () => {
    assert.deepEqual(extractNotes('Rain. [[Note: check fog]] Wind.'), { text: 'Rain. Wind.', notes: ['Note: check fog'] });
  });

  it('round-trip through Fountain [[ ]] and stay on their elements', () => {
    const out = toFountain({ meta: {}, blocks: script });
    assert.match(out, /^INT\. FERRY - NIGHT \[\[Night shoot — budget\?\]\]$/m);
    assert.match(out, /^MARIE \[\[Cast: Lyra\]\]$/m);
    assert.deepEqual(shape(parseFountain(out).blocks), shape(script));
  });

  it('export to Final Draft as <ScriptNote> inside the element’s paragraph', () => {
    const xml = toFDX({ meta: {}, blocks: script });
    assert.equal((xml.match(/<ScriptNote /g) || []).length, 5);
    assert.match(xml, /<Text>MARIE<\/Text>\s*<ScriptNote ID="\d+">\s*<Paragraph>\s*<Text>Cast: Lyra<\/Text>/);
    // the note's text is not part of the element's own text run
    assert.match(xml, /<Paragraph Type="Character">\s*<Text>MARIE<\/Text>/);
  });

  it('never change pagination (notes are not body text)', () => {
    const plain = script.map(({ note: _n, ...b }) => ({ ...b, id: b.text })); // eslint-disable-line no-unused-vars
    const noted = script.map((b) => ({ ...b, id: b.text }));
    assert.deepEqual(paginate(buildItems(noted)).place.map((p) => p.lines), paginate(buildItems(plain)).place.map((p) => p.lines));
  });

  it('are kept by the text importer, including a note on its own line', () => {
    const r = parseTextScript('INT. A - DAY\n\nRain. [[Note: fog machine]]\n[[Ask about permits]]\n\nMARIE\nGo. [[louder]]');
    assert.equal(r.blocks[1].note, 'Note: fog machine\nAsk about permits');
    assert.equal(r.blocks[1].text, 'Rain.');
    assert.equal(r.blocks[3].note, 'louder');
    assert.equal(r.stats.notes, 2);
  });

  it('a note never changes how its line is classified', () => {
    const r = parseFountain('CUT TO: [[maybe smash]]\n\nINT. A - DAY [[permit]]\n\nBOB [[recast]]\nHi.\n');
    assert.deepEqual(r.blocks.map((b) => b.type), ['transition', 'scene', 'character', 'dialogue']);
  });
});
