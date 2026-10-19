import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toFountain, parseFountain } from '../src/lib/fountain.js';
import { toFDX } from '../src/lib/fdx.js';
import { parseTextScript } from '../src/lib/textScriptParser.js';
import {
  draftLines, looksLikeDate, looksLikeDraftVersion, splitDraftInfo, titleTypography,
} from '../src/lib/titleFonts.js';

const blocks = [{ type: 'scene', text: 'INT. KITCHEN - NIGHT' }, { type: 'action', text: 'Rain.' }];
const meta = {
  title: 'The Last Ferry',
  credit: 'Speculative screenplay by',
  author: 'Eric Lemaire Jr.',
  draftVersion: 'Sixth & Final Draft',
  draftDate: 'October 19, 2026',
  contact: 'Eric Lemaire Jr.\neric@example.com',
};

describe('draft block (version above date)', () => {
  it('stacks version above date', () => {
    assert.deepEqual(draftLines(meta), ['Sixth & Final Draft', 'October 19, 2026']);
  });
  it('drops whichever field is blank — no empty lines', () => {
    assert.deepEqual(draftLines({ draftVersion: '  ', draftDate: 'October 19, 2026' }), ['October 19, 2026']);
    assert.deepEqual(draftLines({ draftVersion: 'First Draft', draftDate: '' }), ['First Draft']);
    assert.deepEqual(draftLines({}), []);
  });
  it('recognises versions and dates', () => {
    for (const v of ['First Draft', 'Sixth & Final Draft', 'Revised Pink Draft', 'Production Revision', 'Studio Polish']) {
      assert.ok(looksLikeDraftVersion(v), v);
    }
    assert.ok(!looksLikeDraftVersion('Story by'));
    for (const d of ['October 19, 2026', '19 Oct 2026', '10/19/26', '2026-10-19']) assert.ok(looksLikeDate(d), d);
    for (const d of ['555-123-4567', '© 2026', 'eric@example.com']) assert.ok(!looksLikeDate(d), d);
  });
  it('splits a combined block back apart', () => {
    assert.deepEqual(splitDraftInfo('Sixth & Final Draft\nOctober 19, 2026'), {
      draftVersion: 'Sixth & Final Draft', draftDate: 'October 19, 2026',
    });
    assert.deepEqual(splitDraftInfo('October 19, 2026'), { draftVersion: '', draftDate: 'October 19, 2026' });
  });
});

describe('Fountain title page', () => {
  const out = toFountain({ meta, blocks });
  it('writes credit and a standard "Draft date:" key with version then date', () => {
    assert.match(out, /^Credit: Speculative screenplay by$/m);
    assert.match(out, /^Draft date:\n {4}Sixth & Final Draft\n {4}October 19, 2026$/m);
  });
  it('round-trips every field', () => {
    const back = parseFountain(out).meta;
    for (const k of ['title', 'credit', 'author', 'draftVersion', 'draftDate', 'contact']) assert.equal(back[k], meta[k], k);
  });
  it('omits the draft key entirely when both fields are blank', () => {
    assert.doesNotMatch(toFountain({ meta: { ...meta, draftVersion: '', draftDate: '' }, blocks }), /Draft date/);
  });
  it('accepts "Draft:" and "Revision:" keys from other apps', () => {
    const m = parseFountain('Title: X\nDraft: Shooting Draft\nDraft date: 1/2/2026\n\nINT. A - DAY\n').meta;
    assert.equal(m.draftVersion, 'Shooting Draft');
    assert.equal(m.draftDate, '1/2/2026');
  });
});

describe('FDX title page', () => {
  const xml = toFDX({ meta, blocks });
  it('writes the credit line', () => {
    assert.match(xml, /<Text>Speculative screenplay by<\/Text>/);
  });
  it('puts version then date in the right-aligned revision block', () => {
    const right = [...xml.matchAll(/Alignment="Right" Type="Action">\s*<Text>([^<]*)<\/Text>/g)].map((m) => m[1]);
    assert.deepEqual(right, ['Sixth &amp; Final Draft', 'October 19, 2026']);
  });
  it('maps title typography onto the <Text> run', () => {
    const x = toFDX({ meta: { ...meta, titleFont: 'orbitron', titleSize: 48, titleBold: true }, blocks });
    assert.match(x, /<Text Font="Orbitron" Size="48" Style="Bold">THE LAST FERRY/);
  });
});

describe('text importer title page', () => {
  it('captures draft version and date from a pasted title page', () => {
    const r = parseTextScript([
      'THE LAST FERRY', '', 'Written by', '', 'Eric Lemaire Jr.', '',
      'Sixth & Final Draft', 'October 19, 2026', '', 'eric@example.com', '555-123-4567', '',
      'FADE IN:', '', 'EXT. HARBOR - DAWN', '', 'Mist.',
    ].join('\n'));
    assert.equal(r.meta.title, 'THE LAST FERRY');
    assert.equal(r.meta.credit, 'Written by');
    assert.equal(r.meta.author, 'Eric Lemaire Jr.');
    assert.equal(r.meta.draftVersion, 'Sixth & Final Draft');
    assert.equal(r.meta.draftDate, 'October 19, 2026');
    assert.equal(r.meta.contact, 'eric@example.com\n555-123-4567');
  });
  it('reads a credit and author on one line', () => {
    const r = parseTextScript('NIGHT BUS\n\nScreenplay by Ana Ruiz\n\nINT. BUS - NIGHT\n\nRain.');
    assert.equal(r.meta.credit, 'Screenplay by');
    assert.equal(r.meta.author, 'Ana Ruiz');
  });
});

describe('title typography', () => {
  it('defaults to Courier Prime, 32pt, bold', () => {
    const t = titleTypography({});
    assert.equal(t.font.id, 'courier-prime');
    assert.equal(t.size, 32);
    assert.equal(t.weight, 700);
  });
  it('never fakes bold on single-weight fonts', () => {
    assert.equal(titleTypography({ titleFont: 'pacifico', titleBold: true }).weight, 400);
  });
});
