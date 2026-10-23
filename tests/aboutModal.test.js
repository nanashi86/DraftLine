import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jsx = readFileSync(new URL('../src/components/HelpModal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/HelpModal.css', import.meta.url), 'utf8');
const about = jsx.slice(jsx.indexOf('className="hm-about"'));
const text = (src) => src.replace(/<\/?[a-z][^>]*>/g, '').replace(/\s+/g, ' ');

describe('About DraftLine', () => {
  it('keeps the order: title & version · description · Origin Story · Backup · storage facts · privacy note', () => {
    const at = (needle) => {
      const i = about.indexOf(needle);
      assert.ok(i >= 0, needle);
      return i;
    };
    const order = [
      at('className="hm-name"'), at('className="hm-version"'), at('A fast, distraction‑free screenwriting app using Courier Prime at 12 pt.'),
      at('className="hm-origin"'), at('Backup Project (.draftline)'), at('<dt>Storage</dt>'), at('<dt>Last saved</dt>'),
      at('<dt>This script</dt>'), at('<dt>Protected</dt>'), at('Everything runs locally'),
    ];
    for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `item ${i} out of order`);
  });

  it('the description: Courier Prime at 12 pt, native .draftline, Fountain or Final Draft', () => {
    const p = about.slice(about.indexOf('<p>'), about.indexOf('</p>'));
    assert.equal(text(p).trim(), 'A fast, distraction‑free screenwriting app using Courier Prime at 12 pt. Projects save in '
      + 'DraftLine’s native .draftline format and export to Fountain or Final Draft (.fdx).');
    assert.match(p, /native <b>\.draftline<\/b> format/);
  });

  it('the Origin Story reads exactly as written', () => {
    const block = about.slice(about.indexOf('className="hm-origin"'), about.indexOf('</section>'));
    const story = text(block.slice(block.indexOf('<p>'), block.indexOf('</p>'))).trim(); // the paragraph, not the signature after it
    assert.equal(story, 'I began storytelling at eight on my father’s electric typewriter. Decades later, while writing '
      + 'my first feature, What Happened to Haiti?, I refused to pay bloated subscriptions and drafted all six '
      + 'drafts in raw Google Docs. That grind taught me structure and what tools screenwriters truly need. So I built '
      + 'DraftLine: a clean, independent editor with dramatic architecture built right in.');
    assert.match(block, /<h3 id="hm-origin-title">Origin Story<\/h3>/);
    assert.match(block, /my first\s+feature, <em>What Happened to Haiti\?<\/em>, I refused/, 'the screenplay title is italic');
    assert.ok(!/features writers/.test(block));
  });

  it('the facts list leads with "Created by: Eric Lemaire Jr.", then the five storage rows, all one label width', () => {
    const facts = about.slice(about.indexOf('className="hm-facts"'), about.indexOf('</dl>'));
    const labels = [...facts.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
    assert.deepEqual(labels, ['Created by', 'Storage', 'Last saved', 'This script', 'Protected', 'Network']);
    assert.match(facts, /<dt>Created by<\/dt><dd>Eric Lemaire Jr\.<\/dd>/);
    assert.match(css, /\.hm-facts dt \{ flex: none; width: 92px;/);
    assert.ok(about.indexOf('className="hm-facts"') > about.indexOf('Backup Project (.draftline)'), 'below the backup box');
  });

  it('the story has comfortable line height and the About pane scrolls inside the dialog', () => {
    assert.match(css, /\.hm-origin p \{[^}]*line-height: 1\.7/);
    const pane = css.match(/^\.hm-about \{[^}]*\}/m)[0];
    assert.match(pane, /overflow: auto/);
    assert.match(pane, /min-height: 0/, 'can shrink in the flex dialog, so it scrolls instead of overflowing');
    assert.match(css, /\.hm-modal \{[^}]*max-height: min\(760px, calc\(100dvh - 32px\)\)/);
    // The dialog must not share the pane's class, or the whole dialog (header included) scrolls instead.
    assert.match(jsx, /className=\{`hm-modal is-\$\{kind\}`\}/);
    assert.match(css, /\.hm-modal\.is-about \{ width/);
  });
});

describe('About: Storage reflects folder sync', () => {
  const src = readFileSync(new URL('../src/components/HelpModal.jsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  it('synced: "Synced folder (<name>) · Dual-saved locally"; otherwise the browser library with its script count', () => {
    assert.match(src, /: storage\.sync\?\.active\s*\? `Synced folder \(\$\{storage\.sync\.folderName\}\) · Dual-saved locally`/);
    assert.match(src, /: 'Project library in this browser \(IndexedDB\)'\}/);
    assert.match(src, /\{!storage\.sync\?\.active && !storage\.sync\?\.needsPermission && lib\.count != null\s*&& ` · \$\{lib\.count\} \$\{lib\.count === 1 \? 'script' : 'scripts'\}`\}/);
    assert.match(app, /countProjects: \(\) => projects\.getAllProjects\(\)\.then\(\(l\) => l\.length\), sync \}\}/);
  });
  it('the note explains browser storage and synced folders', () => {
    const note = src.slice(src.lastIndexOf('<p className="hm-note">'), src.lastIndexOf('</p>')).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    assert.equal(note, 'Everything runs locally: nothing is uploaded and no account is needed, so writing works offline. The only '
      + 'network use is loading Google Fonts (cached after the first visit). By default, scripts belong to this browser profile. '
      + 'If you link a local or Google Drive folder, your scripts and snapshots save directly to disk with every edit. Without '
      + 'folder sync, clearing browser site data removes local drafts — so use Export (.draftline / .fountain / .fdx) or Backup '
      + 'Project to keep offline copies.');
    assert.ok(!/Your scripts belong to this browser on/.test(src));
  });
});
