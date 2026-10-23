import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jsx = readFileSync(new URL('../src/components/HelpModal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/HelpModal.css', import.meta.url), 'utf8');
const about = jsx.slice(jsx.indexOf('className="hm-about"'));
const text = (src) => src.replace(/<\/?[a-z][^>]*>/g, '').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('About DraftLine', () => {
  it('keeps the order: title & version · description · Origin Story · Backup · community · credits · facts · privacy card', () => {
    const at = (needle) => {
      const i = about.indexOf(needle);
      assert.ok(i >= 0, needle);
      return i;
    };
    const order = [
      at('className="hm-name"'), at('className="hm-version"'), at('A fast, distraction‑free screenwriting app using Courier Prime at 12 pt.'),
      at('className="hm-origin"'), at('Backup Project (.draftline)'), at('className="hm-community"'), at('className="hm-credits"'),
      at('<dt>Storage</dt>'), at('<dt>Last saved</dt>'), at('<dt>This script</dt>'), at('<dt>Protected</dt>'), at('className="hm-privacy"'),
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
    assert.equal(story, 'I began storytelling at eight on my father\'s electric typewriter. Decades later, while writing '
      + 'my first feature, What Happened to Haiti?, I refused to pay bloated subscriptions and drafted all six '
      + 'drafts in raw Google Docs. That grind taught me structure and what tools screenwriters truly need. So I built '
      + 'DraftLine: a clean, independent editor with dramatic architecture built right in.');
    assert.match(block, /<h3 id="hm-origin-title">Origin Story<\/h3>/);
    assert.match(block, /my first\s+feature, <em>What Happened to Haiti\?<\/em>, I refused/, 'the screenplay title is italic');
    assert.ok(!/features writers/.test(block));
    assert.match(block, /my father&apos;s electric typewriter/, 'apostrophe as a JSX entity');
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
  it('the privacy card: three short points instead of the long note', () => {
    const card = src.slice(src.indexOf('className="hm-privacy"'), src.indexOf('</section>', src.indexOf('className="hm-privacy"')));
    const points = [...card.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    assert.deepEqual(points, [
      '100% Local: Scripts never touch an external server; zero cloud telemetry or account logins.',
      'Drive Sync: Linking a Google Drive or local folder autosaves changes and snapshots straight to disk.',
      'Browser Data Notice: Clearing browser site data removes local drafts unless synced or backed up via .draftline, .fountain, or .fdx.',
    ]);
    assert.ok(!/Everything runs locally/.test(src), 'the old paragraph is gone');
  });
});

describe('About: Support & Community and the credits roll', () => {
  const src = readFileSync(new URL('../src/components/HelpModal.jsx', import.meta.url), 'utf8');
  it('four links, each opening in a new tab safely, with Lucide icons (no emoji)', () => {
    const links = [...src.matchAll(/\{ href: '([^']+)', label: '([^']+)', sub: (?:'([^']+)'|"([^"]+)"), Icon: (\w+) \}/g)]
      .map((m) => [m[1], m[2], m[3] || m[4], m[5]]);
    assert.deepEqual(links, [
      ['https://ko-fi.com/draftline', 'Ko-fi', '$99 Desktop Milestone', 'Coffee'],
      ['https://patreon.com/DraftLine', 'Patreon', 'Monthly Tiers & Roadmap', 'Heart'],
      ['https://discord.gg/8ytSsSWsPX', 'Discord', "Writers' Room", 'MessageCircle'],
      ['https://github.com/nanashi86/DraftLine', 'GitHub', 'Source & Issues', 'CodeXml'],
    ]);
    assert.match(src, /<a className="hm-pill" href=\{href\} target="_blank" rel="noopener noreferrer">/);
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(src), 'no emoji');
  });
  it('credits come from public/credits.json, fetched under the app\'s base path when About opens', () => {
    assert.ok(!/patreonCredits/.test(src), 'no names hard-coded in the component');
    assert.match(src, /const CREDITS_URL = `\$\{import\.meta\.env\.BASE_URL\}credits\.json`;/);
    assert.match(src, /const \[credits, setCredits\] = useState\(\[\]\);/);
    assert.match(src, /if \(kind !== 'about'\) return undefined;[\s\S]*?loadCredits\(CREDITS_URL, \{ signal: ctrl\.signal \}\)[\s\S]*?return \(\) => ctrl\.abort\(\);/);
    assert.match(src, /<Credits credits=\{credits\} \/>/);
    const json = JSON.parse(readFileSync(new URL('../public/credits.json', import.meta.url), 'utf8'));
    assert.match(json.updated, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Array.isArray(json.producers));
  });
  it('an empty roll shows the Patreon invitation', () => {
    const empty = src.slice(src.indexOf('className="hm-credits-empty"'), src.indexOf('</p>', src.indexOf('className="hm-credits-empty"')));
    assert.equal(empty.replace(/<[^>]+>/g, '').replace(/\{' '\}/g, ' ').replace(/\s+/g, ' ').replace(/^[^>]*>/, '').trim(),
      'Special thanks to our early community backers. Join on Patreon to have your name credited inside every build.');
    assert.match(empty, /<a href=\{PATREON_URL\} target="_blank" rel="noopener noreferrer">Join on Patreon<\/a>/);
  });
  it('names roll centred in Courier Prime; the grid goes to one column on phones', () => {
    assert.match(css, /\.hm-credits \{[^}]*text-align: center/);
    assert.match(css, /\.hm-credits-tier ul \{[^}]*'Courier Prime'/);
    assert.match(css, /@media \(max-width: 520px\) \{\s*\.hm-links \{ grid-template-columns: 1fr; \}/);
  });
});

describe('Credits: lib/credits.js', async () => {
  const { normalizeCredits, loadCredits } = await import('../src/lib/credits.js');
  it('plain names are Executive Producers; objects can name a tier; junk is dropped', () => {
    assert.deepEqual(normalizeCredits({ producers: [
      'Jane Doe', { name: '  John   Roe ', tier: 'Patron' }, { name: 'Ann Lee', tier: 'Wizard' },
      '', 42, null, { tier: 'Patron' }, 'jane doe', 'x'.repeat(200),
    ] }), [
      { name: 'Jane Doe', tier: 'Executive Producer' },
      { name: 'John Roe', tier: 'Patron' },
      { name: 'Ann Lee', tier: 'Executive Producer' },
      { name: 'x'.repeat(80), tier: 'Executive Producer' },
    ]);
    for (const bad of [null, undefined, 'nope', {}, { producers: 'x' }]) assert.deepEqual(normalizeCredits(bad), []);
  });
  it('loading never rejects: offline, 404 and bad JSON all give []', async () => {
    const ok = (body) => async () => ({ ok: true, json: async () => body });
    assert.deepEqual(await loadCredits('c.json', { fetchImpl: ok({ producers: ['A'] }) }), [{ name: 'A', tier: 'Executive Producer' }]);
    assert.deepEqual(await loadCredits('c.json', { fetchImpl: async () => { throw new TypeError('offline'); } }), []);
    assert.deepEqual(await loadCredits('c.json', { fetchImpl: async () => ({ ok: false, status: 404 }) }), []);
    assert.deepEqual(await loadCredits('c.json', { fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } }) }), []);
  });
  it('the service worker fetches credits.json network-first, cached copy offline', () => {
    const sw = readFileSync(new URL('../src/pwa/sw.template.js', import.meta.url), 'utf8');
    const rule = sw.indexOf("url.pathname.endsWith('/credits.json')");
    assert.ok(rule > 0 && rule < sw.indexOf('// Built files and icons: cache first'), 'checked before the cache-first rule');
    assert.match(sw.slice(rule), /const res = await fetch\(req\);\s*if \(res\.ok\) cache\.put\('\.\/credits\.json', res\.clone\(\)\);[\s\S]*?catch \{\s*return \(await cache\.match\('\.\/credits\.json'/);
  });
});
