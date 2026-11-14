import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('features page: a static, crawlable description of every tool', () => {
  const html = read('public/features/index.html');
  it('has its own title, description and canonical on the domain', () => {
    assert.match(html, /<title>DraftLine Features — Free Screenwriting Software<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]{80,}"/);
    assert.match(html, /<link rel="canonical" href="https:\/\/draftlineapp\.com\/features\/" \/>/);
  });
  it('one h2 per tool, each with an anchor the table of contents links to', () => {
    const ids = [...html.matchAll(/<section id="([a-z-]+)">\s*<h2>/g)].map((m) => m[1]);
    for (const id of ['writing', 'pagination', 'files', 'scene-board', 'format-doctor', 'dialogue', 'characters', 'story-bible', 'snapshots', 'plan', 'storage', 'privacy']) {
      assert.ok(ids.includes(id), id);
      assert.match(html, new RegExp(`href="#${id}"`));
    }
  });
  it("is in the sitemap, the README links it, and it respects the admin's analytics opt-out", () => {
    assert.match(read('public/sitemap.xml'), /<loc>https:\/\/draftlineapp\.com\/features\/<\/loc>/);
    assert.match(read('README.md'), /\(https:\/\/draftlineapp\.com\/features\/\)/);
    assert.match(html, /localStorage\.getItem\('draftline_is_admin'\) === 'true'\) return;/);
  });
  it('the structured data feature list names the tools', () => {
    const ld = JSON.parse(read('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const list = ld.featureList.join(' | ');
    for (const tool of ['Format Doctor', 'Dialogue Tuner', 'Story Bible', 'stripboard', 'Scene Board']) assert.ok(list.includes(tool), tool);
  });
});

describe('service worker: only the app page refreshes the offline shell', () => {
  const sw = read('src/pwa/sw.template.js');
  it('caches index.html only for the app root', () => {
    assert.match(sw, /const isApp = url\.pathname === root \|\| url\.pathname === `\$\{root\}index\.html`;/);
    assert.match(sw, /if \(res\.ok && isApp\) cache\.put\('\.\/index\.html', res\.clone\(\)\);/);
  });
  it("offline, another page is served from its own precached copy first", () => {
    assert.match(sw, /url\.pathname\.endsWith\('\/'\) \? `\$\{url\.pathname\}index\.html` : url\.pathname/);
  });
});
