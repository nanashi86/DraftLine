import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moreMenuItems } from '../src/lib/toolbar.js';
import { BRAND_PAGES } from '../src/lib/brandMenu.js';

const src = readFileSync(new URL('../src/components/BrandMenu.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

describe('The DraftLine logo menu', () => {
  it('lists Welcome, Philosophy, Features and Compare in that order, each with its Lucide icon', () => {
    const rows = BRAND_PAGES.map((p) => [p.label, p.path, p.icon]);
    assert.deepEqual(rows, [
      ['Welcome to DraftLine', 'welcome/', 'House'],
      ['Our Philosophy', 'philosophy/', 'BookOpen'],
      ['Explore Features', 'features/', 'ListChecks'],
      ['Compare DraftLine', 'compare/', 'Columns2'],
    ]);
    assert.match(src, /import \{ BookOpen, Columns2, ExternalLink, House, Info, ListChecks \} from 'lucide-react';/);
    assert.match(src, /const ICONS = \{ House, BookOpen, ListChecks, Columns2 \};/);
  });
  it('ends with a separator, then About DraftLine (Info icon), which opens the existing About dialog', () => {
    const divider = src.indexOf('className="menu-divider"');
    const about = src.indexOf('<span>About DraftLine</span>');
    assert.ok(divider > src.indexOf('BRAND_PAGES.map') && about > divider);
    assert.match(src.slice(divider, about), /<Info size=\{15\}/);
    assert.match(src.slice(divider, about), /onAbout\(\);/);
    assert.match(app, /<BrandMenu onAbout=\{\(\) => setHelpKind\('about'\)\}/);
  });
  it('opens each page in a new tab (themed in a browser tab, an app window when installed), so the script stays open', () => {
    assert.match(src, /target="_blank"\s*rel="noopener"/);
    assert.match(src, /openInThemedTab\(e, e\.currentTarget\.href\)/);
    assert.match(src, /href=\{`\$\{base\}\$\{path\}`\}/);
  });
  it('has no Start Writing item: the writer is already in the editor', () => {
    assert.ok(!/Start Writing/i.test(src));
  });
  it('uses the app’s own dropdown styling', () => {
    assert.match(src, /className="menu-pop menu-left brand-menu-pop" role="menu"/);
    assert.equal((src.match(/className="menu-item"/g) || []).length, 2);
  });
  it('About DraftLine stays in ⋮ as well', () => {
    const items = moreMenuItems({ bibleOnBar: true, charactersOnBar: true, focusOnBar: true, onAbout() {} });
    assert.ok(items.some((i) => i.label === 'About DraftLine'));
  });
  it('closes on Escape (focus back on the logo) and on a click elsewhere', () => {
    assert.match(src, /e\.key !== 'Escape'/);
    assert.match(src, /buttonRef\.current\?\.focus\(\)/);
    assert.match(src, /document\.addEventListener\('mousedown', onDown\)/);
  });
});
