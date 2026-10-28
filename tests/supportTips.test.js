import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DAY_MS, EXPORT_TIP, EXPORT_TOAST_MS, FORMAT_DOCTOR_TIP, KO_FI_URL, PATREON_URL,
  autoDismiss, claimTip, muteTip, readTip, shouldShowTip,
} from '../src/lib/supportTips.js';
import { DoctorSupportFooter, ExportToast } from '../src/components/SupportCallouts.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A localStorage stand-in. */
function store(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    dump: () => Object.fromEntries(m),
  };
}
const NOW = Date.UTC(2026, 9, 25, 12);

describe('Cooldowns', () => {
  it('the intervals and storage keys are exactly as specified', () => {
    assert.equal(EXPORT_TIP.cooldownMs, 14 * 24 * 60 * 60 * 1000);
    assert.equal(FORMAT_DOCTOR_TIP.cooldownMs, 30 * 24 * 60 * 60 * 1000);
    assert.deepEqual([EXPORT_TIP.lastKey, EXPORT_TIP.muteKey], ['last_export_tip_shown', 'export_tip_muted']);
    assert.deepEqual([FORMAT_DOCTOR_TIP.lastKey, FORMAT_DOCTOR_TIP.muteKey], ['last_format_doctor_tip_shown', 'format_doctor_tip_muted']);
  });

  for (const [tip, days] of [[EXPORT_TIP, 14], [FORMAT_DOCTOR_TIP, 30]]) {
    it(`${days}-day tip: due when never shown or ${days} days have passed, not a moment before`, () => {
      const show = (last) => shouldShowTip(tip, { now: NOW, last, muted: false });
      assert.equal(show(NaN), true, 'never shown');
      assert.equal(show(NOW - days * DAY_MS), true, `exactly ${days} days`);
      assert.equal(show(NOW - days * DAY_MS - 1), true);
      assert.equal(show(NOW - days * DAY_MS + 1), false, 'one millisecond short');
      assert.equal(show(NOW - DAY_MS), false, 'yesterday');
      assert.equal(show(NOW), false, 'just shown');
      assert.equal(show(NOW + 5 * DAY_MS), true, 'a future timestamp (clock set back) does not silence it');
    });
  }

  it('the 14- and 30-day tips disagree between day 14 and day 30', () => {
    const last = NOW - 20 * DAY_MS;
    assert.equal(shouldShowTip(EXPORT_TIP, { now: NOW, last, muted: false }), true);
    assert.equal(shouldShowTip(FORMAT_DOCTOR_TIP, { now: NOW, last, muted: false }), false);
  });
});

describe('Permanent mute', () => {
  for (const tip of [EXPORT_TIP, FORMAT_DOCTOR_TIP]) {
    it(`${tip.muteKey} wins over any timestamp, and claiming writes nothing`, () => {
      for (const last of [NaN, 0, NOW - 400 * DAY_MS, NOW, NOW + DAY_MS]) {
        assert.equal(shouldShowTip(tip, { now: NOW, last, muted: true }), false);
      }
      const s = store({ [tip.muteKey]: 'true', [tip.lastKey]: String(NOW - 400 * DAY_MS) });
      assert.equal(claimTip(tip, { storage: s, now: NOW }), false);
      assert.equal(s.dump()[tip.lastKey], String(NOW - 400 * DAY_MS), 'timestamp untouched');
    });
  }

  it('muteTip stores the flag as the string "true", and only for that tip', () => {
    const s = store();
    muteTip(EXPORT_TIP, s);
    assert.deepEqual(s.dump(), { export_tip_muted: 'true' });
    assert.equal(claimTip(EXPORT_TIP, { storage: s, now: NOW }), false);
    assert.equal(claimTip(FORMAT_DOCTOR_TIP, { storage: s, now: NOW }), true, 'the other tip is unaffected');
  });
});

describe('Claiming a tip records when it showed', () => {
  it('first claim shows and stamps the time; the next within the cooldown does not; after it, it does again', () => {
    const s = store();
    assert.equal(claimTip(EXPORT_TIP, { storage: s, now: NOW }), true);
    assert.equal(s.dump().last_export_tip_shown, String(NOW));
    assert.equal(claimTip(EXPORT_TIP, { storage: s, now: NOW + 13 * DAY_MS }), false);
    assert.equal(s.dump().last_export_tip_shown, String(NOW), 'not re-stamped when not shown');
    assert.equal(claimTip(EXPORT_TIP, { storage: s, now: NOW + 14 * DAY_MS }), true);
    assert.equal(s.dump().last_export_tip_shown, String(NOW + 14 * DAY_MS));
  });

  it('no usable storage: stays quiet (it could not remember to stop)', () => {
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(claimTip(EXPORT_TIP, { storage: null, now: NOW }), false);
    assert.equal(claimTip(EXPORT_TIP, { storage: throwing, now: NOW }), false);
    assert.equal(readTip(EXPORT_TIP, throwing), null);
    const readOnly = { ...store(), setItem() { throw new Error('quota'); } };
    assert.equal(claimTip(FORMAT_DOCTOR_TIP, { storage: readOnly, now: NOW }), false, 'cannot record it, so it does not show');
    assert.doesNotThrow(() => muteTip(EXPORT_TIP, throwing));
  });
});

describe('Export toast: closes itself, never in the way', () => {
  it(`dismisses after ${EXPORT_TOAST_MS / 1000} s; pointing at it pauses the clock; closing cancels`, () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
    try {
      let n = 0;
      autoDismiss(() => { n++; });
      mock.timers.tick(EXPORT_TOAST_MS - 1);
      assert.equal(n, 0);
      mock.timers.tick(1);
      assert.equal(n, 1, 'gone at 8 s');

      let m = 0;
      const t = autoDismiss(() => { m++; });
      mock.timers.tick(3000);
      t.pause();
      mock.timers.tick(60_000);
      assert.equal(m, 0, 'waits while hovered or focused');
      t.resume();
      mock.timers.tick(4999);
      assert.equal(m, 0);
      mock.timers.tick(1);
      assert.equal(m, 1, 'then finishes the remaining 5 s');

      let k = 0;
      autoDismiss(() => { k++; }).cancel();
      mock.timers.tick(EXPORT_TOAST_MS * 2);
      assert.equal(k, 0);
    } finally {
      mock.timers.reset();
    }
  });

  const html = (props) => renderToStaticMarkup(createElement(ExportToast, { onClose() {}, ...props }));

  it('cooling down or muted: only the status line', () => {
    const out = html({ fileName: 'the-last-ferry.fdx', tip: false });
    assert.match(out, /Script exported successfully<span class="et-file"> \(the-last-ferry\.fdx\)<\/span>/);
    assert.doesNotMatch(out, /ko-fi|patreon|Don’t show again|et-tip/i);
    assert.match(out, /^<div class="export-toast" role="status" aria-live="polite">/);
  });

  it('due: the status line plus the support line, links in a new tab, and Don’t show again', () => {
    const out = html({ fileName: 'the-last-ferry.fountain', tip: true });
    assert.match(out, /class="export-toast has-tip"/);
    assert.match(out, /<p class="et-tip">DraftLine is free &amp; offline\. If it saved you time today, consider supporting on <a href="https:\/\/ko-fi\.com\/draftline" target="_blank" rel="noopener noreferrer">Ko-fi<\/a> or <a href="https:\/\/patreon\.com\/DraftLine" target="_blank" rel="noopener noreferrer">Patreon<\/a>\./);
    assert.match(out, /<button type="button" class="et-mute">Don’t show again<\/button>/);
    assert.match(out, /aria-label="Close, and don’t show the support note again"/);
  });

  it('takes no focus and handles no keys: typing on the canvas goes on undisturbed', () => {
    for (const tip of [false, true]) {
      const out = html({ fileName: 'x.fdx', tip });
      assert.doesNotMatch(out, /autofocus|tabindex/i);
    }
    const src = read('src/components/SupportCallouts.js');
    assert.doesNotMatch(src, /keydown|keyup|keypress|\.focus\(|autoFocus|preventDefault|stopPropagation/);
    assert.match(read('src/App.css'), /\.export-toast \{[^}]*position: fixed;[^}]*right: 18px;/, 'a corner, over the desk');
  });

  it('every script export shows it: .fountain, .fdx, .draftline, Projects exports, and print / PDF', () => {
    const app = read('src/App.jsx');
    assert.match(app, /download\(`\$\{base\}\.fountain`, [^\n]*\);\s*showExportToast\(`\$\{base\}\.fountain`\);/);
    assert.match(app, /download\(`\$\{base\}\.fdx`, [^\n]*\);\s*showExportToast\(`\$\{base\}\.fdx`\);/);
    assert.match(app, /BACKUP_MIME\);\s*showExportToast\(name\);/);
    assert.match(app, /showExportToast\(`\$\{name\}\.\$\{kind\}`\);/);
    assert.match(app, /const after = \(\) => \{\s*setPrinting\(false\);\s*showExportToast\(null, 'Script sent to the print dialog'\);/);
    assert.match(app, /setExportToast\(\{ key: Date\.now\(\), fileName, message, tip: claimTip\(EXPORT_TIP\) \}\);/);
    assert.match(app, /if \(mute\) muteTip\(EXPORT_TIP\);/);
  });
});

describe('Format Doctor: a quiet line under a clean report', () => {
  it('reads "Independent & ad-free · Support on Ko-fi · Patreon · Dismiss"', () => {
    const out = renderToStaticMarkup(createElement(DoctorSupportFooter, { onDismiss() {} }));
    assert.equal(out.replace(/<[^>]+>/g, ''), 'Independent &amp; ad-free · Support on Ko-fi · Patreon · Dismiss');
    assert.ok(out.includes(`href="${KO_FI_URL}" target="_blank" rel="noopener noreferrer"`));
    assert.ok(out.includes(`href="${PATREON_URL}" target="_blank" rel="noopener noreferrer"`));
  });

  it('only for a clean report — ignored findings count as unresolved — at most every 30 days', () => {
    const app = read('src/App.jsx');
    assert.match(app, /const scriptIsClean = useCallback\(\(b\) => auditScript\(b, \{ skipId: activeId, layout: b === blocks \? layout : null \}\)\.length === 0/, 'audited without the ignore list');
    assert.match(app, /const openDoctor = useCallback\(\(\) => \{\s*setDoctorTip\(scriptIsClean\(blocks\) && claimTip\(FORMAT_DOCTOR_TIP\)\);\s*setDoctorOpen\(true\);/);
    assert.match(app, /if \(doctorOpen && !doctorTip && scriptIsClean\(next\)\) setDoctorTip\(claimTip\(FORMAT_DOCTOR_TIP\)\);/, 'or the fix that clears the last finding');
    assert.match(app, /supportFooter=\{doctorTip && issues\.length === 0 \? \(/);
    assert.match(app, /onDismiss=\{\(\) => \{\s*muteTip\(FORMAT_DOCTOR_TIP\);/);
    const modal = read('src/components/FormatDoctorModal.jsx');
    assert.match(modal, /\{issues\.length === 0 && supportFooter && <li className="fd-support-row">\{supportFooter\}<\/li>\}/);
    assert.ok(modal.indexOf('fd-support-row') > modal.indexOf('className="fd-clean"'), 'beneath the All Clear card');
  });
});
