import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeIndexedDB } from './helpers/fakeIndexedDB.js';
import {
  BACKUP_EXT, BACKUP_FORMAT, BACKUP_VERSION, backupFileName, createBackup, isBackupFile, mergeBackupDictionary,
  parseBackup, serializeBackup,
} from '../src/lib/backup.js';
import { createProjectStore, toDoc } from '../src/lib/projectStorage.js';
import { defaultStoryNotes } from '../src/lib/bible.js';
import { emptyStoryDna } from '../src/lib/storyDna.js';

const newStore = (t = 1000) => createProjectStore({ indexedDB: createFakeIndexedDB(), now: () => t });

/** A project with something in every part: formatting, notes, dual dialogue, board, Bible. */
function richDoc() {
  const storyNotes = defaultStoryNotes();
  storyNotes.sections[0].body = 'A president, a palace, one long night.';
  const storyDna = { ...emptyStoryDna(), genres: ['Drama', 'Thriller', 'Other'], genreOther: 'Political drama', theme: 'Power eats its own' };
  storyDna.answers.protagonist = 'President Moïse';
  storyDna.flashback = { on: true, notes: 'The 2016 election night' };
  return {
    meta: {
      title: 'What Happened to Haiti?', credit: 'Written by', author: 'Eric Lemaire', basedOn: '',
      draftVersion: 'Sixth & Final Draft', draftDate: 'October 19, 2026', contact: 'Eric Lemaire\nelemaire86@gmail.com',
      titleFont: 'playfair-display', titleSize: 40, titleBold: false,
    },
    blocks: [
      { id: 's1', type: 'scene', text: 'INT. NATIONAL PALACE - NIGHT', note: 'Check the palace floor plan' },
      { id: 'f1', type: 'format_cue', text: 'SUPER: PORT-AU-PRINCE, 2021' },
      { id: 'a1', type: 'action', text: 'FITO (10)--copper skin, bare feet--darts past the guards.', marks: { i: [[0, 4]], b: [[11, 22]] } },
      { id: 'c1', type: 'character', text: "PRESIDENT MOÏSE (CONT'D)" },
      { id: 'p1', type: 'parenthetical', text: '(quietly)' },
      { id: 'd1', type: 'dialogue', text: "Here's where I have a problem...", marks: { u: [[0, 6]] } },
      { id: 'c2', type: 'character', text: 'PATRICK (O.S.)', dual: true },
      { id: 'd2', type: 'dialogue', text: '--Mr. President.' },
      { id: 's2', type: 'scene', text: 'EXT. PÉTION-VILLE - DAWN' },
      { id: 't1', type: 'transition', text: 'FADE OUT.' },
      { id: 'e1', type: 'centered', text: 'THE END' },
    ],
    beats: [
      { id: 'b1', act: 0, title: 'The palace at night', synopsis: 'Moïse alone.', tag: 'plot', sceneId: 's1' },
      { id: 'b3', act: 2, title: 'Fito runs', synopsis: '', tag: 'character' },
      { id: 'b2', act: 1, title: 'Midpoint', synopsis: 'The call.', tag: 'subplot' },
      { id: 'b4', act: 3, title: 'Dawn', synopsis: '', tag: 'theme', sceneId: 's2' },
    ],
    characters: [
      { id: 'ch1', name: 'Jovenel Moïse', role: 'Protagonist', age: '53', traits: 'Proud', backstory: 'Banana exporter.' },
      { id: 'ch2', name: 'Fito', role: 'Witness', age: '10', traits: '', backstory: '' },
    ],
    storyNotes,
    storyDna,
  };
}

const withoutStamp = ({ updatedAt: _u, ...rest }) => rest; // eslint-disable-line no-unused-vars

describe('.draftline backup: file format', () => {
  it('names files after the title, with the .draftline extension', () => {
    assert.equal(BACKUP_EXT, '.draftline');
    assert.equal(backupFileName('What Happened to Haiti?'), 'What-Happened-to-Haiti.draftline');
    assert.equal(backupFileName('Run!'), 'Run.draftline');
    assert.equal(backupFileName('  '), 'Untitled.draftline');
    assert.ok(isBackupFile('Run.DRAFTLINE'));
    assert.ok(!isBackupFile('Run.fountain'));
  });

  it('wraps the full stored record with format, version, app, time, board view and dictionary', async () => {
    const rec = await newStore().saveActiveProject(richDoc());
    const b = createBackup(rec, { actMode: 3, dictionary: { climax: { definition: 'Mine.' } }, appVersion: '0.11.0', now: new Date(Date.UTC(2026, 9, 19)) });
    assert.equal(b.format, BACKUP_FORMAT);
    assert.equal(b.version, BACKUP_VERSION);
    assert.equal(b.app, 'DraftLine 0.11.0');
    assert.equal(b.exportedAt, '2026-10-19T00:00:00.000Z');
    assert.deepEqual(b.project, JSON.parse(JSON.stringify(rec)));
    assert.deepEqual(b.board, { actMode: 3 });
    assert.deepEqual(b.dictionary, { climax: { definition: 'Mine.' } });
    // Every part of the project is in the file.
    for (const k of ['script', 'beats', 'characters', 'storyNotes', 'storyDna', 'titleFont', 'titleSize', 'titleBold', 'contact']) {
      assert.ok(k in b.project, k);
    }
  });
});

describe('.draftline backup: round trip with zero data loss', () => {
  it('parse(serialize(record)) gives back the identical record', async () => {
    const rec = await newStore().saveActiveProject(richDoc());
    rec.someFutureField = { kept: true }; // fields DraftLine doesn't know yet survive too
    const parsed = parseBackup(serializeBackup(rec, { actMode: 4 }));
    assert.deepEqual(parsed.record, rec);
    assert.equal(parsed.actMode, 4);
  });

  it('restoring into an empty library (another browser) reproduces the project exactly', async () => {
    const original = await newStore().saveActiveProject(richDoc());
    const file = serializeBackup(original, { actMode: 3 });

    const other = newStore(5000);
    const { record, newId } = await other.restoreProject(parseBackup(file).record);
    assert.equal(newId, false);
    assert.equal(record.id, original.id);
    const stored = await other.getProject(original.id);
    assert.deepEqual(withoutStamp(stored), withoutStamp(original));
    assert.equal(stored.createdAt, original.createdAt);

    // What the editor loads: script (marks, notes, dual), title page typography, board, Bible.
    const a = toDoc(original);
    const b = toDoc(stored);
    assert.deepEqual(b.blocks, a.blocks);
    assert.deepEqual(b.meta, a.meta);
    assert.equal(b.meta.titleFont, 'playfair-display');
    assert.equal(b.meta.titleSize, 40);
    assert.equal(b.meta.titleBold, false);
    // The backup's single-tag cards (pre-multi-tag) open as tag lists.
    assert.deepEqual(b.beats.map((x) => [x.id, x.act, x.tags, x.sceneId]), [
      ['b1', 0, ['plot'], 's1'], ['b3', 2, ['character'], undefined], ['b2', 1, ['subplot'], undefined], ['b4', 3, ['theme'], 's2'],
    ], 'card order, columns / Act 2 lanes, colour tags and scene links');
    assert.deepEqual(b.characters, a.characters);
    assert.deepEqual(b.storyNotes, a.storyNotes);
    assert.deepEqual(b.storyDna, a.storyDna);
    assert.equal(b.storyDna.genreOther, 'Political drama');
  });

  it('never overwrites: a backup of a project already in the library comes in beside it', async () => {
    const store = newStore();
    const original = await store.saveActiveProject(richDoc());
    const file = serializeBackup(original);
    await store.saveActiveProject({ ...toDoc(original), meta: { ...toDoc(original).meta, title: 'Edited since' } });

    const { record, newId } = await store.restoreProject(parseBackup(file).record);
    assert.equal(newId, true);
    assert.notEqual(record.id, original.id);
    assert.equal((await store.getProject(original.id)).title, 'Edited since', 'the existing project is untouched');
    assert.equal(record.title, 'What Happened to Haiti?');
    assert.deepEqual(toDoc(record).blocks, toDoc(original).blocks);
    assert.equal((await store.getAllProjects())[0].id, record.id, 'the restored copy is newest in Projects');
  });
});

describe('.draftline backup: bad files', () => {
  it('explains what is wrong instead of loading anything', () => {
    assert.throws(() => parseBackup('not json'), /damaged/);
    assert.throws(() => parseBackup('{"format":"something-else","project":{}}'), /isn’t a DraftLine backup/);
    assert.throws(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, project: { script: [] } })), /newer DraftLine/);
    assert.throws(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, project: { script: [{ type: 'nope' }] } })), /script is damaged/);
    const ok = { id: 'x', type: 'action', text: 'Hi.' };
    assert.throws(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, project: { script: [ok], beats: [{ id: 'b', act: 9 }] } })), /Beat Board is damaged/);
  });
  it('reads a byte-order mark and a minimal file', () => {
    const p = parseBackup(`\uFEFF${JSON.stringify({ format: BACKUP_FORMAT, version: 1, project: { script: [{ id: 'x', type: 'action', text: 'Hi.' }] } })}`);
    assert.equal(p.record.script[0].text, 'Hi.');
    assert.equal(p.actMode, null);
    assert.deepEqual(p.dictionary, {});
  });
});

describe('.draftline backup: Structure Dictionary wording', () => {
  it('adds only the terms you have no wording for — yours always win', () => {
    const { dictionary, added } = mergeBackupDictionary(
      { climax: { definition: 'Mine.' } },
      { climax: { definition: 'From the backup.' }, flaw: { definition: 'Backup flaw.' } },
    );
    assert.equal(added, 1);
    assert.deepEqual(dictionary, { climax: { definition: 'Mine.' }, flaw: { definition: 'Backup flaw.' } });
  });
});
