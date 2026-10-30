import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moreMenuItems } from '../src/lib/toolbar.js';

// Write and Plan follow one rule on narrow windows: a workspace's tools leave the top bar for a row at
// the top of the workspace (never just vanish), the view switch goes icons-only at the same width in
// both, and once the switch itself leaves the bar, ⋮ lists its views.
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
const media = (px) => {
  const at = plain.indexOf(`@media (max-width: ${px}px) {`);
  assert.ok(at >= 0, px);
  let depth = 0;
  for (let i = plain.indexOf('{', at); i < plain.length; i++) {
    if (plain[i] === '{') depth++;
    if (plain[i] === '}' && --depth === 0) return plain.slice(at, i);
  }
  return '';
};

describe('Write: Element ▾ and B I U S move, like Plan’s scene filter', () => {
  it('one shared fragment, drawn in the bar and in the writing pane', () => {
    assert.match(app, /const formatTools = \(\s*<>\s*<Select\s*className="type-select"/);
    assert.equal(app.match(/\{formatTools\}/g).length, 2);
    const header = app.slice(app.indexOf('<header className="bar"'), app.indexOf('</header>'));
    assert.match(header, /<div className="bar-group g-format" hidden=\{!formatBarShown\}>\s*\{formatTools\}/);
  });
  it('the pane row sits above the script (not inside the scrolling page), hidden in Focus and outside Page / Split', () => {
    assert.match(app, /<div className="write-pane" hidden=\{!showEditor\}>\s*<div className="write-tools" role="toolbar" aria-label="Element and formatting" hidden=\{focusMode\}>\s*\{formatTools\}\s*<\/div>\s*<main className="scroller" ref=\{scrollerRef\} hidden=\{!showEditor\}>/);
    assert.match(plain, /\.write-pane \{ flex: 1 1 0; min-width: 0; min-height: 0; display: flex; flex-direction: column; \}/);
    assert.match(plain, /\.write-pane > \.scroller \{ flex: 1 1 0; min-height: 0; \}/);
  });
  it('exactly one copy shows: the bar’s from 1200px up, the pane’s below', () => {
    assert.match(plain, /\.write-tools \{ display: none; \}/);
    const m = media('1199.98');
    assert.match(m, /\.bar \.g-format \{ display: none; \}/);
    assert.match(m, /\.write-tools:not\(\[hidden\]\) \{\s*flex: none;\s*display: flex;/);
    assert.match(m, /\.view-split \.write-tools \{ padding-left: 24px; padding-right: 24px; \}/, 'lines up with the script in Split');
    assert.match(media('720'), /\.workspace \.write-tools:not\(\[hidden\]\) \{ padding: 8px 16px 0; \}/, 'and with the 16px phone gutter');
  });
  it('Element and B I U S are never simply hidden at any width any more', () => {
    assert.doesNotMatch(plain, /(^|[\s,}])\.(type-select|fmt-seg) \{ display: none; \}/);
  });
});

describe('Page | Split | Board and Breakdowns | Stripboard | Reports behave alike', () => {
  it('both go icons-only below 900px, in one rule', () => {
    assert.match(media('899.98'), /\.plan-seg \.seg-label,\s*\.view-seg \.seg-label \{ display: none; \}/);
    assert.match(media('899.98'), /\.plan-seg \.seg-btn,\s*\.view-seg \.seg-btn \{ padding: 4px 8px; \}/);
  });
  it('both leave the bar below 440px', () => {
    assert.match(media('439.98'), /\.zone-right \.plan-seg \{ display: none; \}/);
    assert.match(media('439.98'), /\.zone-right \.view-seg \{ display: none; \}/);
  });
  it('…and then ⋮ lists their views, with the current one marked Showing', () => {
    const views = [{ label: 'Page', on: false, onSelect() {} }, { label: 'Split', on: true, onSelect() {} }, { label: 'Board', on: false, onSelect() {} }];
    const tucked = moreMenuItems({ bibleOnBar: true, charactersOnBar: true, writeViews: { onBar: false, views } });
    assert.deepEqual(tucked.slice(0, 4).map((i) => (i.divider ? '---' : `${i.label}${i.hint ? ` [${i.hint}]` : ''}`)), ['Page', 'Split [Showing]', 'Board', '---']);
    const onBar = moreMenuItems({ bibleOnBar: true, charactersOnBar: true, writeViews: { onBar: true, views } });
    assert.equal(onBar[0].label, 'View Snapshots', 'not repeated while the switch is on the bar');
    assert.match(app, /writeViews: inPlan \? null : \{\s*onBar: isOnBar\(viewSegRef\.current, barRef\.current\),\s*views: VIEWS\.map\(\(v\) => \(\{ label: v\.label, on: view === v\.id, onSelect: \(\) => setView\(v\.id\) \}\)\),/);
    assert.match(app, /className="seg view-seg" role="radiogroup" aria-label="Workspace view \(Alt\+B cycles\)" ref=\{viewSegRef\}/);
  });
});
