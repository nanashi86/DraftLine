// Cloudflare Web Analytics in index.html: loaded for everyone except the admin's own browsers.
// The inline loader is run here against a small fake window (node:vm), one case per test.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const loader = html.match(/<script>\s*(\(function \(\) \{\s*var KEY = 'draftline_is_admin';[\s\S]*?\}\)\(\);)\s*<\/script>/)?.[1];

function run(href, { stored = {}, storageThrows = false } = {}) {
  const store = { ...stored };
  const appended = [];
  const replaced = [];
  const storage = {
    getItem: (k) => { if (storageThrows) throw new Error('blocked'); return k in store ? store[k] : null; },
    setItem: (k, v) => { if (storageThrows) throw new Error('blocked'); store[k] = String(v); },
    removeItem: (k) => { if (storageThrows) throw new Error('blocked'); delete store[k]; },
  };
  const window = {
    location: { href },
    history: { state: { keep: 1 }, replaceState: (state, _t, url) => replaced.push({ state, url }) },
  };
  const document = {
    createElement: () => {
      const el = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
      return el;
    },
    head: { appendChild: (el) => appended.push(el) },
  };
  vm.runInNewContext(loader, { window, document, localStorage: storage, URL });
  return { store, appended, replaced };
}

describe('Analytics: Cloudflare beacon with an admin opt-out', () => {
  it('index.html has the loader and no static beacon tag', () => {
    assert.ok(loader, 'the inline loader is in index.html');
    assert.doesNotMatch(html, /<script[^>]*src="https:\/\/static\.cloudflareinsights\.com/);
  });

  it('a normal visit loads the beacon (deferred, with the site token)', () => {
    const { appended, replaced } = run('https://nanashi86.github.io/DraftLine/');
    assert.equal(appended.length, 1);
    assert.equal(appended[0].src, 'https://static.cloudflareinsights.com/beacon.min.js');
    assert.equal(appended[0].defer, true);
    assert.deepEqual(JSON.parse(appended[0].attrs['data-cf-beacon']), { token: '12fb1a12f74a4632b8201f0cb4563745' });
    assert.equal(replaced.length, 0, 'the address bar is left alone');
  });

  it('?dev=true marks this browser as admin, cleans the address bar and skips the beacon', () => {
    const { store, appended, replaced } = run('https://nanashi86.github.io/DraftLine/?dev=true#scene-3');
    assert.equal(store.draftline_is_admin, 'true');
    assert.equal(appended.length, 0);
    assert.deepEqual(replaced, [{ state: { keep: 1 }, url: '/DraftLine/#scene-3' }], 'only ?dev goes; the path, hash and history state stay');
  });

  it('other query parameters survive the clean-up', () => {
    const { replaced } = run('https://nanashi86.github.io/DraftLine/?a=1&dev=true&b=2');
    assert.equal(replaced[0].url, '/DraftLine/?a=1&b=2');
  });

  it('later visits from that browser stay excluded', () => {
    const { appended, replaced } = run('https://nanashi86.github.io/DraftLine/', { stored: { draftline_is_admin: 'true' } });
    assert.equal(appended.length, 0);
    assert.equal(replaced.length, 0);
  });

  it('?dev=false clears the flag and counts the visit again', () => {
    const { store, appended, replaced } = run('https://nanashi86.github.io/DraftLine/?dev=false', { stored: { draftline_is_admin: 'true' } });
    assert.equal(store.draftline_is_admin, undefined);
    assert.equal(appended.length, 1);
    assert.equal(replaced[0].url, '/DraftLine/');
  });

  it('blocked storage: ?dev=true still skips this visit; a plain visit still loads', () => {
    assert.equal(run('https://x.test/DraftLine/?dev=true', { storageThrows: true }).appended.length, 0);
    assert.equal(run('https://x.test/DraftLine/', { storageThrows: true }).appended.length, 1);
  });

  it('leaves the PWA alone: manifest link and the app entry are unchanged', () => {
    assert.match(html, /<link rel="manifest" href="%BASE_URL%manifest\.json" \/>/);
    assert.match(html, /<script type="module" src="\/src\/main\.jsx"><\/script>/);
    assert.doesNotMatch(loader, /indexedDB|serviceWorker|caches/);
  });
});
