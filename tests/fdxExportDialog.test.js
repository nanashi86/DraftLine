import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMPTY_META, META_FIELDS } from '../src/lib/projectStorage.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('File → Final Draft: Export Final Draft dialog', () => {
  const modal = read('components/ExportFdxModal.jsx');
  const app = read('App.jsx');
  it('one checkbox, Include margin notes, then Download .fdx; Cancel / Esc / backdrop close', () => {
    assert.match(modal, /<h2 id="xf-title" className="xp-title">Export Final Draft<\/h2>/);
    assert.match(modal, /<b>Include margin notes \(as Final Draft Script Notes\)<\/b>/);
    assert.match(modal, /<input type="checkbox" checked=\{includeNotes && !none\} disabled=\{none\} onChange=\{\(e\) => onChange\(e\.target\.checked\)\} \/>/);
    assert.match(modal, /Download \.fdx/);
    assert.match(modal, /onCancel=\{\(e\) => \{\s*e\.preventDefault\(\);\s*onClose\(\);/);
    assert.match(modal, /if \(e\.target === dialogRef\.current\) onClose\(\);/);
    assert.match(modal, /<Download \{\.\.\.ICON\} \/>/);
    assert.match(modal, /import '\.\/ExportPdfModal\.css';/, 'the same look as Export PDF');
  });
  it('says how many notes there are, and is disabled with none', () => {
    assert.match(modal, /'This script has no margin notes\.'/);
    assert.match(modal, /\$\{noteCount\} \$\{noteCount === 1 \? 'note' : 'notes'\} in this script\./);
  });
  it('File → Final Draft opens it; Download exports with the saved choice', () => {
    assert.match(app, /onFdx: \(\) => setFdxOpen\(true\),/);
    assert.match(app, /<ExportFdxModal\s*includeNotes=\{!!meta\.fdxIncludeNotes\}\s*noteCount=\{blocks\.filter\(\(b\) => b\.note\?\.trim\(\)\)\.length\}\s*onChange=\{setFdxNotes\}\s*onClose=\{\(\) => setFdxOpen\(false\)\}\s*onDownload=\{\(\) => \{\s*setFdxOpen\(false\);\s*exportFDX\(\);/);
    assert.match(app, /toFDX\(\{ meta, blocks \}, \{ includeNotes: !!meta\.fdxIncludeNotes \}\)/);
    assert.match(app, /const setFdxNotes = \(on\) => setMeta\(\(m\) => \(\{ \.\.\.m, fdxIncludeNotes: on \}\)\);/);
  });
  it('exporting another script from Projects follows that script’s own setting', () => {
    assert.match(app, /toFDX\(doc, \{ includeNotes: !!doc\.meta\.fdxIncludeNotes \}\)/);
  });
  it('a per-script setting, off for new and older scripts, saved with the project, backups and snapshot files', () => {
    assert.equal(EMPTY_META.fdxIncludeNotes, false);
    assert.ok(META_FIELDS.includes('fdxIncludeNotes'));
    assert.match(read('lib/folderSync.js'), /'showSceneNumbers', 'fdxIncludeNotes'\]/);
  });
  it('the User Guide explains the option and what doesn’t carry over to Final Draft', () => {
    const guide = read('content/userGuide.md');
    assert.match(guide, /### Final Draft \(\.fdx\)\n\n\*\*File → Final Draft\*\* opens \*\*Export Final Draft\*\*/);
    assert.match(guide, /\*\*Include margin notes \(as Final Draft Script Notes\)\*\*[^\n]*It's off by default/);
    assert.match(guide, /\*\*What doesn't carry over to Final Draft:\*\*/);
    for (const item of ['**Scene numbers** like 12A', '**Shots, act breaks and other special elements.**', "**Final Draft's own settings.**"]) assert.ok(guide.includes(item), item);
  });
});
