import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/components/', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '');

describe('Snapshots: Restore · Compare · Delete on hover or focus', () => {
  const jsx = read('Snapshots.jsx');
  const css = code(read('Snapshots.css'));
  it('cards are marked latest (first) and confirming (Delete? showing)', () => {
    assert.match(jsx, /className=\{`sn-item\$\{i === 0 \? ' is-latest' : ''\}\$\{confirmId === r\.id \? ' is-confirming' : ''\}`\}/);
  });
  it('hidden by opacity at rest, shown on hover, keyboard focus, the newest card and a confirming card', () => {
    assert.match(css, /\.sn-item \.sn-item-actions \{ opacity: 0; pointer-events: none; transition: opacity 120ms ease; \}/);
    assert.match(css, /\.sn-item:is\(:hover, :focus-within, \.is-latest, \.is-confirming\) \.sn-item-actions,\s*\.sn-item \.sn-item-actions:focus-within \{ opacity: 1; pointer-events: auto; \}/);
  });
  it('always shown on touch screens; no fade with reduced motion', () => {
    assert.match(css, /@media \(hover: none\) \{ \.sn-item \.sn-item-actions \{ opacity: 1; pointer-events: auto; \} \}/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.sn-item \.sn-item-actions \{ transition: none; \} \}/);
  });
  it('opacity only: the actions never leave the layout or the Tab order', () => {
    assert.doesNotMatch(css, /\.sn-item-actions[^{]*\{[^}]*(display: none|visibility: hidden)/);
    assert.doesNotMatch(jsx, /tabIndex=\{-1\}/);
  });
  it('the Delete confirmation is unchanged', () => {
    assert.match(jsx, /\{confirmId === r\.id \? \(\s*<div className="sn-item-actions is-confirm" role="group" aria-label=\{`Delete \$\{r\.label\}\?`\}>/);
    assert.match(jsx, /onClick=\{\(\) => \{ setConfirmId\(null\); onDelete\(r\.id\); \}\}>Delete<\/button>/);
    assert.match(jsx, /onClick=\{\(\) => setConfirmId\(null\)\}>Keep<\/button>/);
    assert.match(jsx, /onClick=\{\(\) => setConfirmId\(r\.id\)\} aria-label=\{`Delete \$\{r\.label\}`\}>Delete<\/button>/);
    assert.match(jsx, /aria-label=\{`Restore \$\{r\.label\}`\}>Restore<\/button>/);
    assert.match(jsx, /aria-label=\{`Compare \$\{r\.label\} with the current draft`\}/);
  });
});

/** Every rule that sets opacity on `target` pairs 0 with pointer-events: none and 1 with auto. */
function noPhantomClicks(css, target) {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel, body]) => sel.includes(target) && /opacity:/.test(body));
  assert.ok(rules.length >= 3, `rules for ${target}`);
  for (const [, sel, body] of rules) {
    if (/opacity: 0;/.test(body)) assert.match(body, /pointer-events: none;/, sel.trim());
    if (/opacity: 1;/.test(body)) assert.match(body, /pointer-events: auto;/, sel.trim());
  }
}

describe('Hidden actions take no clicks', () => {
  it('Snapshots: invisible = pointer-events none; every shown state = auto', () => noPhantomClicks(code(read('Snapshots.css')), '.sn-item-actions'));
  it('Bios: invisible = pointer-events none; every shown state = auto', () => noPhantomClicks(code(read('ProjectBibleDrawer.css')), '.pb-move'));
  it('the guide explains when they show', () => {
    const guide = readFileSync(fileURLToPath(new URL('../src/content/userGuide.md', import.meta.url)), 'utf8');
    assert.match(guide, /\*\*Restore\*\*, \*\*Compare\*\* and \*\*Delete\*\* appear when you point at a snapshot or Tab to it/);
    assert.match(guide, /\*\*Rename\*\* and the ↑ ↓ arrows appear when you point at a bio or Tab to it/);
  });
});

describe('Characters → Bios: Rename and ↑ ↓ on hover or focus', () => {
  const jsx = read('CharactersDrawer.jsx');
  const css = code(read('ProjectBibleDrawer.css'));
  it('hidden by opacity at rest, shown on row hover, keyboard focus and an open bio', () => {
    assert.match(css, /\.pb-char :is\(\.pb-char-rename, \.pb-move\) \{ opacity: 0; pointer-events: none; transition: opacity 120ms ease; \}/);
    assert.match(css, /\.pb-char:is\(:hover, :focus-within, \.is-open\) :is\(\.pb-char-rename, \.pb-move\),\s*\.pb-char :is\(\.pb-char-rename:focus, \.pb-char-rename:focus-visible, \.pb-move:focus-within\) \{ opacity: 1; pointer-events: auto; \}/);
  });
  it('always shown on touch screens; no fade with reduced motion', () => {
    assert.match(css, /@media \(hover: none\) \{ \.pb-char :is\(\.pb-char-rename, \.pb-move\) \{ opacity: 1; pointer-events: auto; \} \}/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.pb-char :is\(\.pb-char-rename, \.pb-move\) \{ transition: none; \} \}/);
  });
  it('the old half-faded resting state is gone', () => {
    assert.doesNotMatch(css, /opacity: 0\.35/);
    assert.match(css, /\.pb-move \{ display: flex; padding-right: 6px; \}/);
  });
  it('opacity only: no display or visibility toggling, so the name and meta never shift', () => {
    assert.doesNotMatch(css, /(\.pb-char-rename|\.pb-move)[^{]*\{[^}]*(display: none|visibility: hidden)/);
  });
  it('still in the Tab order with screen reader labels', () => {
    assert.match(jsx, /aria-label=\{`Rename \$\{name\}`\}/);
    assert.match(jsx, /aria-label=\{`Move \$\{name \|\| 'character'\} up`\}/);
    assert.match(jsx, /aria-label=\{`Move \$\{name \|\| 'character'\} down`\}/);
    assert.doesNotMatch(jsx, /tabIndex=\{-1\}/);
    assert.match(jsx, /<li className=\{`pb-char\$\{open \? ' is-open' : ''\}`\}/);
  });
});
