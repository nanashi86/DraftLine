import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the rule whose selector list is exactly `sel` (comments ignored). */
const rule = (file, sel) => {
  for (const m of strip(read(file)).matchAll(/([^{}]+?)\{([^{}]*)\}/g)) {
    if (m[1].split(/\s+/).join(' ').trim() === sel) return m[2];
  }
  throw new Error(`${file}: no rule "${sel}"`);
};
const index = read('index.css');

describe('Colour tokens: one source for every interactive state', () => {
  it(':root defines the shared states', () => {
    for (const t of ['--hover-bg: rgba(255, 255, 255, 0.04);', '--border-hover:', '--accent-border:', '--accent-tint:', '--accent-tint-card:', '--accent-tint-field:', '--accent-soft:', '--danger:']) {
      assert.ok(index.includes(t), t);
    }
  });

  it('header toggles and view switches take their on-state from tokens, never a hex', () => {
    const on = [
      ['App.css', '.ws-btn.is-on'], ['App.css', '.seg-btn.is-on'], ['App.css', '.btn-accent.is-on, .btn-bible.is-on'],
      ['App.css', '.fmt-btn.is-on'], ['components/planning/PlanFilter.css', '.pf-btn.is-on'], ['index.css', '.pill.is-on, .pill.is-selected'],
    ];
    for (const [f, sel] of on) {
      const body = rule(f, sel);
      assert.doesNotMatch(body, /(?:background|color|border-color)\s*:\s*#/, `${sel} uses a hex`);
      assert.match(body, /var\(--/, sel);
    }
    assert.match(rule('App.css', '.fmt-btn.is-on'), /background: var\(--accent-soft\);[\s\S]*color: var\(--on-accent\);/);
  });

  it('selected and open cards share one accent edge and one tint (Projects, storage, About, bios, glossary, export options)', () => {
    for (const [f, sel] of [
      ['components/ProjectsDrawer.css', '.pd-card.is-active'], ['components/ProjectsDrawer.css', '.sd-card.is-on'], ['components/HelpModal.css', '.hm-pill:hover'],
      ['components/ProjectBibleDrawer.css', '.pb-char.is-open'], ['components/ProjectBibleDrawer.css', '.dict-entry.is-open'], ['components/ExportBibleModal.css', '.eb-option.is-on'],
    ]) assert.match(rule(f, sel), /border-color: var\(--accent-border\);/, sel);
    assert.match(rule('components/ProjectsDrawer.css', '.pd-card.is-active'), /background: var\(--accent-tint-card\);/);
    assert.match(rule('components/ProjectsDrawer.css', '.sd-card.is-on'), /background: var\(--accent-tint\);/);
    assert.match(rule('components/HelpModal.css', '.hm-pill:hover'), /background: var\(--accent-tint-field\);/);
  });

  it('subtle hovers on dark surfaces use the one neutral overlay (stacked on a resting fill where there is one)', () => {
    const plain = [
      ['App.css', '.btn:hover:not(:disabled)'], ['App.css', '.fmt-btn:hover:not(:disabled)'], ['App.css', '.brand:hover, .brand.is-open'],
      ['App.css', '.status-btn:hover'], ['App.css', '.icon-btn:hover'], ['components/Navigator.css', '.nav-item:hover'],
      ['components/FormatDoctorModal.css', '.fd-row:hover'], ['components/NotesDrawer.css', '.nd-row:hover'], ['components/planning/PlanFilter.css', '.pf-btn:hover'],
      ['components/planning/PlanningWorkspace.css', '.plan-go:hover'], ['components/planning/PlanningWorkspace.css', '.rp-row:hover td, .rp-row:focus-visible td'],
      ['components/UserGuideModal.css', '.ug-toc button:hover:not(:disabled)'], ['components/DialogueTuner.css', '.tune-jump:hover'],
    ];
    for (const [f, sel] of plain) assert.match(rule(f, sel), /background: var\(--hover-bg\);/, sel);
    for (const [f, sel] of [['index.css', '.pill:hover:not(.is-on, .is-selected)'], ['App.css', '.cover-btn:hover'], ['App.css', '.status-noir:hover']]) {
      assert.match(rule(f, sel), /background: linear-gradient\(var\(--hover-bg\), var\(--hover-bg\)\), /, `${sel}: the overlay on top of its resting fill, so hover still lightens it`);
    }
  });

  it('outlines under the pointer share one colour', () => {
    for (const [f, sel] of [['App.css', '.btn.btn-outline:hover:not(:disabled)'], ['components/ProjectsDrawer.css', '.pd-card:hover'], ['components/DialogueTuner.css', '.tuner-mono:hover']]) {
      assert.match(rule(f, sel), /border-color: var\(--border-hover\);/, sel);
    }
  });
});
