// FDX fixture suite: Final Draft-structured .fdx files (tests/fixtures/fdx/) read into DraftLine,
// written back out, and read again. Three things are checked for every fixture:
//   1. Parsing fidelity — the script comes in with every element, in order, with its text intact.
//   2. Export fidelity  — what DraftLine writes is well-formed XML in Final Draft's shape.
//   3. Invariance       — FDX → DraftLine → FDX keeps element order, types, text and formatting.
// Where DraftLine knowingly differs from Final Draft (see tests/fixtures/fdx/README.md), the test
// pins today's behaviour under "Known gaps", so a fix shows up as a failing test to update.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { installDOMParser } from './helpers/miniDom.js';

installDOMParser();
const { parseFDX, toFDX } = await import('../src/lib/fdx.js');

const DIR = new URL('./fixtures/fdx/', import.meta.url);
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.fdx')).sort();
const raw = (f) => readFileSync(new URL(f, DIR), 'utf8');
const load = (f) => parseFDX(raw(f));
const pairs = (blocks) => blocks.map((b) => [b.type, b.text]);

// ---------------------------------------------------------------------------------------------
// A strict XML well-formedness check (miniDom is deliberately forgiving, so it can't be the judge):
// one prolog, one root, every tag closed in order, attributes quoted and unique, no raw `<` or
// stray `&` in text or attribute values, only the five XML entities or numeric references.
// Returns a tree of { name, attrs, children, text } for the schema checks below.
function strictXml(xml) {
  const fail = (msg, at) => { throw new Error(`${msg} at offset ${at}: ${JSON.stringify(xml.slice(at, at + 40))}`); };
  const ENTITY = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/y;
  const checkText = (s, at) => {
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '<') fail('raw < in text', at + i);
      if (s[i] === '&') { ENTITY.lastIndex = i; if (!ENTITY.test(s)) fail('stray &', at + i); }
    }
  };
  if (!/^<\?xml version="1\.0" encoding="UTF-8"[^?]*\?>/.test(xml)) fail('missing UTF-8 XML prolog', 0);
  const doc = { name: '#doc', children: [] };
  const stack = [doc];
  const re = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/([A-Za-z_][\w.-]*)\s*>|<([A-Za-z_][\w.-]*)((?:\s+[^\s=/>]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)|(<)/g;
  let m;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[6]) fail('unparseable markup', m.index);
    if (m[1]) {
      if (top.name !== m[1]) fail(`</${m[1]}> closes <${top.name}>`, m.index);
      stack.pop();
    } else if (m[2]) {
      if (stack.length === 1 && doc.children.length) fail('second root element', m.index);
      const el = { name: m[2], attrs: {}, children: [], text: '' };
      for (const a of m[3].matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/g)) {
        if (a[1] in el.attrs) fail(`duplicate attribute ${a[1]}`, m.index);
        checkText(a[2], m.index);
        el.attrs[a[1]] = a[2];
      }
      top.children.push(el);
      if (!m[4]) stack.push(el);
    } else if (m[5] !== undefined) {
      if (stack.length === 1) { if (m[5].trim()) fail('text outside the root', m.index); continue; }
      checkText(m[5], m.index);
      top.text += m[5];
    }
  }
  if (stack.length !== 1) fail(`<${stack[stack.length - 1].name}> never closed`, xml.length);
  if (doc.children.length !== 1) fail('no root element', 0);
  return doc.children[0];
}
const kids = (el, name) => el.children.filter((c) => c.name === name);

// Final Draft's built-in screenplay element names, and its run styles.
const FD_TYPES = new Set(['Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Transition', 'Shot', 'General', 'Cast List', 'New Act', 'End of Act', 'Lyrics']);
const FD_STYLES = new Set(['Bold', 'Italic', 'Underline', 'Strikeout', 'AllCaps']);

/** Final Draft's schema, as far as DraftLine writes it. Returns the root's <Content> paragraphs. */
function assertFinalDraftShape(xml) {
  const root = strictXml(xml);
  assert.equal(root.name, 'FinalDraft');
  assert.equal(root.attrs.DocumentType, 'Script');
  assert.equal(root.attrs.Template, 'No');
  assert.match(root.attrs.Version, /^\d+$/);
  const content = kids(root, 'Content');
  assert.equal(content.length, 1, 'exactly one script <Content>');
  const walk = (paras, inDual = false) => {
    for (const p of paras) {
      assert.equal(p.name, 'Paragraph', `only <Paragraph> in <Content>, not <${p.name}>`);
      const dual = kids(p, 'DualDialogue');
      if (dual.length) {
        assert.ok(!inDual, 'dual dialogue does not nest');
        assert.equal(p.attrs.Type, undefined, 'the dual wrapper paragraph has no Type');
        walk(dual[0].children, true);
        continue;
      }
      assert.ok(FD_TYPES.has(p.attrs.Type), `known element type: ${p.attrs.Type}`);
      if (inDual) assert.ok(['Character', 'Parenthetical', 'Dialogue'].includes(p.attrs.Type), 'only speech inside DualDialogue');
      if (p.attrs.Alignment) assert.match(p.attrs.Alignment, /^(Left|Center|Right|Full)$/);
      if (p.attrs.Number) assert.equal(p.attrs.Type, 'Scene Heading', 'only scene headings are numbered');
      const texts = kids(p, 'Text');
      assert.ok(texts.length >= 1, 'every paragraph has a <Text> run');
      for (const t of texts) {
        if (t.attrs.Style) for (const s of t.attrs.Style.split('+')) assert.ok(FD_STYLES.has(s), `known style token: ${s}`);
      }
    }
  };
  walk(content[0].children);
  for (const tp of kids(root, 'TitlePage')) {
    const c = kids(tp, 'Content');
    assert.equal(c.length, 1);
    for (const p of c[0].children) assert.equal(p.name, 'Paragraph');
  }
  return content[0].children;
}

/** What survives a round trip by design: notes are never exported, so drop them (and note-only lines). */
const exportable = (blocks) => blocks
  .filter((b) => (b.text || '').trim() && b.text.trim() !== '()')
  .map(({ note, ...b }) => b); // eslint-disable-line no-unused-vars

// ---------------------------------------------------------------------------------------------

describe('FDX fixtures: the library', () => {
  it('covers 10–12 scenarios, each one well-formed Final Draft XML', () => {
    assert.ok(FILES.length >= 10 && FILES.length <= 12, `${FILES.length} fixtures`);
    for (const f of FILES) {
      const root = strictXml(raw(f));
      assert.equal(root.name, 'FinalDraft', f);
      assert.equal(root.attrs.DocumentType, 'Script', f);
      assert.equal(kids(root, 'Content').length, 1, f);
    }
  });
  it('the README describes every fixture and how they were made', () => {
    const readme = raw('README.md');
    for (const f of FILES) assert.ok(readme.includes(f), `README lists ${f}`);
    assert.match(readme, /constructed/i);
    assert.match(readme, /Known gaps/);
  });
  it('every fixture imports without throwing and without losing its scene headings', () => {
    for (const f of FILES) {
      const xml = raw(f);
      const { blocks } = load(f);
      const headings = (xml.match(/<Paragraph [^>]*Type="Scene Heading"/g) || []).length;
      assert.equal(blocks.filter((b) => b.type === 'scene').length, headings, f);
    }
  });
});

describe('FDX fixtures: parsing fidelity', () => {
  it('01 standard scene: every element type, in order, text untouched', () => {
    assert.deepEqual(pairs(load('01-standard-scene.fdx').blocks), [
      ['transition', 'FADE IN:'],
      ['scene', 'EXT. HARBOR - DAWN'],
      ['action', 'Mist over black water. A rusted ferry, the SAINTE-ROSE, idles against the pier.'],
      ['character', 'MARIE'],
      ['parenthetical', '(not turning around)'],
      ['dialogue', "You said six. It's not even five-thirty."],
      ['character', 'THEO'],
      ['dialogue', "I said be here by six. I didn't say I'd wait."],
      ['transition', 'CUT TO:'],
      ['scene', 'INT. FERRY - PASSENGER DECK - CONTINUOUS'],
      ['action', 'Rows of bolted benches. A radio crackles weather warnings in two languages.'],
    ]);
  });

  it('02 dual dialogue: both speeches come in, the right-hand cue marked dual, a parenthetical kept', () => {
    const { blocks } = load('02-dual-dialogue.fdx');
    assert.deepEqual(blocks.map((b) => [b.type, b.text, !!b.dual]), [
      ['scene', 'INT. FERRY - WHEELHOUSE - NIGHT', false],
      ['action', 'Augustin fights the wheel. Marie stands in the hatch, soaked.', false],
      ['character', 'AUGUSTIN', false], ['dialogue', 'In this?', false],
      ['character', 'THEO', true], ['parenthetical', '(to Marie)', false], ['dialogue', 'Are you out of your mind?', false],
      ['character', 'MARIE', false], ['dialogue', 'Turn us around.', false],
      ['character', 'AUGUSTIN', false], ['dialogue', 'No.', false],
      ['character', 'THEO', true], ['dialogue', 'Yes.', false],
    ]);
  });

  it('03 inline formatting: Bold, Italic, Underline, Strikeout and combinations land on the right characters', () => {
    const { blocks } = load('03-inline-formatting.fdx');
    const [, a1, a2, , d1, d2, a3] = blocks;
    const span = (b, k) => (b.marks?.[k] || []).map(([s, e]) => b.text.slice(s, e));
    assert.equal(a1.text, 'The letter is short. Three words are underlined twice: do not follow.');
    assert.deepEqual([span(a1, 'b'), span(a1, 'u'), span(a1, 'i')], [['Three words'], ['do not follow'], []]);
    assert.deepEqual([span(a2, 'i'), span(a2, 'b')], [['Somewhere', 'konpa'], ['konpa']], 'Bold+Italic');
    assert.deepEqual([span(d1, 'i'), span(d1, 'b'), span(d1, 'u')], [['never', 'once'], ['once'], ['once']], 'Bold+Italic+Underline in dialogue');
    assert.deepEqual(span(d2, 's'), ['forgive']);
    assert.deepEqual([span(a3, 'u'), Object.keys(a3.marks)], [['SUPER:'], ['u']], "AllCaps is Final Draft's display style, not a DraftLine mark");
  });

  it('04 title page: title, credit, author, source, contact block and draft line', () => {
    assert.deepEqual(load('04-title-page-full.fdx').meta, {
      title: 'THE LAST FERRY',
      credit: 'Written by',
      author: 'Eric Lemaire Jr.',
      basedOn: 'the short story “Sainte-Rose” by Marie Fils-Aimé',
      contact: 'Lemaire Pictures\neric@example.com\n+250 788 000 000',
      draftVersion: 'Second Draft',
      draftDate: 'October 25, 2026',
    });
  });

  it('05 scene numbers: 12, 12A, 12B, 13 headings and their scenes all come in, in order', () => {
    assert.deepEqual(pairs(load('05-scene-numbers.fdx').blocks).filter(([t]) => t === 'scene').map(([, x]) => x), [
      'INT. FERRY - PASSENGER DECK - DAY', 'INT. FERRY - CORRIDOR - CONTINUOUS', 'EXT. FERRY - BOW - CONTINUOUS', 'INT. WHEELHOUSE - NIGHT',
    ]);
    assert.equal(load('05-scene-numbers.fdx').blocks.length, 8);
  });

  it('06 ScriptNotes: become margin notes on their element; the note text never leaks into the script', () => {
    const { blocks } = load('06-script-notes.fdx');
    assert.deepEqual(blocks.map((b) => [b.type, b.text, b.note || null]), [
      ['scene', 'EXT. HARBOR - DAWN', null],
      ['action', 'Mist over black water.', 'Too quiet? Open on the horn instead.'],
      ['character', 'MARIE', null],
      ['dialogue', 'We go now.', 'Should she say this or just walk?'],
      ['action', '', 'A note on an empty line: keep it.'],
    ]);
  });

  it('07 transitions and shots: every transition kept; shots come in as Action; THE END centered', () => {
    assert.deepEqual(pairs(load('07-transitions-shots.fdx').blocks), [
      ['scene', "INT. MANMAN'S HOUSE - NIGHT"],
      ['action', 'CLOSE ON THE LETTER'],
      ['action', 'Ink running where the rain got in.'],
      ['transition', 'DISSOLVE TO:'],
      ['scene', 'EXT. FERRY - BOW - LATER'],
      ['action', 'ANGLE ON THEO'],
      ['action', "He laughs, and it's their father's laugh."],
      ['transition', 'SMASH CUT TO:'],
      ['scene', 'EXT. OPEN SEA - CONTINUOUS'],
      ['action', 'The ferry, small against the storm.'],
      ['transition', 'FADE OUT.'],
      ['centered', 'THE END'],
    ]);
  });

  it("08 cue extensions: (O.S.), (V.O.), (O.C.), stacked (V.O.) (CONT'D), curly (CONT’D) and (ON RADIO) kept verbatim", () => {
    const cues = load('08-character-extensions.fdx').blocks.filter((b) => b.type === 'character').map((b) => b.text);
    assert.deepEqual(cues, ['MARIE (O.S.)', 'THEO (V.O.)', "THEO (V.O.) (CONT'D)", 'AUGUSTIN (O.C.)', 'MARIE (CONT’D)', 'MAN #2 (ON RADIO)']);
    const { blocks } = load('08-character-extensions.fdx');
    for (let i = 1; i < blocks.length; i += 2) assert.deepEqual([blocks[i].type, blocks[i + 1].type], ['character', 'dialogue']);
  });

  it('09 blank elements: empty, whitespace-only and self-closing paragraphs are cleaned up', () => {
    assert.deepEqual(pairs(load('09-blank-cleanup.fdx').blocks), [
      ['scene', 'EXT. HARBOR - DAWN'],
      ['action', 'The only line that matters.'],
      ['character', 'MARIE'],
      ['dialogue', 'Still here.'],
    ]);
  });

  it('10 full Final Draft 13 skeleton: settings, SmartType, arc beats and revision IDs are ignored, the script is not', () => {
    const { meta, blocks } = load('10-fd13-full-skeleton.fdx');
    assert.deepEqual(pairs(blocks), [
      ['scene', 'EXT. HARBOR - DAWN'],
      ['action', 'Marie drags a suitcase with one bad wheel down the planks.'],
      ['character', 'MARIE'],
      ['dialogue', 'Last crossing.'],
      ['transition', 'CUT TO:'],
      ['scene', 'INT. FERRY - DAY'],
      ['action', 'Benches. A radio.'],
    ]);
    assert.ok(!blocks.some((b) => /decides to leave|Courier|MANMAN|INT\. $/.test(b.text)), 'nothing from arc beats, macros or SmartType');
    assert.deepEqual(blocks[1].marks, { i: [[23, 41]] }, 'multiple runs joined; the italic run kept');
    assert.deepEqual([meta.title, meta.author], ['THE LAST FERRY', 'Eric Lemaire Jr.']);
  });

  it('11 unicode and escapes: accents, curly quotes, dashes, ellipses, named and numeric entities decode exactly', () => {
    assert.deepEqual(pairs(load('11-unicode-and-escapes.fdx').blocks), [
      ['scene', 'EXT. PÉTION-VILLE - MARCHÉ - DAY'],
      ['action', 'Ti Jan sells kremas — “the good kind” … for 50 goud & a smile.'],
      ['character', 'MANMAN'],
      ['parenthetical', '(in Kreyòl)'],
      ['dialogue', 'Pitit mwen, ou pèdi tan ou. Mèsi, Bondye.'],
      ['action', 'A sign: <NO CREDIT> & "CASH ONLY". Price: €3 or $4.'],
      ['action', 'Café, naïve, ça va? ¿Qué? ¼ été.'],
    ]);
  });

  it('12 General and non-screenplay elements: General is a format cue; New Act, Lyrics, Cast List and End of Act come in as Action, text kept', () => {
    assert.deepEqual(pairs(load('12-general-and-unknown.fdx').blocks), [
      ['action', 'ACT ONE'],
      ['scene', 'INT. FERRY - CABIN - NIGHT'],
      ['format_cue', 'IN CREOLE WITH ENGLISH SUBTITLES:'],
      ['character', 'MARIE'],
      ['dialogue', 'Nou pral lakay.'],
      ['format_cue', 'END SUBTITLES'],
      ['centered', 'INTERMISSION'],
      ['action', 'Ferry, ferry, carry me home'],
      ['action', 'MARIE, THEO, AUGUSTIN'],
      ['action', 'END OF ACT ONE'],
    ]);
  });

  it('no fixture produces an empty, untyped or whitespace-padded element (other than a note-only line)', () => {
    const TYPES = new Set(['scene', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'format_cue', 'centered']);
    for (const f of FILES) {
      for (const b of load(f).blocks) {
        assert.ok(TYPES.has(b.type), `${f}: type ${b.type}`);
        assert.equal(typeof b.text, 'string', f);
        if (!b.note) assert.ok(b.text.trim(), `${f}: empty ${b.type}`);
        assert.equal(b.text, b.text.trim(), `${f}: padded "${b.text}"`);
      }
    }
  });
});

describe('FDX fixtures: export fidelity', () => {
  it('every fixture exports as well-formed XML in Final Draft\'s schema', () => {
    for (const f of FILES) {
      const xml = toFDX(load(f));
      assert.doesNotThrow(() => assertFinalDraftShape(xml), f);
    }
  });

  it('elements export with Final Draft\'s type names, in order', () => {
    const paras = assertFinalDraftShape(toFDX(load('01-standard-scene.fdx')));
    assert.deepEqual(paras.map((p) => p.attrs.Type), [
      'Transition', 'Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Character', 'Dialogue', 'Transition', 'Scene Heading', 'Action',
    ]);
  });

  it('dual dialogue exports as one <DualDialogue> per pair, left speech then right', () => {
    const paras = assertFinalDraftShape(toFDX(load('02-dual-dialogue.fdx')));
    const duals = paras.filter((p) => kids(p, 'DualDialogue').length);
    assert.equal(duals.length, 2);
    const inside = (p) => kids(p, 'DualDialogue')[0].children.map((c) => [c.attrs.Type, kids(c, 'Text').map((t) => t.text).join('')]);
    assert.deepEqual(inside(duals[0]), [['Character', 'AUGUSTIN'], ['Dialogue', 'In this?'], ['Character', 'THEO'], ['Parenthetical', '(to Marie)'], ['Dialogue', 'Are you out of your mind?']]);
    assert.deepEqual(inside(duals[1]), [['Character', 'AUGUSTIN'], ['Dialogue', 'No.'], ['Character', 'THEO'], ['Dialogue', 'Yes.']]);
  });

  it('formatting exports as Text runs with Final Draft Style tokens', () => {
    const paras = assertFinalDraftShape(toFDX(load('03-inline-formatting.fdx')));
    const runs = (p) => kids(p, 'Text').map((t) => [t.attrs.Style || '', t.text]);
    assert.deepEqual(runs(paras[1]), [['', 'The letter is short. '], ['Bold', 'Three words'], ['', ' are underlined twice: '], ['Underline', 'do not follow'], ['', '.']]);
    assert.deepEqual(runs(paras[4]).find(([, x]) => x === 'once'), ['Bold+Italic+Underline', 'once']);
    assert.deepEqual(runs(paras[5]).find(([, x]) => x === 'forgive'), ['Strikeout', 'forgive']);
  });

  it('special characters are escaped, never written raw', () => {
    const xml = toFDX(load('11-unicode-and-escapes.fdx'));
    assert.match(xml, /A sign: &lt;NO CREDIT&gt; &amp; (?:"|&quot;)CASH ONLY(?:"|&quot;)\. Price: €3 or \$4\./);
    assert.match(xml, /for 50 goud &amp; a smile\./);
    assert.ok(xml.includes('PÉTION-VILLE'), 'non-ASCII written as UTF-8 text');
  });

  it('the title page exports in Final Draft\'s <TitlePage> with the same fields', () => {
    const doc = load('04-title-page-full.fdx');
    const xml = toFDX(doc);
    const root = strictXml(xml);
    const tp = kids(root, 'TitlePage');
    assert.equal(tp.length, 1);
    const lines = kids(tp[0], 'Content')[0].children.map((p) => [p.attrs.Alignment, kids(p, 'Text').map((t) => t.text).join('')]).filter(([, x]) => x);
    assert.deepEqual(lines.slice(0, 2), [['Center', 'THE LAST FERRY'], ['Center', 'Written by']]);
    assert.ok(lines.some(([a, x]) => a === 'Left' && x === 'eric@example.com'));
    assert.ok(lines.some(([a, x]) => a === 'Right' && /Second Draft/.test(x)));
  });
});

describe('FDX fixtures: round-trip invariance (FDX → DraftLine → FDX)', () => {
  let trips;
  before(() => {
    trips = FILES.map((f) => {
      const first = load(f);
      const xml = toFDX(first);
      const second = parseFDX(xml);
      return { f, first, xml, second };
    });
  });

  it('element order, types, text and formatting marks are preserved for every fixture', () => {
    for (const { f, first, second } of trips) {
      assert.deepEqual(second.blocks, exportable(first.blocks), f);
    }
  });

  it('dual-dialogue flags survive', () => {
    const t = trips.find((x) => x.f.startsWith('02'));
    assert.deepEqual(t.second.blocks.filter((b) => b.dual).map((b) => b.text), ['THEO', 'THEO']);
  });

  it('title page metadata survives', () => {
    for (const { f, first, second } of trips) assert.deepEqual(second.meta, first.meta, f);
  });

  it('a second round trip changes nothing: the export is a fixed point', () => {
    for (const { f, xml, second } of trips) assert.equal(toFDX(second), xml, f);
  });
});

describe('FDX fixtures: known gaps (pinned, see README)', () => {
  it('scene numbers: 12A / 12B are not kept — DraftLine renumbers 1, 2, 3… on export', () => {
    const src = raw('05-scene-numbers.fdx');
    assert.deepEqual([...src.matchAll(/Number="([^"]+)" Type="Scene Heading"/g)].map((m) => m[1]), ['12', '12A', '12B', '13']);
    const paras = assertFinalDraftShape(toFDX(load('05-scene-numbers.fdx')));
    assert.deepEqual(paras.filter((p) => p.attrs.Type === 'Scene Heading').map((p) => p.attrs.Number), ['1', '2', '3', '4']);
    assert.ok(!('number' in load('05-scene-numbers.fdx').blocks[0]), 'no scene number on the imported block');
  });

  it('ScriptNotes: imported as margin notes, and by default not exported (DraftLine keeps notes private)', () => {
    const xml = toFDX(load('06-script-notes.fdx'));
    assert.doesNotMatch(xml, /ScriptNote|Too quiet|A note on an empty line/);
    assert.equal(toFDX(load('06-script-notes.fdx'), { includeNotes: false }), xml);
  });

  it('Shot becomes Action; New Act, End of Act, Lyrics and Cast List become Action', () => {
    const t = (f) => assertFinalDraftShape(toFDX(load(f))).map((p) => p.attrs.Type);
    assert.ok(!t('07-transitions-shots.fdx').includes('Shot'));
    assert.deepEqual(t('12-general-and-unknown.fdx'), ['Action', 'Scene Heading', 'General', 'Character', 'Dialogue', 'General', 'Action', 'Action', 'Action', 'Action']);
  });

  it("Final Draft's own settings (ElementSettings, SmartType, PageLayout, Revisions…) are not carried over", () => {
    const xml = toFDX(load('10-fd13-full-skeleton.fdx'));
    assert.doesNotMatch(xml, /<ElementSettings|<SmartType|<PageLayout|<Revisions|SceneProperties|RevisionID/);
  });
});

// ---------------------------------------------------------------------------------------------

describe('FDX: Include margin notes (Script Notes on export)', () => {
  const NOTES = load('06-script-notes.fdx');
  const notesOf = (blocks) => blocks.filter((b) => b.note).map((b) => [b.type, b.text, b.note]);
  it('off by default: no <ScriptNote> and no note definitions, byte for byte the same as before', () => {
    for (const f of FILES) {
      const doc = load(f);
      assert.equal(toFDX(doc), toFDX(doc, { includeNotes: false }), f);
      assert.doesNotMatch(toFDX(doc), /ScriptNote/, f);
    }
  });
  it('on: every margin note goes out as a Final Draft <ScriptNote> inside its element, before the text', () => {
    const xml = toFDX(NOTES, { includeNotes: true });
    assertFinalDraftShape(xml);
    assert.equal(xml.match(/<ScriptNote /g).length, 3);
    assert.match(xml, /<Paragraph Type="Action">\n {6}<ScriptNote ID="1" Marker="N" Range="0,22" Type="0">\n {8}<Paragraph Alignment="Left"[^>]*>\n {10}<Text>Too quiet\? Open on the horn instead\.<\/Text>\n {8}<\/Paragraph>\n {6}<\/ScriptNote>\n {6}<Text>Mist over black water\.<\/Text>/);
    assert.match(xml, /<ScriptNote ID="2" [^>]*>[\s\S]*?Should she say this or just walk\?[\s\S]*?<\/ScriptNote>\n {6}<Text>We go now\.<\/Text>/);
    const ids = [...xml.matchAll(/<ScriptNote ID="(\d+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, ['1', '2', '3'], 'unique, in script order');
  });
  it('on: the Script Note definition Final Draft keys them to is written once, after the title page', () => {
    const xml = toFDX(NOTES, { includeNotes: true });
    assert.match(xml, /<\/TitlePage>\n {2}<ScriptNoteDefinitions Active="0">\n {4}<ScriptNoteDefinition Color="#FFFFFF8F0000" ID="0" Marker="N" Name="Script Note"\/>\n {2}<\/ScriptNoteDefinitions>\n<\/FinalDraft>/);
    assert.doesNotMatch(toFDX(load('01-standard-scene.fdx'), { includeNotes: true }), /ScriptNote/, 'no notes, no definitions');
  });
  it('on: a note on an empty line keeps the line, as empty Action holding the note', () => {
    const xml = toFDX(NOTES, { includeNotes: true });
    assert.match(xml, /<Paragraph Type="Action">\n {6}<ScriptNote ID="3"[^>]*>[\s\S]*?A note on an empty line: keep it\.[\s\S]*?<\/ScriptNote>\n {6}<Text><\/Text>\n {4}<\/Paragraph>/);
  });
  it('round trip: FDX → DraftLine → FDX with notes → DraftLine keeps every note on its element', () => {
    const back = parseFDX(toFDX(NOTES, { includeNotes: true }));
    assert.deepEqual(notesOf(back.blocks), notesOf(NOTES.blocks));
    assert.deepEqual(pairs(back.blocks), pairs(NOTES.blocks));
  });
  it('multi-line notes: one note paragraph per line, escaped; they read back as the same lines', () => {
    const blocks = [
      { id: 'a', type: 'scene', text: 'INT. FERRY - NIGHT' },
      { id: 'b', type: 'action', text: 'Rain.', note: 'Line one\nTom & Jerry <cut>\n' },
      { id: 'c', type: 'action', text: 'Silence.', note: '   ' },
    ];
    const xml = toFDX({ blocks }, { includeNotes: true });
    assertFinalDraftShape(xml);
    assert.equal(xml.match(/<ScriptNote /g).length, 1, 'a blank note is no note');
    assert.match(xml, /<Text>Line one<\/Text>[\s\S]*?<Text>Tom &amp; Jerry &lt;cut&gt;<\/Text>/);
    assert.equal(parseFDX(xml).blocks.find((b) => b.text === 'Rain.').note, 'Line one\nTom & Jerry <cut>');
  });
  it('dual dialogue: a note on either speech goes inside that speech', () => {
    const blocks = [
      { id: 'a', type: 'character', text: 'MARIE' }, { id: 'b', type: 'dialogue', text: 'Go.', note: 'louder' },
      { id: 'c', type: 'character', text: 'THEO', dual: true }, { id: 'd', type: 'dialogue', text: 'Stay.', note: 'whisper' },
    ];
    const xml = toFDX({ blocks }, { includeNotes: true });
    assertFinalDraftShape(xml);
    assert.match(xml, /<DualDialogue>[\s\S]*louder[\s\S]*whisper[\s\S]*<\/DualDialogue>/);
    assert.deepEqual(notesOf(parseFDX(xml).blocks), [['dialogue', 'Go.', 'louder'], ['dialogue', 'Stay.', 'whisper']]);
  });
});
