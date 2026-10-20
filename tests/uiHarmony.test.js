import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeStorage } from './helpers/fakeIndexedDB.js';
import {
  AUTHOR_KEY, CONTACT_KEY, DEFAULT_CONTACT, contactAfterAuthorChange, contactForAuthor, isEricLemaire, newProjectMeta,
} from '../src/lib/authorDefaults.js';
import { emptyStoryDna, normalizeStoryDna } from '../src/lib/storyDna.js';
import { CENTRAL_QUESTION_PREFIX, migrateStoryBible } from '../src/lib/bible.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('Title Page: the contact follows the author', () => {
  it('"Eric Lemaire" in any case or with more around it gets his contact block', () => {
    for (const a of ['Eric Lemaire', 'eric lemaire', 'ERIC LEMAIRE JR.', '  Eric Lemaire & Co.  ']) {
      assert.ok(isEricLemaire(a), a);
      assert.equal(contactForAuthor(a, createFakeStorage()), DEFAULT_CONTACT);
    }
  });
  it('any other author gets a blank contact — personal details never land on someone else’s script', () => {
    for (const a of ['Jane Doe', 'E. Lemaire', 'Lemaire', 'Eric', '']) {
      assert.equal(isEricLemaire(a), false, a);
      assert.equal(contactForAuthor(a, createFakeStorage()), '', a);
    }
    assert.equal(newProjectMeta({ author: 'Jane Doe' }, createFakeStorage()).contact, '');
    assert.equal(newProjectMeta({ author: 'Eric Lemaire' }, createFakeStorage()).contact, DEFAULT_CONTACT);
  });
  it('a writer’s own saved contact comes back only for that same author', () => {
    const storage = createFakeStorage();
    storage.setItem(AUTHOR_KEY, 'Jane Doe');
    storage.setItem(CONTACT_KEY, 'jane@example.com');
    assert.equal(contactForAuthor('jane doe', storage), 'jane@example.com');
    assert.equal(contactForAuthor('John Roe', storage), '');
    assert.equal(contactForAuthor('Eric Lemaire', storage), DEFAULT_CONTACT);
  });
  it('typing the author fills an empty contact, and changing away clears what was only auto-filled', () => {
    const s = createFakeStorage();
    let st = contactAfterAuthorChange({ author: 'Eric Lemaire', contact: '' }, s);
    assert.deepEqual(st, { contact: DEFAULT_CONTACT, contactAuto: DEFAULT_CONTACT });
    st = contactAfterAuthorChange({ author: 'Eric Lemaire Jr.', contact: st.contact, contactAuto: st.contactAuto }, s);
    assert.equal(st.contact, DEFAULT_CONTACT);
    st = contactAfterAuthorChange({ author: 'Jane Doe', contact: st.contact, contactAuto: st.contactAuto }, s);
    assert.deepEqual(st, { contact: '', contactAuto: null });
    assert.deepEqual(contactAfterAuthorChange({ author: 'Jane Doe', contact: '' }, s), { contact: '', contactAuto: null });
  });
  it('never overwrites what the writer typed or cleared themselves', () => {
    const s = createFakeStorage();
    assert.equal(contactAfterAuthorChange({ author: 'Eric Lemaire', contact: 'My agent: K. Moss' }, s).contact, 'My agent: K. Moss');
    assert.equal(contactAfterAuthorChange({ author: 'Eric Lemaire', contact: '', contactTouched: true }, s).contact, '');
    assert.equal(contactAfterAuthorChange({ author: 'Jane', contact: DEFAULT_CONTACT, contactAuto: DEFAULT_CONTACT, contactTouched: true }, s).contact, DEFAULT_CONTACT);
  });
  it('the modal wires it to the Author field and marks the contact as yours once you edit it', () => {
    const modal = read('components/TitlePageModal.jsx');
    assert.match(modal, /contactAfterAuthorChange\(\{\s*author: value, contact: form\.contact, contactAuto: contactState\.auto, contactTouched: contactState\.touched,/);
    assert.match(modal, /if \(key === 'contact'\) setContactState\(\(c\) => \(c\.touched \? c : \{ \.\.\.c, touched: true \}\)\)/);
  });
});

describe('Title Page: font note', () => {
  const modal = read('components/TitlePageModal.jsx');
  it('the Courier Prime reminder is gone', () => {
    assert.ok(!/Title only — the script itself stays Courier Prime 12pt\./.test(modal));
    assert.ok(!/Courier Prime 12pt/.test(modal));
  });
  it('the one-weight alert stays, shown only for fonts without a bold', () => {
    assert.match(modal, /\{!type\.font\.bold && \(\s*<span className="tp-note">\{type\.font\.label\} comes in one weight, so Bold is off\.<\/span>/);
  });
});

describe('Story DNA: no Central Dramatic Question', () => {
  it('not in the Blueprint, not in the data', () => {
    assert.ok(!/Central Dramatic Question|centralQuestion|What core question/i.test(read('components/StoryDna.jsx')));
    assert.ok(!('centralQuestion' in emptyStoryDna()));
    assert.ok(!('centralQuestion' in normalizeStoryDna({ centralQuestion: 'x' })));
  });
  it('Theme is followed directly by Plot Devices', () => {
    const dna = read('components/StoryDna.jsx');
    const theme = dna.indexOf('className="dna-label">Theme');
    const devices = dna.indexOf('<PlotDevices', theme);
    assert.ok(theme > 0 && devices > theme);
    assert.ok(!/<label/.test(dna.slice(dna.indexOf('</label>', theme) + 8, devices)), 'nothing between them');
  });
  it('an answer written before is kept in the Scratchpad note — once', () => {
    const { storyNotes, storyDna } = migrateStoryBible(undefined, { centralQuestion: 'Will Marie turn back?' });
    const pad = storyNotes.sections.find((s) => s.title === 'Scratchpad');
    assert.equal(pad.body, `${CENTRAL_QUESTION_PREFIX}Will Marie turn back?`);
    assert.ok(!('centralQuestion' in storyDna));
    const again = migrateStoryBible(storyNotes, { centralQuestion: 'Will Marie turn back?' });
    assert.equal(again.storyNotes.sections.find((s) => s.title === 'Scratchpad').body, pad.body);
  });
});

describe('Characters drawer', () => {
  const chars = read('components/CharactersDrawer.jsx');
  const tuner = read('components/DialogueTuner.jsx');
  it('Bios: the suggestions header is the MISSING BIOS micro-header', () => {
    assert.match(chars, /<span className="micro-label" id="pb-missing-bios">Missing bios<\/span>/);
    assert.ok(!/In the script without a bio/.test(chars));
    assert.match(read('index.css'), /\.micro-label \{ font-size: 11px; font-weight: 600; letter-spacing: 0\.05em; text-transform: uppercase; color: var\(--text-muted, #9ca3af\); \}/);
  });
  it('one pill look everywhere: genre pills, Dialogue chips, + Name suggestions — interface font, solid border', () => {
    assert.match(read('components/StoryDna.jsx'), /className=\{`pill dna-pill/);
    assert.match(tuner, /className=\{`pill cast-chip/);
    assert.match(chars, /className="pill pb-chip"/);
    for (const f of ['components/DialogueTuner.css', 'components/ProjectBibleDrawer.css']) {
      const css = read(f);
      for (const cls of ['cast-chip', 'pb-chip', 'dna-pill']) {
        const rule = css.match(new RegExp(`\\.${cls} \\{[^}]*\\}`));
        if (rule) assert.ok(!/Courier|dashed|border-radius|padding/.test(rule[0]), `${f} .${cls} doesn't fight .pill`);
      }
    }
  });
  it('Rename from Bios: every named card has its own Rename button', () => {
    assert.match(chars, /className="btn btn-outline pb-char-rename"\s*onClick=\{\(\) => onRename\(name\)\}/);
    assert.match(chars, /<CharacterBios[\s\S]*?onRename=\{onRenameCharacter\}/);
  });
  it('Rename from Dialogue: beside the stats, a standard secondary button', () => {
    assert.match(tuner, /className="btn btn-outline tuner-rename"\s*onClick=\{\(\) => onRename\(current\.name\)\}/);
    assert.match(chars, /<DialogueTuner \{\.\.\.dialogue\}[^>]*onRename=\{onRenameCharacter\}/);
    assert.match(read('App.jsx'), /onRenameCharacter=\{setRenameFrom\}/);
  });
});

describe('Pills: one neutral palette — genre, MISSING BIOS and Dialogue character pills', () => {
  const css = read('index.css');
  const rule = (sel) => css.match(new RegExp(`${sel.replace(/[.()]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
  it('all three use the shared .pill — and none restyles it', () => {
    assert.match(read('components/StoryDna.jsx'), /className=\{`pill dna-pill/);
    assert.match(read('components/CharactersDrawer.jsx'), /className="pill pb-chip"/);
    assert.match(read('components/DialogueTuner.jsx'), /className=\{`pill cast-chip/);
    for (const f of ['components/DialogueTuner.css', 'components/ProjectBibleDrawer.css']) {
      const css = read(f).replace(/\/\*[\s\S]*?\*\//g, ''); // rules, not comments
      assert.ok(!/\.(cast-chip|pb-chip|dna-pill)\b[^{\n]*\{[^}]*\b(color|background|border)\s*:/.test(css), `${f} leaves colours to .pill`);
    }
  });
  it('neutral muted text and border on a faint white fill; interface font, 11.5px, 500 — no slate blues left', () => {
    const r = rule('.pill');
    for (const d of ['color: var(--text-muted, #9ca3af)', 'border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
      'background: rgba(255, 255, 255, 0.04)', 'font-family: var(--ui-font)', 'font-size: 11.5px', 'font-weight: 500']) assert.ok(r.includes(d), d);
    for (const f of ['index.css', 'components/DialogueTuner.css', 'components/ProjectBibleDrawer.css', 'components/CharactersDrawer.jsx']) {
      assert.ok(!/#94a3b8|#64748b|#e2e8f0|148, 163, 184/i.test(read(f)), `${f} has no slate`);
    }
  });
  it('counts inside a pill: 0.6 opacity, the pill’s own colour', () => {
    assert.match(rule('.pill-count'), /opacity: 0\.6; color: inherit;/);
    assert.match(read('components/DialogueTuner.jsx'), /<span className="pill-count cast-count">\{c\.lines\}<\/span>/);
  });
  it('hover: normal text, 25 % white border, a touch more fill', () => {
    assert.match(rule('.pill:hover:not(.is-on, .is-selected)'), /color: var\(--text-normal, #e5e7eb\); border: 1px solid rgba\(255, 255, 255, 0\.25\); background: rgba\(255, 255, 255, 0\.07\);/);
  });
  it('selected: accent fill, white text, transparent border', () => {
    assert.match(css, /\.pill\.is-on,\s*\.pill\.is-selected \{ background: var\(--accent, #d9532f\); color: #ffffff;[^}]*border-color: transparent;/);
  });
});

