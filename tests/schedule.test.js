// Stage 2, Phase 1: Scheduling V1 (Plan → Stripboard → Schedule).
//
//   - What's stored: only the days, their scene order, an optional date and note, and an optional page
//     target. Everything else is worked out from the script and the breakdown (scheduleModel).
//   - Actions never put a scene on two days, never touch the script, and the last day removed means no
//     schedule at all (the Stripboard is back to exactly what it was).
//   - Day-Out-of-Days codes, holds, and the quiet advisory notes (over target only when one is set,
//     day and night together, "possibly more than one location").
//   - Script | Schedule is a per-project preference on this device.
//   - App: every schedule change is one undo step; the first day fixes the cast numbers in that step.
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFountain } from '../src/lib/fountain.js';
import { analyzeScript, makeBlock } from '../src/lib/screenplay.js';
import { buildBreakdown } from '../src/lib/productionEngine.js';
import { normalizeProduction } from '../src/lib/productionData.js';
import {
  DOOD_CODES, LOCATION_NOTE_AT, STRIP_VIEW_KEY, addDay, basePlace, dayDateLabel, fillDates, forgetMissing, isEmptySchedule, loadStripView,
  moveDay, moveScene, normalizeSchedule, removeDay, saveStripView, scheduleIsReadable, scheduleModel, setDayDate, setDayNote,
  setPagesTarget,
} from '../src/lib/schedule.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const blocks = parseFountain(read('tests/browser/stripboard-fixture.fountain')).blocks.map((b) => makeBlock(b.type, b.text, b.dual ? { dual: b.dual } : null));
const analysis = analyzeScript(blocks);
const rows = buildBreakdown({ blocks, analysis, production: null });
const id = (n) => rows.find((r) => r.number === n).id;
const nums = (list) => list.map((r) => r.number);

/** Days with the given scene numbers, in order. */
function build(...days) {
  let s = null;
  const ids = [];
  for (const scenes of days) {
    const out = addDay(s);
    s = out.schedule;
    ids.push(out.dayId);
    for (const n of scenes) s = moveScene(s, id(n), out.dayId);
  }
  return { s, ids };
}

describe('what a schedule stores', () => {
  it('only days (id, scene ids, date, note) and a page target', () => {
    const { s } = build([2, 3]);
    assert.deepEqual(Object.keys(s).sort(), ['days', 'pagesTarget']);
    assert.deepEqual(Object.keys(s.days[0]).sort(), ['date', 'id', 'note', 'sceneIds']);
    assert.deepEqual(s.days[0].sceneIds, [id(2), id(3)]);
    assert.equal(s.pagesTarget, null);
  });
  it('cleans what it reads: one day per scene, unique day ids, real dates, a sane target', () => {
    const s = normalizeSchedule({
      days: [
        { id: 'a', sceneIds: ['x', 'y', 'x', 3, ''], date: '2027-02-30', note: 7 },
        { id: 'a', sceneIds: ['z'] },
        { id: 'b', sceneIds: ['y', 'w'], date: '2027-05-11', note: 'Call 6am' },
        null, { sceneIds: ['q'] },
      ],
      pagesTarget: 99999,
    });
    assert.deepEqual(s, {
      days: [{ id: 'a', sceneIds: ['x', 'y'], date: null, note: '' }, { id: 'b', sceneIds: ['w'], date: '2027-05-11', note: 'Call 6am' }],
      pagesTarget: null,
    });
    assert.equal(normalizeSchedule({ days: [], pagesTarget: 8 }), null, 'no days: no schedule');
    assert.equal(normalizeSchedule({ days: [{ id: 'a', sceneIds: [] }], pagesTarget: 36 }).pagesTarget, 36);
  });
  it('keeps fields a newer DraftLine adds, on the schedule and on each day', () => {
    const s = normalizeSchedule({ days: [{ id: 'a', sceneIds: [], unit: 'Second unit' }], pagesTarget: null, calendar: { tz: 'x' } });
    assert.equal(s.days[0].unit, 'Second unit');
    assert.deepEqual(s.calendar, { tz: 'x' });
    assert.equal(moveScene(s, 'k', 'a').days[0].unit, 'Second unit', 'kept through an edit');
  });
  it('a schedule in a shape this version doesn’t know is kept untouched and not edited', () => {
    assert.equal(scheduleIsReadable(null), true);
    assert.equal(scheduleIsReadable({ days: [] }), true);
    assert.equal(scheduleIsReadable(build([1]).s), true);
    assert.equal(scheduleIsReadable({ order: ['a'] }), false);
    assert.equal(isEmptySchedule({ order: ['a'] }), false);
    const p = normalizeProduction({ version: 1, scenes: {}, schedule: { order: ['a'], v: 2 } });
    assert.deepEqual(p.schedule, { order: ['a'], v: 2 });
  });
  it('the project keeps it (and drops an empty one)', () => {
    const { s } = build([1, 2]);
    assert.deepEqual(normalizeProduction({ version: 1, scenes: {}, schedule: s }).schedule, s);
    assert.equal('schedule' in normalizeProduction({ version: 1, scenes: {}, schedule: { days: [] } }), false);
  });
});

describe('schedule actions', () => {
  it('a scene is never on two days; moving it takes it off the one it was on', () => {
    let { s, ids } = build([1, 2], [3]);
    s = moveScene(s, id(2), ids[1], 0);
    assert.deepEqual(s.days.map((d) => d.sceneIds), [[id(1)], [id(2), id(3)]]);
    s = moveScene(s, id(2), null);
    assert.deepEqual(s.days.map((d) => d.sceneIds), [[id(1)], [id(3)]], 'back to Unscheduled');
    s = moveScene(s, id(1), ids[0], 99);
    assert.deepEqual(s.days[0].sceneIds, [id(1)], 'index past the end: the end');
  });
  it('days are added at the end or after a day, moved, and removed (scenes go back to Unscheduled)', () => {
    let { s, ids } = build([1], [2], [3]);
    const mid = addDay(s, { afterId: ids[0] });
    s = mid.schedule;
    assert.deepEqual(s.days.map((d) => d.id), [ids[0], mid.dayId, ids[1], ids[2]]);
    s = moveDay(s, ids[2], 0);
    assert.deepEqual(s.days.map((d) => d.id), [ids[2], ids[0], mid.dayId, ids[1]]);
    s = removeDay(s, ids[0]);
    assert.equal(s.days.length, 3);
    assert.ok(!s.days.some((d) => d.sceneIds.includes(id(1))));
  });
  it('removing the last day removes the schedule', () => {
    const { s, ids } = build([1]);
    assert.equal(removeDay(s, ids[0]), null);
  });
  it('actions return new objects and never change the one they were given', () => {
    const { s, ids } = build([1, 2]);
    const before = JSON.stringify(s);
    moveScene(s, id(1), null);
    setDayDate(s, ids[0], '2027-01-04');
    setDayNote(s, ids[0], 'x');
    setPagesTarget(s, 40);
    removeDay(s, ids[0]);
    assert.equal(JSON.stringify(s), before);
  });
  it('dates: a real date or none; notes; the page target in eighths or none', () => {
    let { s, ids } = build([1]);
    s = setDayDate(s, ids[0], '2027-05-11');
    assert.equal(s.days[0].date, '2027-05-11');
    assert.equal(setDayDate(s, ids[0], '2027-13-01').days[0].date, null);
    assert.equal(setDayDate(s, ids[0], null).days[0].date, null);
    assert.equal(setDayNote(s, ids[0], 'Call 6am').days[0].note, 'Call 6am');
    assert.equal(setPagesTarget(s, 36).pagesTarget, 36);
    assert.equal(setPagesTarget(s, 0).pagesTarget, null);
    assert.equal(setPagesTarget(s, 2.5).pagesTarget, null);
  });
  it('date the days after: one a day from the start, weekends skipped when asked, earlier days kept', () => {
    let { s, ids } = build([1], [2], [3], [4]);
    s = setDayDate(s, ids[0], '2027-01-01');
    const skip = fillDates(s, ids[1], '2027-05-14'); // a Friday
    assert.deepEqual(skip.days.map((d) => d.date), ['2027-01-01', '2027-05-14', '2027-05-17', '2027-05-18']);
    const all = fillDates(s, ids[1], '2027-05-14', { skipWeekends: false });
    assert.deepEqual(all.days.map((d) => d.date), ['2027-01-01', '2027-05-14', '2027-05-15', '2027-05-16']);
    assert.equal(fillDates(s, ids[1], '2027-05-15').days[1].date, '2027-05-17', 'a Saturday start moves to Monday');
  });
  it('scenes no longer in the script are cleared only on purpose', () => {
    const { s } = build([1, 2]);
    const gone = { ...s, days: [{ ...s.days[0], sceneIds: [...s.days[0].sceneIds, 'gone'] }] };
    const model = scheduleModel(rows, gone);
    assert.deepEqual(model.missing, ['gone']);
    assert.deepEqual(nums(model.days[0].rows), [1, 2], 'hidden from the day, not lost');
    assert.deepEqual(forgetMissing(gone, rows.map((r) => r.id)).days[0].sceneIds, [id(1), id(2)]);
  });
});

describe('what the Schedule view shows (scheduleModel)', () => {
  it('no schedule: every scene unscheduled, in script order, and no day numbers', () => {
    const m = scheduleModel(rows, null);
    assert.equal(m.days.length, 0);
    assert.deepEqual(nums(m.unscheduled), nums(rows));
    assert.equal(m.dayOf.size, 0);
  });
  it('days in schedule order, the rest unscheduled in script order, D-numbers for Script view', () => {
    const { s } = build([13, 2, 3], [4, 6]);
    const m = scheduleModel(rows, s);
    assert.deepEqual(m.days.map((d) => nums(d.rows)), [[13, 2, 3], [4, 6]]);
    assert.deepEqual(nums(m.unscheduled), [1, 5, 7, 8, 9, 10, 11, 12, 14]);
    assert.equal(m.dayOf.get(id(13)), 1);
    assert.equal(m.dayOf.get(id(6)), 2);
    assert.equal(m.scheduledCount, 5);
    assert.equal(m.days[0].eighths, 3 + 3 + 2);
  });
  it('a scene new to the script starts in Unscheduled', () => {
    const { s } = build([1]);
    const more = [...blocks, makeBlock('scene', 'EXT. ROOFTOP - NIGHT'), makeBlock('action', 'Wind.')];
    const m = scheduleModel(buildBreakdown({ blocks: more, analysis: analyzeScript(more), production: null }), s);
    assert.equal(m.unscheduled.at(-1).location, 'ROOFTOP');
  });
  it('cast with Day-Out-of-Days codes, and holds between an actor’s first and last day', () => {
    // MARIE 1: scenes 1, 2, 4, 13, 14 · THEO 2: 1, 2, 3, 10, 13, 14 · AUGUSTIN 3: 3, 6, 14
    const { s } = build([2], [5], [4], [6]);
    const m = scheduleModel(rows, s);
    const codes = m.days.map((d) => d.cast.map((c) => `${c.number}${c.code}`).join(' '));
    assert.deepEqual(codes, ['1SW 2SWF', '4SWF', '1WF', '3SWF']);
    assert.deepEqual(m.days[1].hold.map((c) => `${c.number}${c.code}`), ['1H'], 'MARIE waits through day 2');
    assert.deepEqual(m.days[2].hold, []);
  });
  it('notes are quiet and advisory: over target only when set, day with night, several places', () => {
    let { s } = build([2, 4], [1, 9, 7], [12]);
    let m = scheduleModel(rows, s);
    assert.deepEqual(m.days[0].notes.map((n) => n.kind), ['daynight']);
    assert.deepEqual(m.days[1].notes.map((n) => n.kind), ['daynight', 'places']);
    assert.match(m.days[1].notes[1].text, /^3 different places: possibly more than one location$/);
    assert.deepEqual(m.days[2].notes, []);
    assert.equal(m.noteCount, 2);
    s = setPagesTarget(s, 3);
    m = scheduleModel(rows, s);
    assert.deepEqual(m.days[0].notes.map((n) => n.kind), ['target', 'daynight'], '4/8 over a 3/8 target');
    assert.equal(LOCATION_NOTE_AT, 3);
  });
  it('one property with several sets counts as one place', () => {
    assert.equal(basePlace('FERRY - PASSENGER DECK'), 'FERRY');
    const { s } = build([2, 6, 13]);
    assert.deepEqual(scheduleModel(rows, s).days[0].places, ['FERRY']);
  });
  it('the day’s requirements gather each scene’s breakdown, once per shared element, with every scene that needs it', () => {
    const production = normalizeProduction({ version: 1, scenes: { [id(2)]: { props: ['Thermos', 'Radio'] }, [id(3)]: { props: ['radio'], vehicles: ['Ferry'] } } });
    const r = buildBreakdown({ blocks, analysis, production });
    const { s } = build([2, 3]);
    const req = scheduleModel(r, s).days[0].requirements;
    assert.deepEqual(req.props.map((x) => [x.name, x.uses.map((u) => u.number)]), [['Thermos', [2]], ['Radio', [2, 3]]]);
    assert.deepEqual(req.vehicles.map((x) => x.name), ['Ferry']);
    assert.deepEqual(Object.keys(req), ['extras', 'props', 'wardrobe', 'makeup', 'vehicles', 'stunts', 'sfx', 'vfx']);
  });
  it('every Day-Out-of-Days code has a name and a meaning', () => {
    for (const code of ['SW', 'W', 'WF', 'SWF', 'H']) assert.equal(DOOD_CODES[code].length, 2, code);
  });
  it('a date reads as a calendar day, in any time zone', () => {
    assert.equal(dayDateLabel('2027-05-11', 'en-GB'), 'Tue 11 May');
    assert.equal(dayDateLabel('nope', 'en-GB'), '');
  });
});

describe('Script | Schedule: remembered per project on this device', () => {
  let saved;
  beforeEach(() => {
    saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const m = new Map();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) },
    });
  });
  afterEach(() => {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved);
    else delete globalThis.localStorage;
  });
  it('nothing chosen yet: null (the app shows Schedule once there is a day)', () => {
    assert.equal(loadStripView('p1'), null);
  });
  it('a choice per project, kept apart', () => {
    assert.equal(saveStripView('p1', 'script'), true);
    saveStripView('p2', 'schedule');
    assert.equal(loadStripView('p1'), 'script');
    assert.equal(loadStripView('p2'), 'schedule');
    assert.equal(saveStripView('p1', 'board'), false);
    assert.ok(globalThis.localStorage.getItem(STRIP_VIEW_KEY).length < 200);
  });
  it('broken storage never breaks the Stripboard', () => {
    globalThis.localStorage.setItem(STRIP_VIEW_KEY, '{nope');
    assert.equal(loadStripView('p1'), null);
    assert.equal(saveStripView('p1', 'script'), true, 'starts again');
  });
});

describe('Scheduling in the app', () => {
  const app = read('src/App.jsx');
  const board = read('src/components/planning/ScheduleBoard.jsx');
  const ws = read('src/components/planning/PlanningWorkspace.jsx');
  it('every schedule change is an undo step that leaves the script as it is', () => {
    const step = app.slice(app.indexOf('const scheduleStep = '), app.indexOf('const dayName = '));
    assert.match(step, /planStep\(put\(after,/);
    assert.match(app, /const planStep = \(forward, back, label\) => \{\n\s+set\(\(b\) => b\.slice\(\), null, \{/);
    const ops = app.slice(app.indexOf('const scheduleOps = {'), app.indexOf('const openSceneInWrite'));
    assert.doesNotMatch(ops, /setBlocks|set\(\(b\) => b\.(map|filter)/, 'never edits the script');
  });
  it('the first shooting day fixes the cast numbers in the same step, and switches to Schedule', () => {
    const add = app.slice(app.indexOf('const addShootingDay = '), app.indexOf('const scheduleOps = {'));
    assert.match(add, /\{ fixCast: true \}/);
    assert.match(add, /if \(first\) chooseStripView\('schedule'\)/);
    assert.match(app, /const fixing = fixCast && !cur\.castNumbers;/);
  });
  it('fixed cast numbers come from the script as it is (the first day and Renumber Cast…)', () => {
    assert.equal((app.match(/freezeCastNumbers\(analysis\)/g) || []).length, 2);
    assert.doesNotMatch(app, /latest\.current\.analysis/, 'latest.current has no analysis');
  });
  it('Renumber Cast… is in Plan’s ⋮ on the Stripboard once numbers are fixed, asks first, and is one undo step', () => {
    assert.match(app, /onRenumberCast: inPlan && planView === 'stripboard' && production\.castNumbers && scheduleIsReadable\(production\.schedule\) \? \(\) => setRenumberOpen\(true\) : null,/);
    assert.match(app, /<RenumberCastModal[\s\S]*onConfirm=\{scheduleOps\.renumberCast\}/);
    const ops = app.slice(app.indexOf('renumberCast: () => {'), app.indexOf('const openSceneInWrite'));
    assert.match(ops, /planStep\(put\(next\)/);
    assert.doesNotMatch(board, /renumberCast|Renumber/, 'not in a day’s details any more');
    const modal = read('src/components/planning/RenumberCastModal.jsx');
    assert.match(modal, /<dialog[\s\S]*aria-labelledby="rc-title"/);
    assert.match(modal, />Cancel<\/button>[\s\S]*>Renumber<\/button>/);
  });
  it('a day’s details: date and page target first; each cast code explains itself on hover and on a tap', () => {
    const pop = board.slice(board.indexOf('function DayPopover('));
    assert.ok(pop.indexOf('Page target, every day') < pop.indexOf('day-pop-notes'), 'target before the notes');
    assert.ok(pop.indexOf('type="date"') < pop.indexOf('day-pop-notes'), 'date before the notes');
    assert.match(pop, /className="day-pop-code"[\s\S]*title=\{doodText\(c\.code\)\}[\s\S]*aria-expanded=\{open\}/);
    assert.match(pop, /className="day-pop-explain" aria-live="polite"/);
  });
  it('+ Shooting Day only on the Stripboard, only when this version can edit the schedule', () => {
    assert.match(app, /inPlan && planView === 'stripboard' && scheduleIsReadable\(production\.schedule\)/);
  });
  it('dragging is off while filtered; the handle’s Move to Day… always works', () => {
    assert.match(board, /const canDrag = !visible;/);
    assert.match(board, /Move to Day…/);
    assert.match(ws, /drag is off/);
  });
  it('a strip’s own click still opens the scene in Write, in both views', () => {
    assert.match(board, /<StripRow[^>]*onOpenScene=\{onOpenScene\}/);
  });
});
