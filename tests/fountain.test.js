import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toFountain, parseFountain } from '../src/lib/fountain.js';
import { toFDX } from '../src/lib/fdx.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';
import { makeBlock } from '../src/lib/screenplay.js';

const sample = SAMPLE_SCRIPT.blocks.map(([type, text, extra]) => makeBlock(type, text, extra));
const shape = (bs) => bs.map((b) => `${b.type}|${b.text.trim()}|${b.dual ? '^' : ''}`);

describe('Fountain export / import', () => {
  it('round-trips the sample script losslessly (types, text, dual dialogue)', () => {
    const back = parseFountain(toFountain({ meta: SAMPLE_SCRIPT.meta, blocks: sample }));
    assert.deepEqual(shape(back.blocks), shape(sample));
  });

  it('marks the second dual-dialogue speaker with a caret', () => {
    const out = toFountain({ meta: {}, blocks: sample });
    assert.match(out, /AUGUSTIN\nIn this\?\n\nTHEO \^\nAre you out of your mind\?/);
  });

  it('forces elements that would otherwise be misread', () => {
    const tricky = [
      makeBlock('action', 'BOOM.\nThe door explodes.'),
      makeBlock('action', 'INT. is not a heading here'),
      makeBlock('transition', 'SMASH CUT'),
      makeBlock('scene', 'flashback'),
    ];
    const out = toFountain({ meta: {}, blocks: tricky });
    assert.match(out, /^!BOOM\./m);
    assert.match(out, /^!INT\. is not/m);
    assert.match(out, /^> SMASH CUT$/m);
    assert.match(out, /^\.FLASHBACK$/m);
    assert.deepEqual(shape(parseFountain(out).blocks), shape(tricky.map((b) => (
      b.type === 'scene' || b.type === 'transition' ? { ...b, text: b.text.toUpperCase() } : b
    ))));
  });
});

describe('FDX export', () => {
  it('nests dual dialogue in Final Draft’s <DualDialogue> block', () => {
    const xml = toFDX({ meta: {}, blocks: sample });
    assert.match(xml, /<Paragraph>\s*<DualDialogue>\s*<Paragraph Type="Character">\s*<Text>AUGUSTIN<\/Text>/);
    assert.equal((xml.match(/<DualDialogue>/g) || []).length, 1);
  });
  it('numbers scene headings', () => {
    const xml = toFDX({ meta: {}, blocks: sample });
    assert.match(xml, /<Paragraph Number="4" Type="Scene Heading">/);
  });
});

describe('Fountain title page detection', () => {
  it('a script that opens with FADE IN: keeps it as a transition (not a title page key)', () => {
    const r = parseFountain('FADE IN:\n\nEXT. HARBOR - DAWN\n\nMist.\n\nFADE OUT.\n');
    assert.deepEqual(r.blocks.map((b) => b.type), ['transition', 'scene', 'action', 'transition']);
    assert.equal(r.blocks[0].text, 'FADE IN:');
  });
  it('still reads a real title page', () => {
    assert.equal(parseFountain('Title: X\nAuthor: Y\n\nINT. A - DAY\n').meta.author, 'Y');
  });
});
