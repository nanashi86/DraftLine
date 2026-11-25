// Planned features in the interface (ROADMAP.md): Shoot after Board, Budget after Stripboard
// (Schedule is built: the Stripboard's Schedule view), Co-Write… in Write's ⋮. Each opens a short preview and nothing else: no view change,
// no project data, no purchase, no network. Table Read… (also in Write's ⋮) is built: it opens the
// floating player instead (tests/tableRead.test.js).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moreMenuItems } from '../src/lib/toolbar.js';
import { PLANNED_FEATURES, PLAN_PLANNED_TABS, SHOOT_TAB } from '../src/lib/plannedFeatures.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = read('src/App.jsx');
const modal = read('src/components/PlannedFeatureModal.jsx');
const labels = (items) => items.map((i) => (i.divider ? '---' : i.label));

describe('Planned-feature previews', () => {
  it('say exactly what was approved', () => {
    assert.deepEqual(PLANNED_FEATURES.shoot, {
      title: 'Shoot',
      status: 'Planned for DraftLine Pro',
      headline: 'From spec to shooting script.',
      body: 'Lock pages and scene numbers, manage revision rounds, and prepare revised pages for production.',
      note: 'A future optional upgrade. DraftLine Core remains free.',
    });
    assert.equal(PLANNED_FEATURES.schedule, undefined, 'Scheduling is built: no preview');
    assert.equal(PLANNED_FEATURES.budget, undefined, 'the Budget is built (Stage 2, Phase 3B): no preview');
    assert.equal(PLANNED_FEATURES.tableRead, undefined, 'Table Read is built: no preview');
    assert.equal(PLANNED_FEATURES.coWrite.status, 'Planned optional collaboration');
    assert.equal(PLANNED_FEATURES.coWrite.note, 'A future optional hosted service. Solo writing stays free.');
    assert.doesNotMatch(JSON.stringify(PLANNED_FEATURES), /\$|price|purchase|subscription|\/month/i, 'no prices in the app');
  });
  it('never use the retired names, and offer nothing to buy', () => {
    const all = JSON.stringify(PLANNED_FEATURES) + modal;
    assert.doesNotMatch(all, /Pro: Co-Write|Pro: Production|Buy|Subscribe|Activate|Sign up|waitlist/i);
    assert.equal((modal.match(/<button/g) || []).length, 1, 'only Close');
    assert.match(modal, />Close<\/button>/);
  });
  it('a native modal dialog, labelled and described, that puts focus back where it was', () => {
    assert.match(modal, /<dialog[\s\S]*aria-labelledby="pf-title"[\s\S]*aria-describedby="pf-desc"/);
    assert.match(modal, /d\.showModal\(\)/);
    assert.match(modal, /if \(returnFocus\?\.isConnected\) returnFocus\.focus\(\);/);
    assert.doesNotMatch(modal, /fetch\(|localStorage|indexedDB|setItem|onChange|setBlocks|setProduction/);
  });
  it('opening one changes nothing else: only the planned state is set', () => {
    assert.match(app, /const openPlanned = \(id, from = null\) => setPlanned\(\{ id, from: from \|\| barRef\.current\?\.querySelector\('\.btn-kebab'\) \|\| null \}\);/);
    assert.match(app, /\{planned && <PlannedFeatureModal id=\{planned\.id\} returnFocus=\{planned\.from\} onClose=\{\(\) => setPlanned\(null\)\} \/>\}/);
  });
});

describe('Write: Page | Split | Board | Shoot', () => {
  it('Shoot follows Board, with the Lucide file-check-2 icon (Import Scenes keeps film), in the same switch', () => {
    assert.equal(SHOOT_TAB.label, 'Shoot');
    const seg = app.slice(app.indexOf('className="seg view-seg"'), app.indexOf('{/* Workspace tools'));
    assert.ok(seg.indexOf('writeViewList.map') < seg.indexOf("openPlanned('shoot'"));
    assert.match(seg, /<FileCheck2 size=\{14\} strokeWidth=\{1\.75\} aria-hidden \/>/);
    assert.match(seg, /aria-haspopup="dialog"/);
    assert.doesNotMatch(seg, /Pro<|LockBadge|Lock |disabled/);
  });
  it('is not a view: Alt+B still cycles Page, Split and Board only', () => {
    assert.doesNotMatch(app, /id: 'shoot'/);
    assert.match(app, /setView\(\(v\) => writeViewList\[\(writeViewList\.findIndex\(\(x\) => x\.id === v\) \+ 1\) % writeViewList\.length\]\.id\);/);
  });
});

describe('Plan: Breakdowns | Stripboard | Budget', () => {
  it('Budget (calculator) follows Stripboard, a view of its own now; Schedule is the Stripboard’s own view, not a tab; Reports is no longer a tab', () => {
    assert.deepEqual(PLAN_PLANNED_TABS, [], 'no planned tabs left in Plan');
    assert.match(app, /\{ id: 'stripboard', [^}]+\},\s*\{ id: 'budget', label: 'Budget', title: '[^']+', Icon: Calculator \},\s*\{ id: 'reports'/);
    assert.doesNotMatch(app, /CalendarCheck|openPlanned\('schedule'/);
    const seg = app.slice(app.indexOf('className="seg plan-seg"'), app.indexOf('className="seg view-seg"'));
    assert.ok(seg.indexOf('PLAN_TABS.map') < seg.indexOf('PLAN_PLANNED_TABS.map'));
    assert.doesNotMatch(seg, /PLAN_VIEWS\.map/);
  });
  it('Plan keeps its clapperboard', () => {
    assert.match(app, /\{ id: 'plan', label: 'Plan', title: '[^']+', Icon: Clapperboard \}/);
    assert.match(app, /\{ id: 'write', label: 'Write', title: '[^']+', Icon: PenLine \}/);
  });
});

describe('⋮ in Write and Plan', () => {
  const base = { bibleOnBar: true, charactersOnBar: true, onSnapshots() {}, onNotes() {}, onFormatDoctor() {}, onReports() {}, onShortcuts() {}, onSettings() {}, onGuide() {}, onFeedback() {}, onAbout() {} };
  it('Write: the four script tools, then Table Read… and Co-Write…, then Keyboard Shortcuts and the rest', () => {
    assert.deepEqual(labels(moreMenuItems({ ...base, onTableRead() {}, onCoWrite() {} })), [
      'View Snapshots', 'Margin Notes', 'Format Doctor', 'Reports', '---', 'Table Read…', 'Co-Write…', '---',
      'Keyboard Shortcuts', '---', 'Settings…', 'User Guide', 'Send Feedback…', 'About DraftLine',
    ]);
  });
  it('Plan: the same four first, Reports once, and no Table Read or Co-Write', () => {
    const plan = labels(moreMenuItems(base));
    assert.deepEqual(plan.slice(0, 5), ['View Snapshots', 'Margin Notes', 'Format Doctor', 'Reports', '---']);
    assert.equal(plan.filter((l) => l === 'Reports').length, 1);
    assert.ok(!plan.includes('Table Read…') && !plan.includes('Co-Write…'));
    assert.match(app, /onTableRead: inPlan \? null : openTableRead,/, 'Table Read opens the real player');
    assert.doesNotMatch(app, /openPlanned\('tableRead'\)/, 'never the preview');
    assert.match(app, /onCoWrite: inPlan \? null : \(\) => openPlanned\('coWrite'\),/);
  });
  it('no prices or badges beside the menu items themselves', () => {
    for (const i of moreMenuItems({ ...base, onTableRead() {}, onCoWrite() {} })) {
      if (/Table Read|Co-Write/.test(i.label || '')) assert.equal(i.hint, undefined);
    }
  });
});
