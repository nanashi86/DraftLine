import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isUntitled, projectUntouched, scriptIsBlank } from '../src/lib/blankScript.js';
import { defaultStoryNotes } from '../src/lib/bible.js';
import { normalizeStoryDna } from '../src/lib/storyDna.js';
import { normalizeProduction } from '../src/lib/productionData.js';
import { SAMPLE_SCRIPT, SAMPLE_STORY_NOTES, sampleEarlierDraft } from '../src/lib/sampleScript.js';

const b = (type, text = '') => ({ id: `${type}${text}`, type, text });
const blank = () => ({
  meta: { title: 'Untitled' }, blocks: [b('scene')], beats: [], characters: [],
  storyNotes: defaultStoryNotes(), storyDna: normalizeStoryDna(undefined), production: normalizeProduction(undefined),
});

describe('blank scripts: a first visit’s empty page', () => {
  it('a script is blank while no element has any text', () => {
    assert.equal(scriptIsBlank([b('scene'), b('action', '   ')]), true);
    assert.equal(scriptIsBlank([]), true);
    assert.equal(scriptIsBlank([b('scene', 'INT.')]), false);
  });
  it('untitled means no title, or the "Untitled" a new script starts with', () => {
    assert.equal(isUntitled(''), true);
    assert.equal(isUntitled(' Untitled '), true);
    assert.equal(isUntitled('Night Crossing'), false);
  });
  it('a project is untouched only when nothing anywhere is the writer’s: the sample may replace it', () => {
    assert.equal(projectUntouched(blank()), true, 'a brand-new page, with its empty Bible and Plan');
    assert.equal(projectUntouched({ ...blank(), meta: { title: 'Night Crossing' } }), false, 'named');
    assert.equal(projectUntouched({ ...blank(), blocks: [b('scene', 'EXT. PIER')] }), false, 'one line written');
    assert.equal(projectUntouched({ ...blank(), beats: [{ id: 'k' }] }), false, 'a card on the board');
    assert.equal(projectUntouched({ ...blank(), characters: [{ id: 'c', name: 'MARIE' }] }), false, 'a bio');
    const notes = defaultStoryNotes();
    notes.sections[0].body = 'A ferry, a storm.';
    assert.equal(projectUntouched({ ...blank(), storyNotes: notes }), false, 'a logline in the Story Bible');
    assert.equal(projectUntouched({ ...blank(), storyDna: { ...normalizeStoryDna(undefined), theme: 'Leaving' } }), false, 'a theme');
  });
  it('the app: replaces only an untouched, unlocked project, and only after the sample is safely open', () => {
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /const replace = !projectLocked && projectUntouched\(s\);\s*await openAsNewProject\(sampleDoc\(\)/);
    assert.match(app, /if \(!replace\) return;\s*await projects\.deleteProject\(s\.projectId\)/);
  });
});

describe('the sample: The Last Ferry', () => {
  it('a first draft, author and contact left empty: Chili Palmer shows faintly, never stored or remembered', () => {
    assert.equal(SAMPLE_SCRIPT.meta.draftVersion, 'First Draft');
    assert.equal(SAMPLE_SCRIPT.meta.author, '');
    assert.equal(SAMPLE_SCRIPT.meta.contact, '');
  });
  it('a Story Bible written for it: logline, tone and a synopsis for every act', () => {
    const body = Object.fromEntries(SAMPLE_STORY_NOTES.sections.map((s) => [s.title, s.body]));
    assert.match(body.Logline, /last ferry/);
    assert.ok(body.Tone);
    for (const act of ['act1', 'act2', 'act2b', 'act3']) assert.ok(SAMPLE_STORY_NOTES.synopsis[act], act);
    assert.deepEqual(SAMPLE_STORY_NOTES.sections.map((s) => s.title), defaultStoryNotes().sections.map((s) => s.title), 'the standard sections, in order');
  });
  it('an earlier draft to compare: no loudspeaker V.O. yet, and a different last beat', () => {
    const earlier = sampleEarlierDraft();
    assert.ok(!earlier.some(([, text]) => text === 'AUGUSTIN (V.O.)'));
    assert.equal(SAMPLE_SCRIPT.blocks.length - earlier.length, 3);
    assert.ok(earlier.some(([, text]) => /ferry begins to turn/.test(text)));
    assert.ok(!earlier.some(([, text]) => /father's laugh/.test(text)));
  });
  it('the app opens it with its cards, Bible and that snapshot', () => {
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /revisions: \[createRevision\(earlier, \{ label: SAMPLE_EARLIER_LABEL/);
    assert.match(app, /storyNotes,\s*revisions:/);
  });
});
