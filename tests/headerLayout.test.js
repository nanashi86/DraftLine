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
    assert.match(right, /className="seg view-seg" role="radiogroup"/);
    assert.match(right, /className="bar-group bar-right"/);
  });
  it('left and right never shrink; the middle takes what’s left and clips instead of overlapping', () => {
    assert.match(rule('.zone-left'), /flex: 0 1000 auto;.*position: relative; z-index: 20;/); // the title gives way first
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
  it('the title grows with its text (120px to 512px, 448px under 1024px, 320px under 768px), then ends in "…"', () => {
    const wrap = rule('.doc-title-wrap');
    assert.match(wrap, /display: inline-grid;\s*grid-template-columns: minmax\(0, 1fr\);\s*flex: 0 1 auto;\s*min-width: 120px;\s*max-width: 512px;/);
    assert.match(rule('.doc-title-wrap::after'), /content: attr\(data-value\);[^}]*visibility: hidden;\s*white-space: pre;/);
    assert.match(media('1023.98'), /\.doc-title-wrap \{ max-width: 448px; \}/);
    assert.match(media('767.98'), /\.doc-title-wrap \{ max-width: 320px; \}/);
    assert.match(media('639.98'), /\.doc-title-wrap \{ min-width: 6ch; max-width: 110px; \}/);
    assert.match(header, /<span className="doc-title-wrap" data-value=\{meta\.title \|\| 'Untitled'\}>/);
    assert.doesNotMatch(header, /0\.6em/, 'no width guessed from the character count');
    const t = rule('.doc-title');
    assert.match(t, /width: 100%;\s*min-width: 0;\s*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/);
    assert.match(rule('.doc-author'), /max-width: 120px;\s*overflow: hidden;\s*text-overflow: ellipsis;/);
  });
  it('title + ▾ read as one Projects control: 28px ▾ behind a hairline, one outline, clearance before "by"', () => {
    const sw = rule('.doc-switch');
    assert.match(sw, /margin-right: 8px;/);
    assert.match(sw, /border: 1px solid transparent;/);
    assert.match(css, /\.doc-switch:hover,\n\.doc-switch:focus-within,\n\.doc-switch\.is-open \{ background: var\(--field\); border-color: var\(--line-soft\); \}/);
    const btn = rule('.doc-switch-btn');
    assert.match(btn, /width: 28px;/);
    assert.match(btn, /border-left: 1px solid var\(--line-soft\);/);
    assert.match(header, /title="Projects \(Alt\+P\)"\s*aria-label="Projects"/);
  });
  it('the bar is never a hidden sideways scroller, and nothing in it is absolutely positioned', () => {
    assert.ok(!/\.bar \{[^}]*overflow-x/.test(css), 'no overflow-x on .bar at any width');
    for (const sel of ['.bar', '.bar-zone', '.zone-left', '.zone-middle', '.zone-middle-tools', '.zone-right', '.brand', '.doc-meta', '.doc-switch', '.bar-group']) {
      assert.ok(!/position: absolute/.test(rule(sel)), sel);
    }
  });
});

describe('Top bar: Element ▾ · B I U S spacing', () => {
  it('12px between Element ▾ and B (an explicit margin, no group gap); a divider 16px after S closes the group', () => {
    assert.match(css, /\.bar-group\.g-format \{ gap: 0; \}/);
    assert.match(css, /\.g-format \.type-select \{ margin-right: 12px; \}/);
    assert.match(css, /\.fmt-sep \{ margin-left: var\(--sep-space\); \}/);
    assert.match(header, /<span className="bar-sep fmt-sep" aria-hidden="true" \/>\s*<\/div>/);
  });
  it('while the group shows, its divider stands in for the one before Page | Split | Board (never two)', () => {
    assert.match(css, /\.bar:has\(\.g-format:not\(\[hidden\]\)\) \.zone-right > \.bar-sep,\n\.bar:has\(\.plan-filter\.is-bar\) \.zone-right > \.bar-sep \{ display: none; \}/);
    assert.match(media('1440'), /\.bar-sep \{ display: none; \}/, 'narrower bars drop every divider, this one included');
  });
});

describe('Top bar: dividers sit 16px from their neighbours at every width', () => {
  it('one gap value for the bar and its zones, set per width', () => {
    assert.match(rule('.bar'), /--bar-gap: 22px;\s*--sep-space: 16px;\s*gap: var\(--bar-gap\);/);
    assert.match(rule('.bar-zone'), /gap: var\(--bar-gap\);/);
    assert.match(rule('.zone-middle-tools'), /gap: var\(--bar-gap\);/);
    for (const [px, gap] of [['1800', 18], ['1650', 14], ['1023.98', 10], ['559.98', 6]]) {
      assert.match(media(px), new RegExp(`\\.bar \\{ --bar-gap: ${gap}px;`), px);
    }
    assert.ok(!/\.bar-zone, \.zone-middle-tools \{ gap: \d+px; \}/.test(css), 'no separate per-zone gaps to drift apart');
  });
  it('a divider’s margin adds only what the gap doesn’t: 16px each side', () => {
    assert.match(rule('.bar-sep'), /margin-inline: calc\(var\(--sep-space\) - var\(--bar-gap\)\);/);
    assert.match(readFileSync(new URL('../src/components/planning/PlanFilter.css', import.meta.url), 'utf8'), /\.plan-filter > \.pf-sep \{ margin-left: calc\(var\(--sep-space, 16px\) - 10px\); \}/);
  });
});

describe('Top bar: Story Bible and Characters look alike', () => {
  it('both outlined at rest and filled with the accent while their panel is open', () => {
    assert.match(header, /className=\{`btn btn-bible\$\{bibleOpen \? ' is-on' : ''\}`\}/);
    assert.match(header, /className=\{`btn btn-accent\$\{charactersOpen \? ' is-on' : ''\}\$\{hintBeacon === 'characters' \? ' has-hint-beacon' : ''\}`\}/);
    assert.match(css, /\.btn-accent,\n\.btn-bible \{ border-color: var\(--line-soft\); \}/);
    assert.match(css, /\.btn-accent\.is-on,\n\.btn-bible\.is-on \{ background: var\(--accent\); border-color: var\(--accent\); color: var\(--on-accent\); \}/);
  });
});

describe('Top bar: narrow windows collapse in steps', () => {
  it('one "File ▾" menu at every width; no loose New / Open / Import / Title Page / Export buttons', () => {
    assert.match(rule('.file-menu'), /display: inline-flex;/);
    assert.ok(!/\.file-inline|max-width: 1319\.98px/.test(css));
    assert.match(header, /<Menu label="File" items=\{fileItems\}/);
    assert.ok(!/label="Export"|FILE_ACTIONS|runFileAction/.test(app));
    for (const b of ['New', 'Open', 'Import', 'Title Page', 'Export']) assert.ok(!new RegExp(`>${b}</button>`).test(header), b);
  });
  it('Element ▾ and B I U S only on a writing canvas (Page, Split, Focus) — hidden on the Board and in Plan', () => {
    assert.match(app, /const formatBarShown = showEditor;/);
    assert.match(app, /const showEditor = \(view !== 'board' \|\| focusMode\) && !inPlan;/);
    assert.match(header, /<div className="bar-group g-format" hidden=\{!formatBarShown\}>/);
  });
  it('the File ▾ list sits outside the clipping box, so it can drop down', () => {
    const fileMenu = header.indexOf('className="file-menu"');
    assert.ok(fileMenu > 0 && fileMenu < header.indexOf('className="zone-middle-tools"'));
  });
  it('Write: Element · B I U S move to the writing pane (1200), Focus (1100) and Characters (1024) → ⋮, views → ⋮ (440), scene list (560)', () => {
    assert.match(media('1199.98'), /\.bar \.g-format \{ display: none; \}/);
    assert.match(media('1199.98'), /\.write-tools:not\(\[hidden\]\) \{[^}]*display: flex;/);
    assert.match(media('1099.98'), /\.bar-right > \.btn-focus \{ display: none; \}/);
    assert.match(media('1023.98'), /\.bar-right > \.btn-accent \{ display: none; \}/);
    assert.doesNotMatch(css, /^\s*\.(type-select|fmt-seg) \{ display: none; \}/m, 'never simply hidden: they move');
    assert.match(media('899.98'), /\.ws-label \{ display: none; \}/, 'Write | Plan stays, icons only');
    assert.match(media('439.98'), /\.zone-right \.view-seg \{ display: none; \}/, 'Page | Split | Board: icons until 440px, then Alt+B');
    assert.match(media('559.98'), /\.zone-left > \.btn-icon \{ display: none; \}/);
    assert.ok(!/\.ws-switch\s*\{[^}]*display: none/.test(css), 'Write | Plan never hides');
  });
  it('Plan: Collapse All → ⋮ (1200), Export Breakdown shortens to "Export" (1000), view switch icons (900), Export → ⋮ (640), views → ⋮ (440)', () => {
    assert.match(media('1199.98'), /\.bar-right > \.btn-plan-fold \{ display: none; \}/);
    assert.match(media('999.98'), /\.btn-plan-export \.plan-lbl-long \{ display: none; \}/);
    assert.match(media('999.98'), /\.btn-plan-export \.plan-lbl-short \{ display: inline; \}/);
    assert.match(media('899.98'), /\.plan-seg \.seg-label,\s*\.view-seg \.seg-label \{ display: none; \}/);
    assert.ok(!/(^|[^-])\.lbl-(long|short)/m.test(css), 'no generic label classes for other rules to catch');
    assert.match(media('639.98'), /\.bar-right > \.btn-plan-export \{ display: none; \}/);
    assert.match(media('439.98'), /\.zone-right \.plan-seg \{ display: none; \}/);
    assert.match(header, /<span className="plan-lbl-long">Export Breakdown<\/span>\s*<span className="plan-lbl-short">Export<\/span>/);
    const tucked = moreMenuItems({
      bibleOnBar: true, charactersOnBar: true,
      planTools: {
        viewsOnBar: false, views: [{ label: 'Breakdowns', on: true, onSelect() {} }, { label: 'Stripboard', on: false, onSelect() {} }],
        hasScenes: true, foldOnBar: false, foldLabel: 'Collapse All', onFold() {}, exportOnBar: false, onExport() {},
      },
    });
    assert.deepEqual(tucked.slice(0, 5).map((i) => (i.divider ? '---' : `${i.label}${i.hint ? ` [${i.hint}]` : ''}`)),
      ['Breakdowns [Showing]', 'Stripboard', 'Collapse All', 'Export Breakdown [.csv]', '---']);
  });
  it('Page | Split | Board carry line icons (page, two columns, kanban) — labels from 900px, icons only below, like Plan', () => {
    assert.match(app, /\{ id: 'page', label: 'Page', title: 'Script only', Icon: FileText \}/);
    assert.match(app, /\{ id: 'split', label: 'Split', title: 'Script \+ Scene Board side by side', Icon: Columns2 \}/);
    assert.match(app, /\{ id: 'board', label: 'Board', title: 'Scene Board only', Icon: SquareKanban \}/);
    const seg = header.slice(header.indexOf('className="seg view-seg"'), header.indexOf('</div>', header.indexOf('className="seg view-seg"')));
    assert.match(seg, /aria-label=\{label\}/, 'icon-only buttons keep their names');
    assert.match(seg, /<Icon size=\{14\} strokeWidth=\{1\.75\} aria-hidden \/>\s*<span className="seg-label">\{label\}<\/span>/);
    assert.match(css, /\.view-seg \.seg-btn,\s*\.plan-seg \.seg-btn \{ display: inline-flex; align-items: center; gap: 6px; \}/);
    assert.match(media('899.98'), /\.plan-seg \.seg-label,\s*\.view-seg \.seg-label \{ display: none; \}/, 'the same width as Breakdowns | Stripboard | Reports');
    assert.doesNotMatch(media('767.98'), /seg-label/);
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(seg), 'no emoji');
  });
  it('B I U S match Element ▾ and File ▾: 32px capsule, 30px buttons, 13px/600 in the same type, fading whole when disabled', () => {
    const seg = rule('.fmt-seg');
    for (const d of ['height: 32px', 'box-sizing: border-box', 'display: inline-flex']) assert.ok(seg.includes(d), d);
    const btn = rule('.fmt-btn');
    for (const d of ['min-width: 30px', 'padding: 4px 6px', 'height: 100%', 'display: flex', 'align-items: center', 'justify-content: center', 'font: 600 13px/1 var(--ui-font)']) assert.ok(btn.includes(d), d);
    assert.match(rule('.type-select'), /height: 32px;/);
    assert.match(css, /\.file-menu > \.menu > \.btn \{[^}]*height: 32px;/);
    assert.match(css, /\.fmt-seg\.is-disabled \{ opacity: 0\.45; \}/);
    assert.match(css, /\.type-select:disabled \{ opacity: 0\.45; \}/);
    assert.match(rule('.fmt-btn:disabled'), /cursor: default;/);
    assert.doesNotMatch(rule('.fmt-btn:disabled'), /opacity/, 'no double fade on top of the capsule’s');
    assert.match(seg, /gap: 2px;/, 'a segmented group: 2px between B, I, U and S');
    assert.match(app, /className=\{`fmt-seg\$\{isLocked \? ' is-locked' : ''\}\$\{editControlsEnabled \? '' : ' is-disabled'\}`\}/);
  });
  it('the header row is space-between, full width, and no control is ever absolutely positioned', () => {
    assert.match(rule('.bar'), /justify-content: space-between;\s*align-items: center;\s*width: 100%;/);
  });
  it('whatever the bar hides is in ⋮', () => {
    const items = moreMenuItems({ bibleOnBar: false, charactersOnBar: false, focusOnBar: false, onFocus() {}, onBible() {}, onCharacters() {} });
    assert.deepEqual(items.slice(0, 3).map((i) => i.label), ['Focus', 'Story Bible', 'Characters']);
    const wide = moreMenuItems({ bibleOnBar: true, charactersOnBar: true, focusOnBar: true, onFocus() {} });
    assert.equal(wide[0].label, 'View Snapshots');
    assert.match(header, /focusOnBar: inPlan \|\| isOnBar\(focusBtnRef\.current, barRef\.current\),\s*onFocus: \(\) => setFocusMode\(true\),/);
  });
  it('the D opens About at every width — no breakpoint ever hides it', () => {
    assert.ok(!/\.brand(-mark)?\s*\{[^}]*display: none/.test(css));
    assert.ok(!/\.brand(-mark)?,/.test(css.replace(/\.brand-name,/g, '')), 'not hidden as part of a selector list either');
    assert.match(header, /className=\{`brand[^`]*`\}\s*onClick=\{\(\) => setHelpKind\('about'\)\}/);
  });
});
