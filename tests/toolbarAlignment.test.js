import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const css = read('App.css');
const app = read('App.jsx');

describe('Toolbar: the top-right cluster sits on one baseline', () => {
  it('the cluster is a centred flex row with 8px gaps', () => {
    assert.match(css, /\.bar-right \{ display: flex; align-items: center; gap: 8px; \}/);
  });
  it('every button — the Export trigger inside its menu wrapper too — is the same 32px inline-flex box', () => {
    const rule = css.match(/\.bar-right > \.btn,\s*\.bar-right > \.menu > \.btn \{([^}]*)\}/);
    assert.ok(rule, 'one rule covers buttons and menu triggers');
    for (const d of ['display: inline-flex', 'align-items: center', 'justify-content: center', 'height: 32px', 'line-height: 1', 'vertical-align: middle', 'padding: 0 10px']) {
      assert.ok(rule[1].includes(d), d);
    }
  });
  it('the ▾ is its own small centred flex item', () => {
    assert.match(read('components/Menu.jsx'), /<span className="dropdown-caret" aria-hidden="true">▾<\/span>/);
    const rule = css.match(/\.dropdown-caret \{([^}]*)\}/)[1];
    for (const d of ['font-size: 0.75em', 'line-height: 1', 'display: inline-flex', 'align-items: center', 'margin-left: 4px']) assert.ok(rule.includes(d), d);
  });
  it('order: Export ▾ · Snapshot · Focus · Story Bible · Characters · ⋮', () => {
    const right = app.slice(app.indexOf('<div className="bar-group bar-right">'), app.indexOf('</header>'));
    const at = (s) => right.indexOf(s);
    const order = [at('label="Export"'), at('btn-snapshot'), at('>Focus<'), at('btn-bible'), at('btn btn-accent'), at('btn btn-kebab')];
    assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), JSON.stringify(order));
  });
});

describe('Header: the D badge opens About; the title ▾ opens the one Projects drawer', () => {
  const id = app.slice(app.indexOf('className="bar-group g-identity"'), app.indexOf('<span className="bar-sep"'));
  it('no breadcrumb, no second project popover', () => {
    assert.ok(!/Breadcrumbs|crumb/.test(app), 'App has no breadcrumb');
    assert.ok(!/crumb/.test(css), 'no breadcrumb styles left');
    assert.ok(!existsSync(new URL('../src/components/Breadcrumbs.jsx', import.meta.url)));
  });
  it('the title’s single chevron toggles the Projects drawer; the badge no longer does', () => {
    assert.match(id, /className=\{`brand\$\{helpKind === 'about' \? ' is-open' : ''\}`\}\s*onClick=\{\(\) => setHelpKind\('about'\)\}/);
    assert.equal((id.match(/setDrawerOpen\(\(o\) => !o\)/g) || []).length, 1, 'only the chevron opens Projects');
    assert.match(id, /className="doc-switch-btn"\s*onClick=\{\(\) => setDrawerOpen\(\(o\) => !o\)\}/);
    assert.equal((id.match(/className="doc-switch-btn"/g) || []).length, 1);
    assert.equal((app.match(/<ProjectsDrawer\b/g) || []).length, 1, 'one Projects drawer in the app');
  });
  it('the title stays editable in place, with the author beside it', () => {
    assert.match(id, /className="doc-title"/);
    assert.match(id, /aria-label="Script title"/);
    assert.match(id, /className="doc-author"/);
  });
});
