import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMPTY_PLAN_FILTER, filterPlanRows, matchesPlanFilter, planFilterActive, toggleIn } from '../src/lib/planFilter.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const row = (number, heading, setting, period, cast = []) => ({ number, heading, setting, period, location: heading.replace(/^\S+\s/, '').replace(/ - [A-Z]+$/, ''), cast: cast.map((name) => ({ name })) });
const ROWS = [
  row(1, 'INT. HOTEL BALLROOM - NIGHT', 'INT', 'night', ['FITO', 'PATRICK']),
  row(4, 'EXT. BOUCHARD RESIDENCE - FRONT GATE - NIGHT', 'EXT', 'night'),
  row(12, 'INT. FACTORY BUILDING - OFFICE - DAY', 'INT', 'day', ['FITO']),
  row(32, 'EXT. FRIEND’S HOUSE - NIGHT', 'EXT', 'night', ['TONY', 'RICKY', 'MAN 1']),
  row(36, 'INT./EXT. BOUCHARD RESIDENCE - MASTER BEDROOM - NIGHT', 'INT/EXT', 'night', ['TATI']),
  row(40, 'EXT. BOUCHARD RESIDENCE - PATIO - DAY', 'EXT', 'day', ['PRESIDENT MOÏSE']),
  row(50, 'INT. SOMEWHERE', 'INT', null),
];
const nums = (f) => filterPlanRows(ROWS, { ...EMPTY_PLAN_FILTER, ...f }).rows.map((r) => r.number);

describe('Plan scene filter: what matches', () => {
  it('nothing set: every scene, in order', () => {
    assert.equal(planFilterActive(EMPTY_PLAN_FILTER), false);
    assert.deepEqual(filterPlanRows(ROWS), { rows: ROWS, shown: 7, total: 7 });
  });
  it('text: heading or location, any case', () => {
    assert.deepEqual(nums({ q: 'bouchard' }), [4, 36, 40]);
    assert.deepEqual(nums({ q: 'Friend’s' }), [32]);
  });
  it('text: a speaking character, accents ignored', () => {
    assert.deepEqual(nums({ q: 'fito' }), [1, 12]);
    assert.deepEqual(nums({ q: 'moise' }), [40]);
    assert.deepEqual(nums({ q: 'Tati' }), [36]);
  });
  it('a number on its own: exactly that scene (not 12 for "1", not 32 for "2")', () => {
    assert.deepEqual(nums({ q: '1' }), [1]);
    assert.deepEqual(nums({ q: '32' }), [32]);
    assert.deepEqual(nums({ q: ' 12 ' }), [12]);
  });
  it('INT / EXT: INT./EXT. counts as both; both on is everything with a setting', () => {
    assert.deepEqual(nums({ ie: ['INT'] }), [1, 12, 36, 50]);
    assert.deepEqual(nums({ ie: ['EXT'] }), [4, 32, 36, 40]);
    assert.deepEqual(nums({ ie: ['INT', 'EXT'] }), [1, 4, 12, 32, 36, 40, 50]);
  });
  it('DAY / NIGHT: from the resolved time of day; none-set scenes only when it’s off', () => {
    assert.deepEqual(nums({ dn: ['night'] }), [1, 4, 32, 36]);
    assert.deepEqual(nums({ dn: ['day'] }), [12, 40]);
    assert.ok(!nums({ dn: ['day', 'night'] }).includes(50));
  });
  it('everything together narrows: "Bouchard" + EXT + NIGHT', () => {
    assert.deepEqual(nums({ q: 'Bouchard', ie: ['EXT'], dn: ['night'] }), [4, 36]);
    assert.deepEqual(filterPlanRows(ROWS, { q: 'zzz', ie: [], dn: [] }), { rows: [], shown: 0, total: 7 });
    assert.equal(matchesPlanFilter(ROWS[0], EMPTY_PLAN_FILTER), true);
  });
  it('toggleIn turns one value on or off', () => {
    assert.deepEqual(toggleIn([], 'INT'), ['INT']);
    assert.deepEqual(toggleIn(['INT', 'EXT'], 'INT'), ['EXT']);
  });
});

describe('Plan scene filter: where it shows', () => {
  const app = read('App.jsx');
  const ws = read('components/planning/PlanningWorkspace.jsx');
  const ui = read('components/planning/PlanFilter.jsx');
  const css = read('components/planning/PlanFilter.css');
  it('in the header’s middle slot on Breakdowns and Stripboard, not Reports; cleared when another script opens', () => {
    assert.match(app, /\{inPlan && planView !== 'reports' && <PlanFilter filter=\{planFilter\} onChange=\{setPlanFilter\} count=\{planCount\} \/>\}/);
    assert.match(app, /setPlanFilter\(EMPTY_PLAN_FILTER\); \/\/ a scene filter belongs to the script it was set on/);
  });
  it('the workspace applies it to Breakdowns and Stripboard (Reports cover the whole script) and reports the count', () => {
    assert.match(ws, /<Stripboard rows=\{shown\.rows\} totals=\{shownTotals\}/);
    assert.match(ws, /<Breakdowns rows=\{shown\.rows\}/);
    assert.match(ws, /<Reports rows=\{rows\}/);
    assert.match(ws, /onCount\?\.\(\{ shown: shown\.shown, total: shown\.total \}\);/);
    assert.match(ws, /No scenes match\./);
  });
  it('Find scenes… · INT | EXT · DAY | NIGHT, a count with ✕ while set, and a closing divider in the header', () => {
    assert.match(ui, /placeholder="Find scenes…"/);
    assert.match(ui, /<Search size=\{14\} strokeWidth=\{1\.75\} aria-hidden \/>/);
    assert.match(ui, /aria-pressed=\{on\}/);
    assert.match(ui, /<b>\{count\.shown\} of \{count\.total\}<\/b>/);
    assert.match(ui, /\{place === 'bar' && <span className="bar-sep pf-sep" aria-hidden="true" \/>\}/);
  });
  it('the header on wide windows (1500px+), the top of the workspace below that, never both', () => {
    assert.match(css, /\.plan-filter\.is-workspace \{ display: none;/);
    assert.match(css, /@media \(max-width: 1499\.98px\) \{\s*\.plan-filter\.is-bar \{ display: none; \}\s*\.plan-filter\.is-workspace \{ display: flex; \}/);
    assert.match(css, /\.pf-find \{[^}]*height: 32px;/);
  });
});
