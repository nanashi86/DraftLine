// The service worker's precache list must name exactly the files the build wrote: cache.addAll()
// rejects the whole install if even one URL fails ("Failed to execute 'addAll' on 'Cache'").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import draftlinePwa from '../src/pwa/vitePlugin.js';

const precacheOf = (source) => JSON.parse(source.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);

function fakeBuild(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dl-sw-'));
  for (const [f, text] of Object.entries(files)) {
    mkdirSync(join(dir, f, '..'), { recursive: true });
    writeFileSync(join(dir, f), text);
  }
  return dir;
}

describe('Service worker precache list', () => {
  it('is written after the build is on disk, from the files actually there (not the pre-hash bundle)', () => {
    const src = readFileSync(new URL('../src/pwa/vitePlugin.js', import.meta.url), 'utf8');
    assert.match(src, /writeBundle\(options\) \{/);
    assert.doesNotMatch(src, /generateBundle\(/, 'bundle names there can still change');
  });

  it('lists every built file, and only those: no missing URL can fail cache.addAll()', () => {
    const dir = fakeBuild({
      'index.html': '<!doctype html>',
      'manifest.json': '{}',
      'icon-192.png': 'png',
      'assets/index-abc.js': 'js',
      'assets/HelpModal-rFO86vws.js': 'final name',
      'assets/HelpModal-CeRgXKiy.css': 'css',
      'assets/index-abc.js.map': 'map',
    });
    try {
      draftlinePwa().writeBundle({ dir });
      const list = precacheOf(readFileSync(join(dir, 'sw.js'), 'utf8'));
      assert.deepEqual(list, [
        './', './assets/HelpModal-CeRgXKiy.css', './assets/HelpModal-rFO86vws.js', './assets/index-abc.js',
        './icon-192.png', './index.html', './manifest.json',
      ]);
      for (const u of list.slice(1)) assert.ok(existsSync(join(dir, u)), `${u} exists`);
      assert.ok(!list.includes('./sw.js') && !list.some((u) => u.endsWith('.map')), 'not itself, no source maps');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a rebuild that changes one file gets a new version, so the old cache is dropped', () => {
    const a = fakeBuild({ 'index.html': 'x', 'assets/a.js': '1' });
    const b = fakeBuild({ 'index.html': 'x', 'assets/a.js': '2' });
    try {
      draftlinePwa().writeBundle({ dir: a });
      draftlinePwa().writeBundle({ dir: b });
      const version = (d) => readFileSync(join(d, 'sw.js'), 'utf8').match(/const VERSION = "([0-9a-f]+)";/)[1];
      assert.notEqual(version(a), version(b));
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });
});
