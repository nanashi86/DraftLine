import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import mammoth from 'mammoth';
import { docxHtmlToScript, docxToScriptText } from '../src/lib/docxImport.js';
import { parseTextScript } from '../src/lib/textScriptParser.js';
import { auditScript } from '../src/lib/formatDoctor.js';

const fixture = readFileSync(new URL('./fixtures/the-last-ferry.docx', import.meta.url));
const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('.docx import: Word paragraphs → lines → elements', () => {
  it('a real .docx goes through mammoth and the element parser without errors', async () => {
    const { text } = await docxToScriptText({ buffer: fixture }, mammoth);
    const { blocks, meta } = parseTextScript(text);
    assert.equal(meta.title, 'THE LAST FERRY');
    assert.equal(meta.author, 'Marie Lemaire');
    assert.deepEqual(blocks.map((b) => [b.type, b.text]), [
      ['scene', 'EXT. CROIX-DES-BOSSALES - NIGHT (FLASHBACK)'],
      ['action', 'Rain hammers the tin roofs. A ferry horn, far off.'],
      ['character', 'MARIE'], ['parenthetical', '(quietly)'], ['dialogue', 'We turn back.'],
      ['character', 'THEO'], ['dialogue', 'Not tonight.'],
      ['scene', 'INT. CAR (MOVING) - DAY'],
      ['action', 'Engine noise.'],
    ]);
    assert.deepEqual(auditScript(blocks), [], 'and the Format Doctor finds nothing to fix');
  });
  it('one line per paragraph; empty paragraphs become one blank line; Shift+Enter stays a line break', () => {
    const html = '<p>INT. KITCHEN - NIGHT</p><p></p><p></p><p>Rosa stirs a pot.</p><p></p><p>ROSA<br />You&#39;re late &amp; wet.</p>';
    assert.equal(docxHtmlToScript(html), "INT. KITCHEN - NIGHT\n\nRosa stirs a pot.\n\nROSA\nYou're late & wet.");
  });
  it('Word’s non-breaking spaces, entities and trailing spaces are tidied; headings and lists end a line', () => {
    assert.equal(docxHtmlToScript('<p>A B&nbsp;C   </p><h1>FADE IN:</h1><ul><li>One</li></ul>'), 'A B C\nFADE IN:\nOne');
    assert.equal(docxHtmlToScript(''), '');
  });
  it('an unreadable file gives a message the writer can act on', async () => {
    await assert.rejects(() => docxToScriptText({ buffer: Buffer.from('not a zip') }, mammoth), /couldn’t be read.*Save As.*\.docx/);
  });
});

describe('Import dialog and File ▾ → Open… take .docx', () => {
  const modal = read('components/ImportModal.jsx');
  it('accepts Word, Final Draft, Fountain, text and backups', () => {
    assert.match(modal, /const ACCEPT = '\.docx,\.fdx,\.fountain,\.txt,\.draftline,application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document';/);
    assert.match(modal, /accept=\{ACCEPT\}/);
  });
  it('the drop target says what it takes', () => {
    assert.match(modal, /Drop your script or backup file here, or\{' '\}/);
    assert.match(modal, /From Word, Final Draft, Google Docs, Fountain, or plain text\. Nothing changes until you load it\./);
  });
  it('.docx: read as an ArrayBuffer (FileReader), text from mammoth, then the same preview as pasted text', () => {
    assert.match(modal, /await docxToScriptText\(await readAsArrayBuffer\(file\)\)/);
    assert.match(read('lib/docxImport.js'), /reader\.readAsArrayBuffer\(file\)/);
    assert.match(read('lib/docxImport.js'), /await import\('mammoth'\)/, 'loaded only when needed');
    assert.match(modal, /setText\(extracted\)/);
  });
  it('.fdx previews element by element; .draftline still restores; .doc / .pdf explain what to do', () => {
    assert.match(modal, /setText\(toFountain\(parsed\)\)/);
    assert.match(modal, /\/\\\.draftline\$\/i\.test\(file\.name\)[\s\S]*onBackup/);
    assert.match(modal, /older Word file \(\.doc\)/);
  });
  it('File ▾ → Open… takes a .docx and hands its text to the importer', () => {
    const app = read('App.jsx');
    assert.match(app, /accept="\.fountain,\.spmd,\.txt,\.fdx,\.docx,\.draftline"/);
    assert.match(app, /if \(\/\\\.docx\$\/i\.test\(file\.name\)\) \{[\s\S]{0,300}setImportSeed\(\{ text: extracted, name: file\.name \}\)/);
  });
  it('mammoth is a pinned dependency', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(pkg.dependencies.mammoth, /^\d+\.\d+\.\d+$/);
  });
});

describe('Load into Editor / Append: the import lands where you can see it', () => {
  const app = read('App.jsx');
  const fn = app.slice(app.indexOf('const importScript = ('), app.indexOf('const printScript = '));
  it('commits the previewed elements in the editor’s shape; unknown types become Action; an empty preview commits nothing', () => {
    assert.match(fn, /makeBlock\(ELEMENT_META\[b\.type\] \? b\.type : 'action', b\.text, blockExtras\(b\)\)/);
    assert.match(fn, /if \(mode === 'append'\) set\(\(prev\) => \[\.\.\.prev, \.\.\.incoming\]\);\s*else set\(incoming\);/);
    assert.match(fn, /if \(!incoming\.length\) \{\s*notify\('Nothing to import/);
  });
  it('then: Write (out of Plan), the page (out of the Board), page 1 with the cursor in the first element', () => {
    assert.match(fn, /setWorkspace\('write'\);/);
    assert.match(fn, /if \(view === 'board'\) setView\('page'\);/);
    assert.match(fn, /setActiveId\(first\.id\);/);
    assert.match(fn, /scrollerEl\.current\.scrollTop = 0;\s*editorRef\.current\?\.focusBlock\(first\.id, \{ scroll: false, at: 'start' \}\);/);
    assert.match(fn, /if \(mode === 'append'\) \{\s*editorRef\.current\?\.focusBlock\(first\.id, \{ at: 'start' \}\);/, 'appending: the first appended element');
    assert.match(read('components/Editor.jsx'), /focusBlock\(id, \{ scroll = true, at = 'end' \} = \{\}\)/);
  });
  it('the dialog hands over exactly what it previews', () => {
    const modal = read('components/ImportModal.jsx');
    assert.match(modal, /onImport\(\{\s*blocks,\s*meta: useTitle && hasTitle \? meta : null,\s*mode,\s*stats,\s*\}\);/);
    assert.match(modal, /onClick=\{\(\) => submit\('replace'\)\}/);
    assert.match(modal, /onClick=\{\(\) => submit\('append'\)\}/);
  });
});
