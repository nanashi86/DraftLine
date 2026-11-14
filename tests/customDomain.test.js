// DraftLine is served at the root of draftlineapp.com (GitHub Pages custom domain). The deploy wipes the gh-pages
// branch each time, so public/CNAME must ship with every build, and nothing public may still point at the old address.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ORIGIN = 'https://draftlineapp.com/';

describe('Custom domain: draftlineapp.com', () => {
  it('public/CNAME names the domain, so each deploy keeps it set', () => {
    assert.equal(read('public/CNAME').trim(), 'draftlineapp.com');
  });

  it('builds for the domain root', () => {
    assert.match(read('vite.config.js'), /\bbase: '\/',/);
  });

  it('canonical, link previews, structured data, robots and sitemap all use the domain', () => {
    const html = read('index.html');
    assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN}"`));
    for (const p of ['og:url', 'og:image', 'twitter:url', 'twitter:image']) {
      assert.match(html, new RegExp(`(property|name)="${p}" content="${ORIGIN}`), p);
    }
    assert.match(read('public/robots.txt'), new RegExp(`Sitemap: ${ORIGIN}sitemap\\.xml`));
    assert.match(read('public/sitemap.xml'), new RegExp(`<loc>${ORIGIN}</loc>`));
  });

  it('nothing the site serves, and no README link, points at the old GitHub Pages address', () => {
    const files = ['index.html', 'README.md', 'package.json', ...readdirSync(new URL('../public', import.meta.url))
      .filter((f) => /\.(json|txt|xml|html|webmanifest)$/.test(f)).map((f) => 'public/' + f)];
    for (const f of files) assert.doesNotMatch(read(f), /nanashi86\.github\.io/, f);
  });

  it('the manifest stays relative, so the installed app follows the domain', () => {
    const m = JSON.parse(read('public/manifest.json'));
    for (const k of ['id', 'start_url', 'scope']) assert.equal(m[k], './', k);
  });
});
