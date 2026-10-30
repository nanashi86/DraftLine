import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_STATUS_FIT, STATUS_FIT_STEPS, fitStatusBar, statusFits } from '../src/lib/statusFit.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const css = read('App.css');
const app = read('App.jsx');

describe('Status bar: helpers step aside in a set order, the status never does', () => {
  it('the order: hints, counts, Paper’s label, undo / redo, zoom − +, compact steppers, then status as icons', () => {
    assert.deepEqual(STATUS_FIT_STEPS, ['hints', 'counts', 'paper-label', 'undo-redo', 'zoom-buttons', 'stepper-labels', 'status-icons']);
    assert.equal(MAX_STATUS_FIT, 7);
  });

  it('fitStatusBar takes the fewest steps that fit, and stops at the last', () => {
    const bar = { dataset: {} };
    assert.equal(fitStatusBar(bar, () => true), 0);
    assert.equal(bar.dataset.fit, '0');
    assert.equal(fitStatusBar(bar, (b) => Number(b.dataset.fit) >= 3), 3);
    assert.equal(bar.dataset.fit, '3');
    assert.equal(fitStatusBar(bar, () => false), MAX_STATUS_FIT, 'never fits: everything optional has gone');
    assert.equal(fitStatusBar(null), 0);
  });

  it('statusFits: nothing overflows on the right, nothing cut off on the left or in the counts', () => {
    const el = (sw, cw) => ({ scrollWidth: sw, clientWidth: cw, offsetParent: {} });
    const bar = (b, left, counts) => ({ ...b, querySelector: (s) => (s === '.status-left' ? left : s === '.status-counts' ? counts : null) });
    assert.equal(statusFits(bar(el(800, 800), el(300, 300), el(100, 100))), true);
    assert.equal(statusFits(bar(el(900, 800), el(300, 300), el(100, 100))), false, 'right side overflowing');
    assert.equal(statusFits(bar(el(800, 800), el(340, 300), el(100, 100))), false, 'left side cut off');
    assert.equal(statusFits(bar(el(800, 800), el(300, 300), el(140, 100))), false, 'counts cut off');
  });

  it('each step hides one kind of helper, cumulatively; key hints also leave whenever a stepper shows or under 1400px', () => {
    const steps = (from) => Array.from({ length: 8 - from }, (_, i) => `\\[data-fit='${from + i}'\\]`).join(', ');
    for (const [from, target] of [[1, '\\.status-hints'], [2, '\\.status-counts'], [3, '\\.canvas-label'], [4, '\\.status-history'], [5, '\\.status-zoom > \\.mini:not\\(\\.zoom-val\\)']]) {
      assert.match(css, new RegExp(`\\.status:is\\(${steps(from)}\\) ${target} \\{ display: none; \\}`), target);
    }
    assert.match(css, /\.status:is\(\[data-fit='6'\], \[data-fit='7'\]\) :is\(\.stepper-label, \.stepper-dot\) \{ display: none; \}/);
    assert.match(css, /\.status\[data-fit='7'\] :is\(\.status-save-label, \.status-lock-label\) \{ display: none; \}/);
    assert.match(css, /\.status\.has-tools \.status-hints \{ display: none; \}/);
    assert.match(css, /@media \(max-width: 1399\.98px\) \{ \.status-hints \{ display: none; \} \}/);
  });

  it('the status can’t be squeezed: element, saved / synced and the lock are rigid; the counts are the safety net', () => {
    assert.match(css, /\.status-type \{ flex: none;/);
    assert.match(css, /\.status-left > \.status-save,\s*\.status-left > \.status-lock \{ flex: none; \}/);
    assert.match(css, /\.status-counts \{ display: flex; align-items: center; gap: 16px; flex: 0 1 auto; min-width: 0; overflow: hidden; \}/);
    assert.match(app, /<span className="status-counts">/);
  });

  it('the app counts every stepper (Dialogue, Find, Format, Density) and keeps the bar fitted', () => {
    assert.match(app, /const statusTools = inPlan \? 0 : \[filter, findOn && !find\.open, showFormatStepper, density\.dense > 0\]\.filter\(Boolean\)\.length;/);
    assert.match(app, /useLayoutEffect\(\(\) => watchStatusFit\(statusRef\.current\), \[\]\);/);
    assert.match(app, /<footer className=\{statusClass\} ref=\{statusRef\} data-fit="0">/);
    assert.match(app, /aria-label=\{saveStatus\.label\}/, 'icon-only, the status still reads aloud');
    assert.match(read('components/LockBadge.jsx'), /aria-label=\{b\.title\}/);
  });
});
