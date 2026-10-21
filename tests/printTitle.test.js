import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holdPrintTitle, printInNewWindow } from '../src/lib/printTitle.js';
import { PRINT_TITLE, guideHtml, parseGuide } from '../src/lib/userGuide.js';

/** A window with a document title and listeners we can fire. */
function fakeWindow(title) {
  const make = () => {
    const l = new Map();
    return {
      addEventListener: (t, f) => l.set(t, [...(l.get(t) || []), f]),
      removeEventListener: (t, f) => l.set(t, (l.get(t) || []).filter((x) => x !== f)),
      fire: (t) => (l.get(t) || []).forEach((f) => f()),
      count: (t) => (l.get(t) || []).length,
    };
  };
  const w = make();
  w.document = { title, ...make() };
  return w;
}

describe('User Guide print: "DraftLine - User Guide.pdf"', () => {
  it('the title Chrome suggests the PDF name from', () => assert.equal(PRINT_TITLE, 'DraftLine - User Guide'));

  it('sets the title on both the page and the print frame', () => {
    const top = fakeWindow('What Happened to Haiti? — DraftLine');
    const frame = fakeWindow('');
    holdPrintTitle({ topWindow: top, frameWindow: frame, title: PRINT_TITLE });
    assert.equal(top.document.title, PRINT_TITLE);
    assert.equal(frame.document.title, PRINT_TITLE);
    assert.match(guideHtml(parseGuide('# G')), /<title>DraftLine - User Guide<\/title>/);
  });

  it('keeps it while the dialog is open — nothing restores it when print() returns', () => {
    const top = fakeWindow('Run! — DraftLine');
    const frame = fakeWindow('');
    const held = holdPrintTitle({ topWindow: top, frameWindow: frame, title: PRINT_TITLE });
    held.armFallback(); // what runs right after print() returns
    assert.equal(top.document.title, PRINT_TITLE, 'still set when Chrome opens the dialog');
  });

  for (const which of ['frame', 'top']) {
    it(`restores the script's title on afterprint from the ${which} window, once, and cleans up`, () => {
      const top = fakeWindow('Run! — DraftLine');
      const frame = fakeWindow('');
      let done = 0;
      const held = holdPrintTitle({ topWindow: top, frameWindow: frame, title: PRINT_TITLE, onDone: () => { done += 1; } });
      held.armFallback();
      (which === 'frame' ? frame : top).fire('afterprint');
      assert.equal(top.document.title, 'Run! — DraftLine');
      top.fire('afterprint');
      frame.document.fire('pointerdown');
      assert.equal(done, 1);
      for (const t of ['afterprint']) assert.equal(top.count(t) + frame.count(t), 0);
      for (const t of ['pointerdown', 'keydown']) assert.equal(top.document.count(t) + frame.document.count(t), 0);
    });
  }

  it('no afterprint at all: the first click or key afterwards (the dialog is modal) restores it', () => {
    const top = fakeWindow('Run! — DraftLine');
    const frame = fakeWindow('');
    const held = holdPrintTitle({ topWindow: top, frameWindow: frame, title: PRINT_TITLE });
    held.armFallback();
    frame.document.fire('keydown'); // focus is still in the frame
    assert.equal(top.document.title, 'Run! — DraftLine');
  });

  it('a title set meanwhile (the script renamed) is left alone', () => {
    const top = fakeWindow('Run! — DraftLine');
    const held = holdPrintTitle({ topWindow: top, frameWindow: fakeWindow(''), title: PRINT_TITLE });
    top.document.title = 'Run Fito Run — DraftLine';
    held.restore();
    assert.equal(top.document.title, 'Run Fito Run — DraftLine');
  });

  it('the modal prints through it, and never restores synchronously after print()', () => {
    const ui = readFileSync(new URL('../src/components/UserGuideModal.jsx', import.meta.url), 'utf8');
    const fn = ui.slice(ui.indexOf('function printGuide'), ui.indexOf('export default function'));
    assert.match(fn, /const held = holdPrintTitle\(\{\s*topWindow: window,\s*frameWindow: frame\.contentWindow,\s*title: PRINT_TITLE,/);
    assert.match(fn, /frame\.contentWindow\.print\(\);[^\n]*\n\s*held\.armFallback\(\);\s*\};/);
    assert.ok(!/restoreTitle\(\)|held\.restore\(\)|setTimeout\(done/.test(fn));
  });
});

/** A popup window that records what happens to it. */
function fakePopup({ readyState = 'complete' } = {}) {
  const calls = [];
  const doc = {
    readyState, title: '', html: '',
    open: () => calls.push('open'), write: (h) => { doc.html += h; calls.push('write'); }, close: () => calls.push('doc.close'),
  };
  const w = {
    document: doc, calls, onafterprint: null,
    focus: () => calls.push('focus'), print: () => calls.push('print'), close: () => calls.push('close'),
    addEventListener: (t, f) => { if (t === 'load') w.load = f; },
  };
  return w;
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

describe('User Guide print: its own window, titled "DraftLine - User Guide"', () => {
  const html = guideHtml(parseGuide('# G\n\n## A\n\nText.'), { title: PRINT_TITLE });
  it('opens a blank 800×900 window, writes the guide into it, titles it, then focuses and prints', async () => {
    const w = fakePopup();
    let args;
    const got = printInNewWindow({ openWindow: (...a) => { args = a; return w; }, html, title: PRINT_TITLE });
    assert.equal(got, w);
    assert.deepEqual(args, ['', '_blank', 'width=800,height=900']);
    assert.match(w.document.html, /^<!doctype html>[^]*<title>DraftLine - User Guide<\/title>[^]*<h2>A<\/h2>/);
    assert.equal(w.document.title, PRINT_TITLE);
    assert.deepEqual(w.calls, ['open', 'write', 'doc.close']);
    await tick(80);
    assert.deepEqual(w.calls.slice(3), ['focus', 'print']);
  });
  it('closes itself after printing (afterprint), once', () => {
    const w = fakePopup();
    printInNewWindow({ openWindow: () => w, html, title: PRINT_TITLE });
    w.onafterprint();
    w.onafterprint();
    assert.equal(w.calls.filter((c) => c === 'close').length, 1);
  });
  it('waits for the page to load before printing, but never forever', async () => {
    const w = fakePopup({ readyState: 'loading' });
    printInNewWindow({ openWindow: () => w, html, title: PRINT_TITLE });
    await tick(80);
    assert.ok(!w.calls.includes('print'));
    w.load();
    await tick(80);
    assert.equal(w.calls.filter((c) => c === 'print').length, 1);
  });
  it('popup blocked → null, so the modal prints in place instead', () => {
    assert.equal(printInNewWindow({ openWindow: () => null, html, title: PRINT_TITLE }), null);
    assert.equal(printInNewWindow({ openWindow: () => { throw new Error('blocked'); }, html, title: PRINT_TITLE }), null);
    const ui = readFileSync(new URL('../src/components/UserGuideModal.jsx', import.meta.url), 'utf8');
    assert.match(ui, /if \(printInNewWindow\(\{ openWindow: \(\.\.\.a\) => window\.open\(\.\.\.a\), html, title: PRINT_TITLE \}\)\) return;\s*printInFrame\(html, returnFocusTo\);/);
  });
});

