import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeIndexedDB, createFakeStorage } from './helpers/fakeIndexedDB.js';
import {
  AUTHOR_KEY, CONTACT_KEY, DEFAULT_AUTHOR, DEFAULT_CONTACT, authorDefaults, newProjectMeta, rememberAuthorDefaults, titlePageSeed,
} from '../src/lib/authorDefaults.js';
import { EMPTY_META, createProjectStore, toDoc } from '../src/lib/projectStorage.js';

const CONTACT = 'Eric Lemaire\n339-545-0929 (Mobile)\n617-549-5955 (WhatsApp)\nelemaire86@gmail.com';

describe('author & contact defaults', () => {
  it('are Eric Lemaire and his four-line contact block', () => {
    assert.equal(DEFAULT_AUTHOR, 'Eric Lemaire');
    assert.equal(DEFAULT_CONTACT, CONTACT);
    assert.equal(AUTHOR_KEY, 'draftline_user_author');
    assert.equal(CONTACT_KEY, 'draftline_user_contact');
  });

  it('fill a new project when nothing is remembered (or storage is missing / empty / blocked)', () => {
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    const empty = createFakeStorage();
    empty.setItem(AUTHOR_KEY, '  ');
    for (const storage of [createFakeStorage(), null, empty, blocked]) {
      assert.deepEqual(authorDefaults(storage), { author: DEFAULT_AUTHOR, contact: CONTACT });
      const m = newProjectMeta({ title: 'Run!' }, storage);
      assert.equal(m.title, 'Run!');
      assert.equal(m.author, DEFAULT_AUTHOR);
      assert.equal(m.contact, CONTACT);
    }
    assert.equal(rememberAuthorDefaults({ author: 'X', contact: 'Y' }, blocked), false);
  });

  it('remember what the Title Page saved, and use it for the next new project', () => {
    const storage = createFakeStorage();
    assert.ok(rememberAuthorDefaults({ author: 'E. Lemaire Jr.', contact: 'Agent: K. Moss\nkmoss@example.com' }, storage));
    assert.equal(storage.getItem(AUTHOR_KEY), 'E. Lemaire Jr.');
    assert.equal(storage.getItem(CONTACT_KEY), 'Agent: K. Moss\nkmoss@example.com');
    assert.deepEqual(authorDefaults(storage), { author: 'E. Lemaire Jr.', contact: 'Agent: K. Moss\nkmoss@example.com' });
    // A cleared field is saved as cleared, and the next new project falls back to the default.
    rememberAuthorDefaults({ author: '', contact: 'Only contact' }, storage);
    assert.deepEqual(authorDefaults(storage), { author: DEFAULT_AUTHOR, contact: 'Only contact' });
  });

  it('stay editable: an explicit author or contact — even an empty one — wins over the defaults', () => {
    const storage = createFakeStorage();
    assert.equal(newProjectMeta({ author: 'Co-writer' }, storage).author, 'Co-writer');
    const cleared = newProjectMeta({ author: '', contact: '' }, storage);
    assert.equal(cleared.author, '');
    assert.equal(cleared.contact, '');
  });

  it('new projects in the library start with them', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB(), now: () => 1 });
    const storage = createFakeStorage();
    const rec = await store.createProject({ title: 'New One', storage });
    assert.equal(rec.author, DEFAULT_AUTHOR);
    assert.equal(rec.contact, CONTACT);
    rememberAuthorDefaults({ author: 'Saved Name', contact: 'saved@example.com' }, storage);
    const next = toDoc(await store.createProject({ title: 'Next', storage }));
    assert.equal(next.meta.author, 'Saved Name');
    assert.equal(next.meta.contact, 'saved@example.com');
    // Still a normal, editable field afterwards.
    const edited = await store.saveActiveProject({ ...next, meta: { ...next.meta, author: '' } });
    assert.equal(edited.author, '');
  });

  it('never overwrite an existing or imported script’s title page', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB(), now: () => 1 });
    const imported = { meta: { ...EMPTY_META, title: 'What Happened to Haiti?', author: 'Someone Else', contact: 'agent@example.com' }, blocks: [], beats: [] };
    const rec = await store.saveActiveProject({ ...imported, blocks: [{ id: 'b1', type: 'scene', text: 'INT. PALACE - NIGHT' }] });
    const back = toDoc(await store.getProject(rec.id));
    assert.equal(back.meta.author, 'Someone Else');
    assert.equal(back.meta.contact, 'agent@example.com');
    // Title Page form for that script: shown as is.
    assert.deepEqual(titlePageSeed(back.meta, createFakeStorage()), { meta: back.meta, suggested: false });
    // Only one of the two set? Still left alone — nothing is mixed in.
    for (const m of [{ author: 'Just Author', contact: '' }, { author: '', contact: 'just@contact.com' }]) {
      assert.equal(titlePageSeed(m, createFakeStorage()).suggested, false);
      assert.deepEqual(titlePageSeed(m, createFakeStorage()).meta, m);
    }
  });

  it('suggest themselves in the Title Page form only when the script has neither', () => {
    const seed = titlePageSeed({ ...EMPTY_META, title: 'Run!' }, createFakeStorage());
    assert.equal(seed.suggested, true);
    assert.equal(seed.meta.author, DEFAULT_AUTHOR);
    assert.equal(seed.meta.contact, CONTACT);
    assert.equal(seed.meta.title, 'Run!');
  });
});
