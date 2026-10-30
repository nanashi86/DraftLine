import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { edgeIndex, flattenOptions, openIndex, placeList, selectedIndex, stepIndex, typeaheadIndex } from '../src/lib/selectModel.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));
const read = (p) => readFileSync(join(SRC, p), 'utf8');

const OPTS = [
  { value: '', label: 'Type of conflict…', muted: true },
  { group: 'Inner Conflict', options: [{ value: 'self', label: 'Individual vs. Self' }] },
  { group: 'Wider World Conflict', options: [{ value: 'soc', label: 'Individual vs. Society' }, { value: 'nat', label: 'Individual vs. Nature', disabled: true }, { value: 'sup', label: 'Individual vs. Supernatural' }] },
];

describe('selectModel: the list logic', () => {
  const flat = flattenOptions(OPTS);
  it('flattens groups in order, keeping each option’s group and index', () => {
    assert.deepEqual(flat.map((o) => [o.index, o.value, o.group]), [
      [0, '', null], [1, 'self', 'Inner Conflict'], [2, 'soc', 'Wider World Conflict'], [3, 'nat', 'Wider World Conflict'], [4, 'sup', 'Wider World Conflict'],
    ]);
  });
  it('finds the chosen option; opens on it, or on the first enabled one', () => {
    assert.equal(selectedIndex(flat, 'soc'), 2);
    assert.equal(selectedIndex(flat, 'nope'), -1);
    assert.equal(openIndex(flat, 'soc'), 2);
    assert.equal(openIndex(flat, 'nope'), 0);
  });
  it('arrows skip disabled options and stop at the ends; Home / End go to the first / last enabled', () => {
    assert.equal(stepIndex(flat, 2, 1), 4, 'skips the disabled Nature');
    assert.equal(stepIndex(flat, 4, 1), 4, 'stops at the end');
    assert.equal(stepIndex(flat, 0, -1), 0);
    assert.equal(edgeIndex(flat, 1), 0);
    assert.equal(edgeIndex(flat, -1), 4);
  });
  it('type-to-jump: by label start, case- and accent-insensitive, cycling on a repeated letter', () => {
    const roles = flattenOptions(['Protagonist', 'Antagonist', 'Deuteragonist', 'Tritagonist', 'Supporting', 'Minor / Cameo'].map((l) => ({ value: l, label: l })));
    assert.equal(typeaheadIndex(roles, 't', -1), 3);
    assert.equal(typeaheadIndex(roles, 'p', 0), 0, 'wraps round to the only P');
    assert.equal(typeaheadIndex(roles, 'su', 0), 4);
    assert.equal(typeaheadIndex(roles, 'zz', 2), 2, 'no match: stays');
    const els = flattenOptions(['Scene Heading', 'Format Cue', 'Action', 'Character'].map((l) => ({ value: l, label: l })));
    assert.equal(typeaheadIndex(els, 'c', 0), 3, 'from Scene Heading, "c" goes to Character');
    assert.equal(typeaheadIndex(els, 'ss', 0), 0, 'a repeated letter cycles: S → (next S) → wraps to Scene Heading');
    const plus = flattenOptions([{ value: 'x', label: '+ Add device…' }, { value: 'é', label: 'Écran' }]);
    assert.equal(typeaheadIndex(plus, 'a', -1), 0, 'leading symbols are skipped');
    assert.equal(typeaheadIndex(plus, 'e', 0), 1, 'accents ignored');
    assert.equal(typeaheadIndex(flattenOptions(OPTS), 'i', 0), 1, 'disabled ones are skipped');
  });
  it('places the list below when it fits, else on the roomier side, inside the window, at least as wide as the control', () => {
    const view = { width: 1000, height: 800 };
    const low = placeList({ left: 100, right: 300, top: 100, bottom: 132 }, 200, view);
    assert.deepEqual(low, { left: 100, top: 136, minWidth: 200, maxHeight: 360, placement: 'below' });
    const high = placeList({ left: 100, right: 300, top: 700, bottom: 732 }, 300, view);
    assert.equal(high.placement, 'above');
    assert.equal(high.top, 700 - 4 - 300);
    const edge = placeList({ left: 900, right: 990, top: 100, bottom: 132 }, 100, view);
    assert.equal(edge.left, 900 - 0, 'already inside');
    assert.equal(placeList({ left: 950, right: 1100, top: 100, bottom: 132 }, 100, view).left, 1000 - 8 - 150, 'slid back inside the window');
  });
});

describe('Select: DraftLine’s dropdown everywhere', () => {
  const ui = read('components/Select.jsx');
  const css = read('components/Select.css');
  it('no native <select> is left anywhere in the app', () => {
    for (const f of files(SRC).filter((x) => /\.jsx?$/.test(x) && !x.endsWith('Select.jsx'))) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      assert.ok(!/<select\b/.test(code), f);
    }
  });
  it('every former <select> uses it', () => {
    const uses = {
      'App.jsx': 1, 'components/CharactersDrawer.jsx': 3, 'components/FindBar.jsx': 1, 'components/ProjectBibleDrawer.jsx': 1,
      'components/StoryDna.jsx': 2, 'components/TitlePageModal.jsx': 2,
    };
    for (const [f, n] of Object.entries(uses)) assert.equal((read(f).match(/<Select\b/g) || []).length, n, f);
  });
  it('follows the select-only combobox pattern: a combobox button, a listbox, options with aria-selected', () => {
    assert.match(ui, /role="combobox"\s*aria-haspopup="listbox"\s*aria-expanded=\{open\}/);
    assert.match(ui, /aria-activedescendant=\{open && active >= 0 \? optId\(active\) : undefined\}/);
    assert.match(ui, /role="listbox"/);
    assert.match(ui, /role="option"\s*aria-selected=\{o\.value === value\}/);
    assert.match(ui, /role="group" aria-label=\{g\.group\}/);
  });
  it('the keyboard: open with ↓ ↑ Enter Space Alt+↓ or a letter; inside, arrows, Home/End, Page keys, Enter, Esc, Tab, type-to-jump', () => {
    assert.match(ui, /\['ArrowDown', 'ArrowUp', 'Enter', ' '\]\.includes\(e\.key\)/);
    for (const k of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']) assert.ok(ui.includes(`${k}: () =>`), k);
    assert.match(ui, /else if \(e\.key === 'Escape'\) close\(\);/);
    assert.match(ui, /else if \(e\.key === 'Tab'\) \{\s*close\(\);\s*return; \/\/ let focus move on/);
    assert.match(ui, /window\.addEventListener\('keydown', onKey, true\);/, 'caught first, so the script and dialogs don’t also act on them');
  });
  it('closes on a press outside, a scroll outside the list, resize and blur', () => {
    for (const ev of ["'pointerdown', onDown, true", "'scroll', onScroll, true", "'resize', close", "'blur', close"]) assert.ok(ui.includes(`window.addEventListener(${ev})`), ev);
  });
  it('the list draws inside a dialog when the control is in one (else it would sit behind it), otherwise in <body>', () => {
    assert.match(ui, /setHost\(btnRef\.current\?\.closest\('dialog'\) \|\| document\.body\);/);
    assert.match(ui, /createPortal\(/);
  });
  it('a ✓ marks the chosen option (or a checked toggle); hints sit in a column on the right', () => {
    assert.match(ui, /\(o\.checked \?\? o\.value === value\) && <Check size=\{14\} strokeWidth=\{2\} \/>/);
    assert.match(ui, /\{o\.hint && <span className="dl-opt-hint">\{o\.hint\}<\/span>\}/);
    assert.match(css, /\.dl-opt\.is-active \{ background: var\(--accent\); color: var\(--on-accent\); \}/);
    assert.match(css, /\.dl-select-list \{[^}]*background: var\(--panel\);[^}]*box-shadow: 0 12px 32px rgba\(0, 0, 0, 0\.4\);/, 'the same surface as File ▾');
  });
  it('Element ▾: the closed control reads just the element; shortcuts are a column; the caret stays in the script', () => {
    const app = read('App.jsx');
    assert.match(app, /<Select\s*className="type-select"\s*keepFocus/);
    assert.match(app, /\{ value: s\.type, label: s\.label, hint: s\.combo \}/);
    assert.ok(!/\$\{s\.label\} {2}· {2}\$\{s\.combo\}/.test(app), 'no more "Character · Alt+4" labels');
    assert.match(ui, /onMouseDown=\{\(e\) => \{\s*if \(keepFocus\) e\.preventDefault\(\);/);
    assert.match(ui, /onMouseDown=\{\(e\) => e\.preventDefault\(\)\} \/\/ never take focus/);
  });
  it('the Title Page fonts show in their own face, with the note muted beside them', () => {
    const tp = read('components/TitlePageModal.jsx');
    assert.match(tp, /\{ value: f\.id, label: f\.label, hint: f\.note, style: \{ fontFamily: f\.family \} \}/);
    assert.match(ui, /<span className="dl-opt-label" style=\{o\.style\}>\{o\.label\}<\/span>/);
  });
});
