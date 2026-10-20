import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_PERCENTS, byAct, formatPageTargets, formatPercentTargets, pageBounds, populateByPages,
} from '../src/lib/beats.js';

/** One scene starting on each page of a `pages`-page script. */
const scenesFor = (pages) => Array.from({ length: pages }, (_, i) => ({ id: `s${i + 1}`, number: i + 1, heading: `INT. ROOM ${i + 1} - DAY`, page: i + 1, snippet: '' }));

describe('Auto-Distribute (% Targets)', () => {
  it('uses the standard shares: 25 / 50 / 25 % in 3 acts, 25 % each in 4', () => {
    assert.deepEqual(PAGE_PERCENTS[3], [0.25, 0.75]);
    assert.deepEqual(PAGE_PERCENTS[4], [0.25, 0.5, 0.75]);
    assert.equal(formatPercentTargets(3), '25 · 50 · 25%');
    assert.equal(formatPercentTargets(4), '25 · 25 · 25 · 25%');
  });
  it('page ranges come from the script’s actual length', () => {
    assert.equal(formatPageTargets(3, 96), 'pp. 1–24 · 25–72 · 73+');
    assert.equal(formatPageTargets(4, 96), 'pp. 1–24 · 25–48 · 49–72 · 73+');
    assert.equal(formatPageTargets(3, 120), 'pp. 1–30 · 31–90 · 91+');
    assert.equal(formatPageTargets(4, 110), 'pp. 1–27 · 28–55 · 56–82 · 83+');
    assert.deepEqual(pageBounds(3, 4), [1, 3], 'a short script still gets increasing bounds');
  });
  it('places a 96-page script 24 / 48 / 24 scenes in 3 acts (Act 2 split 2A / 2B at the midpoint)', () => {
    const { beats } = populateByPages([], scenesFor(96), 3, 96);
    const cols = byAct(beats).map((c) => c.length);
    assert.deepEqual([cols[0], cols[1] + cols[2], cols[3]], [24, 48, 24]);
    assert.deepEqual([cols[1], cols[2]], [24, 24]);
  });
  it('places a 96-page script 24 each in 4 acts', () => {
    const { beats } = populateByPages([], scenesFor(96), 4, 96);
    assert.deepEqual(byAct(beats).map((c) => c.length), [24, 24, 24, 24]);
  });
  it('the board’s Populate menu shows the shares and, underneath, the page ranges', () => {
    // see tests/uiLabels.test.js for the labels themselves
    assert.match(formatPageTargets(3, 96), /^pp\. /);
  });
});
