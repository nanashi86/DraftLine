// Search engines and AI assistants: the public pages describe the same DraftLine, accurately, and the
// editor's page (index.html) still opens straight into the app.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const PAGES = { '/': 'index.html', '/features/': 'public/features/index.html', '/compare/': 'public/compare/index.html' };
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const meta = (html, attr, name) => html.match(new RegExp(`<meta ${attr}="${name.replace(/[:.]/g, '\\$&')}" content="([^"]*)"`))?.[1];

describe('the public pages', () => {
  for (const [path, file] of Object.entries(PAGES)) {
    it(`${path}: canonical, description, Open Graph and structured data`, () => {
      const html = read(file);
      const url = `https://draftlineapp.com${path}`;
      assert.match(html, new RegExp(`<link rel="canonical" href="${url}" />`));
      assert.equal(meta(html, 'property', 'og:url'), url);
      const d = meta(html, 'name', 'description');
      assert.ok(d && d.length >= 70 && d.length <= 300, `description length ${d?.length}`);
      assert.ok(jsonLd(html).length >= 1, 'has JSON-LD');
      assert.doesNotMatch(html, /github\.io/, 'no old github.io links');
    });
  }

  it('every page points to the same app and website IDs', () => {
    const [root] = jsonLd(read('index.html'));
    const ids = root['@graph'].map((n) => n['@id']);
    assert.deepEqual(ids, ['https://draftlineapp.com/#app', 'https://draftlineapp.com/#website']);
    for (const f of ['public/features/index.html', 'public/compare/index.html']) {
      const [page] = jsonLd(read(f));
      assert.equal(page.about['@id'], 'https://draftlineapp.com/#app');
      assert.equal(page.isPartOf['@id'], 'https://draftlineapp.com/#website');
    }
  });

  it('the app\'s structured data: free, MIT, the real version, no invented ratings', () => {
    const app = jsonLd(read('index.html'))[0]['@graph'][0];
    assert.equal(app['@type'], 'WebApplication');
    assert.equal(app.softwareVersion, pkg.version, 'softwareVersion follows package.json');
    assert.equal(app.offers.price, '0');
    assert.equal(app.license, 'https://opensource.org/licenses/MIT');
    assert.equal(app.author.name, 'NANASHI86');
    assert.ok(!('aggregateRating' in app) && !('review' in app));
    assert.ok(app.featureList.some((f) => /phone/i.test(f)));
    assert.ok(app.featureList.some((f) => /Linked-folder sync in Chrome or Edge on a computer/.test(f)), 'folder sync is desktop-only');
    for (const s of app.screenshot) assert.ok(existsSync(new URL(`../public${new URL(s).pathname}`, import.meta.url)), s);
  });

  it('the title stays the approved one', () => {
    assert.match(read('index.html'), /<title>DraftLine — Free Screenwriting Software<\/title>/);
  });

  it('the editor page: an empty root for the app, and a plain description only for JavaScript-off browsers', () => {
    const html = read('index.html');
    assert.match(html, /<body>\s*<div id="root"><\/div>/);
    const ns = html.slice(html.indexOf('<body>')).match(/<noscript>([\s\S]*?)<\/noscript>/)[1];
    assert.match(ns, /free, open-source \(MIT\) screenwriting app/);
    assert.doesNotMatch(ns, /not available|unavailable|enable javascript|please turn on/i);
    assert.doesNotMatch(ns, /<script|<img/i);
  });
});

describe('phone claims stay accurate', () => {
  it('features/ describes the phone view and says folder linking is for a computer', () => {
    const html = read('public/features/index.html');
    assert.match(html, /<section id="phone">/);
    assert.match(html, /Linking a folder is for Chrome or Edge on a computer/);
    assert.doesNotMatch(html, /folder[^.]*on (your|a) phone/i);
  });
  it('README has a phone section with the same limit', () => {
    const md = read('README.md');
    assert.match(md, /^## Writing on a phone$/m);
    assert.match(md, /linking a folder needs Chrome or Edge on a computer/);
  });
});

describe('sitemap, robots, llms.txt and manifest', () => {
  it('the sitemap lists every public page, each one present in the build', () => {
    const xml = read('public/sitemap.xml');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.deepEqual(locs, Object.keys(PAGES).map((p) => `https://draftlineapp.com${p}`));
    for (const f of Object.values(PAGES)) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
    for (const m of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) assert.match(m[1], /^\d{4}-\d{2}-\d{2}$/);
  });
  it('robots.txt lets every crawler in and names the sitemap', () => {
    const r = read('public/robots.txt');
    assert.match(r, /User-agent: \*\nAllow: \//);
    assert.doesNotMatch(r, /Disallow: \/\s*$/m);
    assert.match(r, /Sitemap: https:\/\/draftlineapp\.com\/sitemap\.xml/);
  });
  it('llms.txt: a title, a summary, and only draftlineapp.com or the GitHub repo as links', () => {
    const t = read('public/llms.txt');
    assert.match(t, /^# DraftLine\n\n> /);
    for (const [, url] of t.matchAll(/(https?:\/\/[^\s)]+)/g)) assert.match(url, /^https:\/\/(draftlineapp\.com\/|github\.com\/nanashi86\/DraftLine)/);
    assert.match(t, /not on phones/);
  });
  it('the manifest keeps its identity and install behavior; screenshots are real files', () => {
    const m = JSON.parse(read('public/manifest.json'));
    assert.deepEqual([m.name, m.short_name, m.id, m.start_url, m.scope, m.display], ['DraftLine', 'DraftLine', './', './', './', 'standalone']);
    assert.deepEqual(m.screenshots.map((s) => s.form_factor), ['wide', 'narrow']);
    for (const s of m.screenshots) assert.ok(existsSync(new URL(`../public/${s.src.replace('./', '')}`, import.meta.url)), s.src);
  });
});

describe('the comparison page stays complete and fair', () => {
  const html = read('public/compare/index.html');
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  it('positions DraftLine for independent writers, never as "one writer and one script"', () => {
    assert.doesNotMatch(text, /one writer and one script/i);
    assert.match(text, /designed first for independent writers/);
  });
  it('a compact table: these seven rows, each with all six products', () => {
    const rows = [...html.matchAll(/<tr><th scope="row">([^<]+)<\/th>((?:<td[^>]*>[^<]*(?:<[^/][^>]*>[^<]*<\/[^>]+>[^<]*)*<\/td>)+)<\/tr>/g)];
    assert.deepEqual(rows.map((r) => r[1]), ['Cost and free version', 'Open source', 'Runs on', 'Story planning', 'Production planning', 'Production revisions', 'Real-time co-writing']);
    const names = ['DraftLine', 'Final Draft', 'Fade In', 'WriterDuet', 'Celtx', 'Beat'];
    for (const r of rows) assert.deepEqual([...r[2].matchAll(/<td data-label="([^"]+)">/g)].map((m) => m[1]), names, r[1]);
  });
  it('keeps production planning apart from production revisions', () => {
    assert.match(text, /"Production planning" means preparing a shoot from the script/);
    assert.match(text, /"Production revisions" means locked shooting scripts with colored revision pages/);
  });
  it('says DraftLine has no generative AI, without describing its analysis as AI or claiming others force it', () => {
    assert.match(text, /it has no generative AI/);
    assert.match(text, /rule-based readings of your own pages/);
    assert.doesNotMatch(text, /(Final Draft|Fade In|WriterDuet|Celtx|Beat)[^.]{0,80}\bAI\b/);
  });
  it('keeps "Where others are the better choice", the check date and a source for every product', () => {
    assert.match(html, /<section id="draftline-stands-out">/);
    assert.match(html, /<section id="others-better">/);
    assert.match(text, /Checked in November 2026/);
    for (const name of ['Final Draft', 'Fade In', 'WriterDuet', 'Celtx', 'Beat']) assert.match(html.slice(html.indexOf('id="sources"')), new RegExp(`<li>${name}:`));
  });
  it('states DraftLine\'s limits plainly', () => {
    assert.match(text, /doesn't schedule shoot days, build budgets or make call sheets/);
    assert.match(text, /Chrome or Edge on a computer/);
  });
});
