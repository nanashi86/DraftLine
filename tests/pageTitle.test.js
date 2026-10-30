import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEO_TITLE, pageTitle } from '../src/lib/pageTitle.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('page title: what the tab shows, and what search engines index', () => {
  it('index.html ships the SEO title', () => {
    assert.equal(SEO_TITLE, 'DraftLine — Free, Offline-First Screenwriting Software (PWA)');
    assert.match(read('index.html'), /<title>DraftLine — Free, Offline-First Screenwriting Software \(PWA\)<\/title>/);
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
});
