import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTALLED_MODES, isInstalledApp, openInThemedTab, PAGE_BACKGROUND } from '../src/lib/themedTab.js';

function setup(theme, { blocked = false } = {}) {
  const written = [];
  const tab = {
    opener: {}, replaced: null,
    document: { open() {}, write(h) { written.push(h); }, close() {} },
    location: { replace(u) { tab.replaced = u; } },
  };
  const doc = { documentElement: { getAttribute: (n) => (n === 'data-theme' ? theme : null) } };
  const win = { open: () => (blocked ? null : tab) };
  const event = { button: 0, prevented: false, defaultPrevented: false, preventDefault() { this.prevented = true; } };
  return { tab, written, doc, win, event };
}

test('Editorial Light opens the page in a linen tab', () => {
  const { tab, written, doc, win, event } = setup('light');
  assert.equal(openInThemedTab(event, 'https://draftlineapp.com/features/', doc, win), true);
  assert.ok(event.prevented);
  assert.match(written.join(''), new RegExp(PAGE_BACKGROUND.light));
  assert.match(written.join(''), /color-scheme" content="light"/);
  assert.equal(tab.opener, null);
  assert.equal(tab.replaced, 'https://draftlineapp.com/features/');
});

test('Espresso Noir (no data-theme) opens a dark tab', () => {
  const { written, doc, win, event } = setup(null);
  openInThemedTab(event, '/compare/', doc, win);
  assert.match(written.join(''), new RegExp(PAGE_BACKGROUND.dark));
});

test('a blocked pop-up leaves the link to open normally', () => {
  const { doc, win, event } = setup('light', { blocked: true });
  assert.equal(openInThemedTab(event, '/philosophy/', doc, win), false);
  assert.equal(event.prevented, false);
});

test('modified and middle clicks keep the link behaviour', () => {
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
    const { doc, win, event } = setup('light');
    Object.assign(event, extra);
    assert.equal(openInThemedTab(event, '/features/', doc, win), false);
    assert.equal(event.prevented, false);
  }
});

test('the installed app keeps the link behaviour, so the pages open in an app window', () => {
  for (const mode of INSTALLED_MODES) {
    const { doc, win, event } = setup('light');
    let opened = false;
    win.open = () => { opened = true; return null; };
    win.matchMedia = (q) => ({ matches: q === `(display-mode: ${mode})` });
    assert.equal(isInstalledApp(win), true, mode);
    assert.equal(openInThemedTab(event, '/features/', doc, win), false, mode);
    assert.equal(event.prevented, false, mode);
    assert.equal(opened, false, mode);
  }
  const ios = setup('light');
  ios.win.navigator = { standalone: true };
  assert.equal(openInThemedTab(ios.event, '/compare/', ios.doc, ios.win), false);
});

test('a browser tab (no installed display mode) still gets the themed tab', () => {
  const { tab, doc, win, event } = setup('light');
  win.matchMedia = () => ({ matches: false });
  assert.equal(isInstalledApp(win), false);
  assert.equal(openInThemedTab(event, '/philosophy/', doc, win), true);
  assert.equal(tab.replaced, '/philosophy/');
});
