import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALL_SECTIONS, BIBLE_SECTIONS, DOSSIER_LABEL, anySelected, bibleExportPayload, exportBible, isExportableNote, bibleFileTitle, bibleHtml, bibleSectionSummary, hasBio, textHtml,
} from '../src/lib/biblePdfExport.js';
import { defaultStoryNotes } from '../src/lib/bible.js';
import { printDocument } from '../src/lib/printTitle.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

function project() {
  const storyNotes = { ...defaultStoryNotes(),
    synopsis: { act1: 'Marie runs.', act2: 'The storm rises.', act2b: 'A BMW, a hit and run: Carlo.', act3: 'Home.' },
    treatment: { act1: 'Sequence one.', act2: 'Sequence two.', act2b: 'Sequence three.', act3: 'Sequence four.' } };
  storyNotes.sections.find((s) => s.title === 'Logline').body = 'A woman races a storm home.';
  storyNotes.sections.find((s) => s.title === 'Scratchpad').body = 'private mess';
  storyNotes.sections.find((s) => s.title === 'Tone').body = 'Humid, tense.';
  storyNotes.sections.find((s) => s.title === 'Pitch').body = 'Titanic meets Jacmel.';
  storyNotes.sections.find((s) => s.title === 'Timeline').body = '1986 — the ferry.';
  storyNotes.sections.push(
    { id: 'q', title: 'Questions on Inciting Incident', body: 'Why the ferry?' },
    { id: 'n1', title: 'Note: Haiti 1986', body: 'Curfew at dusk.' },
    { id: 'r', title: 'Research prompts', body: 'Ferry routes' },
    { id: 'n2', title: 'Director’s notes', body: 'Handheld.' },
  );
  return {
    meta: { title: 'The Last Ferry', author: 'Chilli Palmer' },
    storyDna: {
      genres: ['Drama', 'Other'], genreOther: 'Political', theme: 'Home is a choice', conflictType: 'Individual vs. Nature',
      answers: { protagonist: 'Marie Cineus', climax: 'She turns the ferry around.' },
      devices: [{ id: 'foreshadowing', on: true, notes: 'The letter' }, { id: 'flashback', on: false, notes: '' }],
    },
    storyNotes,
    characters: [
      { id: 'c1', name: 'MARIE', primaryRole: 'protagonist', secondaryRole: 'none', age: '30s', backstory: 'Left Haiti at ten.' },
      { id: 'c2', name: 'THEO', primaryRole: '', secondaryRole: 'foil', relationship: 'Her brother' },
      { id: 'c3', name: 'EXTRA' }, // a name only: no bio
    ],
    actMode: 4,
  };
}
const ids = (p) => p.sections.map((s) => s.id);

describe('Story Bible export: the toggles decide what’s in the payload', () => {
  it('three sections, all on by default', () => {
    assert.deepEqual(BIBLE_SECTIONS.map((s) => s.id), ['dna', 'notes', 'characters']);
    assert.deepEqual(ALL_SECTIONS, { dna: true, notes: true, characters: true });
    assert.deepEqual(ids(bibleExportPayload(project())), ['dna', 'notes', 'characters']);
  });
  it('every combination of 1, 2 or 3 sections — unchecked ones are left out entirely', () => {
    for (let mask = 1; mask < 8; mask += 1) {
      const sel = { dna: !!(mask & 1), notes: !!(mask & 2), characters: !!(mask & 4) };
      const p = bibleExportPayload(project(), sel);
      assert.deepEqual(ids(p), BIBLE_SECTIONS.map((s) => s.id).filter((id) => sel[id]), JSON.stringify(sel));
      const html = bibleHtml(p);
      assert.equal(html.includes('<section class="module" id="dna">'), sel.dna);
      assert.equal(html.includes('Home is a choice'), sel.dna, 'DNA text only when DNA is on');
      assert.equal(html.includes('A woman races a storm home.'), sel.notes, 'Notes text only when Notes is on');
      assert.equal(html.includes('Left Haiti at ten.'), sel.characters, 'bios only when Characters is on');
    }
  });
  it('none selected: nothing to export (the dialog’s button is disabled)', () => {
    assert.equal(anySelected({ dna: false, notes: false, characters: false }), false);
    assert.equal(anySelected({ notes: true }), true);
    assert.deepEqual(bibleExportPayload(project(), {}).sections, []);
    const ui = read('components/ExportBibleModal.jsx');
    assert.match(ui, /const ok = anySelected\(sel\);/);
    assert.match(ui, /<button type="submit" className="btn btn-primary eb-export" disabled=\{!ok\}>Export PDF<\/button>/);
    assert.match(ui, /<button type="button" className="btn eb-cancel" onClick=\{onClose\}>Cancel<\/button>/);
    assert.match(ui, /const \[sel, setSel\] = useState\(ALL_SECTIONS\);/, 'all checked to start');
  });
});

describe('Story Bible export: what each section holds', () => {
  const p = bibleExportPayload(project());
  const [dna, notes, chars] = p.sections;
  it('cover: title, author, the dossier label; file title "<Title> - Story Bible"', () => {
    assert.deepEqual([p.title, p.author, p.label], ['The Last Ferry', 'Chilli Palmer', 'STORY BIBLE & PROJECT DOSSIER']);
    assert.equal(DOSSIER_LABEL, 'STORY BIBLE & PROJECT DOSSIER');
    assert.equal(p.docTitle, 'The Last Ferry - Story Bible');
    assert.equal(bibleFileTitle(''), 'Untitled - Story Bible');
    const html = bibleHtml(p);
    assert.match(html, /<title>The Last Ferry - Story Bible<\/title>/);
    assert.match(html, /<div class="cover-label">STORY BIBLE &amp; PROJECT DOSSIER<\/div>\s*<h1>The Last Ferry<\/h1>\s*<div class="byline">by Chilli Palmer<\/div>/);
  });
  it('DNA: genres (with Other spelled out), theme, conflict, devices in use, then beats 1–8', () => {
    assert.deepEqual(dna.meta, [
      { label: 'Genre', value: 'Drama · Political' }, { label: 'Theme', value: 'Home is a choice' }, { label: 'Conflict', value: 'Individual vs. Nature' }]);
    assert.deepEqual(dna.devices, [{ label: 'Foreshadowing', on: true, notes: 'The letter' }], 'a "No" device with no notes is left out');
    assert.deepEqual(dna.beats.map((b) => b.n), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(dna.beats[0].text, 'Marie Cineus');
    assert.match(bibleHtml(p), /<span class="beat-n">1<\/span>Protagonist/);
  });
  it('Notes: Logline · Tone · Pitch · Timeline · Synopsis · Treatment (4-act split), then only “Note” cards — never the Scratchpad', () => {
    assert.equal(notes.logline, 'A woman races a storm home.');
    assert.deepEqual(notes.cards.map((c) => c.title), ['Tone', 'Pitch', 'Timeline'], 'Tone and Pitch before Timeline');
    const html = bibleHtml(p);
    const at = (t) => html.indexOf(t);
    const order = ['A woman races a storm home.', 'Humid, tense.', 'Titanic meets Jacmel.', '1986 — the ferry.', '<h3>Synopsis</h3>', '<h3>Treatment</h3>', 'Curfew at dusk.'];
    order.forEach((t, i) => { assert.ok(at(t) >= 0, t); if (i) assert.ok(at(order[i - 1]) < at(t), `${order[i - 1]} before ${t}`); });
    assert.ok(at('<section class="module" id="dna">') < at('<section class="module" id="notes">'), 'right after Story DNA');
    for (const gone of ['Why the ferry?', 'Ferry routes', 'private mess']) assert.ok(!html.includes(gone), gone);
    assert.deepEqual(notes.synopsis.map((a) => a.text), ['Marie runs.', 'The storm rises.', 'A BMW, a hit and run: Carlo.', 'Home.']);
    assert.deepEqual(notes.treatment.map((a) => a.label), ['ACT 1: SETUP', 'ACT 2A: ESCALATION TO MIDPOINT', 'ACT 2B: FALL & CRISIS', 'ACT 3: CLIMAX & RESOLUTION']);
    assert.deepEqual(notes.others, [{ title: 'Note: Haiti 1986', body: 'Curfew at dusk.' }, { title: 'Director’s notes', body: 'Handheld.' }]);
    for (const t of ['Note: Haiti', 'Note - draft 2', 'Note Revisions', 'NOTES']) assert.ok(isExportableNote(t), t);
    for (const t of ['Questions on Inciting Incident', 'Research', 'Brainstorm', 'Scratchpad', 'Scratchpad notes']) assert.equal(isExportableNote(t), false, t);
    const three = bibleExportPayload({ ...project(), actMode: 3 }).sections[1];
    assert.ok(three.treatment.every((a) => !/2A|2B/.test(a.label)), '3 acts when the project is in 3 acts');
  });
  it('Characters: only those with a bio — name, role, age, relationship, description / traits / backstory & arc', () => {
    assert.equal(hasBio({ name: 'EXTRA' }), false);
    assert.equal(hasBio({ name: 'THEO', secondaryRole: 'foil' }), true);
    assert.equal(hasBio({ name: '', backstory: 'x' }), false);
    assert.deepEqual(chars.characters.map((c) => c.name), ['MARIE', 'THEO']);
    assert.deepEqual(chars.characters[0], { name: 'MARIE', role: 'Protagonist', age: '30s', gender: '', relationship: '', fields: [{ label: 'Backstory / Motivation & Arc', text: 'Left Haiti at ten.' }] });
    assert.equal(chars.characters[1].role, '(Foil)');
  });
  it('the dialog’s summary of each section', () => {
    assert.deepEqual(bibleSectionSummary(project()), {
      dna: '2 of 8 beats answered · Genre, Theme, Conflict',
      notes: 'Logline · Tone · Pitch · Timeline · Synopsis · Treatment (4 acts) · 2 notes',
      characters: '2 characters with a bio',
    });
  });
});

describe('Story Bible export: the document and printing', () => {
  it('print layout: Letter portrait; each module on a new page; headings and beats never split', () => {
    const html = bibleHtml(bibleExportPayload(project()));
    assert.match(html, /@page \{ size: letter portrait;/);
    assert.match(html, /section\.module \+ section\.module \{ break-before: page; page-break-before: always; \}/);
    assert.match(html, /h3 \{[^}]*break-after: avoid;/);
    assert.match(html, /\.beat \{[^}]*break-inside: avoid;/);
    assert.match(html, /\.character \{[^}]*break-inside: avoid;/);
  });
  it('text is escaped; light Markdown becomes paragraphs, lists and bold', () => {
    assert.equal(textHtml('One <b>\n\nTwo **bold**'), '<p>One &lt;b&gt;</p>\n<p>Two <strong>bold</strong></p>');
    assert.equal(textHtml('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
    const html = bibleHtml(bibleExportPayload({ meta: { title: '<script>x</script>' } }, { notes: true }));
    assert.ok(!html.includes('<script>x'));
  });
  it('printDocument: its own window titled for the PDF name; falls back to a frame if popups are blocked', () => {
    const written = [];
    const popup = { document: { readyState: 'complete', open() {}, write: (h) => written.push(h), close() {}, title: '' }, focus() {}, print() {}, close() {}, addEventListener() {} };
    assert.equal(printDocument({ html: '<p>x</p>', title: 'T - Story Bible', win: { open: () => popup } }), 'window');
    assert.equal(popup.document.title, 'T - Story Bible');
    assert.deepEqual(written, ['<p>x</p>']);
    const appended = [];
    const win = { open: () => null, document: { title: 'App', createElement: () => ({ setAttribute() {}, style: {} }), body: { appendChild: (f) => appended.push(f) } } };
    assert.equal(printDocument({ html: '<p>x</p>', title: 'T - Story Bible', win }), 'frame');
    assert.equal(appended[0].srcdoc, '<p>x</p>');
  });
  it('Export PDF prints exactly the chosen sections, titled "<Title> - Story Bible"', () => {
    const calls = [];
    exportBible(project(), { characters: true }, (x) => calls.push(x));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].title, 'The Last Ferry - Story Bible');
    assert.ok(calls[0].html.includes('id="characters"') && !calls[0].html.includes('id="dna"') && !calls[0].html.includes('id="notes"'));
  });
  it('the app: File ▸ Export Outline & Bible ▸ "Story Bible" (.pdf) opens the dialog (loaded on first use)', () => {
    const app = read('App.jsx');
    assert.match(read('lib/toolbar.js'), /\{ label: 'Story Bible', ext: '\.pdf', onSelect: onBible,/);
    assert.match(app, /onBible: \(\) => setBibleExportOpen\(true\),/);
    assert.match(app, /const ExportBibleModal = lazy\(\(\) => import\('\.\/components\/ExportBibleModal\.jsx'\)\);/);
    assert.match(app, /<ExportBibleModal project=\{\{ meta, storyDna, storyNotes, characters, actMode \}\} onClose=\{\(\) => setBibleExportOpen\(false\)\} \/>/);
    const ui = read('components/ExportBibleModal.jsx');
    assert.match(ui, /if \(!ok\) return;\s*onClose\(\);\s*exportBible\(project, sel\);/);
  });
});
