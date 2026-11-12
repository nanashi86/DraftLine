// Google Tag Manager + Consent Mode v2 + the cookie banner in index.html. The inline loader runs here against a
// small fake window and document (node:vm), one visit per test.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const loader = html.match(/<script>\s*(\(function \(w, d, id\) \{\s*var CHOICE_KEY = 'draftline_ad_consent';[\s\S]*?\}\)\(window, document, 'GTM-5M3FDPRW'\);)\s*<\/script>/)?.[1];

function visit(href, { tz = 'America/New_York', stored = {}, storageThrows = false, cookies = [], loading = true } = {}) {
  const store = { ...stored };
  const storage = {
    getItem: (k) => { if (storageThrows) throw new Error('blocked'); return k in store ? store[k] : null; },
    setItem: (k, v) => { if (storageThrows) throw new Error('blocked'); store[k] = String(v); },
  };
  const appended = [];
  const body = [];
  const cookieWrites = [];
  const listeners = {};
  const el = (tag) => {
    const node = {
      tag, attrs: {}, innerHTML: '', handlers: {}, removed: false, focused: false,
      setAttribute(k, v) { this.attrs[k] = String(v); },
      addEventListener(t, f) { this.handlers[t] = f; },
      remove() { this.removed = true; },
      querySelector() { return { focus: () => { node.focused = true; } }; },
    };
    return node;
  };
  const document = {
    readyState: loading ? 'loading' : 'complete',
    createElement: el,
    head: { appendChild: (n) => appended.push(n) },
    body: { appendChild: (n) => body.push(n) },
    addEventListener: (t, f) => { listeners[t] = f; },
    get cookie() { return cookies.join('; '); },
    set cookie(v) { cookieWrites.push(v); },
  };
  const window = { location: { href, hostname: new URL(href).hostname }, localStorage: storage };
  const Intl = { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: tz }) }) };
  vm.runInNewContext(loader, { window, document, Intl, URL, String });
  const calls = (window.dataLayer || []).map((a) => (a && a.event ? a : Array.from(a)));
  const click = (choice) => body[0].handlers.click({ target: { closest: () => ({ getAttribute: () => choice }) } });
  return { window, store, appended, body, calls, listeners, cookieWrites, click };
}

const GRANTED = { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' };
const DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' };

describe('Google Tag Manager with consent', () => {
  it('index.html has the loader, ahead of everything but the charset', () => {
    assert.ok(loader, 'the inline loader is in index.html');
    assert.ok(html.indexOf('GTM-5M3FDPRW') < html.indexOf('rel="icon"'));
    assert.doesNotMatch(html, /<script[^>]*src="https:\/\/www\.googletagmanager\.com/, 'no static tag that would skip the consent defaults');
  });

  it('outside Europe: EEA/UK/CH denied by region, granted elsewhere, Tag Manager loads, no banner', () => {
    const { calls, appended, body, listeners } = visit('https://nanashi86.github.io/DraftLine/');
    const [regional, global] = calls.filter((c) => c[0] === 'consent' && c[1] === 'default').map((c) => c[2]);
    assert.ok(regional.region.includes('FR') && regional.region.includes('GB') && regional.region.includes('CH'));
    assert.equal(regional.ad_storage, 'denied');
    assert.equal(regional.wait_for_update, 500);
    assert.deepEqual({ ...global }, GRANTED);
    assert.ok(calls.findIndex((c) => c.event === 'gtm.js') > calls.findIndex((c) => c[1] === 'default'), 'defaults before gtm.js');
    assert.equal(appended[0].src, 'https://www.googletagmanager.com/gtm.js?id=GTM-5M3FDPRW');
    assert.equal(appended[0].async, true);
    assert.equal(body.length, 0);
    assert.equal(listeners.DOMContentLoaded, undefined);
  });

  it('a European time zone: everything denied by default and the banner shows once the page is parsed', () => {
    const { calls, body, listeners } = visit('https://nanashi86.github.io/DraftLine/', { tz: 'Europe/Paris' });
    const global = calls.filter((c) => c[1] === 'default')[1][2];
    assert.deepEqual({ ...global }, DENIED);
    assert.equal(body.length, 0);
    listeners.DOMContentLoaded();
    assert.equal(body.length, 1);
    assert.equal(body[0].id, 'dl-consent');
    assert.match(body[0].innerHTML, /data-choice="denied"[^>]*>Decline<[\s\S]*data-choice="granted"[^>]*>Accept</);
    assert.equal(body[0].focused, false, 'never steals focus from the page');
  });

  it('other European zones count too, and an unknown zone is treated as Europe', () => {
    for (const tz of ['Atlantic/Canary', 'Asia/Nicosia', 'Africa/Ceuta', 'Atlantic/Reykjavik', '']) {
      assert.ok(visit('https://x.test/', { tz, loading: false }).body.length === 1, tz || '(unknown)');
    }
    assert.equal(visit('https://x.test/', { tz: 'Africa/Kigali', loading: false }).body.length, 0);
  });

  it('Accept: stored, consent updated to granted, banner removed', () => {
    const v = visit('https://x.test/', { tz: 'Europe/London', loading: false });
    v.click('granted');
    assert.equal(v.store.draftline_ad_consent, 'granted');
    assert.deepEqual({ ...Array.from(v.window.dataLayer.at(-1))[2] }, GRANTED);
    assert.equal(v.body[0].removed, true);
    assert.equal(v.window.draftlineConsent.choice(), 'granted');
  });

  it('Decline: stored, consent denied, and Google ad cookies are removed', () => {
    const v = visit('https://x.test/', { tz: 'Europe/Berlin', loading: false, cookies: ['_gcl_au=1.1.2', 'other=1', '_ga=GA1'] });
    v.click('denied');
    assert.equal(v.store.draftline_ad_consent, 'denied');
    assert.deepEqual({ ...Array.from(v.window.dataLayer.at(-1))[2] }, DENIED);
    assert.ok(v.cookieWrites.some((c) => c.startsWith('_gcl_au=; Max-Age=0')));
    assert.ok(v.cookieWrites.some((c) => c.startsWith('_ga=; Max-Age=0')));
    assert.ok(!v.cookieWrites.some((c) => c.startsWith('other=')));
  });

  it('a stored choice is applied before Tag Manager loads, and the banner stays away', () => {
    const v = visit('https://x.test/', { tz: 'Europe/Rome', loading: false, stored: { draftline_ad_consent: 'granted' } });
    const update = v.calls.findIndex((c) => c[1] === 'update');
    assert.deepEqual({ ...v.calls[update][2] }, GRANTED);
    assert.ok(update < v.calls.findIndex((c) => c.event === 'gtm.js'));
    assert.equal(v.body.length, 0);
  });

  it('⋮ → Cookie Settings… reopens the card anywhere, focused, showing the current choice', () => {
    const v = visit('https://x.test/', { stored: { draftline_ad_consent: 'denied' }, loading: false });
    v.window.draftlineConsent.open();
    assert.equal(v.body.length, 1);
    assert.equal(v.body[0].focused, true);
    assert.match(v.body[0].innerHTML, /data-choice="denied" aria-pressed="true"/);
  });

  it('admin devices: nothing loads, no banner, no menu item', () => {
    for (const v of [
      visit('https://x.test/?dev=true', { tz: 'Europe/Paris', loading: false }),
      visit('https://x.test/', { tz: 'Europe/Paris', loading: false, stored: { draftline_is_admin: 'true' } }),
    ]) {
      assert.equal(v.appended.length, 0);
      assert.equal(v.body.length, 0);
      assert.equal(v.window.dataLayer, undefined);
      assert.equal(v.window.draftlineConsent, undefined);
    }
    assert.equal(visit('https://x.test/?dev=false', { stored: { draftline_is_admin: 'true' } }).appended.length, 1);
  });

  it('blocked storage: still works for the visit and asks again next time', () => {
    const v = visit('https://x.test/', { tz: 'Europe/Madrid', loading: false, storageThrows: true });
    assert.equal(v.appended.length, 1);
    assert.equal(v.body.length, 1);
    v.click('granted');
    assert.equal(v.body[0].removed, true);
  });
});
