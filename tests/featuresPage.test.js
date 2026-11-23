import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('features page: a static, crawlable description of every tool', () => {
  const html = read('public/features/index.html');
  it('has its own title, description and canonical on the domain', () => {
    assert.match(html, /<title>DraftLine — Explore Features — Screenwriting Tools<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]{80,}"/);
    assert.match(html, /<link rel="canonical" href="https:\/\/draftlineapp\.com\/features\/" \/>/);
  });
  it('one h2 per tool, each with an anchor the table of contents links to', () => {
    const ids = [...html.matchAll(/<section id="([a-z-]+)">\s*<h2>/g)].map((m) => m[1]);
    for (const id of ['writing', 'pagination', 'files', 'scene-board', 'format-doctor', 'dialogue', 'table-read', 'characters', 'story-bible', 'snapshots', 'plan', 'storage', 'privacy']) {
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
    const list = ld['@graph'][0].featureList.join(' | ');
    for (const tool of ['Format Doctor', 'Dialogue Tuner', 'Story Bible', 'stripboard', 'Scene Board', 'Table Read']) assert.ok(list.includes(tool), tool);
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

describe('features page → app, and About → features page', () => {
  it('Open DraftLine buttons go to the app with from=features and pass the ad click identifiers along', () => {
    const html = read('public/features/index.html');
    assert.equal((html.match(/<a class="cta" data-open-app href="\/\?from=features">Open DraftLine<\/a>/g) || []).length, 2);
    assert.match(html, /\/\^\(gclid\|gbraid\|wbraid\|utm_\[a-z\]\+\)\$\//);
  });
  it('About links to the Philosophy page first ("Core Philosophy"), in a new tab, with the external-link icon', () => {
    const about = readFileSync(new URL('../src/components/HelpModal.jsx', import.meta.url), 'utf8');
    assert.match(about, /<p className="hm-features">\s*<a href=\{`\$\{import\.meta\.env\.BASE_URL\}philosophy\/`\} target="_blank" rel="noopener"\s*onClick=\{\(e\) => openInThemedTab\(e, e\.currentTarget\.href\)\}>\s*Core Philosophy\s*<ExternalLink size=\{12\} strokeWidth=\{1\.75\} aria-hidden \/>\s*<\/a>\s*<a href=\{`\$\{import\.meta\.env\.BASE_URL\}features\/`\}/);
  });
  it('About has "Explore Features" and "Compare DraftLine" links, in new tabs, with the external-link icon', () => {
    assert.match(read('src/components/HelpModal.jsx'),
      /<a href=\{`\$\{import\.meta\.env\.BASE_URL\}features\/`\} target="_blank" rel="noopener"\s*onClick=\{\(e\) => openInThemedTab\(e, e\.currentTarget\.href\)\}>\s*Explore Features\s*<ExternalLink size=\{12\} strokeWidth=\{1\.75\} aria-hidden \/>\s*<\/a>/);
    assert.match(read('src/components/HelpModal.jsx'),
      /<a href=\{`\$\{import\.meta\.env\.BASE_URL\}compare\/`\} target="_blank" rel="noopener"\s*onClick=\{\(e\) => openInThemedTab\(e, e\.currentTarget\.href\)\}>\s*Compare DraftLine\s*<ExternalLink size=\{12\} strokeWidth=\{1\.75\} aria-hidden \/>\s*<\/a>/);
  });
});
