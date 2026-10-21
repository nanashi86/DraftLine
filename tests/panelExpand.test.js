import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPAND_ARIA_LABEL, EXPANDED_READING_WIDTH, escapeAction, expandTitle } from '../src/lib/panelExpand.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const css = read('components/ProjectBibleDrawer.css');
const DRAWERS = [
  ['Story Bible', 'components/ProjectBibleDrawer.jsx', 'Close the Story Bible', 'pb'],
  ['Characters', 'components/CharactersDrawer.jsx', 'Close Characters', 'pb pb-characters'],
];

describe('Drawer expand toggle: wording and behaviour', () => {
  it('tooltip "Expand to full screen" / "Collapse to side panel"; aria-label "Toggle panel width"', () => {
    assert.equal(expandTitle(false), 'Expand to full screen');
    assert.equal(expandTitle(true), 'Collapse to side panel');
    assert.equal(EXPAND_ARIA_LABEL, 'Toggle panel width');
  });
  it('Esc collapses an expanded drawer first, then closes it', () => {
    assert.equal(escapeAction(true), 'collapse');
    assert.equal(escapeAction(false), 'close');
  });
  it('the button: outward arrows to expand, inward arrows to collapse, pressed state', () => {
    const btn = read('components/ExpandToggle.jsx');
    assert.match(btn, /aria-label=\{EXPAND_ARIA_LABEL\}/);
    assert.match(btn, /title=\{expandTitle\(expanded\)\}/);
    assert.match(btn, /aria-pressed=\{expanded\}/);
    assert.match(btn, /\{expanded \? \(\s*\/\/ Minimize2[^]*?\) : \(\s*\/\/ Maximize2/);
  });
  it('closing resets to side-panel width; going to the script collapses it', () => {
    const hook = read('hooks/useExpandedPanel.js');
    assert.match(hook, /if \(!open && expanded\) setExpanded\(false\);/);
    assert.match(hook, /document\.addEventListener\('focusin', onFocus\)/);
    assert.match(hook, /e\.target\?\.closest\?\.\('\.sheet'\)\) setExpanded\(false\)/);
  });
});

describe('Drawer expand toggle: in both drawers', () => {
  for (const [name, file, closeLabel, cls] of DRAWERS) {
    const src = read(file);
    it(`${name}: the toggle sits directly left of ×`, () => {
      const drawer = src.slice(src.indexOf('export default function'));
      const head = drawer.slice(drawer.indexOf('<header className="pb-head">'), drawer.indexOf('</header>'));
      assert.match(head, new RegExp(`<div className="pb-head-actions">\\s*<ExpandToggle expanded=\\{expanded\\} onToggle=\\{\\(\\) => setExpanded\\(\\(x\\) => !x\\)\\} />\\s*<button type="button" className="btn btn-icon pb-close" onClick=\\{onClose\\} aria-label="${closeLabel}"`));
    });
    it(`${name}: expanded state marks the panel, and Esc collapses before it closes`, () => {
      assert.match(src, /const \[expanded, setExpanded\] = useExpandedPanel\(open\);/);
      assert.ok(src.includes(`className={\`${cls}\${open ? ' is-open' : ''}\${expanded ? ' is-expanded' : ''}\`}`));
      assert.match(src, /if \(escapeAction\(expanded\) === 'collapse'\) setExpanded\(false\);[^\n]*\n\s*else onClose\(\);/);
    });
  }
});

describe('Drawer expand toggle: styling', () => {
  it('normal: the usual 480px dock; expanded: the full width, over the editor, under the toolbar', () => {
    assert.match(css, /\.pb \{[^}]*width: var\(--tuner-w\);/);
    const ex = /\.pb\.is-expanded \{([^}]*)\}/.exec(css)[1];
    assert.match(ex, /width: 100vw;/);
    assert.match(ex, /max-width: none;/);
    assert.match(ex, /z-index: 25;/, 'over the scene list (20), under the toolbar menus (30)');
  });
  it(`content keeps a readable ${EXPANDED_READING_WIDTH}px centred column`, () => {
    assert.ok(css.includes(`--pb-gutter: max(0px, calc((100vw - ${EXPANDED_READING_WIDTH}px) / 2));`));
    assert.match(css, /\.pb\.is-expanded \.pb-head \{ padding-left: calc\(18px \+ var\(--pb-gutter\)\);/);
    assert.match(css, /\.pb\.is-expanded \.pb-scroll,\s*\.pb\.is-expanded \.pb-dialogue \{ padding-left: var\(--pb-gutter\); padding-right: var\(--pb-gutter\); \}/);
  });
  it('the width animates (200ms ease-in-out); phones (already full width) don’t show the toggle', () => {
    assert.match(css, /\.pb \{\s*--pb-gutter: 0px;\s*transition: [^;]*width 0\.2s ease-in-out/);
    assert.match(css, /@media \(max-width: 720px\) \{\s*\.pb-head-actions \.pb-expand \{ display: none; \}/);
  });
});
