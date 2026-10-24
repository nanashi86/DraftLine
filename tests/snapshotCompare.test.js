import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { diffScripts, diffWords, foldRows, myers, tokenize } from '../src/lib/scriptDiff.js';
import { diffScriptsAsync } from '../src/lib/scriptDiffAsync.js';
import { CompareRows } from '../src/components/CompareRows.js';
import { createRevision } from '../src/lib/revisions.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });
const freeze = (v) => { Object.values(v).forEach((x) => x && typeof x === 'object' && freeze(x)); return Object.freeze(v); };

/** The snapshot's script… */
const snapshot = () => [
  B('s1', 'scene', 'EXT. HARBOR - DAWN'),
  B('a1', 'action', 'Mist over the water. Marie waits by the old pier.'),
  B('c1', 'character', 'MARIE'),
  B('d1', 'dialogue', 'We go now.'),
  B('x1', 'action', 'A gull screams overhead.'),
  B('s2', 'scene', 'INT. FERRY - DAY'),
  B('a2', 'action', 'Benches. A radio.'),
];
/** …and the draft since: one line added, one deleted, one action reworded, one heading retyped. */
const draft = () => [
  B('s1', 'scene', 'EXT. HARBOR - DAWN'),
  B('a1', 'action', 'Mist over the water. Marie waits by the pier, barefoot.'),
  B('c1', 'character', 'MARIE'),
  B('d1', 'dialogue', 'We go now.'),
  B('n1', 'dialogue', 'Before he wakes.'),
  B('s2', 'action', 'INT. FERRY - DAY'),
  B('a2', 'action', 'Benches. A radio.'),
];
const textOf = (segs, side) => segs.filter((p) => p.op === 'eq' || p.op === side).map((p) => p.text).join('');

describe('Snapshot diff engine', () => {
  it('text added to the current draft is marked as an addition', () => {
    const { rows, stats } = diffScripts(snapshot(), draft());
    const added = rows.filter((r) => r.kind === 'add');
    assert.deepEqual(added.map((r) => r.new.text), ['Before he wakes.']);
    assert.equal(stats.added, 1);
    const reworded = rows.find((r) => r.new?.id === 'a1');
    assert.equal(reworded.kind, 'change');
    assert.deepEqual(reworded.words.filter((p) => p.op === 'add').map((p) => p.text.trim()), [', barefoot']);
  });

  it('text deleted from the snapshot is marked as a deletion', () => {
    const { rows, stats } = diffScripts(snapshot(), draft());
    assert.deepEqual(rows.filter((r) => r.kind === 'del').map((r) => r.old.text), ['A gull screams overhead.']);
    assert.equal(stats.deleted, 1);
    const reworded = rows.find((r) => r.old?.id === 'a1');
    assert.deepEqual(reworded.words.filter((p) => p.op === 'del').map((p) => p.text.trim()), ['old']);
    assert.equal(textOf(reworded.words, 'del'), snapshot()[1].text, 'old side rebuilds the snapshot text');
    assert.equal(textOf(reworded.words, 'add'), draft()[1].text, 'new side rebuilds the draft text');
  });

  it('a retyped element is a change of type, with its text unchanged', () => {
    const row = diffScripts(snapshot(), draft()).rows.find((r) => r.old?.id === 's2');
    assert.equal(row.kind, 'change');
    assert.equal(row.typeChanged, true);
    assert.deepEqual([row.old.type, row.new.type], ['scene', 'action']);
    assert.deepEqual(row.words, [{ op: 'eq', text: 'INT. FERRY - DAY' }]);
  });

  it('rows run in script order and account for every element on both sides', () => {
    const a = snapshot();
    const b = draft();
    const { rows } = diffScripts(a, b);
    assert.deepEqual(rows.filter((r) => r.old).map((r) => r.old.id), a.map((x) => x.id));
    assert.deepEqual(rows.filter((r) => r.new).map((r) => r.new.id), b.map((x) => x.id));
    assert.deepEqual(rows.map((r) => r.kind), ['same', 'change', 'same', 'same', 'del', 'add', 'change', 'same']);
  });

  it('identical scripts: every row the same, no changes counted', () => {
    const { stats } = diffScripts(snapshot(), snapshot());
    assert.deepEqual(stats, { added: 0, deleted: 0, changed: 0, same: 7 });
  });

  it('unrelated elements are not paired: a rewrite reads as a deletion and an addition', () => {
    const { rows } = diffScripts([B('a', 'action', 'The sea is calm.')], [B('b', 'action', 'Gunfire erupts downtown.')]);
    assert.deepEqual(rows.map((r) => r.kind), ['del', 'add']);
  });

  it('Myers finds a shortest edit script', () => {
    const lcs = (a, b) => {
      const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
      return d[a.length][b.length];
    };
    let seed = 11;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let t = 0; t < 2000; t++) {
      const a = Array.from({ length: rnd(18) }, () => rnd(4));
      const b = Array.from({ length: rnd(18) }, () => rnd(4));
      const ops = myers(a, b);
      assert.deepEqual(ops.filter((o) => o[0] <= 0).map((o) => a[o[1]]), a);
      assert.deepEqual(ops.filter((o) => o[0] >= 0).map((o) => b[o[2]]), b);
      assert.equal(ops.filter((o) => o[0] === 0).length, lcs(a, b));
    }
  });

  it('word diff keeps punctuation and spacing exact', () => {
    assert.deepEqual(tokenize("  Theo's  hand—shaking."), ['  ', "Theo's  ", 'hand', '—', 'shaking', '.']);
    const w = diffWords('She walks to the pier.', 'She runs to the pier.');
    assert.deepEqual(w, [{ op: 'eq', text: 'She ' }, { op: 'del', text: 'walks' }, { op: 'add', text: 'runs' }, { op: 'eq', text: ' to the pier.' }]);
  });

  it('long unchanged stretches fold, with context around each change, and open on request', () => {
    const many = Array.from({ length: 40 }, (_, i) => B(`b${i}`, 'action', `Line ${i}.`));
    const edited = many.map((b, i) => (i === 20 ? { ...b, text: 'Line twenty, rewritten.' } : b));
    const { rows } = diffScripts(many, edited);
    const folded = foldRows(rows, { context: 2 });
    assert.deepEqual(folded.map((r) => (r.kind === 'fold' ? `fold:${r.count}` : r.kind)), ['fold:18', 'same', 'same', 'change', 'same', 'same', 'fold:17']);
    const opened = foldRows(rows, { context: 2, open: new Set([0]) });
    assert.equal(opened.filter((r) => r.kind !== 'fold').length, 23);
  });
});

describe('The comparison never touches the snapshot or the draft', () => {
  it('diffScripts reads frozen inputs without changing them', () => {
    const a = freeze(snapshot());
    const b = freeze(draft());
    const before = JSON.stringify([a, b]);
    const { rows } = diffScripts(a, b);
    assert.equal(JSON.stringify([a, b]), before);
    assert.ok(rows.every((r) => (r.old ? !a.includes(r.old) : true) && (r.new ? !b.includes(r.new) : true)), 'rows hold copies');
  });

  it('diffScriptsAsync gives the same result off the main thread path, and leaves a stored revision as it was', async () => {
    const rev = freeze(createRevision({ blocks: snapshot(), meta: { title: 'Ferry' } }, { label: 'Before rewrite', now: Date.UTC(2026, 9, 24) }));
    const stored = JSON.stringify(rev);
    const cur = freeze(draft());
    const r = await diffScriptsAsync(rev.script, cur, { worker: false });
    assert.deepEqual(r, diffScripts(snapshot(), draft()));
    assert.equal(JSON.stringify(rev), stored);
  });

  it('can be cancelled', async () => {
    const ctrl = new AbortController();
    const p = diffScriptsAsync(snapshot(), draft(), { worker: false, signal: ctrl.signal });
    ctrl.abort();
    await assert.rejects(p, { name: 'AbortError' });
  });

  it('a 110-page script (≈3,000 elements) compares well under a second', () => {
    const big = Array.from({ length: 3000 }, (_, i) => B(`e${i}`, ['scene', 'action', 'character', 'dialogue'][i % 4], `Element ${i} with a few words ${i % 13}.`));
    const next = big.filter((_, i) => i % 61).map((b, i) => (i % 37 ? b : { ...b, text: `${b.text} Revised.` }));
    const t0 = performance.now();
    const { stats } = diffScripts(big, next);
    assert.ok(performance.now() - t0 < 1000);
    assert.ok(stats.deleted > 0 && stats.changed > 0);
  });
});

describe('Inline and Side by Side views', () => {
  const rows = foldRows(diffScripts(snapshot(), draft()).rows);
  const render = (mode) => renderToStaticMarkup(createElement(CompareRows, { rows, mode, oldLabel: 'Snapshot · Before', newLabel: 'Current draft' }));
  const count = (html, re) => (html.match(re) || []).length;

  it('Inline: one column, deletions struck through and additions marked, in one stream', () => {
    const html = render('unified');
    assert.match(html, /^<div class="df-rows is-unified" data-mode="unified">/);
    assert.equal(count(html, /class="df-row is-/g), rows.length);
    assert.equal(count(html, /df-side/g), 0, 'no side-by-side cells');
    assert.match(html, /<del>A gull screams overhead\.<\/del>/);
    assert.match(html, /<ins>Before he wakes\.<\/ins>/);
    assert.match(html, /the <del>old <\/del>pier<ins>, barefoot<\/ins>\./, 'a reworded line shows both, inline');
    assert.match(html, /<span class="df-retype">Scene Heading → Action<\/span>/);
  });

  it('Side by Side: the snapshot on the left, the draft on the right, each with only its own changes', () => {
    const html = render('split');
    assert.match(html, /^<div class="df-rows is-split" data-mode="split">/);
    assert.match(html, /<div class="df-side is-old">Snapshot · Before<\/div><span class="df-mark"><\/span><div class="df-side is-new">Current draft<\/div>/);
    assert.equal(count(html, /class="df-row df-pair is-/g), rows.length);
    const olds = [...html.matchAll(/<div class="df-side is-old">(.*?)<\/div><span class="df-mark"/g)].map((m) => m[1]).join('');
    const news = [...html.matchAll(/<div class="df-side is-new">(.*?)<\/div><\/div>/g)].map((m) => m[1]).join('');
    assert.ok(!/<ins>/.test(olds) && /<del>/.test(olds), 'left: deletions only');
    assert.ok(!/<del>/.test(news) && /<ins>/.test(news), 'right: additions only');
    assert.equal(count(html, /df-side is-new is-blank/g), 1, 'the deleted line leaves a gap on the right');
    assert.equal(count(html, /df-side is-old is-blank/g), 1, 'the added line leaves a gap on the left');
  });

  it('switching modes renders the same rows either way, cleanly', () => {
    const a = render('unified');
    const b = render('split');
    const kinds = (html) => [...html.matchAll(/data-kind="(\w+)"/g)].map((m) => m[1]);
    assert.deepEqual(kinds(a), kinds(b));
    assert.equal(render('unified'), a, 'rendering is stable');
    for (const html of [a, b]) assert.ok(!/undefined|null|NaN|\[object/.test(html));
  });

  it('a fold is a button that opens the unchanged stretch', () => {
    const many = Array.from({ length: 12 }, (_, i) => B(`b${i}`, 'action', `Line ${i}.`));
    const f = foldRows(diffScripts(many, [...many, B('z', 'action', 'New.')]).rows);
    const html = renderToStaticMarkup(createElement(CompareRows, { rows: f, mode: 'unified' }));
    assert.match(html, /<button type="button" class="df-fold" data-from="0">10 unchanged elements · Show<\/button>/);
  });
});

describe('Compare lives in its own modal, off the writing canvas', () => {
  const app = read('src/App.jsx');
  const modal = read('src/components/SnapshotCompare.jsx');
  const list = read('src/components/Snapshots.jsx');
  it('each snapshot in the list has a Compare button beside Restore', () => {
    assert.match(list, /onClick=\{\(\) => onCompare\(r\.id\)\} aria-label=\{`Compare \$\{r\.label\} with the current draft`\}/);
    assert.match(app, /onCompare=\{\(id\) => setCompareId\(id\)\}/);
  });
  it('a modal dialog, read-only, with an Inline / Side by Side toggle and Close Comparison', () => {
    assert.match(modal, /<Dialog className="sn-compare" labelledBy="df-title" onClose=\{onClose\}>/);
    assert.match(modal, />Close Comparison<\/button>/);
    assert.match(modal, /aria-pressed=\{mode === 'unified'\}[^\n]*>Inline</);
    assert.match(modal, /aria-pressed=\{mode === 'split'\}[^\n]*>Side by Side</);
    assert.doesNotMatch(modal, /onRestore|set\(|setBeats|projects\.|folderSync|writeProject/, 'nothing that writes');
    assert.match(modal, /diffScriptsAsync\(revision\.script, draft, \{ signal: ctrl\.signal \}\)/, 'off the main thread, cancelled on close');
  });
  it('the app mounts it only while comparing, and closes it on switching scripts', () => {
    assert.match(app, /\{compareId && getRevision\(allSnapshots, compareId\) && \(\s*<Suspense fallback=\{null\}>\s*<SnapshotCompare/);
    assert.match(app, /setRestoreId\(null\);\s*setCompareId\(null\);/);
    assert.match(read('src/lib/scriptDiffAsync.js'), /new Worker\(new URL\('\.\/scriptDiff\.worker\.js', import\.meta\.url\), \{ type: 'module' \}\)/);
  });
});
