import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moreMenuItems } from '../src/lib/toolbar.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
const header = app.slice(app.indexOf('<header className="bar"'), app.indexOf('</header>'));
/** The declarations of the first rule whose selector list is exactly `sel` (outside media queries first). */
const rule = (sel) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\n)${esc} \\{([^}]*)\\}`).exec(css);
  return m ? m[1] : '';
};
const media = (px) => {
  const i = css.indexOf(`@media (max-width: ${px}px) {`);
  return i < 0 ? '' : css.slice(i, css.indexOf('\n}\n', i));
};

describe('Top bar: three zones that can’t collide', () => {
  it('left (scenes · D · title ▾), middle (file actions, element & formatting), right (views, export, panels) — in that order', () => {
    const order = ['bar-zone zone-left', 'bar-zone zone-middle', 'zone-middle-tools', 'bar-zone zone-right'].map((c) => header.indexOf(`className="${c}`));
    assert.ok(order.every((i) => i > 0), JSON.stringify(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    const left = header.slice(order[0], order[1]);
    assert.match(left, /className=\{`brand/);
    assert.match(left, /className="doc-switch-btn"/);
    const right = header.slice(order[3]);
    assert.match(right, /className="seg" role="radiogroup"/);
    assert.match(right, /className="bar-group bar-right"/);
  });
  it('left and right never shrink; the middle takes what’s left and clips instead of overlapping', () => {
    assert.match(rule('.zone-left'), /flex: 0 0 auto;.*position: relative; z-index: 20;/);
    assert.match(rule('.zone-right'), /flex: 0 0 auto;/);
    assert.match(rule('.zone-middle'), /flex: 1 1 auto;/);
    const tools = rule('.zone-middle-tools');
    assert.match(tools, /flex: 0 1 auto;/);
    assert.match(tools, /min-width: 0;/);
    assert.match(tools, /overflow: hidden;/);
  });
  it('the red D is always on top and clickable', () => {
    const brand = rule('.brand');
    assert.match(brand, /pointer-events: auto;/);
    assert.match(brand, /position: relative;/);
    assert.match(brand, /z-index: 30;/);
  });
  it('long titles end in "…" at no more than 200px, so they can’t push into File / New', () => {
    const t = rule('.doc-title');
    assert.match(t, /max-width: clamp\(120px, 10vw, 200px\);/);
    assert.match(t, /overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/);
    assert.match(rule('.doc-author'), /max-width: 120px;\s*overflow: hidden;\s*text-overflow: ellipsis;/);
  });
  it('the bar is never a hidden sideways scroller, and nothing in it is absolutely positioned', () => {
    assert.ok(!/\.bar \{[^}]*overflow-x/.test(css), 'no overflow-x on .bar at any width');
    for (const sel of ['.bar', '.bar-zone', '.zone-left', '.zone-middle', '.zone-middle-tools', '.zone-right', '.brand', '.doc-meta', '.doc-switch', '.bar-group']) {
      assert.ok(!/position: absolute/.test(rule(sel)), sel);
    }
  });
});

describe('Top bar: narrow windows collapse in steps', () => {
  it('under 1320px, New · Open · Import · Title Page become one "File ▾" menu', () => {
    assert.match(rule('.file-menu'), /display: none;/);
    const m = media('1319.98');
    assert.match(m, /\.file-inline \{ display: none; \}/);
    assert.match(m, /\.file-menu \{ display: inline-flex; \}/);
    assert.match(app, /const FILE_ACTIONS = \[\s*\{ id: 'new', label: 'New'[^]*?\{ id: 'open', label: 'Open'[^]*?\{ id: 'import', label: 'Import'[^]*?\{ id: 'title', label: 'Title Page'/);
    assert.match(header, /<Menu label="File" items=\{\(\) => FILE_ACTIONS\.map/);
    assert.match(header, /FILE_ACTIONS\.map\(\(a\) => \(\s*<button key=\{a\.id\} className="btn" onClick=\{\(\) => runFileAction\(a\.id\)\}/);
  });
  it('the File ▾ list sits outside the clipping box, so it can drop down', () => {
    const fileMenu = header.indexOf('className="file-menu"');
    assert.ok(fileMenu > 0 && fileMenu < header.indexOf('className="zone-middle-tools"'));
  });
  it('then Focus (1100) and Characters (1024) move into ⋮, B I U S hide (900), Element hides (768), views hide (560)', () => {
    assert.match(media('1099.98'), /\.bar-right > \.btn-focus \{ display: none; \}/);
    assert.match(media('1023.98'), /\.bar-right > \.btn-accent \{ display: none; \}/);
    assert.match(media('899.98'), /\.fmt-seg \{ display: none; \}/);
    assert.match(media('767.98'), /\.type-select \{ display: none; \}/);
    assert.match(media('559.98'), /\.seg \{ display: none; \}/);
  });
  it('whatever the bar hides is in ⋮', () => {
    const items = moreMenuItems({ bibleOnBar: false, charactersOnBar: false, focusOnBar: false, onFocus() {}, onBible() {}, onCharacters() {} });
    assert.deepEqual(items.slice(0, 3).map((i) => i.label), ['Focus', 'Story Bible', 'Characters']);
    const wide = moreMenuItems({ bibleOnBar: true, charactersOnBar: true, focusOnBar: true, onFocus() {} });
    assert.equal(wide[0].label, 'View Snapshots');
    assert.match(header, /focusOnBar: isOnBar\(focusBtnRef\.current, barRef\.current\),\s*onFocus: \(\) => setFocusMode\(true\),/);
  });
  it('the D opens About at every width — no breakpoint ever hides it', () => {
    assert.ok(!/\.brand(-mark)?\s*\{[^}]*display: none/.test(css));
    assert.ok(!/\.brand(-mark)?,/.test(css.replace(/\.brand-name,/g, '')), 'not hidden as part of a selector list either');
    assert.match(header, /className=\{`brand[^`]*`\}\s*onClick=\{\(\) => setHelpKind\('about'\)\}/);
  });
});
