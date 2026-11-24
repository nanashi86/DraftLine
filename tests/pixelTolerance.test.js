// The screenshot tolerance for the browser tests (tests/browser/pixels.js), in numbers: anti-aliasing
// noise passes, anything a person could see fails. (tests/browser/stripboard.browser.js proves the same
// with real renders of the Stripboard.)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CHANGED_RATIO, MAX_DELTA, judgePixels } from './browser/pixels.js';

const board = (changed, maxDelta, size = '1440x818') => judgePixels({ actual: size, expected: '1440x818', changed, maxDelta });

describe('screenshot tolerance', () => {
  it('the limits: 2/255 per channel, 0.01% of the pixels (117 on a 1440×818 board)', () => {
    assert.equal(MAX_DELTA, 2);
    assert.equal(MAX_CHANGED_RATIO, 0.0001);
  });
  it('passes the Windows anti-aliasing seen on the Stripboard', () => {
    for (const [changed, d] of [[5, 2], [4, 2], [47, 2], [36, 2], [117, 1]]) assert.equal(board(changed, d).ok, true, `${changed}px Δ${d}`);
  });
  it('fails any pixel 3/255 or more off, even one', () => {
    assert.equal(board(1, 3).ok, false);
    assert.match(board(1, 255).why, /255\/255/);
  });
  it('fails a faint change over more than 0.01% of the board', () => {
    assert.equal(board(118, 1).ok, false);
    assert.match(board(50000, 2).why, /50000 pixels changed/);
  });
  it('fails a different size, whatever else', () => {
    assert.equal(board(0, 0, '1440x819').ok, false);
  });
});
