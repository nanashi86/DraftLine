// After a deploy, an open tab (or an app started with an old copy of its page) must not go blank.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STALE_RELOAD_KEY, reloadForNewBuild, reloadWhenBuildIsStale } from '../src/pwa/staleBuild.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

describe('a tab on the previous build', () => {
  it('a built file that fails to load reloads the page once', () => {
    const storage = mem();
    let reloads = 0;
    assert.equal(reloadForNewBuild({ storage, reload: () => reloads++, now: 1_000_000 }), true);
    assert.equal(reloads, 1);
    assert.equal(storage.getItem(STALE_RELOAD_KEY), '1000000');
  });
  it('a second failure within a minute does not reload again (no loop); after that it can', () => {
    const storage = mem();
    let reloads = 0;
    reloadForNewBuild({ storage, reload: () => reloads++, now: 1_000_000 });
    assert.equal(reloadForNewBuild({ storage, reload: () => reloads++, now: 1_030_000 }), false);
    assert.equal(reloads, 1);
    assert.equal(reloadForNewBuild({ storage, reload: () => reloads++, now: 1_070_000 }), true);
    assert.equal(reloads, 2);
  });
  it('blocked storage still reloads, and never throws', () => {
    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    let reloads = 0;
    assert.equal(reloadForNewBuild({ storage: blocked, reload: () => reloads++ }), true);
    assert.equal(reloadForNewBuild({ storage: null, reload: () => reloads++ }), true);
    assert.equal(reloads, 2);
  });
  it('listens for Vite’s preload error, and the app installs it at startup', () => {
    const handlers = {};
    let reloads = 0;
    const win = { addEventListener: (t, f) => { handlers[t] = f; }, sessionStorage: mem(), location: { reload: () => reloads++ } };
    reloadWhenBuildIsStale(win);
    handlers['vite:preloadError']();
    assert.equal(reloads, 1);
    assert.match(read('src/main.jsx'), /import \{ reloadWhenBuildIsStale \} from '\.\/pwa\/staleBuild\.js'\n[\s\S]*?\nreloadWhenBuildIsStale\(\)\n/);
  });
  it('the service worker always revalidates the app’s page instead of using the 10-minute browser copy', () => {
    assert.match(read('src/pwa/sw.template.js'), /fetch\(req\.url, \{ cache: 'no-cache', credentials: 'same-origin' \}\)/);
  });
});
