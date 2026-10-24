import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Right-click on a script element must always open the browser's own context menu: spelling
// suggestions and Add to dictionary come from it. Nothing in the editor may cancel, stop or
// redirect a right-click, and the textarea must be what the pointer hits on every line.

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const editor = read('src/components/Editor.jsx');
const css = read('src/components/Editor.css');

function sources(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(jsx?|html)$/.test(n) ? [p] : [];
  });
}

describe('Right-click reaches the browser on script elements', () => {
  it('no contextmenu listener anywhere except the margin-note button and the status stepper label', () => {
    const hits = [];
    for (const f of [...sources(new URL('src', root).pathname), new URL('index.html', root).pathname]) {
      const text = readFileSync(f, 'utf8');
      if (/contextmenu/i.test(text)) hits.push(f.replace(/^.*?(src\/|index\.html)/, '$1'));
    }
    assert.deepEqual(hits.sort(), ['src/components/Editor.jsx', 'src/components/StatusStepper.jsx']);
    // In the editor, the only one is NoteMarker's: a button in the left margin, never over text.
    assert.equal((editor.match(/onContextMenu/g) || []).length, 1);
    const marker = editor.slice(editor.indexOf('function NoteMarker('), editor.indexOf('</button>', editor.indexOf('function NoteMarker(')));
    assert.match(marker, /onContextMenu=\{open_\}/);
    assert.match(css, /\.note-mark,\s*\.note-add \{[^}]*position: absolute;[^}]*left: calc\(-1 \* var\(--el-left\) - var\(--in\) \* 1\.12\)/, 'in the margin');
  });

  it('the sheet’s click-to-nearest-line handler ignores every button but the left one', () => {
    const fn = editor.slice(editor.indexOf('const onSheetMouseDown = (e) => {'), editor.indexOf('const { place, pageCount } = layout;'));
    const guard = fn.indexOf('if (e.button !== 0) return;');
    assert.ok(guard > 0 && guard < fn.indexOf('e.preventDefault()'), 'returns before preventDefault or moving focus');
  });

  it('page-seam caret routing only follows left clicks', () => {
    assert.match(editor, /const onDown = \(e\) => \{\s*if \(e\.button === 0 && sheetRef\.current\?\.contains\(e\.target\)\) pointerDown\.current = true;/);
    assert.match(editor, /const onUp = \(e\) => \{\s*if \(e\.button !== 0 \|\| !pointerDown\.current\) return;/);
  });

  it('nothing on the editing path filters input: a chosen suggestion is an ordinary edit', () => {
    assert.doesNotMatch(editor, /onBeforeInput|beforeinput|insertReplacementText/);
    // The editor's one stopPropagation is Esc closing the autocomplete list: a key, never a click.
    const stops = [...editor.matchAll(/stopPropagation\(\)/g)].map((m) => editor.slice(Math.max(0, m.index - 120), m.index));
    assert.equal(stops.length, 1);
    assert.match(stops[0], /e\.key === 'Escape'/);
    assert.match(editor, /onChange=\{\(e\) => onText\(block\.id, e\.target\.value\)\}/);
  });

  it('the textarea takes the pointer; every layer drawn over or beside the text lets it through', () => {
    assert.match(css, /\.el-input \{\s*pointer-events: auto;/);
    for (const sel of ['.el-fmt', '.el-seam', '.scene-no', '.dual-tag', '.sheet .el-format_cue::after']) {
      const i = css.indexOf(`${sel} {`);
      assert.ok(i >= 0, sel);
      assert.match(css.slice(i, css.indexOf('}', i)), /pointer-events: none;/, `${sel} is click-through`);
    }
    assert.match(css, /\.sheet \.el::before \{[^}]*pointer-events: none;/, 'the active-line rule too');
  });

  it('Action and Dialogue are spell-checked (so the menu has suggestions to show)', () => {
    assert.match(editor, /spellCheck=\{meta\.spellcheck\}\s*autoCorrect=\{meta\.spellcheck \? 'on' : 'off'\}/);
    assert.match(read('src/lib/screenplay.js'), /action: +\{[^}]*spellcheck: true/);
    assert.match(read('src/lib/screenplay.js'), /dialogue: +\{[^}]*spellcheck: true/);
  });
});
