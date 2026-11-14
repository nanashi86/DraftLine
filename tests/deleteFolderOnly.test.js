import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { folderOnlyFallback } from '../src/lib/folderSync.js';

const rec = (id, updatedAt) => ({ id, title: id, updatedAt });
const file = (r) => ({ fileName: `${r.id}.draftline`, record: r });

describe('deleting the only script in this browser when others are only in the folder', () => {
  it('picks the newest folder-only script other than the one being deleted', () => {
    const local = [rec('a', 5)];
    const folder = [file(rec('a', 5)), file(rec('b', 1)), file(rec('c', 9))];
    assert.equal(folderOnlyFallback(local, folder, 'a'), 'c');
  });
  it('null when the folder has nothing else (it really is the only script)', () => {
    assert.equal(folderOnlyFallback([rec('a', 1)], [file(rec('a', 1))], 'a'), null);
    assert.equal(folderOnlyFallback([rec('a', 1)], [], 'a'), null);
  });
  it('ignores folder scripts this browser already has', () => {
    assert.equal(folderOnlyFallback([rec('a', 1), rec('b', 2)], [file(rec('b', 2))], 'a'), null);
  });
  it('the app checks the folder before refusing, and brings a folder script in before deleting', () => {
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /if \(!others\.length && !folderOnlyFallback\(local, await folderSync\.listProjects\(\), id\)\)/);
    assert.match(app, /const fallback = folderOnlyFallback\(local, await folderSync\.listProjects\(\), d\.id\);\s*if \(fallback\) await localCopy\(fallback\);/);
  });
});
