import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectsClickCloses } from '../src/lib/projectsDismiss.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
// A fake element: `inside` lists the selectors it sits within.
const el = (...inside) => ({ closest: (sel) => (sel.split(',').some((s) => inside.includes(s.trim())) ? {} : null) });

describe('Projects: click outside to close', () => {
  const panel = { contains: (t) => t?.inPanel === true };
  it('a press on the top bar (File, ⋮, Bold, Element…) closes Projects and goes on to what was pressed', () => {
    assert.equal(projectsClickCloses(el('.bar'), panel), true);
    assert.equal(projectsClickCloses(el(), panel), true);
  });
  it('not inside Projects, its dimmed backdrop, a dialog, a dropdown list, or the Projects toggle itself', () => {
    assert.equal(projectsClickCloses({ ...el(), inPanel: true }, panel), false, 'the panel');
    assert.equal(projectsClickCloses(el('.pd-backdrop'), panel), false, 'the dim closes it by itself and swallows the click');
    assert.equal(projectsClickCloses(el('dialog'), panel), false, 'Delete Screenplay? and other dialogs');
    assert.equal(projectsClickCloses(el('.dl-select-list'), panel), false, 'a dropdown list drawn over the page');
    assert.equal(projectsClickCloses(el('[data-projects-toggle]'), panel), false, 'the ▾ toggles it on its own (no close-then-reopen)');
    assert.equal(projectsClickCloses(null, panel), false);
  });
  it('wired: a capturing pointerdown while open; the ▾ beside the title is the toggle', () => {
    const drawer = read('components/ProjectsDrawer.jsx');
    assert.match(drawer, /if \(projectsClickCloses\(e\.target, panelRef\.current\)\) onClose\(\);/);
    assert.match(drawer, /document\.addEventListener\('pointerdown', onDown, true\);/);
    assert.match(drawer, /<div className=\{`pd-backdrop\$\{open \? ' is-open' : ''\}`\} onMouseDown=\{onClose\} aria-hidden="true" \/>/, 'the dim still closes on its own');
    assert.match(read('App.jsx'), /className="doc-switch-btn"\s*data-projects-toggle/);
  });
});
