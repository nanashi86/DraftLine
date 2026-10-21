import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeStorage } from './helpers/fakeIndexedDB.js';
import {
  AUTHOR_KEY, AUTHOR_PLACEHOLDER, CHILLI_CONTACT, CONTACT_KEY, CONTACT_PLACEHOLDER, ERIC_CONTACT, contactAfterAuthorChange, contactForAuthor, isEricLemaire, newProjectMeta,
} from '../src/lib/authorDefaults.js';
import { emptyStoryDna, normalizeStoryDna } from '../src/lib/storyDna.js';
import { CENTRAL_QUESTION_PREFIX, migrateStoryBible } from '../src/lib/bible.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('Title Page: the contact follows the author', () => {
  it('the two blocks, exactly', () => {
    assert.equal(CHILLI_CONTACT, 'Chilli Palmer\n555-012-3456\ngetshorty@palmerfilms.com');
    assert.equal(ERIC_CONTACT, 'Eric Lemaire\n339-545-0929 (Mobile)\n617-549-5955 (WhatsApp)\nelemaire86@gmail.com');
    assert.equal(CONTACT_PLACEHOLDER, CHILLI_CONTACT);
  });
  it('"eric lemaire" / "eric lemaire jr." exactly (any case, outer spaces ignored) — nothing looser', () => {
    for (const a of ['Eric Lemaire', 'eric lemaire', 'ERIC LEMAIRE JR.', '  Eric Lemaire  ']) {
      assert.ok(isEricLemaire(a), a);
      assert.equal(contactForAuthor(a, createFakeStorage()), ERIC_CONTACT);
    }
    for (const a of ['Eric Lemaire & Co.', 'By Eric Lemaire', 'Eric Lemaire Jr', 'Jane Doe', 'E. Lemaire', 'Eric', '']) assert.equal(isEricLemaire(a), false, a);
  });
  it('any other author gets a blank contact — personal details never land on someone else’s script', () => {
    for (const a of ['Jane Doe', 'Eric Lemaire & Co.', '']) assert.equal(contactForAuthor(a, createFakeStorage()), '', a);
    assert.equal(newProjectMeta({ author: 'Jane Doe' }, createFakeStorage()).contact, '');
    assert.equal(newProjectMeta({ author: 'Eric Lemaire' }, createFakeStorage()).contact, ERIC_CONTACT);
    assert.equal(contactForAuthor(AUTHOR_PLACEHOLDER, createFakeStorage()), '', 'typing Chilli Palmer fills nothing: his block is a placeholder');
  });
  it('a writer’s own saved contact comes back only for that same author', () => {
    const storage = createFakeStorage();
    storage.setItem(AUTHOR_KEY, 'Jane Doe');
    storage.setItem(CONTACT_KEY, 'jane@example.com');
    assert.equal(contactForAuthor('jane doe', storage), 'jane@example.com');
    assert.equal(contactForAuthor('John Roe', storage), '');
    assert.equal(contactForAuthor('Eric Lemaire', storage), ERIC_CONTACT);
  });
  it('atomic: Eric’s name replaces the whole contact with ERIC_CONTACT, whatever was there — never merged', () => {
    const s = createFakeStorage();
    const blended = 'Chilli Palmer\n339-545-0929 (Mobile)\ngetshorty@palmerfilms.com';
    for (const contact of ['', CHILLI_CONTACT, 'My agent: K. Moss', blended, `${CHILLI_CONTACT}\n${ERIC_CONTACT}`]) {
      for (const contactTouched of [false, true]) {
        for (const author of ['Eric Lemaire', 'eric lemaire jr.']) {
          assert.deepEqual(contactAfterAuthorChange({ author, contact, contactTouched }, s), { contact: ERIC_CONTACT, contactAuto: ERIC_CONTACT });
        }
      }
    }
  });
  it('clearing the author resets the contact to "" (the Chilli Palmer placeholder shows again), whatever was there', () => {
    const s = createFakeStorage();
    for (const author of ['', '   ']) {
      for (const contact of ['', ERIC_CONTACT, 'Something typed', `${ERIC_CONTACT}\nextra`]) {
        for (const contactTouched of [false, true]) {
          assert.deepEqual(contactAfterAuthorChange({ author, contact, contactTouched }, s), { contact: '', contactAuto: null });
        }
      }
    }
  });
  it('Eric ⇄ cleared round trips: always exactly ERIC_CONTACT or "" — never blended', () => {
    const s = createFakeStorage();
    let st = { contact: '', contactAuto: null };
    for (const [author, want] of [['Eric Lemaire', ERIC_CONTACT], ['', ''], ['eric lemaire jr.', ERIC_CONTACT], ['  ', ''], ['Eric Lemaire', ERIC_CONTACT]]) {
      st = contactAfterAuthorChange({ author, ...st }, s);
      assert.equal(st.contact, want, author);
    }
  });
  it('any other author: what the form filled in is cleared; what the writer typed stays exactly', () => {
    const s = createFakeStorage();
    let st = contactAfterAuthorChange({ author: 'Eric Lemaire', contact: '' }, s);
    st = contactAfterAuthorChange({ author: 'Jane Doe', contact: st.contact, contactAuto: st.contactAuto }, s);
    assert.deepEqual(st, { contact: '', contactAuto: null });
    assert.deepEqual(contactAfterAuthorChange({ author: 'Jane Doe', contact: '' }, s), { contact: '', contactAuto: null });
    assert.equal(contactAfterAuthorChange({ author: 'Jane', contact: 'My agent: K. Moss' }, s).contact, 'My agent: K. Moss');
    assert.equal(contactAfterAuthorChange({ author: 'Jane', contact: 'Typed by me', contactAuto: CHILLI_CONTACT, contactTouched: true }, s).contact, 'Typed by me');
    assert.equal(contactAfterAuthorChange({ author: 'Jane', contact: '', contactAuto: null, contactTouched: true }, s).contact, '');
    assert.equal(contactAfterAuthorChange({ author: 'Chilli Palmer', contact: '' }, s).contact, '', 'his name fills nothing');
    // A block the form filled in gives way even after the writer once typed in the box (no Chilli on Jane's script).
    assert.deepEqual(contactAfterAuthorChange({ author: 'Jane', contact: CHILLI_CONTACT, contactAuto: CHILLI_CONTACT, contactTouched: true }, s), { contact: '', contactAuto: null });
    assert.deepEqual(contactAfterAuthorChange({ author: 'Jane', contact: ERIC_CONTACT, contactAuto: ERIC_CONTACT, contactTouched: true }, s), { contact: '', contactAuto: null });
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
    assert.match(read('index.css'), /\.micro-label \{ font-size: 11px; font-weight: 600; letter-spacing: 0\.05em; text-transform: uppercase; color: var\(--text-muted, #9a9890\); \}/);
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
    for (const d of ['color: var(--text-muted, #9a9890)', 'border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
      'background: rgba(255, 255, 255, 0.05)', 'font-family: var(--ui-font)', 'font-size: 11.5px', 'font-weight: 500']) assert.ok(r.includes(d), d);
    for (const f of ['index.css', 'components/DialogueTuner.css', 'components/ProjectBibleDrawer.css', 'components/CharactersDrawer.jsx']) {
      assert.ok(!/#94a3b8|#64748b|#e2e8f0|148, 163, 184/i.test(read(f)), `${f} has no slate`);
    }
  });
  it('counts inside a pill: 0.6 opacity, the pill’s own colour', () => {
    assert.match(rule('.pill-count'), /opacity: 0\.6; color: inherit;/);
    assert.match(read('components/DialogueTuner.jsx'), /<span className="pill-count cast-count">\{c\.lines\}<\/span>/);
  });
  it('hover: normal text, 22 % white border, a touch more fill', () => {
    assert.match(rule('.pill:hover:not(.is-on, .is-selected)'), /color: var\(--text-normal, #e9e7e2\); border: 1px solid rgba\(255, 255, 255, 0\.22\); background: rgba\(255, 255, 255, 0\.08\);/);
  });
  it('selected: accent fill, white text, transparent border', () => {
    assert.match(css, /\.pill\.is-on,\s*\.pill\.is-selected \{ background: var\(--accent, #d9532f\); color: #ffffff;[^}]*border-color: transparent;/);
  });
});

describe('Neutral tokens: MISSING BIOS and every pill use the app\u2019s warm neutrals, never slate', () => {
  const css = read('index.css');
  it('the shared tokens are defined (so no slate fallback is ever used)', () => {
    assert.match(css, /--text-muted: var\(--muted\);/);
    assert.match(css, /--text-normal: var\(--text\);/);
    assert.match(css, /--border-subtle: rgba\(255, 255, 255, 0\.1\);/);
    assert.match(css, /--muted: #9a9890;/);
  });
  it('no slate grays (#9ca3af, #e5e7eb, #94a3b8, #64748b) anywhere in the styles', () => {
    for (const f of ['index.css', 'App.css', 'components/ProjectBibleDrawer.css', 'components/CueBioCard.css', 'components/DialogueTuner.css']) {
      assert.ok(!/#9ca3af|#e5e7eb|#94a3b8|#64748b/i.test(read(f)), f);
    }
  });
  it('the MISSING BIOS header is a .micro-label and its names are .pill chips — no overrides of their colours', () => {
    const ui = read('components/CharactersDrawer.jsx');
    assert.match(ui, /<span className="micro-label" id="pb-missing-bios">Missing bios<\/span>/);
    assert.match(ui, /className="pill pb-chip"/);
    assert.ok(!/\.pb-chip\s*\{[^}]*color/.test(read('components/ProjectBibleDrawer.css')));
  });
});

