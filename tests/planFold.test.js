import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PLAN_FOLD_SCENES, initialPlanFold } from '../src/lib/planFold.js';

const app = readFileSync(fileURLToPath(new URL('../src/App.jsx', import.meta.url)), 'utf8');
// The same arithmetic as App (planFold) and PlanningWorkspace (isOpen).
const open = (f, id) => f.closed === f.except.has(id);
const allFolded = (f) => f.closed && f.except.size === 0;
const foldAll = (f) => ({ closed: !allFolded(f), except: new Set() });
const toggle = (f, id) => {
  const except = new Set(f.except);
  if (except.has(id)) except.delete(id);
  else except.add(id);
  return { ...f, except };
};

describe('Plan → Breakdowns: starting fold', () => {
  it('the threshold is 10 scenes', () => assert.equal(PLAN_FOLD_SCENES, 10));
  it('10 scenes or fewer: every card open', () => {
    for (const n of [0, 1, 5, 10]) {
      const f = initialPlanFold(n);
      assert.equal(f.closed, false, `${n} scenes`);
      assert.equal(f.except.size, 0);
      assert.ok(open(f, 'a'));
    }
  });
  it('more than 10 scenes: every card folded, and the button reads Expand All', () => {
    for (const n of [11, 53, 200]) {
      const f = initialPlanFold(n);
      assert.equal(f.closed, true, `${n} scenes`);
      assert.ok(!open(f, 'a') && !open(f, 'b'));
      assert.ok(allFolded(f));
    }
  });
  it('a missing count reads as a short script', () => assert.equal(initialPlanFold().closed, false));
  it('each call is a fresh state (no shared except set)', () => {
    const a = initialPlanFold(20);
    a.except.add('x');
    assert.equal(initialPlanFold(20).except.size, 0);
  });
});

describe('Plan → Breakdowns: controls still work from a folded start', () => {
  it('a single card opens and folds again', () => {
    let f = initialPlanFold(30);
    f = toggle(f, 's3');
    assert.ok(open(f, 's3') && !open(f, 's4'));
    assert.ok(!allFolded(f)); // one open card → the button offers Collapse All
    f = toggle(f, 's3');
    assert.ok(!open(f, 's3') && allFolded(f));
  });
  it('Expand All opens everything, then Collapse All folds everything', () => {
    let f = foldAll(initialPlanFold(30));
    assert.ok(open(f, 'a') && open(f, 'b') && !allFolded(f));
    f = foldAll(toggle(f, 'a'));
    assert.ok(!open(f, 'a') && !open(f, 'b') && allFolded(f));
  });
  it('a short script starts open and Collapse All folds it', () => {
    const f = foldAll(initialPlanFold(4));
    assert.ok(allFolded(f));
  });
});

describe('Plan → Breakdowns: App wiring', () => {
  it('decides the fold once per script, when Plan opens, before paint', () => {
    assert.match(app, /import \{ initialPlanFold \} from '\.\/lib\/planFold\.js';/);
    assert.match(app, /const \[planFoldDue, setPlanFoldDue\] = useState\(true\);/);
    assert.match(app, /useLayoutEffect\(\(\) => \{\s*if \(!inPlan \|\| !planFoldDue\) return;\s*setPlanFoldDue\(false\);\s*setPlanFold\(initialPlanFold\(scenes\.length\)\);\s*\}, \[inPlan, planFoldDue, scenes\.length\]\);/);
  });
  it('opening another script decides it again', () => {
    assert.match(app, /setPlanFilter\(EMPTY_PLAN_FILTER\);[^\n]*\n\s*setPlanFoldDue\(true\);/);
  });
  it('Expand All / Collapse All and the card toggles are unchanged', () => {
    assert.match(app, /const planAllFolded = planFold\.closed && planFold\.except\.size === 0;/);
    assert.match(app, /const foldAllPlan = \(\) => setPlanFold\(\{ closed: !planAllFolded, except: new Set\(\) \}\);/);
    assert.match(app, /\{planAllFolded \? 'Expand All' : 'Collapse All'\}/);
    assert.match(app, /fold=\{planFold\}\s*onToggleCard=\{togglePlanCard\}/);
  });
});
