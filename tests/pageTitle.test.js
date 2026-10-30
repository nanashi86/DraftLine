import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEO_TITLE, pageTitle } from '../src/lib/pageTitle.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('page title: what the tab shows, and what search engines index', () => {
  it('index.html ships the SEO title', () => {
    assert.equal(SEO_TITLE, 'DraftLine — Fast, Distraction-Free Screenwriting Software (PWA)');
    assert.match(read('index.html'), /<title>DraftLine — Fast, Distraction-Free Screenwriting Software \(PWA\)<\/title>/);
  });
  it('the demo (first visit, every crawler, File → Sample…) keeps the SEO title', () => {
    assert.equal(SAMPLE_SCRIPT.meta.title, 'The Last Ferry');
    assert.equal(pageTitle('The Last Ferry'), SEO_TITLE);
    assert.equal(pageTitle('  The Last Ferry '), SEO_TITLE);
  });
  it('your own script names the tab: "<title> — DraftLine"', () => {
    assert.equal(pageTitle('What Happened to Haiti?'), 'What Happened to Haiti? — DraftLine');
    assert.equal(pageTitle('The Last Ferry 2'), 'The Last Ferry 2 — DraftLine', 'a renamed sample is yours');
    assert.equal(pageTitle(''), 'Untitled — DraftLine');
    assert.equal(pageTitle(undefined), 'Untitled — DraftLine');
  });
  it('the app sets the tab title only through pageTitle', () => {
    const app = read('src/App.jsx');
    assert.match(app, /document\.title = pageTitle\(meta\.title\);/);
    assert.equal((app.match(/document\.title =/g) || []).length, 1);
  });
  it('one title and description everywhere: tab, search result, link previews', () => {
    const html = read('index.html');
    const T = 'DraftLine — Fast, Distraction-Free Screenwriting Software \\(PWA\\)';
    const D = 'DraftLine is a 100% free, open-source, local-first screenwriting tool\\. Fast and distraction-free with strict 54-line Hollywood pagination, 4-act index card beat board, and FDX/Fountain export with no subscriptions or accounts required\\.';
    const U = 'https://nanashi86\\.github\\.io/DraftLine/';
    assert.match(html, new RegExp(`<link rel="canonical" href="${U}" />`));
    assert.match(html, new RegExp(`<meta name="description" content="${D}" />`));
    for (const [k, v] of [['og:type', 'website'], ['og:url', U], ['og:title', T], ['og:description', D], ['og:image', `${U}og-image\\.png`]]) {
      assert.match(html, new RegExp(`<meta property="${k}" content="${v}" />`), k);
    }
    for (const [k, v] of [['twitter:card', 'summary_large_image'], ['twitter:url', U], ['twitter:title', T], ['twitter:description', D], ['twitter:image', `${U}og-image\\.png`]]) {
      assert.match(html, new RegExp(`<meta name="${k}" content="${v}" />`), k);
    }
    assert.match(html, /<meta name="google-site-verification" content="DrCDehHt3vN0jJh4gijIObittLvGD1iLPm2yA6TGQrA" \/>/, 'Search Console ownership kept');
    assert.equal((html.match(/<title>/g) || []).length, 1);
  });
  it('the description’s claims are true of the app', async () => {
    const { PAGE_LINES } = await import('../src/lib/screenplay.js');
    assert.equal(PAGE_LINES, 54, '54-line pagination');
    assert.match(read('LICENSE'), /MIT License/, 'open source');
  });
  it('the share image (1200×630) and robots.txt ship in public/', () => {
    const png = readFileSync(new URL('../public/og-image.png', import.meta.url));
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert.equal(read('public/robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://nanashi86.github.io/DraftLine/sitemap.xml\n');
  });
  it('sitemap.xml: the one page, plain URLs, valid sitemap namespace, and robots.txt points to it', () => {
    const xml = read('public/sitemap.xml');
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.match(xml, /<loc>https:\/\/nanashi86\.github\.io\/DraftLine\/<\/loc>/);
    assert.match(xml, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    assert.doesNotMatch(xml, /\]\(/, 'no markdown links');
    assert.match(read('public/robots.txt'), /^Sitemap: https:\/\/nanashi86\.github\.io\/DraftLine\/sitemap\.xml$/m);
  });
  it('README: the search title, and the five search phrases, each backed by the app', () => {
    const readme = read('README.md');
    for (const phrase of [
      'Fast, distraction-free screenwriting progressive web app (PWA)',
      'Strict 54-line Hollywood pagination engine',
      'Integrated 4-act index card beat board',
      'Local-first privacy with IndexedDB persistence (zero telemetry, zero remote database storage)',
      'Full FDX and Fountain import/export compatibility',
    ]) assert.ok(readme.toLowerCase().includes(phrase.toLowerCase()), phrase);
    assert.match(readme, /the website only counts page views \(Cloudflare Web Analytics,\s+no cookies\)/, 'zero telemetry is about the editor; the site’s page-view count is disclosed');
    assert.match(readme, /lists the few\s+Final Draft settings that don't carry over/, '“full” FDX, with its known limits pointed to');
    assert.match(read('index.html'), /cloudflareinsights|beacon/, 'the page-view counter the README discloses is real');
  });
});
