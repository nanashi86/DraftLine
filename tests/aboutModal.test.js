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

  it('the Backup Project box says what the download includes', () => {
    const box = about.slice(about.indexOf('className="hm-backup"'), about.indexOf('</div>', about.indexOf('className="hm-backup"')));
    const note = text(box.slice(box.indexOf('<span>'), box.indexOf('</span>'))).trim();
    assert.equal(note, 'Downloads this script complete — Title Page, Scene Board, Story Bible and Outline included — to restore '
      + 'here or on any other browser.');
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
    assert.match(src, /const \[credits, setCredits\] = useState\(\(\) => normalizeCredits\(null\)\);/);
    assert.match(src, /if \(kind !== 'about'\) return undefined;[\s\S]*?loadCredits\(CREDITS_URL, \{ signal: ctrl\.signal \}\)[\s\S]*?return \(\) => ctrl\.abort\(\);/);
    assert.match(src, /<Credits credits=\{credits\} \/>/);
    const json = JSON.parse(readFileSync(new URL('../public/credits.json', import.meta.url), 'utf8'));
    for (const k of ['catalyst', 'executiveProducers', 'screeningRoom']) assert.ok(Array.isArray(json[k]), k);
  });
  it('CREDITS, then The Catalyst (only when someone is in it) · Executive Producers · The Screening Room', () => {
    const block = src.slice(src.indexOf('function Credits('), src.indexOf('function fmtBytes('));
    assert.match(src, /<h3 id="hm-credits-title" className="hm-credits-title">Credits<\/h3>/);
    const heads = [...block.matchAll(/<h4>([^<]+)<\/h4>\s*<p className="hm-credits-sub">([^<]+)<\/p>/g)].map((m) => `${m[1]} / ${m[2]}`);
    assert.deepEqual(heads, ['The Catalyst / First Supporter', 'Executive Producers / Executive Support', 'The Screening Room / Community Supporters']);
    assert.match(block, /\{catalyst\.length > 0 && \(/, 'The Catalyst is left out while empty');
    assert.match(block, /: <Invite>Become an Executive Producer on Patreon<\/Invite>/);
    assert.match(block, /: <Invite>Take a seat in the Screening Room on Patreon<\/Invite>/);
    assert.match(src, /<a href=\{PATREON_URL\} target="_blank" rel="noopener noreferrer">\{children\}<\/a>/);
    assert.match(block, /<ul className="hm-credits-grid">/);
  });
  it('styling: CREDITS in spaced Courier Prime, a card for The Catalyst, warm producers, a grid for the room', () => {
    assert.match(css, /\.hm-credits \{[^}]*text-align: center/);
    assert.match(css, /\.hm-credits h3\.hm-credits-title \{[^}]*'Courier Prime'[^}]*letter-spacing: 0\.4em/);
    assert.match(css, /\.hm-credits-sec\.is-catalyst \{[^}]*border-radius/);
    assert.match(css, /\.hm-credits-sec\.is-producers ul \{[^}]*color: color-mix\(in srgb, var\(--accent\)/);
    assert.match(css, /\.hm-credits-grid \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(130px, 1fr\)\)/);
    assert.match(css, /\.hm-credits-sec ul \{[^}]*'Courier Prime'/);
    assert.match(css, /@media \(max-width: 520px\) \{\s*\.hm-links \{ grid-template-columns: 1fr; \}/);
    assert.ok(!/hm-credits-tier|hm-credits-empty/.test(css + src), 'the old two-tier styles are gone');
  });
});

describe('Credits: lib/credits.js', async () => {
  const { normalizeCredits, loadCredits, hasNoCredits } = await import('../src/lib/credits.js');
  const none = { catalyst: [], executiveProducers: [], screeningRoom: [] };
  it('three lists of names; strings or { name } objects; junk and duplicates dropped, order kept', () => {
    assert.deepEqual(normalizeCredits({
      catalyst: ['First Fan'],
      executiveProducers: ['Jane Doe', { name: '  John   Roe ' }, '', 42, null, { tier: 'x' }, 'jane doe'],
      screeningRoom: ['B', 'A', 'x'.repeat(200)],
    }), { catalyst: ['First Fan'], executiveProducers: ['Jane Doe', 'John Roe'], screeningRoom: ['B', 'A', 'x'.repeat(80)] });
    for (const bad of [null, undefined, 'nope', {}, { catalyst: 'x' }]) assert.deepEqual(normalizeCredits(bad), none);
    assert.ok(hasNoCredits(normalizeCredits({})) && !hasNoCredits(normalizeCredits({ screeningRoom: ['A'] })));
  });
  it('an older file with one "producers" list still reads, as Executive Producers', () => {
    assert.deepEqual(normalizeCredits({ updated: '2026-10-23', producers: ['Eric Lemaire', ''] }).executiveProducers, ['Eric Lemaire']);
  });
  it('loading never rejects: offline, 404 and bad JSON all give empty sections', async () => {
    const ok = (body) => async () => ({ ok: true, json: async () => body });
    assert.deepEqual(await loadCredits('c.json', { fetchImpl: ok({ catalyst: ['A'] }) }), { ...none, catalyst: ['A'] });
    assert.deepEqual(await loadCredits('c.json', { fetchImpl: async () => { throw new TypeError('offline'); } }), none);
    assert.deepEqual(await loadCredits('c.json', { fetchImpl: async () => ({ ok: false, status: 404 }) }), none);
    assert.deepEqual(await loadCredits('c.json', { fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } }) }), none);
  });
  it('the service worker fetches credits.json network-first, cached copy offline', () => {
    const sw = readFileSync(new URL('../src/pwa/sw.template.js', import.meta.url), 'utf8');
    const rule = sw.indexOf("url.pathname.endsWith('/credits.json')");
    assert.ok(rule > 0 && rule < sw.indexOf('// Built files and icons: cache first'), 'checked before the cache-first rule');
    assert.match(sw.slice(rule), /const res = await fetch\(req\);\s*if \(res\.ok\) cache\.put\('\.\/credits\.json', res\.clone\(\)\);[\s\S]*?catch \{\s*return \(await cache\.match\('\.\/credits\.json'/);
  });
});
